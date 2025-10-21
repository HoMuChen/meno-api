/**
 * Health Routes
 * URL routing for health check endpoints
 */
const express = require('express');

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Health check and monitoring endpoints
 */

const createHealthRoutes = (healthController) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the health status of the API server
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Server is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Server is healthy
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   example: 2024-01-15T10:30:00.000Z
   *                 uptime:
   *                   type: number
   *                   description: Server uptime in seconds
   *                   example: 3600
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/', healthController.healthCheck.bind(healthController));

  /**
   * @swagger
   * /api/health/ready:
   *   get:
   *     summary: Readiness check endpoint
   *     description: Returns the readiness status including database connectivity
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Server is ready
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Server is ready
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   example: 2024-01-15T10:30:00.000Z
   *                 database:
   *                   type: object
   *                   properties:
   *                     connected:
   *                       type: boolean
   *                       example: true
   *                     status:
   *                       type: string
   *                       example: connected
   *       503:
   *         description: Server not ready (database connection issues)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: Database not connected
   *                 database:
   *                   type: object
   *                   properties:
   *                     connected:
   *                       type: boolean
   *                       example: false
   *                     status:
   *                       type: string
   *                       example: disconnected
   */
  router.get('/ready', healthController.readinessCheck.bind(healthController));

  return router;
};

module.exports = createHealthRoutes;
