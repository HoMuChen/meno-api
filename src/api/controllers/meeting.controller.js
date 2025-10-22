/**
 * Meeting Controller
 * Handles HTTP requests for meeting endpoints
 */

class MeetingController {
  constructor(meetingService, logger) {
    this.meetingService = meetingService;
    this.logger = logger;
  }

    /**
   * Create 
   */
  create = async (req, res) => {
    try {
      const userId = req.user._id;
      const { projectId } = req.params;
      const meetingData = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({
          success: false,
          message: 'Audio file is required'
        });
      }

      const meeting = await this.meetingService.createMeeting(
        projectId,
        userId,
        meetingData,
        audioFile
      );

      res.status(201).json({
        success: true,
        message: 'Meeting created successfully',
        data: meeting
      });
    } catch (error) {
      this.logger.error('Create meeting controller error', {
        error: error.message,
        projectId: req.params.projectId,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('access denied') ? 404 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * list
   */
  list = async (req, res) => {
    try {
      const userId = req.user._id;
      const { projectId } = req.params;
      const { page, limit, sort } = req.query;

      const result = await this.meetingService.getMeetings(projectId, userId, {
        page,
        limit,
        sort
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('List meetings controller error', {
        error: error.message,
        projectId: req.params.projectId,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * Get ById
   */
  getById = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const meeting = await this.meetingService.getMeetingById(id, userId);

      res.status(200).json({
        success: true,
        data: meeting
      });
    } catch (error) {
      this.logger.error('Get meeting controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * Update 
   */
  update = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;
      const updates = req.body;

      const meeting = await this.meetingService.updateMeeting(id, userId, updates);

      res.status(200).json({
        success: true,
        message: 'Meeting updated successfully',
        data: meeting
      });
    } catch (error) {
      this.logger.error('Update meeting controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * Delete 
   */
  delete = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const result = await this.meetingService.deleteMeeting(id, userId);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      this.logger.error('Delete meeting controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * Start Transcription
   */
  startTranscription = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const result = await this.meetingService.startTranscription(id, userId);

      res.status(202).json({
        success: true,
        message: 'Transcription started',
        data: result
      });
    } catch (error) {
      this.logger.error('Start transcription controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      let statusCode = 500;
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        statusCode = 404;
      } else if (error.message.includes('already')) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * Download Audio File
   */
  downloadAudio = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const result = await this.meetingService.downloadAudioFile(id, userId);

      // Set headers for file download
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Length', result.size);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

      // Send file data
      res.status(200).send(result.data);
    } catch (error) {
      this.logger.error('Download audio file controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * Get Status
   */
  getStatus = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const status = await this.meetingService.getTranscriptionStatus(id, userId);

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      this.logger.error('Get transcription status controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };
}

module.exports = MeetingController;
