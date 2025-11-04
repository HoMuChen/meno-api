/**
 * Queue configuration for BullMQ
 *
 * This module provides configuration settings for the Redis-based job queue system.
 */

const config = require('../../components/config');

/**
 * Redis connection configuration
 */
const redisConnection = {
  host: config.redis.host || 'localhost',
  port: config.redis.port || 6379,
  password: config.redis.password || undefined,
  db: config.redis.db || 0,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false, // Required for BullMQ
};

/**
 * Default job options for all queues
 */
const defaultJobOptions = {
  attempts: 3, // Retry failed jobs up to 3 times
  backoff: {
    type: 'exponential',
    delay: 1000, // Initial delay: 1 second, then 2s, 4s, 8s...
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000, // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days for debugging
  },
};

/**
 * Queue-specific configurations
 */
const queueConfigs = {
  transcription: {
    name: 'transcription-queue',
    defaultJobOptions: {
      ...defaultJobOptions,
      timeout: 30 * 60 * 1000, // 30 minutes timeout for regular transcription jobs
    },
  },
  transcriptionLarge: {
    name: 'transcription-large-queue',
    defaultJobOptions: {
      ...defaultJobOptions,
      timeout: 60 * 60 * 1000, // 60 minutes timeout for large transcription jobs (>40 mins audio)
    },
  },
  // Future queue configurations can be added here
};

/**
 * Worker configuration
 */
const workerConfig = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 2, // Process 2 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs per...
    duration: 1000, // ...1 second (rate limiting)
  },
};

module.exports = {
  redisConnection,
  defaultJobOptions,
  queueConfigs,
  workerConfig,
};
