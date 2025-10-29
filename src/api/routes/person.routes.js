/**
 * Person Routes
 * Define routes for person endpoints
 */
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateCreatePerson, validateUpdatePerson } = require('../validators/person.validator');

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

  return router;
};

module.exports = createPersonRoutes;
