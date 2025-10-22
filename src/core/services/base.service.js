/**
 * Base Service
 * Provides common service functionality
 */

class BaseService {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Create pagination parameters
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @returns {Object} Skip and limit for database query
   */
  getPaginationParams(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return { skip, limit: parseInt(limit) };
  }

  /**
   * Create pagination result
   * @param {Array} items - Items for current page
   * @param {number} total - Total number of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @returns {Object} Paginated result
   */
  createPaginatedResult(items, total, page, limit) {
    return {
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    };
  }

  /**
   * Log and rethrow error
   * @param {Error} error - Error object
   * @param {string} operation - Operation that failed
   * @param {Object} context - Additional context
   */
  logAndThrow(error, operation, context = {}) {
    this.logger.error(`${operation} failed`, {
      error: error.message,
      stack: error.stack,
      ...context
    });
    throw error;
  }

  /**
   * Log success operation
   * @param {string} operation - Operation that succeeded
   * @param {Object} context - Additional context
   */
  logSuccess(operation, context = {}) {
    this.logger.info(operation, context);
  }
}

module.exports = BaseService;
