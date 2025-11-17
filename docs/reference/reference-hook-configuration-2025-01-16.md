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

This document provides the complete reference for configuring Claude Code hooks in the Global Context Network. It covers the official `.claude/settings.json` format, TypeScript compilation requirements, performance budgets, environment variables, and cross-platform considerations.

**Critical Requirements**:
- Configuration location: `.claude/settings.json` (official location, NOT `hooks.json`)
- Hook scripts: Compiled `.js` files (NOT `.ts`, NO `ts-node`)
- Input method: `stdin` JSON (official specification)
- Performance: <100ms p95 latency (non-blocking requirement)
- Timeout: 60s default (fail-safe for hung hooks)

## Table of Contents

1. [Configuration File Format](#configuration-file-format)
2. [Hook Events](#hook-events)
3. [Hook Input Schema](#hook-input-schema)
4. [Hook Output Schema](#hook-output-schema)
5. [Build Process](#build-process)
6. [Performance Budgets](#performance-budgets)
7. [Environment Variables](#environment-variables)
8. [Error Handling Configuration](#error-handling-configuration)
9. [Cross-Platform Considerations](#cross-platform-considerations)
10. [Complete Examples](#complete-examples)
11. [Troubleshooting](#troubleshooting)

## Configuration File Format

### Location

**Official path**: `.claude/settings.json`

```
project-root/
├── .claude/
│   ├── settings.json       # ← Configuration file (OFFICIAL)
│   └── hooks/
│       ├── src/            # TypeScript source
│       │   ├── userPromptSubmit.ts
│       │   ├── stop.ts
│       │   └── sessionStart.ts
│       ├── dist/           # Compiled JavaScript (referenced by settings.json)
│       │   ├── userPromptSubmit.js
│       │   ├── stop.js
│       │   └── sessionStart.js
│       ├── tsconfig.json
│       └── package.json
```

**NOT**:
- ❌ `.claude/hooks.json` (incorrect - not used by Claude Code)
- ❌ `.claude/hooks/hooks.json` (incorrect path)
- ❌ `.claude/config.json` (wrong filename)

### Schema

```typescript
interface ClaudeSettings {
  hooks?: {
    [hookEventName: string]: Array<{
      matcher?: string;  // Optional: filter by tool name pattern
      hooks: Array<{
        type: "command" | "prompt";
        command?: string;  // For type: "command"
        prompt?: string;   // For type: "prompt"
        timeout?: number;  // Optional timeout in seconds (default: 60)
      }>;
    }>;
  };
}
```

### Minimal Configuration

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/userPromptSubmit.js",
            "timeout": 100
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/stop.js",
            "timeout": 100
          }
        ]
      }
    ]
  }
}
```

### Full Configuration (All Events)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/userPromptSubmit.js",
            "timeout": 100
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/stop.js",
            "timeout": 100
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/preToolUse.js",
            "timeout": 100
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/postToolUse.js",
            "timeout": 100
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/sessionStart.js",
            "timeout": 100
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/sessionEnd.js",
            "timeout": 100
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/preCompact.js",
            "timeout": 100
          }
        ]
      }
    ]
  }
}
```

### Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Hook type: "command" or "prompt" |
| `command` | string | Yes (for type: command) | Full command with args (use $CLAUDE_PROJECT_DIR) |
| `prompt` | string | Yes (for type: prompt) | LLM prompt for intelligent decision |
| `timeout` | number | No | Timeout in seconds (default: 60s) |
| `matcher` | string | No | Regex pattern for tool name filtering |

### Path Variables

| Variable | Expands To | Example |
|----------|------------|---------|
| `$CLAUDE_PROJECT_DIR` | Absolute project directory | `/Users/alice/my-project` |

**CRITICAL**: Use `\"$CLAUDE_PROJECT_DIR\"` with escaped quotes in JSON for paths with spaces.

## Hook Events

Claude Code provides 10 hook events:

### 1. PreToolUse

**Fires**: Before tool execution (can block or modify)

**Purpose**: Validate tool calls, modify inputs, enforce policies

**Capabilities**:
- Block tool execution
- Modify tool input
- Request permission

**Use Cases**:
- Prevent destructive operations
- Validate file paths
- Enforce security policies

### 2. PostToolUse

**Fires**: After tool execution

**Purpose**: Validate outputs, trigger formatters, capture results

**Use Cases**:
- Run code formatters after Write/Edit
- Validate build success
- Capture tool outputs

### 3. UserPromptSubmit

**Fires**: When user submits prompt

**Purpose**: Capture user prompts for context building

**Use Cases**:
- Event capture for context network
- Analytics
- Prompt preprocessing

### 4. Stop

**Fires**: When agent finishes response generation

**Purpose**: Capture agent responses and tool usage

**Use Cases**:
- Event capture for context network
- Response analysis
- Session logging

### 5. SubagentStop

**Fires**: When subagent finishes

**Purpose**: Capture subagent completions

**Use Cases**:
- Track subagent task completion
- Capture subagent outputs

### 6. Notification

**Fires**: When notifications sent

**Purpose**: Capture notification events

**Use Cases**:
- Log notifications
- Track user alerts

### 7. PreCompact

**Fires**: Before transcript compaction

**Purpose**: Flush pending events before compaction

**Use Cases**:
- Flush event queue
- Archive conversation state

### 8. SessionStart

**Fires**: Session initialization

**Purpose**: Initialize resources, load context

**Use Cases**:
- Initialize event queue
- Set up session state
- Load user preferences

**Special Feature**: Can persist environment variables via `CLAUDE_ENV_FILE`

### 9. SessionEnd

**Fires**: Session termination

**Purpose**: Cleanup, final flush

**Use Cases**:
- Flush event queue
- Clean up resources
- Save session state

### 10. PermissionRequest

**Fires**: Permission dialogs

**Purpose**: Auto-approve/deny permission requests

**Use Cases**:
- Auto-approve safe operations
- Enforce permission policies

## Hook Input Schema

All hooks receive JSON via stdin with the following base schema:

### Base Schema (All Events)

```typescript
interface BaseHookInput {
  session_id: string;              // Current session identifier
  transcript_path: string;         // Absolute path to .jsonl transcript
  cwd: string;                     // Current working directory
  permission_mode: string;         // Permission mode: "default", "auto", etc.
  hook_event_name: string;         // Event name: "UserPromptSubmit", "Stop", etc.
}
```

### UserPromptSubmit Event

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/alice/.claude/projects/my-project/00893aaf.jsonl",
  "cwd": "/Users/alice/my-project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function to calculate factorial"
}
```

**TypeScript Interface**:
```typescript
interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: "UserPromptSubmit";
  prompt: string;  // User's message text
}
```

### Stop Event

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/alice/.claude/projects/my-project/00893aaf.jsonl",
  "cwd": "/Users/alice/my-project",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
```

**TypeScript Interface**:
```typescript
interface StopInput extends BaseHookInput {
  hook_event_name: "Stop";
  stop_hook_active: boolean;
}
```

**CRITICAL**: Stop hook does NOT receive the agent response directly. You must read the `transcript_path` file to extract the response.

### PreToolUse Event

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/alice/.claude/projects/my-project/00893aaf.jsonl",
  "cwd": "/Users/alice/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "content": "const x = 1;"
  }
}
```

**TypeScript Interface**:
```typescript
interface PreToolUseInput extends BaseHookInput {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
}
```

### PostToolUse Event

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/alice/.claude/projects/my-project/00893aaf.jsonl",
  "cwd": "/Users/alice/my-project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "content": "const x = 1;"
  },
  "tool_output": {
    "success": true
  }
}
```

**TypeScript Interface**:
```typescript
interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown>;
}
```

### SessionStart Event

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/alice/.claude/projects/my-project/00893aaf.jsonl",
  "cwd": "/Users/alice/my-project",
  "permission_mode": "default",
  "hook_event_name": "SessionStart"
}
```

**TypeScript Interface**:
```typescript
interface SessionStartInput extends BaseHookInput {
  hook_event_name: "SessionStart";
}
```

### Reading Hook Input

**Correct Pattern** (stdin):

```typescript
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const input = await readStdin();
  const hookData = JSON.parse(input);

  // Validate event type
  if (hookData.hook_event_name !== 'UserPromptSubmit') {
    console.error('Unexpected event:', hookData.hook_event_name);
    process.exit(1);
  }

  // Process event
  const prompt = hookData.prompt;
  // ...
}
```

**WRONG Patterns**:
```typescript
// ❌ WRONG: Reading from argv (not used by Claude Code)
const hookData = JSON.parse(process.argv[2]);

