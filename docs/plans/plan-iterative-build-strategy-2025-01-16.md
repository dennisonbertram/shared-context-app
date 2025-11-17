# Iterative Build Strategy - Global Context Network

> A level-by-level implementation plan where each iteration produces a working, testable, demonstrable system

---
title: Iterative Build Strategy
category: plan
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [iteration, tdd, vertical-slice, working-software, incremental]
---

## Overview

This document defines a **working-software-first** build strategy for the Global Context Network. Each level produces a complete vertical slice through the system that can be built, tested, and demonstrated independently.

**Core Principle**: Always have working code. Never break what already works. Build complexity incrementally through proven layers.

**Critical Reviews Context**:
- GPT-5 identified critical contradictions in privacy flow and schema
- Gemini flagged unrealistic 7-9 week timeline
- Both emphasized missing core architecture documents
- This plan addresses those issues with concrete, buildable steps

## The Iteration Philosophy

### What Makes a Good Iteration?

✅ **GOOD Iteration**:
- Adds ONE capability that works end-to-end
- Has passing tests proving it works
- Can be demonstrated to stakeholders
- Takes hours or days, not weeks
- Leaves system in working state

❌ **BAD Iteration**:
- Builds infrastructure for future features
- Requires multiple future iterations to work
- Has no demonstrable value
- Optimizes before basics work
- Leaves system broken or incomplete

### Example: Email PII Detection

```
✅ GOOD: "Add email PII detection with 3 test cases"
   - Write regex for email detection
   - Write 3 tests (basic, edge case, false positive)
   - Tests pass
   - Demo: Show email getting redacted
   - Duration: 2-4 hours

❌ BAD: "Build complete sanitization pipeline with all 34 PII types"
   - Too large, takes weeks
   - Can't test until all 34 types work
   - No intermediate value
   - High risk of rework
```

## Iteration Levels (15 Levels)

### Level 0: Project Foundation (Hello World)
**Duration**: 4-6 hours
**Goal**: TypeScript project compiles and runs basic test

**Deliverable**:
```typescript
// src/hello.ts
export function hello(name: string): string {
  return `Hello, ${name}!`;
}

// tests/hello.test.ts
import { describe, it, expect } from 'vitest';
import { hello } from '../src/hello';

describe('hello', () => {
  it('should greet by name', () => {
    expect(hello('World')).toBe('Hello, World!');
  });
});
```

**Tests**:
- `npm test` passes
- `npm run type-check` passes
- `npm run lint` passes

**Acceptance**:
- [ ] TypeScript strict mode enabled
- [ ] Vitest configured and running
- [ ] ESLint passing
- [ ] Can build with `npm run build`

**What NOT to do**:
- ❌ Set up database
- ❌ Configure hooks
- ❌ Plan entire architecture

---

### Level 1: SQLite Connection (Write + Read)
**Duration**: 3-4 hours
**Goal**: Write one record to SQLite, read it back

**Deliverable**:
```typescript
// src/database/connection.ts
import Database from 'better-sqlite3';

export function createDb(path: string = ':memory:'): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// src/database/test-write.ts
export function writeTestRecord(db: Database.Database, message: string): string {
  const id = Date.now().toString();
  db.prepare('CREATE TABLE IF NOT EXISTS test (id TEXT PRIMARY KEY, message TEXT)').run();
  db.prepare('INSERT INTO test (id, message) VALUES (?, ?)').run(id, message);
  return id;
}

export function readTestRecord(db: Database.Database, id: string): string | null {
  const row = db.prepare('SELECT message FROM test WHERE id = ?').get(id) as { message: string } | undefined;
  return row?.message ?? null;
}
```

**Tests**:
```typescript
it('should write and read a record', () => {
  const db = createDb();
  const id = writeTestRecord(db, 'test message');
  const message = readTestRecord(db, id);
  expect(message).toBe('test message');
  db.close();
});
```

**Acceptance**:
- [ ] Can create in-memory database
- [ ] Can write record
- [ ] Can read record back
- [ ] Test passes

**What NOT to do**:
- ❌ Build migrations system
- ❌ Design full schema
- ❌ Add indexes or constraints

---

### Level 2: Hook Skeleton (Receive Event, Log It)
**Duration**: 4-6 hours
**Goal**: Hook receives stdin event and logs to console

**Deliverable**:
```typescript
// .claude/hooks/src/userPromptSubmit.ts
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  try {
    const input = await readStdin();
    const event = JSON.parse(input);
    console.log('Event received:', {
      type: event.type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Fail silently - never block user
    console.error('Hook error:', error);
  }
}

main();
```

**Build Script**:
```json
// .claude/hooks/package.json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}
```

**Hook Config**:
```json
// .claude/hooks.json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js"
  }
}
```

**Tests**:
```typescript
it('should parse event from stdin', async () => {
  const mockEvent = { type: 'UserPromptSubmit', content: 'test' };
  const result = await parseEvent(JSON.stringify(mockEvent));
  expect(result.type).toBe('UserPromptSubmit');
});
```

