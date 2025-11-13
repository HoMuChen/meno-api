const BaseService = require('./base.service');
const line = require('@line/bot-sdk');
const messageBuilder = require('../utils/line-message-builder');

/**
 * LineService
 * Handles LINE Message API operations
 */
class LineService extends BaseService {
  constructor(logger) {
    super(logger);

    // Initialize LINE client
    this.client = new line.Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    });

    this.webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
  }

  /**
   * Reply to a message using replyToken
   * @param {string} replyToken - LINE reply token from webhook event
   * @param {Object|Array} messages - LINE message object(s)
   * @returns {Promise<void>}
   */
  async replyMessage(replyToken, messages) {
    try {
      const messageArray = Array.isArray(messages) ? messages : [messages];

      await this.client.replyMessage(replyToken, messageArray);

      this.logger.info('LINE reply sent', {
        replyToken,
        messageCount: messageArray.length,
      });
    } catch (error) {
      this.logAndThrow(error, 'LINE reply message', { replyToken });
    }
  }

  /**
   * Push message to a LINE user
   * @param {string} lineUserId - LINE user ID
   * @param {Object|Array} messages - LINE message object(s)
   * @returns {Promise<void>}
   */
  async pushMessage(lineUserId, messages) {
    try {
      const messageArray = Array.isArray(messages) ? messages : [messages];

      await this.client.pushMessage(lineUserId, messageArray);

      this.logger.info('LINE push message sent', {
        lineUserId,
        messageCount: messageArray.length,
      });
    } catch (error) {
      this.logAndThrow(error, 'LINE push message', { lineUserId });
    }
  }

  /**
   * Get LINE user profile
   * @param {string} lineUserId - LINE user ID
   * @returns {Promise<Object>} User profile (displayName, userId, pictureUrl, statusMessage, language)
   */
  async getProfile(lineUserId) {
    try {
      const profile = await this.client.getProfile(lineUserId);

      this.logger.info('LINE profile retrieved', {
        lineUserId: profile.userId,
        displayName: profile.displayName,
      });

      return profile;
    } catch (error) {
      this.logAndThrow(error, 'LINE get profile', { lineUserId });
    }
  }

  /**
   * Download message content (audio, image, video)
   * @param {string} messageId - LINE message ID
   * @returns {Promise<Buffer>} Content buffer
   */
  async downloadContent(messageId) {
    try {
      const stream = await this.client.getMessageContent(messageId);

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      this.logger.info('LINE content downloaded', {
        messageId,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      this.logAndThrow(error, 'LINE download content', { messageId });
    }
  }

  /**
   * Send welcome message to new user
   * @param {string} replyToken - LINE reply token
   * @param {string} userName - User's display name
   * @returns {Promise<void>}
   */
  async sendWelcomeMessage(replyToken, userName) {
    const message = messageBuilder.buildWelcomeMessage(userName);
    return this.replyMessage(replyToken, message);
  }

  /**
   * Send linking instructions
   * @param {string} replyToken - LINE reply token
   * @returns {Promise<void>}
   */
  async sendLinkingInstructions(replyToken) {
    const message = messageBuilder.buildLinkingInstructions();
    return this.replyMessage(replyToken, message);
  }

  /**
   * Send linking success message
   * @param {string} replyToken - LINE reply token
   * @param {string} userEmail - Linked user's email
   * @returns {Promise<void>}
   */
  async sendLinkingSuccess(replyToken, userEmail) {
    const message = messageBuilder.buildLinkingSuccessMessage(userEmail);
    return this.replyMessage(replyToken, message);
  }

  /**
   * Send meeting created message
   * @param {string} replyToken - LINE reply token
   * @param {Object} meeting - Meeting object
   * @returns {Promise<void>}
   */
  async sendMeetingCreated(replyToken, meeting) {
    const message = messageBuilder.buildMeetingCreatedMessage(
      meeting,
      this.webAppUrl
    );
    return this.replyMessage(replyToken, message);
  }

  /**
   * Send error message
   * @param {string} replyToken - LINE reply token
   * @param {string} errorType - Error type
   * @param {Object} details - Additional error details
   * @returns {Promise<void>}
   */
  async sendError(replyToken, errorType, details = {}) {
    const message = messageBuilder.buildErrorMessage(errorType, {
      ...details,
      webAppUrl: this.webAppUrl,
    });
    return this.replyMessage(replyToken, message);
  }

  /**
   * Send transcription complete notification
   * @param {string} lineUserId - LINE user ID
   * @param {Object} meeting - Meeting object
   * @returns {Promise<void>}
   */
  async sendTranscriptionComplete(lineUserId, meeting) {
    const message = messageBuilder.buildTranscriptionCompleteMessage(
      meeting,
      this.webAppUrl
    );
    return this.pushMessage(lineUserId, message);
  }

  /**
   * Send help message
   * @param {string} replyToken - LINE reply token
   * @returns {Promise<void>}
   */
  async sendHelp(replyToken) {
    const message = messageBuilder.buildHelpMessage();
    return this.replyMessage(replyToken, message);
  }

  /**
   * Validate LINE signature
   * @param {string} body - Request body string
   * @param {string} signature - X-Line-Signature header value
   * @returns {boolean} True if signature is valid
   */
  validateSignature(body, signature) {
    try {
      return line.validateSignature(
        body,
        process.env.LINE_CHANNEL_SECRET,
        signature
      );
    } catch (error) {
      this.logger.error('LINE signature validation error', { error });
      return false;
    }
  }
}

module.exports = LineService;