// ❌ WRONG: Reading from environment variables
const hookData = JSON.parse(process.env.HOOK_DATA);

// ❌ WRONG: Synchronous stdin read in Node.js 20+ (deprecated)
const input = fs.readFileSync(0, 'utf-8');
```

### Reading Transcript for Stop Hook

The Stop hook receives `transcript_path` but NOT the response directly. You must read the transcript file:

```typescript
import { readFileSync } from 'node:fs';

interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

function parseTranscript(transcriptPath: string): TranscriptMessage[] {
  const content = readFileSync(transcriptPath, 'utf8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

async function main() {
  const input = await readStdin();
  const hookData = JSON.parse(input);

  // Read transcript to get response
  const transcript = parseTranscript(hookData.transcript_path);
  const lastMessage = transcript[transcript.length - 1];

  if (lastMessage.role === 'assistant') {
    const response = lastMessage.content;
    // Process response...
  }
}
```

## Hook Output Schema

Hooks can output JSON to stdout to control Claude Code behavior.

### Base Output Schema

```typescript
interface HookOutput {
  continue?: boolean;           // Whether Claude should continue (default: true)
  stopReason?: string;          // Message shown when continue is false
  suppressOutput?: boolean;     // Hide stdout from transcript (default: false)
  systemMessage?: string;       // Warning message to user
  hookSpecificOutput?: Record<string, unknown>;  // Event-specific output
}
```

### UserPromptSubmit Output

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "User has asked about TypeScript 3 times today"
  }
}
```

### PreToolUse Output (Permission Control)

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "File path is within project directory",
    "updatedInput": {
      "file_path": "/normalized/path/to/file.ts",
      "content": "const x = 1;"
    }
  }
}
```

**Permission Decisions**:
- `"allow"`: Allow tool execution with optional modified input
- `"deny"`: Block tool execution
- `"ask"`: Prompt user for permission

### PostToolUse Output (Block Continuation)

```json
{
  "continue": false,
  "stopReason": "Build failed after file write",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "decision": "block"
  }
}
```

### Stop Output (Block Completion)

```json
{
  "continue": false,
  "stopReason": "Response contains sensitive data",
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "decision": "block"
  }
}
```

### Exit Codes

| Exit Code | Meaning | Behavior |
|-----------|---------|----------|
| `0` | Success | Continue (unless JSON output says otherwise) |
| `1` | Error | Log error, continue anyway (fail silently) |
| `2` | Block | Block the action (only for blocking-capable hooks) |

**Blocking-Capable Hooks**:
- PreToolUse
- Stop
- SubagentStop
- UserPromptSubmit

**Non-Blocking Hooks** (exit code 2 ignored):
- PostToolUse
- Notification
- PreCompact
- SessionStart
- SessionEnd

## Build Process

### Why Compiled JavaScript?

**Critical**: Hooks MUST use compiled `.js` files, NOT TypeScript via `ts-node`.

**Reasons**:
1. **Performance**: `ts-node` adds 50-200ms startup overhead (exceeds 100ms budget)
2. **Reliability**: No runtime TypeScript compilation errors
3. **Simplicity**: Single Node.js process, no transpiler overhead
4. **Production-ready**: Same execution model as deployed code

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
# sessionStart.js

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

## Performance Budgets

### Latency Requirements

| Metric | Budget | Description |
|--------|--------|-------------|
| Hook execution (p95) | <100ms | Performance budget (non-blocking requirement) |
| Hook timeout | 60s (default) | Fail-safe for hung hooks |
| Fast sanitization (p95) | <50ms | Regex-based redaction only |
| Database write (p95) | <20ms | SQLite WAL insert |
| Total overhead (p95) | <100ms | User perceivable delay |

**Important Distinction**:
- **100ms**: Performance budget (hooks should complete in <100ms)
- **60s**: Timeout (hooks won't be killed until 60s)
- Hooks should aim for <100ms but won't fail until 60s timeout

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

4. **Fire-and-forget pattern**:
   ```typescript
   // Hook just queues event and exits immediately
   queueEvent(event).catch(err => console.error(err));
   process.exit(0);
   ```

## Environment Variables

### Official Claude Code Environment Variables

| Variable | Availability | Description |
|----------|--------------|-------------|
| `CLAUDE_PROJECT_DIR` | All hooks | Project root directory (absolute path) |
| `CLAUDE_ENV_FILE` | SessionStart only | File path for persisting env vars |
| `CLAUDE_CODE_REMOTE` | All hooks | "true" if remote/web, unset for local CLI |
| `CLAUDE_PLUGIN_ROOT` | Plugin hooks only | Plugin directory |

### Using CLAUDE_PROJECT_DIR

**In Hook Command** (.claude/settings.json):
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/dist/userPromptSubmit.js"
          }
        ]
      }
    ]
  }
}
```