**Acceptance**:
- [ ] TypeScript compiles to `.js`
- [ ] Hook runs when triggered
- [ ] Logs event to console
- [ ] Doesn't crash on malformed input
- [ ] Completes in <100ms (measured)

**What NOT to do**:
- ❌ Write to database
- ❌ Sanitize content
- ❌ Process async

---

### Level 3: Fast Sanitization (One PII Type)
**Duration**: 4-6 hours
**Goal**: Redact email addresses from text

**Deliverable**:
```typescript
// src/sanitization/fast-sanitize.ts
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

export function sanitizeEmails(text: string): string {
  return text.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
}
```

**Tests**:
```typescript
describe('sanitizeEmails', () => {
  it('should redact basic email', () => {
    expect(sanitizeEmails('Contact: user@example.com'))
      .toBe('Contact: [REDACTED_EMAIL]');
  });

  it('should redact multiple emails', () => {
    expect(sanitizeEmails('user1@ex.com and user2@ex.com'))
      .toBe('[REDACTED_EMAIL] and [REDACTED_EMAIL]');
  });

  it('should not redact non-emails', () => {
    expect(sanitizeEmails('Not an email: test@'))
      .toBe('Not an email: test@');
  });
});
```

**Performance Test**:
```typescript
it('should sanitize in <10ms', () => {
  const text = 'user@example.com '.repeat(100);
  const start = performance.now();
  sanitizeEmails(text);
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(10);
});
```

**Acceptance**:
- [ ] 3 unit tests pass
- [ ] Performance test passes (<10ms for 100 emails)
- [ ] No false positives in test cases

**What NOT to do**:
- ❌ Add other PII types (phones, IPs, etc.)
- ❌ Add AI validation
- ❌ Build configuration system

---

### Level 4: Hook + Sanitize + Write (End-to-End)
**Duration**: 6-8 hours
**Goal**: Hook receives event, sanitizes email, writes to SQLite

**Deliverable**:
```typescript
// .claude/hooks/src/userPromptSubmit.ts
import { performance } from 'node:perf_hooks';
import Database from 'better-sqlite3';
import { sanitizeEmails } from '../../src/sanitization/fast-sanitize';

interface Event {
  type: string;
  content: string;
  timestamp: string;
}

async function main() {
  const start = performance.now();

  try {
    const input = await readStdin();
    const event: Event = JSON.parse(input);

    // Fast sanitization
    const sanitized = sanitizeEmails(event.content);

    // Write to database
    const db = new Database('.claude/context.db');
    db.pragma('journal_mode = WAL');

    db.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `).run();

    db.prepare('INSERT INTO messages (id, content, created_at) VALUES (?, ?, ?)')
      .run(Date.now().toString(), sanitized, new Date().toISOString());

    db.close();

    const duration = performance.now() - start;
    console.log(`Hook completed in ${duration.toFixed(2)}ms`);

  } catch (error) {
    console.error('Hook failed:', error);
  }
}
```

**Integration Test**:
```typescript
it('should sanitize and persist event end-to-end', async () => {
  const event = {
    type: 'UserPromptSubmit',
    content: 'Email me at user@example.com',
    timestamp: new Date().toISOString()
  };

  await runHook(event);

  const db = new Database('.claude/context.db');
  const messages = db.prepare('SELECT content FROM messages').all();
  expect(messages[0].content).toContain('[REDACTED_EMAIL]');
  expect(messages[0].content).not.toContain('user@example.com');
  db.close();
});
```

**Acceptance**:
- [ ] End-to-end test passes
- [ ] Email is redacted before storage
- [ ] Raw email NEVER written to disk
- [ ] Hook completes in <100ms
- [ ] Database file created at `.claude/context.db`

**What NOT to do**:
- ❌ Add more PII types yet
- ❌ Build job queue
- ❌ Add correlation IDs

---

### Level 5: Add 3 More PII Types
**Duration**: 6-8 hours
**Goal**: Redact phones, IPs, and file paths

**Deliverable**:
```typescript
// src/sanitization/fast-sanitize.ts
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_REGEX = /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g;
const IP_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const PATH_REGEX = /\/Users\/[a-zA-Z0-9_-]+\/[^\s]*/g;

export interface SanitizationResult {
  sanitized: string;
  redactions: number;
}

