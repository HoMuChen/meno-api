# PM2 Quick Reference Card

Quick command reference for managing Meno API and workers with PM2.

## Quick Start

```bash
# Install PM2 globally
npm install -g pm2

# Start all services (production)
npm run pm2:start

# Start all services (development)
npm run pm2:start:dev

# View status
npm run pm2:status
```

## Process Overview

| Process | Description | Instances | Concurrency | Memory |
|---------|-------------|-----------|-------------|--------|
| `meno-api` | HTTP API Server | 2 (cluster) | N/A | 500MB |
| `meno-worker-transcription` | Regular transcriptions (≤40min) | 1 | 5 jobs | 1GB |
| `meno-worker-transcription-large` | Large transcriptions (>40min) | 1 | 2 jobs | 2GB |

## NPM Scripts

```bash
npm run pm2:start          # Start all services
npm run pm2:start:dev      # Start in development mode
npm run pm2:stop           # Stop all services
npm run pm2:restart        # Restart all services
npm run pm2:reload         # Graceful reload (zero-downtime)
npm run pm2:delete         # Remove all services from PM2
npm run pm2:logs           # View logs
npm run pm2:status         # Show status
npm run pm2:monit          # Real-time monitoring
```

## Essential Commands

### Start/Stop
```bash
# Start
pm2 start ecosystem.config.js
pm2 start ecosystem.config.js --only meno-api
pm2 start ecosystem.config.js --only meno-worker-transcription

# Stop
pm2 stop all
pm2 stop meno-api
pm2 stop meno-worker-transcription

# Restart
pm2 restart all
pm2 restart meno-api

# Graceful reload (zero-downtime)
pm2 reload meno-api
```

### Monitoring
```bash
# View status
pm2 status
pm2 list

# View logs
pm2 logs                              # All processes
pm2 logs meno-api                     # Specific process
pm2 logs --lines 50                   # Last 50 lines
pm2 logs --err                        # Error logs only

# Real-time monitoring
pm2 monit

# Process details
pm2 show meno-api
pm2 describe meno-worker-transcription
```

### Scaling
```bash
# Scale workers
pm2 scale meno-worker-transcription 3
pm2 scale meno-worker-transcription-large 2

# Scale API (cluster mode)
pm2 scale meno-api 4
```

### Persistence
```bash
# Auto-start on server reboot
pm2 startup
pm2 save

# Disable auto-start
pm2 unstartup
```

## Common Tasks

### Deploy Code Update
```bash
git pull
npm install
pm2 reload ecosystem.config.js  # Zero-downtime reload
```

### Check Worker Health
```bash
pm2 logs meno-worker-transcription --lines 20
pm2 describe meno-worker-transcription
```

### Check Queue Status
```bash
redis-cli
KEYS bull:transcription*
LLEN bull:transcription-queue:wait
LLEN bull:transcription-large-queue:wait
```

### View API Logs
```bash
# PM2 logs
pm2 logs meno-api

# Winston logs (NODE_ENV=production)
tail -f logs/combined.log
tail -f logs/error.log
```

### Restart After Error
```bash
pm2 restart meno-worker-transcription
pm2 logs meno-worker-transcription --lines 50
```

## Troubleshooting

### Process Not Starting
```bash
pm2 logs <process-name> --err
pm2 describe <process-name>
node src/server.js  # Test manually
node src/worker/index.js --type transcription -c 2  # Test worker
```

### High Memory Usage
```bash
pm2 list  # Check memory
pm2 restart <process-name>
# Adjust max_memory_restart in ecosystem.config.js
```

### Worker Stuck
```bash
pm2 restart meno-worker-transcription
redis-cli KEYS bull:transcription-queue:*
# Check Redis connection
redis-cli ping
```

### View Crash Logs
```bash
pm2 logs <process-name> --err --lines 100
cat logs/pm2/<process-name>-error.log
```

## Log Rotation

```bash
# Install log rotation module
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Production Deployment Checklist

- [ ] Install PM2: `npm install -g pm2`
- [ ] Start services: `pm2 start ecosystem.config.js`
- [ ] Verify status: `pm2 status`
- [ ] Check logs: `pm2 logs`
- [ ] Enable auto-start: `pm2 startup && pm2 save`
- [ ] Setup log rotation: `pm2 install pm2-logrotate`
- [ ] Test API: `curl http://localhost:3000/health`
- [ ] Monitor: `pm2 monit`

## File Locations

```
meno-api/
├── ecosystem.config.js          # PM2 configuration (JavaScript)
├── ecosystem.config.yml         # PM2 configuration (YAML)
├── PM2_DEPLOYMENT.md            # Comprehensive deployment guide
├── PM2_QUICK_REFERENCE.md       # This file
└── logs/
    ├── pm2/                     # PM2 process logs
    │   ├── api-error.log
    │   ├── api-out.log
    │   ├── worker-transcription-error.log
    │   ├── worker-transcription-out.log
    │   ├── worker-large-error.log
    │   └── worker-large-out.log
    ├── combined.log             # Winston combined log
    └── error.log                # Winston error log
```

## Environment Variables

Set in `.env` file:
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/meno
REDIS_HOST=localhost
REDIS_PORT=6379
WORKER_CONCURRENCY=5
```

## Resources

- Full Guide: `PM2_DEPLOYMENT.md`
- Worker Setup: `WORKER_SETUP.md`
- PM2 Docs: https://pm2.keymetrics.io/docs/usage/quick-start/
