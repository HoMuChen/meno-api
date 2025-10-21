/**
 * User Service
 * Core business logic for user operations
 */
const User = require('../../models/user.model');
const { NotFoundError, ConflictError } = require('../../utils/errors');

class UserService {
  constructor(logger, storageProvider) {
    this.logger = logger;
    this.storage = storageProvider;
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
        User.countDocuments()
      ]);

      this.logger.info('Users retrieved', { count: users.length, total });

      return { users, total, page, limit };
    } catch (error) {
      this.logger.error('Failed to get users', { error });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      this.logger.info('User retrieved', { userId });
      return user;
    } catch (error) {
      this.logger.error('Failed to get user', { error, userId });
      throw error;
    }
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new ConflictError(`User already exists with email: ${userData.email}`);
      }

      const user = await User.create(userData);

      this.logger.info('User created', { userId: user._id, email: user.email });
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', { error, email: userData.email });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    try {
      // Check for email conflict if email is being updated
      if (updateData.email) {
        const existingUser = await User.findOne({
          email: updateData.email,
          _id: { $ne: userId }
        });
        if (existingUser) {
          throw new ConflictError(`Email already in use: ${updateData.email}`);
        }
      }

      const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true
      });

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      this.logger.info('User updated', { userId });
      return user;
    } catch (error) {
      this.logger.error('Failed to update user', { error, userId });
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    try {
      const user = await User.findByIdAndDelete(userId);

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      // Delete user's avatar if exists
      if (user.avatar) {
        try {
          await this.storage.delete(user.avatar);
        } catch (storageError) {
          this.logger.warn('Failed to delete user avatar', { error: storageError });
        }
      }

      this.logger.info('User deleted', { userId });
      return user;
    } catch (error) {
      this.logger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(userId, file) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      // Delete old avatar if exists
      if (user.avatar) {
        try {
          await this.storage.delete(user.avatar);
        } catch (error) {
          this.logger.warn('Failed to delete old avatar', { error });
        }
      }

      // Upload new avatar
      const path = `avatars/${userId}/${Date.now()}-${file.originalname}`;
      const result = await this.storage.upload(path, file.buffer, {
        contentType: file.mimetype
      });

      // Update user with new avatar path
      user.avatar = result.path;
      await user.save();

      this.logger.info('Avatar uploaded', { userId, path: result.path });
      return user;
    } catch (error) {
      this.logger.error('Failed to upload avatar', { error, userId });
      throw error;
    }
  }
}

module.exports = UserService;
