/**
 * Transcription Job Processor
 *
 * Processes transcription jobs from the queue.
 * This is the worker implementation that replaces the fire-and-forget
 * async processing in MeetingService._processTranscription
 */

const path = require('path');
const fs = require('fs').promises;
const Meeting = require('../../models/meeting.model');
const logger = require('../../components/logging');

/**
 * Process a transcription job
 *
 * @param {object} job - BullMQ job object
 * @param {object} job.data - Job data
 * @param {string} job.data.meetingId - Meeting ID
 * @param {string} job.data.audioUri - Audio file storage URI
 * @param {object} job.data.options - Transcription options
 * @param {object} services - Injected services
 * @returns {Promise<object>} Processing result
 */
async function processTranscriptionJob(job, services) {
  const { meetingId, audioUri, options } = job.data;
  const { transcriptionService, transcriptionDataService, audioStorageProvider } = services;

  let tempFilePath = null;

  try {
    logger.info('Processing transcription job', {
      jobId: job.id,
      meetingId,
      audioUri,
      options,
    });

    // Update job progress
    await job.updateProgress(0);

    // Get local file path for transcription
    const audioFilePath = await getAudioFilePath(audioUri, audioStorageProvider);
    tempFilePath = !audioUri.startsWith('local://') ? audioFilePath : null;

    logger.debug('Audio file path resolved', {
      audioFilePath,
      meetingId,
      isTemporary: !!tempFilePath,
    });

    // Update progress
    await job.updateProgress(10);

    // Call transcription service with retry logic for 503 errors
    // For Gemini streaming: service handles incremental saves internally
    // For mock service: returns all segments at once
    const segments = await retryTranscription(async () => {
      return await transcriptionService.transcribeAudio(
        audioFilePath,
        meetingId // Pass meetingId for Gemini streaming progress updates
      );
    });

    logger.debug('Transcription service returned', {
      meetingId,
      segmentsCount: segments?.length || 0,
      segmentsType: typeof segments,
    });

    // Update progress
    await job.updateProgress(80);

    // For non-streaming providers (mock), save all segments at once
    if (segments && segments.length > 0) {
      // Check if segments are already saved (by streaming provider)
      const existingCount = await transcriptionDataService.getTranscriptionCount(meetingId);

      if (existingCount === 0) {
        // Not saved yet, save them now (mock provider path)
        await transcriptionDataService.saveTranscriptions(meetingId, segments);
      }
    }

    // Update meeting status to completed
    // (Gemini streaming already sets this, but safe to set again)
    const meeting = await Meeting.findById(meetingId);
    if (meeting && meeting.transcriptionStatus !== 'completed') {
      await meeting.updateTranscriptionProgress('completed', 100);
    }

    // Generate title and description for non-streaming services (e.g., Mock)
    // Note: Gemini streaming service generates this internally during transcribeAudio
    if (transcriptionService.constructor.name === 'MockTranscriptionService') {
      logger.info('Generating title and description for mock transcription', { meetingId });
      try {
        const meetingDoc = await Meeting.findById(meetingId);
        if (meetingDoc && (!meetingDoc.description || meetingDoc.description.trim() === '')) {
          meetingDoc.description = 'Mock transcription completed';
          await meetingDoc.save();
          logger.info('Updated mock meeting with default description', { meetingId });
        }
      } catch (summaryError) {
        logger.warn('Failed to generate title/description for mock transcription', {
          meetingId,
          error: summaryError.message,
        });
      }
    }

    // Update progress to 100%
    await job.updateProgress(100);

    logger.info('Transcription job completed successfully', {
      jobId: job.id,
      meetingId,
      segmentsCount: segments?.length || 0,
    });

    // Clean up temp file if downloaded
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch((err) =>
        logger.warn('Failed to delete temp file', {
          tempFilePath,
          error: err.message,
        })
      );
    }

    return {
      success: true,
      meetingId,
      segmentsCount: segments?.length || 0,
    };
  } catch (error) {
    logger.error('Transcription job failed', {
      jobId: job.id,
      error: error.message,
      stack: error.stack,
      meetingId,
      audioUri,
    });

    // Update meeting status to failed
    const meeting = await Meeting.findById(meetingId);
    if (meeting && meeting.transcriptionStatus !== 'failed') {
      meeting.metadata = meeting.metadata || {};
      meeting.metadata.transcription = meeting.metadata.transcription || {};
      meeting.metadata.transcription.errorMessage = error.message;
      await meeting.updateTranscriptionProgress('failed', 0);
    }

    // Clean up temp file on error
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch((err) =>
        logger.warn('Failed to delete temp file on error', {
          tempFilePath,
          error: err.message,
        })
      );
    }

    // Re-throw error so BullMQ can handle retry logic
    throw error;
  }
}

/**
 * Get audio file path (local or download from cloud storage)
 *
 * @param {string} audioFileUri - Storage URI
 * @param {object} audioStorageProvider - Storage provider instance
 * @returns {Promise<string>} Local file path
 */
async function getAudioFilePath(audioFileUri, audioStorageProvider) {
  try {
    // For local storage, get the absolute path
    if (audioFileUri.startsWith('local://')) {
      return audioStorageProvider.getAbsolutePath(audioFileUri);
    }

    // For cloud storage, download to temp location
    const audioData = await audioStorageProvider.download(audioFileUri);
    const tempPath = path.join(
      process.env.LOCAL_STORAGE_PATH || './storage',
      'temp',
      `transcription-${Date.now()}.audio`
    );

    // Ensure temp directory exists
    const tempDir = path.dirname(tempPath);
    await fs.mkdir(tempDir, { recursive: true });

    // Write to temp file
    await fs.writeFile(tempPath, audioData);

    return tempPath;
  } catch (error) {
    logger.error('Failed to get audio file path', {
      error: error.message,
      audioFileUri,
    });
    throw error;
  }
}

/**
 * Retry transcription with exponential backoff for 503 errors
 *
 * @param {Function} transcribeFn - Transcription function to call
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 5000)
 * @returns {Promise} Transcription result
 */
async function retryTranscription(transcribeFn, maxRetries = 3, initialDelay = 5000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeFn();
    } catch (error) {
      const is503Error = error.message && error.message.includes('503') && error.message.includes('overloaded');
      const isLastAttempt = attempt === maxRetries;

      if (!is503Error || isLastAttempt) {
        throw error; // Re-throw if not 503 or last attempt
      }

      const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
      logger.warn('Gemini API overloaded (503), retrying...', {
        attempt: attempt + 1,
        maxRetries,
        retryAfter: `${delay}ms`,
        error: error.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = processTranscriptionJob;
