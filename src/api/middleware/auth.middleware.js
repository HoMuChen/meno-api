/**
 * Authentication Middleware
 * JWT-based authentication for protected routes
 */
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const logger = require('../../components/logging');

/**
 * Sanitize token for logging (show first/last 10 chars only)
 */
const sanitizeToken = (token) => {
  if (!token) return 'null';
  if (token.length <= 20) return '***';
  return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
};

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    logger.debug('Authentication attempt', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization
    });

    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug('Authentication failed: No token provided', {
        path: req.path,
        authHeader: authHeader ? 'present but invalid format' : 'missing'
      });

      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    logger.debug('Token extracted', {
      path: req.path,
      tokenPreview: sanitizeToken(token)
    });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    logger.debug('Token verified successfully', {
      userId: decoded.userId,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp
    });

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      logger.warn('Token valid but user not found', {
        userId: decoded.userId,
        email: decoded.email,
        path: req.path
      });

      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.debug('User retrieved from database', {
      userId: user._id,
      email: user.email,
      status: user.status,
      provider: user.provider
    });

    if (user.status !== 'active') {
      logger.warn('Inactive user attempted access', {
        userId: user._id,
        email: user.email,
        status: user.status,
        path: req.path
      });

      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Attach user to request
    req.user = user;

    logger.debug('Authentication successful', {
      userId: user._id,
      email: user.email,
      path: req.path
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', {
        error: error.message,
        path: req.path
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired JWT token', {
        error: error.message,
        expiredAt: error.expiredAt,
        path: req.path
      });

      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (user && user.status === 'active') {
      req.user = user;
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth
};
