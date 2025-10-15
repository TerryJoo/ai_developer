# Deployment Guide

AI Developer Automation System 배포 및 운영 가이드

## Prerequisites

### Required
- Deno 1.40+ (`curl -fsSL https://deno.land/install.sh | sh`)
- Redis Server (`brew install redis` or Docker)
- SQLite (built-in)

### API Keys
- GitHub Personal Access Token (https://github.com/settings/tokens)
- OpenAI API Key (https://platform.openai.com/api-keys) OR
- Anthropic API Key (https://console.anthropic.com/)

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd ai_developer
cp .env.example .env
```

### 2. Configure Environment Variables
Edit `.env` file:
```bash
# Required
GITHUB_TOKEN=ghp_your_token_here
GITHUB_WEBHOOK_SECRET=your_secret_here
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...

# Optional
REDIS_URL=redis://localhost:6379
SQLITE_PATH=./data/automation.db
PORT=8000
```

### 3. Initialize Database
```bash
# SQLite database is auto-created on first run
mkdir -p data logs
```

### 4. Start Redis
```bash
# Option 1: Homebrew
brew services start redis

# Option 2: Docker
docker run -d -p 6379:6379 redis:alpine

# Option 3: Manual
redis-server
```

### 5. Run Application
```bash
# Development
deno task dev

# Production
deno task start
```

## Configuration

### AI Provider Selection
```bash
AI_PROVIDER=openai        # or anthropic or multi
OPENAI_MODEL=gpt-4-turbo-preview
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### Cost Management
```bash
COST_TRACKING_ENABLED=true
COST_BUDGET_MONTHLY=1000.00
COST_ALERT_THRESHOLD=100.00
```

### Cache Settings
```bash
AI_CACHE_ENABLED=true
AI_CACHE_TTL=3600         # 1 hour
```

### Worker Configuration
```bash
WORKER_POOL_SIZE=3
QUEUE_CONCURRENCY=5
QUEUE_MAX_JOBS=1000
```

## GitHub Webhook Setup

### 1. Navigate to Repository Settings
`Settings → Webhooks → Add webhook`

### 2. Configure Webhook
- **Payload URL**: `https://your-domain.com/webhook/github`
- **Content type**: `application/json`
- **Secret**: Same as `GITHUB_WEBHOOK_SECRET` in `.env`
- **Events**:
  - Issues
  - Pull requests
  - Issue comments
  - Pull request reviews

### 3. Test Webhook
```bash
# Check webhook endpoint
curl http://localhost:8000/health
```

## Docker Deployment

### Using Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: denoland/deno:alpine
    working_dir: /app
    volumes:
      - .:/app
      - ./data:/app/data
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
    command: deno task start
    depends_on:
      - redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

```bash
docker-compose up -d
```

## Monitoring & Maintenance

### Health Check
```bash
curl http://localhost:8000/health
```

### API Endpoints
```bash
# System status
GET /api/status

# Metrics
GET /api/metrics

# Cost tracking
GET /api/costs
```

### View Logs
```bash
tail -f logs/app.log
```

### Cache Management
```bash
# View cache status
redis-cli
> KEYS ai:cache:*
> GET ai:cache:metrics
```

### Database Backup
```bash
# SQLite backup
cp data/automation.db data/automation.db.backup
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Redis server running
- [ ] GitHub webhook configured and tested
- [ ] Cost alerts configured
- [ ] Monitoring enabled
- [ ] Log rotation configured
- [ ] Database backup scheduled
- [ ] SSL/TLS certificate installed (if public)
- [ ] Rate limiting configured
- [ ] API key security verified

## Troubleshooting

### Issue: "No AI providers configured"
**Solution**: Check `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`

### Issue: Redis connection failed
**Solution**:
```bash
redis-cli ping  # Should return PONG
# Check REDIS_URL in .env
```

### Issue: Webhook signature validation failed
**Solution**: Verify `GITHUB_WEBHOOK_SECRET` matches GitHub webhook config

### Issue: High AI costs
**Solution**:
- Enable caching: `AI_CACHE_ENABLED=true`
- Lower budget: `COST_BUDGET_MONTHLY=500.00`
- Use cheaper models: `AI_PROVIDER=anthropic`

## Scaling

### Horizontal Scaling
```bash
# Run multiple workers
WORKER_POOL_SIZE=10 deno task start

# Or run separate worker processes
deno run --allow-all src/queue/worker-process.ts
```

### Redis Cluster
For high availability, use Redis Cluster or Redis Sentinel

### Load Balancer
Use nginx or HAProxy for multiple instances

## Support

- Documentation: `README.md`
- Issues: GitHub Issues
- Logs: `./logs/app.log`
