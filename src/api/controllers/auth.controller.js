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

    // Set refresh token in httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    const expiryMs = this.authService.calculateTokenExpiryMs(refreshTokenExpiry);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: expiryMs
    });

    this.logger.debug('Set refresh token cookie on signup', {
      userId: result.user._id
    });

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

    // Set refresh token in httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    const expiryMs = this.authService.calculateTokenExpiryMs(refreshTokenExpiry);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: expiryMs
    });

    this.logger.debug('Set refresh token cookie on login', {
      userId: result.user._id
    });

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
   * Uses POST message to window.opener to avoid exposing tokens in URL
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
      hasAccessToken: !!result.accessToken,
      hasRefreshToken: !!result.refreshToken
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    // Set refresh token in httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    const expiryMs = this.authService.calculateTokenExpiryMs(refreshTokenExpiry);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: expiryMs
    });

    this.logger.info('Redirecting to frontend with access token after Google OAuth', {
      userId: result.user._id,
      email: result.user.email,
      frontendUrl,
      cookieSet: true
    });

    // Redirect to frontend with access token in URL
    const redirectUrl = `${frontendUrl}?token=${result.accessToken}`;
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

  /**
   * @swagger
   * /auth/refresh:
   *   post:
   *     summary: Refresh access token using refresh token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: Valid refresh token
   *     responses:
   *       200:
   *         description: Token refreshed successfully
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
   *                     user:
   *                       type: object
   *                     accessToken:
   *                       type: string
   *                     refreshToken:
   *                       type: string
   *                     expiresIn:
   *                       type: number
   *       400:
   *         description: Missing refresh token
   *       401:
   *         description: Invalid or expired refresh token
   */
  refreshToken = this.asyncHandler(async (req, res) => {
    // Try cookie first (web app), then body (Chrome extension or legacy)
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const fromCookie = !!req.cookies?.refreshToken;

    this.logger.debug('Token refresh requested', {
      hasRefreshToken: !!refreshToken,
      tokenPreview: refreshToken ? `${refreshToken.substring(0, 20)}...` : 'none',
      source: fromCookie ? 'cookie' : 'body'
    });

    const result = await this.authService.refreshAccessToken(refreshToken);

    // If token came from cookie, update the cookie with new refresh token
    if (fromCookie) {
      const isProduction = process.env.NODE_ENV === 'production';
      const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
      const expiryMs = this.authService.calculateTokenExpiryMs(refreshTokenExpiry);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: expiryMs
      });

      this.logger.debug('Updated refresh token cookie', {
        userId: result.user._id
      });
    }

    this.logger.info('Token refreshed successfully', {
      userId: result.user._id,
      email: result.user.email,
      cookieUpdated: fromCookie
    });

    return this.sendSuccess(res, result, 'Token refreshed successfully');
  });

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: Logout and revoke refresh token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: Refresh token to revoke
   *     responses:
   *       200:
   *         description: Logout successful
   *       400:
   *         description: Missing refresh token
   */
  logout = this.asyncHandler(async (req, res) => {
    // Try cookie first (web app), then body (Chrome extension or legacy)
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const fromCookie = !!req.cookies?.refreshToken;

    this.logger.debug('Logout requested', {
      hasRefreshToken: !!refreshToken,
      tokenPreview: refreshToken ? `${refreshToken.substring(0, 20)}...` : 'none',
      source: fromCookie ? 'cookie' : 'body'
    });

    await this.authService.revokeRefreshToken(refreshToken);

    // Clear cookie if it was used
    if (fromCookie) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      this.logger.debug('Cleared refresh token cookie');
    }

    this.logger.info('User logged out successfully', {
      cookieCleared: fromCookie
    });

    return this.sendSuccess(res, null, 'Logout successful');
  });
}

module.exports = AuthController;
