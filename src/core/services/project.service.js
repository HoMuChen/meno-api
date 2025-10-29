/**
 * Project Service
 * Business logic for project management
 */
const Project = require('../../models/project.model');
const Meeting = require('../../models/meeting.model');
const BaseService = require('./base.service');

class ProjectService extends BaseService {
  constructor(logger, meetingService = null) {
    super(logger);
    this.meetingService = meetingService;
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

      this.logSuccess('Project created successfully', {
        projectId: project._id,
        userId,
        name
      });

      return project.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Create project', { userId });
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

      this.logSuccess('Projects retrieved', {
        userId,
        count: result.projects.length,
        page
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get projects', { userId });
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

      this.logSuccess('Project retrieved', {
        projectId,
        userId
      });

      return projectData;
    } catch (error) {
      this.logAndThrow(error, 'Get project by ID', { projectId, userId });
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

      this.logSuccess('Project updated', {
        projectId,
        userId
      });

      return project.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Update project', { projectId, userId });
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

      // Delete all meetings in this project using MeetingService
      // This ensures proper cascade deletion including audio files and transcriptions
      const meetings = await Meeting.find({ projectId });

      if (this.meetingService) {
        // Use MeetingService for proper cascade deletion
        for (const meeting of meetings) {
          await this.meetingService.deleteMeeting(meeting._id.toString(), userId);
        }
      } else {
        // Fallback: direct deletion (should not happen in production)
        this.logger.warn('MeetingService not available, using direct deletion', { projectId });
        for (const meeting of meetings) {
          await meeting.deleteOne();
        }
      }

      // Delete the project
      await project.deleteOne();

      this.logSuccess('Project deleted', {
        projectId,
        userId,
        meetingsDeleted: meetings.length
      });

      return {
        message: 'Project and all associated meetings deleted successfully',
        deletedMeetings: meetings.length
      };
    } catch (error) {
      this.logAndThrow(error, 'Delete project', { projectId, userId });
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
      this.logAndThrow(error, 'Verify ownership', { projectId, userId });
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
      this.logAndThrow(error, 'Get project stats', { projectId, userId });
    }
  }
}

module.exports = ProjectService;
