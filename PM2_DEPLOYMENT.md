# PM2 Deployment Guide

Comprehensive guide for deploying Meno API and workers using PM2 process manager.

## Prerequisites

1. **Install PM2 globally**:
```bash
npm install -g pm2
```

2. **Verify installation**:
```bash
pm2 --version
```

3. **Ensure services are running**:
   - MongoDB
   - Redis

## Quick Start

### Start All Services

```bash
# Production mode (recommended)
pm2 start ecosystem.config.js

# Development mode
pm2 start ecosystem.config.js --env development
```

This starts:
- **meno-api**: HTTP API server (2 instances, cluster mode)
- **meno-worker-transcription**: Regular transcription worker (≤40 min meetings)
- **meno-worker-transcription-large**: Large transcription worker (>40 min meetings)

### Check Status

```bash
# View all processes
pm2 status

# Detailed info
pm2 show meno-api
pm2 show meno-worker-transcription
pm2 show meno-worker-transcription-large
```

### View Logs

```bash
# All processes
pm2 logs

# Specific process
pm2 logs meno-api
pm2 logs meno-worker-transcription
pm2 logs meno-worker-transcription-large

# Last 200 lines
pm2 logs --lines 200

# Real-time streaming
pm2 logs --raw
```

## Process Management

### Start/Stop/Restart Individual Processes

```bash
# Start specific process
pm2 start ecosystem.config.js --only meno-api
pm2 start ecosystem.config.js --only meno-worker-transcription
pm2 start ecosystem.config.js --only meno-worker-transcription-large

# Stop specific process
pm2 stop meno-api
pm2 stop meno-worker-transcription

# Restart specific process
pm2 restart meno-api
pm2 restart meno-worker-transcription

# Graceful reload (zero-downtime for API)
pm2 reload meno-api

# Delete process from PM2
pm2 delete meno-api
```

### Stop/Restart All Processes

```bash
# Stop all
pm2 stop all

# Restart all
pm2 restart all

# Graceful reload all
pm2 reload all

# Delete all
pm2 delete all
```

## Configuration Overview

### Process Configuration

| Process | Instances | Mode | Concurrency | Memory Limit | Kill Timeout |
|---------|-----------|------|-------------|--------------|--------------|
| meno-api | 2 | cluster | N/A | 500MB | 5s |
| meno-worker-transcription | 1 | fork | 5 | 1GB | 30s |
| meno-worker-transcription-large | 1 | fork | 2 | 2GB | 60s |

### Log Files

All logs are stored in `./logs/pm2/`:
- `api-error.log` - API server errors
- `api-out.log` - API server output
- `worker-transcription-error.log` - Regular worker errors
- `worker-transcription-out.log` - Regular worker output
- `worker-large-error.log` - Large worker errors
- `worker-large-out.log` - Large worker output

## Advanced Usage

### Scaling Workers

Scale transcription workers based on load:

```bash
# Add more regular transcription workers
pm2 scale meno-worker-transcription 3  # Run 3 instances

# Add more large transcription workers
pm2 scale meno-worker-transcription-large 2  # Run 2 instances

# Scale back down
pm2 scale meno-worker-transcription 1
```

**Note**: Each worker instance processes jobs concurrently based on `--concurrency` flag.

### Monitoring

```bash
# Real-time monitoring dashboard
pm2 monit

# Process metrics
pm2 describe meno-api

# CPU and memory usage
pm2 list
```

### Environment Variables

**Production**:
```bash
pm2 start ecosystem.config.js --env production
```

**Development**:
```bash
pm2 start ecosystem.config.js --env development
```

**Custom Environment**:
Create a `.env` file and PM2 will load it automatically.

### Startup Script (Auto-start on Server Reboot)

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Verify
pm2 list

# On next reboot, PM2 will auto-start all saved processes
```

**To disable auto-start**:
```bash
pm2 unstartup
```

### Update After Code Changes

```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Graceful reload (zero-downtime for API)
pm2 reload ecosystem.config.js

# OR restart all (brief downtime)
pm2 restart ecosystem.config.js
```

## Production Best Practices

### 1. Enable Startup Script

```bash
pm2 startup
pm2 save
```

### 2. Configure Log Rotation

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure rotation (optional)
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 3. Monitor Memory and CPU

```bash
# Enable monitoring
pm2 monit

