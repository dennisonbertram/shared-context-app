# Database Schema Reference

> Complete SQLite database schema with tables, indexes, migrations, and query patterns

---
title: Database Schema Reference
category: reference
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [database, sqlite, schema, migrations, sql]
applies_to: SQLite 3.40+, better-sqlite3 9.x
schema_version: 1.0.0
---

## Overview

The Global Context Network uses SQLite with WAL mode for local persistence. All data MUST be sanitized before insertion - there are NO raw content columns.

**Core Principle**: Never store unsanitized data. Sanitization happens BEFORE database insertion.

### Database Configuration

```sql
-- Required PRAGMAs (set on every connection)
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;
PRAGMA page_size = 8192;
```

### Connection Setup

```typescript
import Database from 'better-sqlite3';

export function createDatabase(path: string): Database.Database {
  const db = new Database(path);

  // Enable required PRAGMAs
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('busy_timeout = 5000');

  return db;
}
```

---

## Tables

### conversations

Stores sanitized conversation metadata.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, -- ULID or UUID
  session_id TEXT NOT NULL, -- Claude Code session identifier
  correlation_id TEXT NOT NULL UNIQUE, -- For tracking conversation flow
  created_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  completed_at TEXT, -- When conversation ended
  sanitized BOOLEAN NOT NULL DEFAULT 1 CHECK (sanitized = 1), -- ALWAYS true
  sanitization_version TEXT NOT NULL, -- e.g., "1.0.0"
  message_count INTEGER NOT NULL DEFAULT 0,
  metadata JSON -- Additional context (project path, user settings, etc.)
);

-- Indexes
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX idx_conversations_correlation ON conversations(correlation_id);

-- Triggers for updated_at
CREATE TRIGGER conversations_updated_at
AFTER UPDATE ON conversations
FOR EACH ROW
BEGIN
  UPDATE conversations SET updated_at = datetime('now') WHERE id = NEW.id;
END;
```

**Column Descriptions**:
- `id`: Unique conversation identifier (ULID recommended for sortability)
- `session_id`: Claude Code session ID for grouping
- `correlation_id`: Unique ID for tracking across systems
- `created_at`: When conversation started (auto-set)
- `updated_at`: Last modification (auto-updated via trigger)
- `completed_at`: When conversation ended (NULL if ongoing)
- `sanitized`: MUST always be 1 (enforced by CHECK constraint)
- `sanitization_version`: Version of sanitization rules applied
- `message_count`: Cached count (updated via trigger)
- `metadata`: JSON for flexible additional data

**Performance Considerations**:
- `session_id` index for session queries
- `created_at DESC` index for recent conversations
- `correlation_id` unique index for lookups

---

### messages

Stores individual sanitized messages within conversations.

```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, -- ULID or UUID
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL, -- SANITIZED content only
  content_hash TEXT NOT NULL, -- SHA-256 hash for deduplication
  sequence INTEGER NOT NULL, -- Order within conversation (0, 1, 2, ...)
  created_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  token_count INTEGER, -- Approximate token count
  metadata JSON, -- Thinking, tool calls, etc.

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  UNIQUE (conversation_id, sequence)
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sequence);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_hash ON messages(content_hash);

-- Trigger to update conversation.message_count
CREATE TRIGGER messages_after_insert
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
  UPDATE conversations
  SET message_count = message_count + 1
  WHERE id = NEW.conversation_id;
END;

CREATE TRIGGER messages_after_delete
AFTER DELETE ON messages
FOR EACH ROW
BEGIN
  UPDATE conversations
  SET message_count = message_count - 1
  WHERE id = OLD.conversation_id;
