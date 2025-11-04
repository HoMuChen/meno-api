/**
 * Worker Process Entry Point
 *
 * Standalone worker process for processing background jobs from Redis queue.
 * This process runs independently from the API server and can be scaled horizontally.
 */

require('dotenv').config();

const { Worker } = require('bullmq');
const logger = require('../components/logging');
const config = require('../components/config');
const { connectDB } = require('../components/database');
const StorageFactory = require('../core/storage/storage.factory');
const MeetingService = require('../core/services/meeting.service');
const TranscriptionServiceFactory = require('../core/services/transcription-service.factory');
const TranscriptionDataService = require('../core/services/transcription-data.service');
const EmbeddingService = require('../core/services/embedding.service');
const RetrievalService = require('../core/services/retrieval.service');
const { redisConnection, workerConfig, queueConfigs } = require('./config/queue.config');
const { JOB_TYPES, QUEUE_NAMES } = require('../core/queue/job-types');
const processTranscriptionJob = require('./processors/transcription.processor');

// Import all models to register them with Mongoose
// This is needed for populate() to work correctly
require('../models/user.model');
require('../models/project.model');
require('../models/meeting.model');
require('../models/transcription.model');
require('../models/person.model');
require('../models/action-item.model');

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    jobTypes: ['transcription'], // Default job types to process
    concurrency: null, // Will use env var or default if not specified
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--type':
      case '--job-type':
      case '-t':
        if (i + 1 < args.length) {
          options.jobTypes = args[++i].split(',').map(t => t.trim());
        }
        break;

      case '--concurrency':
      case '-c':
        if (i + 1 < args.length) {
          options.concurrency = parseInt(args[++i], 10);
        }
        break;

      default:
        console.error(`Unknown argument: ${arg}`);
        options.help = true;
        break;
    }
  }

  return options;
}

/**
 * Display help message
 */
function displayHelp() {
  console.log(`
Meno Worker Process - Background job processor

Usage:
  node src/worker/index.js [options]

Options:
  --type, -t <types>         Job types to process (comma-separated)
                             Default: transcription
                             Example: --type transcription,embedding

  --concurrency, -c <num>    Number of concurrent jobs to process
                             Default: WORKER_CONCURRENCY env var or 2
                             Example: --concurrency 5

  --help, -h                 Display this help message

Environment Variables:
  WORKER_CONCURRENCY         Default concurrency if not specified via --concurrency
  REDIS_HOST                 Redis host (default: localhost)
  REDIS_PORT                 Redis port (default: 6379)
  MONGODB_URI                MongoDB connection string
  TRANSCRIPTION_PROVIDER     Transcription service provider (mock, gemini)

Examples:
  # Start worker with default settings
  node src/worker/index.js

  # Process only transcription jobs with 5 concurrent workers
  node src/worker/index.js --type transcription --concurrency 5

  # Short form
  node src/worker/index.js -t transcription -c 5

  # Multiple job types (future)
  node src/worker/index.js -t transcription,embedding -c 3
`);
}

/**
 * Utility function to mask sensitive values
 */
const maskSecret = (secret) => {
  if (!secret) return 'Not configured';
  if (secret.length <= 8) return '****';
  return `${secret.substring(0, 4)}${'*'.repeat(secret.length - 8)}${secret.substring(secret.length - 4)}`;
};

/**
 * Initialize worker services
 */
function initializeServices() {
  logger.info('Initializing worker services...');

  // Initialize audio storage provider
  const audioStorageProvider = StorageFactory.createProvider(logger, {
    provider: process.env.STORAGE_PROVIDER || 'local',
    basePath: process.env.LOCAL_STORAGE_PATH || './storage',
    bucket: process.env.GCS_BUCKET_NAME || 'audio-files',
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GCS_KEYFILE_PATH,
  });

  logger.info('✅ Audio storage provider initialized', {
    provider: process.env.STORAGE_PROVIDER || 'local',
  });

  // Initialize embedding service for semantic search
  const embeddingService = new EmbeddingService(logger);

  // Initialize retrieval service
  const retrievalService = new RetrievalService(logger, embeddingService);

  // Initialize transcription data service
  const transcriptionDataService = new TranscriptionDataService(
    logger,
    embeddingService,
    retrievalService
  );

  logger.info('✅ Transcription data service initialized');

  // Initialize meeting service with minimal dependencies (worker only needs DB access)
  const meetingService = new MeetingService(
    logger,
    null, // fileService - not needed in worker
    null, // projectService - not needed in worker
    null, // transcriptionService - will be set after factory
    transcriptionDataService,
    audioStorageProvider,
    null, // authorizationService - not needed in worker
    null  // actionItemService - not needed in worker
  );

  logger.info('✅ Meeting service initialized (minimal dependencies for worker)');

  // Initialize transcription service using factory
  const transcriptionService = TranscriptionServiceFactory.getInstance(
    logger,
    transcriptionDataService,
    meetingService // ✅ Now provided
  );

  // Set circular reference (transcriptionService needs meetingService, meetingService needs transcriptionService)
  meetingService.transcriptionService = transcriptionService;

  logger.info('✅ Transcription service initialized', {
    provider: config.transcription.provider,
  });

  return {
    transcriptionService,
    transcriptionDataService,
    audioStorageProvider,
  };
}

