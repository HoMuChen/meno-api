/**
 * Transcription Service (Abstract Interface)
 * Base class for transcription service providers
 * Allows easy swapping between different transcription providers
 */

class TranscriptionService {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Transcribe audio file
   * @param {string} audioFilePath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Array>} Array of transcription segments
   *
   * Expected return format:
   * [
   *   {
   *     startTime: Number (milliseconds),
   *     endTime: Number (milliseconds),
   *     speaker: String (e.g., "Speaker 1"),
   *     text: String (transcribed text),
   *     confidence: Number (0-1, optional)
   *   }
   * ]
   */
  async transcribeAudio(audioFilePath, options = {}) {
    throw new Error('transcribeAudio() must be implemented by subclass');
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>} Supported MIME types
   */
  getSupportedFormats() {
    return [
      'audio/mpeg',      // MP3
      'audio/wav',       // WAV
      'audio/mp4',       // M4A
      'audio/webm',      // WebM
      'audio/ogg'        // OGG
    ];
  }

  /**
   * Validate audio file format
   * @param {string} mimeType - Audio file MIME type
   * @returns {boolean} Whether format is supported
   */
  isFormatSupported(mimeType) {
    return this.getSupportedFormats().includes(mimeType);
  }

  /**
   * Estimate transcription time
   * @param {number} audioDuration - Audio duration in seconds
   * @returns {number} Estimated transcription time in seconds
   */
  estimateTranscriptionTime(audioDuration) {
    // Default: roughly 1:1 ratio (can be overridden by implementations)
    return audioDuration;
  }
}

module.exports = TranscriptionService;
