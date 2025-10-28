/**
 * Authorization Service
 * Centralized authorization logic for resource ownership verification
 */

const BaseService = require('./base.service');
const { ForbiddenError, NotFoundError } = require('../../utils/errors');

class AuthorizationService extends BaseService {
  constructor(logger) {
    super(logger);
  }

  /**
   * Verify that a meeting belongs to the specified user
   * @param {Object} meeting - Meeting object with populated projectId
   * @param {string} userId - User ID to verify against
   * @throws {NotFoundError} If meeting is null/undefined
   * @throws {ForbiddenError} If user doesn't own the meeting
   */
  verifyMeetingOwnership(meeting, userId) {
    if (!meeting) {
      this.logger.warn('Meeting not found for ownership verification');
      throw new NotFoundError('Meeting not found');
    }

    const meetingOwnerId = meeting.projectId?.userId?.toString();
    const requestUserId = userId.toString();

    if (meetingOwnerId !== requestUserId) {
      this.logger.warn('Access denied: User does not own meeting', {
        meetingId: meeting._id?.toString(),
        requestUserId,
        meetingOwnerId
      });
      throw new ForbiddenError('Access denied');
    }

    this.logger.debug('Meeting ownership verified', {
      meetingId: meeting._id?.toString(),
      userId: requestUserId
    });

    return true;
  }

  /**
   * Verify that a project belongs to the specified user
   * @param {Object} project - Project object
   * @param {string} userId - User ID to verify against
   * @throws {NotFoundError} If project is null/undefined
   * @throws {ForbiddenError} If user doesn't own the project
   */
  verifyProjectOwnership(project, userId) {
    if (!project) {
      this.logger.warn('Project not found for ownership verification');
      throw new NotFoundError('Project not found');
    }

    const projectOwnerId = project.userId?.toString();
    const requestUserId = userId.toString();

    if (projectOwnerId !== requestUserId) {
      this.logger.warn('Access denied: User does not own project', {
        projectId: project._id?.toString(),
        requestUserId,
        projectOwnerId
      });
      throw new ForbiddenError('Access denied');
    }

    this.logger.debug('Project ownership verified', {
      projectId: project._id?.toString(),
      userId: requestUserId
    });

    return true;
  }

  /**
   * Verify that a transcription belongs to the specified user (via meeting ownership)
   * @param {Object} transcription - Transcription object with populated meetingId
   * @param {string} userId - User ID to verify against
   * @throws {NotFoundError} If transcription is null/undefined
   * @throws {ForbiddenError} If user doesn't own the transcription
   */
  verifyTranscriptionOwnership(transcription, userId) {
    if (!transcription) {
      this.logger.warn('Transcription not found for ownership verification');
      throw new NotFoundError('Transcription not found');
    }

    // Transcription ownership is verified through meeting ownership
    if (transcription.meetingId) {
      return this.verifyMeetingOwnership(transcription.meetingId, userId);
    }

    this.logger.error('Transcription missing meeting relationship', {
      transcriptionId: transcription._id?.toString()
    });
    throw new ForbiddenError('Access denied');
  }
}

module.exports = AuthorizationService;
