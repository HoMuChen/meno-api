/**
 * User Controller
 * HTTP handlers for user-related endpoints
 */
const BaseController = require('./base.controller');
const { BadRequestError } = require('../../utils/errors');

class UserController extends BaseController {
  constructor(userService, logger) {
    super(userService, logger);
    this.userService = userService;
  }

  /**
   * @swagger
   * /api/users:
   *   get:
   *     summary: Get all users
   *     tags: [Users]
   *     parameters:
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
   *     responses:
   *       200:
   *         description: List of users
   */
  getAllUsers = this.asyncHandler(async (req, res) => {
    const { page, limit } = this.getPaginationParams(req);
    const result = await this.userService.getAllUsers(page, limit);
    return this.sendPaginated(res, result.users, page, limit, result.total);
  });

  /**
   * @swagger
   * /api/users/{id}:
   *   get:
   *     summary: Get user by ID
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: User details
   *       404:
   *         description: User not found
   */
  getUserById = this.asyncHandler(async (req, res) => {
    const user = await this.userService.getUserById(req.params.id);
    return this.sendSuccess(res, user, 'User retrieved successfully');
  });

  /**
   * @swagger
   * /api/users:
   *   post:
   *     summary: Create new user
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
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: User created
   */
  createUser = this.asyncHandler(async (req, res) => {
    const user = await this.userService.createUser(req.body);
    return this.sendCreated(res, user, 'User created successfully');
  });

  /**
   * @swagger
   * /api/users/{id}:
   *   put:
   *     summary: Update user
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               name:
   *                 type: string
   *     responses:
   *       200:
   *         description: User updated
   */
  updateUser = this.asyncHandler(async (req, res) => {
    const user = await this.userService.updateUser(req.params.id, req.body);
    return this.sendSuccess(res, user, 'User updated successfully');
  });

  /**
   * @swagger
   * /api/users/{id}:
   *   delete:
   *     summary: Delete user
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: User deleted
   */
  deleteUser = this.asyncHandler(async (req, res) => {
    await this.userService.deleteUser(req.params.id);
    return this.sendSuccess(res, null, 'User deleted successfully');
  });

  /**
   * @swagger
   * /api/users/{id}/avatar:
   *   post:
   *     summary: Upload user avatar
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               avatar:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: Avatar uploaded
   */
  uploadAvatar = this.asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const user = await this.userService.uploadAvatar(req.params.id, req.file);
    return this.sendSuccess(res, user, 'Avatar uploaded successfully');
  });

  /**
   * @swagger
   * /api/users/me:
   *   get:
   *     summary: Get current authenticated user's profile
   *     description: Returns the profile of the currently authenticated user
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
   */
  getCurrentUser = this.asyncHandler(async (req, res) => {
    this.logger.debug('Getting current user profile', {
      userId: req.user._id,
      email: req.user.email
    });

    return this.sendSuccess(res, req.user.toSafeObject(), 'Current user retrieved successfully');
  });

  /**
   * @swagger
   * /api/users/me/usage:
   *   get:
   *     summary: Get current user's monthly usage statistics
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
   *         description: Month (1-12, defaults to current month)
   *         example: 1
   *     responses:
   *       200:
   *         description: Usage statistics retrieved
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
   *                     year:
   *                       type: integer
   *                     month:
   *                       type: integer
   *                     totalDurationSeconds:
   *                       type: number
   *                     totalDurationMinutes:
   *                       type: number
   *                     totalDurationHours:
   *                       type: string
   *                     meetingCount:
   *                       type: integer
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
   *         description: Unauthorized
   */
  getUsageStats = this.asyncHandler(async (req, res) => {
    const userId = req.user._id; // From auth middleware
    const { year, month } = req.query;

    // Parse and validate query parameters
    const parsedYear = year ? parseInt(year, 10) : null;
    const parsedMonth = month ? parseInt(month, 10) : null;

    // Validate month if provided
    if (parsedMonth !== null && (parsedMonth < 1 || parsedMonth > 12)) {
      throw new BadRequestError('Month must be between 1 and 12');
    }

    const usageStats = await this.userService.getMonthlyUsage(userId, parsedYear, parsedMonth);
    return this.sendSuccess(res, usageStats, 'Usage statistics retrieved successfully');
  });
}

module.exports = UserController;
