/**
 * Authentication Service
 * Business logic for user authentication
 */
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const BaseService = require('./base.service');

class AuthService extends BaseService {
  constructor(logger) {
    super(logger);
  }

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @returns {string} JWT token
   */
  generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY || '7d'
    });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Register new user with email and password
   * @param {Object} userData - User registration data
   * @returns {Object} Created user and token
   */
  async signup(userData) {
    try {
      const { email, password, name } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create new user
      const user = new User({
        email,
        password,
        name,
        provider: 'email'
      });

      await user.save();

      this.logSuccess('User registered successfully', { userId: user._id, email: user.email });

      // Generate token
      const token = this.generateToken({
        userId: user._id,
        email: user.email
      });

      return {
        user: user.toSafeObject(),
        token
      };
    } catch (error) {
      this.logAndThrow(error, 'Signup');
    }
  }

  /**
   * Login user with email and password
   * @param {Object} credentials - Login credentials
   * @returns {Object} User and token
   */
  async login(credentials) {
    try {
      const { email, password } = credentials;

      // Find user with password field
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Check if user registered with email/password
      if (user.provider !== 'email') {
        throw new Error(`Please login with ${user.provider}`);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      this.logSuccess('User logged in successfully', { userId: user._id, email: user.email });

      // Generate token
      const token = this.generateToken({
        userId: user._id,
        email: user.email
      });

      return {
        user: user.toSafeObject(),
        token
      };
    } catch (error) {
      this.logAndThrow(error, 'Login');
    }
  }

  /**
   * Handle Google OAuth login/signup
   * @param {Object} profile - Google profile data
   * @returns {Object} User and token
   */
  async googleAuth(profile) {
    try {
      const { id: googleId, emails, displayName, photos } = profile;
      const email = emails[0].value;
      const avatar = photos && photos[0] ? photos[0].value : null;

      // Check if user exists
      let user = await User.findOne({ $or: [{ googleId }, { email }] });

      if (user) {
        // Update existing user with Google ID if needed
        if (!user.googleId) {
          user.googleId = googleId;
          user.provider = 'google';
          await user.save();
        }

        this.logSuccess('User logged in with Google', { userId: user._id, email: user.email });
      } else {
        // Create new user
        user = new User({
          email,
          name: displayName,
          googleId,
          provider: 'google',
          avatar
        });

        await user.save();

        this.logSuccess('User registered with Google', { userId: user._id, email: user.email });
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Generate token
      const token = this.generateToken({
        userId: user._id,
        email: user.email
      });

      return {
        user: user.toSafeObject(),
        token
      };
    } catch (error) {
      this.logAndThrow(error, 'Google auth');
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Object} User object
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      return user.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Get user by ID', { userId });
    }
  }
}

module.exports = AuthService;
