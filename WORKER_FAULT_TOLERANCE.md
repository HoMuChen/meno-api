# Worker Fault Tolerance & Recovery Guide

Comprehensive guide explaining how the worker system handles failures, crashes, and recovery scenarios.

## Overview

The BullMQ worker system includes robust fault tolerance mechanisms to ensure transcription jobs are not lost when workers crash or fail.

## Key Mechanisms

### 1. Job Persistence
- All jobs are stored in Redis (not memory)
- Jobs survive worker crashes
- Jobs survive Redis restarts (if Redis persistence enabled)

### 2. Stalled Job Detection
- Workers send heartbeats to Redis while processing
- If worker crashes → heartbeats stop
- BullMQ detects stalled jobs after ~30 seconds
- Stalled jobs automatically moved back to queue

### 3. Automatic Retry
- Jobs retry up to 3 times on failure
- Exponential backoff between retries (1s, 2s, 4s)
- Different workers can pick up retried jobs

### 4. Progressive Data Persistence
- Transcription segments saved to MongoDB as they're processed
- On retry, already-saved segments are preserved
- New attempt continues from where data exists

## Failure Scenarios

### Scenario 1: Worker Process Crash

**What happens:**
```
Timeline:
00:00 - Worker picks up job (meetingId: 123)
00:01 - Meeting status: "processing", progress: 0%
00:05 - Transcription at 30%, 100 segments saved to DB
00:10 - Worker crashes (out of memory, killed, etc.)
00:40 - BullMQ detects stalled job
00:40 - Job moved back to queue (Attempt 2/3)
00:41 - New worker picks up job
00:41 - Transcription starts over, but 100 segments already exist
01:00 - Transcription completes successfully
01:00 - Meeting status: "completed", progress: 100%
```

**Result:**
- ✅ Job completes successfully
- ✅ All segments preserved (no data loss)
- ✅ User sees continuous progress (from saved segments)
- ⚠️ Some redundant work (re-transcribing first 30%)

### Scenario 2: Redis Connection Lost

**What happens:**
```
Timeline:
00:00 - Worker processing job normally
00:05 - Redis connection drops
00:05 - Worker can't update progress in Redis
00:05 - Worker continues transcription locally
00:35 - BullMQ marks job as stalled (no heartbeat)
00:40 - Redis connection restored
00:40 - Job moved back to queue
00:41 - Worker picks up "stalled" job again
01:00 - Job completes successfully
```

**Result:**
- ✅ Job completes successfully
- ✅ Automatic recovery when Redis reconnects
- ⚠️ Progress updates may be delayed during outage

### Scenario 3: MongoDB Connection Lost

**What happens:**
```
Timeline:
00:00 - Worker processing job
00:05 - MongoDB connection drops
00:05 - Worker can't save segments
00:05 - Error thrown: "Cannot save segment"
00:06 - Job marked as failed (Attempt 1/3)
00:07 - Wait 1 second (exponential backoff)
00:08 - Job retried (Attempt 2/3)
00:08 - MongoDB connection restored
00:20 - Job completes successfully
```

**Result:**
- ✅ Job completes after automatic retry
- ✅ Fast recovery due to exponential backoff
- ⚠️ Brief error period visible in logs

### Scenario 4: All Retry Attempts Exhausted

**What happens:**
```
Timeline:
00:00 - Job attempt 1/3
00:05 - Failure (worker crash)
00:06 - Wait 1 second
00:07 - Job attempt 2/3
00:12 - Failure (worker crash again)
00:13 - Wait 2 seconds
00:15 - Job attempt 3/3
00:20 - Failure (worker crash again)
00:21 - All attempts exhausted
00:21 - Job moved to "failed" queue
00:21 - Meeting status: "failed"
```

**Result:**
- ❌ Job permanently failed
- ✅ Meeting status updated to "failed"
- ✅ Error message saved for debugging
- ✅ Failed job kept in Redis for 7 days
- ℹ️ Manual intervention required

**Recovery options:**
```bash
# Option 1: Restart specific job manually
redis-cli
LPUSH bull:transcription-queue:wait <job-data>

# Option 2: Trigger new transcription via API
curl -X POST /api/projects/{projectId}/meetings/{meetingId}/transcription/start

# Option 3: Check logs and fix underlying issue
pm2 logs worker-transcription --lines 100
```

### Scenario 5: Worker Killed During Job (SIGTERM/SIGKILL)

