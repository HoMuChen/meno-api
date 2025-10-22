/**
 * Transcription Service Factory
 * Factory pattern for selecting transcription provider based on environment configuration
 * Supports: mock, gemini
 */
const MockTranscriptionService = require('./mock-transcription.service');
const GeminiTranscriptionService = require('./gemini-transcription.service');

class TranscriptionServiceFactory {
  static instance = null;

  /**
   * Get transcription service instance (singleton pattern)
   * @param {Object} logger - Winston logger instance
   * @param {Object} transcriptionDataService - Transcription data service
   * @param {Object} meetingService - Meeting service
   * @returns {TranscriptionService} Transcription service instance
   */
  static getInstance(logger, transcriptionDataService = null, meetingService = null) {
    if (this.instance) {
      return this.instance;
    }

    const provider = process.env.TRANSCRIPTION_PROVIDER || 'mock';

    logger.info('Initializing transcription service', { provider });

    switch (provider.toLowerCase()) {
      case 'gemini':
        if (!transcriptionDataService || !meetingService) {
          logger.error('GeminiTranscriptionService requires transcriptionDataService and meetingService');
          throw new Error('GeminiTranscriptionService dependencies missing');
        }
        this.instance = new GeminiTranscriptionService(
          logger,
          transcriptionDataService,
          meetingService
        );
        break;

      case 'mock':
        this.instance = new MockTranscriptionService(logger);
        break;

      default:
        logger.warn('Unknown transcription provider, defaulting to mock', { provider });
        this.instance = new MockTranscriptionService(logger);
        break;
    }

    logger.info('Transcription service initialized', {
      provider,
      serviceClass: this.instance.constructor.name
    });

    return this.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance() {
    this.instance = null;
  }

  /**
   * Get current provider name
   * @returns {string} Provider name
   */
  static getProviderName() {
    return process.env.TRANSCRIPTION_PROVIDER || 'mock';
  }

  /**
   * Check if Gemini provider is configured
   * @returns {boolean} True if Gemini is configured
   */
  static isGeminiConfigured() {
    return (
      process.env.TRANSCRIPTION_PROVIDER === 'gemini' &&
      !!process.env.GEMINI_API_KEY
    );
  }

  /**
   * Validate provider configuration
   * @returns {Object} Validation result { valid: boolean, errors: Array }
   */
  static validateConfiguration() {
    const provider = process.env.TRANSCRIPTION_PROVIDER || 'mock';
    const errors = [];

    switch (provider.toLowerCase()) {
      case 'gemini':
        if (!process.env.GEMINI_API_KEY) {
          errors.push('GEMINI_API_KEY is required for gemini provider');
        }
        break;

      case 'mock':
        // No additional validation needed for mock
        break;

      default:
        errors.push(`Unknown provider: ${provider}. Supported: mock, gemini`);
        break;
    }

    return {
      valid: errors.length === 0,
      provider,
      errors
    };
  }
}

module.exports = TranscriptionServiceFactory;
