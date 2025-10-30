/**
 * Retrieval Service
 * Core service for semantic retrieval over transcriptions
 * Supports meeting-scoped and project-scoped search
 * Implements two-stage hybrid retrieval: vector search + Atlas Search reranking
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
    this.atlasSearchAvailable = null; // Cached detection result
  }

  /**
   * Retrieve relevant transcriptions using semantic or hybrid search
   * @param {string} query - Search query text
   * @param {Object} options - Retrieval options
   * @param {string} options.scope - 'meeting' or 'project'
   * @param {string} options.scopeId - meetingId or projectId
   * @param {Object} options.filters - Additional filters (speaker, dateRange)
   * @param {number} options.topK - Number of results to return (default: 20)
   * @param {number} options.scoreThreshold - Minimum similarity score (default: 0.7)
   * @param {number} options.page - Page number for pagination (default: 1)
   * @param {boolean} options.includeMeetingInfo - Include meeting details in results (default: false)
   * @param {boolean} options.hybrid - Use two-stage hybrid retrieval (default: true)
   * @param {number} options.candidateMultiplier - Multiplier for stage 1 candidates in hybrid mode (default: 5)
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
      includeMeetingInfo = false,
      hybrid = true,
      candidateMultiplier = 5
    } = options;

    // Validate inputs
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    if (!scope || !['meeting', 'project', 'person'].includes(scope)) {
      throw new Error('Scope must be either "meeting", "project", or "person"');
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
      // Determine retrieval strategy
      const useHybrid = hybrid && await this._checkAtlasSearchAvailability();
      const strategy = useHybrid ? 'two-stage-hybrid' : 'semantic-only';

      this.logger.info('Starting retrieval', {
        scope,
        scopeId,
        query: query.substring(0, 50),
        topK,
        scoreThreshold,
        strategy
      });

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Build filter based on scope
      const matchFilter = await this._buildScopeFilter(scope, scopeId, filters);

      // Execute appropriate retrieval strategy
      let results;
      if (useHybrid) {
        // Two-stage hybrid retrieval (separate queries due to MongoDB limitation)
        results = await this._executeTwoStageRetrieval(
          query,
          queryEmbedding,
          matchFilter,
          scoreThreshold,
          topK,
          page,
          includeMeetingInfo,
          candidateMultiplier
        );
      } else {
        // Fallback to semantic-only if hybrid not available
        if (hybrid) {
          this.logger.warn('Hybrid search requested but Atlas Search unavailable, falling back to semantic-only');
        }
        const pipeline = this._buildVectorSearchPipeline(
          queryEmbedding,
          matchFilter,
          scoreThreshold,
          topK,
          page,
          includeMeetingInfo
        );
        results = await Transcription.aggregate(pipeline);
      }

      this.logger.info('Retrieval completed', {
        scope,
        scopeId,
        resultCount: results.length,
        strategy
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
          resultCount: results.length,
          strategy
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
    } else if (scope === 'person') {
      // Person scope - filter transcriptions by personId
      filter.personId = new mongoose.Types.ObjectId(scopeId);
    }

    // Apply additional personId filter if provided (overrides scope-based personId)
    if (additionalFilters.personId) {
      filter.personId = new mongoose.Types.ObjectId(additionalFilters.personId);
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
   * Execute two-stage hybrid retrieval
   * Stage 1: Vector search for semantic similarity (get top N candidates)
   * Stage 2: Atlas Search for keyword reranking on those candidates
   *
   * Note: MongoDB doesn't allow $search after $vectorSearch in same pipeline,
   * so we run two separate queries and combine results
   * @private
   */
  async _executeTwoStageRetrieval(
    query,
    queryEmbedding,
    matchFilter,
    scoreThreshold,
    topK,
    page,
    includeMeetingInfo,
    candidateMultiplier
  ) {
    const numCandidates = topK * candidateMultiplier * 2;
    const stage1Limit = topK * candidateMultiplier;

    // STAGE 1: Vector search to get candidate IDs
    const vectorPipeline = [
      {
        $vectorSearch: {
          index: 'transcription_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: numCandidates,
          limit: stage1Limit,
          filter: matchFilter
        }
      },
      {
        $addFields: {
          vectorScore: { $meta: 'vectorSearchScore' }
        }
      },
      {
        $project: {
          _id: 1,
          vectorScore: 1
        }
      }
    ];

    const vectorResults = await Transcription.aggregate(vectorPipeline);

    this.logger.info('Stage 1 vector search completed', {
      candidatesFound: vectorResults.length,
      query: query.substring(0, 50)
    });

    if (vectorResults.length === 0) {
      this.logger.warn('No vector search candidates found, returning empty results');
      return [];
    }

    // Extract candidate IDs and create vector score map
    const candidateIds = vectorResults.map(r => r._id);
    const candidateIdSet = new Set(candidateIds.map(id => id.toString()));
    const vectorScoreMap = new Map(vectorResults.map(r => [r._id.toString(), r.vectorScore]));

    // STAGE 2: Atlas Search with match filter, then filter to candidates
    const searchPipeline = [
      {
        $search: {
          index: 'transcription_text_index',
          text: {
            query: query,
            path: 'text'
          }
        }
      },
      {
        $addFields: {
          textScore: { $meta: 'searchScore' }
        }
      },
      // Apply scope filter (meetingId, speaker, etc.)
      {
        $match: matchFilter
      },
      // Filter to only include Stage 1 candidates
      {
        $match: {
          _id: { $in: candidateIds }
        }
      }
    ];

    // Add meeting info if requested
    if (includeMeetingInfo) {
      searchPipeline.push(
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
      textScore: 1
    };

    if (includeMeetingInfo) {
      projection['meeting.title'] = 1;
      projection['meeting.createdAt'] = 1;
    }

    searchPipeline.push({
      $project: projection
    });

    const searchResults = await Transcription.aggregate(searchPipeline);

    this.logger.info('Stage 2 Atlas Search completed', {
      searchResultsFound: searchResults.length,
      candidatesProvided: candidateIds.length,
      query: query.substring(0, 50)
    });

    // Combine scores: 60% semantic + 40% keyword
    const combinedResults = searchResults.map(result => {
      const vectorScore = vectorScoreMap.get(result._id.toString()) || 0;
      const textScore = result.textScore || 0;
      const combinedScore = vectorScore * 0.6 + textScore * 0.4;

      return {
        ...result,
        vectorScore,
        combinedScore,
        score: combinedScore
      };
    });

    // Sort by combined score and apply threshold
    const filteredResults = combinedResults
      .filter(r => r.combinedScore >= scoreThreshold)
      .sort((a, b) => b.combinedScore - a.combinedScore);

    // Apply pagination
    const startIdx = (page - 1) * topK;
    const endIdx = startIdx + topK;
    const paginatedResults = filteredResults.slice(startIdx, endIdx);

    this.logger.info('Two-stage retrieval final results', {
      combinedResultsCount: combinedResults.length,
      afterThresholdCount: filteredResults.length,
      afterPaginationCount: paginatedResults.length,
      scoreThreshold
    });

    return paginatedResults;
  }

  /**
   * Check if MongoDB Atlas Search is available
   * Caches result to avoid repeated checks
   * @private
   */
  async _checkAtlasSearchAvailability() {
    // Return cached result if available
    if (this.atlasSearchAvailable !== null) {
      return this.atlasSearchAvailable;
    }

    try {
      // Test if collection supports $search operator
      // Note: Must use $limit: 1 (minimum), not 0, as Atlas Search requires positive limit
      await Transcription.aggregate([
        {
          $search: {
            index: 'transcription_text_index',
            text: {
              query: 'test',
              path: 'text'
            }
          }
        },
        { $limit: 1 }
      ]);

      this.atlasSearchAvailable = true;
      this.logger.info('Atlas Search detected and available');
      return true;
    } catch (error) {
      // Error code 40324: $search stage not available
      // Error code 9: Index not found
      if (error.code === 40324 || error.code === 9) {
        this.atlasSearchAvailable = false;
        this.logger.warn('Atlas Search not available or index not configured', {
          error: error.message,
          code: error.code
        });
        return false;
      }

      // Other errors should be logged but not cached
      this.logger.error('Error checking Atlas Search availability', {
        error: error.message,
        code: error.code
      });
      return false;
    }
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
