/**
 * Retrieval Service
 * Core service for semantic retrieval over transcriptions
 * Supports meeting-scoped and project-scoped search
 * Designed to be reused by search APIs and future RAG/chat features
 */
const mongoose = require('mongoose');
const BaseService = require('./base.service');
const Transcription = require('../../models/transcription.model');
const Meeting = require('../../models/meeting.model');

class RetrievalService extends BaseService {
  constructor(logger, embeddingService) {
    super(logger);
    this.embeddingService = embeddingService;
  }

  /**
   * Retrieve relevant transcriptions using semantic search
   * @param {string} query - Search query text
   * @param {Object} options - Retrieval options
   * @param {string} options.scope - 'meeting' or 'project'
   * @param {string} options.scopeId - meetingId or projectId
   * @param {Object} options.filters - Additional filters (speaker, dateRange)
   * @param {number} options.topK - Number of results to return (default: 20)
   * @param {number} options.scoreThreshold - Minimum similarity score (default: 0.7)
   * @param {number} options.page - Page number for pagination (default: 1)
   * @param {boolean} options.includeMeetingInfo - Include meeting details in results (default: false)
   * @returns {Promise<Object>} Retrieval results with transcriptions and metadata
   */
  async retrieve(query, options = {}) {
    const {
      scope,
      scopeId,
      filters = {},
      topK = 20,
      scoreThreshold = 0.7,
      page = 1,
      includeMeetingInfo = false
    } = options;

    // Validate inputs
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    if (!scope || !['meeting', 'project'].includes(scope)) {
      throw new Error('Scope must be either "meeting" or "project"');
    }

    if (!scopeId) {
      throw new Error('scopeId is required');
    }

    // Check if embedding service is enabled
    if (!this.embeddingService.isEnabled()) {
      this.logger.warn('Retrieval requested but embedding service is disabled');
      throw new Error('Semantic search is not available. Please configure OPENAI_API_KEY.');
    }

    try {
      this.logger.info('Starting retrieval', {
        scope,
        scopeId,
        query: query.substring(0, 50),
        topK,
        scoreThreshold
      });

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Build filter based on scope
      const matchFilter = await this._buildScopeFilter(scope, scopeId, filters);

      // Build and execute vector search pipeline
      const pipeline = this._buildVectorSearchPipeline(
        queryEmbedding,
        matchFilter,
        scoreThreshold,
        topK,
        page,
        includeMeetingInfo
      );

      const results = await Transcription.aggregate(pipeline);

      this.logger.info('Retrieval completed', {
        scope,
        scopeId,
        resultCount: results.length
      });

      return {
        results,
        metadata: {
          scope,
          scopeId,
          query,
          topK,
          scoreThreshold,
          page,
          resultCount: results.length
        }
      };
    } catch (error) {
      this.logAndThrow(error, 'Retrieval failed', {
        scope,
        scopeId,
        query: query.substring(0, 50)
      });
    }
  }

  /**
   * Build MongoDB filter based on scope and additional filters
   * @private
   */
  async _buildScopeFilter(scope, scopeId, additionalFilters = {}) {
    const filter = {};

    if (scope === 'meeting') {
      // Single meeting scope
      filter.meetingId = new mongoose.Types.ObjectId(scopeId);
    } else if (scope === 'project') {
      // Project scope - find all meetings in the project
      const meetingQuery = { projectId: new mongoose.Types.ObjectId(scopeId) };

      // Apply date range filter if provided
      if (additionalFilters.from || additionalFilters.to) {
        meetingQuery.createdAt = {};
        if (additionalFilters.from) {
          meetingQuery.createdAt.$gte = new Date(additionalFilters.from);
        }
        if (additionalFilters.to) {
          meetingQuery.createdAt.$lte = new Date(additionalFilters.to);
        }
      }

      const meetings = await Meeting.find(meetingQuery, '_id').lean();
      const meetingIds = meetings.map(m => m._id);

      if (meetingIds.length === 0) {
        this.logger.warn('No meetings found for project', { scopeId });
        // Return a filter that will match nothing
        filter.meetingId = { $in: [] };
      } else {
        filter.meetingId = { $in: meetingIds };
      }
    }

    // Apply speaker filter if provided
    if (additionalFilters.speaker) {
      filter.speaker = additionalFilters.speaker;
    }

    return filter;
  }

  /**
   * Build MongoDB aggregation pipeline for vector search
   * @private
   */
  _buildVectorSearchPipeline(
    queryEmbedding,
    matchFilter,
    scoreThreshold,
    topK,
    page,
    includeMeetingInfo
  ) {
    const numCandidates = Math.min(topK * 10, 200);
    const pipeline = [
      // Vector search stage
      {
        $vectorSearch: {
          index: 'transcription_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: numCandidates,
          limit: topK * 2, // Get more candidates for scoring
          filter: matchFilter
        }
      },
      // Add similarity score
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' }
        }
      },
      // Filter by score threshold
      {
        $match: {
          score: { $gte: scoreThreshold }
        }
      }
    ];

    // Optionally include meeting information
    if (includeMeetingInfo) {
      pipeline.push(
        {
          $lookup: {
            from: 'meetings',
            localField: 'meetingId',
            foreignField: '_id',
            as: 'meeting'
          }
        },
        {
          $unwind: '$meeting'
        }
      );
    }

    // Project fields
    const projection = {
      _id: 1,
      meetingId: 1,
      startTime: 1,
      endTime: 1,
      speaker: 1,
      text: 1,
      isEdited: 1,
      createdAt: 1,
      score: 1
    };

    if (includeMeetingInfo) {
      projection['meeting.title'] = 1;
      projection['meeting.createdAt'] = 1;
    }

    pipeline.push(
      {
        $project: projection
      },
      // Sort by score
      {
        $sort: { score: -1 }
      },
      // Pagination
      {
        $skip: (page - 1) * topK
      },
      {
        $limit: topK
      }
    );

    return pipeline;
  }

  /**
   * Check if retrieval service is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.embeddingService.isEnabled();
  }
}

module.exports = RetrievalService;
