const BaseService = require('./base.service');
const Integration = require('../../models/integration.model');
const LinkingToken = require('../../models/linkingToken.model');
const User = require('../../models/user.model');
const { NotFoundError, ConflictError } = require('../../utils/errors');

/**
 * IntegrationService
 * Handles integration management, account linking, and integration settings
 */
class IntegrationService extends BaseService {
  constructor(logger, projectService) {
    super(logger);
    this.projectService = projectService;
  }

  /**
   * Generate a linking token for account connection
   * @param {string} userId - User ID
   * @param {string} provider - Integration provider (line, telegram, etc.)
   * @returns {Promise<Object>} Linking token data
   */
  async generateLinkingToken(userId, provider) {
    try {
      // Check if user already has this integration
      const existing = await Integration.findByUserAndProvider(userId, provider);
      if (existing && existing.status === 'active') {
        throw new ConflictError(`${provider} integration already linked to this account`);
      }

      // Generate linking token
      const linkingToken = await LinkingToken.createToken(userId, provider);

      this.logger.info('Linking token generated', {
        userId,
        provider,
        token: linkingToken.token,
        expiresAt: linkingToken.expiresAt,
      });

      return {
        token: linkingToken.token,
        expiresAt: linkingToken.expiresAt,
        provider,
      };
    } catch (error) {
      this.logAndThrow(error, 'Generate linking token', { userId, provider });
    }
  }

  /**
   * Check linking status
   * @param {string} userId - User ID
   * @param {string} provider - Integration provider
   * @returns {Promise<Object>} Linking status
   */
  async checkLinkingStatus(userId, provider) {
    try {
      const integration = await Integration.findByUserAndProvider(userId, provider);

      if (!integration) {
        return {
          status: 'not_linked',
          integration: null,
        };
      }

      return {
        status: integration.status === 'active' ? 'linked' : 'inactive',
        integration: integration.toJSON(),
      };
    } catch (error) {
      this.logAndThrow(error, 'Check linking status', { userId, provider });
    }
  }

  /**
   * Verify linking token and create integration
   * @param {string} token - Linking token
   * @param {string} provider - Integration provider
   * @param {Object} providerData - Provider-specific user data
   * @returns {Promise<Object>} Created integration
   */
  async verifyAndLinkIntegration(token, provider, providerData) {
    try {
      // Validate token
      const { valid, linkingToken, error } = await LinkingToken.findAndValidate(
        token,
        provider
      );

      if (!valid) {
        throw new Error(error || 'Invalid linking token');
      }

      const userId = linkingToken.userId._id || linkingToken.userId;

      // Check if provider ID is already linked to another account
      const existingIntegration = await Integration.findByProviderId(
        providerData.providerId,
        provider
      );

      if (existingIntegration) {
        throw new ConflictError(
          `This ${provider} account is already linked to another Meno account`
        );
      }

      // Create or update integration
      let integration = await Integration.findByUserAndProvider(userId, provider);

      if (integration) {
        // Update existing inactive integration
        integration.providerId = providerData.providerId;
        integration.providerData = providerData.userData || {};
        integration.status = 'active';
        await integration.save();
      } else {
        // Create new integration
        integration = await Integration.create({
          userId,
          provider,
          providerId: providerData.providerId,
          providerData: providerData.userData || {},
          status: 'active',
        });
      }

      // Update user integrations array
      await User.findByIdAndUpdate(userId, {
        $addToSet: {
          integrations: {
            provider,
            linkedAt: new Date(),
          },
        },
      });

      // Mark token as used
      await linkingToken.markAsUsed();

      // Get or create default project
      const defaultProject = await this.getOrCreateDefaultProject(userId, provider);
      integration.defaultProjectId = defaultProject._id;
      await integration.save();

      this.logger.info('Integration linked successfully', {
        userId,
        provider,
        providerId: providerData.providerId,
        defaultProjectId: defaultProject._id,
      });

      return integration.populate('defaultProjectId');
    } catch (error) {
      this.logAndThrow(error, 'Verify and link integration', { token, provider });
    }
  }

