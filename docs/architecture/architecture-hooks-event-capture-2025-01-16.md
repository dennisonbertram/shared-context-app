# Hooks and Event Capture Architecture

> Low-latency event capture system using Claude Code hooks without blocking user interactions

---
title: Hooks and Event Capture Architecture
category: architecture
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [hooks, event-capture, performance, async, non-blocking]
---

## Overview

The Hooks and Event Capture system captures every Claude Code interaction (user prompts and agent responses) without impacting user experience. It achieves sub-100ms performance through fire-and-forget async design, persistent queuing, and graceful error handling.

**Core Principle**: Never block the user. Capture everything, fail silently with logging.

## Goals

- Capture 100% of user-agent interactions
- Hook execution < 100ms (p95)
- Non-blocking design (fire-and-forget)
- Crash-safe event persistence
- Zero user-visible errors
- Idempotent event processing

## Non-Goals

- Real-time processing (use async queue)
- Perfect ordering across crashes (eventual consistency OK)
- Capturing internal LLM chain-of-thought (not accessible)
- Network-based event streaming (local-first)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code                              │
│                 (User Interaction Layer)                     │
└───────────┬─────────────────────────────┬───────────────────┘
            │                              │
            ▼ UserPromptSubmit             ▼ Stop
   ┌────────────────┐            ┌────────────────┐
   │  Hook Handler  │            │  Hook Handler  │
   │  (< 50ms)      │            │  (< 50ms)      │
   └────────┬───────┘            └───────┬────────┘
            │                             │
            ├─────────────────────────────┘
            │
            ▼ serialize + enqueue (fire-and-forget)
   ┌────────────────────────────────────────────┐
   │         Event Collector                     │
   │  ┌──────────────────────────────────────┐  │
   │  │  - Assign conversation_id            │  │
   │  │  - Assign message_id                 │  │
   │  │  - Add sequence number               │  │
   │  │  - Add timestamps                    │  │
   │  │  - Add idempotency_key               │  │
   │  └──────────────────────────────────────┘  │
   └────────────┬───────────────────────────────┘
                │
                ▼ persist (WAL mode)
   ┌────────────────────────────────────────────┐
   │      SQLite Event Queue                     │
   │  ┌──────────────────────────────────────┐  │
   │  │  events table                        │  │
   │  │  - id, conversation_id, message_id   │  │
   │  │  - type, role, content, sequence     │  │
   │  │  - idempotency_key, timestamps       │  │
   │  │  - status (pending/processing/done)  │  │
   │  └──────────────────────────────────────┘  │
   └────────────┬───────────────────────────────┘
                │
                ▼ async worker picks up
   ┌────────────────────────────────────────────┐
   │    Sanitization Job Queue                   │
   │    (downstream processing)                  │
   └────────────────────────────────────────────┘
```

## Event Schema

### Hook Input Schema

Claude Code hooks receive JSON data via stdin with the following structure:

**UserPromptSubmit Hook Input**:
```typescript
interface UserPromptSubmitHookData {
  session_id: string;            // Unique session identifier
  transcript_path: string;       // Path to JSONL transcript file
  cwd: string;                   // Current working directory
  permission_mode: string;       // Permission mode (e.g., "default")
  hook_event_name: "UserPromptSubmit";
  prompt: string;                // User's prompt text
}
```

**Stop Hook Input**:
```typescript
interface StopHookData {
  session_id: string;            // Unique session identifier
  transcript_path: string;       // Path to JSONL transcript file
  cwd: string;                   // Current working directory
  permission_mode: string;       // Permission mode (e.g., "default")
  hook_event_name: "Stop";
  stop_hook_active: boolean;     // Indicates Stop hook is running
}
```

**Note**: The Stop hook does NOT receive the agent response directly. You must read and parse the `transcript_path` file to extract the response.

### Event Structure

```typescript
interface CapturedEvent {
  // Identity
  id: string;                    // UUID v4
  conversation_id: string;       // Stable conversation identifier
  message_id: string;            // Unique message identifier
  idempotency_key: string;       // For deduplication

  // Content
  type: 'user_prompt' | 'agent_response';
  role: 'user' | 'assistant';
  content: string;               // Raw content (NOT sanitized yet)
  tool_calls?: ToolCall[];       // Tool invocations
  attachments?: Attachment[];    // File attachments

