# AI Developer - GitHub Automation System

An intelligent development automation system that integrates GitHub with AI-powered coding assistants to automate software development workflows.

## 🚀 Features

### Core Features
- **GitHub Integration**: Webhook-based automation triggered by issues, PRs, and commits
- **AI-Powered Analysis**: Intelligent issue analysis and workflow determination
- **Automated Code Generation**: Generate bug fixes, features, tests, and refactors
- **Smart PR Reviews**: AI-powered code review and feedback
- **Command-Based Actions**: Issue comments trigger specific automation tasks

### Phase 3-5 Enhancements (NEW ✨)
- **Multi-Provider AI**: OpenAI (GPT-4) and Anthropic (Claude 3.5) support
- **Intelligent Caching**: Redis-based response caching (30-50% cost reduction)
- **Cost Tracking**: Real-time budget management with Slack/Discord alerts
- **Advanced Workflows**: Performance optimization, security auditing
- **Dashboard API**: RESTful endpoints for monitoring and analytics
- **Worker Pool**: Parallel job processing with queue management

## 📋 Architecture

```
ai_developer/
├── src/
│   ├── modules/
│   │   ├── github/         # GitHub API & webhook handling
│   │   ├── ai/            # AI service integration
│   │   ├── automation/     # Workflow orchestration
│   │   └── code-gen/       # Code generation engine
│   ├── core/              # Core utilities
│   └── main.ts            # Application entry point
```

## 🔧 Setup

### Prerequisites

- [Deno](https://deno.land/) installed (v1.40+)
- GitHub account with repository access
- GitHub Personal Access Token
- (Optional) OpenAI or Anthropic API key for AI features

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ai_developer
```

2. Copy the environment file:
```bash
cp .env.example .env
```

3. Configure your environment variables:
```bash
# Edit .env file
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
PORT=8000

# Optional AI configuration
OPENAI_API_KEY=your_openai_key  # For GPT-based features
ANTHROPIC_API_KEY=your_anthropic_key  # For Claude-based features
```

### Running the Application

Development mode with auto-reload:
```bash
deno task dev
```

Production mode:
```bash
deno task start
```

Run tests:
```bash
deno task test
```

## 🔌 GitHub Webhook Setup

1. Go to your GitHub repository settings
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:
   - **Payload URL**: `http://your-server:8000/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Use the same value as `GITHUB_WEBHOOK_SECRET` in your `.env`
   - **Events**: Select:
     - Issues
     - Issue comments
     - Pull requests
     - Pushes

## 🤖 Usage

### Automation via Issue Labels

Add labels to issues to trigger automation:

- `automate` or `ai-task`: Triggers automatic processing
- `bug`: Executes bug fix workflow
- `feature`: Executes feature implementation workflow
- `refactor`: Executes refactoring workflow
- `test`: Generates tests

### Command-Based Automation

Use comments in issues to trigger specific actions:

```bash
@ai-dev generate-tests        # Generate tests for the issue
@ai-dev fix-bug <description> # Fix a specific bug
@ai-dev implement <feature>   # Implement a feature
@ai-dev refactor <target>     # Refactor code
@ai-dev review                # Review current code

# Alternative syntax
/automate generate-tests
/automate fix-bug <description>
```

### Commit-Based Triggers

Include keywords in commit messages:

```bash
git commit -m "Fix: Authentication bug [automate]"
git commit -m "Feature: Add user profile [ai]"
```

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Manual Trigger
```http
POST /api/automation/trigger
Content-Type: application/json

{
  "task": "generate-tests",
  "target": "src/main.ts",
  "options": {...}
}
```

## 🔄 Workflow Examples

### Bug Fix Workflow

1. Create issue with `bug` label
2. Bot analyzes the issue
3. Creates fix branch
4. Generates bug fix code
5. Creates pull request
6. Updates issue with PR link

### Feature Implementation Workflow

1. Create issue with `feature` label
2. Bot analyzes requirements
3. Creates feature branch
4. Generates implementation
5. Generates tests
6. Creates pull request

## 🧪 Testing

Run all tests:
```bash
deno task test
```

Run specific test file:
```bash
deno test tests/github.test.ts
```

## 📝 Development

### Adding New Workflows

1. Create workflow in `src/modules/automation/workflows/`
2. Register in `AutomationService`
3. Add command parsing if needed
4. Update documentation

### Extending AI Capabilities

The AI service (`src/modules/ai/ai.service.ts`) can be extended with:
- OpenAI GPT integration
- Anthropic Claude integration
- Custom AI model integration
- Local LLM support

### Example AI Integration

```typescript
// src/modules/ai/providers/openai.provider.ts
import OpenAI from "openai";

export class OpenAIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateCode(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content || "";
  }
}
```

## 🛠️ Customization

### Custom Commands

Add custom commands in `automation.service.ts`:

```typescript
case "your-command":
  await this.executeYourCommand(payload);
  break;
```

### Custom Workflows

Create new workflow methods:

```typescript
private async executeCustomWorkflow(
  payload: IssuePayload,
  analysis: any
): Promise<void> {
  // Your custom workflow logic
}
```

## 🔐 Security

- Webhook signatures are verified using HMAC-SHA256
- GitHub tokens are stored in environment variables
- AI API keys are optional and stored securely
- No sensitive data is logged

## 📊 Monitoring

The application logs all activities:
- Webhook events received
- Workflows executed
- Errors and warnings
- AI analysis results

## ✅ Completed Features (Phase 3-5)

- [✅] Advanced AI model integration (GPT-4, Claude 3.5 Sonnet)
- [✅] Multi-provider AI orchestration with fallback
- [✅] Redis-based intelligent caching system
- [✅] Real-time cost tracking and budget management
- [✅] Dashboard API for monitoring
- [✅] Metrics and analytics reporting
- [✅] Worker pool for parallel processing
- [✅] Performance and security workflows

## 🚧 Future Roadmap

- [ ] Web UI dashboard (React/Vue)
- [ ] Support for multiple repositories
- [ ] Custom workflow builder UI
- [ ] Integration with CI/CD pipelines
- [ ] Support for GitLab and Bitbucket
- [ ] ML-based provider selection
- [ ] Semantic caching strategies

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 💬 Support

- Create an issue for bug reports
- Use discussions for questions
- Check documentation for guides

## 🎯 Quick Start Example

1. Setup environment:
```bash
cp .env.example .env
# Edit .env with your GitHub credentials
```

2. Start the server:
```bash
deno task dev
```

3. Create a GitHub issue:
```markdown
Title: Fix authentication bug
Labels: bug, automate
Body: Users can't log in with email
```

4. Watch the magic happen! The bot will:
   - Analyze the issue
   - Create a fix branch
   - Generate the fix
   - Create a pull request

## 🏗️ Production Deployment

For production deployment, consider:

1. Using a process manager (PM2, systemd)
2. Setting up HTTPS with a reverse proxy (nginx, Caddy)
3. Implementing rate limiting
4. Setting up monitoring (Prometheus, Grafana)
5. Using a proper database for state management
6. Implementing proper error tracking (Sentry)

### Example Deployment Script

```bash
#!/bin/bash
# deploy.sh

# Build and test
deno fmt
deno lint
deno test

# Start with PM2
pm2 start --interpreter="deno" --name="ai-developer" \
  -- run --allow-net --allow-env --allow-read --allow-write src/main.ts
```

## 📚 Documentation

- [API Documentation](docs/api.md)
- [Workflow Guide](docs/workflows.md)
- [AI Integration Guide](docs/ai-integration.md)
- [Security Best Practices](docs/security.md)