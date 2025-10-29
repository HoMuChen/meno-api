/**
 * Transcription Data Service
 * Database operations for transcription segments
 */
const Transcription = require('../../models/transcription.model');
const BaseService = require('./base.service');

class TranscriptionDataService extends BaseService {
  constructor(logger, embeddingService = null) {
    super(logger);
    this.embeddingService = embeddingService;
  }

  /**
   * Save transcription segments to database
   * @param {string} meetingId - Meeting ID
   * @param {Array} segments - Transcription segments
   * @returns {Promise<Array>} Saved transcriptions
   */
  async saveTranscriptions(meetingId, segments) {
    try {
      // Prepare transcription documents
      const transcriptions = segments.map(segment => ({
        meetingId,
        startTime: segment.startTime,
        endTime: segment.endTime,
        speaker: segment.speaker,
        text: segment.text,
        isEdited: false
      }));

      // Generate embeddings if embedding service is available
      if (this.embeddingService && this.embeddingService.isEnabled()) {
        try {
          this.logger.debug('Generating embeddings for transcriptions', {
            meetingId,
            count: transcriptions.length
          });

          // Extract texts for batch embedding generation
          const texts = transcriptions.map(t => t.text);

          // Generate embeddings in batch (more efficient)
          const embeddings = await this.embeddingService.generateEmbeddingsBatch(texts);

          // Add embeddings to transcription documents
          transcriptions.forEach((transcription, index) => {
            if (embeddings[index]) {
              transcription.embedding = embeddings[index];
            }
          });

          this.logger.debug('Embeddings generated', {
            meetingId,
            successCount: embeddings.filter(e => e !== null).length,
            totalCount: embeddings.length
          });
        } catch (embeddingError) {
          // Log error but continue with save (graceful degradation)
          this.logger.warn('Failed to generate embeddings, continuing without embeddings', {
            meetingId,
            error: embeddingError.message
          });
        }
      }

      // Bulk insert
      const savedTranscriptions = await Transcription.bulkInsert(transcriptions);

      this.logSuccess('Transcriptions saved', {
        meetingId,
        count: savedTranscriptions.length
      });

      return savedTranscriptions;
    } catch (error) {
      this.logAndThrow(error, 'Save transcriptions', { meetingId, segmentCount: segments.length });
    }
  }

  /**
   * Get transcriptions for a meeting
   * @param {string} meetingId - Meeting ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Transcriptions with pagination
   */
  async getTranscriptions(meetingId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sort = 'startTime'
      } = options;

      const result = await Transcription.findPaginated(
        { meetingId },
        { page: parseInt(page), limit: parseInt(limit), sort }
      );

      this.logSuccess('Transcriptions retrieved', {
        meetingId,
        count: result.transcriptions.length,
        page
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get transcriptions', { meetingId });
    }
  }

  /**
   * Get transcription by ID
   * @param {string} transcriptionId - Transcription ID
   * @returns {Promise<Object>} Transcription
   */
  async getTranscriptionById(transcriptionId) {
    try {
      const transcription = await Transcription.findById(transcriptionId);

      if (!transcription) {
        throw new Error('Transcription not found');
      }

      return transcription.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Get transcription by ID', { transcriptionId });
    }
  }

  /**
   * Update transcription segment
   * @param {string} transcriptionId - Transcription ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated transcription
   */
  async updateTranscription(transcriptionId, updates) {
    try {
      const transcription = await Transcription.findById(transcriptionId);

      if (!transcription) {
        throw new Error('Transcription not found');
      }

      // Allow updating speaker and text
      if (updates.speaker !== undefined) {
        transcription.speaker = updates.speaker;
      }
      if (updates.text !== undefined) {
        transcription.text = updates.text;
      }

      // Mark as edited
      await transcription.markAsEdited();

      this.logSuccess('Transcription updated', {
        transcriptionId,
        isEdited: transcription.isEdited
      });

      return transcription.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Update transcription', { transcriptionId });
    }
  }

  /**
   * Delete all transcriptions for a meeting
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteByMeetingId(meetingId) {
    try {
      const result = await Transcription.deleteMany({ meetingId });

      this.logSuccess('Transcriptions deleted', {
        meetingId,
        deletedCount: result.deletedCount
      });

      return {
        deletedCount: result.deletedCount
      };
    } catch (error) {
      this.logAndThrow(error, 'Delete transcriptions', { meetingId });
    }
  }

  /**
   * Get transcription count for meeting
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<number>} Transcription count
   */
  async getTranscriptionCount(meetingId) {
    try {
      const count = await Transcription.countDocuments({ meetingId });
      return count;
    } catch (error) {
      this.logAndThrow(error, 'Get transcription count', { meetingId });
    }
  }

  /**
   * Search transcriptions by text
   * @param {string} meetingId - Meeting ID
   * @param {string} searchText - Search query
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Matching transcriptions
   */
  async searchTranscriptions(meetingId, searchText, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sort = 'startTime'
      } = options;

      const query = {
        meetingId,
        text: { $regex: searchText, $options: 'i' }
      };

      const result = await Transcription.findPaginated(
        query,
        { page: parseInt(page), limit: parseInt(limit), sort }
      );

      this.logSuccess('Transcriptions searched', {
        meetingId,
        searchText,
        resultsCount: result.transcriptions.length
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Search transcriptions', { meetingId, searchText });
    }
  }

  /**
   * Get transcriptions by speaker
   * @param {string} meetingId - Meeting ID
   * @param {string} speaker - Speaker name
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Speaker's transcriptions
   */
  async getTranscriptionsBySpeaker(meetingId, speaker, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sort = 'startTime'
      } = options;

      const query = {
        meetingId,
        speaker
      };

      const result = await Transcription.findPaginated(
        query,
        { page: parseInt(page), limit: parseInt(limit), sort }
      );

      this.logSuccess('Transcriptions by speaker retrieved', {
        meetingId,
        speaker,
        count: result.transcriptions.length
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get transcriptions by speaker', { meetingId, speaker });
    }
  }
}

module.exports = TranscriptionDataService;
