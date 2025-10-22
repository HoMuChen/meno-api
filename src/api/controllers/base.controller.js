/**
 * Base Controller
 * Provides common controller functionality and error handling
 */
const { success, created, paginated } = require('../../utils/responses');

class BaseController {
  constructor(service, logger) {
    this.service = service;
    this.logger = logger;
  }

  /**
   * Async handler wrapper with error handling
   * @param {Function} fn - Async function to wrap
   * @returns {Function} Express middleware function
   */
  asyncHandler = (fn) => {
    return async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Extract pagination parameters from request
   * @param {Object} req - Express request object
   * @returns {Object} Pagination parameters
   */
  getPaginationParams(req) {
    return {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
  }

  /**
   * Get user ID from authenticated request
   * @param {Object} req - Express request object
   * @returns {string} User ID
   */
  getUserId(req) {
    return req.user?._id || req.user?.id;
  }

  /**
   * Send success response
   */
  sendSuccess(res, data, message = 'Success') {
    return success(res, data, message);
  }

  /**
   * Send created response
   */
  sendCreated(res, data, message = 'Resource created successfully') {
    return created(res, data, message);
  }

  /**
   * Send paginated response
   */
  sendPaginated(res, data, page, limit, total) {
    return paginated(res, data, page, limit, total);
  }
}

module.exports = BaseController;
