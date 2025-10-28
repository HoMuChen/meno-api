/**
 * Request Logger Middleware
 * Logs incoming HTTP requests
 */
const jwt = require('jsonwebtoken');
const logger = require('../../components/logging');

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Try to extract userId from JWT if present
  let userId = null;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    }
  } catch (error) {
    // Silently ignore invalid/expired tokens for logging purposes
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: userId
    });
  });

  next();
};

module.exports = requestLogger;
