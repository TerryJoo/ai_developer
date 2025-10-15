export function generateOverviewHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Developer - Project Overview</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }

        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        header p {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 20px;
            margin-top: 15px;
            font-size: 0.9em;
        }

        nav {
            background: #f8f9fa;
            padding: 15px 40px;
            border-bottom: 1px solid #e0e0e0;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        nav a {
            color: #667eea;
            text-decoration: none;
            margin-right: 25px;
            font-weight: 500;
            transition: color 0.3s;
        }

        nav a:hover {
            color: #764ba2;
        }

        .content {
            padding: 40px;
        }

        section {
            margin-bottom: 50px;
        }

        h2 {
            color: #667eea;
            font-size: 2em;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }

        h3 {
            color: #764ba2;
            font-size: 1.5em;
            margin: 25px 0 15px 0;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .feature-card {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .feature-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.3);
        }

        .feature-card h4 {
            color: #667eea;
            margin-bottom: 10px;
        }

        .architecture-diagram {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 8px;
            margin: 20px 0;
            overflow-x: auto;
        }

        .mermaid {
            text-align: center;
        }

        .workflow {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .workflow-step {
            display: flex;
            align-items: center;
            margin: 15px 0;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }

        .workflow-step .step-number {
            background: #667eea;
            color: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-weight: bold;
        }

        .api-endpoint {
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 6px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
        }

        .api-endpoint .method {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 4px;
            font-weight: bold;
            margin-right: 10px;
        }

        .method.get { background: #61affe; color: white; }
        .method.post { background: #49cc90; color: white; }

        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            color: #e83e8c;
        }

        pre {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 15px 0;
        }

        pre code {
            background: none;
            color: #f8f8f2;
            padding: 0;
        }

        .command-box {
            background: #f8f9fa;
            border-left: 4px solid #764ba2;
            padding: 20px;
            margin: 15px 0;
            border-radius: 6px;
        }

        .command-box code {
            background: #2d2d2d;
            color: #61affe;
            padding: 4px 8px;
        }

        footer {
            background: #2d2d2d;
            color: white;
            text-align: center;
            padding: 30px;
        }

        .tech-stack {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 20px 0;
        }

        .tech-badge {
            background: #667eea;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
        }

        @media (max-width: 768px) {
            header h1 { font-size: 1.8em; }
            .content { padding: 20px; }
            nav a { display: block; margin: 10px 0; }
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
    </script>
</head>
<body>
    <div class="container">
        <header>
            <h1>🤖 AI Developer</h1>
            <p>GitHub 통합 지능형 개발 자동화 시스템</p>
            <span class="badge">v1.0.0 Prototype</span>
        </header>

        <nav>
            <a href="#introduction">소개</a>
            <a href="#architecture">아키텍처</a>
            <a href="#workflows">워크플로우</a>
            <a href="#api">API 엔드포인트</a>
            <a href="#setup">설치 및 설정</a>
            <a href="#usage">사용 방법</a>
        </nav>

        <div class="content">
            <section id="introduction">
                <h2>📋 프로젝트 소개</h2>
                <p>
                    AI Developer는 GitHub 이슈, 풀 리퀘스트, 커밋과 연동되어 자동으로 코드를 생성하고,
                    버그를 수정하며, 테스트를 작성하는 지능형 개발 자동화 시스템입니다.
                </p>

                <h3>🎯 핵심 기능</h3>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h4>🔗 GitHub 통합</h4>
                        <p>Webhook 기반으로 이슈, PR, 커밋 이벤트를 실시간으로 수신하고 처리합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>🧠 AI 분석</h4>
                        <p>이슈를 분석하여 적절한 워크플로우를 자동으로 결정합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>⚙️ 자동 코드 생성</h4>
                        <p>버그 수정, 기능 구현, 테스트 코드를 자동으로 생성합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>🔍 스마트 리뷰</h4>
                        <p>AI 기반으로 풀 리퀘스트를 자동으로 리뷰하고 피드백을 제공합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>💬 명령 기반 실행</h4>
                        <p>이슈 댓글로 특정 자동화 작업을 트리거할 수 있습니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>🚀 확장 가능</h4>
                        <p>모듈화된 아키텍처로 새로운 워크플로우를 쉽게 추가할 수 있습니다.</p>
                    </div>
                </div>
            </section>

            <section id="architecture">
                <h2>🏗️ 시스템 아키텍처</h2>

                <div class="architecture-diagram">
                    <div class="mermaid">
graph TB
    A[GitHub Event] -->|Webhook| B[Webhook Handler]
    B -->|Verify Signature| C{Event Type?}
    C -->|Issue| D[Issue Handler]
    C -->|PR| E[PR Handler]
    C -->|Comment| F[Comment Handler]
    C -->|Push| G[Push Handler]

    D --> H[AI Service]
    E --> H
    F --> H
    G --> H

    H -->|Analyze| I[Automation Engine]
    I -->|Determine Workflow| J{Workflow Type}

    J -->|Bug Fix| K[Bug Fix Workflow]
    J -->|Feature| L[Feature Workflow]
    J -->|Test| M[Test Workflow]
    J -->|Refactor| N[Refactor Workflow]

    K --> O[Code Generator]
    L --> O
    M --> O
    N --> O

    O -->|Generate Code| P[GitHub API]
    P -->|Create Branch| Q[GitHub Repository]
    P -->|Commit Files| Q
    P -->|Create PR| Q
    P -->|Add Comment| Q

    style A fill:#61affe
    style H fill:#49cc90
    style I fill:#fca130
    style O fill:#f93e3e
    style Q fill:#61affe
                    </div>
                </div>

                <h3>주요 컴포넌트</h3>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h4>Webhook Handler</h4>
                        <p>GitHub 이벤트를 수신하고 서명을 검증합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>AI Service</h4>
                        <p>이슈 분석, 코드 생성, 리뷰 등 AI 기능을 제공합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>Automation Engine</h4>
                        <p>워크플로우를 조율하고 실행합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>Code Generator</h4>
                        <p>버그 수정, 기능, 테스트 코드를 생성합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>GitHub Client</h4>
                        <p>GitHub API를 통해 저장소와 상호작용합니다.</p>
                    </div>
                </div>
            </section>

            <section id="workflows">
                <h2>🔄 워크플로우</h2>

                <h3>버그 수정 워크플로우</h3>
                <div class="workflow">
                    <p><strong>트리거:</strong> <code>bug</code> 라벨이 있는 이슈 생성</p>
                    <div class="workflow-step">
                        <div class="step-number">1</div>
                        <div>이슈 내용 분석 및 영향 범위 파악</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">2</div>
                        <div>수정용 브랜치 생성 (fix/issue-번호)</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">3</div>
                        <div>AI 기반 버그 수정 코드 생성</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">4</div>
                        <div>생성된 코드를 브랜치에 커밋</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">5</div>
                        <div>풀 리퀘스트 생성 및 이슈에 링크 추가</div>
                    </div>
                </div>

                <h3>기능 구현 워크플로우</h3>
                <div class="workflow">
                    <p><strong>트리거:</strong> <code>feature</code> 라벨이 있는 이슈 생성</p>
                    <div class="workflow-step">
                        <div class="step-number">1</div>
                        <div>요구사항 분석 및 설계</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">2</div>
                        <div>기능 브랜치 생성 (feature/issue-번호)</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">3</div>
                        <div>기능 구현 코드 생성</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">4</div>
                        <div>테스트 코드 자동 생성</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">5</div>
                        <div>풀 리퀘스트 생성 및 문서화</div>
                    </div>
                </div>

                <h3>명령 기반 실행</h3>
                <div class="workflow">
                    <p><strong>트리거:</strong> 이슈 댓글에 <code>@ai-dev</code> 또는 <code>/automate</code> 명령어</p>
                    <div class="command-box">
                        <p><code>@ai-dev generate-tests</code> - 테스트 코드 생성</p>
                        <p><code>@ai-dev fix-bug &lt;설명&gt;</code> - 특정 버그 수정</p>
                        <p><code>@ai-dev implement &lt;기능&gt;</code> - 기능 구현</p>
                        <p><code>@ai-dev refactor &lt;대상&gt;</code> - 코드 리팩토링</p>
                        <p><code>@ai-dev review</code> - 코드 리뷰</p>
                    </div>
                </div>
            </section>

            <section id="api">
                <h2>🔌 API 엔드포인트</h2>

                <div class="api-endpoint">
                    <span class="method get">GET</span>
                    <code>/</code>
                    <p>이 개요 페이지를 반환합니다.</p>
                </div>

                <div class="api-endpoint">
                    <span class="method get">GET</span>
                    <code>/health</code>
                    <p>서버 상태를 확인합니다.</p>
                    <pre><code>{
  "status": "healthy",
  "timestamp": "2025-10-15T04:57:47.514Z",
  "service": "AI Developer Automation"
}</code></pre>
                </div>

                <div class="api-endpoint">
                    <span class="method post">POST</span>
                    <code>/webhook/github</code>
                    <p>GitHub webhook 이벤트를 수신합니다.</p>
                    <p><strong>Headers:</strong> <code>x-hub-signature-256</code>, <code>x-github-event</code></p>
                </div>

                <div class="api-endpoint">
                    <span class="method post">POST</span>
                    <code>/api/automation/trigger</code>
                    <p>수동으로 자동화 워크플로우를 트리거합니다.</p>
                    <pre><code>{
  "task": "generate-tests",
  "target": "src/main.ts",
  "options": {}
}</code></pre>
                </div>
            </section>

            <section id="setup">
                <h2>⚙️ 설치 및 설정</h2>

                <h3>사전 요구사항</h3>
                <div class="tech-stack">
                    <span class="tech-badge">Deno 1.40+</span>
                    <span class="tech-badge">GitHub Account</span>
                    <span class="tech-badge">GitHub Personal Access Token</span>
                </div>

                <h3>환경 설정</h3>
                <p><code>.env</code> 파일에 다음 변수들을 설정하세요:</p>
                <pre><code>GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
PORT=8000
HOST=localhost

# 선택사항: AI API 키
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

ENV=development</code></pre>

                <h3>서버 실행</h3>
                <pre><code># 개발 모드 (자동 재시작)
deno task dev

# 프로덕션 모드
deno task start

# 테스트 실행
deno task test</code></pre>

                <h3>GitHub Webhook 설정</h3>
                <div class="workflow-step">
                    <div class="step-number">1</div>
                    <div>저장소 Settings → Webhooks → Add webhook</div>
                </div>
                <div class="workflow-step">
                    <div class="step-number">2</div>
                    <div>Payload URL: <code>http://your-server:8000/webhook/github</code></div>
                </div>
                <div class="workflow-step">
                    <div class="step-number">3</div>
                    <div>Content type: <code>application/json</code></div>
                </div>
                <div class="workflow-step">
                    <div class="step-number">4</div>
                    <div>Secret: <code>.env</code>의 GITHUB_WEBHOOK_SECRET 값 입력</div>
                </div>
                <div class="workflow-step">
                    <div class="step-number">5</div>
                    <div>Events: Issues, Pull requests, Issue comments, Pushes 선택</div>
                </div>
            </section>

            <section id="usage">
                <h2>📖 사용 방법</h2>

                <h3>라벨 기반 자동화</h3>
                <p>이슈에 다음 라벨을 추가하여 자동화를 트리거하세요:</p>
                <div class="command-box">
                    <p><code>automate</code> 또는 <code>ai-task</code> - 자동 처리 활성화</p>
                    <p><code>bug</code> - 버그 수정 워크플로우</p>
                    <p><code>feature</code> - 기능 구현 워크플로우</p>
                    <p><code>refactor</code> - 리팩토링 워크플로우</p>
                    <p><code>test</code> - 테스트 생성 워크플로우</p>
                </div>

                <h3>명령어 사용 예제</h3>
                <pre><code># 이슈 댓글에서
@ai-dev generate-tests

# 또는
/automate fix-bug authentication error in login

# 커밋 메시지에서
git commit -m "Fix: User validation bug [automate]"</code></pre>

                <h3>실제 사용 시나리오</h3>
                <div class="workflow">
                    <h4>시나리오: 로그인 버그 수정</h4>
                    <div class="workflow-step">
                        <div class="step-number">1</div>
                        <div>GitHub에서 이슈 생성: "로그인 시 이메일 유효성 검증 오류"</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">2</div>
                        <div>라벨 추가: <code>bug</code>, <code>automate</code></div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">3</div>
                        <div>봇이 자동으로 이슈 분석 및 수정 브랜치 생성</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">4</div>
                        <div>수정 코드 커밋 및 PR 생성</div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">5</div>
                        <div>이슈에 PR 링크 자동 추가 및 진행 상황 업데이트</div>
                    </div>
                </div>
            </section>

            <section>
                <h2>🛠️ 기술 스택</h2>
                <div class="tech-stack">
                    <span class="tech-badge">Deno</span>
                    <span class="tech-badge">TypeScript</span>
                    <span class="tech-badge">Oak (Web Framework)</span>
                    <span class="tech-badge">GitHub Octokit</span>
                    <span class="tech-badge">Crypto API</span>
                    <span class="tech-badge">RESTful API</span>
                </div>

                <h3>설계 패턴</h3>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h4>모듈화 아키텍처</h4>
                        <p>각 기능이 독립적인 모듈로 분리되어 있습니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>서비스 레이어 패턴</h4>
                        <p>비즈니스 로직이 서비스 계층에서 관리됩니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>전략 패턴</h4>
                        <p>워크플로우 선택이 전략 패턴으로 구현되어 있습니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>의존성 주입</h4>
                        <p>컴포넌트 간 느슨한 결합을 유지합니다.</p>
                    </div>
                </div>
            </section>

            <section>
                <h2>🔐 보안</h2>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h4>Webhook 서명 검증</h4>
                        <p>HMAC-SHA256으로 GitHub 요청을 검증합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>환경 변수 보호</h4>
                        <p>민감한 정보는 환경 변수로 관리됩니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>최소 권한 원칙</h4>
                        <p>필요한 GitHub 권한만 요청합니다.</p>
                    </div>
                    <div class="feature-card">
                        <h4>로깅 안전성</h4>
                        <p>민감한 데이터는 로그에 기록되지 않습니다.</p>
                    </div>
                </div>
            </section>
        </div>

        <footer>
            <p>🤖 AI Developer - Intelligent Development Automation System</p>
            <p>Built with Deno, TypeScript, and GitHub Integration</p>
            <p style="margin-top: 15px; opacity: 0.7;">© 2025 AI Developer Project</p>
        </footer>
    </div>
</body>
</html>`;
}