**In Hook Code**:
```typescript
import { join } from 'node:path';

// Access project directory
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbPath = join(projectDir, '.data', 'context.db');
```

### SessionStart Environment Persistence

SessionStart hooks can persist environment variables using `CLAUDE_ENV_FILE`:

```typescript
// sessionStart.ts
import { appendFileSync } from 'node:fs';

async function main() {
  const input = await readStdin();
  const hookData = JSON.parse(input);

  // Persist environment variables for entire session
  if (process.env.CLAUDE_ENV_FILE) {
    appendFileSync(
      process.env.CLAUDE_ENV_FILE,
      `export SESSION_ID="${hookData.session_id}"\n`
    );
    appendFileSync(
      process.env.CLAUDE_ENV_FILE,
      `export DB_PATH="${projectDir}/.data/context.db"\n`
    );
  }
}
```

### Custom Environment Variables

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

## Error Handling Configuration

### Failure Modes

Hooks MUST fail silently and never block user interaction (except for blocking-capable hooks):

```typescript
try {
  // Hook work
  const result = await captureEvent(event);
} catch (error) {
  // Log error but DON'T throw
  logger.error('Hook failed', { error });

  // NEVER throw to caller (for non-blocking hooks)
}

// Always exit successfully (unless intentionally blocking)
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

### Line Endings

**Configure Git**:
```bash
# .gitattributes
*.js text eol=lf
*.ts text eol=lf
*.json text eol=lf
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

