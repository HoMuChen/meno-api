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
}

module.exports = UserController;