export function fastSanitize(text: string): SanitizationResult {
  let redactions = 0;
  let result = text;

  result = result.replace(EMAIL_REGEX, () => { redactions++; return '[REDACTED_EMAIL]'; });
  result = result.replace(PHONE_REGEX, () => { redactions++; return '[REDACTED_PHONE]'; });
  result = result.replace(IP_REGEX, () => { redactions++; return '[REDACTED_IP]'; });
  result = result.replace(PATH_REGEX, () => { redactions++; return '[REDACTED_PATH]'; });

  return { sanitized: result, redactions };
}
```

**Tests** (3 per type = 12 total):
```typescript
describe('fastSanitize', () => {
  describe('emails', () => {
    it('should redact basic email', () => { /* ... */ });
    it('should redact email with subdomain', () => { /* ... */ });
    it('should not redact partial email', () => { /* ... */ });
  });

  describe('phones', () => {
    it('should redact US phone', () => { /* ... */ });
    it('should redact international phone', () => { /* ... */ });
    it('should not redact random numbers', () => { /* ... */ });
  });

  // ... similar for IPs and paths
});
```

**Acceptance**:
- [ ] 12 unit tests pass (3 per PII type)
- [ ] Performance still <50ms for typical conversation
- [ ] No false positives in tests
- [ ] Integration test still passes

**What NOT to do**:
- ❌ Add ALL 34 PII types at once
- ❌ Add AI validation
- ❌ Build audit logging yet

---

### Level 6: Correlation IDs (Multi-Message Conversations)
**Duration**: 4-6 hours
**Goal**: Track messages belonging to same conversation

**Deliverable**:
```typescript
// src/database/schema.ts
export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, sequence);
  `);
}
```