### Example 1: UserPromptSubmit Hook

**File**: `.claude/hooks/src/userPromptSubmit.ts`

```typescript
#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const startTime = performance.now();

  try {
    // Read hook input from stdin
    const input = await readStdin();
    const hookData = JSON.parse(input);

    // Validate event type
    if (hookData.hook_event_name !== 'UserPromptSubmit') {
      console.error('Unexpected hook event:', hookData.hook_event_name);
      process.exit(1);
    }

    // Extract prompt
    const prompt = hookData.prompt;
    const sessionId = hookData.session_id;

    // Fire-and-forget event capture
    console.log(`[UserPromptSubmit] Captured prompt: ${prompt.substring(0, 50)}...`);

    const duration = performance.now() - startTime;
    if (duration > 100) {
      console.warn(`⚠ Hook exceeded budget: ${duration}ms`);
    }

    // Exit successfully (never block user)
    process.exit(0);

  } catch (error) {
    console.error('[Hook Critical Error]', error);
    process.exit(1);
  }
}

main();
```

### Example 2: Stop Hook (with Transcript Reading)

**File**: `.claude/hooks/src/stop.ts`

```typescript
#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

function parseTranscript(transcriptPath: string): TranscriptMessage[] {
  const content = readFileSync(transcriptPath, 'utf8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

async function main() {
  const startTime = performance.now();

  try {
    // Read hook input from stdin
    const input = await readStdin();
    const hookData = JSON.parse(input);

    // Validate event type
    if (hookData.hook_event_name !== 'Stop') {
      console.error('Unexpected hook event:', hookData.hook_event_name);
      process.exit(1);
    }

    // CRITICAL: Read transcript to get response
    const transcript = parseTranscript(hookData.transcript_path);
    const lastMessage = transcript[transcript.length - 1];

    if (lastMessage && lastMessage.role === 'assistant') {
      const response = lastMessage.content;
      console.log(`[Stop] Captured response: ${response.substring(0, 50)}...`);
    }

    const duration = performance.now() - startTime;
    if (duration > 100) {
      console.warn(`⚠ Hook exceeded budget: ${duration}ms`);
    }

    // Exit successfully
    process.exit(0);

  } catch (error) {
    console.error('[Hook Critical Error]', error);
    process.exit(1);
  }
}

main();
```

### Example 3: PreToolUse Hook (Permission Control)

**File**: `.claude/hooks/src/preToolUse.ts`

