/**
 * Transcription Controller
 * Handles HTTP requests for transcription endpoints
 */
const BaseController = require('./base.controller');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../../utils/errors');
const PersonService = require('../../core/services/person.service');

class TranscriptionController extends BaseController {
  constructor(transcriptionDataService, semanticSearchService, projectService, logger) {
    super(transcriptionDataService, logger);
    this.transcriptionDataService = transcriptionDataService;
    this.semanticSearchService = semanticSearchService;
    this.projectService = projectService;
    this.personService = new PersonService(logger);
  }

    /**
   * list
   */
  list = this.asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { page, limit, sort } = req.query;

    // Meeting ownership already verified by middleware (req.meeting available)
    const result = await this.transcriptionDataService.getTranscriptions(meetingId, {
      page,
      limit,
      sort
    });

    return this.sendSuccess(res, result);
  });

    /**
   * Get ById
   */
  getById = this.asyncHandler(async (req, res) => {
    // Meeting ownership already verified by middleware (req.meeting available)
    const transcription = await this.transcriptionDataService.getTranscriptionById(req.params.id);

    return this.sendSuccess(res, transcription);
  });

    /**
   * Update
   */
  update = this.asyncHandler(async (req, res) => {
    // Meeting ownership already verified by middleware (req.meeting available)
    const updatedTranscription = await this.transcriptionDataService.updateTranscription(req.params.id, req.body);

    return this.sendSuccess(res, updatedTranscription, 'Transcription updated successfully');
  });

  /**
   * Delete
   */
  delete = this.asyncHandler(async (req, res) => {
    // Meeting ownership already verified by middleware (req.meeting available)
    const deletedTranscription = await this.transcriptionDataService.deleteTranscription(req.params.id);

    return this.sendSuccess(res, deletedTranscription, 'Transcription deleted successfully');
  });

  /**
   * Get ByPerson
   */
  getByPerson = this.asyncHandler(async (req, res) => {
    const { meetingId, personId } = req.params;
    const { page, limit } = req.query;

    // Meeting ownership already verified by middleware (req.meeting available)
    const result = await this.transcriptionDataService.getTranscriptionsByPerson(meetingId, personId, {
      page,
      limit
    });

    return this.sendSuccess(res, result);
  });

  /**
   * Get transcription status
   * Polling endpoint for real-time progress updates
   */
  getStatus = this.asyncHandler(async (req, res) => {
    const { meetingId } = req.params;

    // Meeting ownership already verified by middleware (req.meeting available)
    const meeting = req.meeting;

    // Build status response
    const statusData = {
      status: meeting.transcriptionStatus,
      progress: meeting.transcriptionProgress,
      processedSegments: meeting.metadata?.transcription?.processedSegments || 0,
      estimatedTotal: meeting.metadata?.transcription?.estimatedTotal || 0,
      startedAt: meeting.metadata?.transcription?.startedAt || null,
      completedAt: meeting.metadata?.transcription?.completedAt || null,
      errorMessage: meeting.metadata?.transcription?.errorMessage || null
    };

    // Calculate elapsed and estimated remaining time
    if (statusData.startedAt) {
      const startTime = new Date(statusData.startedAt).getTime();
      const currentTime = Date.now();
      statusData.elapsedTime = currentTime - startTime; // milliseconds

      // Estimate remaining time if processing
      if (statusData.status === 'processing' && statusData.progress > 0) {
        const timePerPercent = statusData.elapsedTime / statusData.progress;
        const remainingPercent = 100 - statusData.progress;
        statusData.estimatedRemaining = Math.ceil(timePerPercent * remainingPercent);
      }
    }

    return this.sendSuccess(res, statusData);
  });

  /**
   * Search across meetings
   * Hybrid search across all meetings in a project
   */
  searchAcrossMeetings = this.asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { q, page, limit, scoreThreshold, from, to, personId, groupByMeeting, hybrid } = req.query;

    if (!q) {
      throw new BadRequestError('Search query is required');
    }

    // Verify project ownership
    const project = await this.projectService.getProjectById(projectId, req.user.id);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Check authorization
    if (project.userId.toString() !== req.user.id) {
      throw new ForbiddenError('Not authorized to access this project');
    }

    const result = await this.semanticSearchService.searchAcrossMeetings(projectId, q, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      scoreThreshold: scoreThreshold ? parseFloat(scoreThreshold) : undefined,
      from,
      to,
      personId,
      groupByMeeting: groupByMeeting !== 'false', // Default to true
      hybrid: hybrid !== 'false' // Default to true (hybrid search)
    });

    return this.sendSuccess(res, result);
  });

  /**
   * Hybrid search
   * Combines semantic and keyword search for better results
   */
  hybridSearch = this.asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { q, page, limit, scoreThreshold, personId } = req.query;

    if (!q) {
      throw new BadRequestError('Search query is required');
    }

    // Meeting ownership already verified by middleware (req.meeting available)
    const result = await this.semanticSearchService.searchHybrid(meetingId, q, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      scoreThreshold: scoreThreshold ? parseFloat(scoreThreshold) : undefined,
      personId
    });

    return this.sendSuccess(res, result);
  });

  /**
   * Bulk assign speaker to person
   * Updates all transcriptions with matching speaker name to a person
   */
  bulkAssignSpeaker = this.asyncHandler(async (req, res) => {
    const { meetingId, speaker } = req.params;
    const { personId } = req.body;
    const userId = req.user.id;

    // Meeting ownership already verified by middleware (req.meeting available)

    // Verify person exists and belongs to user
    const person = await this.personService.getPersonById(personId, userId);

    if (!person) {
      throw new NotFoundError('Person not found or does not belong to you');
    }

    // Perform bulk update
    const result = await this.transcriptionDataService.bulkUpdateSpeakerAssignment(
      meetingId,
      speaker,
      personId,
      person.name
    );

    return this.sendSuccess(
      res,
      result,
      `Successfully assigned ${result.modifiedCount} transcription(s) to ${person.name}`
    );
  });

  /**
   * Bulk reassign person's transcriptions to another person
   * Updates all transcriptions assigned to one person to be assigned to another
   */
  bulkReassignPerson = this.asyncHandler(async (req, res) => {
    const { meetingId, personId } = req.params;
    const { newPersonId } = req.body;
    const userId = req.user.id;

    // Meeting ownership already verified by middleware (req.meeting available)

    // Verify current person exists and belongs to user
    const currentPerson = await this.personService.getPersonById(personId, userId);

    if (!currentPerson) {
      throw new NotFoundError('Current person not found or does not belong to you');
    }

    // Verify new person exists and belongs to user
    const newPerson = await this.personService.getPersonById(newPersonId, userId);

    if (!newPerson) {
      throw new NotFoundError('New person not found or does not belong to you');
    }

    // Perform bulk reassignment
    const result = await this.transcriptionDataService.bulkReassignPerson(
      meetingId,
      personId,
      currentPerson.name,
      newPersonId,
      newPerson.name
    );

    return this.sendSuccess(
      res,
      result,
      `Successfully reassigned ${result.modifiedCount} transcription(s) from ${currentPerson.name} to ${newPerson.name}`
    );
  });
}

module.exports = TranscriptionController;
