/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

class AuthController {
  constructor(authService, logger) {
    this.authService = authService;
    this.logger = logger;
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
  signup = async (req, res) => {
    try {
      const result = await this.authService.signup(req.body);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Signup controller error', { error: error.message });

      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

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
  login = async (req, res) => {
    try {
      const result = await this.authService.login(req.body);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      this.logger.error('Login controller error', { error: error.message });

      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  };

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
  getProfile = async (req, res) => {
    try {
      res.status(200).json({
        success: true,
        data: req.user.toSafeObject()
      });
    } catch (error) {
      this.logger.error('Get profile error', { error: error.message });

      res.status(500).json({
        success: false,
        message: 'Error fetching profile'
      });
    }
  };

  /**
   * Google OAuth callback handler
   */
  googleCallback = async (req, res) => {
    try {
      // User is attached by passport
      const result = await this.authService.googleAuth(req.user);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
    } catch (error) {
      this.logger.error('Google callback error', { error: error.message });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  };

  /**
   * Google OAuth failure handler
   */
  googleFailure = (req, res) => {
    this.logger.error('Google OAuth failed');

    res.status(401).json({
      success: false,
      message: 'Google authentication failed'
    });
  };
}

module.exports = AuthController;
