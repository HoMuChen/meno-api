/**
 * Authentication Service
 * Business logic for user authentication
 */
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const TierConfig = require('../../models/tierConfig.model');
const Project = require('../../models/project.model');
const Person = require('../../models/person.model');
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
   * Create default project for new user
   * @param {string} userId - User ID
   * @returns {Object} Created project
   */
  async createDefaultProject(userId) {
    try {
      this.logger.debug('Creating default project for new user', { userId });

      const defaultProject = new Project({
        name: 'Default',
        description: 'Your default project',
        userId
      });

      await defaultProject.save();

      this.logger.info('Default project created', {
        userId,
        projectId: defaultProject._id,
        projectName: defaultProject.name
      });

      return defaultProject;
    } catch (error) {
      this.logger.error('Failed to create default project', {
        error: error.message,
        stack: error.stack,
        userId
      });
      // Don't throw - we don't want to fail user registration if project creation fails
      // The user can create projects manually later
    }
  }

  /**
   * Create default person (self) for new user
   * @param {string} userId - User ID
   * @param {string} name - User's name
   * @param {string} email - User's email
   * @returns {Object} Created person
   */
  async createDefaultPerson(userId, name, email) {
    try {
      this.logger.debug('Creating default person for new user', { userId, name, email });

      const defaultPerson = new Person({
        name,
        email,
        userId,
        notes: 'This is you!'
      });

      await defaultPerson.save();

      this.logger.info('Default person created', {
        userId,
        personId: defaultPerson._id,
        personName: defaultPerson.name
      });

      return defaultPerson;
    } catch (error) {
      this.logger.error('Failed to create default person', {
        error: error.message,
        stack: error.stack,
        userId
      });
      // Don't throw - we don't want to fail user registration if person creation fails
      // The user can create people manually later
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

      // Get default (free) tier
      const defaultTier = await TierConfig.getDefaultTier();
      if (!defaultTier) {
        throw new Error('Default tier not found. Please run tier seeder.');
      }

      // Create new user
      const user = new User({
        email,
        password,
        name,
        provider: 'email',
        tier: defaultTier._id
      });

      await user.save();

      this.logSuccess('User registered successfully', {
        userId: user._id,
        email: user.email,
        tier: defaultTier.name
      });

      // Create default project for new user
      await this.createDefaultProject(user._id);

      // Create default person (self) for new user
      await this.createDefaultPerson(user._id, user.name, user.email);

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
      const user = await User.findOne({ email }).select('+password').populate('tier');
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
      this.logger.debug('Starting Google OAuth authentication', {
        profileId: profile.id,
        provider: profile.provider,
        displayName: profile.displayName,
        emailsProvided: profile.emails?.length || 0
      });

      const { id: googleId, emails, displayName, photos } = profile;
      const email = emails[0].value;
      const avatar = photos && photos[0] ? photos[0].value : null;

      this.logger.debug('Extracted profile data', {
        googleId,
        email,
        displayName,
        hasAvatar: !!avatar
      });

      // Check if user exists
      this.logger.debug('Searching for existing user', {
        searchCriteria: { googleId, email }
      });

      let user = await User.findOne({ $or: [{ googleId }, { email }] }).populate('tier');

      if (user) {
        this.logger.debug('Existing user found', {
          userId: user._id,
          email: user.email,
          provider: user.provider,
          hasGoogleId: !!user.googleId,
          status: user.status
        });

        // Update existing user with Google ID if needed
        if (!user.googleId) {
          this.logger.debug('Updating user with Google ID', {
            userId: user._id,
            previousProvider: user.provider
          });

          user.googleId = googleId;
          user.provider = 'google';
          await user.save();

          this.logger.info('User provider updated to Google', {
            userId: user._id,
            email: user.email
          });
        }

        this.logSuccess('User logged in with Google', { userId: user._id, email: user.email });
      } else {
        this.logger.debug('No existing user found, creating new user');

        // Get default (free) tier for new user
        const defaultTier = await TierConfig.getDefaultTier();
        if (!defaultTier) {
          this.logger.error('Default tier not found during Google auth', {
            email,
            googleId
          });
          throw new Error('Default tier not found. Please run tier seeder.');
        }

        this.logger.debug('Default tier retrieved', {
          tierId: defaultTier._id,
          tierName: defaultTier.name
        });

        // Create new user
        user = new User({
          email,
          name: displayName,
          googleId,
          provider: 'google',
          avatar,
          tier: defaultTier._id
        });

        await user.save();

        this.logger.debug('New user created', {
          userId: user._id,
          email: user.email,
          provider: user.provider,
          tier: defaultTier.name
        });

        this.logSuccess('User registered with Google', {
          userId: user._id,
          email: user.email,
          tier: defaultTier.name
        });

        // Create default project for new user
        await this.createDefaultProject(user._id);

        // Create default person (self) for new user
        await this.createDefaultPerson(user._id, user.name, user.email);
      }

      // Check if user is active
      if (user.status !== 'active') {
        this.logger.warn('Inactive account attempted Google login', {
          userId: user._id,
          email: user.email,
          status: user.status
        });
        throw new Error('Account is not active');
      }

      this.logger.debug('Generating JWT token', {
        userId: user._id,
        email: user.email
      });

      // Generate token
      const token = this.generateToken({
        userId: user._id,
        email: user.email
      });

      this.logger.debug('Token generated successfully', {
        userId: user._id,
        tokenLength: token.length,
        tokenPreview: `${token.substring(0, 20)}...`
      });

      return {
        user: user.toSafeObject(),
        token
      };
    } catch (error) {
      this.logger.error('Google auth failed', {
        error: error.message,
        stack: error.stack,
        profileId: profile?.id,
        email: profile?.emails?.[0]?.value
      });
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
      const user = await User.findById(userId).populate('tier');
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
