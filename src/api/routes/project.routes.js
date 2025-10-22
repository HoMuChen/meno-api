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
   * @swagger
   * /api/projects:
   *   post:
   *     summary: Create a new project
   *     description: Create a new project for organizing meetings
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 100
   *                 example: "Q4 Product Planning"
   *               description:
   *                 type: string
   *                 maxLength: 500
   *                 example: "Quarterly planning meetings for product roadmap"
   *     responses:
   *       201:
   *         description: Project created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  router.post('/', validateCreateProject, projectController.create);

  /**
   * @swagger
   * /api/projects:
   *   get:
   *     summary: Get user's projects
   *     description: Retrieve paginated list of projects for authenticated user
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
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
   *           default: 10
   *         description: Items per page
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: "-createdAt"
   *         description: Sort field (prefix with - for descending)
   *     responses:
   *       200:
   *         description: Projects retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  router.get('/', projectController.list);

  /**
   * @swagger
   * /api/projects/{id}:
   *   get:
   *     summary: Get project by ID
   *     description: Retrieve a specific project by its ID
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     responses:
   *       200:
   *         description: Project retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Project not found
   */
  router.get('/:id', projectController.getById);

  /**
   * @swagger
   * /api/projects/{id}:
   *   put:
   *     summary: Update project
   *     description: Update project name or description
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 100
   *               description:
   *                 type: string
   *                 maxLength: 500
   *     responses:
   *       200:
   *         description: Project updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Project not found
   */
  router.put('/:id', validateUpdateProject, projectController.update);

  /**
   * @swagger
   * /api/projects/{id}:
   *   delete:
   *     summary: Delete project
   *     description: Delete project and all associated meetings and transcriptions
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     responses:
   *       200:
   *         description: Project deleted successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Project not found
   */
  router.delete('/:id', projectController.delete);

  /**
   * @swagger
   * /api/projects/{id}/stats:
   *   get:
   *     summary: Get project statistics
   *     description: Retrieve meeting count and other statistics for a project
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     responses:
   *       200:
   *         description: Statistics retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Project not found
   */
  router.get('/:id/stats', projectController.getStats);

  return router;
};

module.exports = createProjectRoutes;
