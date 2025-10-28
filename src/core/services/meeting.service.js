/**
 * Meeting Service
 * Business logic for meeting management and transcription orchestration
 */
const Meeting = require('../../models/meeting.model');
const Project = require('../../models/project.model');
const User = require('../../models/user.model');
const mongoose = require('mongoose');
const path = require('path');
const BaseService = require('./base.service');
const { getAudioDuration, getAudioDurationFromStorage } = require('../utils/audio-utils');

class MeetingService extends BaseService {
  constructor(logger, fileService, projectService, transcriptionService, transcriptionDataService, audioStorageProvider, authorizationService) {
    super(logger);
    this.fileService = fileService;
    this.projectService = projectService;
    this.transcriptionService = transcriptionService;
    this.transcriptionDataService = transcriptionDataService;
    this.audioStorageProvider = audioStorageProvider;
    this.authorizationService = authorizationService;
  }

  /**
   * Create a new meeting with audio upload
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {Object} meetingData - Meeting data
   * @param {Object} audioFile - Uploaded audio file
   * @returns {Object} Created meeting
   */
  async createMeeting(projectId, userId, meetingData, audioFile) {
    this.logger.info('Meeting service: createMeeting called', {
      projectId,
      userId,
      meetingData,
      audioFile: {
        originalname: audioFile.originalname,
        mimetype: audioFile.mimetype,
        size: audioFile.size,
        uri: audioFile.uri,
        path: audioFile.path // May be undefined for streaming uploads
      }
    });

    try {
      // Verify user owns the project
      this.logger.info('Meeting service: verifying project ownership', {
        projectId,
        userId
      });

      const ownsProject = await this.projectService.verifyOwnership(projectId, userId);
      if (!ownsProject) {
        this.logger.error('Meeting service: project ownership verification failed', {
          projectId,
          userId
        });
        throw new Error('Project not found or access denied');
      }

      this.logger.info('Meeting service: project ownership verified', {
        projectId,
        userId
      });

      // Get audio duration using hybrid approach:
      // 1. Client-provided duration (fastest, best UX)
      // 2. Local file path extraction (for local storage)
      // 3. Storage URI extraction with temp download (for GCS)
      let audioDuration = null;

      // Priority 1: If duration is provided in request body, use it directly
      if (meetingData.duration !== undefined && meetingData.duration !== null) {
        audioDuration = parseFloat(meetingData.duration);
        this.logger.info('Using client-provided audio duration', {
          duration: audioDuration,
          audioFile: audioFile.originalname
        });
      }
      // Priority 2: Try to extract from local file path (for local storage)
      else if (audioFile.path) {
        try {
          audioDuration = await getAudioDuration(audioFile.path);
          this.logger.info('Audio duration extracted from local file path', {
            duration: audioDuration,
            audioFile: audioFile.originalname,
            path: audioFile.path
          });
        } catch (error) {
          this.logger.warn('Failed to extract audio duration from local path', {
            error: error.message,
            audioFile: audioFile.originalname,
            path: audioFile.path
          });
          // Continue without duration - it will default to null
        }
      }
      // Priority 3: Try to extract from storage URI (for GCS - downloads to temp)
      else if (audioFile.uri) {
        try {
          this.logger.info('Attempting to extract audio duration from storage URI', {
            uri: audioFile.uri,
            audioFile: audioFile.originalname
          });

          audioDuration = await getAudioDurationFromStorage(
            audioFile.uri,
            this.audioStorageProvider
          );

          this.logger.info('Audio duration extracted from storage URI', {
            duration: audioDuration,
            audioFile: audioFile.originalname,
            uri: audioFile.uri
          });
        } catch (error) {
          this.logger.warn('Failed to extract audio duration from storage URI', {
            error: error.message,
            audioFile: audioFile.originalname,
            uri: audioFile.uri
          });
          // Continue without duration - it will default to null
        }
      } else {
        this.logger.warn('Audio duration not available: not provided by client and no path/URI available', {
          audioFile: audioFile.originalname
        });
      }

      // File is already uploaded by streaming middleware
      // audioFile.uri contains the storage URI
      this.logger.info('Meeting service: using uploaded file from streaming middleware', {
        uri: audioFile.uri,
        size: audioFile.size
      });

      // Create meeting with storage URI
      const meeting = new Meeting({
        title: meetingData.title,
        projectId,
        audioFile: audioFile.uri, // URI from streaming upload
        duration: audioDuration, // Set extracted or provided duration
        recordingType: meetingData.recordingType || 'upload',
        transcriptionStatus: 'pending',
        transcriptionProgress: 0,
        metadata: {
          fileSize: audioFile.size,
          mimeType: audioFile.mimetype,
          originalName: audioFile.originalname
        }
      });

      await meeting.save();

      this.logSuccess('Meeting created', {
        meetingId: meeting._id,
        projectId,
        userId,
        audioFileUri: audioFile.uri
      });

      // Increment user's usage counter (if duration available)
      if (audioDuration && audioDuration > 0) {
        try {
          const user = await User.findById(userId).populate('tier');
          if (user) {
            user.addUsage(audioDuration);
            await user.save();

            this.logger.info('User usage incremented', {
              userId,
              duration: audioDuration,
              newTotal: user.currentMonthUsage.duration
            });
          }
        } catch (usageError) {
          // Log but don't fail the meeting creation
          this.logger.warn('Failed to increment usage', {
            error: usageError.message,
            userId,
            meetingId: meeting._id
          });
        }
      }

      // Auto-start transcription if configured
      if (process.env.AUTO_START_TRANSCRIPTION === 'true') {
        this.logger.info('Auto-starting transcription', { meetingId: meeting._id });

        // Fire and forget - process transcription asynchronously
        this._processTranscription(meeting._id, audioFile.uri).catch(error => {
          this.logger.error('Auto-transcription failed', {
            error: error.message,
            meetingId: meeting._id
          });
        });
      }

      return meeting.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Create meeting', { projectId, userId });
    }
  }

