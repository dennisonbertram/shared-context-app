# Phase 1 Hook Development Guide

> Implement Claude Code hooks for event capture with <100ms performance

---
title: Phase 1 Hook Development Guide
category: guide
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [guide, phase-1, hooks, claude-code, event-capture]
---

## Overview

This guide walks you through implementing Claude Code hooks to capture conversation events. You'll learn how to create fast, non-blocking hooks that sanitize and queue events without impacting user experience.

**Time to complete**: 120-150 minutes

## What You'll Build

- UserPromptSubmit hook (captures user input)
- Stop hook (captures agent responses)
- Event queue system (persistent, async)
- Sanitization at hook boundary
- Complete event capture pipeline

## Prerequisites

- **Phase 0 Setup Complete**: [guide-phase-0-foundation-setup-2025-01-16.md](./guide-phase-0-foundation-setup-2025-01-16.md)
- **TDD Workflow Understood**: [guide-tdd-workflow-2025-01-16.md](./guide-tdd-workflow-2025-01-16.md)
- **Subagents Guide Complete**: [guide-using-subagents-2025-01-16.md](./guide-using-subagents-2025-01-16.md)
- **Understanding of Claude Code hooks**: Basic knowledge of lifecycle

## Understanding Claude Code Hooks

### What Are Hooks?

Hooks are scripts that Claude Code invokes at specific lifecycle events:

| Hook | When It Fires | Purpose |
|------|---------------|---------|
| `UserPromptSubmit` | User sends message | Capture user input |
| `Stop` | Agent finishes response | Capture agent output |

### Hook Requirements

**Critical Performance Constraint**: < 100ms execution time

Why? Hooks run synchronously in the user's workflow. Slow hooks = bad UX.

**Strategy**:
- ✅ Fast, rule-based sanitization (< 10ms)
- ✅ Fire-and-forget queue write (< 50ms)
- ✅ Async processing for expensive operations
- ❌ Never do: API calls, heavy computation, blocking I/O

### Hook Lifecycle

```
User Types → UserPromptSubmit Hook → Queue Event → Return (< 100ms)
                                           ↓
                                    Async Processing
                                    (sanitization, extraction)

Agent Responds → Stop Hook → Complete Event → Return (< 100ms)
                                    ↓
                              Queue for Processing
```

## Step 1: Create Hook Directory Structure

### 1.1 Set Up Directories

```bash
mkdir -p .claude/hooks
```

### 1.2 Create hooks.json Configuration

Create `.claude/hooks/hooks.json`:

```json
{
  "hooks": [
    {
      "name": "UserPromptSubmit",
      "script": ".claude/hooks/user-prompt-submit.ts",
      "enabled": true
    },
    {
      "name": "Stop",
      "script": ".claude/hooks/stop.ts",
      "enabled": true
    }
  ]
}
```

## Step 2: Implement Fast Sanitization

### 2.1 Create Sanitization Module

**CRITICAL**: Sanitize BEFORE any storage, including queue.

Create `src/sanitization/fast-sanitize.ts`:

```typescript
/**
 * Fast, rule-based sanitization for hook-level redaction
 * Performance target: < 10ms per message
 */

export interface SanitizationResult {
  sanitized: string;
  redactions: Array<{ type: string; count: number }>;
  durationMs: number;
}

// Regex patterns for common PII
const PII_PATTERNS = {
  API_KEY: /\b(sk-[a-zA-Z0-9]{48}|api[_-]?key[_:\s]*[a-zA-Z0-9]{20,})/gi,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  IP_V4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  ABSOLUTE_PATH: /(?:\/Users\/[^\/\s]+|C:\\Users\\[^\\\s]+)(?:[\/\\][^\s]+)*/g,
  URL_TOKEN: /\b(https?:\/\/[^\s]+[?&](token|key|secret|auth)=[^\s&]+)/gi,
};

export function fastSanitize(text: string): SanitizationResult {
  const startTime = Date.now();
  let sanitized = text;
  const redactions: Array<{ type: string; count: number }> = [];

  // API Keys
  const apiKeyCount = (text.match(PII_PATTERNS.API_KEY) || []).length;
  if (apiKeyCount > 0) {
    sanitized = sanitized.replace(PII_PATTERNS.API_KEY, '[REDACTED_API_KEY]');
    redactions.push({ type: 'api_key', count: apiKeyCount });
  }

  // Emails
  const emailCount = (text.match(PII_PATTERNS.EMAIL) || []).length;
  if (emailCount > 0) {
    sanitized = sanitized.replace(PII_PATTERNS.EMAIL, '[REDACTED_EMAIL]');
    redactions.push({ type: 'email', count: emailCount });
  }

  // IP Addresses
  const ipCount = (text.match(PII_PATTERNS.IP_V4) || []).length;
  if (ipCount > 0) {
    sanitized = sanitized.replace(PII_PATTERNS.IP_V4, '[REDACTED_IP]');
    redactions.push({ type: 'ip_address', count: ipCount });
  }

  // Absolute Paths (with usernames)
  const pathCount = (text.match(PII_PATTERNS.ABSOLUTE_PATH) || []).length;
  if (pathCount > 0) {
    sanitized = sanitized.replace(PII_PATTERNS.ABSOLUTE_PATH, '[REDACTED_PATH]');
    redactions.push({ type: 'file_path', count: pathCount });
  }

  // URL Tokens
  const urlTokenCount = (text.match(PII_PATTERNS.URL_TOKEN) || []).length;
  if (urlTokenCount > 0) {
    sanitized = sanitized.replace(PII_PATTERNS.URL_TOKEN, '[REDACTED_URL]');
    redactions.push({ type: 'url_token', count: urlTokenCount });
  }

  const durationMs = Date.now() - startTime;

  return { sanitized, redactions, durationMs };
}
```

