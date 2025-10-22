/**
 * Meeting Controller
 * Handles HTTP requests for meeting endpoints
 */

class MeetingController {
  constructor(meetingService, logger) {
    this.meetingService = meetingService;
    this.logger = logger;
  }

  /**
   * @swagger
   * /projects/{projectId}/meetings:
   *   post:
   *     summary: Create a new meeting with audio upload
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *               - audioFile
   *             properties:
   *               title:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 200
   *               recordingType:
   *                 type: string
   *                 enum: [upload, direct]
   *                 default: upload
   *               audioFile:
   *                 type: string
   *                 format: binary
   *     responses:
   *       201:
   *         description: Meeting created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  create = async (req, res) => {
    try {
      const userId = req.user._id;
      const { projectId } = req.params;
      const meetingData = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({
          success: false,
          message: 'Audio file is required'
        });
      }

      const meeting = await this.meetingService.createMeeting(
        projectId,
        userId,
        meetingData,
        audioFile
      );

      res.status(201).json({
        success: true,
        message: 'Meeting created successfully',
        data: meeting
      });
    } catch (error) {
      this.logger.error('Create meeting controller error', {
        error: error.message,
        projectId: req.params.projectId,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('access denied') ? 404 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /projects/{projectId}/meetings:
   *   get:
   *     summary: Get meetings in a project
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
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
   *         description: Meetings retrieved successfully
   *       404:
   *         description: Project not found
   *       401:
   *         description: Unauthorized
   */
  list = async (req, res) => {
    try {
      const userId = req.user._id;
      const { projectId } = req.params;
      const { page, limit, sort } = req.query;

      const result = await this.meetingService.getMeetings(projectId, userId, {
        page,
        limit,
        sort
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('List meetings controller error', {
        error: error.message,
        projectId: req.params.projectId,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /meetings/{id}:
   *   get:
   *     summary: Get meeting by ID
   *     tags: [Meetings]
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
   *         description: Meeting retrieved successfully
   *       404:
   *         description: Meeting not found
   *       401:
   *         description: Unauthorized
   */
  getById = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const meeting = await this.meetingService.getMeetingById(id, userId);

      res.status(200).json({
        success: true,
        data: meeting
      });
    } catch (error) {
      this.logger.error('Get meeting controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /meetings/{id}:
   *   put:
   *     summary: Update meeting
   *     tags: [Meetings]
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
   *               title:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 200
   *     responses:
   *       200:
   *         description: Meeting updated successfully
   *       404:
   *         description: Meeting not found
   *       401:
   *         description: Unauthorized
   */
  update = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;
      const updates = req.body;

      const meeting = await this.meetingService.updateMeeting(id, userId, updates);

      res.status(200).json({
        success: true,
        message: 'Meeting updated successfully',
        data: meeting
      });
    } catch (error) {
      this.logger.error('Update meeting controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /meetings/{id}:
   *   delete:
   *     summary: Delete meeting
   *     tags: [Meetings]
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
   *         description: Meeting deleted successfully
   *       404:
   *         description: Meeting not found
   *       401:
   *         description: Unauthorized
   */
  delete = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const result = await this.meetingService.deleteMeeting(id, userId);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      this.logger.error('Delete meeting controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /meetings/{id}/transcribe:
   *   post:
   *     summary: Start transcription for meeting
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       202:
   *         description: Transcription started
   *       400:
   *         description: Already transcribed or in progress
   *       404:
   *         description: Meeting not found
   *       401:
   *         description: Unauthorized
   */
  startTranscription = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const result = await this.meetingService.startTranscription(id, userId);

      res.status(202).json({
        success: true,
        message: 'Transcription started',
        data: result
      });
    } catch (error) {
      this.logger.error('Start transcription controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      let statusCode = 500;
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        statusCode = 404;
      } else if (error.message.includes('already')) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * @swagger
   * /meetings/{id}/status:
   *   get:
   *     summary: Get transcription status
   *     tags: [Meetings]
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
   *         description: Status retrieved successfully
   *       404:
   *         description: Meeting not found
   *       401:
   *         description: Unauthorized
   */
  getStatus = async (req, res) => {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const status = await this.meetingService.getTranscriptionStatus(id, userId);

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      this.logger.error('Get transcription status controller error', {
        error: error.message,
        meetingId: req.params.id,
        userId: req.user?._id
      });

      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  };
}

module.exports = MeetingController;
