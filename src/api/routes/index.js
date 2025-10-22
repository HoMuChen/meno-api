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

const createRoutes = (controllers) => {
  const router = express.Router();

  // Health routes
  router.use('/health', createHealthRoutes(controllers.healthController));

  // User routes (pass meetingController for user meetings endpoint)
  router.use('/users', createUserRoutes(controllers.userController, controllers.meetingController));

  // File routes
  router.use('/files', createFileRoutes(controllers.fileController));

  // Project routes
  router.use('/projects', createProjectRoutes(controllers.projectController));

  // Meeting routes (nested under projects)
  router.use('/projects/:projectId/meetings', createMeetingRoutes(controllers.meetingController));

  // Transcription routes (nested under meetings)
  router.use('/meetings/:meetingId/transcriptions', createTranscriptionRoutes(controllers.transcriptionController));

  return router;
};

module.exports = createRoutes;
