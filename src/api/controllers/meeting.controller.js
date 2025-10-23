/**
 * Meeting Controller
 * Handles HTTP requests for meeting endpoints
 */
const BaseController = require('./base.controller');
const { BadRequestError } = require('../../utils/errors');

class MeetingController extends BaseController {
  constructor(meetingService, logger) {
    super(meetingService, logger);
    this.meetingService = meetingService;
  }

  /**
   * Create meeting
   */
  create = this.asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new BadRequestError('Audio file is required');
    }

    const userId = this.getUserId(req);
    const { projectId } = req.params;
    const meeting = await this.meetingService.createMeeting(
      projectId,
      userId,
      req.body,
      req.file
    );

    return this.sendCreated(res, meeting, 'Meeting created successfully');
  });

  /**
   * List meetings
   */
  list = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { projectId } = req.params;
    const { page, limit, sort } = req.query;

    const result = await this.meetingService.getMeetings(projectId, userId, {
      page,
      limit,
      sort
    });

    return this.sendSuccess(res, result, 'Meetings retrieved successfully');
  });

  /**
   * Get meeting by ID
   */
  getById = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const meeting = await this.meetingService.getMeetingById(req.params.id, userId);
    return this.sendSuccess(res, meeting, 'Meeting retrieved successfully');
  });

  /**
   * Update meeting
   */
  update = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const meeting = await this.meetingService.updateMeeting(req.params.id, userId, req.body);
    return this.sendSuccess(res, meeting, 'Meeting updated successfully');
  });

  /**
   * Delete meeting
   */
  delete = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const result = await this.meetingService.deleteMeeting(req.params.id, userId);
    return this.sendSuccess(res, null, result.message);
  });

  /**
   * Start transcription
   */
  startTranscription = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const result = await this.meetingService.startTranscription(req.params.id, userId);

    // 202 Accepted for async processing
    return res.status(202).json({
      success: true,
      message: 'Transcription started',
      data: result
    });
  });

  /**
   * Download audio file
   */
  downloadAudio = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const result = await this.meetingService.downloadAudioFile(req.params.id, userId);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.size);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  });

  /**
   * Get transcription status
   */
  getStatus = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const status = await this.meetingService.getTranscriptionStatus(req.params.id, userId);
    return this.sendSuccess(res, status, 'Transcription status retrieved successfully');
  });

  /**
   * Get user's recent meetings across all projects
   */
  getUserMeetings = this.asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page, limit, sort } = req.query;

    const result = await this.meetingService.getUserRecentMeetings(userId, {
      page,
      limit,
      sort
    });

    return this.sendSuccess(res, result, 'User meetings retrieved successfully');
  });

  /**
   * Generate summary stream for a meeting
   * Streams AI-generated markdown summary and saves to database when complete
   */
  generateSummaryStream = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { id: meetingId } = req.params;

    try {
      // Set headers for Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connected', meetingId })}\n\n`);

      // Accumulate full summary text
      let summary = '';

      // Stream from service
      const stream = this.meetingService.generateSummaryStream(meetingId, userId);

      for await (const chunk of stream) {
        summary += chunk;
        // Send chunk event
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }

      // Clean up any markdown code blocks that might be present
      summary = summary.trim().replace(/```markdown\n?/g, '').replace(/```\n?/g, '');

      // Save summary to database
      await this.meetingService.saveSummary(meetingId, userId, summary);

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);

      // Close connection
      res.end();
    } catch (error) {
      // Send error event
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error.message
      })}\n\n`);
      res.end();
    }
  });
}

module.exports = MeetingController;