  // Metadata
  sequence: number;              // Order within conversation
  session_id: string;            // Claude Code session ID
  transcript_path: string;       // Path to transcript file
  created_at: number;            // Unix timestamp (ms)
  hook_name: string;             // 'UserPromptSubmit' | 'Stop'

  // Versioning
  client_version: string;        // Claude Code version
  policy_version: string;        // Sanitization policy version

  // Processing
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_at?: number;
  error?: string;
}

interface ToolCall {
  tool: string;
  input: any;
  output?: any;
}

interface Attachment {
  name: string;
  path: string;
  mime_type: string;
  size: number;
}
```

## Hook Implementation

### Stdin Reading Utility

All hooks must read their input from stdin (not process.argv):

```typescript
/**
 * Read JSON input from stdin
 * All Claude Code hooks receive data via stdin
 */
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

### UserPromptSubmit Hook

**File**: `.claude/hooks/user-prompt-submit.ts`

```typescript
#!/usr/bin/env node
import { captureEvent } from './lib/event-collector';

/**
 * Read JSON input from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/**
 * UserPromptSubmit hook
 * Executes BEFORE Claude processes the user's prompt
 * Performance budget: < 50ms
 */
async function main() {
  const startTime = performance.now();

  try {
    // Read hook input from stdin
    const input = await readStdin();
    const hookData = JSON.parse(input);

    // Validate event type
    if (hookData.hook_event_name !== 'UserPromptSubmit') {
      console.error('[Hook Error] Unexpected event:', hookData.hook_event_name);
      process.exit(1);
    }

    // Fire-and-forget event capture
    captureEvent({
      type: 'user_prompt',
      role: 'user',
      content: hookData.prompt,
      session_id: hookData.session_id,
      transcript_path: hookData.transcript_path
    }).catch(error => {
      // Log error but don't throw (never block user)
      console.error('[Hook Error]', error);
    });

    // Always succeed quickly
    const duration = performance.now() - startTime;
    if (duration > 50) {
      console.warn(`[Hook Warning] Execution took ${duration}ms (budget: 50ms)`);
    }

  } catch (error) {
    // Silent failure - log only
    console.error('[Hook Critical Error]', error);
  }

  // Exit successfully (never block)
  process.exit(0);
}

main();
```

### Stop Hook

**File**: `.claude/hooks/stop.ts`

```typescript
#!/usr/bin/env node
import fs from 'fs';
import { captureEvent } from './lib/event-collector';

/**
 * Read JSON input from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/**
 * Parse JSONL transcript file to extract messages
 */
function parseTranscript(transcriptPath: string): any[] {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  return content.split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

/**
 * Stop hook
 * Executes AFTER Claude completes its response
 * Performance budget: < 50ms
 *
 * Note: Stop hook receives transcript_path, not the response directly.
 * Must read and parse transcript file to extract the agent's response.
 */
async function main() {
  const startTime = performance.now();

  try {
    // Read hook input from stdin
    const input = await readStdin();
    const hookData = JSON.parse(input);

    // Validate event type
    if (hookData.hook_event_name !== 'Stop') {
      console.error('[Hook Error] Unexpected event:', hookData.hook_event_name);
      process.exit(1);
    }

    // Read transcript to get agent response
    const transcript = parseTranscript(hookData.transcript_path);
    const lastMessage = transcript[transcript.length - 1];

    // Extract response content
    const response = lastMessage.content;

    // Fire-and-forget event capture
    captureEvent({
      type: 'agent_response',
      role: 'assistant',
      content: response,
      session_id: hookData.session_id,
      transcript_path: hookData.transcript_path
    }).catch(error => {
      console.error('[Hook Error]', error);
    });

    const duration = performance.now() - startTime;
    if (duration > 50) {
      console.warn(`[Hook Warning] Execution took ${duration}ms (budget: 50ms)`);
    }

  } catch (error) {
    console.error('[Hook Critical Error]', error);
  }

  // Exit successfully (never block)
  process.exit(0);
}

main();
```

### Hook Configuration

**File**: `.claude/settings.json`

