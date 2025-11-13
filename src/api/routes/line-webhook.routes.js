const express = require('express');
const verifyLineSignature = require('../middleware/line-signature.middleware');
const { validateLineWebhook } = require('../validators/integration.validator');

/**
 * LINE webhook routes factory
 * @param {Object} lineWebhookController - LINE webhook controller instance
 * @returns {express.Router} Configured router
 */
const createLineWebhookRoutes = (lineWebhookController) => {
  const router = express.Router();

  /**
   * @swagger
   * /webhooks/line/callback:
   *   get:
   *     summary: LINE webhook verification endpoint
   *     description: Verification endpoint for LINE webhook setup (used by LINE platform)
   *     tags: [Webhooks]
   *     responses:
   *       200:
   *         description: Webhook endpoint verified
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
   *                     message:
   *                       type: string
   *                       example: Webhook endpoint verified
   */
  router.get(
    '/callback',
    lineWebhookController.verifyWebhook.bind(lineWebhookController)
  );

  /**
   * @swagger
   * /webhooks/line/callback:
   *   post:
   *     summary: LINE webhook callback endpoint
   *     description: Receives webhook events from LINE platform (messages, follows, unfollows). Signature is automatically verified.
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               destination:
   *                 type: string
   *                 description: Bot user ID
   *                 example: U1234567890abcdef
   *               events:
   *                 type: array
   *                 description: Array of webhook events
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [message, follow, unfollow]
   *                       description: Event type
   *                     timestamp:
   *                       type: number
   *                       description: Event timestamp (milliseconds)
   *                     source:
   *                       type: object
   *                       properties:
   *                         type:
   *                           type: string
   *                           example: user
   *                         userId:
   *                           type: string
   *                           example: U1234567890abcdef
   *                     replyToken:
   *                       type: string
   *                       description: Token for replying to this event
   *                     message:
   *                       type: object
   *                       description: Message content (for message events)
   *                       properties:
   *                         id:
   *                           type: string
   *                           description: Message ID
   *                         type:
   *                           type: string
   *                           enum: [text, audio, image, video]
   *                         text:
   *                           type: string
   *                           description: Text content (for text messages)
   *                         duration:
   *                           type: number
   *                           description: Audio duration in milliseconds (for audio messages)
   *     responses:
   *       200:
   *         description: Webhook received and queued for processing
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Webhook received
   *       400:
   *         description: Invalid webhook payload
   *       401:
   *         description: Invalid LINE signature
   */
  router.post(
    '/callback',
    express.json({
      verify: (req, res, buf) => {
        // Store raw body for signature verification
        req.rawBody = buf.toString('utf8');
      },
    }),
    verifyLineSignature,
    validateLineWebhook,
    lineWebhookController.handleWebhook.bind(lineWebhookController)
  );

  return router;
};

module.exports = createLineWebhookRoutes;