### 2.2 Test Fast Sanitization

Create `src/sanitization/fast-sanitize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { fastSanitize } from './fast-sanitize';

describe('fastSanitize', () => {
  it('should redact OpenAI API keys', () => {
    const input = 'My key is sk-abc123def456ghi789jkl012mno345pqr678stu901';
    const result = fastSanitize(input);
    expect(result.sanitized).toBe('My key is [REDACTED_API_KEY]');
    expect(result.redactions).toContainEqual({ type: 'api_key', count: 1 });
  });

  it('should redact email addresses', () => {
    const input = 'Contact me at user@example.com';
    const result = fastSanitize(input);
    expect(result.sanitized).toBe('Contact me at [REDACTED_EMAIL]');
  });

  it('should redact absolute file paths', () => {
    const input = 'File at /Users/john/Documents/secret.txt';
    const result = fastSanitize(input);
    expect(result.sanitized).toBe('File at [REDACTED_PATH]');
  });

  it('should execute in < 10ms', () => {
    const input = 'No PII here just normal text';
    const result = fastSanitize(input);
    expect(result.durationMs).toBeLessThan(10);
  });

  it('should handle empty strings', () => {
    const result = fastSanitize('');
    expect(result.sanitized).toBe('');
    expect(result.redactions).toHaveLength(0);
  });
});
```

Run tests:

```bash
npm run test:once -- sanitize
```

## Step 3: Implement Event Queue

### 3.1 Create Queue Module

Create `src/queue/event-queue.ts`:

