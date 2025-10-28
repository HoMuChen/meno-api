/**
 * Authorization Middleware
 * Resource-level authorization checks for protected routes
 */
const Meeting = require('../../models/meeting.model');
const Project = require('../../models/project.model');
const logger = require('../../components/logging');
const { AuthorizationService } = require('../../core/services');

// Initialize authorization service
const authorizationService = new AuthorizationService(logger);

/**
 * Middleware to verify user owns the meeting specified in route params
 * Expects: req.params.id or req.params.meetingId
 * Sets: req.meeting (populated meeting document)
 */
const requireMeetingOwnership = async (req, res, next) => {
  try {
    const meetingId = req.params.id || req.params.meetingId;
    const userId = req.user._id || req.user.id;

    if (!meetingId) {
      logger.warn('Authorization middleware: No meeting ID in request', {
        path: req.path,
        params: req.params
      });
      return res.status(400).json({
        success: false,
        message: 'Meeting ID is required'
      });
    }

    // Fetch meeting with populated project
    const meeting = await Meeting.findById(meetingId).populate('projectId');

    if (!meeting) {
      logger.warn('Authorization failed: Meeting not found', {
        meetingId,
        userId,
        path: req.path
      });
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Verify ownership using authorization service
    try {
      authorizationService.verifyMeetingOwnership(meeting, userId);
    } catch (authError) {
      logger.warn('Authorization failed: User does not own meeting', {
        meetingId,
        userId,
        ownerId: meeting.projectId?.userId?.toString(),
        path: req.path
      });
      return res.status(403).json({
        success: false,
        message: authError.message || 'Access denied'
      });
    }

    // Attach meeting to request for use in route handler
    req.meeting = meeting;

    logger.debug('Meeting ownership verified', {
      meetingId,
      userId,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Authorization middleware error', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

/**
 * Middleware to verify user owns the project specified in route params
 * Expects: req.params.projectId
 * Sets: req.project (project document)
 */
const requireProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user._id || req.user.id;

    if (!projectId) {
      logger.warn('Authorization middleware: No project ID in request', {
        path: req.path,
        params: req.params
      });
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    // Fetch project
    const project = await Project.findById(projectId);

    if (!project) {
      logger.warn('Authorization failed: Project not found', {
        projectId,
        userId,
        path: req.path
      });
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Verify ownership using authorization service
    try {
      authorizationService.verifyProjectOwnership(project, userId);
    } catch (authError) {
      logger.warn('Authorization failed: User does not own project', {
        projectId,
        userId,
        ownerId: project.userId?.toString(),
        path: req.path
      });
      return res.status(403).json({
        success: false,
        message: authError.message || 'Access denied'
      });
    }

    // Attach project to request for use in route handler
    req.project = project;

    logger.debug('Project ownership verified', {
      projectId,
      userId,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Authorization middleware error', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

/**
 * Middleware to verify user owns the meeting via transcription
 * Used for transcription routes where the primary resource is a transcription
 * Expects: req.params.meetingId
 * Sets: req.meeting (populated meeting document)
 */
const requireMeetingOwnershipForTranscription = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId;
    const userId = req.user._id || req.user.id;

    if (!meetingId) {
      logger.warn('Authorization middleware: No meeting ID in request', {
        path: req.path,
        params: req.params
      });
      return res.status(400).json({
        success: false,
        message: 'Meeting ID is required'
      });
    }

    // Fetch meeting with populated project
    const meeting = await Meeting.findById(meetingId).populate('projectId');

    if (!meeting) {
      logger.warn('Authorization failed: Meeting not found', {
        meetingId,
        userId,
        path: req.path
      });
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Verify ownership using authorization service
    try {
      authorizationService.verifyMeetingOwnership(meeting, userId);
    } catch (authError) {
      logger.warn('Authorization failed: User does not own meeting', {
        meetingId,
        userId,
        ownerId: meeting.projectId?.userId?.toString(),
        path: req.path
      });
      return res.status(403).json({
        success: false,
        message: authError.message || 'Access denied'
      });
    }

    // Attach meeting to request for use in route handler
    req.meeting = meeting;

    logger.debug('Meeting ownership verified for transcription', {
      meetingId,
      userId,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Authorization middleware error', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

module.exports = {
  requireMeetingOwnership,
  requireProjectOwnership,
  requireMeetingOwnershipForTranscription
};
