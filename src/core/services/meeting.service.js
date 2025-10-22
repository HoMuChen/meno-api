/**
 * Meeting Service
 * Business logic for meeting management and transcription orchestration
 */
const Meeting = require('../../models/meeting.model');
const Project = require('../../models/project.model');
const mongoose = require('mongoose');

class MeetingService {
  constructor(logger, fileService, projectService, transcriptionService, transcriptionDataService) {
    this.logger = logger;
    this.fileService = fileService;
    this.projectService = projectService;
    this.transcriptionService = transcriptionService;
    this.transcriptionDataService = transcriptionDataService;
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
    try {
      // Verify user owns the project
      const ownsProject = await this.projectService.verifyOwnership(projectId, userId);
      if (!ownsProject) {
        throw new Error('Project not found or access denied');
      }

      // File is already saved by Multer middleware
      // Just use the file path directly
      const audioFilePath = audioFile.path;

      // Create meeting
      const meeting = new Meeting({
        title: meetingData.title,
        projectId,
        audioFile: audioFilePath,
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

      this.logger.info('Meeting created', {
        meetingId: meeting._id,
        projectId,
        userId,
        audioFile: audioFilePath
      });

      return meeting.toSafeObject();
    } catch (error) {
      this.logger.error('Create meeting error', {
        error: error.message,
        projectId,
        userId
      });
      throw error;
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

      this.logger.info('Meetings retrieved', {
        projectId,
        userId,
        count: result.meetings.length,
        page
      });

      return result;
    } catch (error) {
      this.logger.error('Get meetings error', {
        error: error.message,
        projectId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get meeting by ID
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @returns {Object} Meeting details
   */
  async getMeetingById(meetingId, userId) {
    try {
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Verify ownership through project
      if (meeting.projectId.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      // Get transcription count
      const transcriptionsCount = await this.transcriptionDataService.getTranscriptionCount(meetingId);

      const meetingData = meeting.toSafeObject();
      meetingData.transcriptionsCount = transcriptionsCount;

      this.logger.info('Meeting retrieved', {
        meetingId,
        userId
      });

      return meetingData;
    } catch (error) {
      this.logger.error('Get meeting error', {
        error: error.message,
        meetingId,
        userId
      });
      throw error;
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
      if (meeting.projectId.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      // Only allow updating title
      if (updates.title !== undefined) {
        meeting.title = updates.title;
      }

      await meeting.save();

      this.logger.info('Meeting updated', {
        meetingId,
        userId
      });

      return meeting.toSafeObject();
    } catch (error) {
      this.logger.error('Update meeting error', {
        error: error.message,
        meetingId,
        userId
      });
      throw error;
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
      if (meeting.projectId.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      // Delete audio file
      try {
        await this.fileService.deleteFile(meeting.audioFile);
      } catch (fileError) {
        this.logger.warn('Failed to delete audio file', {
          audioFile: meeting.audioFile,
          error: fileError.message
        });
      }

      // Delete transcriptions
      await this.transcriptionDataService.deleteByMeetingId(meetingId);

      // Delete meeting
      await meeting.deleteOne();

      this.logger.info('Meeting deleted', {
        meetingId,
        userId
      });

      return {
        message: 'Meeting and associated data deleted successfully'
      };
    } catch (error) {
      this.logger.error('Delete meeting error', {
        error: error.message,
        meetingId,
        userId
      });
      throw error;
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
      if (meeting.projectId.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      // Check if already transcribed or processing
      if (meeting.transcriptionStatus === 'completed') {
        throw new Error('Meeting already transcribed');
      }

      if (meeting.transcriptionStatus === 'processing') {
        throw new Error('Transcription already in progress');
      }

      // Update status to processing
      await meeting.updateTranscriptionProgress('processing', 0);

      this.logger.info('Transcription started', {
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
      this.logger.error('Start transcription error', {
        error: error.message,
        meetingId,
        userId
      });
      throw error;
    }
  }

  /**
   * Process transcription asynchronously
   * @param {string} meetingId - Meeting ID
   * @param {string} audioFilePath - Audio file path
   * @private
   */
  async _processTranscription(meetingId, audioFilePath) {
    try {
      this.logger.info('Processing transcription', {
        meetingId,
        audioFilePath
      });

      // Call transcription service
      const segments = await this.transcriptionService.transcribeAudio(audioFilePath);

      // Save transcription segments to database
      await this.transcriptionDataService.saveTranscriptions(meetingId, segments);

      // Update meeting status to completed
      const meeting = await Meeting.findById(meetingId);
      if (meeting) {
        await meeting.updateTranscriptionProgress('completed', 100);
      }

      this.logger.info('Transcription completed', {
        meetingId,
        segmentsCount: segments.length
      });
    } catch (error) {
      this.logger.error('Transcription processing failed', {
        error: error.message,
        meetingId,
        audioFilePath
      });

      // Update meeting status to failed
      const meeting = await Meeting.findById(meetingId);
      if (meeting) {
        await meeting.updateTranscriptionProgress('failed', 0);
      }
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
      if (meeting.projectId.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

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
      this.logger.error('Get transcription status error', {
        error: error.message,
        meetingId,
        userId
      });
      throw error;
    }
  }
}

module.exports = MeetingService;