```typescript
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface QueuedEvent {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string; // Already sanitized
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: number;
}

export class EventQueue {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initQueue();
  }

  private initQueue(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_queue (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_queue_status ON event_queue(status);
      CREATE INDEX IF NOT EXISTS idx_queue_conversation ON event_queue(conversation_id);
    `);
  }

  /**
   * Enqueue event (must be fast - < 50ms)
   */
  enqueue(event: Omit<QueuedEvent, 'id' | 'status' | 'created_at'>): string {
    const id = randomUUID();

    this.db
      .prepare(
        `INSERT INTO event_queue (id, conversation_id, role, content, timestamp, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(id, event.conversation_id, event.role, event.content, event.timestamp);

    return id;
  }

  /**
   * Get pending events for processing
   */
  getPending(limit = 100): QueuedEvent[] {
    return this.db
      .prepare(
        `SELECT * FROM event_queue WHERE status = 'pending' ORDER BY created_at LIMIT ?`
      )
      .all(limit) as QueuedEvent[];
  }

  /**
   * Update event status
   */
  updateStatus(id: string, status: QueuedEvent['status']): void {
    this.db.prepare(`UPDATE event_queue SET status = ? WHERE id = ?`).run(status, id);
  }

  close(): void {
    this.db.close();
  }
}
```

### 3.2 Test Event Queue

Create `src/queue/event-queue.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventQueue } from './event-queue';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { unlinkSync, existsSync } from 'fs';

describe('EventQueue', () => {
  let queue: EventQueue;
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(tmpdir(), `test-queue-${randomUUID()}.db`);
    queue = new EventQueue(dbPath);
  });

  afterEach(() => {
    queue.close();
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  it('should enqueue events quickly', () => {
    const start = Date.now();

    const eventId = queue.enqueue({
      conversation_id: 'conv-123',
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
    });

    const duration = Date.now() - start;

    expect(eventId).toBeTruthy();
    expect(duration).toBeLessThan(50); // < 50ms requirement
  });

  it('should retrieve pending events', () => {
    queue.enqueue({
      conversation_id: 'conv-123',
      role: 'user',
      content: 'Message 1',
      timestamp: Date.now(),
    });

    const pending = queue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
  });

  it('should update event status', () => {
    const id = queue.enqueue({
      conversation_id: 'conv-123',
      role: 'user',
      content: 'Test',
      timestamp: Date.now(),
    });

    queue.updateStatus(id, 'completed');

    const pending = queue.getPending();
    expect(pending).toHaveLength(0); // No longer pending
  });
});
```

## Step 4: Implement UserPromptSubmit Hook

### 4.1 Create Hook Script

Create `.claude/hooks/user-prompt-submit.ts`:

```typescript
#!/usr/bin/env ts-node

import { fastSanitize } from '../../src/sanitization/fast-sanitize';
import { EventQueue } from '../../src/queue/event-queue';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { appendFileSync } from 'fs';

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/context.db');
const LOG_PATH = join(__dirname, '../../logs/hooks.log');

/**
 * UserPromptSubmit Hook
 * Captures user input, sanitizes it, and queues for processing
 * CRITICAL: Must execute in < 100ms
 */

interface HookInput {
  prompt: string;
  conversation_id?: string;
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(LOG_PATH, `[${timestamp}] UserPromptSubmit: ${message}\n`);
  } catch {
    // Fail silently - never break user flow
  }
}

function main(): void {
  const startTime = Date.now();

  try {
    // Parse input from stdin
    const input = process.argv[2] || '{}';
    const data: HookInput = JSON.parse(input);

    const prompt = data.prompt || '';
    const conversationId = data.conversation_id || randomUUID();

    // SANITIZE BEFORE STORAGE (privacy guarantee)
    const sanitizationResult = fastSanitize(prompt);

    // Queue sanitized event (fast, non-blocking)
    const queue = new EventQueue(DB_PATH);
    queue.enqueue({
      conversation_id: conversationId,
      role: 'user',
      content: sanitizationResult.sanitized,
      timestamp: Date.now(),
    });
    queue.close();

    const duration = Date.now() - startTime;

    log(
      `Captured user prompt. Redactions: ${sanitizationResult.redactions.length}. Duration: ${duration}ms`
    );

    // CRITICAL: Verify < 100ms
    if (duration > 100) {
      log(`⚠ WARNING: Hook took ${duration}ms (> 100ms threshold)`);
    }
  } catch (error) {
    // FAIL SILENTLY - never throw to caller
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error: ${errorMsg}`);
  }
}

main();
```

Make executable:

```bash
chmod +x .claude/hooks/user-prompt-submit.ts
```

## Step 5: Implement Stop Hook

### 5.1 Create Stop Hook Script

Create `.claude/hooks/stop.ts`:

```typescript
#!/usr/bin/env ts-node

import { fastSanitize } from '../../src/sanitization/fast-sanitize';
import { EventQueue } from '../../src/queue/event-queue';
import { join } from 'path';
import { appendFileSync } from 'fs';

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/context.db');
const LOG_PATH = join(__dirname, '../../logs/hooks.log');

interface HookInput {
  response: string;
  conversation_id: string;
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(LOG_PATH, `[${timestamp}] Stop: ${message}\n`);
  } catch {
    // Fail silently
  }
}

