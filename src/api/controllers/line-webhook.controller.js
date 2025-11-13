const BaseController = require('./base.controller');

/**
 * LineWebhookController
 * Handles LINE webhook callbacks
 */
class LineWebhookController extends BaseController {
  constructor(logger, lineWebhookService) {
    super(lineWebhookService, logger);
    this.lineWebhookService = lineWebhookService;
  }

  /**
   * Handle LINE webhook callback
   * POST /webhooks/line/callback
   */
  handleWebhook = this.asyncHandler(async (req, res) => {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }

    this.logger.info('Received LINE webhook', {
      eventCount: events.length,
    });

    // Process events asynchronously (don't wait for completion)
    // LINE requires a quick 200 response
    this.lineWebhookService.processEvents(events).catch((error) => {
      this.logger.error('LINE webhook processing error', {
        error: error.message,
        stack: error.stack,
      });
    });

    // Return 200 OK immediately (LINE requirement)
    return res.status(200).json({ message: 'Webhook received' });
  });

  /**
   * Handle LINE webhook verification
   * GET /webhooks/line/callback
   */
  verifyWebhook = this.asyncHandler(async (req, res) => {
    // LINE webhook verification endpoint
    // Return 200 OK for verification requests
    return this.sendSuccess(res, { message: 'Webhook endpoint verified' });
  });
}

module.exports = LineWebhookController;