Hooks are configured in `.claude/settings.json` (NOT `.claude/hooks.json`). Each hook event uses a matcher/hooks array structure:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/user-prompt-submit.js",
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
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/stop.js",
            "timeout": 100
          }
        ]
      }
    ]
  }
}
```

**Key Configuration Details**:
- File location: `.claude/settings.json` (not `.claude/hooks.json`)
- Each hook event is an array of matcher objects
- Each matcher contains a `hooks` array
- Matcher can be omitted for non-tool events (UserPromptSubmit, Stop)
- Each hook requires:
  - `type`: "command" (or "prompt" for LLM-based hooks)
  - `command`: Single string with command and arguments combined
  - `timeout`: Milliseconds before hook is killed (default: 60000)
- Use `$CLAUDE_PROJECT_DIR` environment variable for project-relative paths
- Commands are executed with shell expansion, so quote paths with spaces

## Event Collector

### Non-Blocking Design

```typescript
// lib/event-collector.ts
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

/**
 * Fire-and-forget event capture
 * Returns immediately, processes async
 */
export async function captureEvent(event: Partial<CapturedEvent>): Promise<void> {
  // Immediate return - don't await
  setImmediate(() => {
    processEvent(event).catch(error => {
      logger.error('Event processing failed', { error, event });
    });
  });

  // Return immediately (< 1ms)
  return;
}

/**
 * Async event processing
 * Runs in background, never blocks caller
 */
async function processEvent(event: Partial<CapturedEvent>): Promise<void> {
  try {
    // Enrich event with metadata
    const enrichedEvent: CapturedEvent = {
      id: uuid(),
      conversation_id: getOrCreateConversationId(event),
      message_id: uuid(),
      idempotency_key: generateIdempotencyKey(event),
      sequence: getNextSequence(event.conversation_id!),
      session_id: event.session_id || getSessionId(),
      created_at: Date.now(),
      hook_name: event.type === 'user_prompt' ? 'UserPromptSubmit' : 'Stop',
      client_version: getClientVersion(),
      policy_version: getPolicyVersion(),
      status: 'pending',
      ...event
    } as CapturedEvent;

    // Persist to queue (< 10ms with WAL)
    await eventQueue.enqueue(enrichedEvent);

    logger.info('Event captured', {
      conversation_id: enrichedEvent.conversation_id,
      message_id: enrichedEvent.message_id,
      type: enrichedEvent.type
    });

  } catch (error) {
    logger.error('Event enrichment failed', { error, event });
    throw error;
  }
}
```

### Conversation Management

```typescript
// lib/conversation-tracker.ts
const conversationCache = new Map<string, string>();

/**
 * Get or create stable conversation ID
 * Uses session_id + heuristics to group messages
 */
function getOrCreateConversationId(event: Partial<CapturedEvent>): string {
  const sessionId = event.session_id || getSessionId();

  // Check cache
  if (conversationCache.has(sessionId)) {
    return conversationCache.get(sessionId)!;
  }

  // Create new conversation ID
  const conversationId = uuid();
  conversationCache.set(sessionId, conversationId);

  return conversationId;
}

/**
 * Get next sequence number for conversation
 * Ensures ordering within conversation
 */
function getNextSequence(conversationId: string): number {
  // Query database for max sequence
  const result = db.prepare(`
    SELECT COALESCE(MAX(sequence), 0) as max_seq
    FROM events
    WHERE conversation_id = ?
  `).get(conversationId);

  return (result?.max_seq || 0) + 1;
}
```

## Event Queue Persistence

### SQLite Configuration

```typescript
// lib/event-queue.ts
import Database from 'better-sqlite3';

