/**
 * Semantic Search Service
 * Provides unified hybrid search over transcriptions using two-stage retrieval
 * All search operations now use RetrievalService with hybrid mode by default
 *
 * Note: This service focuses on API-specific formatting
 * Core retrieval logic is in RetrievalService
 */

class SemanticSearchService {
  constructor(logger, embeddingService, transcriptionDataService, retrievalService) {
    this.logger = logger;
    this.embeddingService = embeddingService;
    this.transcriptionDataService = transcriptionDataService;
    this.retrievalService = retrievalService;
  }

  /**
   * Hybrid search within a single meeting using two-stage retrieval
   * @param {string} meetingId - Meeting ID to search within
   * @param {string} query - Search query text
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results with transcriptions and pagination
   */
  async searchHybrid(meetingId, query, options = {}) {
    const {
      page = 1,
      limit = 20,
      scoreThreshold = 0.7,
      personId = null
    } = options;

    try {
      this.logger.info('Performing hybrid search', {
        meetingId,
        query,
        page,
        limit,
        scoreThreshold
      });

      // Build filters
      const filters = {};
      if (personId) {
        filters.personId = personId;
      }

      // Use two-stage hybrid retrieval
      const retrievalResult = await this.retrievalService.retrieve(query, {
        scope: 'meeting',
        scopeId: meetingId,
        filters,
        topK: limit,
        scoreThreshold,
        page,
        includeMeetingInfo: false,
        hybrid: true
      });

      this.logger.info('Hybrid search completed', {
        meetingId,
        resultCount: retrievalResult.results.length,
        strategy: retrievalResult.metadata.strategy
      });

      // Format response to match existing API
      return {
        transcriptions: retrievalResult.results,
        pagination: {
          page,
          limit,
          total: retrievalResult.results.length
        },
        searchType: 'hybrid',
        strategy: retrievalResult.metadata.strategy
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
   * Hybrid search across all meetings in a project
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
      personId = null,
      groupByMeeting = true,
      hybrid = true
    } = options;

    try {
      this.logger.info('Performing cross-meeting search', {
        projectId,
        query,
        page,
        limit,
        scoreThreshold,
        groupByMeeting,
        hybrid
      });

      // Build filters
      const filters = {};
      if (personId) {
        filters.personId = personId;
      }
      if (from) {
        filters.from = from;
      }
      if (to) {
        filters.to = to;
      }

      // Use hybrid retrieval (or semantic-only if hybrid=false)
      const retrievalResult = await this.retrievalService.retrieve(query, {
        scope: 'project',
        scopeId: projectId,
        filters,
        topK: limit,
        scoreThreshold,
        page,
        includeMeetingInfo: true, // Include meeting info for grouping
        hybrid
      });

      // Check if we found any results
      if (retrievalResult.results.length === 0) {
        return {
          results: [],
          pagination: { page, limit, total: 0 },
          searchType: hybrid ? 'hybrid_cross_meeting' : 'semantic_cross_meeting',
          strategy: retrievalResult.metadata.strategy,
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

      this.logger.info('Cross-meeting search completed', {
        projectId,
        resultCount: retrievalResult.results.length,
        meetingsSearched: uniqueMeetings.size,
        strategy: retrievalResult.metadata.strategy
      });

      return {
        results: formattedResults,
        pagination: {
          page,
          limit,
          total: retrievalResult.results.length
        },
        searchType: hybrid ? 'hybrid_cross_meeting' : 'semantic_cross_meeting',
        strategy: retrievalResult.metadata.strategy,
        meetingsSearched: uniqueMeetings.size
      };
    } catch (error) {
      this.logger.error('Cross-meeting search failed', {
        projectId,
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
        score: result.score,
        vectorScore: result.vectorScore,
        textScore: result.textScore,
        combinedScore: result.combinedScore
      });
    });

    // Convert to array and sort by top score
    return Object.values(grouped).sort((a, b) => b.topScore - a.topScore);
  }
}

module.exports = SemanticSearchService;
