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
   * Create a new project
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
   * Get user's projects
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
   * Get project by ID
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
   * Update project
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
   * Delete project
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
   * Get project statistics
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