class EventQueue {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);

    // Performance optimizations
    this.db.pragma('journal_mode = WAL');        // Write-ahead logging
    this.db.pragma('synchronous = NORMAL');      // Balanced safety/speed
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,

        type TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        attachments TEXT,

        sequence INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        project_id TEXT,
        created_at INTEGER NOT NULL,
        hook_name TEXT NOT NULL,

        client_version TEXT NOT NULL,
        policy_version TEXT NOT NULL,

        status TEXT NOT NULL DEFAULT 'pending',
        processed_at INTEGER,
        error TEXT,

        CHECK(type IN ('user_prompt', 'agent_response')),
        CHECK(role IN ('user', 'assistant')),
        CHECK(status IN ('pending', 'processing', 'completed', 'failed'))
      );

      CREATE INDEX IF NOT EXISTS idx_events_conversation
        ON events(conversation_id, sequence);

      CREATE INDEX IF NOT EXISTS idx_events_status
        ON events(status, created_at);

      CREATE INDEX IF NOT EXISTS idx_events_session
        ON events(session_id, created_at);
    `);
  }

  /**
   * Enqueue event (< 10ms with WAL)
   * Idempotent via idempotency_key
   */
  async enqueue(event: CapturedEvent): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        id, conversation_id, message_id, idempotency_key,
        type, role, content, tool_calls, attachments,
        sequence, session_id, project_id, created_at, hook_name,
        client_version, policy_version, status
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    insert.run(
      event.id,
      event.conversation_id,
      event.message_id,
      event.idempotency_key,
      event.type,
      event.role,
      event.content,
      JSON.stringify(event.tool_calls || []),
      JSON.stringify(event.attachments || []),
      event.sequence,
      event.session_id,
      event.project_id,
      event.created_at,
      event.hook_name,
      event.client_version,
      event.policy_version,
      event.status
    );
  }

  /**
   * Dequeue pending events for processing
   */
  async dequeue(limit: number = 10): Promise<CapturedEvent[]> {
    const events = this.db.prepare(`
      SELECT * FROM events
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit);

    return events.map(row => ({
      ...row,
      tool_calls: JSON.parse(row.tool_calls || '[]'),
      attachments: JSON.parse(row.attachments || '[]')
    }));
  }
}
```

### Idempotency

```typescript
/**
 * Generate idempotency key for deduplication
 * Ensures retry-safe operations
 */
function generateIdempotencyKey(event: Partial<CapturedEvent>): string {
  const components = [
    event.session_id,
    event.type,
    event.content?.slice(0, 100), // First 100 chars
    event.created_at
  ];

  return createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}
```

## Performance Optimizations

### Backpressure Handling

```typescript
// lib/backpressure.ts
class BackpressureManager {
  private bufferSize: number = 0;
  private maxBufferSize: number = 1000;
  private samplingRate: number = 1.0;

  async handleEvent(event: Partial<CapturedEvent>): Promise<boolean> {
    // Check buffer size
    this.bufferSize = await this.getQueueSize();

    if (this.bufferSize > this.maxBufferSize) {
      // Apply sampling
      if (Math.random() > this.samplingRate) {
        logger.warn('Event dropped due to backpressure', {
          bufferSize: this.bufferSize,
          samplingRate: this.samplingRate
        });
        return false;
      }
    }

    // Process event
    await captureEvent(event);
    return true;
  }

