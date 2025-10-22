/**
 * Meeting Routes
 * Define routes for meeting endpoints
 */
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadAudio } = require('../middleware/upload.middleware');
const { validateCreateMeeting, validateUpdateMeeting } = require('../validators/meeting.validator');

const createMeetingRoutes = (meetingController) => {
  const router = express.Router({ mergeParams: true }); // mergeParams to access :projectId

  /**
   * @swagger
   * tags:
   *   name: Meetings
   *   description: Meeting management endpoints
   */

  // All meeting routes require authentication
  router.use(authenticate);

  /**
   * Create a new meeting with audio file
   * POST /api/projects/:projectId/meetings
   */
  router.post('/', uploadAudio, validateCreateMeeting, meetingController.create);

  /**
   * Get meetings in a project (paginated)
   * GET /api/projects/:projectId/meetings?page=1&limit=10&sort=-createdAt
   */
  router.get('/', meetingController.list);

  /**
   * Get meeting by ID
   * GET /api/projects/:projectId/meetings/:id
   */
  router.get('/:id', meetingController.getById);

  /**
   * Update meeting
   * PUT /api/projects/:projectId/meetings/:id
   */
  router.put('/:id', validateUpdateMeeting, meetingController.update);

  /**
   * Delete meeting
   * DELETE /api/projects/:projectId/meetings/:id
   */
  router.delete('/:id', meetingController.delete);

  /**
   * Start transcription for meeting
   * POST /api/projects/:projectId/meetings/:id/transcribe
   */
  router.post('/:id/transcribe', meetingController.startTranscription);

  /**
   * Get transcription status
   * GET /api/projects/:projectId/meetings/:id/status
   */
  router.get('/:id/status', meetingController.getStatus);

  return router;
};

module.exports = createMeetingRoutes;
