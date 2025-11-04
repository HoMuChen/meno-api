# Worker Setup Guide

## Prerequisites

The worker process requires **Redis** to be running for the job queue.

## Quick Start

### 1. Start Redis

Choose one of the following methods:

#### Option A: Docker (Recommended)
```bash
docker run -d -p 6379:6379 --name meno-redis redis:7-alpine
```

#### Option B: Homebrew (macOS)
```bash
# Install Redis
brew install redis

# Start Redis
brew services start redis
```

#### Option C: Docker Compose
```bash
docker-compose up redis -d
```

### 2. Update Environment Variables

Add Redis configuration to your `.env` file:

```env
# Redis (for job queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Worker Configuration
WORKER_CONCURRENCY=2
```

### 3. Start the Worker

#### Development
```bash
# Default settings (transcription jobs, 2 concurrent)
npm run worker:dev

# Custom concurrency
node src/worker/index.js --concurrency 5

# Short form
node src/worker/index.js -c 5
```

#### Production
```bash
# Default settings
npm run worker

# High concurrency for production
npm run worker:high  # 5 concurrent workers

# Custom settings
node src/worker/index.js --type transcription --concurrency 10
```

#### View Help
```bash
npm run worker:help
# or
node src/worker/index.js --help
```

## Command-Line Arguments

The worker supports the following command-line arguments:

### `--type, -t <types>`
Specify which job types to process (comma-separated for multiple types)

```bash
# Process transcription jobs only (default)
node src/worker/index.js --type transcription

# Process large transcription jobs only (meetings > 40 minutes)
node src/worker/index.js --type transcription-large

# Process both regular and large transcription jobs
node src/worker/index.js --type transcription,transcription-large

# Future: Process multiple job types
node src/worker/index.js --type transcription,transcription-large,embedding
```

### `--concurrency, -c <num>`
Number of jobs to process concurrently

```bash
# Process 5 jobs at once
node src/worker/index.js --concurrency 5

# Short form
node src/worker/index.js -c 5
```

### `--help, -h`
Display help message with all available options

```bash
node src/worker/index.js --help
```

### Combining Arguments

```bash
# Transcription jobs with 10 concurrent workers
node src/worker/index.js -t transcription -c 10

# Large transcription jobs with 3 concurrent workers (resource-intensive)
node src/worker/index.js -t transcription-large -c 3

# Process both queues with 5 concurrent workers each
node src/worker/index.js -t transcription,transcription-large -c 5

# Use environment variable for concurrency if not specified
WORKER_CONCURRENCY=8 node src/worker/index.js -t transcription
```

### Transcription Queue Routing

The system automatically routes transcription jobs based on meeting duration:

- **Regular Queue (`transcription`)**: Meetings ≤ 40 minutes
  - Timeout: 30 minutes
  - Queue name: `transcription-queue`
  - Suitable for most meetings

- **Large Queue (`transcription-large`)**: Meetings > 40 minutes
  - Timeout: 60 minutes
  - Queue name: `transcription-large-queue`
  - Optimized for long meetings

**Why separate queues?**
- Prevents long transcriptions from blocking short ones
- Allows independent worker scaling (e.g., fewer workers for large jobs)
- Different timeout and resource configurations

**Worker deployment examples:**
```bash
# Dedicated worker for regular transcriptions (high volume)
node src/worker/index.js -t transcription -c 10

# Dedicated worker for large transcriptions (low volume, high resource)
node src/worker/index.js -t transcription-large -c 2

# Single worker handling both queues
node src/worker/index.js -t transcription,transcription-large -c 5
```

## Verify Worker is Running

You should see output like:

**Regular transcription worker:**
```
========================================
⚙️  Starting Meno Worker Process...
========================================
Worker Configuration: { jobTypes: ['transcription'], concurrency: 2, ... }
Testing Redis connection...
✅ Redis connection successful
Connecting to MongoDB...
✅ Transcription worker created
✅ Worker started successfully
📊 Listening for jobs on: { queues: ['transcription-queue'], concurrency: 2 }
========================================
```

