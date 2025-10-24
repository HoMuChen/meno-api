/**
 * Usage Service
 * Core business logic for usage tracking and validation
 */
const BaseService = require('./base.service');
const User = require('../../models/user.model');
const Project = require('../../models/project.model');
const Meeting = require('../../models/meeting.model');
const { NotFoundError, ValidationError } = require('../../utils/errors');

class UsageService extends BaseService {
  constructor(logger) {
    super(logger);
  }

  /**
   * Get current month's usage from cache or recalculate
   */
  async getCurrentMonthUsage(userId) {
    try {
      const user = await User.findById(userId).populate('tier');

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      // Check if cache needs reset
      if (user.needsUsageReset()) {
        user.resetMonthlyUsage();
        await user.save();
      }

      const remaining = await user.getRemainingDuration();

      this.logSuccess('Current month usage retrieved', {
        userId,
        used: user.currentMonthUsage.duration,
        remaining
      });

      return {
        used: user.currentMonthUsage.duration,
        limit: user.tier.limits.monthlyDuration,
        remaining: remaining,
        percentage: user.tier.limits.monthlyDuration === -1
          ? 0
          : Math.round((user.currentMonthUsage.duration / user.tier.limits.monthlyDuration) * 100),
        resetDate: this._getNextResetDate(),
        tier: user.tier.name
      };
    } catch (error) {
      this.logAndThrow(error, 'Get current month usage', { userId });
    }
  }

  /**
   * Recalculate monthly usage from meetings collection (fallback)
   */
  async recalculateMonthlyUsage(userId) {
    try {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

      // Find all user's projects
      const projects = await Project.find({ userId }).select('_id');
      const projectIds = projects.map(p => p._id);

      // Aggregate meetings duration for this month
      const result = await Meeting.aggregate([
        {
          $match: {
            projectId: { $in: projectIds },
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalDuration: { $sum: '$duration' }
          }
        }
      ]);

      const totalDuration = result.length > 0 ? result[0].totalDuration || 0 : 0;

      // Update user's cache
      const user = await User.findById(userId);
      if (user) {
        user.currentMonthUsage.duration = totalDuration;
        user.currentMonthUsage.lastReset = now;
        user.currentMonthUsage.month = now.getUTCMonth() + 1;
        user.currentMonthUsage.year = now.getUTCFullYear();
        await user.save();
      }

      this.logSuccess('Monthly usage recalculated', { userId, totalDuration });
      return totalDuration;
    } catch (error) {
      this.logAndThrow(error, 'Recalculate monthly usage', { userId });
    }
  }

  /**
   * Validate if user can upload a file
   */
  async validateUpload(userId, durationInSeconds, fileSizeInBytes) {
    try {
      const user = await User.findById(userId).populate('tier');

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      // Check and validate upload
      const result = await user.canUploadFile(durationInSeconds, fileSizeInBytes);

      this.logSuccess('Upload validation completed', {
        userId,
        allowed: result.allowed,
        reason: result.reason || 'ok'
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Validate upload', { userId, durationInSeconds, fileSizeInBytes });
    }
  }

  /**
   * Increment usage after successful upload
   */
  async incrementUsage(userId, durationInSeconds) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      user.addUsage(durationInSeconds);
      await user.save();

      this.logSuccess('Usage incremented', {
        userId,
        added: durationInSeconds,
        newTotal: user.currentMonthUsage.duration
      });

      return {
        used: user.currentMonthUsage.duration,
        added: durationInSeconds
      };
    } catch (error) {
      this.logAndThrow(error, 'Increment usage', { userId, durationInSeconds });
    }
  }

  /**
   * Get usage history for multiple months
   */
  async getUsageHistory(userId, months = 3) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      // Find all user's projects
      const projects = await Project.find({ userId }).select('_id');
      const projectIds = projects.map(p => p._id);

      const now = new Date();
      const history = [];

      // Calculate usage for each of the past N months
      for (let i = 0; i < months; i++) {
        const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const startOfMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0, 23, 59, 59));

        const result = await Meeting.aggregate([
          {
            $match: {
              projectId: { $in: projectIds },
              createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              totalDuration: { $sum: '$duration' },
              meetingCount: { $sum: 1 }
            }
          }
        ]);

        history.push({
          month: targetDate.getUTCMonth() + 1,
          year: targetDate.getUTCFullYear(),
          duration: result.length > 0 ? result[0].totalDuration || 0 : 0,
          meetingCount: result.length > 0 ? result[0].meetingCount || 0 : 0
        });
      }

      this.logSuccess('Usage history retrieved', { userId, months });
      return history;
    } catch (error) {
      this.logAndThrow(error, 'Get usage history', { userId, months });
    }
  }

  /**
   * Reset monthly usage cache for all users (cron job helper)
   */
  async resetAllUsersMonthlyCache() {
    try {
      const now = new Date();
      const currentMonth = now.getUTCMonth() + 1;
      const currentYear = now.getUTCFullYear();

      const result = await User.updateMany(
        {},
        {
          $set: {
            'currentMonthUsage.duration': 0,
            'currentMonthUsage.lastReset': now,
            'currentMonthUsage.month': currentMonth,
            'currentMonthUsage.year': currentYear
          }
        }
      );

      this.logSuccess('All users monthly cache reset', {
        modifiedCount: result.modifiedCount,
        month: currentMonth,
        year: currentYear
      });

      return result.modifiedCount;
    } catch (error) {
      this.logAndThrow(error, 'Reset all users monthly cache');
    }
  }

  /**
   * Get next reset date (1st of next month at 00:00 UTC)
   */
  _getNextResetDate() {
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    return nextMonth;
  }

  /**
   * Get usage statistics for admin
   */
  async getSystemUsageStats() {
    try {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

      // Get total users per tier
      const tierStats = await User.aggregate([
        {
          $lookup: {
            from: 'tierconfigs',
            localField: 'tier',
            foreignField: '_id',
            as: 'tierData'
          }
        },
        {
          $unwind: '$tierData'
        },
        {
          $group: {
            _id: '$tierData.name',
            count: { $sum: 1 },
            totalUsage: { $sum: '$currentMonthUsage.duration' }
          }
        }
      ]);

      // Get total meetings this month
      const totalMeetings = await Meeting.countDocuments({
        createdAt: { $gte: startOfMonth }
      });

      this.logSuccess('System usage stats retrieved', { tierStats, totalMeetings });
      return {
        tierStats,
        totalMeetings,
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear()
      };
    } catch (error) {
      this.logAndThrow(error, 'Get system usage stats');
    }
  }
}

module.exports = UsageService;
