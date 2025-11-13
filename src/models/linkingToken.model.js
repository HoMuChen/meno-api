const mongoose = require('mongoose');

const linkingTokenSchema = new mongoose.Schema(
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
    token: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6,
      comment: '6-character alphanumeric code',
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient token lookup
linkingTokenSchema.index({ token: 1, provider: 1, used: 1 });

// TTL index to auto-delete expired tokens
linkingTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if token is expired
linkingTokenSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

// Method to check if token is valid (not expired and not used)
linkingTokenSchema.methods.isValid = function () {
  return !this.used && !this.isExpired();
};

// Method to mark token as used
linkingTokenSchema.methods.markAsUsed = async function () {
  this.used = true;
  this.usedAt = new Date();
  return this.save();
};

// Static method to generate a unique token
linkingTokenSchema.statics.generateToken = function () {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return token;
};

// Static method to create a new linking token
linkingTokenSchema.statics.createToken = async function (userId, provider) {
  let token;
  let attempts = 0;
  const maxAttempts = 10;

  // Try to generate a unique token
  while (attempts < maxAttempts) {
    token = this.generateToken();
    const existing = await this.findOne({ token, provider, used: false });
    if (!existing) break;
    attempts++;
  }

  if (attempts === maxAttempts) {
    throw new Error('Failed to generate unique token');
  }

  return this.create({
    userId,
    provider,
    token,
  });
};

// Static method to find and validate token
linkingTokenSchema.statics.findAndValidate = async function (token, provider) {
  const linkingToken = await this.findOne({
    token: token.toUpperCase(),
    provider,
    used: false,
  }).populate('userId');

  if (!linkingToken) {
    return { valid: false, error: 'Token not found or already used' };
  }

  if (linkingToken.isExpired()) {
    return { valid: false, error: 'Token expired' };
  }

  return { valid: true, linkingToken };
};

// Pre-save middleware to ensure token is uppercase
linkingTokenSchema.pre('save', function (next) {
  if (this.isModified('token')) {
    this.token = this.token.toUpperCase();
  }
  next();
});

const LinkingToken = mongoose.model('LinkingToken', linkingTokenSchema);

module.exports = LinkingToken;