**Worker handling both queues:**
```
========================================
⚙️  Starting Meno Worker Process...
========================================
Worker Configuration: { jobTypes: ['transcription', 'transcription-large'], concurrency: 5, ... }
Testing Redis connection...
✅ Redis connection successful
Connecting to MongoDB...
✅ Transcription worker created
✅ Transcription-large worker created
✅ Worker started successfully
📊 Listening for jobs on: { queues: ['transcription-queue', 'transcription-large-queue'], concurrency: 5 }
========================================
```

## Testing the System

### Terminal 1: Start API Server
```bash
npm run dev
```

### Terminal 2: Start Worker
```bash
npm run worker:dev
```

### Terminal 3: Create a Meeting with Transcription
```bash
# Upload a meeting and start transcription
curl -X POST http://localhost:3000/api/projects/{projectId}/meetings/{meetingId}/transcription/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Worker Logs
You should see the worker process the job:
```
Worker received job { jobId: 'transcription-xxx', meetingId: 'xxx' }
Processing transcription job...
Transcription job completed successfully
```

## Troubleshooting

### Error: "Cannot connect to Redis"

**Solution**: Make sure Redis is running:
```bash
# Check if Redis is running
docker ps | grep redis

# Or test connection
redis-cli ping
# Should return: PONG
```

### Worker Not Processing Jobs

1. **Check Redis is running**: See above
2. **Check MongoDB is running**: Worker needs MongoDB too
3. **Check logs**: Look for error messages in worker output
4. **Verify queue**: Jobs should appear in Redis

### Check Redis Queue

```bash
# Connect to Redis CLI
redis-cli

# List all keys
KEYS *

# Check queue length
LLEN bull:transcription-queue:wait
```

## Production Deployment

### Docker Compose (Recommended)

```bash
# Start all services (MongoDB, Redis, API, Worker)
docker-compose up -d

# Scale workers
docker-compose up -d --scale worker=3

# View worker logs
docker-compose logs -f worker
```

### Manual Deployment

1. **Ensure Redis is running** on production server
2. **Set environment variables** in production
3. **Start worker process**:
   ```bash
   NODE_ENV=production npm run worker
   ```
4. **Use PM2 for process management**:
   ```bash
   pm2 start src/worker/index.js --name worker
   pm2 save
   ```

## Monitoring

### Check Queue Metrics

The queue service provides metrics:
```javascript
const queueService = require('./src/core/queue/queue.service');
const metrics = await queueService.getQueueMetrics();
console.log(metrics);
// { waiting: 5, active: 2, completed: 100, failed: 3, total: 110 }
```

### Optional: Install BullMQ Board

For a web UI to monitor queues:

```bash
npm install @bull-board/api @bull-board/express
```

Then add to your Express app (see BullMQ Board documentation).

## Graceful Shutdown

The worker handles graceful shutdown on:
- `SIGTERM` - Kubernetes/Docker shutdown
- `SIGINT` - Ctrl+C

It will:
1. Stop accepting new jobs
2. Finish processing current jobs
3. Close Redis connection
4. Close MongoDB connection
5. Exit cleanly

## Architecture

```
API Server          Redis Queue         Worker Process
    |                    |                     |
    |--- Enqueue Job --->|                     |
    |                    |<--- Poll Jobs ------|
    |                    |                     |
    |                    |                     |-- Process Job
    |                    |                     |-- Update MongoDB
    |                    |                     |
    |<------ Poll Status (Meeting.transcriptionStatus) -------|
```

## Horizontal Scaling

Run multiple workers for increased throughput:

```bash
# Docker Compose - scale identical workers
docker-compose up -d --scale worker=5

# Manual - multiple workers on same queue
npm run worker  # Terminal 1
npm run worker  # Terminal 2
npm run worker  # Terminal 3
```

All workers will share the same Redis queue and process jobs concurrently.

### Independent Queue Scaling

Scale different queues independently based on workload:

```bash
# High-volume regular transcriptions (3 workers, 5 concurrent each)
node src/worker/index.js -t transcription -c 5  # Terminal 1
node src/worker/index.js -t transcription -c 5  # Terminal 2
node src/worker/index.js -t transcription -c 5  # Terminal 3

# Low-volume large transcriptions (1 worker, 2 concurrent)
node src/worker/index.js -t transcription-large -c 2  # Terminal 4
```

This approach allows you to:
- Allocate more resources to high-volume queues
- Run fewer workers for resource-intensive large transcriptions
- Scale each queue type independently based on load
