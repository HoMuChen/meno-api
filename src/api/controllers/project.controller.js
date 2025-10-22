/**
 * Project Controller
 * Handles HTTP requests for project endpoints
 */
const BaseController = require('./base.controller');

class ProjectController extends BaseController {
  constructor(projectService, logger) {
    super(projectService, logger);
    this.projectService = projectService;
  }

  /**
   * Create a new project
   */
  create = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const project = await this.projectService.createProject(userId, req.body);
    return this.sendCreated(res, project, 'Project created successfully');
  });

  /**
   * Get user's projects
   */
  list = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { page, limit, sort } = req.query;

    const result = await this.projectService.getProjects(userId, {
      page,
      limit,
      sort
    });

    return this.sendSuccess(res, result);
  });

  /**
   * Get project by ID
   */
  getById = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const project = await this.projectService.getProjectById(req.params.id, userId);
    return this.sendSuccess(res, project);
  });

  /**
   * Update project
   */
  update = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const project = await this.projectService.updateProject(req.params.id, userId, req.body);
    return this.sendSuccess(res, project, 'Project updated successfully');
  });

  /**
   * Delete project
   */
  delete = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const result = await this.projectService.deleteProject(req.params.id, userId);

    return this.sendSuccess(res, {
      deletedMeetings: result.deletedMeetings
    }, result.message);
  });

  /**
   * Get project statistics
   */
  getStats = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const stats = await this.projectService.getProjectStats(req.params.id, userId);
    return this.sendSuccess(res, stats);
  });
}

module.exports = ProjectController;