  /**
   * Get meetings for a project
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @returns {Object} Meetings with pagination
   */
  async getMeetings(projectId, userId, options = {}) {
    try {
      // Verify ownership
      const ownsProject = await this.projectService.verifyOwnership(projectId, userId);
      if (!ownsProject) {
        throw new Error('Project not found or access denied');
      }

      const {
        page = 1,
        limit = 10,
        sort = '-createdAt'
      } = options;

      // Debug: Log query details
      this.logger.debug('getMeetings query preparation', {
        projectId,
        projectIdType: typeof projectId,
        isValidObjectId: mongoose.Types.ObjectId.isValid(projectId)
      });

      // Convert projectId string to ObjectId for aggregation
      const result = await Meeting.findWithTranscriptionCount(
        { projectId: new mongoose.Types.ObjectId(projectId) },
        { page: parseInt(page), limit: parseInt(limit), sort }
      );

      // Debug: Log query results
      this.logger.debug('getMeetings query results', {
        meetingsCount: result.meetings.length,
        paginationTotal: result.pagination.total,
        page: result.pagination.page
      });

      this.logSuccess('Meetings retrieved', {
        projectId,
        userId,
        count: result.meetings.length,
        page
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get meetings', { projectId, userId });
    }
  }

  /**
   * Get meeting by ID (internal use without access control)
   * @param {string} meetingId - Meeting ID
   * @returns {Object} Meeting document
   * @private
   */
  async _getMeetingByIdInternal(meetingId) {
    try {
      const meeting = await Meeting.findById(meetingId);

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      return meeting;
    } catch (error) {
      this.logAndThrow(error, 'Get meeting internal', { meetingId });
    }
  }

  /**
   * Get meeting by ID
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID (optional for internal calls)
   * @returns {Object} Meeting details
   */
  async getMeetingById(meetingId, userId = null) {
    try {
      // If no userId provided, this is an internal call - use internal method
      if (!userId) {
        return await this._getMeetingByIdInternal(meetingId);
      }

      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership through project
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      // Get transcription count
      const transcriptionsCount = await this.transcriptionDataService.getTranscriptionCount(meetingId);

      const meetingData = meeting.toSafeObject();
      meetingData.transcriptionsCount = transcriptionsCount;

      this.logSuccess('Meeting retrieved', {
        meetingId,
        userId
      });

      return meetingData;
    } catch (error) {
      this.logAndThrow(error, 'Get meeting by ID', { meetingId, userId });
    }
  }

  /**
   * Update meeting metadata
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @param {Object} updates - Update data
   * @returns {Object} Updated meeting
   */
  async updateMeeting(meetingId, userId, updates) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      // Only allow updating title
      if (updates.title !== undefined) {
        meeting.title = updates.title;
      }

      await meeting.save();

      this.logSuccess('Meeting updated', {
        meetingId,
        userId
      });

      return meeting.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Update meeting', { meetingId, userId });
    }
  }

