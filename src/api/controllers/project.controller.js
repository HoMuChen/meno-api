/**
 * Project Controller
 * Handles HTTP requests for project endpoints
 */

class ProjectController {
  constructor(projectService, logger) {
    this.projectService = projectService;
    this.logger = logger;
  }

  /**
   * @swagger
   * /projects:
   *   post:
   *     summary: Create a new project
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
   *               description:
   *                 type: string
   *                 maxLength: 500
   *     responses:
   *       201:
   *         description: Project created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  create = async (req, res) => {
    try {
      const userId = req.user._id;
      const projectData = req.body;

      const project = await this.projectService.createProject(userId, projectData);

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      this.logger.error('Create project controller error', {
        error: error.message,
        userId: req.user?._id
      });

      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /projects:
   *   get:
   *     summary: Get user's projects
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: -createdAt
   *     responses:
   *       200:
   *         description: Projects retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  list = async (req, res) => {
    try {
      const userId = req.user._id;
      const { page, limit, sort } = req.query;

      const result = await this.projectService.getProjects(userId, {
        page,
        limit,
        sort
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('List projects controller error', {
        error: error.message,
        userId: req.user?._id
      });

      res.status(500).json({
        success: false,
        message: 'Error retrieving projects'
      });
    }
  };

  /**
   * @swagger
   * /projects/{id}:
   *   get:
   *     summary: Get project by ID
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Project retrieved successfully
   *       404:
   *         description: Project not found
   *       401:
   *         description: Unauthorized
   */
  getById = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const project = await this.projectService.getProjectById(id, userId);

      res.status(200).json({
        success: true,
        data: project
      });
    } catch (error) {
      this.logger.error('Get project controller error', {
        error: error.message,
        projectId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message === 'Project not found' ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /projects/{id}:
   *   put:
   *     summary: Update project
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
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
   *       404:
   *         description: Project not found
   *       401:
   *         description: Unauthorized
   */
  update = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;
      const updates = req.body;

      const project = await this.projectService.updateProject(id, userId, updates);

      res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: project
      });
    } catch (error) {
      this.logger.error('Update project controller error', {
        error: error.message,
        projectId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message === 'Project not found' ? 404 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /projects/{id}:
   *   delete:
   *     summary: Delete project
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Project deleted successfully
   *       404:
   *         description: Project not found
   *       401:
   *         description: Unauthorized
   */
  delete = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const result = await this.projectService.deleteProject(id, userId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          deletedMeetings: result.deletedMeetings
        }
      });
    } catch (error) {
      this.logger.error('Delete project controller error', {
        error: error.message,
        projectId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message === 'Project not found' ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /projects/{id}/stats:
   *   get:
   *     summary: Get project statistics
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Statistics retrieved successfully
   *       404:
   *         description: Project not found
   *       401:
   *         description: Unauthorized
   */
  getStats = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const stats = await this.projectService.getProjectStats(id, userId);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Get project stats controller error', {
        error: error.message,
        projectId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message === 'Project not found' ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };
}

module.exports = ProjectController;
