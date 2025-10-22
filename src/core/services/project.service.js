/**
 * Project Service
 * Business logic for project management
 */
const Project = require('../../models/project.model');
const Meeting = require('../../models/meeting.model');

class ProjectService {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Create a new project
   * @param {string} userId - User ID from JWT
   * @param {Object} projectData - Project data
   * @returns {Object} Created project
   */
  async createProject(userId, projectData) {
    try {
      const { name, description } = projectData;

      const project = new Project({
        name,
        description,
        userId
      });

      await project.save();

      this.logger.info('Project created successfully', {
        projectId: project._id,
        userId,
        name
      });

      return project.toSafeObject();
    } catch (error) {
      this.logger.error('Create project error', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get user's projects with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Pagination and sorting options
   * @returns {Object} Projects with pagination
   */
  async getProjects(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = '-createdAt'
      } = options;

      const result = await Project.findWithMeetingCount(
        { userId },
        { page: parseInt(page), limit: parseInt(limit), sort }
      );

      this.logger.info('Projects retrieved', {
        userId,
        count: result.projects.length,
        page
      });

      return result;
    } catch (error) {
      this.logger.error('Get projects error', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get project by ID with ownership verification
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @returns {Object} Project details
   */
  async getProjectById(projectId, userId) {
    try {
      const project = await Project.findOne({
        _id: projectId,
        userId
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Get meeting count
      const meetingsCount = await Meeting.countDocuments({ projectId });

      const projectData = project.toSafeObject();
      projectData.meetingsCount = meetingsCount;

      this.logger.info('Project retrieved', {
        projectId,
        userId
      });

      return projectData;
    } catch (error) {
      this.logger.error('Get project error', {
        error: error.message,
        projectId,
        userId
      });
      throw error;
    }
  }

  /**
   * Update project
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {Object} updates - Update data
   * @returns {Object} Updated project
   */
  async updateProject(projectId, userId, updates) {
    try {
      const project = await Project.findOne({
        _id: projectId,
        userId
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Only allow updating name and description
      if (updates.name !== undefined) {
        project.name = updates.name;
      }
      if (updates.description !== undefined) {
        project.description = updates.description;
      }

      await project.save();

      this.logger.info('Project updated', {
        projectId,
        userId
      });

      return project.toSafeObject();
    } catch (error) {
      this.logger.error('Update project error', {
        error: error.message,
        projectId,
        userId
      });
      throw error;
    }
  }

  /**
   * Delete project and all associated meetings
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @returns {Object} Deletion result
   */
  async deleteProject(projectId, userId) {
    try {
      const project = await Project.findOne({
        _id: projectId,
        userId
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Delete all meetings in this project
      // The Meeting's pre-remove hook will delete transcriptions
      const meetings = await Meeting.find({ projectId });

      for (const meeting of meetings) {
        await meeting.remove();
      }

      // Delete the project
      await project.remove();

      this.logger.info('Project deleted', {
        projectId,
        userId,
        meetingsDeleted: meetings.length
      });

      return {
        message: 'Project and all associated meetings deleted successfully',
        deletedMeetings: meetings.length
      };
    } catch (error) {
      this.logger.error('Delete project error', {
        error: error.message,
        projectId,
        userId
      });
      throw error;
    }
  }

  /**
   * Verify user owns project
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @returns {boolean} Ownership status
   */
  async verifyOwnership(projectId, userId) {
    try {
      const project = await Project.findOne({
        _id: projectId,
        userId
      });

      return !!project;
    } catch (error) {
      this.logger.error('Verify ownership error', {
        error: error.message,
        projectId,
        userId
      });
      return false;
    }
  }

  /**
   * Get project statistics
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @returns {Object} Project statistics
   */
  async getProjectStats(projectId, userId) {
    try {
      const project = await Project.findOne({
        _id: projectId,
        userId
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const meetings = await Meeting.find({ projectId });

      const stats = {
        totalMeetings: meetings.length,
        pendingTranscriptions: meetings.filter(m => m.transcriptionStatus === 'pending').length,
        processingTranscriptions: meetings.filter(m => m.transcriptionStatus === 'processing').length,
        completedTranscriptions: meetings.filter(m => m.transcriptionStatus === 'completed').length,
        failedTranscriptions: meetings.filter(m => m.transcriptionStatus === 'failed').length,
        totalDuration: meetings.reduce((sum, m) => sum + (m.duration || 0), 0)
      };

      return stats;
    } catch (error) {
      this.logger.error('Get project stats error', {
        error: error.message,
        projectId,
        userId
      });
      throw error;
    }
  }
}

module.exports = ProjectService;