**Hook Update**:
```typescript
// Get or create conversation ID from session
const conversationId = getOrCreateConversationId(event);

db.prepare('INSERT OR IGNORE INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)')
  .run(conversationId, now, now);

const sequence = getNextSequence(db, conversationId);

db.prepare(`
  INSERT INTO messages (id, conversation_id, role, content, sequence, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(messageId, conversationId, event.role, sanitized, sequence, now);
```

**Tests**:
```typescript
it('should link messages to conversation', () => {
  const conversationId = 'conv-1';

  insertMessage(db, conversationId, 'user', 'Hello', 1);
  insertMessage(db, conversationId, 'assistant', 'Hi', 2);

  const messages = db.prepare(
    'SELECT role, sequence FROM messages WHERE conversation_id = ? ORDER BY sequence'
  ).all(conversationId);

  expect(messages).toHaveLength(2);
  expect(messages[0].role).toBe('user');
  expect(messages[1].role).toBe('assistant');
});
```

**Acceptance**:
- [ ] Conversations table created
- [ ] Messages linked via FK
- [ ] Sequence numbers auto-increment
- [ ] Can query full conversation
- [ ] Foreign key constraint enforced

**What NOT to do**:
- ❌ Build async job queue
- ❌ Add learning extraction
- ❌ Implement ULID (use simple IDs for now)

---

### Level 7: Job Queue (One Job Type)
**Duration**: 6-8 hours
**Goal**: Queue one type of job and process it

**Deliverable**:
```typescript
// src/database/job-queue.ts
export type JobStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'dead_letter';

export interface Job {
  id: string;
  type: string;
  payload: string;
  status: JobStatus;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export function createJobQueue(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_type
      ON job_queue(status, type);
  `);
}

export function enqueueJob(db: Database.Database, type: string, payload: unknown): string {
  const id = Date.now().toString();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO job_queue (id, type, payload, status, created_at, updated_at)
    VALUES (?, ?, ?, 'queued', ?, ?)
  `).run(id, type, JSON.stringify(payload), now, now);

  return id;
}

export function dequeueJob(db: Database.Database, type: string): Job | null {
  const job = db.prepare(`
    SELECT * FROM job_queue
    WHERE status = 'queued' AND type = ?
    ORDER BY created_at ASC
    LIMIT 1
  `).get(type) as Job | undefined;

  if (!job) return null;

  db.prepare(`
    UPDATE job_queue
    SET status = 'in_progress', updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), job.id);

  return job;
}
```

**Worker**:
```typescript
// src/workers/test-worker.ts
async function processTestJob(payload: { message: string }): Promise<void> {
  console.log('Processing:', payload.message);
  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function runWorker(db: Database.Database): Promise<void> {
  while (true) {
    const job = dequeueJob(db, 'test');
    if (!job) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    try {
      await processTestJob(JSON.parse(job.payload));
      completeJob(db, job.id);
    } catch (error) {
      failJob(db, job.id, error);
    }
  }
}
```

**Tests**:
```typescript
it('should enqueue and dequeue job', () => {
  const id = enqueueJob(db, 'test', { message: 'hello' });
  const job = dequeueJob(db, 'test');

  expect(job).not.toBeNull();
  expect(job!.id).toBe(id);
  expect(job!.status).toBe('in_progress');
});
```

**Acceptance**:
- [ ] Can enqueue job
- [ ] Can dequeue job
- [ ] Status changes queued → in_progress
- [ ] Worker processes job
- [ ] Job marked completed

**What NOT to do**:
- ❌ Add retry logic
- ❌ Add dead letter queue
- ❌ Handle concurrency

---

### Level 8: Simple Learning Extraction (Fixed Category)
**Duration**: 8-10 hours
**Goal**: Extract one learning from a conversation

**Deliverable**:
```typescript
// src/learning/simple-extractor.ts
export interface Learning {
  id: string;
  category: 'technical' | 'workflow' | 'insight';
  title: string;
  content: string;
  conversation_id: string;
  created_at: string;
}

export function extractSimpleLearning(
  conversation: { messages: Array<{ role: string; content: string }> }
): Learning | null {
  // Simple heuristic: Look for assistant messages with code blocks
  const hasCode = conversation.messages.some(
    msg => msg.role === 'assistant' && msg.content.includes('```')
  );

  if (!hasCode) return null;

  return {
    id: Date.now().toString(),
    category: 'technical',
    title: 'Code example shared',
    content: 'Conversation contained code examples',
    conversation_id: 'conv-1',
    created_at: new Date().toISOString()
  };
}
```

**Database**:
```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS learnings (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );
`);
```

**Tests**:
```typescript
it('should extract learning from code conversation', () => {
  const conversation = {
    messages: [
      { role: 'user', content: 'How do I sort an array?' },
      { role: 'assistant', content: 'Use ```js\narr.sort()\n```' }
    ]
  };

  const learning = extractSimpleLearning(conversation);
  expect(learning).not.toBeNull();
  expect(learning!.category).toBe('technical');
});

it('should not extract from non-code conversation', () => {
  const conversation = {
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' }
    ]
  };

  const learning = extractSimpleLearning(conversation);
  expect(learning).toBeNull();
});
```

**Acceptance**:
- [ ] Can extract learning from code conversation
- [ ] Returns null for non-valuable conversations
- [ ] Learning stored in database
- [ ] Foreign key to conversation enforced

**What NOT to do**:
- ❌ Use AI for extraction yet
- ❌ Add quality scoring
- ❌ Add deduplication
- ❌ Support all 8 categories

---

### Level 9: Basic MCP Server (One Tool)
**Duration**: 6-8 hours
**Goal**: MCP server with one tool: `get_learning`

**Deliverable**:
```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Database from 'better-sqlite3';

const db = new Database('.claude/context.db');

const server = new Server({
  name: 'context-server',
  version: '0.1.0'
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'get_learning',
    description: 'Get a learning by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  }]
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'get_learning') {
    const { id } = request.params.arguments as { id: string };

    const learning = db.prepare(
      'SELECT * FROM learnings WHERE id = ?'
    ).get(id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(learning, null, 2)
      }]
    };
  }

  throw new Error('Unknown tool');
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Test**:
```typescript
it('should return learning by id', async () => {
  // Insert test learning
  db.prepare(`
    INSERT INTO learnings (id, category, title, content, conversation_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('learn-1', 'technical', 'Test', 'Content', 'conv-1', new Date().toISOString());

  const result = await callTool('get_learning', { id: 'learn-1' });
  const learning = JSON.parse(result.content[0].text);

  expect(learning.id).toBe('learn-1');
  expect(learning.title).toBe('Test');
});
```

**Acceptance**:
- [ ] MCP server starts
- [ ] Lists one tool
- [ ] Tool returns learning
- [ ] Invalid ID returns null gracefully
- [ ] Response < 200ms

**What NOT to do**:
- ❌ Add search tool yet
- ❌ Add resources
- ❌ Add authentication

---

### Level 10: Add Search Tool
**Duration**: 4-6 hours
**Goal**: Search learnings by keyword

**Deliverable**:
```typescript
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_learning',
      description: 'Get a learning by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    },
    {
      name: 'search_learnings',
      description: 'Search learnings by keyword',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 10 }
        },
        required: ['query']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'search_learnings') {
    const { query, limit = 10 } = request.params.arguments as { query: string; limit?: number };

    const learnings = db.prepare(`
      SELECT * FROM learnings
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, limit);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(learnings, null, 2)
      }]
    };
  }
  // ... existing get_learning handler
});
```

**Tests**:
```typescript
it('should search learnings by title', async () => {
  insertLearning(db, { id: 'l1', title: 'TypeScript tips', content: 'Use strict mode' });
  insertLearning(db, { id: 'l2', title: 'React hooks', content: 'useState is great' });

  const result = await callTool('search_learnings', { query: 'TypeScript' });
  const learnings = JSON.parse(result.content[0].text);

  expect(learnings).toHaveLength(1);
  expect(learnings[0].id).toBe('l1');
});

it('should limit results', async () => {
  for (let i = 0; i < 20; i++) {
    insertLearning(db, { id: `l${i}`, title: `Learning ${i}`, content: 'test' });
  }

  const result = await callTool('search_learnings', { query: 'Learning', limit: 5 });
  const learnings = JSON.parse(result.content[0].text);

  expect(learnings).toHaveLength(5);
});
```

**Acceptance**:
- [ ] Can search by title
- [ ] Can search by content
- [ ] Limit works
- [ ] Returns empty array for no matches
- [ ] Performance < 200ms

**What NOT to do**:
- ❌ Add semantic search
- ❌ Add filters by category
- ❌ Add FTS5 index yet

---

### Level 11: Retry Logic + Dead Letter Queue
**Duration**: 6-8 hours
**Goal**: Retry failed jobs with exponential backoff

**Deliverable**:
```typescript
// src/workers/reliable-worker.ts
const MAX_ATTEMPTS = 3;

