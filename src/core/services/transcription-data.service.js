/**
 * Transcription Data Service
 * Database operations for transcription segments
 */
const Transcription = require('../../models/transcription.model');

class TranscriptionDataService {
  constructor(logger) {
    this.logger = logger;
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
        confidence: segment.confidence || null,
        isEdited: false
      }));

      // Bulk insert
      const savedTranscriptions = await Transcription.bulkInsert(transcriptions);

      this.logger.info('Transcriptions saved', {
        meetingId,
        count: savedTranscriptions.length
      });

      return savedTranscriptions;
    } catch (error) {
      this.logger.error('Save transcriptions error', {
        error: error.message,
        meetingId,
        segmentCount: segments.length
      });
      throw error;
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

      this.logger.info('Transcriptions retrieved', {
        meetingId,
        count: result.transcriptions.length,
        page
      });

      return result;
    } catch (error) {
      this.logger.error('Get transcriptions error', {
        error: error.message,
        meetingId
      });
      throw error;
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
      this.logger.error('Get transcription error', {
        error: error.message,
        transcriptionId
      });
      throw error;
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

      this.logger.info('Transcription updated', {
        transcriptionId,
        isEdited: transcription.isEdited
      });

      return transcription.toSafeObject();
    } catch (error) {
      this.logger.error('Update transcription error', {
        error: error.message,
        transcriptionId
      });
      throw error;
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

      this.logger.info('Transcriptions deleted', {
        meetingId,
        deletedCount: result.deletedCount
      });

      return {
        deletedCount: result.deletedCount
      };
    } catch (error) {
      this.logger.error('Delete transcriptions error', {
        error: error.message,
        meetingId
      });
      throw error;
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
      this.logger.error('Get transcription count error', {
        error: error.message,
        meetingId
      });
      throw error;
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

      this.logger.info('Transcriptions searched', {
        meetingId,
        searchText,
        resultsCount: result.transcriptions.length
      });

      return result;
    } catch (error) {
      this.logger.error('Search transcriptions error', {
        error: error.message,
        meetingId,
        searchText
      });
      throw error;
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

      this.logger.info('Transcriptions by speaker retrieved', {
        meetingId,
        speaker,
        count: result.transcriptions.length
      });

      return result;
    } catch (error) {
      this.logger.error('Get transcriptions by speaker error', {
        error: error.message,
        meetingId,
        speaker
      });
      throw error;
    }
  }
}

module.exports = TranscriptionDataService;
