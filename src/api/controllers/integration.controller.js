const BaseController = require('./base.controller');

/**
 * IntegrationController
 * Handles HTTP requests for integration management
 */
class IntegrationController extends BaseController {
  constructor(logger, integrationService) {
    super(integrationService, logger);
    this.integrationService = integrationService;
  }

  /**
   * Initiate LINE account linking (generate token)
   * POST /api/integrations/line/link/initiate
   */
  initiateLinking = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const provider = 'line';

    const result = await this.integrationService.generateLinkingToken(userId, provider);

    return this.sendCreated(res, result, 'Linking token generated successfully');
  });

  /**
   * Check LINE linking status (polling endpoint)
   * GET /api/integrations/line/link/status
   */
  checkLinkingStatus = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const provider = 'line';

    const result = await this.integrationService.checkLinkingStatus(userId, provider);

    return this.sendSuccess(res, result);
  });

  /**
   * Get LINE integration details
   * GET /api/integrations/line
   */
  getIntegration = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const provider = 'line';

    const integration = await this.integrationService.getIntegration(userId, provider);

    return this.sendSuccess(res, integration);
  });

  /**
   * Update LINE integration settings
   * PATCH /api/integrations/line/settings
   */
  updateSettings = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const provider = 'line';
    const settings = req.body;

    const updatedIntegration = await this.integrationService.updateSettings(
      userId,
      provider,
      settings
    );

    return this.sendSuccess(res, updatedIntegration, 'Settings updated successfully');
  });

  /**
   * Unlink LINE integration
   * DELETE /api/integrations/line
   */
  unlinkIntegration = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const provider = 'line';

    const result = await this.integrationService.unlinkIntegration(userId, provider);

    return this.sendSuccess(res, result);
  });

  /**
   * List all user integrations
   * GET /api/integrations
   */
  listIntegrations = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);

    const integrations = await this.integrationService.listUserIntegrations(userId);

    return this.sendSuccess(res, { integrations });
  });
}

module.exports = IntegrationController;
