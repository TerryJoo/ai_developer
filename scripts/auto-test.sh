#!/bin/bash

# Auto-test script for AI Developer project
# Runs after code changes to ensure quality gates

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 Running quality checks..."

# 1. Type checking
echo "📝 Type checking..."
deno check src/**/*.ts || {
  echo "❌ Type check failed"
  exit 1
}

# 2. Linting
echo "🧹 Linting..."
deno lint || {
  echo "❌ Lint failed"
  exit 1
}

# 3. Formatting check
echo "✨ Format check..."
deno fmt --check || {
  echo "⚠️  Format issues detected. Run 'deno fmt' to fix."
}

# 4. Run tests
echo "🧪 Running tests..."
deno test --allow-net --allow-env --allow-read || {
  echo "❌ Tests failed"
  exit 1
}

echo "✅ All quality checks passed!"
