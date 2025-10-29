/**
 * Routes Index
 * Central routing configuration for /api routes
 */
const express = require('express');
const createUserRoutes = require('./user.routes');
const createFileRoutes = require('./file.routes');
const createHealthRoutes = require('./health.routes');
const createProjectRoutes = require('./project.routes');
const createMeetingRoutes = require('./meeting.routes');
const createTranscriptionRoutes = require('./transcription.routes');

const createRoutes = (controllers, audioStorageProvider) => {
  const router = express.Router();

  // Health routes
  router.use('/health', createHealthRoutes(controllers.healthController));

  // User routes (pass meetingController for user meetings endpoint)
  router.use('/users', createUserRoutes(controllers.userController, controllers.meetingController));

  // File routes
  router.use('/files', createFileRoutes(controllers.fileController));

  // Project routes
  router.use('/projects', createProjectRoutes(controllers.projectController));

  // Meeting routes (nested under projects) - pass audioStorageProvider for streaming uploads
  router.use('/projects/:projectId/meetings', createMeetingRoutes(controllers.meetingController, audioStorageProvider));

  // Project-level transcription search route (cross-meeting search)
  const { authenticate } = require('../middleware/auth.middleware');
  const { validateSearchQuery } = require('../validators/transcription.validator');

  /**
   * @swagger
   * /api/projects/{projectId}/transcriptions/search-all:
   *   get:
   *     summary: Search transcriptions across all meetings in a project
   *     description: Semantic search across all meetings in a project using AI embeddings
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *           maxLength: 200
   *         description: Search query (finds semantically similar content across all meetings)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Results per page
   *       - in: query
   *         name: scoreThreshold
   *         schema:
   *           type: number
   *           minimum: 0
   *           maximum: 1
   *           default: 0.7
   *         description: Minimum similarity score (0-1)
   *       - in: query
   *         name: from
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter meetings created after this date (ISO 8601)
   *       - in: query
   *         name: to
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter meetings created before this date (ISO 8601)
   *       - in: query
   *         name: speaker
   *         schema:
   *           type: string
   *         description: Filter by speaker name
   *       - in: query
   *         name: groupByMeeting
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Group results by meeting (true) or return flat list (false)
   *     responses:
   *       200:
   *         description: Search results retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     results:
   *                       type: array
   *                       description: Search results grouped by meeting or flat list
   *                     pagination:
   *                       type: object
   *                       properties:
   *                         page:
   *                           type: integer
   *                         limit:
   *                           type: integer
   *                         total:
   *                           type: integer
   *                     searchType:
   *                       type: string
   *                       example: "semantic_cross_meeting"
   *                     meetingsSearched:
   *                       type: integer
   *       400:
   *         description: Invalid search query or embedding service not configured
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Not authorized to access this project
   *       404:
   *         description: Project not found
   */
  router.get('/projects/:projectId/transcriptions/search-all',
    authenticate,
    validateSearchQuery,
    controllers.transcriptionController.searchAcrossMeetings
  );

  // Transcription routes (nested under meetings)
  router.use('/meetings/:meetingId/transcriptions', createTranscriptionRoutes(controllers.transcriptionController));

  return router;
};

module.exports = createRoutes;