```typescript
#!/usr/bin/env node

import { resolve, normalize } from 'node:path';

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  try {
    const input = await readStdin();
    const hookData = JSON.parse(input);

    // Only process Write/Edit tools
    if (!['Write', 'Edit'].includes(hookData.tool_name)) {
      process.exit(0);
    }

    const filePath = hookData.tool_input.file_path;
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

    // Normalize path
    const normalizedPath = resolve(projectDir, filePath);

    // Check if path is within project
    if (!normalizedPath.startsWith(projectDir)) {
      // Block - path outside project
      const output = {
        continue: false,
        stopReason: 'File path is outside project directory',
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Path traversal detected'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(2);  // Exit code 2 blocks action
    }

    // Allow with normalized path
    const output = {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: {
          ...hookData.tool_input,
          file_path: normalizedPath
        }
      }
    };
    console.log(JSON.stringify(output));
    process.exit(0);

  } catch (error) {
    console.error('[Hook Critical Error]', error);
    process.exit(1);
  }
}

main();
```

### Example 4: SessionStart Hook (Environment Persistence)

**File**: `.claude/hooks/src/sessionStart.ts`

```typescript
#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  try {
    const input = await readStdin();
    const hookData = JSON.parse(input);

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const dbPath = join(projectDir, '.data', 'context.db');

    // Persist environment variables for session
    if (process.env.CLAUDE_ENV_FILE) {
      appendFileSync(
        process.env.CLAUDE_ENV_FILE,
        `export SESSION_ID="${hookData.session_id}"\n`
      );
      appendFileSync(
        process.env.CLAUDE_ENV_FILE,
        `export DB_PATH="${dbPath}"\n`
      );
      appendFileSync(
        process.env.CLAUDE_ENV_FILE,
        `export NODE_ENV="production"\n`
      );
    }

    console.log('[SessionStart] Session initialized');
    process.exit(0);

  } catch (error) {
    console.error('[Hook Critical Error]', error);
    process.exit(1);
  }
}

main();
```

## Troubleshooting

### Hook Not Executing

**Symptoms**: Events not captured, no logs

**Diagnosis**:
```bash
# Check configuration file
cat .claude/settings.json

# Verify compiled files exist
ls -l .claude/hooks/dist/

# Test hook manually
echo '{"hook_event_name":"UserPromptSubmit","session_id":"test","transcript_path":"","cwd":"","permission_mode":"default","prompt":"test"}' | node .claude/hooks/dist/userPromptSubmit.js
```

**Solutions**:
1. Verify `.claude/settings.json` exists (NOT `.claude/hooks.json`)
2. Rebuild TypeScript: `cd .claude/hooks && npm run build`
3. Check hook points to `.js` file, not `.ts`
4. Ensure Node.js installed: `node --version`
5. Check `$CLAUDE_PROJECT_DIR` is used in command

### Hook Too Slow (>100ms)

**Symptoms**: Laggy user experience

**Diagnosis**:
```bash
# Check hook execution time
grep "Duration:" logs/hooks.log | tail -n 20
```

**Solutions**:
1. Profile execution with `console.time()`/`console.timeEnd()`
2. Optimize regex patterns
3. Use WAL mode for SQLite
4. Fire-and-forget pattern (queue event, exit immediately)

### Stdin Reading Issues

**Symptoms**: Hook receives empty input

**Solution**: Use async stdin reading pattern:
```typescript
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
```

### Transcript Not Found (Stop Hook)

**Symptoms**: Cannot read transcript file

**Solutions**:
1. Check transcript_path is absolute path
2. Verify file exists before reading
3. Add error handling for missing transcript

```typescript
import { existsSync } from 'node:fs';

if (!existsSync(hookData.transcript_path)) {
  console.error('Transcript not found:', hookData.transcript_path);
  process.exit(1);
}
```

## Related Documents

### Architecture
- [Hooks & Event Capture Architecture](../architecture/architecture-hooks-event-capture-2025-01-16.md)
- [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md)

### Reviews
- [Hooks Alignment Remediation Report](../reviews/hooks-alignment-remediation-2025-01-17.md)

### Official Documentation
- [Claude Code Hooks Reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Claude Code Hooks Guide](https://docs.anthropic.com/en/docs/claude-code/hooks-guide)

---

**Last Updated**: 2025-01-17
**Version**: 2.0.0 (Aligned with official Claude Code specification)
**Configuration Location**: `.claude/settings.json` (OFFICIAL)
**Hook Format**: Compiled `.js` (NOT `ts-node`)
**IO Method**: `stdin` JSON (official specification)
**Performance Budget**: <100ms p95 (non-blocking requirement)
**Timeout**: 60s default (fail-safe)
