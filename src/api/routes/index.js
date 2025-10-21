/**
 * Routes Index
 * Central routing configuration
 */
const express = require('express');
const createUserRoutes = require('./user.routes');
const createFileRoutes = require('./file.routes');
const createHealthRoutes = require('./health.routes');

const createRoutes = (controllers) => {
  const router = express.Router();

  // Health routes
  router.use('/health', createHealthRoutes(controllers.healthController));

  // User routes
  router.use('/users', createUserRoutes(controllers.userController));

  // File routes
  router.use('/files', createFileRoutes(controllers.fileController));

  return router;
};

module.exports = createRoutes;
