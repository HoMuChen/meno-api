/**
 * Transcription Controller
 * Handles HTTP requests for transcription endpoints
 */
const Meeting = require('../../models/meeting.model');

class TranscriptionController {
  constructor(transcriptionDataService, logger) {
    this.transcriptionDataService = transcriptionDataService;
    this.logger = logger;
  }

    /**
   * list
   */
  list = async (req, res) => {
    try {
      const userId = req.user._id;
      const { meetingId } = req.params;
      const { page, limit, sort } = req.query;

      // Verify user has access to this meeting
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      if (meeting.projectId.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const result = await this.transcriptionDataService.getTranscriptions(meetingId, {
        page,
        limit,
        sort
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('List transcriptions controller error', {
        error: error.message,
        meetingId: req.params.meetingId,
        userId: req.user?._id
      });

      res.status(500).json({
        success: false,
        message: 'Error retrieving transcriptions'
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

      const transcription = await this.transcriptionDataService.getTranscriptionById(id);

      // Verify ownership through meeting → project
      const meeting = await Meeting.findById(transcription.meetingId).populate('projectId');

      if (!meeting || meeting.projectId.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.status(200).json({
        success: true,
        data: transcription
      });
    } catch (error) {
      this.logger.error('Get transcription controller error', {
        error: error.message,
        transcriptionId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message === 'Transcription not found' ? 404 : 500;

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

      // First get the transcription to verify ownership
      const transcription = await this.transcriptionDataService.getTranscriptionById(id);

      // Verify ownership through meeting → project
      const meeting = await Meeting.findById(transcription.meetingId).populate('projectId');

      if (!meeting || meeting.projectId.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updatedTranscription = await this.transcriptionDataService.updateTranscription(id, updates);

      res.status(200).json({
        success: true,
        message: 'Transcription updated successfully',
        data: updatedTranscription
      });
    } catch (error) {
      this.logger.error('Update transcription controller error', {
        error: error.message,
        transcriptionId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message === 'Transcription not found' ? 404 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

    /**
   * search
   */
  search = async (req, res) => {
    try {
      const userId = req.user._id;
      const { meetingId } = req.params;
      const { q, page, limit } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      // Verify user has access to this meeting
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      if (meeting.projectId.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const result = await this.transcriptionDataService.searchTranscriptions(meetingId, q, {
        page,
        limit
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Search transcriptions controller error', {
        error: error.message,
        meetingId: req.params.meetingId,
        userId: req.user?._id
      });

      res.status(500).json({
        success: false,
        message: 'Error searching transcriptions'
      });
    }
  };

    /**
   * Get BySpeaker
   */
  getBySpeaker = async (req, res) => {
    try {
      const userId = req.user._id;
      const { meetingId, speaker } = req.params;
      const { page, limit } = req.query;

      // Verify user has access to this meeting
      const meeting = await Meeting.findById(meetingId).populate('projectId');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      if (meeting.projectId.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const result = await this.transcriptionDataService.getTranscriptionsBySpeaker(meetingId, speaker, {
        page,
        limit
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Get transcriptions by speaker controller error', {
        error: error.message,
        meetingId: req.params.meetingId,
        speaker: req.params.speaker,
        userId: req.user?._id
      });

      res.status(500).json({
        success: false,
        message: 'Error retrieving transcriptions'
      });
    }
  };
}

module.exports = TranscriptionController;
