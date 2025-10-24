/**
 * Tier Limit Middleware
 * Validates usage limits before file uploads
 */
const User = require('../../models/user.model');
const logger = require('../../components/logger');

/**
 * Check if user can upload file based on tier limits
 * Expects req.user to be populated by auth middleware
 * Expects req.body.duration (in seconds) and req.file.size (in bytes)
 */
const checkUsageLimit = async (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get duration from request body (should be provided by client)
    const duration = parseInt(req.body.duration) || 0;

    // Get file size (will be available after multer processes the upload)
    // Note: This middleware should run AFTER multer
    const fileSize = req.file ? req.file.size : 0;

    if (!duration) {
      return res.status(400).json({
        success: false,
        message: 'Audio duration is required'
      });
    }

    // Fetch user with tier info
    const user = await User.findById(req.user._id).populate('tier');

    if (!user || !user.tier) {
      return res.status(500).json({
        success: false,
        message: 'User tier configuration not found'
      });
    }

    // Check if user can upload
    const validation = await user.canUploadFile(duration, fileSize);

    if (!validation.allowed) {
      const errorMessages = {
        file_size_exceeded: `File size exceeds your tier limit of ${Math.round(validation.limit / 1024 / 1024)} MB`,
        duration_limit_exceeded: `Monthly duration limit exceeded. You've used ${Math.round(validation.current / 60)} of ${Math.round(validation.limit / 60)} minutes this month.`
      };

      logger.warn('Upload rejected - tier limit exceeded', {
        userId: user._id,
        reason: validation.reason,
        tier: user.tier.name,
        currentUsage: validation.current,
        limit: validation.limit
      });

      return res.status(403).json({
        success: false,
        message: errorMessages[validation.reason] || 'Upload limit exceeded',
        error: {
          code: validation.reason,
          limit: validation.limit,
          current: validation.current || validation.limit,
          tier: user.tier.name,
          upgradeRequired: true
        }
      });
    }

    // Attach validation result to request for use in controller
    req.tierValidation = validation;

    logger.info('Tier limit check passed', {
      userId: user._id,
      tier: user.tier.name,
      duration,
      fileSize,
      remaining: validation.remaining
    });

    next();
  } catch (error) {
    logger.error('Tier limit check failed', {
      error: error.message,
      userId: req.user?._id
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to validate tier limits',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check file size limit dynamically based on user tier
 * This can be used as multer fileFilter
 */
const checkFileSizeLimit = async (req, file, cb) => {
  try {
    if (!req.user) {
      return cb(new Error('Authentication required'), false);
    }

    const user = await User.findById(req.user._id).populate('tier');

    if (!user || !user.tier) {
      return cb(new Error('User tier not found'), false);
    }

    // Multer will check file size, but we set the limit here
    req.tierMaxFileSize = user.tier.limits.maxFileSize;

    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

module.exports = {
  checkUsageLimit,
  checkFileSizeLimit
};