**What happens:**
```
Timeline:
00:00 - Worker processing job
00:05 - pm2 restart or kill -9 <pid>
00:05 - Worker immediately terminated (no graceful shutdown)
00:35 - BullMQ detects stalled job
00:35 - Job moved back to queue
00:36 - Restarted worker picks up job
01:00 - Job completes successfully
```

**Result:**
- ✅ Job completes successfully after restart
- ✅ No data loss (segments already saved)
- ⚠️ Abrupt termination (no cleanup)

**Better approach (graceful shutdown):**
```bash
# Use pm2 reload for zero-downtime restart
pm2 reload ecosystem.config.yml

# This triggers graceful shutdown:
# - Worker finishes current jobs (up to kill_timeout)
# - Then gracefully exits
# - New worker starts
```

### Scenario 6: Timeout Exceeded

**What happens:**
```
Timeline:
Regular Queue (30 min timeout):
00:00 - Job starts (45-minute meeting, should use large queue)
30:00 - Timeout exceeded
30:00 - Job terminated by BullMQ
30:00 - Job retried (Attempt 2/3)
30:01 - Timeout exceeded again
30:01 - Job retried (Attempt 3/3)
30:02 - Timeout exceeded again
30:02 - Job failed permanently
```

**Result:**
- ❌ Job failed due to incorrect queue routing
- ⚠️ Meeting took too long for regular queue

**Prevention:**
```javascript
// MeetingService automatically routes by duration
const isLargeTranscription = meeting.duration && meeting.duration > 40 * 60;
const jobInfo = isLargeTranscription
  ? await queueService.enqueueTranscriptionLarge(meetingId, audioFile)
  : await queueService.enqueueTranscription(meetingId, audioFile);
```

## Meeting Status During Failures

### Status Transitions

**Normal Flow:**
```
'pending' → 'processing' → 'completed'
```

**Failure Flow:**
```
'pending' → 'processing' → [crash] → 'processing' (retry) → 'completed'
```

**Permanent Failure Flow:**
```
'pending' → 'processing' → [crash] × 3 → 'failed'
```

### Important Notes

1. **Status stays "processing" during retries**
   - User doesn't see "failed" → "processing" flicker
   - Progress bar continues from last saved segments

2. **Segments are not deleted on retry**
   - Already-saved segments remain in DB
   - New attempt appends new segments
   - No duplicate segments (transcription service handles this)

3. **Error messages only set on permanent failure**
   ```javascript
   meeting.metadata.transcription = {
     errorMessage: error.message,
     attempts: 3,
     lastAttempt: new Date()
   }
   ```

## Configuration Tuning

### Adjust Retry Attempts

```javascript
// src/worker/config/queue.config.js
const defaultJobOptions = {
  attempts: 5,  // Increase from 3 to 5 for more reliability
  backoff: {
    type: 'exponential',
    delay: 2000  // Increase delay for slower backoff
  }
}
```

### Adjust Stall Detection Time

```javascript
// src/worker/index.js
const transcriptionWorker = new Worker(
  QUEUE_NAMES[JOB_TYPES.TRANSCRIPTION],
  async (job) => { /* ... */ },
  {
    connection: redisConnection,
    concurrency: 5,
    lockDuration: 60000,  // Add this: increase stall detection to 60s
  }
);
```

### Adjust Timeouts

```javascript
// src/worker/config/queue.config.js
const queueConfigs = {
  transcription: {
    defaultJobOptions: {
      ...defaultJobOptions,
      timeout: 45 * 60 * 1000,  // Increase from 30 to 45 minutes
    },
  },
};
```

## Monitoring & Debugging

### Check Stalled Jobs

```bash
# Connect to Redis
redis-cli

# List all transcription queues
KEYS bull:transcription*

# Check waiting jobs
LLEN bull:transcription-queue:wait

# Check active jobs
LLEN bull:transcription-queue:active

# Check failed jobs
LLEN bull:transcription-queue:failed

# Check completed jobs
LLEN bull:transcription-queue:completed

# View stalled job details
HGETALL bull:transcription-queue:<job-id>
```

### Check Worker Logs

```bash
# View worker logs
pm2 logs worker-transcription

# View specific error logs
pm2 logs worker-transcription --err --lines 100

# Check stalled job events
pm2 logs worker-transcription | grep "stalled"

# Check retry events
pm2 logs worker-transcription | grep "Attempt"
```

### Check Meeting Status

```bash
# MongoDB query
mongo
use meno
db.meetings.findOne(
  { _id: ObjectId("meeting-id") },
  { transcriptionStatus: 1, transcriptionProgress: 1, metadata: 1 }
)
```

### Check Job Status via API