END;
```

**Column Descriptions**:
- `id`: Unique message identifier
- `conversation_id`: Parent conversation (CASCADE delete)
- `role`: Message sender (user/assistant/system)
- `content`: SANITIZED message content (NO PII)
- `content_hash`: For detecting duplicate messages
- `sequence`: Order within conversation (0-indexed)
- `created_at`: When message was created
- `token_count`: Approximate tokens (for cost tracking)
- `metadata`: JSON for thinking, tool calls, attachments

**CRITICAL**: This table has NO `raw_content` or `unsanitized_content` column. Sanitization MUST happen before insertion.

---

### learnings

Stores extracted learnings with full-text search.

```sql
CREATE TABLE IF NOT EXISTS learnings (
  id TEXT PRIMARY KEY, -- ULID or UUID
  conversation_id TEXT NOT NULL,
  source_message_ids JSON NOT NULL, -- Array of message IDs that produced this learning
  category TEXT NOT NULL CHECK (
    category IN (
      'pattern',
      'best_practice',
      'anti_pattern',
      'bug_fix',
      'optimization',
      'tool_usage',
      'workflow',
      'decision'
    )
  ),
  title TEXT NOT NULL, -- Short summary
  content TEXT NOT NULL, -- Detailed learning (SANITIZED)
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  tags JSON NOT NULL DEFAULT '[]', -- Array of strings
  dedupe_hash TEXT NOT NULL UNIQUE, -- For preventing duplicates
  created_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  metadata JSON, -- Additional context

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_learnings_conversation ON learnings(conversation_id);
CREATE INDEX idx_learnings_category ON learnings(category, confidence DESC);
CREATE INDEX idx_learnings_confidence ON learnings(confidence DESC);
CREATE INDEX idx_learnings_created ON learnings(created_at DESC);
CREATE INDEX idx_learnings_dedupe ON learnings(dedupe_hash);

-- Full-text search (FTS5)
CREATE VIRTUAL TABLE learnings_fts USING fts5(
  learning_id UNINDEXED,
  title,
  content,
  tags,
  content='learnings',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER learnings_fts_insert
AFTER INSERT ON learnings
BEGIN
  INSERT INTO learnings_fts(rowid, learning_id, title, content, tags)
  VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content, NEW.tags);
END;

CREATE TRIGGER learnings_fts_delete
AFTER DELETE ON learnings
BEGIN
  DELETE FROM learnings_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER learnings_fts_update
AFTER UPDATE ON learnings
BEGIN
  DELETE FROM learnings_fts WHERE rowid = OLD.rowid;
  INSERT INTO learnings_fts(rowid, learning_id, title, content, tags)
  VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content, NEW.tags);
END;
```

**Column Descriptions**:
- `id`: Unique learning identifier
- `conversation_id`: Source conversation
- `source_message_ids`: JSON array of message IDs
- `category`: Type of learning (CHECK constraint enforced)
- `title`: Short summary (used in lists)
- `content`: Detailed learning text
- `confidence`: Quality score 0.0-1.0
- `tags`: JSON array of topic tags
- `dedupe_hash`: Prevents duplicate learnings
- `created_at`: When learning was extracted
- `metadata`: Additional context

**FTS5 Full-Text Search**:
- Searches across `title`, `content`, and `tags`
- BM25 ranking
- Supports phrase queries, AND/OR, NEAR

---

### job_queue

Persistent queue for async job processing.

```sql
CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY, -- ULID (sortable)
  type TEXT NOT NULL, -- 'sanitize', 'extract_learning', 'upload'
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed', 'quarantined')
  ),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1=highest
  run_at TEXT NOT NULL DEFAULT (datetime('now')), -- When to run (for delayed jobs)
  locked_at TEXT, -- When job was claimed by worker
  locked_by TEXT, -- Worker ID that claimed job
  payload JSON NOT NULL, -- Job-specific data
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT, -- Error message from last failure
  created_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  completed_at TEXT -- When job finished (success or quarantine)
);

-- Indexes for worker queries
CREATE INDEX idx_job_queue_dequeue ON job_queue(status, priority, run_at)
  WHERE status = 'queued';
