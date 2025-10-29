/**
 * Transcription Routes
 * Define routes for transcription endpoints
 */
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { requireMeetingOwnershipForTranscription } = require('../middleware/authorization.middleware');
const {
  validateUpdateTranscription,
  validateSearchQuery,
  validatePagination
} = require('../validators/transcription.validator');

const createTranscriptionRoutes = (transcriptionController) => {
  const router = express.Router({ mergeParams: true }); // mergeParams to access :meetingId

  /**
   * @swagger
   * tags:
   *   name: Transcriptions
   *   description: Transcription management endpoints
   */

  // All transcription routes require authentication and meeting ownership
  router.use(authenticate);
  router.use(requireMeetingOwnershipForTranscription);

  /**
   * @swagger
   * /api/meetings/{meetingId}/transcriptions/status:
   *   get:
   *     summary: Get transcription status
   *     description: Get real-time transcription progress for polling
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: meetingId
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       200:
   *         description: Status retrieved successfully
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
   *                     status:
   *                       type: string
   *                       enum: [pending, processing, completed, failed]
   *                     progress:
   *                       type: number
   *                       minimum: 0
   *                       maximum: 100
   *                     processedSegments:
   *                       type: number
   *                     estimatedTotal:
   *                       type: number
   *                     elapsedTime:
   *                       type: number
   *                       description: Elapsed time in milliseconds
   *                     estimatedRemaining:
   *                       type: number
   *                       description: Estimated remaining time in milliseconds
   *                     errorMessage:
   *                       type: string
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/status', transcriptionController.getStatus);

  /**
   * @swagger
   * /api/meetings/{meetingId}/transcriptions/hybrid-search:
   *   get:
   *     summary: Hybrid search transcriptions
   *     description: Two-stage retrieval combining vector search and full-text search. Stage 1 uses semantic similarity to find relevant candidates, Stage 2 reranks with keyword matching for optimal results.
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: meetingId
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *           maxLength: 200
   *         description: Search query (supports multi-word and multi-language queries)
   *       - in: query
   *         name: scoreThreshold
   *         schema:
   *           type: number
   *           minimum: 0
   *           maximum: 1
   *           default: 0.7
   *         description: Minimum combined similarity score (0-1)
   *       - in: query
   *         name: speaker
   *         schema:
   *           type: string
   *         description: Filter by speaker name
   *     responses:
   *       200:
   *         description: Hybrid search results retrieved successfully with combined scores
   *       400:
   *         description: Invalid search query
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/hybrid-search', validateSearchQuery, transcriptionController.hybridSearch);

  /**
   * @swagger
   * /api/meetings/{meetingId}/transcriptions/speaker/{speaker}:
   *   get:
   *     summary: Get transcriptions by speaker
   *     description: Filter transcriptions by speaker name
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: meetingId
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: path
   *         name: speaker
   *         required: true
   *         schema:
   *           type: string
   *         description: Speaker name
   *     responses:
   *       200:
   *         description: Speaker transcriptions retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/speaker/:speaker', transcriptionController.getBySpeaker);

  /**
   * @swagger
   * /api/meetings/{meetingId}/transcriptions:
   *   get:
   *     summary: Get all transcriptions for a meeting
   *     description: Retrieve paginated list of transcription segments
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: meetingId
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *           maximum: 100
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: "startTime"
   *     responses:
   *       200:
   *         description: Transcriptions retrieved successfully
   *       400:
   *         description: Invalid pagination parameters
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/', validatePagination, transcriptionController.list);

  /**
   * @swagger
   * /api/meetings/{meetingId}/transcriptions/{id}:
   *   get:
   *     summary: Get transcription by ID
   *     description: Retrieve a specific transcription segment
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: meetingId
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Transcription ID
   *     responses:
   *       200:
   *         description: Transcription retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Transcription not found
   */
  router.get('/:id', transcriptionController.getById);

  /**
   * @swagger
   * /api/meetings/{meetingId}/transcriptions/{id}:
   *   put:
   *     summary: Update transcription
   *     description: Edit transcription speaker name or text content
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: meetingId
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Transcription ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               speaker:
   *                 type: string
   *                 maxLength: 100
   *                 example: "John Doe"
   *               text:
   *                 type: string
   *                 maxLength: 5000
   *                 example: "We need to prioritize the authentication feature"
   *     responses:
   *       200:
   *         description: Transcription updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Transcription not found
   */
  router.put('/:id', validateUpdateTranscription, transcriptionController.update);

  /**
   * @swagger
   * /api/meetings/{meetingId}/transcriptions/{id}:
   *   delete:
   *     summary: Delete transcription
   *     description: Delete a specific transcription segment
   *     tags: [Transcriptions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: meetingId
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Transcription ID
   *     responses:
   *       200:
   *         description: Transcription deleted successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Transcription not found
   */
  router.delete('/:id', transcriptionController.delete);

  return router;
};

module.exports = createTranscriptionRoutes;
