const BaseService = require('./base.service');
const path = require('path');
const fs = require('fs').promises;

/**
 * LineWebhookService
 * Handles LINE webhook events and audio processing
 */
class LineWebhookService extends BaseService {
  constructor(
    logger,
    lineService,
    integrationService,
    meetingService,
    audioStorageProvider,
    fileService
  ) {
    super(logger);
    this.lineService = lineService;
    this.integrationService = integrationService;
    this.meetingService = meetingService;
    this.audioStorageProvider = audioStorageProvider;
    this.fileService = fileService;
    this.autoTranscribe = process.env.AUTO_START_TRANSCRIPTION === 'true';
  }

  /**
   * Process LINE webhook events
   * @param {Array} events - LINE webhook events
   * @returns {Promise<void>}
   */
  async processEvents(events) {
    try {
      // Process events in parallel
      const promises = events.map((event) => this.handleEvent(event));
      await Promise.allSettled(promises);
    } catch (error) {
      this.logAndThrow(error, 'Process LINE events', { eventCount: events.length });
    }
  }

  /**
   * Handle a single LINE event
   * @param {Object} event - LINE webhook event
   * @returns {Promise<void>}
   */
  async handleEvent(event) {
    try {
      this.logger.info('Processing LINE event', {
        type: event.type,
        source: event.source,
      });

      switch (event.type) {
        case 'message':
          await this.handleMessage(event);
          break;
        case 'follow':
          await this.handleFollow(event);
          break;
        case 'unfollow':
          await this.handleUnfollow(event);
          break;
        default:
          this.logger.info('Unhandled event type', { type: event.type });
      }
    } catch (error) {
      this.logger.error('Handle event failed', {
        error: error.message,
        stack: error.stack,
        eventType: event.type
      });
      // Don't rethrow - we want to continue processing other events
    }
  }

  /**
   * Handle message events
   * @param {Object} event - LINE message event
   * @returns {Promise<void>}
   */
  async handleMessage(event) {
    const { replyToken, message, source } = event;
    const lineUserId = source.userId;

    try {
      // Get integration
      const integration = await this.integrationService.getIntegrationByProviderId(
        lineUserId,
        'line'
      );

      switch (message.type) {
        case 'audio':
          await this.handleAudioMessage(event, integration);
          break;
        case 'text':
          await this.handleTextMessage(event, integration);
          break;
        default:
          // Unsupported message type
          if (!integration) {
            await this.lineService.sendLinkingInstructions(replyToken);
          } else {
            await this.lineService.sendError(replyToken, 'unsupported_type');
          }
      }
    } catch (error) {
      this.logger.error('Handle message failed', {
        error: error.message,
        stack: error.stack,
        messageType: message?.type,
        lineUserId
      });
      // Don't try to reply here - the inner handlers already attempted to send error messages
      // Trying again would fail with "invalid reply token" since tokens are single-use
    }
  }

  /**
   * Handle audio message
   * @param {Object} event - LINE audio message event
   * @param {Object} integration - User's integration record
   * @returns {Promise<void>}
   */
  async handleAudioMessage(event, integration) {
    const { replyToken, message, source } = event;
    const lineUserId = source.userId;

    // Check if user is linked
    if (!integration) {
      await this.lineService.sendLinkingInstructions(replyToken);
      return;
    }

    const user = integration.userId;
    const userId = user._id || user.id;

    try {
      // Check tier limits
      const duration = message.duration ? message.duration / 1000 : 60; // Convert ms to seconds, estimate 60s if not provided
      const estimatedSize = duration * 32000; // Rough estimate: 32KB per second

      const canUpload = await user.canUploadFile(duration, estimatedSize);
      if (!canUpload) {
        await this.lineService.sendError(replyToken, 'usage_limit');
        return;
      }

      // Download audio from LINE
      this.logger.info('Downloading audio from LINE', {
        messageId: message.id,
        lineUserId,
      });

      const audioBuffer = await this.lineService.downloadContent(message.id);

      // Generate filename and path
      const timestamp = Date.now();
      const filename = `${timestamp}-line-audio.m4a`; // LINE typically sends M4A format
      const projectId = integration.defaultProjectId._id || integration.defaultProjectId;

      // Upload to storage
      const storagePath = `meetings/${projectId}/${filename}`;
      const storageResult = await this.audioStorageProvider.upload(
        storagePath,
        audioBuffer,
        {
          contentType: 'audio/m4a',
        }
      );

      // Extract URI string from storage result
      const storageUri = storageResult.uri;

      this.logger.info('Audio uploaded to storage', {
        storageUri,
        size: audioBuffer.length,
      });

      // Create meeting
      const meetingData = {
        title: `LINE Meeting - ${new Date().toLocaleString()}`,
        projectId,
        audioFile: storageUri,
        duration,
        recordingType: 'integration',
        metadata: {
          fileSize: audioBuffer.length,
          mimeType: 'audio/m4a',
          originalName: filename,
          integration: {
            provider: 'line',
            providerId: lineUserId,
            messageId: message.id,
            integrationId: integration._id,
          },
        },
      };

      // Prepare audioFile object to match meeting service signature
      const audioFileObj = {
        originalname: filename,
        mimetype: 'audio/m4a',
        size: audioBuffer.length,
        uri: storageUri,
        path: undefined, // No local path for LINE uploads
      };

      const meeting = await this.meetingService.createMeeting(
        projectId,
        userId,
        meetingData,
        audioFileObj
      );

      // Note: User usage is already updated by meetingService.createMeeting

      this.logger.info('Meeting created from LINE', {
        meetingId: meeting._id,
        userId,
        duration,
      });

      // Send success message with web link
      await this.lineService.sendMeetingCreated(replyToken, meeting);

      // Start transcription if auto-transcribe is enabled (fire-and-forget)
      // Don't await - let it run in background so user gets immediate response
      if (integration.settings.autoTranscribe && this.autoTranscribe) {
        this.meetingService.startTranscription(meeting._id.toString(), userId)
          .catch((transcriptionError) => {
            this.logger.error('Auto-transcription failed', {
              meetingId: meeting._id,
              error: transcriptionError.message,
              lineUserId,
            });
            // Don't try to reply - user already received success message
          });
      }
    } catch (error) {
      this.logger.error('Audio processing failed', {
        error: error.message,
        lineUserId,
        messageId: message.id,
      });

      // Try to send error message (only if meeting creation failed)
      try {
        await this.lineService.sendError(replyToken, 'processing_error', {
          message: error.message,
        });
      } catch (sendError) {
        this.logger.error('Failed to send error message to LINE', {
          error: sendError.message,
          lineUserId,
        });
      }
    }
  }

