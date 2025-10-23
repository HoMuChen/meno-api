/**
 * Gemini Transcription Service
 * Google Gemini 2.5 Pro implementation with streaming API for long audio files
 * Handles real-time progress updates and incremental segment saving
 */
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TranscriptionService = require('./transcription.service');

class GeminiTranscriptionService extends TranscriptionService {
  constructor(logger, transcriptionDataService, meetingService) {
    super(logger);
    this.transcriptionDataService = transcriptionDataService;
    this.meetingService = meetingService;

    // Configuration
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    this.streamTimeout = parseInt(process.env.GEMINI_STREAM_TIMEOUT) || 300000; // 5 min
    this.chunkStallTimeout = parseInt(process.env.GEMINI_CHUNK_STALL_TIMEOUT) || 30000; // 30s
    this.averageSegmentDuration = parseInt(process.env.AVERAGE_SEGMENT_DURATION) || 5000; // 5s

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    // Initialize Gemini client
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Transcribe audio file using Gemini streaming API
   * Processes long audio files without timeout by streaming results
   * @param {string} audioFilePath - Path to audio file
   * @param {string} meetingId - Meeting ID for progress tracking
   * @param {Object} options - Transcription options
   * @returns {Promise<Array>} Array of transcription segments
   */
  async transcribeAudio(audioFilePath, meetingId, options = {}) {
    try {
      this.logger.info('Starting Gemini transcription', {
        audioFilePath,
        meetingId,
        model: this.model
      });

      // Update status to processing
      await this._updateMeetingStatus(meetingId, 'processing', 0);

      // Get audio file info
      const audioBuffer = fs.readFileSync(audioFilePath);
      const mimeType = this._detectMimeType(audioFilePath);

      // Calculate estimated total segments for progress
      const meeting = await this.meetingService.getMeetingById(meetingId);
      const estimatedTotal = this._calculateEstimatedSegments(meeting.duration);

      await this._updateTranscriptionMetadata(meetingId, {
        startedAt: new Date(),
        estimatedTotal,
        processedSegments: 0
      });

      // Initialize Gemini model
      const model = this.genAI.getGenerativeModel({ model: this.model });

      // Prepare streaming request
      const prompt = `Transcribe this audio file with speaker diarization and timestamps.
Return the transcription as a JSON array where each element has:
- startTime: start timestamp in milliseconds
- endTime: end timestamp in milliseconds
- speaker: speaker identifier (e.g., "SPEAKER_01", "SPEAKER_02")
- text: the transcribed text
- confidence: confidence score between 0 and 1

Return ONLY the JSON array, no additional text.`;

      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: audioBuffer.toString('base64')
          }
        }
      ];

      // Start streaming
      const result = await model.generateContentStream({ contents: [{ role: 'user', parts }] });

      const segments = [];
      let processedSegments = 0;
      let accumulatedText = '';
      let lastChunkTime = Date.now();

      // Set up stall detection
      const stallCheckInterval = setInterval(() => {
        const elapsed = Date.now() - lastChunkTime;
        if (elapsed > this.chunkStallTimeout) {
          this.logger.warn('Stream stalled', {
            meetingId,
            elapsedMs: elapsed,
            processedSegments
          });
        }
      }, this.chunkStallTimeout);

      // Process streaming chunks
      for await (const chunk of result.stream) {
        lastChunkTime = Date.now();

        const chunkText = chunk.text();
        if (!chunkText) continue;

        accumulatedText += chunkText;

        // Try to parse complete JSON segments from accumulated text
        const parsedSegments = this._parseStreamingChunks(accumulatedText);

        if (parsedSegments.length > 0) {
          // Process new segments
          for (const rawSegment of parsedSegments) {
            const segment = this._mapGeminiSegment(rawSegment);
            segments.push(segment);

            // Save segment immediately to DB
            try {
              await this.transcriptionDataService.saveTranscriptions(meetingId, [segment]);
              processedSegments++;

              // Update progress
              const progress = Math.min(95, Math.floor((processedSegments / estimatedTotal) * 100));
              await this._updateMeetingProgress(meetingId, progress, processedSegments);

              this.logger.debug('Segment saved', {
                meetingId,
                segmentIndex: processedSegments,
                progress
              });
            } catch (saveError) {
              this.logger.error('Error saving segment', {
                error: saveError.message,
                meetingId,
                segmentIndex: processedSegments
              });
              // Continue processing other segments
            }
          }

          // Clear processed text
          accumulatedText = '';
        }

        await this._updateTranscriptionMetadata(meetingId, {
          lastChunkAt: new Date()
        });
      }

      clearInterval(stallCheckInterval);

      // Generate title and description
      this.logger.info('Generating meeting title and description', { meetingId });
      const summary = await this.generateSummary(meetingId);

      // Update meeting with generated title and description
      const meetingDoc = await this.meetingService.getMeetingById(meetingId);
      meetingDoc.title = summary.title;
      meetingDoc.description = summary.description;
      await meetingDoc.save();

      this.logger.info('Meeting updated with generated summary', {
        meetingId,
        title: summary.title,
        hasDescription: !!summary.description
      });

