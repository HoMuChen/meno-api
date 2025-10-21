/**
 * Health Controller
 * Health check and system status endpoints
 */
const { getHealthStatus } = require('../../components/database');
const { success } = require('../../utils/responses');

class HealthController {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Health check endpoint
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   */
  async healthCheck(req, res, next) {
    try {
      const dbHealth = getHealthStatus();

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        }
      };

      return success(res, health, 'Service is healthy');
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/health/ready:
   *   get:
   *     summary: Readiness check
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is ready
   */
  async readinessCheck(req, res, next) {
    try {
      const dbHealth = getHealthStatus();

      if (dbHealth.status !== 'connected') {
        return res.status(503).json({
          success: false,
          message: 'Service not ready',
          database: dbHealth
        });
      }

      return success(res, { ready: true }, 'Service is ready');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = HealthController;
