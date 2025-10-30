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

      let textChanged = false;

      // Allow updating speaker and text
      if (updates.speaker !== undefined) {
        transcription.speaker = updates.speaker;
      }
      if (updates.text !== undefined) {
        const oldText = transcription.text;
        transcription.text = updates.text;
        textChanged = oldText !== updates.text;
      }

      // Regenerate embedding if text changed and embedding service is enabled
      if (textChanged && this.embeddingService && this.embeddingService.isEnabled()) {
        try {
          this.logger.info('Regenerating embedding for edited transcription', {
            transcriptionId
          });

          const newEmbedding = await this.embeddingService.generateEmbedding(transcription.text);

          if (newEmbedding) {
            transcription.embedding = newEmbedding;
            this.logger.info('Embedding regenerated successfully', {
              transcriptionId
            });
          } else {
            this.logger.warn('Failed to regenerate embedding for edited transcription', {
              transcriptionId
            });
          }
        } catch (embeddingError) {
          // Log error but don't fail the update
          this.logger.error('Error regenerating embedding', {
            transcriptionId,
            error: embeddingError.message
          });
        }
      }

      // Mark as edited
      await transcription.markAsEdited();

      this.logSuccess('Transcription updated', {
        transcriptionId,
        isEdited: transcription.isEdited,
        embeddingRegenerated: textChanged && transcription.embedding !== undefined
      });

      return transcription.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Update transcription', { transcriptionId });
    }
  }

  /**
   * Delete a single transcription by ID
   * @param {string} transcriptionId - Transcription ID
   * @returns {Promise<Object>} Deleted transcription
   */
  async deleteTranscription(transcriptionId) {
    try {
      const transcription = await Transcription.findById(transcriptionId);

      if (!transcription) {
        throw new Error('Transcription not found');
      }

      await Transcription.deleteOne({ _id: transcriptionId });

      this.logSuccess('Transcription deleted', {
        transcriptionId,
        meetingId: transcription.meetingId
      });

      return transcription.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Delete transcription', { transcriptionId });
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
   * Get transcriptions by person
   * @param {string} meetingId - Meeting ID
   * @param {string} personId - Person ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Person's transcriptions
   */
  async getTranscriptionsByPerson(meetingId, personId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sort = 'startTime'
      } = options;

      const query = {
        meetingId,
        personId
      };

      const result = await Transcription.findPaginated(
        query,
        { page: parseInt(page), limit: parseInt(limit), sort }
      );

      this.logSuccess('Transcriptions by person retrieved', {
        meetingId,
        personId,
        count: result.transcriptions.length
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get transcriptions by person', { meetingId, personId });
    }
  }

  /**
   * Batch update speaker assignment to a person
   * Updates all transcriptions with matching speaker name to assign personId and update speaker display name
   * @param {string} meetingId - Meeting ID
   * @param {string} speakerName - Current speaker name to match (e.g., "Speaker 1")
   * @param {string} personId - Person ID to assign
   * @param {string} personName - Person's name for display
   * @returns {Promise<Object>} Update result with counts
   */
  async bulkUpdateSpeakerAssignment(meetingId, speakerName, personId, personName) {
    try {
      const result = await Transcription.updateMany(
        {
          meetingId,
          speaker: speakerName
        },
        {
          $set: {
            personId,
            speaker: personName,
            isEdited: true
          }
        }
      );

      this.logSuccess('Bulk speaker assignment completed', {
        meetingId,
        speakerName,
        personId,
        personName,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      });

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        speaker: speakerName,
        assignedTo: {
          personId,
          personName
        }
      };
    } catch (error) {
      this.logAndThrow(error, 'Bulk update speaker assignment', {
        meetingId,
        speakerName,
        personId
      });
    }
  }
}

module.exports = TranscriptionDataService;