/**
 * Start the worker
 */
async function startWorker() {
  try {
    // Parse command line arguments
    const cliOptions = parseArguments();

    // Show help if requested
    if (cliOptions.help) {
      displayHelp();
      process.exit(0);
    }

    // Validate job types
    const validJobTypes = Object.values(JOB_TYPES);
    const invalidTypes = cliOptions.jobTypes.filter(type => !validJobTypes.includes(type));
    if (invalidTypes.length > 0) {
      console.error(`Invalid job type(s): ${invalidTypes.join(', ')}`);
      console.error(`Valid types: ${validJobTypes.join(', ')}`);
      process.exit(1);
    }

    // Determine concurrency (CLI arg > env var > default)
    const concurrency = cliOptions.concurrency || workerConfig.concurrency;

    // Log startup banner
    logger.info('========================================');
    logger.info('⚙️  Starting Meno Worker Process...');
    logger.info('========================================');

    // Log environment configuration
    logger.info('Environment Configuration:', {
      nodeEnv: config.env,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    });

    // Log worker configuration
    logger.info('Worker Configuration:', {
      jobTypes: cliOptions.jobTypes,
      concurrency: concurrency,
      rateLimitMax: workerConfig.limiter.max,
      rateLimitDuration: workerConfig.limiter.duration,
    });

    // Log Redis configuration
    logger.info('Redis Configuration:', {
      host: redisConnection.host,
      port: redisConnection.port,
      db: redisConnection.db,
    });

    // Log database configuration (mask sensitive data)
    const dbUri = config.mongodb.uri;
    const maskedUri = dbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    logger.info('Database Configuration:', {
      uri: maskedUri,
      driver: 'MongoDB',
    });

    // Log transcription service configuration
    logger.info('Transcription Service Configuration:', {
      provider: config.transcription.provider,
      geminiApiKey: maskSecret(config.transcription.geminiApiKey),
      transcriptionModel: config.transcription.geminiTranscriptionModel,
    });

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDB();

    // Initialize services
    const services = initializeServices();

    // Test Redis connection first
    logger.info('Testing Redis connection...');
    const Redis = require('ioredis');
    const testRedis = new Redis(redisConnection);

    try {
      await testRedis.ping();
      logger.info('✅ Redis connection successful');
      await testRedis.quit();
    } catch (error) {
      logger.error('❌ Failed to connect to Redis', {
        error: error.message,
        host: redisConnection.host,
        port: redisConnection.port,
      });
      logger.error('Please ensure Redis is running:');
      logger.error('  - Docker: docker run -d -p 6379:6379 redis:7-alpine');
      logger.error('  - Homebrew: brew services start redis');
      logger.error('  - Docker Compose: docker-compose up redis -d');
      process.exit(1);
    }

    // Create workers for specified job types
    const workers = [];

    // Only create transcription worker if included in job types
    if (cliOptions.jobTypes.includes(JOB_TYPES.TRANSCRIPTION)) {
      const transcriptionWorker = new Worker(
        QUEUE_NAMES[JOB_TYPES.TRANSCRIPTION],
        async (job) => {
          logger.info('Worker received job', {
            jobId: job.id,
            jobType: JOB_TYPES.TRANSCRIPTION,
            meetingId: job.data.meetingId,
          });

          // Process the job
          return await processTranscriptionJob(job, services);
        },
        {
          connection: redisConnection,
          concurrency: concurrency,
          limiter: workerConfig.limiter,
        }
      );

      // Worker event handlers
      transcriptionWorker.on('completed', (job, result) => {
        logger.info('Job completed successfully', {
          jobId: job.id,
          jobType: JOB_TYPES.TRANSCRIPTION,
          meetingId: result.meetingId,
          segmentsCount: result.segmentsCount,
        });
      });

      transcriptionWorker.on('failed', (job, error) => {
        logger.error('Job failed', {
          jobId: job?.id,
          jobType: JOB_TYPES.TRANSCRIPTION,
          meetingId: job?.data?.meetingId,
          error: error.message,
          attemptsMade: job?.attemptsMade,
          attemptsRemaining: job ? (3 - job.attemptsMade) : 0,
        });
      });

      transcriptionWorker.on('error', (error) => {
        logger.error('Worker error', {
          jobType: JOB_TYPES.TRANSCRIPTION,
          error: error.message,
          stack: error.stack,
        });
      });

      transcriptionWorker.on('stalled', (jobId) => {
        logger.warn('Job stalled (worker may have crashed)', {
          jobType: JOB_TYPES.TRANSCRIPTION,
          jobId,
        });
      });

      workers.push({ type: JOB_TYPES.TRANSCRIPTION, worker: transcriptionWorker });
      logger.info('✅ Transcription worker created');
    }

    // Create transcription-large worker if included in job types (for meetings > 40 minutes)
    if (cliOptions.jobTypes.includes(JOB_TYPES.TRANSCRIPTION_LARGE)) {
      const transcriptionLargeWorker = new Worker(
        QUEUE_NAMES[JOB_TYPES.TRANSCRIPTION_LARGE],
        async (job) => {
          logger.info('Worker received job', {
            jobId: job.id,
            jobType: JOB_TYPES.TRANSCRIPTION_LARGE,
            meetingId: job.data.meetingId,
          });

          // Process the job (same processor as regular transcription)
          return await processTranscriptionJob(job, services);
        },
        {
          connection: redisConnection,
          concurrency: concurrency,
          limiter: workerConfig.limiter,
        }
      );

      // Worker event handlers
      transcriptionLargeWorker.on('completed', (job, result) => {
        logger.info('Job completed successfully', {
          jobId: job.id,
          jobType: JOB_TYPES.TRANSCRIPTION_LARGE,
          meetingId: result.meetingId,
          segmentsCount: result.segmentsCount,
        });
      });

      transcriptionLargeWorker.on('failed', (job, error) => {
        logger.error('Job failed', {
          jobId: job?.id,
          jobType: JOB_TYPES.TRANSCRIPTION_LARGE,
          meetingId: job?.data?.meetingId,
          error: error.message,
          attemptsMade: job?.attemptsMade,
          attemptsRemaining: job ? (3 - job.attemptsMade) : 0,
        });
      });

      transcriptionLargeWorker.on('error', (error) => {
        logger.error('Worker error', {
          jobType: JOB_TYPES.TRANSCRIPTION_LARGE,
          error: error.message,
          stack: error.stack,
        });
      });

      transcriptionLargeWorker.on('stalled', (jobId) => {
        logger.warn('Job stalled (worker may have crashed)', {
          jobType: JOB_TYPES.TRANSCRIPTION_LARGE,
          jobId,
        });
      });

      workers.push({ type: JOB_TYPES.TRANSCRIPTION_LARGE, worker: transcriptionLargeWorker });
      logger.info('✅ Transcription-large worker created');
    }

    // Future: Add other job type workers here
    // if (cliOptions.jobTypes.includes(JOB_TYPES.EMBEDDING)) { ... }

    logger.info('========================================');
    logger.info('✅ Worker started successfully');
    logger.info('📊 Listening for jobs on:', {
      queues: workers.map(w => QUEUE_NAMES[w.type]),
      concurrency: concurrency,
    });
    logger.info('========================================');

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Close all workers
        for (const { type, worker } of workers) {
          await worker.close();
          logger.info('Worker closed', { jobType: type });
        }

        // Close MongoDB connection
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        logger.info('Database connection closed');

        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason,
        promise,
      });
    });
  } catch (error) {
    logger.error('Failed to start worker', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Start the worker
if (require.main === module) {
  startWorker()
}

module.exports = startWorker;
