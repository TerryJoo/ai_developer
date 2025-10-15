# Testing Guide - AI Developer Automation System

비즈니스 로직 검증을 위한 종합 테스트 가이드

## 📋 목차

- [테스트 전략](#테스트-전략)
- [테스트 구조](#테스트-구조)
- [테스트 실행](#테스트-실행)
- [테스트 작성 가이드](#테스트-작성-가이드)
- [모범 사례](#모범 사례)
- [커버리지 목표](#커버리지-목표)

---

## 🎯 테스트 전략

### Testing Pyramid

```
        ┌─────────────┐
        │   E2E (10%) │  ← 완전한 워크플로우 검증
        ├─────────────┤
        │ Integration │  ← 컴포넌트 상호작용 검증
        │    (20%)    │
        ├─────────────┤
        │             │  ← 비즈니스 로직 핵심 검증
        │ Unit (70%)  │
        │             │
        └─────────────┘
```

### 테스트 레벨

| 레벨 | 목적 | 실행 시간 | 커버리지 목표 |
|------|------|----------|-------------|
| **Unit Tests** | 개별 함수/메서드 검증 | < 5초 | 90% |
| **Integration Tests** | 컴포넌트 간 상호작용 검증 | < 30초 | 70% |
| **Contract Tests** | 외부 API 계약 검증 | < 10초 | 주요 API 100% |
| **E2E Tests** | 완전한 워크플로우 검증 | < 2분 | 핵심 시나리오 100% |

---

## 📁 테스트 구조

```
tests/
├── unit/                           # 단위 테스트
│   ├── services/
│   │   ├── ai.service.test.ts
│   │   ├── automation.service.test.ts  ← 비즈니스 로직 핵심
│   │   ├── github.service.test.ts
│   │   └── code-generator.test.ts
│   ├── handlers/
│   │   └── webhook.handler.test.ts
│   └── utils/
│       └── logger.test.ts
│
├── integration/                    # 통합 테스트
│   ├── workflows/
│   │   ├── bug-fix-workflow.test.ts     ← 버그 수정 플로우
│   │   ├── feature-workflow.test.ts      ← 기능 구현 플로우
│   │   ├── test-generation-workflow.test.ts
│   │   └── refactor-workflow.test.ts
│   └── api/
│       └── github-integration.test.ts
│
├── contracts/                      # 계약 테스트
│   └── github/
│       ├── issues-api.contract.test.ts
│       └── pulls-api.contract.test.ts
│
├── fixtures/                       # 테스트 데이터
│   ├── test-payloads.ts            ← 테스트용 페이로드
│   └── github-payloads/
│       ├── issue-opened.json
│       └── issue-labeled.json
│
└── helpers/                        # 테스트 헬퍼
    ├── mock-services.ts            ← Mock 서비스 팩토리
    └── test-server.ts
```

---

## 🚀 테스트 실행

### 전체 테스트 실행

```bash
# 모든 테스트 실행
deno task test

# 또는
deno test --allow-net --allow-env --allow-read
```

### 특정 테스트 실행

```bash
# 단위 테스트만
deno test tests/unit/

# 통합 테스트만
deno test tests/integration/

# 특정 파일
deno test tests/unit/services/automation.service.test.ts

# 특정 테스트 케이스 (패턴 매칭)
deno test --filter "Bug fix workflow"
```

### 커버리지 측정

```bash
# 커버리지와 함께 테스트 실행
deno test --coverage=coverage/

# 커버리지 리포트 생성
deno coverage coverage/

# HTML 리포트 생성
deno coverage coverage/ --html
```

### Watch 모드

```bash
# 파일 변경 시 자동 재실행
deno test --watch tests/unit/
```

---

## ✍️ 테스트 작성 가이드

### 1. Unit Test 작성 (Given-When-Then 패턴)

```typescript
import { assertEquals, assertExists } from "@std/assert/mod.ts";
import { AutomationService } from "../../../src/modules/automation/automation.service.ts";

Deno.test("AutomationService - processIssue", async (t) => {
  await t.step("Given: Valid bug issue payload", () => {
    // Arrange - 테스트 데이터 준비
    const payload = {
      issueNumber: 42,
      title: "Login fails",
      body: "Authentication error",
      labels: ["bug", "automate"],
      repository: { owner: "test", name: "repo" }
    };

    assertEquals(payload.labels.includes("bug"), true);
  });

  await t.step("When: Issue is processed", async () => {
    // Act - 비즈니스 로직 실행
    const service = new AutomationService();
    // await service.processIssue(payload);
  });

  await t.step("Then: Bug fix workflow is triggered", () => {
    // Assert - 결과 검증
    const service = new AutomationService();
    const workflow = (service as any).determineWorkflow(["bug"], {});
    assertEquals(workflow, "bug-fix");
  });
});
```

### 2. Integration Test 작성

```typescript
Deno.test("Bug Fix Workflow - Complete Integration", async (t) => {
  await t.step("Scenario: Issue triggers automated fix", async (st) => {
    await st.step("Step 1: Issue is analyzed", async () => {
      // 이슈 분석 검증
    });

    await st.step("Step 2: Branch is created", () => {
      // 브랜치 생성 검증
    });

    await st.step("Step 3: Code is generated", async () => {
      // 코드 생성 검증
    });

    await st.step("Step 4: PR is created", async () => {
      // PR 생성 검증
    });
  });
});
```

### 3. Mock 사용

```typescript
import { createMockGitHubService, createMockAIService } from "../../helpers/mock-services.ts";

Deno.test("Service with mocked dependencies", async () => {
  // Mock 서비스 생성
  const mockGitHub = createMockGitHubService();
  const mockAI = createMockAIService();

  // Mock 동작 정의
  const analysis = await mockAI.analyzeIssue({
    title: "Bug",
    body: "Description"
  });

  // 검증
  assertExists(analysis);
  assertEquals(analysis.suggestedWorkflow, "bug-fix");
});
```

### 4. Fixture 사용

```typescript
import { testScenarios, webhookPayloads } from "../../fixtures/test-payloads.ts";

Deno.test("Using predefined fixtures", () => {
  // 미리 정의된 테스트 시나리오 사용
  const bugIssue = testScenarios.bugIssue;
  const webhook = webhookPayloads.issueOpened;

  assertEquals(bugIssue.labels.includes("bug"), true);
  assertExists(webhook.issue);
});
```

---

## 🎯 비즈니스 로직 테스트 체크리스트

### AutomationService (핵심 비즈니스 로직)

- [ ] **processIssue()**
  - [ ] 버그 라벨이 있는 이슈 → 버그 수정 워크플로우
  - [ ] 기능 라벨이 있는 이슈 → 기능 구현 워크플로우
  - [ ] 리팩토링 라벨 → 리팩토링 워크플로우
  - [ ] 테스트 라벨 → 테스트 생성 워크플로우
  - [ ] 잘못된 페이로드 → 에러 처리

- [ ] **executeCommand()**
  - [ ] `@ai-dev generate-tests` → 테스트 생성
  - [ ] `@ai-dev fix-bug` → 버그 수정
  - [ ] `@ai-dev implement` → 기능 구현
  - [ ] `/automate refactor` → 리팩토링
  - [ ] 잘못된 명령어 → 도움말 표시

- [ ] **determineWorkflow()**
  - [ ] 라벨 우선순위 (bug > feature > refactor > test)
  - [ ] AI 제안 폴백
  - [ ] 기본 워크플로우 (generic)

- [ ] **워크플로우 실행**
  - [ ] 브랜치 생성
  - [ ] 코드 생성
  - [ ] 파일 커밋
  - [ ] PR 생성
  - [ ] 이슈 업데이트

### AIService

- [ ] **analyzeIssue()**
  - [ ] 이슈 분석 및 워크플로우 제안
  - [ ] 복잡도 평가
  - [ ] 필요한 파일 식별
  - [ ] 종속성 분석

- [ ] **generateCode()**
  - [ ] TypeScript 코드 생성
  - [ ] JavaScript 코드 생성
  - [ ] 적절한 구조와 스타일

- [ ] **reviewCode()**
  - [ ] 코드 품질 분석
  - [ ] 개선 제안 생성
  - [ ] 승인/변경 요청 결정

### GitHubService

- [ ] **createIssueComment()**
  - [ ] 정상적인 댓글 생성
  - [ ] 에러 처리

- [ ] **createPullRequest()**
  - [ ] PR 생성 및 번호 반환
  - [ ] 올바른 브랜치 지정

- [ ] **createBranch()**
  - [ ] 새 브랜치 생성
  - [ ] 기본 브랜치로부터 생성

- [ ] **commitFile()**
  - [ ] 새 파일 생성
  - [ ] 기존 파일 업데이트

---

## 📊 모범 사례

### ✅ DO

1. **Given-When-Then 패턴 사용**
   ```typescript
   await t.step("Given: 초기 상태", () => {});
   await t.step("When: 동작 실행", () => {});
   await t.step("Then: 결과 검증", () => {});
   ```

2. **명확한 테스트 이름**
   ```typescript
   Deno.test("processIssue - bug label triggers bug fix workflow", async () => {});
   ```

3. **독립적인 테스트**
   - 각 테스트는 다른 테스트에 의존하지 않음
   - 실행 순서에 관계없이 통과

4. **Mock을 활용한 외부 의존성 격리**
   ```typescript
   const mockGitHub = createMockGitHubService();
   const mockAI = createMockAIService();
   ```

5. **의미 있는 Assertion**
   ```typescript
   assertEquals(workflow, "bug-fix");
   assertExists(analysis.summary);
   ```

### ❌ DON'T

1. **실제 외부 API 호출하지 않기**
   ```typescript
   // ❌ Bad
   await realGitHubAPI.createIssue();

   // ✅ Good
   await mockGitHub.createIssue();
   ```

2. **테스트 간 상태 공유하지 않기**
   ```typescript
   // ❌ Bad - 전역 변수 사용
   let sharedState = {};

   // ✅ Good - 각 테스트에서 새로 생성
   const state = createTestState();
   ```

3. **너무 많은 것을 한 테스트에서 검증하지 않기**
   ```typescript
   // ❌ Bad - 한 테스트에서 너무 많이 검증
   Deno.test("Everything", () => {
     // 10가지 다른 것들 검증
   });

   // ✅ Good - 하나의 동작만 검증
   Deno.test("processIssue - triggers correct workflow", () => {});
   ```

---

## 📈 커버리지 목표

### 전체 목표

- **전체 커버리지**: ≥ 80%
- **비즈니스 로직**: ≥ 90%
- **핵심 경로**: ≥ 95%

### 컴포넌트별 목표

| 컴포넌트 | 목표 커버리지 | 우선순위 |
|---------|-------------|---------|
| AutomationService | 95% | 🔴 Critical |
| AIService | 90% | 🔴 Critical |
| CodeGenerator | 90% | 🔴 Critical |
| GitHubService | 85% | 🟡 High |
| WebhookHandler | 85% | 🟡 High |
| Logger | 70% | 🟢 Medium |

### 커버리지 확인

```bash
# 커버리지 측정
deno test --coverage=coverage/

# 리포트 확인
deno coverage coverage/

# 상세 리포트 (파일별)
deno coverage coverage/ --detailed

# HTML 리포트 생성
deno coverage coverage/ --html
open coverage/html/index.html
```

---

## 🔧 CI/CD 통합

### GitHub Actions 예제

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.40

      - name: Run tests
        run: deno task test

      - name: Generate coverage
        run: |
          deno test --coverage=coverage/
          deno coverage coverage/ --lcov > coverage.lcov

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.lcov
```

---

## 🎓 추가 리소스

### Deno 테스팅 문서
- [Deno Testing](https://deno.land/manual/testing)
- [Assertions](https://deno.land/std/assert)

### 테스트 패턴
- [Given-When-Then](https://martinfowler.com/bliki/GivenWhenThen.html)
- [Test Doubles](https://martinfowler.com/bliki/TestDouble.html)

### 예제
- `tests/unit/services/automation.service.test.ts` - 단위 테스트 예제
- `tests/integration/workflows/bug-fix-workflow.test.ts` - 통합 테스트 예제
- `tests/helpers/mock-services.ts` - Mock 패턴 예제
- `tests/fixtures/test-payloads.ts` - Fixture 사용 예제

---

## 📝 요약

1. **Testing Pyramid 준수**: Unit 70%, Integration 20%, E2E 10%
2. **Given-When-Then 패턴**: 명확한 테스트 구조
3. **Mock 활용**: 외부 의존성 격리
4. **Fixture 사용**: 재사용 가능한 테스트 데이터
5. **높은 커버리지**: 비즈니스 로직 90%+ 목표
6. **자동화**: CI/CD 파이프라인 통합

---

**테스트는 코드의 안전망입니다. 철저한 테스트로 안정적인 자동화 시스템을 구축하세요!** 🚀