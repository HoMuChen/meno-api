const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['line', 'telegram', 'whatsapp'],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
      comment: 'External provider user ID (e.g., LINE user ID)',
    },
    providerData: {
      displayName: String,
      pictureUrl: String,
      statusMessage: String,
      language: String,
    },
    accessToken: {
      type: String,
      select: false,
      comment: 'Encrypted access token (if applicable)',
    },
    refreshToken: {
      type: String,
      select: false,
      comment: 'Encrypted refresh token (if applicable)',
    },
    tokenExpiresAt: {
      type: Date,
      comment: 'Token expiration timestamp',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'revoked'],
      default: 'active',
      index: true,
    },
    defaultProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      comment: 'Default project for meetings created via this integration',
    },
    settings: {
      autoTranscribe: {
        type: Boolean,
        default: true,
        comment: 'Automatically start transcription for uploaded audio',
      },
      notifyOnComplete: {
        type: Boolean,
        default: false,
        comment: 'Send notification when transcription completes',
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.accessToken;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

// Compound indexes
integrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
integrationSchema.index({ providerId: 1, provider: 1 }, { unique: true });
integrationSchema.index({ userId: 1, status: 1 });

// Virtual for checking if integration is active
integrationSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

// Method to check if token is expired
integrationSchema.methods.isTokenExpired = function () {
  if (!this.tokenExpiresAt) return false;
  return new Date() > this.tokenExpiresAt;
};

// Method to deactivate integration
integrationSchema.methods.deactivate = async function () {
  this.status = 'inactive';
  return this.save();
};

// Method to revoke integration
integrationSchema.methods.revoke = async function () {
  this.status = 'revoked';
  this.accessToken = null;
  this.refreshToken = null;
  return this.save();
};

// Static method to find active integration by provider ID
integrationSchema.statics.findByProviderId = function (providerId, provider) {
  return this.findOne({
    providerId,
    provider,
    status: 'active',
  }).populate('defaultProjectId');
};

// Static method to find user's integration by provider
integrationSchema.statics.findByUserAndProvider = function (userId, provider) {
  return this.findOne({
    userId,
    provider,
  }).populate('defaultProjectId');
};

// Pre-save middleware to validate token expiration
integrationSchema.pre('save', function (next) {
  if (this.isModified('accessToken') && !this.tokenExpiresAt) {
    // If token is set but no expiration, set a default (e.g., 30 days)
    this.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

const Integration = mongoose.model('Integration', integrationSchema);

module.exports = Integration;
