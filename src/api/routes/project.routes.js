/**
 * Project Routes
 * Define routes for project endpoints
 */
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateCreateProject, validateUpdateProject } = require('../validators/project.validator');

const createProjectRoutes = (projectController) => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   name: Projects
   *   description: Project management endpoints
   */

  // All project routes require authentication
  router.use(authenticate);

  /**
   * Create a new project
   * POST /api/projects
   */
  router.post('/', validateCreateProject, projectController.create);

  /**
   * Get user's projects (paginated)
   * GET /api/projects?page=1&limit=10&sort=-createdAt
   */
  router.get('/', projectController.list);

  /**
   * Get project by ID
   * GET /api/projects/:id
   */
  router.get('/:id', projectController.getById);

  /**
   * Update project
   * PUT /api/projects/:id
   */
  router.put('/:id', validateUpdateProject, projectController.update);

  /**
   * Delete project
   * DELETE /api/projects/:id
   */
  router.delete('/:id', projectController.delete);

  /**
   * Get project statistics
   * GET /api/projects/:id/stats
   */
  router.get('/:id/stats', projectController.getStats);

  return router;
};

module.exports = createProjectRoutes;