async function processWithRetry(db: Database.Database, job: Job): Promise<void> {
  try {
    await processJob(job);
    completeJob(db, job.id);
  } catch (error) {
    const attempts = job.attempts + 1;

    if (attempts >= MAX_ATTEMPTS) {
      // Move to dead letter queue
      db.prepare(`
        UPDATE job_queue
        SET status = 'dead_letter', attempts = ?, updated_at = ?
        WHERE id = ?
      `).run(attempts, new Date().toISOString(), job.id);
    } else {
      // Retry with backoff
      const backoffMs = Math.pow(2, attempts) * 1000;

      db.prepare(`
        UPDATE job_queue
        SET status = 'failed', attempts = ?, updated_at = ?
        WHERE id = ?
      `).run(attempts, new Date().toISOString(), job.id);

      await new Promise(resolve => setTimeout(resolve, backoffMs));

      // Re-queue
      db.prepare(`
        UPDATE job_queue
        SET status = 'queued', updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), job.id);
    }
  }
}
```

**Tests**:
```typescript
it('should retry failed job', async () => {
  let attempts = 0;
  const failingJob = () => {
    attempts++;
    if (attempts < 2) throw new Error('Fail');
  };

  const jobId = enqueueJob(db, 'test', {});
  const job = dequeueJob(db, 'test')!;

  await processWithRetry(db, job, failingJob);

  expect(attempts).toBe(2);
  const final = db.prepare('SELECT status FROM job_queue WHERE id = ?').get(jobId);
  expect(final.status).toBe('completed');
});

it('should move to dead letter after max attempts', async () => {
  const alwaysFails = () => { throw new Error('Always fails'); };

  const jobId = enqueueJob(db, 'test', {});

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const job = dequeueJob(db, 'test')!;
    await processWithRetry(db, job, alwaysFails);
  }

  const final = db.prepare('SELECT status, attempts FROM job_queue WHERE id = ?').get(jobId);
  expect(final.status).toBe('dead_letter');
  expect(final.attempts).toBe(MAX_ATTEMPTS);
});
```

**Acceptance**:
- [ ] Jobs retry on failure
- [ ] Exponential backoff works
- [ ] Dead letter queue after max attempts
- [ ] Tests pass

**What NOT to do**:
- ❌ Add monitoring dashboard
- ❌ Add alerting
- ❌ Add manual retry UI

---

### Level 12: AI Sanitization (Async Validation)
**Duration**: 8-10 hours
**Goal**: AI validates pre-sanitized content for missed PII

**Deliverable**:
```typescript
// src/sanitization/ai-validator.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function validateSanitization(
  sanitizedText: string
): Promise<{ isClean: boolean; issues: string[] }> {
  const prompt = `You are a PII detection validator. Check if this sanitized text still contains any PII:

Text:
${sanitizedText}

Respond with JSON:
{
  "isClean": true/false,
  "issues": ["description of any PII found"]
}`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }]
  });

  const result = JSON.parse(response.content[0].text);
  return result;
}
```

**Job Handler**:
```typescript
// src/workers/sanitization-worker.ts
async function processSanitizationJob(payload: { messageId: string }): Promise<void> {
  const message = db.prepare('SELECT content FROM messages WHERE id = ?').get(payload.messageId);

  const validation = await validateSanitization(message.content);

  if (!validation.isClean) {
    // Log to audit table
    db.prepare(`
      INSERT INTO sanitization_log (id, message_id, issues, created_at)
      VALUES (?, ?, ?, ?)
    `).run(Date.now().toString(), payload.messageId, JSON.stringify(validation.issues), new Date().toISOString());
  }
}
```

**Tests**:
```typescript
it('should detect missed PII', async () => {
  const result = await validateSanitization('My name is John Doe and I live at 123 Main St');
  expect(result.isClean).toBe(false);
  expect(result.issues.length).toBeGreaterThan(0);
});

it('should pass clean text', async () => {
  const result = await validateSanitization('The function takes two parameters and returns a string');
  expect(result.isClean).toBe(true);
});
```

**Acceptance**:
- [ ] AI validation works
- [ ] Issues logged to audit table
- [ ] Completes in <2s
- [ ] Gracefully handles API errors

**What NOT to do**:
- ❌ Re-sanitize on the fly
- ❌ Block hook on AI validation
- ❌ Add complex retry logic yet

---

### Level 13: ULID Migration + Timestamps
**Duration**: 4-6 hours
**Goal**: Replace simple IDs with ULID

**Deliverable**:
```typescript
import { ulid } from 'ulid';

// Before: const id = Date.now().toString();
// After:  const id = ulid();

// Benefits:
// - Sortable by creation time
// - Globally unique
// - Collision-resistant
```

**Migration**:
```sql
-- No data migration needed if starting fresh
-- Just update all ID generation code
```

**Tests**:
```typescript
it('should generate sortable ULIDs', () => {
  const id1 = ulid();
  const id2 = ulid();
  expect(id2 > id1).toBe(true); // Lexicographically sortable
});
```

**Acceptance**:
- [ ] All new IDs use ULID
- [ ] IDs are sortable
- [ ] No collisions in tests

**What NOT to do**:
- ❌ Migrate existing data (if any)
- ❌ Change database schema

---

### Level 14: Full Sanitization (All PII Types)
**Duration**: 10-12 hours
**Goal**: Add remaining PII patterns (API keys, SSH keys, etc.)

**Deliverable**:
```typescript
// src/sanitization/patterns.ts
export const PII_PATTERNS = {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
  IP: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  PATH: /\/Users\/[a-zA-Z0-9_-]+\/[^\s]*/g,
  API_KEY_OPENAI: /sk-[a-zA-Z0-9]{48}/g,
  API_KEY_ANTHROPIC: /sk-ant-[a-zA-Z0-9-]{95}/g,
  AWS_KEY: /AKIA[0-9A-Z]{16}/g,
  GITHUB_TOKEN: /ghp_[a-zA-Z0-9]{36}/g,
  JWT: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  SSH_KEY: /-----BEGIN (RSA|OPENSSH) PRIVATE KEY-----[\s\S]+?-----END (RSA|OPENSSH) PRIVATE KEY-----/g,
  CREDIT_CARD: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g
};

export function comprehensiveSanitize(text: string): SanitizationResult {
  let result = text;
  let redactions = 0;

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    result = result.replace(pattern, () => {
      redactions++;
      return `[REDACTED_${type}]`;
    });
  }

  return { sanitized: result, redactions };
}
```

**Tests** (3 per type = 36 tests):
```typescript
describe('comprehensiveSanitize', () => {
  // 3 tests per PII type
  // - Basic case
  // - Edge case
  // - False positive check
});
```

**Performance Test**:
```typescript
it('should sanitize in <50ms', () => {
  const text = generateTestConversation(); // ~10KB
  const start = performance.now();
  comprehensiveSanitize(text);
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(50);
});
```

**Acceptance**:
- [ ] All 12 PII types covered
- [ ] 36 tests pass (3 per type)
- [ ] Performance <50ms
- [ ] No false positives in test suite

**What NOT to do**:
- ❌ Add pseudonymization yet
- ❌ Add configuration for patterns
- ❌ Build UI for pattern management

---

### Level 15: End-to-End Integration Test
**Duration**: 6-8 hours
**Goal**: Test complete flow from hook to MCP query

**Deliverable**:
```typescript
// tests/e2e/full-flow.test.ts
describe('End-to-End Flow', () => {
  it('should capture, sanitize, extract, and query learning', async () => {
    // 1. Simulate hook event
    const event = {
      type: 'UserPromptSubmit',
      content: 'My email is user@example.com. Here is code: ```js\nconst x = 1;\n```',
      role: 'assistant',
      timestamp: new Date().toISOString()
    };

    await runHook(event);

    // 2. Verify sanitization
    const messages = db.prepare('SELECT content FROM messages ORDER BY created_at DESC LIMIT 1').all();
    expect(messages[0].content).toContain('[REDACTED_EMAIL]');
    expect(messages[0].content).not.toContain('user@example.com');

    // 3. Process learning extraction job
    const learningJob = dequeueJob(db, 'extract_learning');
    await processLearningJob(learningJob!);

    // 4. Verify learning created
    const learnings = db.prepare('SELECT * FROM learnings').all();
    expect(learnings.length).toBeGreaterThan(0);

    // 5. Query via MCP
    const searchResult = await callMcpTool('search_learnings', { query: 'code' });
    const found = JSON.parse(searchResult.content[0].text);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].category).toBe('technical');
  });

  it('should handle multiple conversations', async () => {
    // Create 3 conversations
    // Extract learnings from each
    // Verify all queryable via MCP
  });

  it('should maintain privacy throughout', async () => {
    // Inject PII-heavy event
    // Verify ZERO raw PII in database
    // Verify ZERO raw PII in logs
    // Verify ZERO raw PII in MCP responses
  });
});
```

**Acceptance**:
- [ ] Full E2E test passes
- [ ] Privacy test passes (zero PII leaks)
- [ ] Multi-conversation test passes
- [ ] All components integrated
- [ ] System works end-to-end

**What NOT to do**:
- ❌ Add IPFS upload
- ❌ Add blockchain integration
- ❌ Build UI

---

## Dependency Graph

```
Level 0: Foundation
   ↓
Level 1: SQLite
   ↓
Level 2: Hook Skeleton  ←────────┐
   ↓                              │
Level 3: Fast Sanitize (1 type)   │
   ↓                              │
Level 4: Hook + Sanitize + Write  │ (Uses Level 2 + 3 + 1)
   ↓                              │
Level 5: More PII Types           │
   ↓                              │
Level 6: Correlation IDs ─────────┘
   ↓
Level 7: Job Queue
   ↓
Level 8: Simple Learning
   ↓
Level 9: MCP Server (1 tool)
   ↓
Level 10: MCP Search
   ↓
Level 11: Retry Logic ←───── (Enhances Level 7)
   ↓
Level 12: AI Validation ←───── (Enhances Level 5)
   ↓
Level 13: ULID Migration
   ↓
Level 14: Full Sanitization
   ↓
Level 15: E2E Integration
```

**Critical Path**: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 15

**Optional Enhancements**: 11, 12, 13, 14 (can be done in parallel with critical path)

---

## Timeline Estimates

### Aggressive (Best Case): 9-11 weeks
- Assumes no blockers
- Perfect focus
- Minimal rework

### Realistic (Expected): 14-16 weeks
- Some rework on sanitization patterns
- Testing harness learning curve
- Integration debugging

### Conservative (Buffer): 18-20 weeks
- Significant rework
- Novel approaches need iteration
- Unexpected technical challenges

**Gemini Review Warning**: "7-9 week timeline is unrealistic"
**Recommendation**: Plan for 16 weeks (4 months) with 2-week sprints per level

---

## Quality Gates (Every Level)

Before moving to next level:

- [ ] All unit tests pass
- [ ] Integration test passes (if applicable)
- [ ] Lint + type-check clean
- [ ] Code reviewed (self or peer)
- [ ] Performance budget met
- [ ] Documentation updated
- [ ] Demo prepared

**Never proceed if**:
- Tests are failing
- Performance regresses
- Previous level breaks

---

## Anti-Patterns to Avoid

### 1. Building Infrastructure for Future Features
❌ BAD:
```typescript
// Building generic queue system with plugins, priority queues,
// distributed workers, monitoring, before having ONE job type working
```

✅ GOOD:
```typescript
// Simple queue with one job type
// Add complexity AFTER basics work
```

### 2. Premature Optimization
❌ BAD:
```typescript
// Level 3: Add caching, connection pooling, query optimization
```

✅ GOOD:
```typescript
// Level 3: Get one sanitization pattern working
// Optimize in Level 14 when you know what's slow
```

### 3. Multi-Level Changes
❌ BAD:
```typescript
// Level 4: Add sanitization + job queue + learning extraction + MCP
```

✅ GOOD:
```typescript
// Level 4: Hook + sanitize + write
// Level 7: Job queue
// Level 8: Learning extraction
// Level 9: MCP
```

### 4. Skipping Tests
❌ BAD:
```typescript
// "I'll add tests later after I build more features"
```

✅ GOOD:
```typescript
// Write test FIRST (TDD)
// Test passes before moving to next level
```

### 5. Breaking Working Code
❌ BAD:
```typescript
// Level 10: Refactor entire sanitization system
// (Breaks Levels 4-9)
```

✅ GOOD:
```typescript
// Level 10: Add new feature without breaking existing
// Refactor incrementally with tests proving nothing broke
```

---

## Examples: Good vs Bad Iterations

### Example 1: Learning Extraction

❌ **BAD Level**: "Build complete learning extraction system"
- Too vague
- Too large (weeks of work)
- No clear acceptance criteria
- Can't test until complete

✅ **GOOD Levels**:
- Level 8: "Extract learning if conversation has code block" (8 hours)
  - Clear heuristic
  - One test case
  - Demonstrable

- Level 8.1: "Add category detection for code vs workflow" (4 hours)
  - Builds on Level 8
  - Two test cases
  - Easy to verify

- Level 8.2: "Add AI extraction for non-code learnings" (8 hours)
  - Builds on 8.1
  - Separate job type
  - Fallback to heuristic

### Example 2: MCP Server

❌ **BAD Level**: "Build MCP server with all tools and resources"
- 5+ tools at once
- Can't test until all work
- High risk of rework

✅ **GOOD Levels**:
- Level 9: "MCP server with get_learning tool" (6 hours)
  - One tool works
  - Can test with MCP Inspector
  - Demonstrable

- Level 10: "Add search_learnings tool" (4 hours)
  - Builds on existing server
  - Independent feature
  - Easy to test

- Level 10.1: "Add resources for recent learnings" (3 hours)
  - Separate MCP concept
  - Doesn't break tools
  - Progressive enhancement

### Example 3: Sanitization

❌ **BAD Level**: "Build sanitization pipeline with all PII types and AI validation"
- 12 PII types at once
- AI integration coupled
- Overwhelming test matrix

✅ **GOOD Levels**:
- Level 3: "Sanitize emails only" (4 hours)
  - 3 test cases
  - Performance measured
  - Working end-to-end

- Level 5: "Add phone, IP, path patterns" (6 hours)
  - 3 types × 3 tests = 9 tests
  - Still fast
  - Incremental value

- Level 14: "Add remaining 8 PII types" (10 hours)
  - After basics proven
  - Know performance characteristics
  - Test infrastructure exists

---

## Testing Strategy Per Level

### Level 0-6: Unit + Integration
```typescript
// Unit: Test individual functions
it('should sanitize email', () => { /* ... */ });

// Integration: Test component interaction
it('should write sanitized message to DB', () => { /* ... */ });
```

### Level 7-12: Unit + Integration + Worker
```typescript
// Worker: Test async processing
it('should process queued job', async () => { /* ... */ });
```

### Level 15: E2E
```typescript
// End-to-end: Test full system flow
it('should capture, sanitize, extract, and query', async () => { /* ... */ });
```

**Coverage Requirements**:
- Level 0-6: ≥85% line coverage per level
- Level 7-14: ≥90% line coverage (critical path)
- Level 15: 100% E2E flow coverage

---

## When to Add Complexity

### Decision Tree

```
Is basic feature working?
  No → Focus on basic feature
  Yes ↓

Do all tests pass?
  No → Fix tests first
  Yes ↓

Is performance acceptable?
  No → Profile and optimize
  Yes ↓

Is there demonstrable value in enhancement?
  No → Skip, move to next level
  Yes ↓

Can enhancement be done without breaking existing?
  No → Defer to later level
  Yes ↓

Add complexity ✅
```

### Example: When to add AI sanitization?

❌ Too early:
- Level 3: Basics not working yet
- Level 4: Integration not proven
- Level 5: Pattern coverage incomplete

✅ Right time:
- Level 12: After rule-based works
- After performance budget proven
- After job queue working
- As async enhancement, not blocker

---

## Success Metrics Per Level

### Level 0: Foundation
- ✅ `npm test` runs
- ✅ TypeScript compiles
- ✅ One test passes

### Level 4: First E2E
- ✅ Hook completes <100ms
- ✅ Email redacted before disk
- ✅ Integration test passes

### Level 8: First Learning
- ✅ Learning extracted
- ✅ Stored in database
- ✅ Can query by ID

### Level 10: First Search
- ✅ Search returns results
- ✅ Query <200ms
- ✅ Limit works

### Level 15: Complete MVP
- ✅ Full E2E test passes
- ✅ Zero PII leaks verified
- ✅ All performance budgets met
- ✅ System demonstrable

---

## Vertical Slice Philosophy

### NOT: Horizontal Layers
```
Week 1-3: Build entire database layer
Week 4-6: Build entire API layer
Week 7-9: Build entire UI layer
```
**Problem**: Nothing works until week 9

### YES: Vertical Slices
```
Week 1: One feature end-to-end (hook → DB)
Week 2: Add one sanitization type
Week 3: Add one learning type
Week 4: Add one MCP tool
```
**Benefit**: Working demo every week

### Visualization

```
❌ Horizontal:
┌─────────────────┐
│   UI Layer      │ ← Week 9
├─────────────────┤
│   API Layer     │ ← Week 6
├─────────────────┤
│   DB Layer      │ ← Week 3
└─────────────────┘
(Nothing works until week 9)

✅ Vertical:
┌──┬──┬──┬──┬──┐
│E │S │L │M │F │
│2 │a │e │C │u │
│E │n │a │P │l │
│  │i │r │  │l │
│H │t │n │S │S │
│o │i │i │e │y │
│o │z │n │a │s │
│k │e │g │r │t │
│  │  │  │c │e │
│  │  │  │h │m │
└──┴──┴──┴──┴──┘
W1  W2  W3  W4  W5
(Working system every week)
```

---

## Related Documents

- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md) - 7-phase plan
- [STANDARDS](../STANDARDS.md) - Canonical standards
- [GPT-5 Review](../reviews/gpt5-holistic-review-2025-01-16.txt) - Critical issues
- [Gemini Review](../reviews/gemini-holistic-review-2025-01-16.txt) - Timeline reality check

---

## Summary

**15 levels, each level is:**
1. **Buildable** - Working code that compiles and runs
2. **Testable** - Has passing tests proving it works
3. **Demonstrable** - Can show value to stakeholders
4. **Independent** - Doesn't require future levels to work
5. **Incremental** - Adds one clear capability

**Timeline**: 14-16 weeks (realistic) vs 7-9 weeks (original, unrealistic)

**Philosophy**: Always have working code. Build complexity through proven layers. Test first, optimize later.

**Critical Path**: 0→1→2→3→4→5→6→7→8→9→10→15 (11 levels minimum for basic MVP)

**Next Steps**:
1. Start Level 0 immediately
2. Complete each level fully before proceeding
3. Never break what works
4. Demonstrate progress weekly
