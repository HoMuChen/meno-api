/**
 * Transcription Controller
 * Handles HTTP requests for transcription endpoints
 */
const BaseController = require('./base.controller');
const Meeting = require('../../models/meeting.model');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../utils/errors');

class TranscriptionController extends BaseController {
  constructor(transcriptionDataService, logger) {
    super(transcriptionDataService, logger);
    this.transcriptionDataService = transcriptionDataService;
  }

    /**
   * list
   */
  list = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { meetingId } = req.params;
    const { page, limit, sort } = req.query;

    // Verify user has access to this meeting
    const meeting = await Meeting.findById(meetingId).populate('projectId');
    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }
    if (meeting.projectId.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Access denied');
    }

    const result = await this.transcriptionDataService.getTranscriptions(meetingId, {
      page,
      limit,
      sort
    });

    return this.sendSuccess(res, result);
  });

    /**
   * Get ById
   */
  getById = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const transcription = await this.transcriptionDataService.getTranscriptionById(req.params.id);

    // Verify ownership through meeting → project
    const meeting = await Meeting.findById(transcription.meetingId).populate('projectId');
    if (!meeting || meeting.projectId.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Access denied');
    }

    return this.sendSuccess(res, transcription);
  });

    /**
   * Update
   */
  update = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);

    // First get the transcription to verify ownership
    const transcription = await this.transcriptionDataService.getTranscriptionById(req.params.id);

    // Verify ownership through meeting → project
    const meeting = await Meeting.findById(transcription.meetingId).populate('projectId');
    if (!meeting || meeting.projectId.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Access denied');
    }

    const updatedTranscription = await this.transcriptionDataService.updateTranscription(req.params.id, req.body);

    return this.sendSuccess(res, updatedTranscription, 'Transcription updated successfully');
  });

    /**
   * search
   */
  search = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { meetingId } = req.params;
    const { q, page, limit } = req.query;

    if (!q) {
      throw new BadRequestError('Search query is required');
    }

    // Verify user has access to this meeting
    const meeting = await Meeting.findById(meetingId).populate('projectId');
    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }
    if (meeting.projectId.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Access denied');
    }

    const result = await this.transcriptionDataService.searchTranscriptions(meetingId, q, {
      page,
      limit
    });

    return this.sendSuccess(res, result);
  });

    /**
   * Get BySpeaker
   */
  getBySpeaker = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { meetingId, speaker } = req.params;
    const { page, limit } = req.query;

    // Verify user has access to this meeting
    const meeting = await Meeting.findById(meetingId).populate('projectId');
    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }
    if (meeting.projectId.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Access denied');
    }

    const result = await this.transcriptionDataService.getTranscriptionsBySpeaker(meetingId, speaker, {
      page,
      limit
    });

    return this.sendSuccess(res, result);
  });

  /**
   * Get transcription status
   * Polling endpoint for real-time progress updates
   */
  getStatus = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { meetingId } = req.params;

    // Verify user has access to this meeting
    const meeting = await Meeting.findById(meetingId).populate('projectId');
    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }
    if (meeting.projectId.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Access denied');
    }

    // Build status response
    const statusData = {
      status: meeting.transcriptionStatus,
      progress: meeting.transcriptionProgress,
      processedSegments: meeting.metadata?.transcription?.processedSegments || 0,
      estimatedTotal: meeting.metadata?.transcription?.estimatedTotal || 0,
      startedAt: meeting.metadata?.transcription?.startedAt || null,
      completedAt: meeting.metadata?.transcription?.completedAt || null,
      errorMessage: meeting.metadata?.transcription?.errorMessage || null
    };

    // Calculate elapsed and estimated remaining time
    if (statusData.startedAt) {
      const startTime = new Date(statusData.startedAt).getTime();
      const currentTime = Date.now();
      statusData.elapsedTime = currentTime - startTime; // milliseconds

      // Estimate remaining time if processing
      if (statusData.status === 'processing' && statusData.progress > 0) {
        const timePerPercent = statusData.elapsedTime / statusData.progress;
        const remainingPercent = 100 - statusData.progress;
        statusData.estimatedRemaining = Math.ceil(timePerPercent * remainingPercent);
      }
    }

    return this.sendSuccess(res, statusData);
  });
}

module.exports = TranscriptionController;