CREATE INDEX idx_job_queue_type ON job_queue(type, status);
CREATE INDEX idx_job_queue_created ON job_queue(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER job_queue_updated_at
AFTER UPDATE ON job_queue
FOR EACH ROW
BEGIN
  UPDATE job_queue SET updated_at = datetime('now') WHERE id = NEW.id;
END;
```

**Column Descriptions**:
- `id`: ULID for time-sortable IDs
- `type`: Job type for worker routing
- `status`: Current state (queued/running/succeeded/failed/quarantined)
- `priority`: 1-10, where 1 is highest priority
- `run_at`: Delayed job support (run after this time)
- `locked_at`: Optimistic locking timestamp
- `locked_by`: Worker identifier (hostname + PID)
- `payload`: JSON with job-specific parameters
- `attempts`: Retry counter
- `max_retries`: Max attempts before quarantine
- `last_error`: Last failure reason
- `completed_at`: When job finished

**Worker Query Pattern** (Optimistic Locking):
```sql
UPDATE job_queue
SET
  status = 'running',
  locked_at = datetime('now'),
  locked_by = :worker_id,
  attempts = attempts + 1
WHERE id = (
  SELECT id
  FROM job_queue
  WHERE status = 'queued'
    AND run_at <= datetime('now')
  ORDER BY priority ASC, run_at ASC
  LIMIT 1
)
RETURNING *;
```

---

### uploads

Tracks uploads to global network (IPFS + blockchain).

```sql
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY, -- ULID or UUID
  learning_id TEXT NOT NULL UNIQUE,
  ipfs_cid TEXT UNIQUE, -- Content Identifier from IPFS
  chain_tx_hash TEXT UNIQUE, -- Blockchain transaction hash
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'ipfs_uploaded', 'tx_submitted', 'confirmed', 'failed')
  ),
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  last_error TEXT, -- Error from last attempt
  tokens_earned REAL, -- Reward amount (if confirmed)
  created_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  uploaded_at TEXT, -- When IPFS upload succeeded
  confirmed_at TEXT, -- When blockchain tx confirmed

  FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_uploads_learning ON uploads(learning_id);
CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_uploads_created ON uploads(created_at DESC);
CREATE UNIQUE INDEX idx_uploads_ipfs_cid ON uploads(ipfs_cid) WHERE ipfs_cid IS NOT NULL;
CREATE UNIQUE INDEX idx_uploads_tx_hash ON uploads(chain_tx_hash) WHERE chain_tx_hash IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER uploads_updated_at
AFTER UPDATE ON uploads
FOR EACH ROW
BEGIN
  UPDATE uploads SET updated_at = datetime('now') WHERE id = NEW.id;
END;
```

**Column Descriptions**:
- `id`: Unique upload identifier
- `learning_id`: Source learning (UNIQUE - one upload per learning)
- `ipfs_cid`: Content identifier from IPFS
- `chain_tx_hash`: Blockchain transaction hash
- `status`: Upload lifecycle state
- `retries`: Attempt counter
- `max_retries`: Max attempts before giving up
- `last_error`: Last failure reason
- `tokens_earned`: Reward if confirmed
- `uploaded_at`: IPFS upload timestamp
- `confirmed_at`: Blockchain confirmation timestamp

**Upload States**:
1. `pending` → Initial state
2. `ipfs_uploaded` → Content in IPFS, have CID
3. `tx_submitted` → Blockchain tx sent
4. `confirmed` → Tx confirmed, tokens earned
5. `failed` → Max retries exceeded

---

### sanitization_log

Audit trail of all PII detections and redactions.

```sql
CREATE TABLE IF NOT EXISTS sanitization_log (
  id TEXT PRIMARY KEY, -- ULID for time ordering
  conversation_id TEXT NOT NULL,
  message_id TEXT, -- NULL if conversation-level sanitization
  category TEXT NOT NULL, -- PII type (api_key, email, file_path, etc.)
  rule_id TEXT, -- Which rule detected it (for rule-based)
  original_snippet_hash TEXT NOT NULL, -- SHA-256 of original text
  replacement TEXT NOT NULL, -- What it was replaced with
  detector TEXT NOT NULL CHECK (detector IN ('rule', 'ai', 'hybrid')),
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601
  metadata JSON, -- Additional context

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_sanitization_log_conversation ON sanitization_log(conversation_id);
CREATE INDEX idx_sanitization_log_message ON sanitization_log(message_id);
CREATE INDEX idx_sanitization_log_category ON sanitization_log(category);
CREATE INDEX idx_sanitization_log_created ON sanitization_log(created_at DESC);
```

**Column Descriptions**:
- `id`: ULID for time-ordered audit trail
- `conversation_id`: Parent conversation
- `message_id`: Specific message (NULL for conversation-wide)
- `category`: Type of PII detected
- `rule_id`: Identifier of detection rule
- `original_snippet_hash`: Hash of PII (NEVER store actual PII)
- `replacement`: Replacement text used
- `detector`: Which system detected it
- `confidence`: Detection confidence score
- `created_at`: When detection occurred
- `metadata`: Additional context (position, surrounding text hash)

**CRITICAL**: NEVER store actual PII in this table. Use `original_snippet_hash` only.

---

## Migrations

### Migration System

```typescript
// src/database/migrations/runner.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

// Migrations table
function createMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Get current version
function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null };
  return row.version ?? 0;
}

