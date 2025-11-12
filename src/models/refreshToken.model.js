const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  revoked: {
    type: Boolean,
    default: false
  },
  revokedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// TTL index to automatically delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for finding active tokens by user
refreshTokenSchema.index({ userId: 1, revoked: 1 });

// Instance method to check if token is valid
refreshTokenSchema.methods.isValid = function() {
  return !this.revoked && this.expiresAt > new Date();
};

// Static method to revoke token
refreshTokenSchema.statics.revokeToken = async function(token) {
  const refreshToken = await this.findOne({ token });
  if (refreshToken) {
    refreshToken.revoked = true;
    refreshToken.revokedAt = new Date();
    await refreshToken.save();
  }
  return refreshToken;
};

// Static method to revoke all user tokens
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  await this.updateMany(
    { userId, revoked: false },
    { revoked: true, revokedAt: new Date() }
  );
};

// Static method to clean up revoked tokens (optional cleanup)
refreshTokenSchema.statics.cleanupRevokedTokens = async function() {
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  await this.deleteMany({
    revoked: true,
    revokedAt: { $lt: cutoffDate }
  });
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
