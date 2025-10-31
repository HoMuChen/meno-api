/**
 * User Routes
 * URL routing for user endpoints
 */
const express = require('express');
const multer = require('multer');
const validate = require('../middleware/validator');
const { createUserSchema, updateUserSchema, getUserSchema } = require('../validators/user.validator');
const { authenticate } = require('../middleware/auth.middleware');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

const createUserRoutes = (userController, meetingController) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/users:
   *   get:
   *     summary: Get all users
   *     description: Retrieve a list of all users in the system
   *     tags: [Users]
   *     responses:
   *       200:
   *         description: List of users retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/User'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/', userController.getAllUsers.bind(userController));

  /**
   * @swagger
   * /api/users/me:
   *   get:
   *     summary: Get current authenticated user's profile
   *     description: Returns the profile of the currently authenticated user (must be placed before /:id route)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized - authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/me', authenticate, userController.getCurrentUser.bind(userController));

  /**
   * @swagger
   * /api/users/{id}:
   *   get:
   *     summary: Get user by ID
   *     description: Retrieve a single user by their unique ID
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     responses:
   *       200:
   *         description: User retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Invalid user ID format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/:id', validate(getUserSchema), userController.getUserById.bind(userController));

  /**
   * @swagger
   * /api/users:
   *   post:
   *     summary: Create a new user
   *     description: Create a new user with email and name
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - name
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User's email address (must be unique)
   *                 example: john.doe@example.com
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 100
   *                 description: User's full name
   *                 example: John Doe
   *               status:
   *                 type: string
   *                 enum: [active, inactive, suspended]
   *                 description: User account status
   *                 example: active
   *     responses:
   *       201:
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Validation error or duplicate email
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/', validate(createUserSchema), userController.createUser.bind(userController));

  /**
   * @swagger
   * /api/users/{id}:
   *   put:
   *     summary: Update user
   *     description: Update an existing user's information
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User's email address
   *                 example: john.updated@example.com
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 100
   *                 description: User's full name
   *                 example: John Updated
   *               status:
   *                 type: string
   *                 enum: [active, inactive, suspended]
   *                 description: User account status
   *                 example: active
   *     responses:
   *       200:
   *         description: User updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Validation error or invalid ID
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.put('/:id', validate(updateUserSchema), userController.updateUser.bind(userController));

  /**
   * @swagger
   * /api/users/{id}:
   *   delete:
   *     summary: Delete user
   *     description: Delete a user from the system
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     responses:
   *       200:
   *         description: User deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: User deleted successfully
   *       400:
   *         description: Invalid user ID format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.delete('/:id', validate(getUserSchema), userController.deleteUser.bind(userController));

  /**
   * @swagger
   * /api/users/{id}/avatar:
   *   post:
   *     summary: Upload user avatar
   *     description: Upload an avatar image for a user (max 5MB)
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - avatar
   *             properties:
   *               avatar:
   *                 type: string
   *                 format: binary
   *                 description: Avatar image file (max 5MB)
   *     responses:
   *       200:
   *         description: Avatar uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Validation error or file too large
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post(
    '/:id/avatar',
    validate(getUserSchema),
    upload.single('avatar'),
    userController.uploadAvatar.bind(userController)
  );

  /**
   * @swagger
   * /api/users/me/usage:
   *   get:
   *     summary: Get current user's monthly usage statistics
   *     description: Retrieve usage statistics (total meeting duration) for the authenticated user for a specific month
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: year
   *         schema:
   *           type: integer
   *         description: Year (defaults to current year)
   *         example: 2025
   *       - in: query
   *         name: month
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 12
   *         description: Month 1-12 (defaults to current month)
   *         example: 1
   *     responses:
   *       200:
   *         description: Usage statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     userId:
   *                       type: string
   *                       example: "507f1f77bcf86cd799439011"
   *                     year:
   *                       type: integer
   *                       example: 2025
   *                     month:
   *                       type: integer
   *                       example: 1
   *                     totalDurationSeconds:
   *                       type: number
   *                       example: 3600
   *                     totalDurationMinutes:
   *                       type: number
   *                       example: 60
   *                     totalDurationHours:
   *                       type: string
   *                       example: "1.00"
   *                     meetingCount:
   *                       type: integer
   *                       example: 5
   *                     period:
   *                       type: object
   *                       properties:
   *                         start:
   *                           type: string
   *                           format: date-time
   *                         end:
   *                           type: string
   *                           format: date-time
   *       401:
   *         description: Unauthorized - authentication required
   *       400:
   *         description: Invalid query parameters
   */
  router.get('/me/usage', authenticate, userController.getUsageStats.bind(userController));

  /**
   * @swagger
   * /api/users/{userId}/meetings:
   *   get:
   *     summary: Get user's recent meetings
   *     description: Retrieve paginated list of meetings for a user across all their projects
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 5
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: "-createdAt"
   *     responses:
   *       200:
   *         description: User meetings retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   */
  if (meetingController) {
    router.get('/:userId/meetings', authenticate, meetingController.getUserMeetings);
  }

  /**
   * @swagger
   * /api/users/{userId}/action-items:
   *   get:
   *     summary: Get user's action items
   *     description: Retrieve paginated list of all action items for a user across all their meetings
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         description: User action items retrieved successfully
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
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           title:
   *                             type: string
   *                           projectId:
   *                             type: string
   *                       userId:
   *                         type: string
   *                       personId:
   *                         type: object
   *                         nullable: true
   *                         properties:
   *                           _id:
   *                             type: string
   *                           name:
   *                             type: string
   *                           email:
   *                             type: string
   *                           company:
   *                             type: string
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
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     total:
   *                       type: integer
   *                     pages:
   *                       type: integer
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   */
  if (meetingController) {
    router.get('/:userId/action-items', authenticate, meetingController.listUserActionItems);
  }

  return router;
};

module.exports = createUserRoutes;