  private async getQueueSize(): Promise<number> {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE status = 'pending'
    `).get();

    return result?.count || 0;
  }
}
```

### Streaming Handling

```typescript
// lib/streaming-handler.ts
class StreamingHandler {
  private partialBuffers = new Map<string, string>();

  handlePartial(sessionId: string, chunk: string): void {
    // Buffer partial chunks
    const existing = this.partialBuffers.get(sessionId) || '';
    this.partialBuffers.set(sessionId, existing + chunk);
  }

  async handleComplete(sessionId: string, final?: string): Promise<void> {
    // Get buffered content
    const buffered = this.partialBuffers.get(sessionId) || '';
    const content = final || buffered;

    // Capture complete event
    await captureEvent({
      session_id: sessionId,
      type: 'agent_response',
      role: 'assistant',
      content
    });

    // Clear buffer
    this.partialBuffers.delete(sessionId);
  }

  // Cleanup stale buffers
  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, _] of this.partialBuffers) {
      const lastUpdate = this.getLastUpdate(sessionId);
      if (now - lastUpdate > 60000) { // 1 minute timeout
        this.partialBuffers.delete(sessionId);
      }
    }
  }
}
```

## Error Handling

### Graceful Degradation

```typescript
// lib/error-handler.ts
class HookErrorHandler {
  async safeExecute<T>(
    operation: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      logger.error('Hook operation failed', { error });

      // Emit metric
      metrics.increment('hook.error', {
        operation: operation.name
      });

      // Return fallback (never throw to caller)
      return fallback;
    }
  }

  handleCriticalError(error: Error): void {
    // Log to file (don't rely on network)
    appendFileSync(
      '.data/hook-errors.log',
      JSON.stringify({ timestamp: Date.now(), error: error.message }) + '\n'
    );

    // Attempt to emit metric
    metrics.increment('hook.critical_error').catch(() => {});
  }
}
```

### Recovery Strategies

```typescript
// lib/recovery.ts
class RecoveryManager {
  /**
   * Recover from crashed queue
   * Reset stuck events to pending
   */
  async recoverQueue(): Promise<void> {
    const updated = db.prepare(`
      UPDATE events
      SET status = 'pending', error = 'Recovered from crash'
      WHERE status = 'processing'
        AND created_at < ?
    `).run(Date.now() - 300000); // 5 minutes ago

    logger.info('Queue recovery completed', {
      recovered: updated.changes
    });
  }

  /**
   * Cleanup old completed events
   */
  async cleanup(retentionDays: number = 7): Promise<void> {
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const deleted = db.prepare(`
      DELETE FROM events
      WHERE status = 'completed'
        AND processed_at < ?
    `).run(cutoff);

    logger.info('Event cleanup completed', {
      deleted: deleted.changes
    });
  }
}
```

## Security Considerations

### Hook Sandboxing

```typescript
// Use Claude Code environment variables
const projectDir = process.env.CLAUDE_PROJECT_DIR;
const isRemote = process.env.CLAUDE_CODE_REMOTE === 'true';

// Restrict file system access to project directory
const allowedPaths = [
  path.join(projectDir, '.data'),
  path.join(projectDir, '.claude')
];

function validatePath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return allowedPaths.some(allowed => resolved.startsWith(allowed));
}
```

### Environment Variables

Claude Code provides several environment variables to hooks:

**Available in All Hooks**:
- `CLAUDE_PROJECT_DIR`: Absolute path to project root directory
- `CLAUDE_CODE_REMOTE`: Set to "true" if running in web/remote environment, unset for local CLI

**Available in SessionStart Hook Only**:
- `CLAUDE_ENV_FILE`: File path for persisting environment variables across session

**Example Usage**:
```typescript
// Access project directory
const projectDir = process.env.CLAUDE_PROJECT_DIR;
const dbPath = path.join(projectDir, '.data', 'events.db');

// Detect environment
const isRemote = process.env.CLAUDE_CODE_REMOTE === 'true';
if (isRemote) {
  console.log('Running in web environment');
}

// SessionStart hook: Persist env vars
if (process.env.CLAUDE_ENV_FILE) {
  fs.appendFileSync(
    process.env.CLAUDE_ENV_FILE,
    'export API_KEY=your-key\n'
  );
}
```

**Note**: Do NOT set arbitrary environment variables like `NODE_ENV` in hooks. Use the provided Claude Code environment variables instead.

### Log Sanitization

```typescript
// Never log sensitive data in hooks
function sanitizeLogData(data: any): any {
  const sanitized = { ...data };

  // Remove potential PII fields
  delete sanitized.content;
  delete sanitized.tool_calls;
  delete sanitized.attachments;

  return sanitized;
}

logger.info('Event captured', sanitizeLogData(event));
```

## Monitoring

### Key Metrics

```typescript
// Metrics to track
metrics.timing('hook.execution_time', duration);
metrics.increment('hook.success');
metrics.increment('hook.error');
metrics.gauge('event_queue.size', queueSize);
metrics.timing('event_queue.enqueue_time', enqueueDuration);
```

### Health Checks

```typescript
// Health check endpoint
async function healthCheck(): Promise<HealthStatus> {
  return {
    queue: {
      size: await getQueueSize(),
      oldestEvent: await getOldestEventAge()
    },
    hooks: {
      enabled: areHooksEnabled(),
      lastExecution: getLastExecutionTime()
    }
  };
}
```

## Related Documents

### Architecture
- [Global Context Network](./architecture-global-context-network-2025-01-16.md)
- [Sanitization Pipeline](./architecture-sanitization-pipeline-2025-01-16.md)
- [Database Schema](./architecture-database-schema-2025-01-16.md)

### Reference
- [Event Schema Reference](../reference/reference-event-schema-2025-01-16.md)
- [Hook Configuration](../reference/reference-hook-configuration-2025-01-16.md)
