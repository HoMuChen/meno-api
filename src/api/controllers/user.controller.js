/**
 * User Controller
 * HTTP handlers for user-related endpoints
 */
const { success, created, paginated } = require('../../utils/responses');
const { BadRequestError } = require('../../utils/errors');

class UserController {
  constructor(userService, logger) {
    this.userService = userService;
    this.logger = logger;
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
  async getAllUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await this.userService.getAllUsers(page, limit);

      return paginated(res, result.users, page, limit, result.total);
    } catch (error) {
      next(error);
    }
  }

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
  async getUserById(req, res, next) {
    try {
      const user = await this.userService.getUserById(req.params.id);
      return success(res, user, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

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
  async createUser(req, res, next) {
    try {
      const user = await this.userService.createUser(req.body);
      return created(res, user, 'User created successfully');
    } catch (error) {
      next(error);
    }
  }

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
  async updateUser(req, res, next) {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body);
      return success(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

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
  async deleteUser(req, res, next) {
    try {
      await this.userService.deleteUser(req.params.id);
      return success(res, null, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }

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
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const user = await this.userService.uploadAvatar(req.params.id, req.file);
      return success(res, user, 'Avatar uploaded successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