// Load migration files
function loadMigrations(dir: string): Migration[] {
  const files = fs.readdirSync(dir).sort();
  const migrations: Migration[] = [];

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;

    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    const name = match[2];
    const content = fs.readFileSync(path.join(dir, file), 'utf8');

    // Split on -- UP / -- DOWN markers
    const [up, down] = content.split(/--\s*DOWN/i);
    const upSql = up.replace(/--\s*UP/i, '').trim();
    const downSql = down?.trim() || '';

    migrations.push({ version, name, up: upSql, down: downSql });
  }

  return migrations;
}

// Run migrations
export function runMigrations(db: Database.Database, targetVersion?: number): void {
  createMigrationsTable(db);

  const currentVersion = getCurrentVersion(db);
  const migrations = loadMigrations(path.join(__dirname, 'sql'));

  const toApply = migrations.filter(m =>
    m.version > currentVersion && (!targetVersion || m.version <= targetVersion)
  );

  if (toApply.length === 0) {
    console.log('No migrations to apply');
    return;
  }

  for (const migration of toApply) {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);

    const applyMigration = db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
    });

    applyMigration();
  }

  console.log(`Migrated to version ${toApply[toApply.length - 1].version}`);
}

// Rollback migrations
export function rollbackMigrations(db: Database.Database, targetVersion: number): void {
  const currentVersion = getCurrentVersion(db);
  const migrations = loadMigrations(path.join(__dirname, 'sql'));

  const toRollback = migrations
    .filter(m => m.version > targetVersion && m.version <= currentVersion)
    .reverse();

  if (toRollback.length === 0) {
    console.log('No migrations to rollback');
    return;
  }

  for (const migration of toRollback) {
    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);

    const rollback = db.transaction(() => {
      db.exec(migration.down);
      db.prepare('DELETE FROM _migrations WHERE version = ?').run(migration.version);
    });

    rollback();
  }

  console.log(`Rolled back to version ${targetVersion}`);
}
```

### Example Migration File

```sql
-- migrations/001_initial.sql

-- UP
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  sanitized BOOLEAN NOT NULL DEFAULT 1 CHECK (sanitized = 1),
  sanitization_version TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  metadata JSON
);

CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);

CREATE TRIGGER conversations_updated_at
AFTER UPDATE ON conversations
FOR EACH ROW
BEGIN
  UPDATE conversations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- DOWN
DROP TRIGGER IF EXISTS conversations_updated_at;
DROP INDEX IF EXISTS idx_conversations_created;
DROP INDEX IF EXISTS idx_conversations_session;
DROP TABLE IF EXISTS conversations;
```

---

## Query Patterns

### Repository Base Class

```typescript
// src/database/repositories/base-repository.ts
import Database from 'better-sqlite3';

