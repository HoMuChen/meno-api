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
    this.logger.debug('Google OAuth callback initiated', {
      hasUser: !!req.user,
      userId: req.user?.id,
      userEmail: req.user?.emails?.[0]?.value,
      query: req.query,
      sessionId: req.sessionID
    });

    // User is attached by passport
    const result = await this.authService.googleAuth(req.user);

    this.logger.debug('Google auth service completed', {
      userId: result.user._id,
      email: result.user.email,
      tokenGenerated: !!result.token,
      tokenLength: result.token?.length
    });

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendUrl}?token=${result.token}`;

    this.logger.info('Redirecting to frontend after Google OAuth', {
      userId: result.user._id,
      email: result.user.email,
      frontendUrl,
      redirectUrl: `${frontendUrl}?token=***`
    });

    res.redirect(redirectUrl);
  });

  /**
   * Google OAuth failure handler
   */
  googleFailure = this.asyncHandler(async (req, res) => {
    this.logger.error('Google OAuth authentication failed', {
      query: req.query,
      headers: {
        referer: req.headers.referer,
        userAgent: req.headers['user-agent']
      },
      sessionId: req.sessionID
    });

    throw new UnauthorizedError('Google authentication failed');
  });

  /**
   * @swagger
   * /auth/google/token:
   *   post:
   *     summary: Verify Google OAuth tokens and return JWT (Chrome Extension)
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - idToken
   *               - accessToken
   *             properties:
   *               idToken:
   *                 type: string
   *                 description: Google ID token from chrome.identity.getAuthToken()
   *               accessToken:
   *                 type: string
   *                 description: Google access token from chrome.identity.getAuthToken()
   *     responses:
   *       200:
   *         description: Authentication successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jwt:
   *                   type: string
   *                   description: Backend JWT token
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     email:
   *                       type: string
   *                     name:
   *                       type: string
   *                     picture:
   *                       type: string
   *       400:
   *         description: Missing required tokens
   *       401:
   *         description: Invalid tokens
   */
  googleTokenExchange = this.asyncHandler(async (req, res) => {
    const { idToken, accessToken } = req.body;

    this.logger.debug('Google token verification initiated', {
      hasIdToken: !!idToken,
      hasAccessToken: !!accessToken
    });

    // Verify tokens and get user profile
    const result = await this.authService.googleTokenExchange(idToken, accessToken);

    this.logger.info('Google token verification successful', {
      userId: result.user.id,
      email: result.user.email
    });

    // Return response in expected format (without wrapping in data/success)
    return res.json(result);
  });
}

module.exports = AuthController;
