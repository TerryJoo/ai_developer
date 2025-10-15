# 🚀 Quick Start Guide - AI Developer Automation System

**5분 안에 시작하기**

## 📋 Prerequisites

```bash
# 1. Deno 설치 확인
deno --version

# 없다면 설치
curl -fsSL https://deno.land/x/install/install.sh | sh

# 2. Redis 설치 & 시작
# macOS
brew install redis && brew services start redis

# Docker
docker run -d -p 6379:6379 redis:alpine

# Linux
sudo apt-get install redis-server && sudo systemctl start redis
```

## ⚡ 빠른 실행 (3 steps)

### Step 1: 환경 설정
```bash
# .env 파일 생성
cp .env.example .env

# 최소 필수 설정 (편집기로 .env 열기)
GITHUB_TOKEN=ghp_your_token_here
OPENAI_API_KEY=sk-your_key_here
# 또는
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

### Step 2: 실행
```bash
deno task start
```

### Step 3: 테스트
```bash
# 새 터미널에서
curl http://localhost:8000/health

# 응답 확인:
# {"status":"healthy","timestamp":"...","service":"AI Developer Automation"}
```

## ✅ 완료!

시스템이 실행 중입니다:
- 🌐 API: http://localhost:8000
- 📊 Metrics: http://localhost:8000/metrics
- 📋 Dashboard API: http://localhost:8000/api/status

## 🎯 다음 단계

### 1. GitHub Webhook 설정
```
Repository Settings → Webhooks → Add webhook
- URL: http://your-server:8000/webhook/github
- Content type: application/json
- Secret: (GITHUB_WEBHOOK_SECRET from .env)
- Events: Issues, Issue comments, Pull requests
```

### 2. 테스트 이슈 생성
```markdown
Title: Test AI automation
Labels: automate, bug
Body: Test issue to verify automation
```

### 3. 로그 확인
```bash
# 실시간 로그 보기
tail -f logs/app.log

# 또는 애플리케이션 출력 확인
```

## 🔧 문제 해결

### Redis 연결 실패
```bash
# Redis 상태 확인
redis-cli ping
# 응답: PONG

# Redis 재시작
brew services restart redis  # macOS
sudo systemctl restart redis  # Linux
```

### AI API 키 에러
```bash
# OpenAI 키 테스트
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Anthropic 키 테스트
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

### 포트 충돌
```bash
# .env 파일에서 포트 변경
PORT=8001  # 다른 포트 사용
```

## 📚 더 알아보기

- 📖 [완전한 배포 가이드](DEPLOYMENT.md)
- 🧪 [테스트 가이드](TESTING.md)
- 📋 [프로젝트 완성 보고서](PROJECT_COMPLETE.md)
- 🎓 [구현 상세](PHASE_3_4_5_COMPLETE.md)

## 💡 유용한 명령어

```bash
# 개발 모드 (auto-reload)
deno task dev

# 테스트 실행
deno task test

# 코드 포맷
deno task fmt

# 린트
deno task lint

# 특정 테스트 실행
deno test tests/unit/ai/cache.test.ts

# 커버리지 확인
deno test --coverage=coverage/
deno coverage coverage/
```

---

**준비 완료! Happy Coding! 🎉**
