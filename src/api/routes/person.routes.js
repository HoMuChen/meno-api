/**
 * Person Routes
 * Define routes for person endpoints
 */
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateCreatePerson, validateUpdatePerson } = require('../validators/person.validator');
const { validatePagination } = require('../validators/transcription.validator');

const createPersonRoutes = (personController) => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   name: People
   *   description: Person management endpoints
   */

  // All person routes require authentication
  router.use(authenticate);

  /**
   * @swagger
   * /api/people:
   *   post:
   *     summary: Create a new person
   *     description: Create a new person (client, member, friend, speaker)
   *     tags: [People]
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
   *                 example: "John Doe"
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "john@example.com"
   *               phone:
   *                 type: string
   *                 maxLength: 20
   *                 example: "+1234567890"
   *               company:
   *                 type: string
   *                 maxLength: 100
   *                 example: "Acme Corporation"
   *               socialMedia:
   *                 type: object
   *                 properties:
   *                   linkedin:
   *                     type: string
   *                     format: uri
   *                     example: "https://linkedin.com/in/johndoe"
   *                   twitter:
   *                     type: string
   *                     format: uri
   *                     example: "https://twitter.com/johndoe"
   *                   facebook:
   *                     type: string
   *                     format: uri
   *                     example: "https://facebook.com/johndoe"
   *                   instagram:
   *                     type: string
   *                     format: uri
   *                     example: "https://instagram.com/johndoe"
   *                   github:
   *                     type: string
   *                     format: uri
   *                     example: "https://github.com/johndoe"
   *               notes:
   *                 type: string
   *                 maxLength: 1000
   *                 example: "Important client for Q4 project"
   *     responses:
   *       201:
   *         description: Person created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  router.post('/', validateCreatePerson, personController.create);

  /**
   * @swagger
   * /api/people:
   *   get:
   *     summary: Get user's people
   *     description: Retrieve paginated list of people for authenticated user
   *     tags: [People]
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
   *           default: "name"
   *         description: Sort field (prefix with - for descending)
   *     responses:
   *       200:
   *         description: People retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  router.get('/', personController.list);

  /**
   * @swagger
   * /api/people/{id}:
   *   get:
   *     summary: Get person by ID
   *     description: Retrieve a specific person by their ID
   *     tags: [People]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Person ID
   *     responses:
   *       200:
   *         description: Person retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Person not found
   */
  router.get('/:id', personController.getById);

  /**
   * @swagger
   * /api/people/{id}:
   *   put:
   *     summary: Update person
   *     description: Update person information
   *     tags: [People]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Person ID
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
   *               email:
   *                 type: string
   *                 format: email
   *               phone:
   *                 type: string
   *                 maxLength: 20
   *               company:
   *                 type: string
   *                 maxLength: 100
   *               socialMedia:
   *                 type: object
   *                 properties:
   *                   linkedin:
   *                     type: string
   *                     format: uri
   *                   twitter:
   *                     type: string
   *                     format: uri
   *                   facebook:
   *                     type: string
   *                     format: uri
   *                   instagram:
   *                     type: string
   *                     format: uri
   *                   github:
   *                     type: string
   *                     format: uri
   *               notes:
   *                 type: string
   *                 maxLength: 1000
   *     responses:
   *       200:
   *         description: Person updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Person not found
   */
  router.put('/:id', validateUpdatePerson, personController.update);

  /**
   * @swagger
   * /api/people/{id}:
   *   delete:
   *     summary: Delete person
   *     description: Delete a person
   *     tags: [People]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Person ID
   *     responses:
   *       200:
   *         description: Person deleted successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Person not found
   */
  router.delete('/:id', personController.delete);

  /**
   * @swagger
   * /api/people/{id}/transcriptions:
   *   get:
   *     summary: Get person's transcriptions
   *     description: Retrieve all transcriptions for a person across all meetings with optional text search, ordered by creation date
   *     tags: [People]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Person ID
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
   *           maximum: 100
   *         description: Items per page
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: "-createdAt"
   *         description: Sort field (prefix with - for descending, default is -createdAt)
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Optional text search query to filter transcriptions by content
   *         example: "project deadline"
   *     responses:
   *       200:
   *         description: Transcriptions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     transcriptions:
   *                       type: array
   *                       items:
   *                         type: object
   *                     pagination:
   *                       type: object
   *                       properties:
   *                         page:
   *                           type: integer
   *                         limit:
   *                           type: integer
   *                         total:
   *                           type: integer
   *                         pages:
   *                           type: integer
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Person not found
   */
  router.get('/:id/transcriptions', validatePagination, personController.getTranscriptions);

  /**
   * @swagger
   * /api/people/{id}/action-items:
   *   get:
   *     summary: Get person's action items
   *     description: Retrieve all action items assigned to a person across all meetings
   *     tags: [People]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Person ID
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
   *         description: Sort field (prefix with - for descending)
   *     responses:
   *       200:
   *         description: Action items retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     actionItems:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           meetingId:
   *                             type: object
   *                             properties:
   *                               _id:
   *                                 type: string
   *                               title:
   *                                 type: string
   *                               projectId:
   *                                 type: string
   *                           task:
   *                             type: string
   *                           assignee:
   *                             type: string
   *                             nullable: true
   *                           dueDate:
   *                             type: string
   *                             format: date-time
   *                             nullable: true
   *                           context:
   *                             type: string
   *                             nullable: true
   *                           status:
   *                             type: string
   *                             enum: [pending, in_progress, completed]
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                     pagination:
   *                       type: object
   *                       properties:
   *                         page:
   *                           type: integer
   *                         limit:
   *                           type: integer
   *                         total:
   *                           type: integer
   *                         pages:
   *                           type: integer
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Person not found
   */
  router.get('/:id/action-items', validatePagination, personController.getActionItems);

  return router;
};

module.exports = createPersonRoutes;
