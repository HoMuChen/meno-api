const express = require('express');
const { validateUpdateSettings } = require('../validators/integration.validator');

/**
 * Integration routes factory
 * @param {Object} integrationController - Integration controller instance
 * @returns {express.Router} Configured router
 */
const createIntegrationRoutes = (integrationController) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/integrations:
   *   get:
   *     summary: List all user integrations
   *     description: Get all active integrations for the authenticated user
   *     tags: [Integrations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Integrations retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     integrations:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Integration'
   *       401:
   *         description: Unauthorized
   */
  router.get('/', integrationController.listIntegrations.bind(integrationController));

  /**
   * @swagger
   * /api/integrations/line/link/initiate:
   *   post:
   *     summary: Generate LINE linking token
   *     description: Generate a 6-digit token to link a LINE account to the user's Meno account
   *     tags: [Integrations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Linking token generated successfully
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
   *                   example: Linking token generated successfully
   *                 data:
   *                   type: object
   *                   properties:
   *                     token:
   *                       type: string
   *                       example: AB1234
   *                       description: 6-character alphanumeric code to send to LINE bot
   *                     expiresAt:
   *                       type: string
   *                       format: date-time
   *                       description: Token expiration timestamp (5 minutes from creation)
   *                     provider:
   *                       type: string
   *                       example: line
   *       400:
   *         description: LINE integration already linked
   *       401:
   *         description: Unauthorized
   */
  router.post(
    '/line/link/initiate',
    integrationController.initiateLinking.bind(integrationController)
  );

  /**
   * @swagger
   * /api/integrations/line/link/status:
   *   get:
   *     summary: Check LINE linking status
   *     description: Poll to check if LINE account linking has been completed (for UI polling)
   *     tags: [Integrations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Linking status retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     status:
   *                       type: string
   *                       enum: [not_linked, linked, inactive]
   *                       description: Current integration status
   *                     integration:
   *                       $ref: '#/components/schemas/Integration'
   *                       nullable: true
   *       401:
   *         description: Unauthorized
   */
  router.get(
    '/line/link/status',
    integrationController.checkLinkingStatus.bind(integrationController)
  );

  /**
   * @swagger
   * /api/integrations/line:
   *   get:
   *     summary: Get LINE integration details
   *     description: Get details of the user's LINE integration
   *     tags: [Integrations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Integration details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/Integration'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: No LINE integration found
   */
  router.get('/line', integrationController.getIntegration.bind(integrationController));

  /**
   * @swagger
   * /api/integrations/line/settings:
   *   patch:
   *     summary: Update LINE integration settings
   *     description: Update settings for the user's LINE integration
   *     tags: [Integrations]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               autoTranscribe:
   *                 type: boolean
   *                 description: Automatically start transcription for uploaded audio
   *                 example: true
   *               notifyOnComplete:
   *                 type: boolean
   *                 description: Send notification when transcription completes
   *                 example: false
   *               defaultProjectId:
   *                 type: string
   *                 pattern: '^[0-9a-fA-F]{24}$'
   *                 description: Default project ID for meetings created via LINE
   *                 example: 507f1f77bcf86cd799439011
   *             minProperties: 1
   *     responses:
   *       200:
   *         description: Settings updated successfully
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
   *                   example: Settings updated successfully
   *                 data:
   *                   $ref: '#/components/schemas/Integration'
   *       400:
   *         description: Validation error or invalid project ID
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: No LINE integration found
   */
  router.patch(
    '/line/settings',
    validateUpdateSettings,
    integrationController.updateSettings.bind(integrationController)
  );

  /**
   * @swagger
   * /api/integrations/line:
   *   delete:
   *     summary: Unlink LINE integration
   *     description: Remove the LINE integration from the user's account
   *     tags: [Integrations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Integration unlinked successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     success:
   *                       type: boolean
   *                       example: true
   *                     message:
   *                       type: string
   *                       example: line integration unlinked successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: No LINE integration found
   */
  router.delete(
    '/line',
    integrationController.unlinkIntegration.bind(integrationController)
  );

  return router;
};

module.exports = createIntegrationRoutes;
