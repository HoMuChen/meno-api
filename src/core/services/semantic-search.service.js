/**
 * Semantic Search Service
 * Vector-based semantic search over transcriptions using embeddings
 * Supports single-meeting search, cross-meeting search, and hybrid search
 */
const mongoose = require('mongoose');
const Transcription = require('../../models/transcription.model');
const Meeting = require('../../models/meeting.model');

class SemanticSearchService {
  constructor(logger, embeddingService, transcriptionDataService) {
    this.logger = logger;
    this.embeddingService = embeddingService;
    this.transcriptionDataService = transcriptionDataService;
  }

  /**
   * Semantic search within a single meeting
   * @param {string} meetingId - Meeting ID to search within
   * @param {string} query - Search query text
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results with transcriptions and pagination
   */
  async searchSingleMeeting(meetingId, query, options = {}) {
    const {
      page = 1,
      limit = 20,
      scoreThreshold = 0.7,
      speaker = null
    } = options;

    // Check if embedding service is enabled
    if (!this.embeddingService.isEnabled()) {
      this.logger.warn('Semantic search requested but embedding service is disabled');
      throw new Error('Semantic search is not available. Please configure OPENAI_API_KEY.');
    }

    try {
      this.logger.info('Performing semantic search', {
        meetingId,
        query,
        page,
        limit,
        scoreThreshold
      });

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Build match filter
      const matchFilter = { meetingId: new mongoose.Types.ObjectId(meetingId) };
      if (speaker) {
        matchFilter.speaker = speaker;
      }

      // Perform vector search using MongoDB aggregation
      const numCandidates = Math.min(limit * 10, 200);

      const pipeline = [
        {
          $vectorSearch: {
            index: 'transcription_vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: numCandidates,
            limit: limit * 2, // Get more candidates for scoring
            filter: matchFilter
          }
        },
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' }
          }
        },
        {
          $match: {
            score: { $gte: scoreThreshold }
          }
        },
        {
          $sort: { score: -1 }
        },
        {
          $skip: (page - 1) * limit
        },
        {
          $limit: limit
        },
        {
          $project: {
            _id: 1,
            meetingId: 1,
            startTime: 1,
            endTime: 1,
            speaker: 1,
            text: 1,
            isEdited: 1,
            createdAt: 1,
            score: 1
          }
        }
      ];

      const results = await Transcription.aggregate(pipeline);

      this.logger.info('Semantic search completed', {
        meetingId,
        resultCount: results.length
      });