      // Finalize
      await this._updateMeetingStatus(meetingId, 'completed', 100);
      await this._updateTranscriptionMetadata(meetingId, {
        completedAt: new Date()
      });

      this.logger.info('Gemini transcription completed', {
        meetingId,
        segmentsCount: segments.length,
        processedSegments
      });

      return segments;

    } catch (error) {
      this.logger.error('Gemini transcription error', {
        error: error.message,
        stack: error.stack,
        meetingId,
        audioFilePath
      });

      // Update status to failed
      await this._updateMeetingStatus(meetingId, 'failed', 0, error.message);

      throw error;
    }
  }

  /**
   * Parse streaming chunks to extract complete JSON segments
   * @param {string} text - Accumulated text from stream
   * @returns {Array} Parsed segments
   */
  _parseStreamingChunks(text) {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Try to parse as complete JSON array
      const parsed = JSON.parse(cleanText);

      if (Array.isArray(parsed)) {
        return parsed;
      } else if (typeof parsed === 'object') {
        return [parsed];
      }

      return [];
    } catch (error) {
      // Not yet a complete JSON, continue accumulating
      return [];
    }
  }

  /**
   * Map Gemini segment format to application format
   * @param {Object} geminiSegment - Segment from Gemini API
   * @returns {Object} Mapped segment
   */
  _mapGeminiSegment(geminiSegment) {
    return {
      startTime: geminiSegment.startTime || 0,
      endTime: geminiSegment.endTime || 0,
      speaker: this._mapSpeakerLabel(geminiSegment.speaker),
      text: geminiSegment.text || '',
      confidence: geminiSegment.confidence || null
    };
  }

  /**
   * Map Gemini speaker labels to app format
   * @param {string} speakerLabel - Gemini speaker label (e.g., "SPEAKER_01")
   * @returns {string} Mapped speaker name (e.g., "Speaker 1")
   */
  _mapSpeakerLabel(speakerLabel) {
    if (!speakerLabel) return 'Unknown Speaker';

    // Convert SPEAKER_01 → Speaker 1
    const match = speakerLabel.match(/SPEAKER[_\s](\d+)/i);
    if (match) {
      return `Speaker ${parseInt(match[1])}`;
    }

    return speakerLabel;
  }

  /**
   * Calculate estimated number of segments based on audio duration
   * @param {number} durationSeconds - Audio duration in seconds
   * @returns {number} Estimated segment count
   */
  _calculateEstimatedSegments(durationSeconds) {
    if (!durationSeconds) return 100; // Default fallback

    const durationMs = durationSeconds * 1000;
    return Math.ceil(durationMs / this.averageSegmentDuration);
  }

  /**
   * Detect MIME type from file extension
   * @param {string} filePath - Audio file path
   * @returns {string} MIME type
   */
  _detectMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();

    const mimeTypes = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'wave': 'audio/wav',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'webm': 'audio/webm',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac'
    };

    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Update meeting status and progress
   * @param {string} meetingId - Meeting ID
   * @param {string} status - New status
   * @param {number} progress - Progress percentage
   * @param {string} errorMessage - Optional error message
   */
  async _updateMeetingStatus(meetingId, status, progress, errorMessage = null) {
    try {
      const meeting = await this.meetingService.getMeetingById(meetingId);
      meeting.transcriptionStatus = status;
      meeting.transcriptionProgress = progress;

      if (errorMessage) {
        meeting.metadata = meeting.metadata || {};
        meeting.metadata.transcription = meeting.metadata.transcription || {};
        meeting.metadata.transcription.errorMessage = errorMessage;
      }

      await meeting.save();
    } catch (error) {
      this.logger.error('Error updating meeting status', {
        error: error.message,
        meetingId
      });
    }
  }

  /**
   * Update meeting progress
   * @param {string} meetingId - Meeting ID
   * @param {number} progress - Progress percentage
   * @param {number} processedSegments - Number of processed segments
   */
  async _updateMeetingProgress(meetingId, progress, processedSegments) {
    try {
      const meeting = await this.meetingService.getMeetingById(meetingId);
      meeting.transcriptionProgress = progress;

      meeting.metadata = meeting.metadata || {};
      meeting.metadata.transcription = meeting.metadata.transcription || {};
      meeting.metadata.transcription.processedSegments = processedSegments;

      await meeting.save();
    } catch (error) {
      this.logger.error('Error updating meeting progress', {
        error: error.message,
        meetingId
      });
    }
  }

  /**
   * Update transcription metadata
   * @param {string} meetingId - Meeting ID
   * @param {Object} updates - Metadata updates
   */
  async _updateTranscriptionMetadata(meetingId, updates) {
    try {
      const meeting = await this.meetingService.getMeetingById(meetingId);

      meeting.metadata = meeting.metadata || {};
      meeting.metadata.transcription = meeting.metadata.transcription || {};

      Object.assign(meeting.metadata.transcription, updates);

      await meeting.save();
    } catch (error) {
      this.logger.error('Error updating transcription metadata', {
        error: error.message,
        meetingId
      });
    }
  }

  /**
   * Generate meeting title and description from transcription
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Generated title and description
   */
  async generateSummary(meetingId) {
    try {
      this.logger.info('Generating meeting summary', { meetingId });

      // Get all transcription segments
      const transcriptionData = await this.transcriptionDataService.getTranscriptions(meetingId, {
        page: 1,
        limit: 1000,
        sort: 'startTime'
      });

      if (!transcriptionData.transcriptions || transcriptionData.transcriptions.length === 0) {
        throw new Error('No transcriptions found for meeting');
      }

      // Combine all transcription text
      const fullTranscript = transcriptionData.transcriptions
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      // Use Gemini to generate title and description
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const prompt = `Based on this meeting transcript, generate a concise title and description.

IMPORTANT: Generate the title and description in the SAME LANGUAGE as the transcript text. If the transcript is in Chinese, respond in Chinese. If it's in English, respond in English, etc.

Transcript:
${fullTranscript.substring(0, 10000)} ${fullTranscript.length > 10000 ? '...(truncated)' : ''}

Return ONLY a JSON object with this exact structure:
{
  "title": "A short, descriptive title (max 100 characters) - MUST be in the same language as the transcript",
  "description": "A brief summary of the key topics and outcomes (max 500 characters) - MUST be in the same language as the transcript"
}

Do not include any markdown formatting or code blocks, just the JSON object.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      let cleanText = text.trim();
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const summary = JSON.parse(cleanText);

      this.logger.info('Meeting summary generated', {
        meetingId,
        title: summary.title,
        descriptionLength: summary.description?.length || 0
      });

      return {
        title: summary.title || 'Untitled Meeting',
        description: summary.description || ''
      };
    } catch (error) {
      this.logger.error('Error generating meeting summary', {
        error: error.message,
        stack: error.stack,
        meetingId
      });

      // Return fallback values
      return {
        title: 'Meeting',
        description: ''
      };
    }
  }

  /**
   * Generate meeting title and description with streaming
   * @param {string} meetingId - Meeting ID
   * @returns {AsyncGenerator} Async generator yielding text chunks
   */
  async* generateSummaryStream(meetingId) {
    try {
      this.logger.info('Generating meeting summary with streaming', { meetingId });

      // Get all transcription segments
      const transcriptionData = await this.transcriptionDataService.getTranscriptions(meetingId, {
        page: 1,
        limit: 1000,
        sort: 'startTime'
      });

      if (!transcriptionData.transcriptions || transcriptionData.transcriptions.length === 0) {
        throw new Error('No transcriptions found for meeting');
      }

      // Combine all transcription text
      const fullTranscript = transcriptionData.transcriptions
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      // Use Gemini to generate summary with streaming
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const prompt = `**CRITICAL REQUIREMENTS:**
1. You MUST generate the entire summary in the EXACT SAME LANGUAGE as the transcript below
2. You MUST format the output as MARKDOWN TEXT ONLY

**Language Requirement:**
For example:
- If the transcript is in Chinese (中文), write the ENTIRE summary in Chinese (中文)
- If the transcript is in English, write the ENTIRE summary in English
- If the transcript is in Spanish, write the ENTIRE summary in Spanish
- And so on for any other language

**DO NOT translate the transcript language. Use the SAME language for ALL sections.**

**Format Requirement:**
You MUST use MARKDOWN format with proper headings (##), bullet points (-), and text formatting.
DO NOT use JSON, code blocks, or any other format.

Transcript:
${fullTranscript.substring(0, 10000)} ${fullTranscript.length > 10000 ? '...(truncated)' : ''}

Based on this meeting transcript, generate a comprehensive summary in MARKDOWN FORMAT using the SAME LANGUAGE as the transcript above.

Generate a structured markdown summary with the following sections (section headers in same language as transcript):

## Overview
A brief 2-3 sentence overview of what was discussed in the meeting.

## Key Points
- List the main topics and decisions made
- Include important discussion points
- Highlight any agreements or consensus reached

## Conclusion
Summarize the final outcomes and what was agreed upon.

## Action Items
- List specific tasks that need to be done
- Include who is responsible (if mentioned)
- Note any deadlines or priorities (if mentioned)

**REMINDERS:**
- Write the ENTIRE summary (including all section content) in the SAME LANGUAGE as the transcript above
- Use MARKDOWN FORMAT ONLY (## for headings, - for bullet points)
- Return ONLY the markdown text - NO code blocks, NO JSON, NO other formatting`;

      const result = await model.generateContentStream(prompt);

      // Stream chunks as they arrive
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }

      this.logger.info('Meeting summary streaming completed', { meetingId });
    } catch (error) {
      this.logger.error('Error generating meeting summary stream', {
        error: error.message,
        stack: error.stack,
        meetingId
      });
      throw error;
    }
  }

  /**
   * Estimate transcription time based on audio duration
   * @param {number} audioDuration - Audio duration in seconds
   * @returns {number} Estimated time in seconds
   */
  estimateTranscriptionTime(audioDuration) {
    // Gemini typically processes at ~0.08x speed (1 hour audio = ~5 minutes)
    return Math.ceil(audioDuration * 0.08);
  }
}

module.exports = GeminiTranscriptionService;
