/**
 * Backfill Embeddings Script
 * Generates embeddings for existing transcriptions
 *
 * Usage:
 *   node scripts/backfill-embeddings.js [--dry-run] [--batch-size=100] [--limit=1000]
 *
 * Options:
 *   --dry-run         Show what would be processed without making changes
 *   --batch-size=N    Number of transcriptions to process per batch (default: 100)
 *   --limit=N         Maximum total transcriptions to process (default: unlimited)
 *   --meeting-id=ID   Only process transcriptions for specific meeting
 *   --skip-existing   Skip transcriptions that already have embeddings
 */

const mongoose = require('mongoose');
const Transcription = require('../src/models/transcription.model');
const EmbeddingService = require('../src/core/services/embedding.service');
const logger = require('../src/components/logging');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  skipExisting: args.includes('--skip-existing'),
  batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 100,
  limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
  meetingId: args.find(arg => arg.startsWith('--meeting-id='))?.split('=')[1] || null
};

// Statistics
const stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  failed: 0,
  startTime: Date.now()
};

/**
 * Main execution function
 */
async function backfillEmbeddings() {
  try {
    logger.info('Starting embedding backfill process', options);

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/meno-api');
    logger.info('Connected to MongoDB');

    // Initialize embedding service
    const embeddingService = new EmbeddingService(logger);

    if (!embeddingService.isEnabled()) {
      logger.error('Embedding service is not enabled. Please configure OPENAI_API_KEY.');
      process.exit(1);
    }

    logger.info('Embedding service initialized', embeddingService.getConfig());

    // Build query
    const query = {};
    if (options.meetingId) {
      query.meetingId = new mongoose.Types.ObjectId(options.meetingId);
      logger.info('Filtering by meeting ID', { meetingId: options.meetingId });
    }

    if (options.skipExisting) {
      query.embedding = { $exists: false };
      logger.info('Skipping transcriptions that already have embeddings');
    }

    // Get total count
    const totalCount = await Transcription.countDocuments(query);
    stats.total = options.limit ? Math.min(totalCount, options.limit) : totalCount;

    logger.info('Found transcriptions to process', {
      total: totalCount,
      willProcess: stats.total,
      limited: options.limit !== null
    });

    if (stats.total === 0) {
      logger.info('No transcriptions to process');
      return;
    }

    if (options.dryRun) {
      logger.info('DRY RUN MODE - No changes will be made');
      // Sample some transcriptions to show what would be processed
      const samples = await Transcription.find(query)
        .select('_id meetingId text')
        .limit(5)
        .lean();

      logger.info('Sample transcriptions that would be processed:', {
        count: samples.length,
        samples: samples.map(s => ({
          id: s._id,
          meetingId: s.meetingId,
          textPreview: s.text.substring(0, 100) + '...'
        }))
      });
      return;
    }

    // Process in batches
    const batchSize = options.batchSize;
    let processed = 0;

    while (processed < stats.total) {
      const currentBatchSize = Math.min(batchSize, stats.total - processed);

      logger.info('Processing batch', {
        batchNumber: Math.floor(processed / batchSize) + 1,
        batchSize: currentBatchSize,
        progress: `${processed}/${stats.total}`
      });

      // Fetch batch
      const transcriptions = await Transcription.find(query)
        .select('_id meetingId text')
        .skip(processed)
        .limit(currentBatchSize)
        .lean();

      if (transcriptions.length === 0) {
        break;
      }

      // Extract texts
      const texts = transcriptions.map(t => t.text);

      try {
        // Generate embeddings in batch
        logger.debug('Generating embeddings', { count: texts.length });
        const embeddings = await embeddingService.generateEmbeddingsBatch(texts);

        // Update transcriptions with embeddings
        const updates = [];
        for (let i = 0; i < transcriptions.length; i++) {
          if (embeddings[i]) {
            updates.push({
              updateOne: {
                filter: { _id: transcriptions[i]._id },
                update: { $set: { embedding: embeddings[i] } }
              }
            });
          } else {
            stats.skipped++;
            logger.warn('No embedding generated', {
              transcriptionId: transcriptions[i]._id
            });
          }
        }

        // Bulk update
        if (updates.length > 0) {
          const result = await Transcription.bulkWrite(updates);
          stats.processed += result.modifiedCount;

          logger.info('Batch completed', {
            updated: result.modifiedCount,
            failed: updates.length - result.modifiedCount,
            progress: `${stats.processed}/${stats.total}`
          });
        }
      } catch (error) {
        stats.failed += transcriptions.length;
        logger.error('Batch processing failed', {
          error: error.message,
          batchStart: processed,
          batchSize: transcriptions.length
        });
      }

      processed += transcriptions.length;

      // Progress update
      const elapsed = Date.now() - stats.startTime;
      const rate = stats.processed / (elapsed / 1000);
      const remaining = (stats.total - processed) / rate;

      logger.info('Progress update', {
        processed: stats.processed,
        total: stats.total,
        percentage: ((stats.processed / stats.total) * 100).toFixed(2) + '%',
        rate: rate.toFixed(2) + ' transcriptions/sec',
        estimatedRemaining: formatDuration(remaining * 1000)
      });

      // Small delay between batches to avoid rate limits
      await sleep(1000);
    }

    // Final statistics
    const totalTime = Date.now() - stats.startTime;
    logger.info('Embedding backfill completed', {
      ...stats,
      duration: formatDuration(totalTime),
      averageRate: (stats.processed / (totalTime / 1000)).toFixed(2) + ' transcriptions/sec'
    });
  } catch (error) {
    logger.error('Backfill process failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the script
backfillEmbeddings()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed', { error: error.message });
    process.exit(1);
  });
