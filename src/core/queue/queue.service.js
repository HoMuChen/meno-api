/**
 * Queue Service
 *
 * Abstraction layer for job queue operations using BullMQ.
 * Provides methods to enqueue jobs, check status, and manage the queue.
 */

const { Queue } = require('bullmq');
const { redisConnection, queueConfigs } = require('../../worker/config/queue.config');
const { JOB_TYPES, QUEUE_NAMES } = require('./job-types');
const logger = require('../../components/logging');

class QueueService {
  constructor() {
    this.queues = new Map();
    this.logger = logger;
    this.initialized = false;
  }

  /**
   * Ensure queues are initialized (lazy initialization)
   * @private
   */
  ensureInitialized() {
    if (this.initialized) {
      return;
    }
    this.initializeQueues();
    this.initialized = true;
  }

  /**
   * Initialize all queues
   * @private
   */
  initializeQueues() {
    try {
      // Initialize transcription queue
      const transcriptionQueue = new Queue(
        QUEUE_NAMES[JOB_TYPES.TRANSCRIPTION],
        {
          connection: redisConnection,
          defaultJobOptions: queueConfigs.transcription.defaultJobOptions,
        }
      );

      this.queues.set(JOB_TYPES.TRANSCRIPTION, transcriptionQueue);

      // Test connection
      transcriptionQueue.on('error', (error) => {
        this.logger.error('Queue connection error', {
          error: error.message,
          queue: QUEUE_NAMES[JOB_TYPES.TRANSCRIPTION],
        });
      });

      // Initialize transcription-large queue (for meetings > 40 minutes)
      const transcriptionLargeQueue = new Queue(
        QUEUE_NAMES[JOB_TYPES.TRANSCRIPTION_LARGE],
        {
          connection: redisConnection,
          defaultJobOptions: queueConfigs.transcriptionLarge.defaultJobOptions,
        }
      );

      this.queues.set(JOB_TYPES.TRANSCRIPTION_LARGE, transcriptionLargeQueue);

      // Test connection
      transcriptionLargeQueue.on('error', (error) => {
        this.logger.error('Queue connection error', {
          error: error.message,
          queue: QUEUE_NAMES[JOB_TYPES.TRANSCRIPTION_LARGE],
        });
      });

      this.logger.info('Queue service initialized', {
        queues: Array.from(this.queues.keys()),
        redis: `${redisConnection.host}:${redisConnection.port}`,
      });

      // Future: Initialize other queues here
      // const embeddingQueue = new Queue(...);
      // this.queues.set(JOB_TYPES.EMBEDDING, embeddingQueue);
    } catch (error) {
      this.logger.error('Failed to initialize queues', {
        error: error.message,
        redis: `${redisConnection.host}:${redisConnection.port}`,
      });
      this.logger.error('Please ensure Redis is running:');
      this.logger.error('  - Docker: docker run -d -p 6379:6379 redis:7-alpine');
      this.logger.error('  - Homebrew: brew services start redis');
      throw error;
    }
  }

  /**
   * Enqueue a transcription job
   *
   * @param {string} meetingId - MongoDB ObjectId of the meeting
   * @param {string} audioUri - Storage URI of the audio file
   * @param {object} options - Additional options (language, speakerDetection, etc.)
   * @returns {Promise<object>} Job information { jobId, meetingId }
   */
  async enqueueTranscription(meetingId, audioUri, options = {}) {
    return this._enqueueTranscriptionJob(
      JOB_TYPES.TRANSCRIPTION,
      meetingId,
      audioUri,
      options
    );
  }

  /**
   * Enqueue a large transcription job (for meetings > 40 minutes)
   *
   * @param {string} meetingId - MongoDB ObjectId of the meeting
   * @param {string} audioUri - Storage URI of the audio file
   * @param {object} options - Additional options (language, speakerDetection, etc.)
   * @returns {Promise<object>} Job information { jobId, meetingId }
   */
  async enqueueTranscriptionLarge(meetingId, audioUri, options = {}) {
    return this._enqueueTranscriptionJob(
      JOB_TYPES.TRANSCRIPTION_LARGE,
      meetingId,
      audioUri,
      options
    );
  }