export abstract class BaseRepository<T> {
  constructor(protected db: Database.Database) {}

  protected transaction<R>(fn: () => R): R {
    const trans = this.db.transaction(fn);
    return trans();
  }

  protected prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  abstract create(data: Partial<T>): T;
  abstract findById(id: string): T | null;
  abstract update(id: string, data: Partial<T>): T;
  abstract delete(id: string): void;
}
```

### Conversation Repository

```typescript
// src/database/repositories/conversation-repository.ts
import { BaseRepository } from './base-repository';
import { ulid } from 'ulid';

export interface Conversation {
  id: string;
  session_id: string;
  correlation_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  sanitized: boolean;
  sanitization_version: string;
  message_count: number;
  metadata: any;
}

export class ConversationRepository extends BaseRepository<Conversation> {
  create(data: Partial<Conversation>): Conversation {
    const id = data.id || ulid();
    const correlation_id = data.correlation_id || ulid();
    const sanitization_version = data.sanitization_version || '1.0.0';

    this.prepare(`
      INSERT INTO conversations (id, session_id, correlation_id, sanitization_version, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      data.session_id,
      correlation_id,
      sanitization_version,
      JSON.stringify(data.metadata || {})
    );

    return this.findById(id)!;
  }

  findById(id: string): Conversation | null {
    const row = this.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    return row ? this.deserialize(row as any) : null;
  }

  findByCorrelationId(correlationId: string): Conversation | null {
    const row = this.prepare('SELECT * FROM conversations WHERE correlation_id = ?').get(correlationId);
    return row ? this.deserialize(row as any) : null;
  }

  findBySession(sessionId: string, limit = 10): Conversation[] {
    const rows = this.prepare(`
      SELECT * FROM conversations
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(sessionId, limit);

    return rows.map(r => this.deserialize(r as any));
  }

  update(id: string, data: Partial<Conversation>): Conversation {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.completed_at !== undefined) {
      updates.push('completed_at = ?');
      values.push(data.completed_at);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) {
      return this.findById(id)!;
    }

    values.push(id);

    this.prepare(`
      UPDATE conversations
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  private deserialize(row: any): Conversation {
    return {
      ...row,
      sanitized: Boolean(row.sanitized),
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }
}
```

### Learning Repository with FTS

```typescript
// src/database/repositories/learning-repository.ts
import { BaseRepository } from './base-repository';
import { ulid } from 'ulid';
import crypto from 'crypto';

export interface Learning {
  id: string;
  conversation_id: string;
  source_message_ids: string[];
  category: string;
  title: string;
  content: string;
  confidence: number;
  tags: string[];
  dedupe_hash: string;
  created_at: string;
  metadata: any;
}

export class LearningRepository extends BaseRepository<Learning> {
  create(data: Partial<Learning>): Learning {
    const id = data.id || ulid();
    const dedupe_hash = this.generateDedupeHash(data.content!, data.category!);

    this.prepare(`
      INSERT INTO learnings (
        id, conversation_id, source_message_ids, category, title,
        content, confidence, tags, dedupe_hash, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.conversation_id,
      JSON.stringify(data.source_message_ids || []),
      data.category,
      data.title,
      data.content,
      data.confidence,
      JSON.stringify(data.tags || []),
      dedupe_hash,
      JSON.stringify(data.metadata || {})
    );

    return this.findById(id)!;
  }

  findById(id: string): Learning | null {
    const row = this.prepare('SELECT * FROM learnings WHERE id = ?').get(id);
    return row ? this.deserialize(row as any) : null;
  }

  search(query: string, options: {
    category?: string;
    minConfidence?: number;
    limit?: number;
  } = {}): Learning[] {
    const limit = options.limit || 10;
    const minConfidence = options.minConfidence || 0.0;

    let sql = `
      SELECT l.*
      FROM learnings l
      JOIN learnings_fts fts ON l.rowid = fts.rowid
      WHERE fts MATCH ?
        AND l.confidence >= ?
    `;

    const params: any[] = [query, minConfidence];

    if (options.category) {
      sql += ' AND l.category = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY bm25(fts), l.confidence DESC LIMIT ?';
    params.push(limit);

    const rows = this.prepare(sql).all(...params);
    return rows.map(r => this.deserialize(r as any));
  }

  findByCategory(category: string, limit = 10): Learning[] {
    const rows = this.prepare(`
      SELECT * FROM learnings
      WHERE category = ?
      ORDER BY confidence DESC, created_at DESC
      LIMIT ?
    `).all(category, limit);

    return rows.map(r => this.deserialize(r as any));
  }

  findRecent(limit = 10): Learning[] {
    const rows = this.prepare(`
      SELECT * FROM learnings
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    return rows.map(r => this.deserialize(r as any));
  }

  findTopRated(limit = 10): Learning[] {
    const rows = this.prepare(`
      SELECT * FROM learnings
      ORDER BY confidence DESC, created_at DESC
      LIMIT ?
    `).all(limit);

    return rows.map(r => this.deserialize(r as any));
  }

  update(id: string, data: Partial<Learning>): Learning {
    // Learnings are generally immutable, but allow confidence updates
    if (data.confidence !== undefined) {
      this.prepare('UPDATE learnings SET confidence = ? WHERE id = ?').run(data.confidence, id);
    }
    return this.findById(id)!;
  }

  delete(id: string): void {
    this.prepare('DELETE FROM learnings WHERE id = ?').run(id);
  }

  private generateDedupeHash(content: string, category: string): string {
    return crypto.createHash('sha256').update(`${category}:${content}`).digest('hex');
  }

  private deserialize(row: any): Learning {
    return {
      ...row,
      source_message_ids: JSON.parse(row.source_message_ids),
      tags: JSON.parse(row.tags),
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }
}
```

### Job Queue Repository

```typescript
// src/database/repositories/job-queue-repository.ts
import { BaseRepository } from './base-repository';
import { ulid } from 'ulid';
import os from 'os';

export interface Job {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'quarantined';
  priority: number;
  run_at: string;
  locked_at: string | null;
  locked_by: string | null;
  payload: any;
  attempts: number;
  max_retries: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export class JobQueueRepository extends BaseRepository<Job> {
  private workerId = `${os.hostname()}-${process.pid}`;

  create(data: Partial<Job>): Job {
    const id = data.id || ulid();
    const priority = data.priority || 5;
    const max_retries = data.max_retries || 3;
    const run_at = data.run_at || new Date().toISOString();

    this.prepare(`
      INSERT INTO job_queue (id, type, priority, run_at, payload, max_retries)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.type,
      priority,
      run_at,
      JSON.stringify(data.payload || {}),
      max_retries
    );

    return this.findById(id)!;
  }

  // Optimistic locking: claim next job
  dequeue(): Job | null {
    const updated = this.prepare(`
      UPDATE job_queue
      SET
        status = 'running',
        locked_at = datetime('now'),
        locked_by = ?,
        attempts = attempts + 1
      WHERE id = (
        SELECT id
        FROM job_queue
        WHERE status = 'queued'
          AND run_at <= datetime('now')
        ORDER BY priority ASC, run_at ASC
        LIMIT 1
      )
      RETURNING *
    `).get(this.workerId);

    return updated ? this.deserialize(updated as any) : null;
  }

  markSucceeded(id: string): void {
    this.prepare(`
      UPDATE job_queue
      SET status = 'succeeded', completed_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  markFailed(id: string, error: string): void {
    const job = this.findById(id);
    if (!job) return;

    if (job.attempts >= job.max_retries) {
      // Quarantine
      this.prepare(`
        UPDATE job_queue
        SET status = 'quarantined', last_error = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(error, id);
    } else {
      // Requeue with backoff
      const backoffMs = Math.pow(2, job.attempts) * 1000;
      const runAt = new Date(Date.now() + backoffMs).toISOString();

      this.prepare(`
        UPDATE job_queue
        SET status = 'queued', last_error = ?, run_at = ?, locked_at = NULL, locked_by = NULL
        WHERE id = ?
      `).run(error, runAt, id);
    }
  }

  findById(id: string): Job | null {
    const row = this.prepare('SELECT * FROM job_queue WHERE id = ?').get(id);
    return row ? this.deserialize(row as any) : null;
  }

  // Clean up stale locks (workers that crashed)
  releaseStaleJobs(timeout_ms = 300000): number {
    const staleTime = new Date(Date.now() - timeout_ms).toISOString();

    const result = this.prepare(`
      UPDATE job_queue
      SET status = 'queued', locked_at = NULL, locked_by = NULL
      WHERE status = 'running'
        AND locked_at < ?
    `).run(staleTime);

    return result.changes;
  }

  update(id: string, data: Partial<Job>): Job {
    throw new Error('Use specific methods (markSucceeded, markFailed)');
  }

  delete(id: string): void {
    this.prepare('DELETE FROM job_queue WHERE id = ?').run(id);
  }

  private deserialize(row: any): Job {
    return {
      ...row,
      payload: JSON.parse(row.payload)
    };
  }
}
```

---

## Performance Optimization

### Query Performance Tips

1. **Always use indexes for foreign keys**
2. **Add covering indexes for frequent queries**
3. **Use EXPLAIN QUERY PLAN to verify index usage**
4. **Keep transactions short**
5. **Use prepared statements (auto-cached)**

### EXPLAIN Example

```sql
EXPLAIN QUERY PLAN
SELECT l.*
FROM learnings l
JOIN learnings_fts fts ON l.rowid = fts.rowid
WHERE fts MATCH 'typescript testing'
  AND l.category = 'pattern'
ORDER BY bm25(fts), l.confidence DESC
LIMIT 10;

-- Should use:
-- - FTS index for MATCH
-- - idx_learnings_category for category filter
```

### Maintenance

```typescript
// Run periodically
export function optimizeDatabase(db: Database.Database): void {
  // Rebuild FTS index
  db.exec('INSERT INTO learnings_fts(learnings_fts) VALUES("rebuild")');

  // Update statistics
  db.exec('ANALYZE');

  // Vacuum (compact database)
  db.exec('VACUUM');
}
```

---

## Backup & Restore

### Backup

```typescript
import Database from 'better-sqlite3';

export async function backupDatabase(sourceDb: Database.Database, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const backup = sourceDb.backup(destPath);

    const doBackup = () => {
      const remaining = backup.step(100); // Pages per step
      if (remaining === 0) {
        backup.close();
        resolve();
      } else {
        setImmediate(doBackup);
      }
    };

    try {
      doBackup();
    } catch (error) {
      backup.close();
      reject(error);
    }
  });
}
```

### Restore

```typescript
export async function restoreDatabase(sourceDb: Database.Database, destPath: string): Promise<void> {
  const destDb = new Database(destPath);

  try {
    await backupDatabase(sourceDb, destPath);
    console.log(`Restored to ${destPath}`);
  } finally {
    destDb.close();
  }
}
```

### Verification

```typescript
export function verifyDatabase(db: Database.Database): boolean {
  const result = db.pragma('integrity_check', { simple: true });
  return result === 'ok';
}
```

---

## Related Documents

### Architecture
- [Global Context Network](../architecture/architecture-global-context-network-2025-01-16.md)
- [Database Schema Architecture](../architecture/architecture-database-schema-2025-01-16.md)

### Reference
- [Testing Strategy](./reference-testing-strategy-2025-01-16.md)
- [Subagent Types](./reference-subagent-types-2025-01-16.md)

### Guides
- [Database Setup Guide](../guides/guide-database-setup-2025-01-16.md)
