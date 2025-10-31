/**
 * Meeting Routes
 * Define routes for meeting endpoints
 */
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { requireMeetingOwnership, requireProjectOwnership } = require('../middleware/authorization.middleware');
const { handleStreamingUpload } = require('../middleware/streaming-upload.middleware');
const { validateCreateMeeting, validateUpdateMeeting } = require('../validators/meeting.validator');

const createMeetingRoutes = (meetingController, audioStorageProvider) => {
  const router = express.Router({ mergeParams: true }); // mergeParams to access :projectId

  // Create streaming upload middleware with storage provider
  const uploadAudio = handleStreamingUpload(audioStorageProvider);

  /**
   * @swagger
   * tags:
   *   name: Meetings
   *   description: Meeting management endpoints
   */

  // All meeting routes require authentication
  router.use(authenticate);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings:
   *   post:
   *     summary: Create a new meeting with audio file
   *     description: Upload audio file and create a meeting record
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - audioFile
   *               - title
   *             properties:
   *               audioFile:
   *                 type: string
   *                 format: binary
   *                 description: Audio file (MP3, WAV, M4A, WebM, OGG - max 100MB)
   *               title:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 200
   *                 example: "Weekly Team Standup"
   *               recordingType:
   *                 type: string
   *                 enum: [upload, direct]
   *                 default: upload
   *               duration:
   *                 type: number
   *                 format: float
   *                 description: Audio duration in seconds (optional, calculated from file if not provided)
   *                 example: 125.5
   *     responses:
   *       201:
   *         description: Meeting created successfully
   *       400:
   *         description: Validation error or invalid file
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Project not found
   */
  router.post('/', requireProjectOwnership, uploadAudio, validateCreateMeeting, meetingController.create);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings:
   *   get:
   *     summary: Get meetings in a project
   *     description: Retrieve paginated list of meetings for a project
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
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
   *           default: "-createdAt"
   *     responses:
   *       200:
   *         description: Meetings retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Project not found
   */
  router.get('/', requireProjectOwnership, meetingController.list);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}:
   *   get:
   *     summary: Get meeting by ID
   *     description: Retrieve specific meeting details
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       200:
   *         description: Meeting retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/:id', requireMeetingOwnership, meetingController.getById);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}:
   *   put:
   *     summary: Update meeting
   *     description: Update meeting title
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     requestBody:
   *       required: true
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
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.put('/:id', requireMeetingOwnership, validateUpdateMeeting, meetingController.update);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}:
   *   delete:
   *     summary: Delete meeting
   *     description: Delete meeting, audio file, and all transcriptions
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       200:
   *         description: Meeting deleted successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.delete('/:id', requireMeetingOwnership, meetingController.delete);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/transcribe:
   *   post:
   *     summary: Start transcription for meeting
   *     description: Begin async transcription process for meeting audio
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       202:
   *         description: Transcription started successfully
   *       400:
   *         description: Meeting already transcribed or in progress
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.post('/:id/transcribe', requireMeetingOwnership, meetingController.startTranscription);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/download:
   *   get:
   *     summary: Download meeting audio file
   *     description: Download the original audio file for a meeting
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       200:
   *         description: Audio file downloaded successfully
   *         content:
   *           audio/mpeg:
   *             schema:
   *               type: string
   *               format: binary
   *           audio/wav:
   *             schema:
   *               type: string
   *               format: binary
   *           audio/mp4:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/:id/download', requireMeetingOwnership, meetingController.downloadAudio);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/status:
   *   get:
   *     summary: Get transcription status
   *     description: Check transcription progress and status
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       200:
   *         description: Status retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/:id/status', requireMeetingOwnership, meetingController.getStatus);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/summary/stream:
   *   post:
   *     summary: Generate meeting summary with streaming
   *     description: |
   *       Stream AI-generated meeting summary with real-time updates.
   *       Summary includes Overview, Key Points, Conclusion, and Action Items sections.
   *
   *       IMPORTANT REQUIREMENTS:
   *       - Summary is in MARKDOWN FORMAT with proper headings (##) and bullet points (-)
   *       - Summary is generated in the SAME LANGUAGE as the meeting transcription
   *       - For example, if transcription is in Chinese, the summary will be in Chinese
   *
   *       Saves to database when complete.
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       200:
   *         description: Streaming response with Server-Sent Events
   *         content:
   *           text/event-stream:
   *             schema:
   *               type: string
   *               description: |
   *                 SSE stream with JSON events:
   *                 - {"type":"connected","meetingId":"..."}
   *                 - {"type":"chunk","content":"markdown text"}
   *                 - {"type":"complete"}
   *                 - {"type":"error","message":"..."}
   *
   *                 Summary is in MARKDOWN FORMAT with the following sections:
   *
   *                 ## Overview
   *                 Brief overview of meeting discussion
   *
   *                 ## Key Points
   *                 - Main topics and decisions
   *
   *                 ## Conclusion
   *                 Final outcomes and agreements
   *
   *                 ## Action Items
   *                 - Tasks with responsibilities
   *
   *                 Notes:
   *                 - All content is in MARKDOWN FORMAT (## for headings, - for bullet points)
   *                 - Summary is generated in the same language as the transcription
   *       400:
   *         description: Transcription not completed
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.post('/:id/summary/stream', requireMeetingOwnership, meetingController.generateSummaryStream);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/action-items/generate:
   *   post:
   *     summary: Generate action items for meeting
   *     description: |
   *       Generate action items from meeting transcription using AI.
   *       Returns immediately with 202 status while processing in background.
   *       Client should poll meeting status to check completion.
   *
   *       Action items include:
   *       - task: What needs to be done
   *       - assignee: Person responsible (matched from transcript speakers)
   *       - dueDate: When it should be completed
   *       - context: Additional context from the meeting
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *     responses:
   *       202:
   *         description: Action items generation started
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Action items generation started"
   *                 actionItemsStatus:
   *                   type: string
   *                   enum: [processing]
   *                   example: "processing"
   *                 actionItemsProgress:
   *                   type: number
   *                   example: 0
   *       400:
   *         description: Transcription not completed or already processing
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.post('/:id/action-items/generate', requireMeetingOwnership, meetingController.generateActionItems);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/action-items:
   *   get:
   *     summary: List action items for meeting
   *     description: Get paginated list of action items generated for this meeting
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
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
   *           default: 50
   *         description: Items per page
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: "createdAt"
   *         description: Sort field
   *     responses:
   *       200:
   *         description: Action items retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 actionItems:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       meetingId:
   *                         type: string
   *                       personId:
   *                         type: string
   *                         nullable: true
   *                       task:
   *                         type: string
   *                       assignee:
   *                         type: string
   *                         nullable: true
   *                       dueDate:
   *                         type: string
   *                         nullable: true
   *                       context:
   *                         type: string
   *                         nullable: true
   *                       status:
   *                         type: string
   *                         enum: [pending, in_progress, completed]
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Meeting not found
   */
  router.get('/:id/action-items', requireMeetingOwnership, meetingController.listActionItems);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/action-items/{actionItemId}:
   *   patch:
   *     summary: Update an action item
   *     description: Update fields of a specific action item
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: path
   *         name: actionItemId
   *         required: true
   *         schema:
   *           type: string
   *         description: Action Item ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               task:
   *                 type: string
   *                 maxLength: 500
   *               assignee:
   *                 type: string
   *                 maxLength: 100
   *               personId:
   *                 type: string
   *               dueDate:
   *                 type: string
   *                 maxLength: 100
   *               context:
   *                 type: string
   *                 maxLength: 500
   *               status:
   *                 type: string
   *                 enum: [pending, in_progress, completed]
   *     responses:
   *       200:
   *         description: Action item updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Action item not found
   */
  router.patch('/:id/action-items/:actionItemId', requireMeetingOwnership, meetingController.updateActionItem);

  /**
   * @swagger
   * /api/projects/{projectId}/meetings/{id}/action-items/{actionItemId}:
   *   delete:
   *     summary: Delete an action item
   *     description: Permanently delete a specific action item
   *     tags: [Meetings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Meeting ID
   *       - in: path
   *         name: actionItemId
   *         required: true
   *         schema:
   *           type: string
   *         description: Action Item ID
   *     responses:
   *       204:
   *         description: Action item deleted successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Action item not found
   */
  router.delete('/:id/action-items/:actionItemId', requireMeetingOwnership, meetingController.deleteActionItem);

  return router;
};

module.exports = createMeetingRoutes;