  /**
   * Get integration by user ID and provider
   * @param {string} userId - User ID
   * @param {string} provider - Integration provider
   * @returns {Promise<Object>} Integration data
   */
  async getIntegration(userId, provider) {
    try {
      const integration = await Integration.findByUserAndProvider(
        userId,
        provider
      ).populate('defaultProjectId');

      if (!integration) {
        throw new NotFoundError(`No ${provider} integration found`);
      }

      return integration.toJSON();
    } catch (error) {
      this.logAndThrow(error, 'Get integration', { userId, provider });
    }
  }

  /**
   * Get integration by provider ID
   * @param {string} providerId - Provider user ID
   * @param {string} provider - Integration provider
   * @returns {Promise<Object>} Integration data
   */
  async getIntegrationByProviderId(providerId, provider) {
    try {
      const integration = await Integration.findByProviderId(
        providerId,
        provider
      ).populate(['userId', 'defaultProjectId']);

      if (!integration) {
        return null;
      }

      return integration;
    } catch (error) {
      this.logAndThrow(error, 'Get integration by provider ID', { providerId, provider });
    }
  }

  /**
   * Update integration settings
   * @param {string} userId - User ID
   * @param {string} provider - Integration provider
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Updated integration
   */
  async updateSettings(userId, provider, settings) {
    try {
      const integration = await Integration.findByUserAndProvider(userId, provider);

      if (!integration) {
        throw new NotFoundError(`No ${provider} integration found`);
      }

      // Update settings
      if (settings.autoTranscribe !== undefined) {
        integration.settings.autoTranscribe = settings.autoTranscribe;
      }
      if (settings.notifyOnComplete !== undefined) {
        integration.settings.notifyOnComplete = settings.notifyOnComplete;
      }
      if (settings.defaultProjectId) {
        // Verify project exists and belongs to user
        const project = await this.projectService.getProjectById(
          settings.defaultProjectId,
          userId
        );
        integration.defaultProjectId = project._id;
      }

      await integration.save();

      this.logger.info('Integration settings updated', {
        userId,
        provider,
        settings,
      });

      return integration.populate('defaultProjectId');
    } catch (error) {
      this.logAndThrow(error, 'Update integration settings', { userId, provider, settings });
    }
  }

  /**
   * Unlink integration
   * @param {string} userId - User ID
   * @param {string} provider - Integration provider
   * @returns {Promise<Object>} Result
   */
  async unlinkIntegration(userId, provider) {
    try {
      const integration = await Integration.findByUserAndProvider(userId, provider);

      if (!integration) {
        throw new NotFoundError(`No ${provider} integration found`);
      }

      await integration.revoke();

      // Remove from user integrations array
      await User.findByIdAndUpdate(userId, {
        $pull: {
          integrations: { provider },
        },
      });

      this.logger.info('Integration unlinked', {
        userId,
        provider,
      });

      return {
        success: true,
        message: `${provider} integration unlinked successfully`,
      };
    } catch (error) {
      this.logAndThrow(error, 'Unlink integration', { userId, provider });
    }
  }

  /**
   * Get or create default project for integration
   * @param {string} userId - User ID
   * @param {string} provider - Integration provider
   * @returns {Promise<Object>} Default project
   */
  async getOrCreateDefaultProject(userId, provider) {
    try {
      const projectName = `${provider.toUpperCase()} Meetings`;

      // Check if project already exists
      const result = await this.projectService.getProjects(userId, { limit: 100 });
      const existingProject = result.projects.find((p) => p.name === projectName);

      if (existingProject) {
        return existingProject;
      }

      // Create new project
      const project = await this.projectService.createProject(
        userId,
        {
          name: projectName,
          description: `Meetings created from ${provider} integration`,
        }
      );

      this.logger.info('Default integration project created', {
        userId,
        provider,
        projectId: project._id,
      });

      return project;
    } catch (error) {
      this.logAndThrow(error, 'Get or create default project', { userId, provider });
    }
  }

  /**
   * List all active integrations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of integrations
   */
  async listUserIntegrations(userId) {
    try {
      const integrations = await Integration.find({
        userId,
        status: 'active',
      }).populate('defaultProjectId');

      return integrations.map((i) => i.toJSON());
    } catch (error) {
      this.logAndThrow(error, 'List user integrations', { userId });
    }
  }
}

module.exports = IntegrationService;