```javascript
const queueService = require('./src/core/queue/queue.service');

// Check job status
const status = await queueService.getJobStatus('transcription-meeting-id');
console.log(status);
// {
//   status: 'active',     // waiting, active, completed, failed, delayed
//   progress: 45,
//   failedReason: null,
//   attemptsMade: 0,
//   data: { meetingId, audioUri, options }
// }

// Check queue metrics
const metrics = await queueService.getQueueMetrics();
console.log(metrics);
// {
//   waiting: 5,
//   active: 2,
//   completed: 100,
//   failed: 3,
//   delayed: 0,
//   total: 110
// }
```

## Best Practices

### 1. Enable Redis Persistence

Ensure Redis persistence is enabled so jobs survive Redis restarts:

```bash
# /etc/redis/redis.conf
save 900 1      # Save after 900 sec if 1 key changed
save 300 10     # Save after 300 sec if 10 keys changed
save 60 10000   # Save after 60 sec if 10000 keys changed

appendonly yes  # Enable AOF for better durability
```

### 2. Monitor Worker Health

```bash
# Set up health check script
cat > check-workers.sh << 'EOF'
#!/bin/bash
ACTIVE=$(pm2 jlist | jq '[.[] | select(.name | startswith("worker"))] | length')
if [ "$ACTIVE" -lt 2 ]; then
  echo "WARNING: Only $ACTIVE workers running"
  pm2 restart ecosystem.config.yml
fi
EOF

# Run via cron every 5 minutes
*/5 * * * * /path/to/check-workers.sh
```

### 3. Set Up Alerts

```javascript
// Monitor failed jobs and alert
const queueService = require('./src/core/queue/queue.service');

setInterval(async () => {
  const metrics = await queueService.getQueueMetrics();

  if (metrics.failed > 10) {
    // Send alert (Slack, email, PagerDuty, etc.)
    console.error(`ALERT: ${metrics.failed} failed jobs in queue`);
  }

  if (metrics.active === 0 && metrics.waiting > 0) {
    console.error('ALERT: Jobs waiting but no active workers');
  }
}, 60000); // Check every minute
```

### 4. Graceful Shutdown

Always use graceful shutdown to let workers finish current jobs:

```bash
# Good: Graceful shutdown
pm2 reload worker-transcription

# Bad: Abrupt termination
pm2 restart worker-transcription
kill -9 <pid>
```

### 5. Log Retention

Keep logs long enough to debug issues:

```bash
# Install log rotation
pm2 install pm2-logrotate

# Configure retention
pm2 set pm2-logrotate:retain 30  # Keep 30 days of logs
pm2 set pm2-logrotate:max_size 100M
```

## Testing Fault Tolerance

### Simulate Worker Crash

```bash
# Start worker
pm2 start ecosystem.config.yml --only worker-transcription

# Trigger a transcription job
curl -X POST http://localhost:3000/api/.../transcription/start

# Wait 5 seconds, then kill worker
sleep 5
pm2 stop worker-transcription

# Wait for stall detection (~30s)
sleep 35

# Restart worker
pm2 start ecosystem.config.yml --only worker-transcription

# Check logs - should see job retried
pm2 logs worker-transcription
```

### Simulate Redis Outage

```bash
# Stop Redis
docker stop meno-redis

# Trigger transcription (should queue in memory briefly)
curl -X POST http://localhost:3000/api/.../transcription/start

# Wait 10 seconds
sleep 10

# Start Redis
docker start meno-redis

# Job should be retried automatically
```

### Simulate MongoDB Outage

```bash
# Stop MongoDB
docker stop meno-mongodb

# Watch worker logs (should see connection errors)
pm2 logs worker-transcription

# Start MongoDB
docker start meno-mongodb

# Jobs should retry and complete
```

## Summary

| Failure Type | Recovery Time | Data Loss | User Impact |
|--------------|---------------|-----------|-------------|
| Worker crash | ~30 seconds | None | Brief delay |
| Redis outage | Immediate (when reconnects) | None | Queue paused |
| MongoDB outage | ~1-4 seconds (backoff) | None | Brief delay |
| All retries fail | N/A (permanent) | Partial | Manual fix needed |
| Timeout exceeded | Immediate retry | None | Job failed (wrong queue) |
| Graceful shutdown | 0 seconds | None | None |

**Key Takeaways:**
- ✅ Jobs are never lost due to worker crashes
- ✅ Data persists through failures (progressive saves)
- ✅ Automatic retry handles transient failures
- ✅ Failed jobs kept for 7 days for debugging
- ⚠️ Permanent failures require manual intervention
- ⚠️ Use correct queue (regular vs large) for timeouts
