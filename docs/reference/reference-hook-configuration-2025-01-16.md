# Hook Configuration Reference

> Complete reference for configuring Claude Code hooks with compiled JavaScript execution

---
title: Hook Configuration Reference
category: reference
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [reference, hooks, configuration, performance, build]
---

## Overview

This document provides the complete reference for configuring Claude Code hooks in the Global Context Network. It covers the canonical `.claude/hooks.json` format, TypeScript compilation requirements, performance budgets, environment variables, and cross-platform considerations.

**Critical Requirements**:
- Configuration path: `.claude/hooks.json` (canonical)
- Hook scripts: Compiled `.js` files (NOT `.ts`, NO `ts-node`)
- Input method: `stdin` JSON (canonical)
- Performance: <100ms p95 latency

## Table of Contents

1. [Configuration File Format](#configuration-file-format)
2. [Hook Types](#hook-types)
3. [Build Process](#build-process)
4. [Performance Budgets](#performance-budgets)
5. [Environment Variables](#environment-variables)
6. [Error Handling Configuration](#error-handling-configuration)
7. [Cross-Platform Considerations](#cross-platform-considerations)
8. [Complete Examples](#complete-examples)
9. [Troubleshooting](#troubleshooting)

## Configuration File Format

### Location

**Canonical path**: `.claude/hooks.json`

```
project-root/
├── .claude/
│   ├── hooks.json          # ← Configuration file (CANONICAL)
│   └── hooks/
│       ├── src/            # TypeScript source
│       │   ├── userPromptSubmit.ts
│       │   └── stop.ts
│       ├── dist/           # Compiled JavaScript (referenced by hooks.json)
│       │   ├── userPromptSubmit.js
│       │   └── stop.js
│       ├── tsconfig.json
│       └── package.json
```

**NOT**:
- ❌ `.claude/hooks/hooks.json` (incorrect path)
- ❌ `.claude/config.json` (wrong filename)
- ❌ `hooks.json` (missing `.claude/` directory)

### Schema

```typescript
interface HooksConfiguration {
  hooks: {
    [hookName: string]: string;  // Path to compiled .js file
  };
  config?: {
    eventQueuePath?: string;
    maxBufferSize?: number;
    fallbackToSampling?: boolean;
    samplingRate?: number;
    performanceBudgetMs?: number;
  };
}
```

### Minimal Configuration

```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js",
    "Stop": ".claude/hooks/dist/stop.js"
  }
}
```

### Full Configuration

```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js",
    "Stop": ".claude/hooks/dist/stop.js"
  },
  "config": {
    "eventQueuePath": "${PROJECT_ROOT}/.data/context.db",
    "maxBufferSize": 1000,
    "fallbackToSampling": true,
    "samplingRate": 0.1,
    "performanceBudgetMs": 100
  }
}
```

### Configuration Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hooks` | object | `{}` | Map of hook names to script paths |
| `config.eventQueuePath` | string | `"${PROJECT_ROOT}/.data/context.db"` | SQLite database path |
| `config.maxBufferSize` | number | `1000` | Max events in queue before sampling |
| `config.fallbackToSampling` | boolean | `true` | Enable sampling under load |
| `config.samplingRate` | number | `0.1` | Sample rate when buffer full (0.1 = 10%) |
| `config.performanceBudgetMs` | number | `100` | p95 latency budget in milliseconds |

### Path Variables

Supported environment variable expansions:

| Variable | Expands To | Example |
|----------|------------|---------|
| `${PROJECT_ROOT}` | Absolute project directory | `/Users/alice/my-project` |
| `${HOME}` | User home directory | `/Users/alice` |
| `${TMPDIR}` | System temp directory | `/tmp` |

## Hook Types

### UserPromptSubmit

**Fires**: Before Claude processes user input

**Purpose**: Capture user prompts for context building

**Event Payload** (via stdin):
```json
{
  "prompt": "User's message text",
  "conversation_id": "uuid-v4-string",
  "session_id": "session-uuid",
  "project_id": "project-identifier",
  "timestamp": 1705401234567,
  "attachments": [
    {
      "name": "file.txt",
      "path": "/absolute/path/to/file.txt",
      "mime_type": "text/plain",
      "size": 1024
    }
  ]
}
```

**Configuration Example**:
```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js"
  }
}
```

### Stop

**Fires**: After Claude completes response generation

**Purpose**: Capture agent responses and tool usage

**Event Payload** (via stdin):
```json
{
  "response": "Assistant's response text",
  "conversation_id": "uuid-v4-string",
  "session_id": "session-uuid",
  "project_id": "project-identifier",
  "timestamp": 1705401234567,
  "tool_calls": [
    {
      "tool": "bash",
      "input": "ls -la",
      "output": "total 64\ndrwxr-xr-x ..."
    }
  ]
}
```

**Configuration Example**:
```json
{
  "hooks": {
    "Stop": ".claude/hooks/dist/stop.js"
  }
}
```

## Build Process

### Why Compiled JavaScript?

**Critical**: Hooks MUST use compiled `.js` files, NOT TypeScript via `ts-node`.

**Reasons**:
1. **Performance**: `ts-node` adds 50-200ms startup overhead (exceeds 100ms budget)
2. **Reliability**: No runtime TypeScript compilation errors
3. **Simplicity**: Single Node.js process, no transpiler overhead
4. **Production-ready**: Same execution model as deployed code

**❌ Wrong**:
```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/src/userPromptSubmit.ts"  // ❌ ts-node too slow
  }
}
```

**✅ Correct**:
```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js"  // ✅ Compiled JS
  }
}
```

### TypeScript Configuration

**File**: `.claude/hooks/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,
    "sourceMap": false,
    "removeComments": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Key settings**:
- `outDir: "./dist"`: Compiled output directory
- `target: "ES2022"`: Modern Node.js features
- `module: "commonjs"`: Node.js compatibility
- `sourceMap: false`: No source maps for performance
- `removeComments: true`: Smaller output files

### Build Scripts

**File**: `.claude/hooks/package.json`

```json
{
  "name": "claude-hooks",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "clean": "rm -rf dist",
    "rebuild": "npm run clean && npm run build",
    "pretest": "npm run build",
    "test": "vitest"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.9",
    "@types/node": "^20.11.5",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  },
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "ulid": "^2.3.0"
  }
}
```

### Build Workflow

```bash
# Navigate to hooks directory
cd .claude/hooks

# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Verify compiled output
ls -l dist/
# Expected output:
# userPromptSubmit.js
# stop.js

# Test hooks (uses compiled .js)
npm test
```

### Watch Mode (Development)

```bash
# Terminal 1: Watch for changes and rebuild
cd .claude/hooks
npm run build:watch

# Terminal 2: Test hooks
npm test
```

### Pre-Commit Hook (Optional)

Ensure hooks are always compiled before commit:

**File**: `.git/hooks/pre-commit`

```bash
#!/bin/bash

# Build hooks before commit
cd .claude/hooks
npm run build

if [ $? -ne 0 ]; then
  echo "Hook compilation failed. Fix errors before committing."
  exit 1
fi

# Add compiled files
git add dist/
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Performance Budgets

### Latency Requirements

| Metric | Budget | Measurement Point |
|--------|--------|-------------------|
| Hook execution (p95) | <100ms | Start to process exit |
| Fast sanitization (p95) | <50ms | Regex-based redaction only |
| Database write (p95) | <20ms | SQLite WAL insert |
| Total overhead (p95) | <100ms | User perceivable delay |

### Performance Breakdown

```
Total Hook Execution (100ms budget)
├── Read stdin: ~1-2ms
├── Parse JSON: ~1-2ms
├── Sanitize content: <50ms
├── Enqueue to SQLite: <20ms
├── Write logs: ~5-10ms
└── Overhead: ~10-15ms
```

### Monitoring Performance

**In Hook Code**:

```typescript
import { performance } from 'node:perf_hooks';

const startTime = performance.now();

// ... hook work ...

const duration = performance.now() - startTime;

if (duration > 100) {
  console.warn(`⚠ Hook exceeded budget: ${duration}ms (budget: 100ms)`);
}
```

**Log Analysis**:

```bash
# Check p95 latency
grep "Duration:" logs/hooks.log | \
  awk -F'Duration: ' '{print $2}' | \
  sed 's/ms//' | \
  sort -n | \
  awk 'BEGIN {c=0} {a[c++]=$1} END {print "p95:", a[int(c*0.95)]}'
```

### Optimization Strategies

If hooks exceed 100ms:

1. **Profile execution**:
   ```typescript
   console.time('sanitize');
   const result = fastSanitize(content);
   console.timeEnd('sanitize');
   ```

2. **Optimize regex patterns**:
   - Reduce pattern complexity
   - Limit lookaheads/lookbehinds
   - Use character classes efficiently

3. **Reduce database writes**:
   - Batch small events
   - Use WAL mode (not DELETE journal)
   - Minimize index overhead

4. **Enable sampling** (last resort):
   ```json
   {
     "config": {
       "fallbackToSampling": true,
       "samplingRate": 0.1
     }
   }
   ```

## Environment Variables

### Standard Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DB_PATH` | Database location | `/path/to/context.db` |
| `LOG_LEVEL` | Logging verbosity | `error`, `warn`, `info`, `debug` |
| `HOOK_TIMEOUT_MS` | Override timeout | `100` |
| `NODE_ENV` | Environment | `development`, `production` |

### Configuration in Hook

**File**: `.claude/hooks/src/userPromptSubmit.ts`

```typescript
import { join } from 'node:path';

// Environment configuration
const CONFIG = {
  dbPath: process.env.DB_PATH || join(__dirname, '../../.data/context.db'),
  logLevel: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug',
  timeoutMs: parseInt(process.env.HOOK_TIMEOUT_MS || '100', 10),
  isDevelopment: process.env.NODE_ENV !== 'production'
};

// Use configuration
const db = new Database(CONFIG.dbPath);
```

### Setting Environment Variables

**Per-session** (testing):
```bash
export DB_PATH="/tmp/test-context.db"
export LOG_LEVEL="debug"
claude code
```

**Project-wide** (`.envrc` with direnv):
```bash
# .envrc
export DB_PATH="${PWD}/.data/context.db"
export LOG_LEVEL="info"
export NODE_ENV="production"
```

**In Claude Code** (if supported):
```bash
# .claude/env
DB_PATH=.data/context.db
LOG_LEVEL=info
```

## Error Handling Configuration

### Failure Modes

Hooks MUST fail silently and never block user interaction:

```typescript
try {
  // Hook work
  const result = await captureEvent(event);
} catch (error) {
  // Log error but DON'T throw
  logger.error('Hook failed', { error, event: sanitizeLogData(event) });

  // Optional: Emit metric
  metrics?.increment('hook.error');

  // NEVER throw to caller
}

// Always exit successfully
process.exit(0);
```

### Error Logging

**File-based logging** (reliable, no network):

```typescript
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const LOG_PATH = join(__dirname, '../../logs/hooks.log');

function logError(error: Error, context: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level: 'error',
    message: error.message,
    stack: error.stack,
    context
  };

  try {
    appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // If logging fails, fail completely silently
  }
}
```

### Retry Configuration

**NOT in hooks** (too slow). Use async workers instead:

```json
{
  "config": {
    "asyncWorker": {
      "maxRetries": 3,
      "retryDelayMs": 1000,
      "backoffMultiplier": 2
    }
  }
}
```

### Dead Letter Queue

Failed events move to dead letter queue after max retries:

```sql
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id TEXT PRIMARY KEY,
  original_event TEXT NOT NULL,
  error TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  failed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Cross-Platform Considerations

### Windows vs. Unix Paths

**Problem**: Path separators differ (`\` vs `/`)

**Solution**: Use `path.join()` and `path.resolve()`

```typescript
import { join, resolve } from 'node:path';

// ✅ Cross-platform
const dbPath = join(__dirname, '..', '..', '.data', 'context.db');

// ❌ Unix-only
const dbPath = `${__dirname}/../../.data/context.db`;
```

### Shebang Lines

**Unix/macOS** (executable):
```typescript
#!/usr/bin/env node

// Hook code...
```

**Windows** (no shebang needed):
```typescript
// Hook code (run with: node userPromptSubmit.js)
```

**Claude Code execution**: Handles platform differences automatically

### File Permissions

**Unix/macOS**:
```bash
chmod +x .claude/hooks/dist/*.js
```

**Windows**: No execution bit; Node.js invoked directly

### Line Endings

**Configure Git**:
```bash
# .gitattributes
*.js text eol=lf
*.ts text eol=lf
*.json text eol=lf
```

**Configure TypeScript**:
```json
{
  "compilerOptions": {
    "newLine": "lf"
  }
}
```

### SQLite Compatibility

`better-sqlite3` works across platforms but requires native bindings:

```bash
# Install with native compilation
npm install better-sqlite3

# Rebuild for current platform (if needed)
npm rebuild better-sqlite3
```

## Complete Examples

### Example 1: Minimal Configuration

**File**: `.claude/hooks.json`

```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js",
    "Stop": ".claude/hooks/dist/stop.js"
  }
}
```

**File**: `.claude/hooks/src/userPromptSubmit.ts`

```typescript
#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const startTime = performance.now();

try {
  // Read stdin
  const input = readFileSync(0, 'utf-8');
  const event = JSON.parse(input);

  // Process event (fast)
  console.log(`Captured: ${event.prompt.substring(0, 50)}...`);

  const duration = performance.now() - startTime;
  if (duration > 100) {
    console.warn(`Slow hook: ${duration}ms`);
  }
} catch (error) {
  console.error('Hook error:', error);
}

process.exit(0);
```

**Build**:
```bash
cd .claude/hooks
npm run build
```

### Example 2: Production Configuration

**File**: `.claude/hooks.json`

```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js",
    "Stop": ".claude/hooks/dist/stop.js"
  },
  "config": {
    "eventQueuePath": "${PROJECT_ROOT}/.data/context.db",
    "maxBufferSize": 1000,
    "fallbackToSampling": true,
    "samplingRate": 0.1,
    "performanceBudgetMs": 100
  }
}
```

**File**: `.claude/hooks/src/userPromptSubmit.ts`

```typescript
#!/usr/bin/env node

import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';

// Configuration
const DB_PATH = process.env.DB_PATH || join(__dirname, '../../.data/context.db');
const LOG_PATH = join(__dirname, '../../logs/hooks.log');

interface HookEvent {
  prompt: string;
  conversation_id?: string;
  session_id: string;
  timestamp: number;
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(LOG_PATH, `[${timestamp}] UserPromptSubmit: ${message}\n`);
  } catch {
    // Fail silently
  }
}

function sanitize(text: string): string {
  // Fast regex-based sanitization
  return text
    .replace(/\bsk-[a-zA-Z0-9]{48}\b/g, '[REDACTED_API_KEY]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\/Users\/[^\/\s]+\/[^\s]*/g, '[REDACTED_PATH]');
}

function main(): void {
  const startTime = performance.now();

  try {
    // Read stdin
    const input = readFileSync(0, 'utf-8');
    const event: HookEvent = JSON.parse(input);

    // Sanitize BEFORE storage
    const sanitizedContent = sanitize(event.prompt);

    // Queue event
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    const conversationId = event.conversation_id || ulid();
    const messageId = ulid();

    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(messageId, conversationId, 'user', sanitizedContent, new Date().toISOString());

    db.close();

    const duration = performance.now() - startTime;
    log(`Captured user prompt. Duration: ${duration}ms`);

    if (duration > 100) {
      log(`⚠ WARNING: Hook exceeded budget: ${duration}ms`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error: ${errorMsg}`);
  }

  process.exit(0);
}

main();
```

**File**: `.claude/hooks/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,
    "sourceMap": false,
    "removeComments": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Build & Test**:
```bash
cd .claude/hooks
npm install
npm run build
npm test
```

## Troubleshooting

### Hook Not Executing

**Symptoms**: Events not captured, no logs

**Diagnosis**:
```bash
# Check configuration
cat .claude/hooks.json

# Verify compiled files exist
ls -l .claude/hooks/dist/

# Check file permissions (Unix/macOS)
ls -l .claude/hooks/dist/*.js

# Test hook manually
echo '{"prompt":"test"}' | node .claude/hooks/dist/userPromptSubmit.js
```

**Solutions**:
1. Verify `.claude/hooks.json` path (not `.claude/hooks/hooks.json`)
2. Rebuild TypeScript: `cd .claude/hooks && npm run build`
3. Check hook points to `.js` file, not `.ts`
4. Ensure Node.js installed: `node --version`

### Hook Too Slow (>100ms)

**Symptoms**: Laggy user experience, timeout warnings in logs

**Diagnosis**:
```bash
# Check p95 latency
grep "Duration:" logs/hooks.log | \
  awk -F'Duration: ' '{print $2}' | \
  sed 's/ms//' | \
  sort -n | \
  tail -n 5
```

**Solutions**:
1. **Profile execution**:
   ```typescript
   console.time('sanitize');
   const result = sanitize(content);
   console.timeEnd('sanitize');
   ```

2. **Optimize regex** (see [Sanitization Standard](../STANDARDS.md#9-sanitization-standard))

3. **Use WAL mode**:
   ```typescript
   db.pragma('journal_mode = WAL');
   db.pragma('synchronous = NORMAL');
   ```

4. **Reduce logging**:
   ```typescript
   if (process.env.LOG_LEVEL === 'debug') {
     log(details);
   }
   ```

### Database Locked

**Symptoms**: `SQLITE_BUSY` errors

**Diagnosis**:
```bash
# Check WAL mode
sqlite3 .data/context.db "PRAGMA journal_mode;"
# Expected: wal
```

**Solutions**:
1. **Enable WAL mode**:
   ```typescript
   db.pragma('journal_mode = WAL');
   ```

2. **Set busy timeout**:
   ```typescript
   db.pragma('busy_timeout = 5000');
   ```

3. **Close database connections**:
   ```typescript
   db.close();
   ```

### Compilation Errors

**Symptoms**: `tsc` fails, no `.js` files in `dist/`

**Diagnosis**:
```bash
cd .claude/hooks
npm run build
```

**Solutions**:
1. **Fix TypeScript errors** (strict mode required)
2. **Check tsconfig.json** (verify `outDir`, `rootDir`)
3. **Update dependencies**:
   ```bash
   npm install --save-dev typescript@latest
   ```

### Cross-Platform Path Issues

**Symptoms**: Hooks work on macOS/Linux but fail on Windows

**Solutions**:
1. **Use `path.join()`**:
   ```typescript
   import { join } from 'node:path';
   const dbPath = join(__dirname, '..', '..', '.data', 'context.db');
   ```

2. **Normalize paths**:
   ```typescript
   import { normalize } from 'node:path';
   const normalized = normalize(userPath);
   ```

3. **Configure line endings**:
   ```gitattributes
   *.js text eol=lf
   *.ts text eol=lf
   ```

## Related Documents

### Architecture
- [Hooks & Event Capture Architecture](../architecture/architecture-hooks-event-capture-2025-01-16.md)
- [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md)

### Standards
- [Project Standards](../STANDARDS.md) - Section 5: Hook Configuration Standard
- [Privacy & Data Flow Standard](../STANDARDS.md#1-privacy--data-flow-standard-most-critical)

### Guides
- [Phase 1 Hook Development Guide](../guides/guide-phase-1-hook-development-2025-01-16.md)

---

**Last Updated**: 2025-01-16
**Version**: 1.0.0
**Canonical Path**: `.claude/hooks.json`
**Hook Format**: Compiled `.js` (NOT `ts-node`)
**IO Method**: `stdin` JSON (canonical)
**Performance Budget**: <100ms p95