      return {
        transcriptions: results,
        pagination: {
          page,
          limit,
          total: results.length
        },
        searchType: 'semantic'
      };
    } catch (error) {
      this.logger.error('Semantic search failed', {
        meetingId,
        query,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Semantic search across all meetings in a project
   * @param {string} projectId - Project ID to search within
   * @param {string} query - Search query text
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results grouped by meeting
   */
  async searchAcrossMeetings(projectId, query, options = {}) {
    const {
      page = 1,
      limit = 20,
      scoreThreshold = 0.7,
      from = null,
      to = null,
      speaker = null,
      groupByMeeting = true
    } = options;

    // Check if embedding service is enabled
    if (!this.embeddingService.isEnabled()) {
      this.logger.warn('Semantic search requested but embedding service is disabled');
      throw new Error('Semantic search is not available. Please configure OPENAI_API_KEY.');
    }

    try {
      this.logger.info('Performing cross-meeting semantic search', {
        projectId,
        query,
        page,
        limit,
        scoreThreshold,
        groupByMeeting
      });

      // Get all meeting IDs for this project
      const meetingQuery = { projectId: new mongoose.Types.ObjectId(projectId) };

      if (from || to) {
        meetingQuery.createdAt = {};
        if (from) meetingQuery.createdAt.$gte = new Date(from);
        if (to) meetingQuery.createdAt.$lte = new Date(to);
      }

      const meetings = await Meeting.find(meetingQuery, '_id title createdAt').lean();
      const meetingIds = meetings.map(m => m._id);

      if (meetingIds.length === 0) {
        return {
          results: [],
          pagination: { page, limit, total: 0 },
          searchType: 'semantic_cross_meeting'
        };
      }

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Build match filter
      const matchFilter = { meetingId: { $in: meetingIds } };
      if (speaker) {
        matchFilter.speaker = speaker;
      }

      // Perform vector search across all meetings
      const numCandidates = Math.min(limit * 10, 200);

      const pipeline = [
        {
          $vectorSearch: {
            index: 'transcription_vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: numCandidates,
            limit: limit * 2,
            filter: matchFilter
          }
        },
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' }
          }
        },
        {
          $match: {
            score: { $gte: scoreThreshold }
          }
        },
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
        },
        {
          $project: {
            _id: 1,
            meetingId: 1,
            startTime: 1,
            endTime: 1,
            speaker: 1,
            text: 1,
            isEdited: 1,
            createdAt: 1,
            score: 1,
            'meeting.title': 1,
            'meeting.createdAt': 1
          }
        },
        {
          $sort: { score: -1 }
        },
        {
          $skip: (page - 1) * limit
        },
        {
          $limit: limit
        }
      ];

      const results = await Transcription.aggregate(pipeline);

      // Group by meeting if requested
      let formattedResults;
      if (groupByMeeting) {
        formattedResults = this._groupByMeeting(results);
      } else {
        formattedResults = results;
      }

      this.logger.info('Cross-meeting semantic search completed', {
        projectId,
        resultCount: results.length,
        meetingsSearched: meetingIds.length
      });

      return {
        results: formattedResults,
        pagination: {
          page,
          limit,
          total: results.length
        },
        searchType: 'semantic_cross_meeting',
        meetingsSearched: meetingIds.length
      };
    } catch (error) {
      this.logger.error('Cross-meeting semantic search failed', {
        projectId,
        query,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Hybrid search combining semantic and keyword search
   * @param {string} meetingId - Meeting ID to search within
   * @param {string} query - Search query text
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Merged search results
   */
  async searchHybrid(meetingId, query, options = {}) {
    const { page = 1, limit = 20 } = options;

    try {
      this.logger.info('Performing hybrid search', { meetingId, query });

      // Run both searches in parallel (if embedding is enabled)
      let semanticResults = null;
      let keywordResults = null;

      if (this.embeddingService.isEnabled()) {
        [semanticResults, keywordResults] = await Promise.all([
          this.searchSingleMeeting(meetingId, query, {
            ...options,
            limit: Math.ceil(limit / 2)
          }).catch(error => {
            this.logger.warn('Semantic search failed in hybrid mode', { error: error.message });
            return null;
          }),
          this.transcriptionDataService.searchTranscriptions(meetingId, query, {
            page,
            limit: Math.ceil(limit / 2)
          })
        ]);
      } else {
        // Fall back to keyword-only search
        keywordResults = await this.transcriptionDataService.searchTranscriptions(meetingId, query, {
          page,
          limit
        });
      }

      // Merge results using Reciprocal Rank Fusion
      const mergedResults = this._fuseResults(
        semanticResults?.transcriptions || [],
        keywordResults?.transcriptions || [],
        limit
      );

      this.logger.info('Hybrid search completed', {
        meetingId,
        semanticCount: semanticResults?.transcriptions?.length || 0,
        keywordCount: keywordResults?.transcriptions?.length || 0,
        mergedCount: mergedResults.length
      });

      return {
        transcriptions: mergedResults,
        pagination: {
          page,
          limit,
          total: mergedResults.length
        },
        searchType: 'hybrid',
        components: {
          semantic: semanticResults?.transcriptions?.length || 0,
          keyword: keywordResults?.transcriptions?.length || 0
        }
      };
    } catch (error) {
      this.logger.error('Hybrid search failed', {
        meetingId,
        query,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Group search results by meeting
   * @private
   */
  _groupByMeeting(results) {
    const grouped = {};

    results.forEach(result => {
      const meetingId = result.meetingId.toString();

      if (!grouped[meetingId]) {
        grouped[meetingId] = {
          meetingId: result.meetingId,
          meetingTitle: result.meeting.title,
          meetingDate: result.meeting.createdAt,
          matchCount: 0,
          topScore: 0,
          transcriptions: []
        };
      }

      grouped[meetingId].matchCount++;
      grouped[meetingId].topScore = Math.max(grouped[meetingId].topScore, result.score);
      grouped[meetingId].transcriptions.push({
        _id: result._id,
        startTime: result.startTime,
        endTime: result.endTime,
        speaker: result.speaker,
        text: result.text,
        isEdited: result.isEdited,
        score: result.score
      });
    });

    // Convert to array and sort by top score
    return Object.values(grouped).sort((a, b) => b.topScore - a.topScore);
  }

  /**
   * Merge results using Reciprocal Rank Fusion (RRF)
   * @private
   */
  _fuseResults(semanticResults, keywordResults, limit) {
    const k = 60; // RRF constant
    const scores = new Map();

    // Score semantic results
    semanticResults.forEach((result, index) => {
      const id = result._id.toString();
      const score = 1 / (k + index + 1);
      scores.set(id, { ...result, fusionScore: score, source: 'semantic' });
    });

    // Add keyword results
    keywordResults.forEach((result, index) => {
      const id = result._id.toString();
      const score = 1 / (k + index + 1);

      if (scores.has(id)) {
        // Combine scores if result appears in both
        const existing = scores.get(id);
        existing.fusionScore += score;
        existing.source = 'both';
      } else {
        scores.set(id, { ...result, fusionScore: score, source: 'keyword' });
      }
    });

    // Sort by fusion score and limit
    return Array.from(scores.values())
      .sort((a, b) => b.fusionScore - a.fusionScore)
      .slice(0, limit);
  }
}

module.exports = SemanticSearchService;