# Check for memory leaks
pm2 describe meno-api
```

### 4. Use Process File

Always use `ecosystem.config.js` for consistency:
```bash
pm2 start ecosystem.config.js
```

### 5. Graceful Shutdown

The configuration includes `kill_timeout` for graceful shutdown:
- API: 5 seconds
- Regular worker: 30 seconds (finish current jobs)
- Large worker: 60 seconds (finish long transcriptions)

## Deployment Scenarios

### Scenario 1: Single Server (Small Scale)

```bash
# Start all services on one server
pm2 start ecosystem.config.js

# Status
pm2 status
```

### Scenario 2: Dedicated Workers (Medium Scale)

**Server 1** (API only):
```bash
pm2 start ecosystem.config.js --only meno-api
```

**Server 2** (Workers only):
```bash
pm2 start ecosystem.config.js --only meno-worker-transcription
pm2 start ecosystem.config.js --only meno-worker-transcription-large
```

### Scenario 3: High Availability (Large Scale)

**Load Balancer** → Multiple API servers

**API Servers** (2-3 servers):
```bash
pm2 start ecosystem.config.js --only meno-api
```

**Worker Servers** (dedicated):

**Worker Server 1** (regular transcriptions):
```bash
pm2 start ecosystem.config.js --only meno-worker-transcription
pm2 scale meno-worker-transcription 3  # 3 instances
```

**Worker Server 2** (large transcriptions):
```bash
pm2 start ecosystem.config.js --only meno-worker-transcription-large
pm2 scale meno-worker-transcription-large 2  # 2 instances
```

### Scenario 4: Development Environment

```bash
# Start in development mode
pm2 start ecosystem.config.js --env development

# Lower concurrency for local development
# (configured in ecosystem.config.js)
```

## Troubleshooting

### Process Not Starting

```bash
# Check logs
pm2 logs meno-worker-transcription --lines 50

# Check process details
pm2 describe meno-worker-transcription

# Manually test worker
node src/worker/index.js --type transcription -c 2
```

### High Memory Usage

```bash
# Check memory
pm2 list

# Restart if needed
pm2 restart meno-worker-transcription

# Adjust max_memory_restart in ecosystem.config.js
```

### Worker Not Processing Jobs

1. **Check Redis connection**:
```bash
redis-cli ping
```

2. **Check worker logs**:
```bash
pm2 logs meno-worker-transcription
```

3. **Verify queue**:
```bash
redis-cli
KEYS *transcription*
LLEN bull:transcription-queue:wait
```

4. **Restart worker**:
```bash
pm2 restart meno-worker-transcription
```

### Process Keeps Restarting

```bash
# Check restart count
pm2 list

# View error logs
pm2 logs meno-worker-transcription --err

# Increase min_uptime in ecosystem.config.js if app needs more startup time
```

## PM2 Commands Reference

### Process Management
```bash
pm2 start <config>           # Start processes
pm2 stop <name|id|all>       # Stop processes
pm2 restart <name|id|all>    # Restart processes
pm2 reload <name|id|all>     # Graceful reload
pm2 delete <name|id|all>     # Delete processes
pm2 scale <name> <number>    # Scale instances
```

### Monitoring
```bash
pm2 list                     # List all processes
pm2 status                   # Show status
pm2 show <name|id>           # Detailed info
pm2 monit                    # Real-time monitoring
pm2 logs [name]              # View logs
pm2 flush                    # Clear all logs
```

### Persistence
```bash
pm2 save                     # Save process list
pm2 resurrect                # Restore saved processes
pm2 startup                  # Generate startup script
pm2 unstartup                # Remove startup script
```

### Updates
```bash
pm2 update                   # Update PM2
pm2 reset <name|id>          # Reset restart count
```

## Integration with CI/CD

### Example GitHub Actions Workflow

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /path/to/meno-api
            git pull
            npm install
            pm2 reload ecosystem.config.js
```

## Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Cluster Mode](https://pm2.keymetrics.io/docs/usage/cluster-mode/)
- [PM2 Process Management](https://pm2.keymetrics.io/docs/usage/process-management/)

## Health Checks

### API Health Check
```bash
curl http://localhost:3000/health
```

### Worker Health Check
```bash
# Check if workers are processing
pm2 logs meno-worker-transcription --lines 10

# Check Redis queue
redis-cli
KEYS bull:transcription*
```

### Monitor All Services
```bash
# Create monitoring script
pm2 monit &

# Or use systemd to monitor PM2
sudo systemctl status pm2-$(whoami)
```
