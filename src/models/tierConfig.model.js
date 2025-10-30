/**
 * TierConfig Model
 * MongoDB schema for subscription tier configurations
 */
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     TierConfig:
 *       type: object
 *       required:
 *         - name
 *         - displayName
 *         - limits
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated tier ID
 *         name:
 *           type: string
 *           enum: [free, plus, pro]
 *           description: Unique tier identifier
 *         displayName:
 *           type: string
 *           description: Human-readable tier name
 *         limits:
 *           type: object
 *           properties:
 *             monthlyDuration:
 *               type: number
 *               description: Monthly audio duration limit in seconds (-1 for unlimited)
 *             maxFileSize:
 *               type: number
 *               description: Maximum file size in bytes
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of feature flags enabled for this tier
 *         price:
 *           type: number
 *           description: Monthly price in cents (0 for free tier)
 *         isActive:
 *           type: boolean
 *           description: Whether this tier is currently available
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const tierConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tier name is required'],
      unique: true,
      lowercase: true,
      trim: true,
      enum: {
        values: ['free', 'plus', 'pro'],
        message: 'Tier name must be one of: free, plus, pro'
      }
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true
    },
    limits: {
      monthlyDuration: {
        type: Number,
        required: [true, 'Monthly duration limit is required'],
        validate: {
          validator: function(value) {
            return value === -1 || value > 0;
          },
          message: 'Monthly duration must be positive or -1 for unlimited'
        }
      },
      maxFileSize: {
        type: Number,
        required: [true, 'Max file size is required'],
        min: [1, 'Max file size must be at least 1 byte']
      }
    },
    features: {
      type: [String],
      default: ['basic_transcription']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
// Note: name already has unique index from field definition
tierConfigSchema.index({ isActive: 1 });

// Instance method to check if tier has unlimited duration
tierConfigSchema.methods.hasUnlimitedDuration = function() {
  return this.limits.monthlyDuration === -1;
};

// Instance method to check if user can upload given duration
tierConfigSchema.methods.canAccommodate = function(duration, fileSize) {
  const durationOk = this.hasUnlimitedDuration() || duration <= this.limits.monthlyDuration;
  const fileSizeOk = fileSize <= this.limits.maxFileSize;
  return durationOk && fileSizeOk;
};

// Instance method to get safe tier object for public API
tierConfigSchema.methods.toPublicObject = function() {
  return {
    name: this.name,
    displayName: this.displayName,
    limits: this.limits,
    features: this.features,
    price: this.price
  };
};

// Static method to get default (free) tier
tierConfigSchema.statics.getDefaultTier = async function() {
  return await this.findOne({ name: 'free', isActive: true });
};

// Static method to get all active tiers
tierConfigSchema.statics.getActiveTiers = async function() {
  return await this.find({ isActive: true }).sort({ price: 1 });
};

const TierConfig = mongoose.model('TierConfig', tierConfigSchema);

module.exports = TierConfig;