  /**
   * Internal method to enqueue transcription jobs
   * @private
   */
  async _enqueueTranscriptionJob(jobType, meetingId, audioUri, options = {}) {
    this.ensureInitialized(); // Lazy initialization

    try {
      const queue = this.queues.get(jobType);

      if (!queue) {
        throw new Error(`Queue for job type ${jobType} not initialized`);
      }

      const jobData = {
        meetingId,
        audioUri,
        options: {
          language: options.language,
          speakerDetection: options.speakerDetection !== false, // Default true
        },
      };

      // Add job to queue with unique job ID based on meetingId
      const job = await queue.add(
        jobType,
        jobData,
        {
          jobId: `${jobType}-${meetingId}`, // Unique job ID prevents duplicates
          priority: options.priority || 1, // Lower number = higher priority
        }
      );

      this.logger.info('Transcription job enqueued', {
        jobId: job.id,
        jobType,
        meetingId,
        audioUri,
      });

      return {
        jobId: job.id,
        meetingId,
      };
    } catch (error) {
      this.logger.error('Failed to enqueue transcription job', {
        error: error.message,
        jobType,
        meetingId,
        audioUri,
      });
      throw error;
    }
  }

  /**
   * Get job status and progress
   *
   * @param {string} jobId - Job ID
   * @param {string} jobType - Job type (default: TRANSCRIPTION)
   * @returns {Promise<object>} Job status information
   */
  async getJobStatus(jobId, jobType = JOB_TYPES.TRANSCRIPTION) {
    this.ensureInitialized(); // Lazy initialization

    try {
      const queue = this.queues.get(jobType);

      if (!queue) {
        throw new Error(`Queue for job type ${jobType} not initialized`);
      }

      const job = await queue.getJob(jobId);

      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress;
      const failedReason = job.failedReason;

      return {
        status: state, // 'waiting', 'active', 'completed', 'failed', 'delayed'
        progress,
        failedReason,
        data: job.data,
        attemptsMade: job.attemptsMade,
      };
    } catch (error) {
      this.logger.error('Failed to get job status', {
        error: error.message,
        jobId,
        jobType,
      });
      throw error;
    }
  }

  /**
   * Remove a job from the queue (cancel)
   *
   * @param {string} jobId - Job ID
   * @param {string} jobType - Job type (default: TRANSCRIPTION)
   * @returns {Promise<boolean>} True if job was removed
   */
  async removeJob(jobId, jobType = JOB_TYPES.TRANSCRIPTION) {
    this.ensureInitialized(); // Lazy initialization

    try {
      const queue = this.queues.get(jobType);

      if (!queue) {
        throw new Error(`Queue for job type ${jobType} not initialized`);
      }

      const job = await queue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.remove();

      this.logger.info('Job removed from queue', { jobId, jobType });

      return true;
    } catch (error) {
      this.logger.error('Failed to remove job', {
        error: error.message,
        jobId,
        jobType,
      });
      throw error;
    }
  }

  /**
   * Get queue metrics (for monitoring)
   *
   * @param {string} jobType - Job type (default: TRANSCRIPTION)
   * @returns {Promise<object>} Queue metrics
   */
  async getQueueMetrics(jobType = JOB_TYPES.TRANSCRIPTION) {
    this.ensureInitialized(); // Lazy initialization

    try {
      const queue = this.queues.get(jobType);

      if (!queue) {
        throw new Error(`Queue for job type ${jobType} not initialized`);
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      this.logger.error('Failed to get queue metrics', {
        error: error.message,
        jobType,
      });
      throw error;
    }
  }

  /**
   * Close all queue connections
   * Call this when shutting down the application
   */
  async close() {
    if (!this.initialized || this.queues.size === 0) {
      this.logger.info('No queues to close');
      return;
    }

    try {
      const closePromises = Array.from(this.queues.values()).map((queue) =>
        queue.close()
      );
      await Promise.all(closePromises);
      this.logger.info('All queues closed');
    } catch (error) {
      this.logger.error('Error closing queues', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new QueueService();
