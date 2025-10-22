/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */
const BaseController = require('./base.controller');
const { ConflictError, UnauthorizedError } = require('../../utils/errors');

class AuthController extends BaseController {
  constructor(authService, logger) {
    super(authService, logger);
    this.authService = authService;
  }

  /**
   * @swagger
   * /auth/signup:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *               - name
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 format: password
   *                 minLength: 6
   *               name:
   *                 type: string
   *                 minLength: 2
   *     responses:
   *       201:
   *         description: User registered successfully
   *       400:
   *         description: Validation error
   *       409:
   *         description: User already exists
   */
  signup = this.asyncHandler(async (req, res) => {
    const result = await this.authService.signup(req.body);
    return this.sendCreated(res, result, 'User registered successfully');
  });

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 format: password
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   */
  login = this.asyncHandler(async (req, res) => {
    const result = await this.authService.login(req.body);
    return this.sendSuccess(res, result, 'Login successful');
  });

  /**
   * @swagger
   * /auth/me:
   *   get:
   *     summary: Get current user profile
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile
   *       401:
   *         description: Unauthorized
   */
  getProfile = this.asyncHandler(async (req, res) => {
    return this.sendSuccess(res, req.user.toSafeObject());
  });

  /**
   * Google OAuth callback handler
   */
  googleCallback = this.asyncHandler(async (req, res) => {
    // User is attached by passport
    const result = await this.authService.googleAuth(req.user);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
  });

  /**
   * Google OAuth failure handler
   */
  googleFailure = this.asyncHandler(async (req, res) => {
    throw new UnauthorizedError('Google authentication failed');
  });
}

module.exports = AuthController;
