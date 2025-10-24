/**
 * Tier Service
 * Core business logic for subscription tier operations
 */
const BaseService = require('./base.service');
const TierConfig = require('../../models/tierConfig.model');
const { NotFoundError, ValidationError } = require('../../utils/errors');

class TierService extends BaseService {
  constructor(logger) {
    super(logger);
  }

  /**
   * Get all active tiers
   */
  async getAllActiveTiers() {
    try {
      const tiers = await TierConfig.find({ isActive: true }).sort({ price: 1 });

      this.logSuccess('Active tiers retrieved', { count: tiers.length });
      return tiers.map(tier => tier.toPublicObject());
    } catch (error) {
      this.logAndThrow(error, 'Get all active tiers');
    }
  }

  /**
   * Get all tiers (including inactive) - Admin only
   */
  async getAllTiers() {
    try {
      const tiers = await TierConfig.find().sort({ price: 1 });

      this.logSuccess('All tiers retrieved', { count: tiers.length });
      return tiers;
    } catch (error) {
      this.logAndThrow(error, 'Get all tiers');
    }
  }

  /**
   * Get tier by name
   */
  async getTierByName(name) {
    try {
      const tier = await TierConfig.findOne({ name: name.toLowerCase() });

      if (!tier) {
        throw new NotFoundError(`Tier not found: ${name}`);
      }

      this.logSuccess('Tier retrieved', { tierName: name });
      return tier;
    } catch (error) {
      this.logAndThrow(error, 'Get tier by name', { name });
    }
  }

  /**
   * Get tier by ID
   */
  async getTierById(tierId) {
    try {
      const tier = await TierConfig.findById(tierId);

      if (!tier) {
        throw new NotFoundError(`Tier not found with ID: ${tierId}`);
      }

      this.logSuccess('Tier retrieved by ID', { tierId });
      return tier;
    } catch (error) {
      this.logAndThrow(error, 'Get tier by ID', { tierId });
    }
  }

  /**
   * Get default (free) tier
   */
  async getDefaultTier() {
    try {
      const tier = await TierConfig.getDefaultTier();

      if (!tier) {
        throw new NotFoundError('Default tier (free) not found. Please run tier seeder.');
      }

      this.logSuccess('Default tier retrieved', { tierName: tier.name });
      return tier;
    } catch (error) {
      this.logAndThrow(error, 'Get default tier');
    }
  }

  /**
   * Create new tier configuration - Admin only
   */
  async createTier(tierData) {
    try {
      // Check if tier with same name already exists
      const existing = await TierConfig.findOne({ name: tierData.name.toLowerCase() });
      if (existing) {
        throw new ValidationError(`Tier with name '${tierData.name}' already exists`);
      }

      const tier = new TierConfig(tierData);
      await tier.save();

      this.logSuccess('Tier created', { tierName: tier.name, price: tier.price });
      return tier;
    } catch (error) {
      this.logAndThrow(error, 'Create tier', { tierData });
    }
  }

  /**
   * Update tier configuration - Admin only
   */
  async updateTier(name, updateData) {
    try {
      const tier = await this.getTierByName(name);

      // Prevent changing the tier name
      if (updateData.name && updateData.name !== tier.name) {
        throw new ValidationError('Cannot change tier name');
      }

      // Update allowed fields
      if (updateData.displayName) tier.displayName = updateData.displayName;
      if (updateData.limits) {
        if (updateData.limits.monthlyDuration !== undefined) {
          tier.limits.monthlyDuration = updateData.limits.monthlyDuration;
        }
        if (updateData.limits.maxFileSize !== undefined) {
          tier.limits.maxFileSize = updateData.limits.maxFileSize;
        }
      }
      if (updateData.features) tier.features = updateData.features;
      if (updateData.price !== undefined) tier.price = updateData.price;
      if (updateData.isActive !== undefined) tier.isActive = updateData.isActive;

      await tier.save();

      this.logSuccess('Tier updated', { tierName: name });
      return tier;
    } catch (error) {
      this.logAndThrow(error, 'Update tier', { name, updateData });
    }
  }

  /**
   * Deactivate tier - Admin only
   */
  async deactivateTier(name) {
    try {
      // Prevent deactivating free tier
      if (name.toLowerCase() === 'free') {
        throw new ValidationError('Cannot deactivate the free tier');
      }

      const tier = await this.getTierByName(name);
      tier.isActive = false;
      await tier.save();

      this.logSuccess('Tier deactivated', { tierName: name });
      return tier;
    } catch (error) {
      this.logAndThrow(error, 'Deactivate tier', { name });
    }
  }

  /**
   * Get tier limits for a user
   */
  async getTierLimits(userId) {
    try {
      const User = require('../../models/user.model');
      const user = await User.findById(userId).populate('tier');

      if (!user) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      if (!user.tier) {
        throw new NotFoundError(`User has no tier assigned. User ID: ${userId}`);
      }

      this.logSuccess('Tier limits retrieved', { userId, tierName: user.tier.name });
      return {
        tier: user.tier.name,
        limits: user.tier.limits,
        features: user.tier.features
      };
    } catch (error) {
      this.logAndThrow(error, 'Get tier limits', { userId });
    }
  }
}

module.exports = TierService;
