/**
 * User Service
 * Core business logic for user operations
 */
const BaseService = require('./base.service');
const User = require('../../models/user.model');
const Meeting = require('../../models/meeting.model');
const Project = require('../../models/project.model');
const mongoose = require('mongoose');
const { NotFoundError, ConflictError } = require('../../utils/errors');

class UserService extends BaseService {
  constructor(logger, storageProvider) {
    super(logger);
    this.storage = storageProvider;
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(page = 1, limit = 10) {
    try {
      const { skip, limit: parsedLimit } = this.getPaginationParams(page, limit);

      const [users, total] = await Promise.all([
        User.find().skip(skip).limit(parsedLimit).sort({ createdAt: -1 }),
        User.countDocuments()
      ]);

      this.logSuccess('Users retrieved', { count: users.length, total });

      return { users, total, page: parseInt(page), limit: parsedLimit };
    } catch (error) {
      this.logAndThrow(error, 'Get all users', { page, limit });
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

      this.logSuccess('User retrieved', { userId });
      return user;
    } catch (error) {
      this.logAndThrow(error, 'Get user by ID', { userId });
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

      this.logSuccess('User created', { userId: user._id, email: user.email });
      return user;
    } catch (error) {
      this.logAndThrow(error, 'Create user', { email: userData.email });
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

      this.logSuccess('User updated', { userId });
      return user;
    } catch (error) {
      this.logAndThrow(error, 'Update user', { userId });
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

      this.logSuccess('User deleted', { userId });
      return user;
    } catch (error) {
      this.logAndThrow(error, 'Delete user', { userId });
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

      this.logSuccess('Avatar uploaded', { userId, path: result.path });
      return user;
    } catch (error) {
      this.logAndThrow(error, 'Upload avatar', { userId });
    }
  }

  /**
   * Get monthly usage statistics for a user
   * Calculates total meeting duration for specified month
   * @param {string} userId - User ID
   * @param {number} year - Year (defaults to current year)
   * @param {number} month - Month (1-12, defaults to current month)
   * @returns {Object} Usage statistics
   */
  async getMonthlyUsage(userId, year = null, month = null) {
    try {
      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      // Use current year/month if not provided
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month || now.getMonth() + 1; // JavaScript months are 0-indexed

      // Calculate start and end of month
      const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
      const endOfMonth = new Date(targetYear, targetMonth, 1);

      this.logger.debug('Calculating monthly usage', {
        userId,
        year: targetYear,
        month: targetMonth,
        startOfMonth,
        endOfMonth
      });

      // Aggregate meetings by userId and date range
      const result = await Meeting.aggregate([
        // Step 1: Lookup project for each meeting
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        // Step 2: Unwind project array
        { $unwind: '$project' },
        // Step 3: Filter by userId and date range
        {
          $match: {
            'project.userId': new mongoose.Types.ObjectId(userId),
            createdAt: {
              $gte: startOfMonth,
              $lt: endOfMonth
            }
          }
        },
        // Step 4: Group and sum duration
        {
          $group: {
            _id: null,
            totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
            meetingCount: { $sum: 1 }
          }
        }
      ]);

      const usageData = result[0] || { totalDuration: 0, meetingCount: 0 };

      this.logSuccess('Monthly usage calculated', {
        userId,
        year: targetYear,
        month: targetMonth,
        totalDuration: usageData.totalDuration,
        meetingCount: usageData.meetingCount
      });

      return {
        userId,
        year: targetYear,
        month: targetMonth,
        totalDurationSeconds: usageData.totalDuration,
        totalDurationMinutes: Math.round(usageData.totalDuration / 60),
        totalDurationHours: (usageData.totalDuration / 3600).toFixed(2),
        meetingCount: usageData.meetingCount,
        period: {
          start: startOfMonth,
          end: endOfMonth
        }
      };
    } catch (error) {
      this.logAndThrow(error, 'Get monthly usage', { userId, year, month });
    }
  }
}

module.exports = UserService;
