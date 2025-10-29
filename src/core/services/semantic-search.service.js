/**
 * Semantic Search Service
 * Vector-based semantic search over transcriptions using embeddings
 * Supports single-meeting search, cross-meeting search, and hybrid search
 *
 * Note: Core retrieval logic has been moved to RetrievalService
 * This service now focuses on API-specific formatting and hybrid search
 */

class SemanticSearchService {
  constructor(logger, embeddingService, transcriptionDataService, retrievalService) {
    this.logger = logger;
    this.embeddingService = embeddingService;
    this.transcriptionDataService = transcriptionDataService;
    this.retrievalService = retrievalService;
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

    try {
      this.logger.info('Performing semantic search', {
        meetingId,
        query,
        page,
        limit,
        scoreThreshold
      });

      // Delegate to RetrievalService
      const filters = {};
      if (speaker) {
        filters.speaker = speaker;
      }

      const retrievalResult = await this.retrievalService.retrieve(query, {
        scope: 'meeting',
        scopeId: meetingId,
        filters,
        topK: limit,
        scoreThreshold,
        page,
        includeMeetingInfo: false
      });

      this.logger.info('Semantic search completed', {
        meetingId,
        resultCount: retrievalResult.results.length
      });

      // Format response to match existing API
      return {
        transcriptions: retrievalResult.results,
        pagination: {
          page,
          limit,
          total: retrievalResult.results.length
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

    try {
      this.logger.info('Performing cross-meeting semantic search', {
        projectId,
        query,
        page,
        limit,
        scoreThreshold,
        groupByMeeting
      });

      // Build filters
      const filters = {};
      if (speaker) {
        filters.speaker = speaker;
      }
      if (from) {
        filters.from = from;
      }
      if (to) {
        filters.to = to;
      }

      // Delegate to RetrievalService
      const retrievalResult = await this.retrievalService.retrieve(query, {
        scope: 'project',
        scopeId: projectId,
        filters,
        topK: limit,
        scoreThreshold,
        page,
        includeMeetingInfo: true // Include meeting info for grouping
      });

      // Check if we found any results
      if (retrievalResult.results.length === 0) {
        return {
          results: [],
          pagination: { page, limit, total: 0 },
          searchType: 'semantic_cross_meeting',
          meetingsSearched: 0
        };
      }

      // Group by meeting if requested
      let formattedResults;
      if (groupByMeeting) {
        formattedResults = this._groupByMeeting(retrievalResult.results);
      } else {
        formattedResults = retrievalResult.results;
      }

      // Count unique meetings
      const uniqueMeetings = new Set(retrievalResult.results.map(r => r.meetingId.toString()));

      this.logger.info('Cross-meeting semantic search completed', {
        projectId,
        resultCount: retrievalResult.results.length,
        meetingsSearched: uniqueMeetings.size
      });

      return {
        results: formattedResults,
        pagination: {
          page,
          limit,
          total: retrievalResult.results.length
        },
        searchType: 'semantic_cross_meeting',
        meetingsSearched: uniqueMeetings.size
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
