/**
 * Transcription Routes
 * Define routes for transcription endpoints
 */
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
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

  // All transcription routes require authentication
  router.use(authenticate);

  /**
   * Search transcriptions by text
   * GET /api/meetings/:meetingId/transcriptions/search?q=keyword
   */
  router.get('/search', validateSearchQuery, transcriptionController.search);

  /**
   * Get transcriptions by speaker
   * GET /api/meetings/:meetingId/transcriptions/speaker/:speaker
   */
  router.get('/speaker/:speaker', transcriptionController.getBySpeaker);

  /**
   * Get all transcriptions for a meeting (paginated)
   * GET /api/meetings/:meetingId/transcriptions?page=1&limit=50&sort=startTime
   */
  router.get('/', validatePagination, transcriptionController.list);

  /**
   * Get transcription by ID
   * GET /api/meetings/:meetingId/transcriptions/:id
   */
  router.get('/:id', transcriptionController.getById);

  /**
   * Update transcription (edit speaker or text)
   * PUT /api/meetings/:meetingId/transcriptions/:id
   */
  router.put('/:id', validateUpdateTranscription, transcriptionController.update);

  return router;
};

module.exports = createTranscriptionRoutes;
