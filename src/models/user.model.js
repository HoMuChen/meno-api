/**
 * User Model
 * MongoDB schema for user data
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const TierConfig = require('./tierConfig.model');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated user ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email (unique)
 *         name:
 *           type: string
 *           description: User full name
 *         password:
 *           type: string
 *           format: password
 *           description: User password (only for email/password auth)
 *         provider:
 *           type: string
 *           enum: [email, google]
 *           description: Authentication provider
 *         googleId:
 *           type: string
 *           description: Google OAuth ID
 *         avatar:
 *           type: string
 *           description: Avatar file path
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *           description: User account status
 *         tier:
 *           type: string
 *           description: Reference to user's subscription tier
 *         tierStartDate:
 *           type: string
 *           format: date-time
 *           description: When the current tier started
 *         currentMonthUsage:
 *           type: object
 *           properties:
 *             duration:
 *               type: number
 *               description: Cached total duration used this month (seconds)
 *             lastReset:
 *               type: string
 *               format: date-time
 *               description: When the usage cache was last reset
 *             month:
 *               type: number
 *               description: Month this cache is for (1-12)
 *             year:
 *               type: number
 *               description: Year this cache is for
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    password: {
      type: String,
      required: function() {
        return this.provider === 'email';
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Don't include password in queries by default
    },
    provider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email'
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true // Allows multiple null values
    },
    avatar: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    },
    tier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TierConfig',
      required: true
    },
    tierStartDate: {
      type: Date,
      default: Date.now
    },
    currentMonthUsage: {
      duration: {
        type: Number,
        default: 0,
        min: [0, 'Duration cannot be negative']
      },
      lastReset: {
        type: Date,
        default: Date.now
      },
      month: {
        type: Number,
        min: 1,
        max: 12,
        default: function() {
          return new Date().getUTCMonth() + 1;
        }
      },
      year: {
        type: Number,
        default: function() {
          return new Date().getUTCFullYear();
        }
      }
    },
    integrations: [
      {
        provider: {
          type: String,
          enum: ['line', 'telegram', 'whatsapp']
        },
        linkedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
// Note: email and googleId already have unique indexes from field definitions
userSchema.index({ createdAt: -1 });
userSchema.index({ tier: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's new or modified
  if (!this.isModified('password')) {
    return next();
  }

  // Only hash if password exists (not for OAuth users)
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get safe user object (without sensitive data)
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.password;
  return obj;
};

// Instance method to check if usage cache needs reset
userSchema.methods.needsUsageReset = function() {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  return (
    this.currentMonthUsage.month !== currentMonth ||
    this.currentMonthUsage.year !== currentYear
  );
};

// Instance method to reset monthly usage cache
userSchema.methods.resetMonthlyUsage = function() {
  const now = new Date();
  this.currentMonthUsage.duration = 0;
  this.currentMonthUsage.lastReset = now;
  this.currentMonthUsage.month = now.getUTCMonth() + 1;
  this.currentMonthUsage.year = now.getUTCFullYear();
};

// Instance method to add usage to cache
userSchema.methods.addUsage = function(durationInSeconds) {
  // Reset cache if we're in a new month
  if (this.needsUsageReset()) {
    this.resetMonthlyUsage();
  }

  this.currentMonthUsage.duration += durationInSeconds;
};

// Instance method to get remaining duration quota
userSchema.methods.getRemainingDuration = async function() {
  // Ensure tier is populated
  await this.populate('tier');

  // Check if usage cache needs reset
  if (this.needsUsageReset()) {
    this.resetMonthlyUsage();
  }

  // Unlimited tier
  if (this.tier.limits.monthlyDuration === -1) {
    return -1; // Unlimited
  }

  const remaining = this.tier.limits.monthlyDuration - this.currentMonthUsage.duration;
  return Math.max(0, remaining);
};

// Instance method to check if user can upload file
userSchema.methods.canUploadFile = async function(durationInSeconds, fileSizeInBytes) {
  // Ensure tier is populated
  await this.populate('tier');

  // Check if usage cache needs reset
  if (this.needsUsageReset()) {
    this.resetMonthlyUsage();
  }

  // Check file size
  if (fileSizeInBytes > this.tier.limits.maxFileSize) {
    return {
      allowed: false,
      reason: 'file_size_exceeded',
      limit: this.tier.limits.maxFileSize,
      current: fileSizeInBytes
    };
  }

  // Check duration limit (skip if unlimited)
  if (this.tier.limits.monthlyDuration !== -1) {
    const totalUsage = this.currentMonthUsage.duration + durationInSeconds;
    if (totalUsage > this.tier.limits.monthlyDuration) {
      return {
        allowed: false,
        reason: 'duration_limit_exceeded',
        limit: this.tier.limits.monthlyDuration,
        current: this.currentMonthUsage.duration,
        requested: durationInSeconds
      };
    }
  }

  return {
    allowed: true,
    remaining: this.tier.limits.monthlyDuration === -1
      ? -1
      : this.tier.limits.monthlyDuration - this.currentMonthUsage.duration
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