function main(): void {
  const startTime = Date.now();

  try {
    const input = process.argv[2] || '{}';
    const data: HookInput = JSON.parse(input);

    const response = data.response || '';
    const conversationId = data.conversation_id;

    // Sanitize response
    const sanitizationResult = fastSanitize(response);

    // Queue sanitized event
    const queue = new EventQueue(DB_PATH);
    queue.enqueue({
      conversation_id: conversationId,
      role: 'assistant',
      content: sanitizationResult.sanitized,
      timestamp: Date.now(),
    });
    queue.close();

    const duration = Date.now() - startTime;

    log(
      `Captured assistant response. Redactions: ${sanitizationResult.redactions.length}. Duration: ${duration}ms`
    );

    if (duration > 100) {
      log(`⚠ WARNING: Hook took ${duration}ms (> 100ms threshold)`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error: ${errorMsg}`);
  }
}

main();
```

Make executable:

```bash
chmod +x .claude/hooks/stop.ts
```

## Step 6: Manual Testing

### 6.1 Create Test Script

Create `test-hooks.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testHooks() {
  console.log('Testing UserPromptSubmit hook...\n');

  const userPromptPayload = JSON.stringify({
    prompt: 'My API key is sk-abc123def456ghi789jkl012mno345pqr678stu901',
    conversation_id: 'test-conv-123',
  });

  const { stdout: userOutput } = await execAsync(
    `./.claude/hooks/user-prompt-submit.ts '${userPromptPayload}'`
  );

  console.log('UserPromptSubmit output:', userOutput || '(no output - good!)');

  console.log('\nTesting Stop hook...\n');

  const stopPayload = JSON.stringify({
    response: 'Sure! Contact me at admin@example.com for more info.',
    conversation_id: 'test-conv-123',
  });

  const { stdout: stopOutput } = await execAsync(
    `./.claude/hooks/stop.ts '${stopPayload}'`
  );

  console.log('Stop output:', stopOutput || '(no output - good!)');

  console.log('\nChecking queued events...\n');

  const { EventQueue } = await import('./src/queue/event-queue');
  const queue = new EventQueue('./data/context.db');

  const pending = queue.getPending();
  console.log(`Pending events: ${pending.length}`);

  pending.forEach((event) => {
    console.log(`  - ${event.role}: ${event.content.substring(0, 50)}...`);
  });

  queue.close();

  console.log('\n✓ Hook test complete');
}

testHooks().catch(console.error);
```

Run test:

```bash
ts-node test-hooks.ts
```

**Expected output**:
```
Testing UserPromptSubmit hook...
UserPromptSubmit output: (no output - good!)

Testing Stop hook...
Stop output: (no output - good!)

Checking queued events...
Pending events: 2
  - user: My API key is [REDACTED_API_KEY]
  - assistant: Sure! Contact me at [REDACTED_EMAIL] for more...

✓ Hook test complete
```

### 6.2 Check Logs

```bash
tail logs/hooks.log
```

**Expected output**:
```
[2025-01-16T10:30:00.000Z] UserPromptSubmit: Captured user prompt. Redactions: 1. Duration: 23ms
[2025-01-16T10:30:00.100Z] Stop: Captured assistant response. Redactions: 1. Duration: 19ms
```

## Verification

### Performance Check

All hook executions should be < 100ms:

```bash
grep "Duration:" logs/hooks.log | awk -F'Duration: ' '{print $2}' | sort -n
```

All values should be < 100ms.

### Privacy Check

No raw PII should be in database:

```bash
sqlite3 data/context.db "SELECT content FROM event_queue LIMIT 10"
```

Should see `[REDACTED_*]` placeholders, not actual PII.

## You're Done When...

- ✅ UserPromptSubmit hook captures user input
- ✅ Stop hook captures agent responses
- ✅ All PII sanitized before storage
- ✅ Hook execution < 100ms
- ✅ Events queued in database
- ✅ Logs show successful captures
- ✅ Manual test passes

## Troubleshooting

### Hook not firing

Check hooks.json is valid and scripts are executable:

```bash
cat .claude/hooks/hooks.json
ls -l .claude/hooks/*.ts
```

### Hook too slow (> 100ms)

Profile with timing:

```typescript
console.time('sanitize');
const result = fastSanitize(text);
console.timeEnd('sanitize');
```

Optimize regex patterns or reduce text length.

### Queue errors

Check database exists and is writable:

```bash
ls -lh data/context.db
sqlite3 data/context.db "SELECT COUNT(*) FROM event_queue"
```

## Next Steps

Hooks are now capturing events! Next:

1. **Phase 2**: [Sanitization Pipeline](../plans/plan-phase-2-sanitization-2025-01-16.md) - Full AI-powered sanitization
2. **Phase 3**: [Database & Storage](../plans/plan-phase-3-database-storage-2025-01-16.md) - Persistent storage
3. **Phase 4**: [Async Processing](../plans/plan-phase-4-async-processing-2025-01-16.md) - Background workers

## Related Documents

- [Hooks & Event Capture Architecture](../architecture/architecture-hooks-event-capture-2025-01-16.md)
- [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md)
- [TDD Workflow Guide](./guide-tdd-workflow-2025-01-16.md)