  /**
   * Delete meeting and associated data
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @returns {Object} Deletion result
   */
  async deleteMeeting(meetingId, userId) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      // Delete audio file from storage
      try {
        await this.audioStorageProvider.delete(meeting.audioFile);
      } catch (fileError) {
        this.logger.warn('Failed to delete audio file', {
          audioFileUri: meeting.audioFile,
          error: fileError.message
        });
      }

      // Delete transcriptions
      await this.transcriptionDataService.deleteByMeetingId(meetingId);

      // Delete meeting
      await meeting.deleteOne();

      this.logSuccess('Meeting deleted', {
        meetingId,
        userId
      });

      return {
        message: 'Meeting and associated data deleted successfully'
      };
    } catch (error) {
      this.logAndThrow(error, 'Delete meeting', { meetingId, userId });
    }
  }

  /**
   * Start transcription process
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @returns {Object} Transcription status
   */
  async startTranscription(meetingId, userId) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      // Check if already transcribed or processing
      if (meeting.transcriptionStatus === 'completed') {
        throw new Error('Meeting already transcribed');
      }

      if (meeting.transcriptionStatus === 'processing') {
        throw new Error('Transcription already in progress');
      }

      // Update status to processing
      await meeting.updateTranscriptionProgress('processing', 0);

      this.logSuccess('Transcription started', {
        meetingId,
        userId
      });

      // Start async transcription process
      this._processTranscription(meetingId, meeting.audioFile).catch(error => {
        this.logger.error('Transcription process error', {
          error: error.message,
          meetingId
        });
      });

      return {
        meetingId,
        status: 'processing',
        progress: 0,
        estimatedCompletionTime: new Date(Date.now() + this.transcriptionService.estimateTranscriptionTime(meeting.duration || 60) * 1000)
      };
    } catch (error) {
      this.logAndThrow(error, 'Start transcription', { meetingId, userId });
    }
  }

  /**
   * Get audio file path for transcription processing
   * @param {string} audioFileUri - Storage URI
   * @returns {Promise<string>} Local file path for transcription
   * @private
   */
  async _getAudioFilePath(audioFileUri) {
    try {
      // For local storage, get the absolute path
      if (audioFileUri.startsWith('local://')) {
        return this.audioStorageProvider.getAbsolutePath(audioFileUri);
      }

      // For cloud storage, download to temp location
      const audioData = await this.audioStorageProvider.download(audioFileUri);
      const tempPath = path.join(
        process.env.LOCAL_STORAGE_PATH || './storage',
        'temp',
        `transcription-${Date.now()}.audio`
      );

      // Ensure temp directory exists
      const fs = require('fs').promises;
      const tempDir = path.dirname(tempPath);
      await fs.mkdir(tempDir, { recursive: true });

      // Write to temp file
      await fs.writeFile(tempPath, audioData);

      return tempPath;
    } catch (error) {
      this.logger.error('Failed to get audio file path', {
        error: error.message,
        audioFileUri
      });
      throw error;
    }
  }

  /**
   * Process transcription asynchronously
   * @param {string} meetingId - Meeting ID
   * @param {string} audioFileUri - Storage URI for audio file
   * @private
   */
  async _processTranscription(meetingId, audioFileUri) {
    let tempFilePath = null;

    try {
      this.logger.info('Processing transcription', {
        meetingId,
        audioFileUri
      });

      // Get local file path for transcription
      const audioFilePath = await this._getAudioFilePath(audioFileUri);
      tempFilePath = !audioFileUri.startsWith('local://') ? audioFilePath : null;

      this.logger.debug('Calling transcription service', {
        audioFilePath,
        meetingId,
        serviceType: this.transcriptionService.constructor.name
      });

      // Call transcription service
      // For Gemini streaming: service handles incremental saves internally
      // For mock service: returns all segments at once
      const segments = await this.transcriptionService.transcribeAudio(
        audioFilePath,
        meetingId // Pass meetingId for Gemini streaming progress updates
      );

      this.logger.debug('Transcription service returned', {
        meetingId,
        segmentsCount: segments?.length || 0,
        segmentsType: typeof segments
      });

      // For non-streaming providers (mock), save all segments at once
      if (segments && segments.length > 0) {
        // Check if segments are already saved (by streaming provider)
        const existingCount = await this.transcriptionDataService.getTranscriptionCount(meetingId);

        if (existingCount === 0) {
          // Not saved yet, save them now (mock provider path)
          await this.transcriptionDataService.saveTranscriptions(meetingId, segments);
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
      if (this.transcriptionService.constructor.name === 'MockTranscriptionService') {
        this.logger.info('Generating title and description for mock transcription', { meetingId });
        try {
          // Use Gemini service to generate title/description from the mock transcription
          const geminiService = require('./gemini-transcription.service');
          if (geminiService && typeof geminiService.prototype.generateSummary === 'function') {
            // We'll implement this in a simpler way - just set a default title
            const meetingDoc = await this._getMeetingByIdInternal(meetingId);
            if (!meetingDoc.description || meetingDoc.description.trim() === '') {
              meetingDoc.description = 'Mock transcription completed';
              await meetingDoc.save();
              this.logger.info('Updated mock meeting with default description', { meetingId });
            }
          }
        } catch (summaryError) {
          this.logger.warn('Failed to generate title/description for mock transcription', {
            meetingId,
            error: summaryError.message
          });
        }
      }

      this.logger.info('Transcription completed', {
        meetingId,
        segmentsCount: segments.length
      });

      // Clean up temp file if downloaded
      if (tempFilePath) {
        const fs = require('fs').promises;
        await fs.unlink(tempFilePath).catch(err =>
          this.logger.warn('Failed to delete temp file', { tempFilePath, error: err.message })
        );
      }
    } catch (error) {
      this.logger.error('Transcription processing failed', {
        error: error.message,
        stack: error.stack,
        meetingId,
        audioFileUri
      });

      // Update meeting status to failed
      // (Gemini streaming already sets this on error, but safe to set again)
      const meeting = await Meeting.findById(meetingId);
      if (meeting && meeting.transcriptionStatus !== 'failed') {
        meeting.metadata = meeting.metadata || {};
        meeting.metadata.transcription = meeting.metadata.transcription || {};
        meeting.metadata.transcription.errorMessage = error.message;
        await meeting.updateTranscriptionProgress('failed', 0);
      }

      // Clean up temp file on error
      if (tempFilePath) {
        const fs = require('fs').promises;
        await fs.unlink(tempFilePath).catch(err =>
          this.logger.warn('Failed to delete temp file', { tempFilePath, error: err.message })
        );
      }
    }
  }

  /**
   * Download meeting audio file
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} File data and metadata
   */
  async downloadAudioFile(meetingId, userId) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      // Download file from storage
      const fileData = await this.audioStorageProvider.download(meeting.audioFile);

      this.logSuccess('Meeting audio file downloaded', {
        meetingId,
        userId,
        fileSize: fileData.length
      });

      return {
        data: fileData,
        filename: meeting.metadata.originalName || 'audio.mp3',
        mimeType: meeting.metadata.mimeType || 'audio/mpeg',
        size: fileData.length
      };
    } catch (error) {
      this.logAndThrow(error, 'Download audio file', { meetingId, userId });
    }
  }

  /**
   * Get transcription status
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @returns {Object} Transcription status
   */
  async getTranscriptionStatus(meetingId, userId) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      const transcriptionsCount = await this.transcriptionDataService.getTranscriptionCount(meetingId);

      return {
        status: meeting.transcriptionStatus,
        progress: meeting.transcriptionProgress,
        transcriptionsCount,
        estimatedCompletionTime: meeting.transcriptionStatus === 'processing'
          ? new Date(Date.now() + 30000) // Estimate 30 seconds remaining
          : null
      };
    } catch (error) {
      this.logAndThrow(error, 'Get transcription status', { meetingId, userId });
    }
  }

  /**
   * Get user's recent meetings across all projects
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Meetings with pagination
   */
  async getUserRecentMeetings(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 5,
        sort = '-createdAt'
      } = options;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const parsedLimit = parseInt(limit);

      // Parse sort string into MongoDB sort object
      const sortObj = {};
      const sortFields = sort.split(' ');
      sortFields.forEach(field => {
        if (field.startsWith('-')) {
          sortObj[field.substring(1)] = -1;
        } else {
          sortObj[field] = 1;
        }
      });

      // Aggregation pipeline to get meetings for user
      const meetings = await Meeting.aggregate([
        // Step 1: Lookup project for each meeting
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        // Step 2: Unwind project array
        { $unwind: '$project' },
        // Step 3: Filter by userId
        {
          $match: {
            'project.userId': new mongoose.Types.ObjectId(userId)
          }
        },
        // Step 4: Add project name to output
        {
          $addFields: {
            projectName: '$project.name'
          }
        },
        // Step 5: Remove full project object
        {
          $project: {
            project: 0
          }
        },
        // Step 6: Sort
        { $sort: sortObj },
        // Step 7: Count total (before pagination)
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $skip: skip },
              { $limit: parsedLimit }
            ]
          }
        }
      ]);

      const total = meetings[0]?.metadata[0]?.total || 0;
      const data = meetings[0]?.data || [];

      this.logSuccess('User meetings retrieved', {
        userId,
        count: data.length,
        total,
        page
      });

      return {
        meetings: data,
        pagination: {
          page: parseInt(page),
          limit: parsedLimit,
          total,
          pages: Math.ceil(total / parsedLimit)
        }
      };
    } catch (error) {
      this.logAndThrow(error, 'Get user recent meetings', { userId, options });
    }
  }

  /**
   * Generate summary stream for a meeting
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @returns {AsyncGenerator} Stream of text chunks
   */
  async* generateSummaryStream(meetingId, userId) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      // Check if transcription is completed
      if (meeting.transcriptionStatus !== 'completed') {
        throw new Error('Transcription must be completed before generating summary');
      }

      this.logger.info('Starting summary stream', { meetingId, userId });

      // Stream from transcription service
      yield* this.transcriptionService.generateSummaryStream(meetingId);

      this.logger.info('Summary stream completed', { meetingId, userId });
    } catch (error) {
      this.logAndThrow(error, 'Generate summary stream', { meetingId, userId });
    }
  }

  /**
   * Save generated summary to meeting
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @param {string} summary - Summary markdown text
   * @returns {Object} Updated meeting
   */
  async saveSummary(meetingId, userId, summary) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership
      this.authorizationService.verifyMeetingOwnership(meeting, userId);

      // Update meeting with summary
      meeting.summary = summary;
      await meeting.save();

      this.logSuccess('Summary saved to meeting', {
        meetingId,
        userId,
        summaryLength: summary?.length || 0
      });

      return meeting.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Save summary', { meetingId, userId });
    }
  }
}

module.exports = MeetingService;
