/**
 * Embedding Service
 * Generates vector embeddings for text using OpenAI API
 * Used for semantic search over transcriptions
 */
const OpenAI = require('openai');

class EmbeddingService {
  constructor(logger) {
    this.logger = logger;

    // Configuration
    this.provider = process.env.EMBEDDING_PROVIDER || 'openai';
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536;
    this.enabled = process.env.VECTOR_SEARCH_ENABLED !== 'false';

    // Validate configuration
    if (this.enabled && this.provider === 'openai') {
      if (!this.apiKey) {
        this.logger.warn('OPENAI_API_KEY not set, embedding generation disabled');
        this.enabled = false;
      } else {
        // Initialize OpenAI client
        this.client = new OpenAI({ apiKey: this.apiKey });

        this.logger.info('Embedding service initialized', {
          provider: this.provider,
          model: this.model,
          dimensions: this.dimensions
        });
      }
    }

    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to generate embedding for
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text) {
    if (!this.enabled) {
      this.logger.debug('Embedding generation disabled, skipping');
      return null;
    }

    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided for embedding generation');
      return null;
    }

    // Trim text to reasonable length (OpenAI has 8191 token limit)
    const trimmedText = text.substring(0, 8000);

    try {
      const response = await this._generateWithRetry(trimmedText);

      this.logger.debug('Generated embedding', {
        textLength: text.length,
        dimensions: response.length
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to generate embedding after retries', {
        error: error.message,
        textPreview: text.substring(0, 100)
      });

      // Don't throw - return null to allow graceful degradation
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling generateEmbedding multiple times
   * @param {Array<string>} texts - Array of texts to generate embeddings for
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateEmbeddingsBatch(texts) {
    if (!this.enabled) {
      this.logger.debug('Embedding generation disabled, skipping batch');
      return texts.map(() => null);
    }

    if (!texts || texts.length === 0) {
      return [];
    }

    // Filter out empty texts and keep track of original indices
    const validTexts = [];
    const validIndices = [];

    texts.forEach((text, index) => {
      if (text && text.trim().length > 0) {
        validTexts.push(text.substring(0, 8000));
        validIndices.push(index);
      }
    });

    if (validTexts.length === 0) {
      return texts.map(() => null);
    }

    try {
      // OpenAI supports up to 2048 texts per batch, but we'll use smaller batches for reliability
      const batchSize = 100;
      const allEmbeddings = [];

      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, Math.min(i + batchSize, validTexts.length));

        this.logger.debug('Generating batch embeddings', {
          batchSize: batch.length,
          batchIndex: Math.floor(i / batchSize),
          totalBatches: Math.ceil(validTexts.length / batchSize)
        });

        const batchEmbeddings = await this._generateBatchWithRetry(batch);
        allEmbeddings.push(...batchEmbeddings);
      }

      // Reconstruct result array with nulls for empty texts
      const result = new Array(texts.length).fill(null);
      validIndices.forEach((originalIndex, i) => {
        result[originalIndex] = allEmbeddings[i];
      });

      this.logger.info('Generated batch embeddings', {
        totalTexts: texts.length,
        successfulEmbeddings: allEmbeddings.length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate batch embeddings', {
        error: error.message,
        textCount: texts.length
      });

      // Return array of nulls to allow graceful degradation
      return texts.map(() => null);
    }
  }

  /**
   * Generate embedding with exponential backoff retry
   * @private
   */
  async _generateWithRetry(text, attempt = 1) {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      // Check if we should retry
      if (attempt < this.maxRetries && this._isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);

        this.logger.warn('Retrying embedding generation', {
          attempt,
          maxRetries: this.maxRetries,
          delay,
          error: error.message
        });

        await this._sleep(delay);
        return this._generateWithRetry(text, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Generate batch embeddings with retry
   * @private
   */
  async _generateBatchWithRetry(texts, attempt = 1) {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimensions
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      // Check if we should retry
      if (attempt < this.maxRetries && this._isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);

        this.logger.warn('Retrying batch embedding generation', {
          attempt,
          maxRetries: this.maxRetries,
          delay,
          batchSize: texts.length,
          error: error.message
        });

        await this._sleep(delay);
        return this._generateBatchWithRetry(texts, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Check if error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Retry on rate limits, timeouts, and server errors
    const retryableStatusCodes = [429, 500, 502, 503, 504];

    if (error.status && retryableStatusCodes.includes(error.status)) {
      return true;
    }

    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if embedding service is enabled and configured
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get embedding configuration info
   * @returns {Object}
   */
  getConfig() {
    return {
      enabled: this.enabled,
      provider: this.provider,
      model: this.model,
      dimensions: this.dimensions
    };
  }
}

module.exports = EmbeddingService;