  /**
   * Handle text message (for linking codes and commands)
   * @param {Object} event - LINE text message event
   * @param {Object} integration - User's integration record
   * @returns {Promise<void>}
   */
  async handleTextMessage(event, integration) {
    const { replyToken, message, source } = event;
    const lineUserId = source.userId;
    const text = message.text.trim();

    // If already linked, provide help
    if (integration) {
      // Check for help command
      if (text.toLowerCase() === 'help' || text.toLowerCase() === '/help') {
        await this.lineService.sendHelp(replyToken);
        return;
      }

      // Unknown command
      await this.lineService.replyMessage(replyToken, {
        type: 'text',
        text: '🎙️ Send audio messages or files to create meetings.\n\nType "help" for more information.',
      });
      return;
    }

    // Not linked - check if this is a linking code
    const linkingCodePattern = /^[A-Z0-9]{6}$/;
    if (linkingCodePattern.test(text.toUpperCase())) {
      await this.processLinkingCode(text.toUpperCase(), lineUserId, replyToken);
      return;
    }

    // Not a linking code - send instructions
    await this.lineService.sendLinkingInstructions(replyToken);
  }

  /**
   * Process linking code
   * @param {string} code - 6-digit linking code
   * @param {string} lineUserId - LINE user ID
   * @param {string} replyToken - LINE reply token
   * @returns {Promise<void>}
   */
  async processLinkingCode(code, lineUserId, replyToken) {
    try {
      // Get LINE user profile
      const profile = await this.lineService.getProfile(lineUserId);

      // Verify and link integration
      const integration = await this.integrationService.verifyAndLinkIntegration(
        code,
        'line',
        {
          providerId: lineUserId,
          userData: {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage,
            language: profile.language,
          },
        }
      );

      const user = integration.userId;
      const userEmail = user.email || 'your account';

      this.logger.info('LINE account linked', {
        lineUserId,
        userId: user._id || user.id,
        displayName: profile.displayName,
      });

      await this.lineService.sendLinkingSuccess(replyToken, userEmail);
    } catch (error) {
      this.logger.error('Linking failed', {
        error: error.message,
        lineUserId,
        code,
      });

      await this.lineService.sendError(replyToken, 'invalid_token');
    }
  }

  /**
   * Handle follow event (user adds bot as friend)
   * @param {Object} event - LINE follow event
   * @returns {Promise<void>}
   */
  async handleFollow(event) {
    const { replyToken, source } = event;
    const lineUserId = source.userId;

    try {
      // Get user profile
      const profile = await this.lineService.getProfile(lineUserId);

      this.logger.info('New LINE follower', {
        lineUserId,
        displayName: profile.displayName,
      });

      // Send welcome message
      await this.lineService.sendWelcomeMessage(replyToken, profile.displayName);
    } catch (error) {
      this.logger.error('Handle follow failed', {
        error: error.message,
        lineUserId
      });
    }
  }

  /**
   * Handle unfollow event (user blocks or removes bot)
   * @param {Object} event - LINE unfollow event
   * @returns {Promise<void>}
   */
  async handleUnfollow(event) {
    const { source } = event;
    const lineUserId = source.userId;

    try {
      // Optionally deactivate integration (but don't delete it)
      const integration = await this.integrationService.getIntegrationByProviderId(
        lineUserId,
        'line'
      );

      if (integration) {
        await integration.deactivate();

        this.logger.info('Integration deactivated due to unfollow', {
          lineUserId,
          userId: integration.userId._id || integration.userId,
        });
      }
    } catch (error) {
      this.logger.error('Handle unfollow failed', {
        error: error.message,
        lineUserId
      });
    }
  }
}

module.exports = LineWebhookService;
