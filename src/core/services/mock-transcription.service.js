/**
 * Mock Transcription Service
 * Mock implementation for development and testing
 * Generates realistic transcription data with speaker diarization
 */
const TranscriptionService = require('./transcription.service');

class MockTranscriptionService extends TranscriptionService {
  constructor(logger) {
    super(logger);
    this.processingDelay = parseInt(process.env.MOCK_TRANSCRIPTION_DELAY) || 5000;
  }

  /**
   * Mock transcribe audio file
   * Simulates async transcription with realistic data
   * @param {string} audioFilePath - Path to audio file
   * @param {string} meetingId - Meeting ID (optional, for compatibility)
   * @param {Object} options - Transcription options
   * @returns {Promise<Array>} Array of mock transcription segments
   */
  async transcribeAudio(audioFilePath, meetingId = null, options = {}) {
    // Handle both old signature (audioFilePath, options) and new signature (audioFilePath, meetingId, options)
    if (typeof meetingId === 'object' && meetingId !== null) {
      // Old signature: meetingId is actually options
      options = meetingId;
      meetingId = null;
    }

    this.logger.info('Starting mock transcription', {
      audioFilePath,
      meetingId,
      delay: this.processingDelay,
      optionsType: typeof options,
      optionsKeys: options ? Object.keys(options) : []
    });

    try {
      // Simulate processing delay
      this.logger.debug('Simulating processing delay', { delay: this.processingDelay });
      await this._simulateProcessing(this.processingDelay);

      // Generate mock transcription segments
      this.logger.debug('Generating mock segments', { options });
      const segments = this._generateMockSegments(options);

      this.logger.info('Mock transcription completed', {
        audioFilePath,
        meetingId,
        segmentsCount: segments.length
      });

      return segments;
    } catch (err) {
      // Use console.error as fallback in case logger has issues
      console.error('Mock transcription error:', err);

      this.logger.error('Mock transcription error', {
        errorMessage: err && err.message ? err.message : String(err),
        errorStack: err && err.stack ? err.stack : 'No stack trace',
        errorType: typeof err,
        audioFilePath,
        meetingId
      });
      throw err;
    }
  }

  /**
   * Simulate async processing delay
   * @param {number} delay - Delay in milliseconds
   */
  async _simulateProcessing(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate realistic mock transcription segments
   * @param {Object} options - Generation options
   * @returns {Array} Mock transcription segments
   */
  _generateMockSegments(options = {}) {
    const { segmentCount = 15 } = options;

    const mockDialogue = [
      "Good morning everyone, let's start today's meeting.",
      "Thanks for joining. I'd like to begin by reviewing our progress from last week.",
      "We completed the user authentication feature and deployed it to staging.",
      "That's great progress. Were there any issues during deployment?",
      "No major issues. We did encounter a minor bug with password validation, but it's been fixed.",
      "Excellent. What about the database migration?",
      "The migration went smoothly. All user data has been transferred successfully.",
      "Perfect. Let's move on to this week's priorities.",
      "Our main focus will be implementing the notification system.",
      "I'll be working on the email notification templates.",
      "I can handle the push notification integration.",
      "Sounds good. We should also address the performance issues in the dashboard.",
      "I've identified the bottleneck. It's related to the data aggregation queries.",
      "Can you optimize those queries this week?",
      "Yes, I'll have that done by Wednesday.",
      "Great. Any blockers or concerns we should discuss?",
      "I need access to the production database for testing.",
      "I'll arrange that with DevOps today.",
      "Thanks. I think that covers everything on my end.",
      "Perfect. Let's reconvene on Friday to check progress."
    ];

    const speakers = ['Speaker 1', 'Speaker 2', 'Speaker 3'];
    const segments = [];
    let currentTime = 0;

    const count = Math.min(segmentCount, mockDialogue.length);

    for (let i = 0; i < count; i++) {
      const text = mockDialogue[i];
      const speaker = speakers[i % speakers.length];

      // Calculate duration based on text length (roughly 150 words per minute)
      const wordCount = text.split(' ').length;
      const durationMs = Math.floor((wordCount / 150) * 60 * 1000);

      // Add some variance (±20%)
      const variance = durationMs * 0.2;
      const actualDuration = durationMs + (Math.random() * variance * 2 - variance);

      const segment = {
        startTime: currentTime,
        endTime: currentTime + Math.floor(actualDuration),
        speaker,
        text,
        confidence: this._generateConfidence()
      };

      segments.push(segment);
      currentTime = segment.endTime;
    }

    return segments;
  }

  /**
   * Generate realistic confidence score
   * @returns {number} Confidence score between 0.85 and 0.98
   */
  _generateConfidence() {
    // Generate confidence between 0.85 and 0.98
    return parseFloat((0.85 + Math.random() * 0.13).toFixed(2));
  }

  /**
   * Estimate transcription time (mock returns quickly)
   * @param {number} audioDuration - Audio duration in seconds
   * @returns {number} Estimated time in seconds
   */
  estimateTranscriptionTime(audioDuration) {
    // Mock transcription is much faster (delay / 1000)
    return this.processingDelay / 1000;
  }
}

module.exports = MockTranscriptionService;
