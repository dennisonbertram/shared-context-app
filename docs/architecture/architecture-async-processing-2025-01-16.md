---
title: Async Processing Architecture
category: architecture
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [async, job-queue, workers, reliability, performance]
references:
  - docs/STANDARDS.md
  - docs/decisions/decision-async-processing-model-2025-01-16.md
  - docs/reference/reference-database-schema-2025-01-16.md
schema_version: "1.0.0"
---

# Async Processing Architecture

> Complete async processing system with SQLite-based job queue, worker model, and reliability guarantees

---

## Overview

The Global Context Network requires async processing to maintain responsive user experience while handling slow operations. This document defines the complete async architecture, aligned with canonical standards from STANDARDS.md and ADR-006.

**Core Principle**: Never block the user. All slow operations (sanitization, learning extraction, uploads) run asynchronously.

### Key Requirements

1. **Never block user** - Claude Code hooks complete < 100ms p95
2. **Persist across restarts** - Jobs survive crashes/shutdowns
3. **At-least-once delivery** - Jobs execute at least once (with idempotency)
4. **Ordered processing** - Respect job dependencies
5. **Retry with backoff** - Handle transient failures gracefully
6. **Offline tolerance** - Queue locally, sync when online
7. **Observable** - Monitor queue depth, latency, errors
8. **Graceful shutdown** - Complete in-flight jobs before exit

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interaction                        │
│               (Claude Code < 100ms hook budget)                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │  Hook (< 100ms) │
            │  ┌───────────┐  │
            │  │ Sanitize  │  │ ← Fast pre-sanitization (<50ms)
            │  │  (Fast)   │  │   Rule-based, regex patterns
            │  └─────┬─────┘  │
            │        │        │
            │        ▼        │
            │  ┌───────────┐  │
            │  │  Persist  │  │ ← Write sanitized to messages table
            │  │ Sanitized │  │   SQLite WAL mode (<20ms)
            │  └─────┬─────┘  │
            │        │        │
            │        ▼        │
            │  ┌───────────┐  │
            │  │  Enqueue  │  │ ← Atomic job enqueue (same txn)
            │  │   Jobs    │  │   job_queue table
            │  └─────┬─────┘  │
            └────────┼────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  SQLite job_queue     │ ← Persistent queue (CANONICAL schema)
         │   (WAL journaling)    │   Survives crashes
         │  ULID IDs, ISO-8601   │   Status: queued → in_progress → completed/failed/dead_letter
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
   ┌──────────┐          ┌──────────┐
   │  Worker  │          │  Worker  │ ← Independent processes
   │ Process  │          │ Process  │   Poll queue
   │   #1     │          │   #N     │   Lease-based execution
   └────┬─────┘          └────┬─────┘
        │                     │
        ▼                     ▼
    ┌───────────────────────────┐
    │    Job Handlers           │
    │  ┌─────────────────────┐  │
    │  │ sanitize_ai_validation│ ← AI-based PII validation
    │  └─────────────────────┘  │   Claude API, <2s
    │  ┌─────────────────────┐  │
    │  │ extract_learning    │  │ ← Learning extraction
    │  └─────────────────────┘  │   Claude API, <5s
    │  ┌─────────────────────┐  │
    │  │ mine_upload         │  │ ← IPFS + blockchain upload
    │  └─────────────────────┘  │   10-30s, network I/O
    └───────────────────────────┘
```

### Components

1. **Hook** - Enqueues jobs atomically with message persistence
2. **Job Queue** - SQLite-based persistent queue with ACID guarantees
3. **Workers** - Independent processes polling for jobs
4. **Job Handlers** - Idempotent processors for each job type
5. **Dead Letter Queue** - Failed jobs for manual intervention

---

## Job Queue Design

### Canonical Schema

**CRITICAL**: This is the canonical schema from STANDARDS.md. All implementations MUST match exactly.

**Key Principles**:
- **ULID IDs**: All IDs use ULID (time-sortable, lexicographic)
- **ISO-8601 Timestamps**: All timestamp columns use TEXT with ISO-8601 format
- **Canonical Status Enums**: ONLY queued | in_progress | completed | failed | dead_letter
- **Atomic Claiming**: Single UPDATE ... RETURNING prevents race conditions

```sql
CREATE TABLE IF NOT EXISTS job_queue (
  -- Identity
  id TEXT PRIMARY KEY,                    -- ULID (time-sortable)
  type TEXT NOT NULL,                     -- 'sanitize_ai_validation', 'extract_learning', 'mine_upload'

  -- Status (CANONICAL from STANDARDS.md)
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'in_progress', 'completed', 'failed', 'dead_letter')
  ),

  -- Priority and Scheduling
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  scheduled_at TEXT NOT NULL,             -- ISO-8601 timestamp - when to execute

  -- Worker Coordination (Lease-based)
  lease_owner TEXT,                       -- Worker ID (hostname:pid)
  lease_until TEXT,                       -- ISO-8601 timestamp - lease expiry

  -- Payload and Idempotency
  payload TEXT NOT NULL,                  -- JSON job data
  idempotency_key TEXT UNIQUE,            -- Deduplication key

  -- Retry Management
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error TEXT,                             -- Last error message

  -- Timestamps (ALL ISO-8601 TEXT)
  created_at TEXT NOT NULL,               -- ISO-8601 - when job was created
  updated_at TEXT NOT NULL,               -- ISO-8601 - last modification
  started_at TEXT,                        -- ISO-8601 - when worker claimed job
  completed_at TEXT,                      -- ISO-8601 - when job finished

  -- Result
  result TEXT                             -- JSON result data
);

-- Indexes for efficient worker queries
CREATE INDEX idx_job_queue_dequeue
  ON job_queue(status, priority, scheduled_at)
  WHERE status = 'queued';

CREATE INDEX idx_job_queue_lease_expiry
  ON job_queue(lease_until)
  WHERE status = 'in_progress';

CREATE INDEX idx_job_queue_type
  ON job_queue(type, status);

CREATE INDEX idx_job_queue_idempotency
  ON job_queue(idempotency_key);

-- Trigger for updated_at (ISO-8601)
CREATE TRIGGER job_queue_updated_at
AFTER UPDATE ON job_queue
FOR EACH ROW
BEGIN
  UPDATE job_queue SET updated_at = (datetime('now', 'localtime') || 'Z') WHERE id = NEW.id;
END;
```

### Status State Machine

**CANONICAL**: These are the ONLY valid status values from STANDARDS.md.

```typescript
type JobStatus =
  | 'queued'        // Initial state, waiting for worker
  | 'in_progress'   // Worker has claimed and is processing
  | 'completed'     // Successfully finished
  | 'failed'        // Failed but retriable (attempts < max_retries)
  | 'dead_letter';  // Failed permanently (attempts >= max_retries)

// Valid state transitions
const validTransitions: Record<JobStatus, JobStatus[]> = {
  queued: ['in_progress'],
  in_progress: ['completed', 'failed', 'queued'],  // queued = lease expired
  failed: ['queued', 'dead_letter'],
  completed: [],       // Terminal state
  dead_letter: []      // Terminal state
};
```

**State Transition Rules**:
1. `queued` → `in_progress`: Worker claims job with lease
2. `in_progress` → `completed`: Job succeeds
3. `in_progress` → `failed`: Job fails, attempts < max_retries
4. `in_progress` → `queued`: Lease expires (worker crashed)
5. `failed` → `queued`: Retry with exponential backoff
6. `failed` → `dead_letter`: Max retries exceeded
7. Terminal states (`completed`, `dead_letter`) never transition

---

## Job Types

### CANONICAL Job Types

From STANDARDS.md, these are the ONLY job types:

1. **sanitize_ai_validation** - AI-based PII validation (DOWNSTREAM from fast pre-sanitization in hook)
2. **extract_learning** - Extract learnings from conversations
3. **mine_upload** - Upload learnings to IPFS + blockchain

**CRITICAL**: The `sanitize_ai_validation` job operates on ALREADY SANITIZED content. Fast pre-sanitization happens in the hook (<50ms) BEFORE any database persistence. This job performs additional AI validation to catch edge cases the regex rules might miss.

### Job Type Specifications

#### 1. sanitize_ai_validation

**Purpose**: Downstream AI validation of pre-sanitized content

**Payload**:
```typescript
interface SanitizeAIValidationPayload {
  conversation_id: string;
  message_ids: string[];     // Messages to validate (ALREADY SANITIZED)
  sanitization_version: string;
}
```

**Behavior**:
- **CRITICAL**: Operates ONLY on pre-sanitized content from messages table
- Validates no PII leaked through fast regex rules
- Catches context-aware PII (e.g., names that look like variables)
- Updates sanitization_log with additional findings
- Does NOT access or store raw content
- Idempotent: Check if AI validation already completed for conversation

**Performance Budget**: <2s p95 (Claude API call)

**Priority**: 1 (highest) - privacy-critical

**Max Retries**: 3

**Idempotency Key**: `sanitize-ai-validation-${conversation_id}`

#### 2. extract_learning

**Purpose**: Extract learnings from completed conversations

**Payload**:
```typescript
interface ExtractLearningPayload {
  conversation_id: string;
  min_confidence: number;    // Minimum confidence threshold (0.0-1.0)
  categories: string[];      // Which learning categories to extract
}
```

**Behavior**:
- Analyzes message sequence for patterns, insights
- Generates learnings with confidence scores
- Deduplicates against existing learnings (dedupe_hash)
- Writes to learnings table with FTS indexing
- Idempotent: Check if learnings exist for conversation_id

**Performance Budget**: <5s p95 (Claude API call)

**Priority**: 5 (medium)

**Max Retries**: 3

**Idempotency Key**: `extract-learning-${conversation_id}`

#### 3. mine_upload

**Purpose**: Upload learnings to global network (IPFS + blockchain)

**Payload**:
```typescript
interface MineUploadPayload {
  learning_id: string;
  ipfs_endpoint: string;     // IPFS API endpoint
  chain_config: {
    rpc_url: string;
    contract_address: string;
    private_key_ref: string; // Reference to secure key storage
  };
}
```

**Behavior**:
- Upload learning to IPFS, get CID
- Submit blockchain transaction with CID
- Wait for transaction confirmation
- Update uploads table with CID, tx_hash, status
- Idempotent: Check uploads table for learning_id

**Performance Budget**: 10-30s p95 (network I/O)

**Priority**: 10 (lowest) - not time-sensitive

**Max Retries**: 5 (network can be flaky)

**Idempotency Key**: `upload-${learning_id}`

---

## Worker Architecture

### Worker Model

Workers are independent processes that:
1. **Poll** the job queue for available jobs
2. **Lease** jobs using optimistic locking
3. **Execute** job handlers with timeout
4. **Report** results (success/failure)
5. **Retry** failed jobs with exponential backoff
6. **Shutdown** gracefully on signals

### Worker Lifecycle

```
┌──────────────────────────────────────────────────────┐
│                   Worker Start                       │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Initialize Worker   │
         │  - Set worker_id     │
         │  - Open DB connection│
         │  - Register handlers │
         └──────────┬───────────┘
                    │
         ┌──────────▼───────────┐
         │   Polling Loop       │◄──────────┐
         │   (1s interval)      │           │
         └──────────┬───────────┘           │
                    │                       │
                    ▼                       │
         ┌──────────────────────┐           │
         │   Claim Job          │           │
         │   (Lease-based)      │           │
         └──────────┬───────────┘           │
                    │                       │
            ┌───────┴───────┐               │
            │               │               │
            ▼               ▼               │
      ┌─────────┐    ┌──────────┐          │
      │No Job   │    │ Job Found│          │
      │ Sleep   │    └────┬─────┘          │
      └────┬────┘         │                │
           │              ▼                │
           │    ┌──────────────────┐       │
           │    │  Execute Handler │       │
           │    │  (Idempotent)    │       │
           │    └──────┬───────────┘       │
           │           │                   │
           │    ┌──────┴──────┐            │
           │    │             │            │
           │    ▼             ▼            │
           │ ┌────────┐   ┌────────┐      │
           │ │Success │   │ Failure│      │
           │ └───┬────┘   └───┬────┘      │
           │     │            │            │
           │     ▼            ▼            │
           │ ┌────────┐   ┌────────────┐  │
           │ │ Mark   │   │ Handle     │  │
           │ │Complete│   │ Retry/DLQ  │  │
           │ └───┬────┘   └───┬────────┘  │
           │     │            │            │
           └─────┴────────────┴────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ SIGTERM/SIGINT│
                    └───────┬───────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ Graceful Shutdown│
                  │ - Finish current │
                  │ - Release lease  │
                  │ - Close DB       │
                  └──────────────────┘
```

### Lease-Based Execution

**Why Leases**: Prevent duplicate processing and enable crash recovery.

**Lease Parameters**:
- **Duration**: 60s (adjustable per job type)
- **Renewal**: Not implemented in MVP (jobs must complete within lease)
- **Expiry Check**: Separate worker process checks for expired leases

**Claim Algorithm** (Optimistic Locking):

```typescript
function claimJob(workerId: string): Job | null {
  const now = new Date().toISOString();  // ISO-8601 format
  const leaseUntil = new Date(Date.now() + 60000).toISOString();  // +60s

  // Atomic update with RETURNING (SQLite 3.35+)
  // Single-statement UPDATE prevents race conditions with multiple workers
  const job = db.prepare(`
    UPDATE job_queue
    SET
      status = 'in_progress',
      lease_owner = ?,
      lease_until = ?,
      started_at = ?,
      attempts = attempts + 1,
      updated_at = ?
    WHERE id = (
      SELECT id
      FROM job_queue
      WHERE status = 'queued'
        AND scheduled_at <= ?
      ORDER BY priority ASC, scheduled_at ASC
      LIMIT 1
    )
    RETURNING *
  `).get(workerId, leaseUntil, now, now, now);

  return job ? deserializeJob(job) : null;
}
```

**Lease Expiry Recovery**:

```typescript
// Separate watchdog process
function releaseExpiredLeases(): number {
  const now = new Date().toISOString();  // ISO-8601 format

  const result = db.prepare(`
    UPDATE job_queue
    SET
      status = 'queued',
      lease_owner = NULL,
      lease_until = NULL,
      started_at = NULL,
      updated_at = ?
    WHERE status = 'in_progress'
      AND lease_until < ?
  `).run(now, now);

  return result.changes;
}

// Run every 30s
setInterval(() => {
  const released = releaseExpiredLeases();
  if (released > 0) {
    logger.warn(`Released ${released} expired leases`);
  }
}, 30000);
```

---

## Idempotency Strategy

### Principle

**At-least-once delivery requires idempotency**: Jobs may execute multiple times (crashes, retries, lease expiry). Handlers MUST be safe to re-run.

### Implementation Patterns

#### 1. Check-Before-Mutate

```typescript
import { ulid } from 'ulid';

async function sanitizeAIValidationHandler(payload: SanitizeAIValidationPayload) {
  const { conversation_id, message_ids } = payload;

  // Check if already validated
  const conversation = db.prepare(`
    SELECT id, metadata
    FROM conversations
    WHERE id = ?
  `).get(conversation_id);

  const metadata = conversation.metadata ? JSON.parse(conversation.metadata) : {};
  if (metadata.ai_validation_completed) {
    logger.info(`Conversation ${conversation_id} already AI validated`);
    return { skipped: true, reason: 'already-validated' };
  }

  // Fetch SANITIZED messages (NEVER raw content)
  const messages = db.prepare(`
    SELECT id, content
    FROM messages
    WHERE id IN (${message_ids.map(() => '?').join(',')})
  `).all(...message_ids);

  // Perform AI validation on sanitized content
  const validationResult = await validateSanitizedContentWithAI(messages);

  // Update atomically
  db.transaction(() => {
    // Mark as AI validated
    metadata.ai_validation_completed = true;
    metadata.ai_validation_timestamp = new Date().toISOString();

    db.prepare(`
      UPDATE conversations
      SET metadata = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(metadata),
      new Date().toISOString(),
      conversation_id
    );

    // Log any additional findings
    for (const finding of validationResult.findings) {
      db.prepare(`
        INSERT INTO sanitization_log (
          id, conversation_id, message_id, category,
          original_snippet_hash, replacement, detector,
          confidence, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ulid(),
        conversation_id,
        finding.message_id,
        finding.category,
        finding.snippet_hash,
        finding.replacement,
        'ai',
        finding.confidence,
        new Date().toISOString()
      );
    }
  })();

  return { success: true, findings: validationResult.findings.length };
}
```

#### 2. Idempotency Keys

```typescript
import { ulid } from 'ulid';

function enqueueJob(type: string, payload: any, idempotencyKey: string) {
  const now = new Date().toISOString();  // ISO-8601 format

  try {
    db.prepare(`
      INSERT INTO job_queue (
        id, type, payload, idempotency_key,
        scheduled_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ulid(),
      type,
      JSON.stringify(payload),
      idempotencyKey,
      now,
      now,
      now
    );

    return { enqueued: true };
  } catch (error) {
    // UNIQUE constraint violation on idempotency_key
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      logger.info(`Job with key ${idempotencyKey} already enqueued`);
      return { enqueued: false, reason: 'duplicate' };
    }
    throw error;
  }
}
```

#### 3. Natural Keys

For learnings and uploads, use natural keys to prevent duplicates:

```typescript
import { ulid } from 'ulid';
import crypto from 'crypto';

async function extractLearningHandler(payload: ExtractLearningPayload) {
  const { conversation_id } = payload;

  // Extract learnings from Claude using SANITIZED messages
  const rawLearnings = await extractLearningsWithClaude(conversation_id);

  for (const learning of rawLearnings) {
    // Generate dedupe hash
    const dedupeHash = crypto
      .createHash('sha256')
      .update(`${learning.category}:${learning.content}`)
      .digest('hex');

    try {
      const now = new Date().toISOString();  // ISO-8601 format

      // Insert with UNIQUE constraint on dedupe_hash
      db.prepare(`
        INSERT INTO learnings (
          id, conversation_id, category, title, content,
          confidence, tags, dedupe_hash, source_message_ids,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ulid(),
        conversation_id,
        learning.category,
        learning.title,
        learning.content,
        learning.confidence,
        JSON.stringify(learning.tags),
        dedupeHash,
        JSON.stringify(learning.source_message_ids),
        now
      );
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Learning already exists, skip
        logger.debug(`Learning already exists: ${dedupeHash}`);
        continue;
      }
      throw error;
    }
  }

  return { success: true, learnings: rawLearnings.length };
}
```

#### 4. Upload Idempotency

```typescript
async function mineUploadHandler(payload: MineUploadPayload) {
  const { learning_id } = payload;

  // Check upload status
  const upload = db.prepare(`
    SELECT status, ipfs_cid, chain_tx_hash
    FROM uploads
    WHERE learning_id = ?
  `).get(learning_id);

  if (upload) {
    // Already uploaded
    if (upload.status === 'confirmed') {
      return { skipped: true, reason: 'already-confirmed' };
    }

    // Resume from last state
    if (upload.status === 'ipfs_uploaded' && upload.ipfs_cid) {
      // Skip IPFS, go straight to blockchain
      return await submitToBlockchain(learning_id, upload.ipfs_cid);
    }

    if (upload.status === 'tx_submitted' && upload.chain_tx_hash) {
      // Check transaction status
      return await checkTransactionStatus(learning_id, upload.chain_tx_hash);
    }
  }

  // Fresh upload
  const learning = db.prepare(`
    SELECT content FROM learnings WHERE id = ?
  `).get(learning_id);

  // Upload to IPFS
  const cid = await uploadToIPFS(learning.content);

  const now = new Date().toISOString();  // ISO-8601 format

  // Record IPFS upload
  db.prepare(`
    INSERT INTO uploads (id, learning_id, ipfs_cid, status, uploaded_at, created_at, updated_at)
    VALUES (?, ?, ?, 'ipfs_uploaded', ?, ?, ?)
    ON CONFLICT(learning_id) DO UPDATE SET
      ipfs_cid = excluded.ipfs_cid,
      status = excluded.status,
      uploaded_at = excluded.uploaded_at,
      updated_at = excluded.updated_at
  `).run(ulid(), learning_id, cid, now, now, now);

  // Submit to blockchain
  return await submitToBlockchain(learning_id, cid);
}
```

---

## Retry and Backoff

### Retry Strategy

**At-least-once delivery**: Failed jobs are retried with exponential backoff.

**Parameters**:
- **Max Retries**: 3 (configurable per job type)
- **Base Delay**: 1s
- **Max Delay**: 60s
- **Jitter**: ±0-1s (prevent thundering herd)

### Backoff Algorithm

```typescript
function calculateBackoff(attempts: number): number {
  const baseDelay = 1000; // 1s
  const maxDelay = 60000; // 60s

  // Exponential: 2^attempts * baseDelay
  const exponential = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);

  // Add jitter: ±0-1s
  const jitter = Math.random() * 1000;

  return exponential + jitter;
}

// Example: attempts = 1 → ~2s, attempts = 2 → ~4s, attempts = 3 → ~8s
```

### Failure Handling

```typescript
async function handleJobFailure(job: Job, error: Error) {
  const attempts = job.attempts;
  const now = new Date().toISOString();  // ISO-8601 format

  if (attempts >= job.max_retries) {
    // Move to dead letter queue
    db.prepare(`
      UPDATE job_queue
      SET
        status = 'dead_letter',
        error = ?,
        completed_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(error.message, now, now, job.id);

    // Alert on DLQ additions
    await alertDeadLetterQueue(job, error);

    logger.error(`Job ${job.id} moved to dead_letter after ${attempts} attempts`, {
      job_id: job.id,
      job_type: job.type,
      error: error.message
    });

    return;
  }

  // Retry with backoff
  const backoffMs = calculateBackoff(attempts);
  const scheduledAt = new Date(Date.now() + backoffMs).toISOString();

  db.prepare(`
    UPDATE job_queue
    SET
      status = 'queued',
      error = ?,
      scheduled_at = ?,
      lease_owner = NULL,
      lease_until = NULL,
      started_at = NULL,
      updated_at = ?
    WHERE id = ?
  `).run(error.message, scheduledAt, now, job.id);

  logger.warn(`Job ${job.id} failed, retrying in ${backoffMs}ms (attempt ${attempts}/${job.max_retries})`, {
    job_id: job.id,
    job_type: job.type,
    error: error.message
  });
}
```

### Dead Letter Queue

**Purpose**: Collect jobs that failed permanently for manual intervention.

**Query Dead Letter Jobs**:
```typescript
function getDeadLetterJobs(limit: number = 100): Job[] {
  const jobs = db.prepare(`
    SELECT *
    FROM job_queue
    WHERE status = 'dead_letter'
    ORDER BY completed_at DESC
    LIMIT ?
  `).all(limit);

  return jobs.map(deserializeJob);
}
```

**Retry Dead Letter Job**:
```typescript
function retryDeadLetterJob(jobId: string) {
  const now = new Date().toISOString();  // ISO-8601 format

  db.prepare(`
    UPDATE job_queue
    SET
      status = 'queued',
      attempts = 0,
      error = NULL,
      scheduled_at = ?,
      completed_at = NULL,
      lease_owner = NULL,
      lease_until = NULL,
      started_at = NULL,
      updated_at = ?
    WHERE id = ? AND status = 'dead_letter'
  `).run(now, now, jobId);

  logger.info(`Retrying dead letter job ${jobId}`);
}
```

**Monitoring**:
```typescript
// Alert on DLQ growth
setInterval(() => {
  const count = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_queue
    WHERE status = 'dead_letter'
  `).get().count;

  if (count > 10) {
    alertDeadLetterQueueSize(count);
  }
}, 300000); // Check every 5 minutes
```

---

## Graceful Shutdown

### Requirements

1. **No job loss** - Complete in-flight jobs before exit
2. **No orphaned leases** - Release leases on incomplete jobs
3. **Clean database state** - No stale locks
4. **Bounded shutdown time** - Max 30s wait for completion

### Implementation

```typescript
class JobWorker {
  private running = false;
  private currentJob: Job | null = null;
  private shutdownPromise: Promise<void> | null = null;

  async start() {
    this.running = true;
    logger.info(`Worker ${this.workerId} starting`);

    // Register signal handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));

    // Main loop
    while (this.running) {
      try {
        const job = await this.claimJob();

        if (job) {
          this.currentJob = job;
          await this.executeJob(job);
          this.currentJob = null;
        } else {
          // No jobs available, sleep
          await sleep(this.pollInterval);
        }
      } catch (error) {
        logger.error('Worker error', { error });
        await sleep(this.pollInterval);
      }
    }

    logger.info(`Worker ${this.workerId} stopped`);
  }

  async shutdown(signal: string) {
    if (this.shutdownPromise) {
      // Already shutting down
      return this.shutdownPromise;
    }

    logger.info(`Worker ${this.workerId} received ${signal}, shutting down gracefully`);

    this.shutdownPromise = this._doShutdown();
    return this.shutdownPromise;
  }

  private async _doShutdown() {
    // Stop accepting new jobs
    this.running = false;

    // Wait for current job to finish (with timeout)
    if (this.currentJob) {
      logger.info(`Waiting for current job ${this.currentJob.id} to complete`);

      await Promise.race([
        this.waitForJobCompletion(),
        sleep(30000) // 30s max wait
      ]);

      // If job still in progress after timeout, release lease
      if (this.currentJob) {
        logger.warn(`Job ${this.currentJob.id} did not complete in time, releasing lease`);

        db.prepare(`
          UPDATE job_queue
          SET
            status = 'queued',
            lease_owner = NULL,
            lease_until = NULL,
            started_at = NULL
          WHERE id = ?
        `).run(this.currentJob.id);
      }
    }

    // Close database connection
    db.close();

    logger.info('Worker shutdown complete');
    process.exit(0);
  }

  private async waitForJobCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.currentJob) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}
```

### Shutdown Scenarios

#### Normal Shutdown (SIGTERM)
```
1. Stop accepting new jobs (running = false)
2. Wait for current job to complete (max 30s)
3. Release lease if job doesn't complete
4. Close database connection
5. Exit with code 0
```

#### Forced Shutdown (SIGKILL)
```
1. Process dies immediately
2. Lease expires after 60s
3. Watchdog releases lease
4. Job returns to 'queued' status
5. Another worker picks up job
```

#### Crash/Exception
```
1. Worker process dies
2. currentJob lease remains
3. Lease expires after 60s
4. Watchdog releases lease
5. Job returns to 'queued'
```

---

## Monitoring and Observability

### Key Metrics

1. **Queue Depth** - Number of jobs waiting (status = 'queued')
2. **Queue Age** - Age of oldest queued job
3. **Processing Rate** - Jobs completed per minute
4. **Success Rate** - Completed / (Completed + Failed)
5. **Dead Letter Count** - Jobs in permanent failure state
6. **Job Latency** - p50, p95, p99 processing time
7. **Lease Expiry Rate** - Jobs with expired leases (worker crashes)

### Metrics Collection

```typescript
interface QueueMetrics {
  queueDepth: number;
  queueAgeMs: number;
  inProgressCount: number;
  processingRate: number;    // jobs/min
  successRate: number;       // 0.0-1.0
  deadLetterCount: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  leaseExpiryRate: number;   // expirations/min
}

function collectMetrics(windowMs: number = 3600000): QueueMetrics {
  const now = Date.now();
  const windowStart = new Date(now - windowMs).toISOString();

  // Queue depth
  const queueDepth = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_queue
    WHERE status = 'queued'
  `).get().count;

  // Queue age (oldest queued job)
  const oldestJob = db.prepare(`
    SELECT created_at
    FROM job_queue
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();

  const queueAgeMs = oldestJob
    ? now - new Date(oldestJob.created_at).getTime()
    : 0;

  // In-progress count
  const inProgressCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_queue
    WHERE status = 'in_progress'
  `).get().count;

  // Dead letter count
  const deadLetterCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_queue
    WHERE status = 'dead_letter'
  `).get().count;

  // Completed in window
  const completedCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_queue
    WHERE status = 'completed'
      AND completed_at >= ?
  `).get(windowStart).count;

  // Failed in window
  const failedCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_queue
    WHERE status IN ('failed', 'dead_letter')
      AND completed_at >= ?
  `).get(windowStart).count;

  // Processing rate (jobs/min)
  const processingRate = (completedCount / windowMs) * 60000;

  // Success rate
  const totalProcessed = completedCount + failedCount;
  const successRate = totalProcessed > 0
    ? completedCount / totalProcessed
    : 1.0;

  // Latency percentiles
  const latencies = db.prepare(`
    SELECT
      (julianday(completed_at) - julianday(started_at)) * 86400000 as latency_ms
    FROM job_queue
    WHERE status = 'completed'
      AND completed_at >= ?
    ORDER BY latency_ms ASC
  `).all(windowStart).map(r => r.latency_ms);

  const latencyP50Ms = percentile(latencies, 0.50);
  const latencyP95Ms = percentile(latencies, 0.95);
  const latencyP99Ms = percentile(latencies, 0.99);

  return {
    queueDepth,
    queueAgeMs,
    inProgressCount,
    processingRate,
    successRate,
    deadLetterCount,
    latencyP50Ms,
    latencyP95Ms,
    latencyP99Ms,
    leaseExpiryRate: 0 // TODO: Track lease expirations
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}
```

### Alerting Rules

```typescript
async function checkAlerts() {
  const metrics = collectMetrics(3600000); // 1 hour window

  // High queue depth
  if (metrics.queueDepth > 1000) {
    await alert({
      severity: 'WARNING',
      metric: 'queue_depth',
      value: metrics.queueDepth,
      threshold: 1000,
      message: 'Job queue depth is high, workers may be overwhelmed'
    });
  }

  // Old jobs in queue
  if (metrics.queueAgeMs > 3600000) { // 1 hour
    await alert({
      severity: 'WARNING',
      metric: 'queue_age',
      value: metrics.queueAgeMs,
      threshold: 3600000,
      message: 'Jobs are waiting too long in queue'
    });
  }

  // Low success rate
  if (metrics.successRate < 0.95) {
    await alert({
      severity: 'ERROR',
      metric: 'success_rate',
      value: metrics.successRate,
      threshold: 0.95,
      message: 'Job success rate is below 95%'
    });
  }

  // Dead letter queue growth
  if (metrics.deadLetterCount > 10) {
    await alert({
      severity: 'ERROR',
      metric: 'dead_letter_count',
      value: metrics.deadLetterCount,
      threshold: 10,
      message: 'Dead letter queue is growing, manual intervention needed'
    });
  }

  // High latency
  if (metrics.latencyP95Ms > 10000) { // 10s
    await alert({
      severity: 'WARNING',
      metric: 'latency_p95',
      value: metrics.latencyP95Ms,
      threshold: 10000,
      message: 'Job processing latency is high'
    });
  }
}

// Run every 5 minutes
setInterval(checkAlerts, 300000);
```

### Logging Standards

```typescript
// Structured logging for observability
interface JobLogContext {
  job_id: string;
  job_type: string;
  worker_id: string;
  attempts: number;
  duration_ms?: number;
  error?: string;
}

// Job claimed
logger.info('Job claimed', {
  job_id: job.id,
  job_type: job.type,
  worker_id: this.workerId,
  attempts: job.attempts,
  priority: job.priority
});

// Job succeeded
logger.info('Job completed', {
  job_id: job.id,
  job_type: job.type,
  worker_id: this.workerId,
  attempts: job.attempts,
  duration_ms: Date.now() - startTime
});

// Job failed
logger.error('Job failed', {
  job_id: job.id,
  job_type: job.type,
  worker_id: this.workerId,
  attempts: job.attempts,
  duration_ms: Date.now() - startTime,
  error: error.message
});

// Dead letter
logger.error('Job moved to dead_letter', {
  job_id: job.id,
  job_type: job.type,
  worker_id: this.workerId,
  attempts: job.attempts,
  error: error.message
});
```

---

## Operational Procedures

### Starting Workers

```bash
# Start single worker
node dist/workers/job-worker.js

# Start with PM2 (recommended)
pm2 start dist/workers/job-worker.js --name job-worker-1 -i 1

# Start multiple workers
pm2 start dist/workers/job-worker.js --name job-worker -i 4

# Monitor workers
pm2 monit
pm2 logs job-worker
```

### Stopping Workers

```bash
# Graceful shutdown (SIGTERM)
pm2 stop job-worker

# Force shutdown (SIGKILL)
pm2 kill job-worker

# Restart workers
pm2 restart job-worker
```

### Queue Maintenance

```typescript
// Clean up old completed jobs (archive or delete)
function cleanupCompletedJobs(retentionDays: number = 7) {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();  // ISO-8601

  const result = db.prepare(`
    DELETE FROM job_queue
    WHERE status = 'completed'
      AND completed_at < ?
  `).run(cutoff);

  logger.info(`Cleaned up ${result.changes} completed jobs older than ${retentionDays} days`);
}

// Run daily
setInterval(cleanupCompletedJobs, 86400000);
```

```typescript
// Release stale leases (crashed workers)
function releaseStaleLeases(timeoutMs: number = 300000) {
  const now = new Date().toISOString();  // ISO-8601 format
  const cutoff = new Date(Date.now() - timeoutMs).toISOString();  // ISO-8601

  const result = db.prepare(`
    UPDATE job_queue
    SET
      status = 'queued',
      lease_owner = NULL,
      lease_until = NULL,
      started_at = NULL,
      updated_at = ?
    WHERE status = 'in_progress'
      AND lease_until < ?
  `).run(now, cutoff);

  if (result.changes > 0) {
    logger.warn(`Released ${result.changes} stale leases`);
  }

  return result.changes;
}

// Run every 30s
setInterval(() => releaseStaleLeases(300000), 30000);
```

### Dead Letter Queue Management

```typescript
// Inspect dead letter jobs
function inspectDeadLetterQueue() {
  const jobs = db.prepare(`
    SELECT id, type, attempts, error, created_at, completed_at
    FROM job_queue
    WHERE status = 'dead_letter'
    ORDER BY completed_at DESC
    LIMIT 100
  `).all();

  console.table(jobs);
}

// Retry specific dead letter job
function retryDeadLetterJob(jobId: string) {
  const now = new Date().toISOString();  // ISO-8601 format

  db.prepare(`
    UPDATE job_queue
    SET
      status = 'queued',
      attempts = 0,
      error = NULL,
      completed_at = NULL,
      scheduled_at = ?,
      lease_owner = NULL,
      lease_until = NULL,
      started_at = NULL,
      updated_at = ?
    WHERE id = ? AND status = 'dead_letter'
  `).run(now, now, jobId);

  logger.info(`Retrying dead letter job ${jobId}`);
}

// Retry all dead letter jobs of specific type
function retryDeadLetterJobsByType(type: string) {
  const now = new Date().toISOString();  // ISO-8601 format

  const result = db.prepare(`
    UPDATE job_queue
    SET
      status = 'queued',
      attempts = 0,
      error = NULL,
      completed_at = NULL,
      scheduled_at = ?,
      lease_owner = NULL,
      lease_until = NULL,
      started_at = NULL,
      updated_at = ?
    WHERE type = ? AND status = 'dead_letter'
  `).run(now, now, type);

  logger.info(`Retrying ${result.changes} dead letter jobs of type ${type}`);
}
```

---

## Performance Budgets

From STANDARDS.md, these are the canonical performance budgets:

| Component | Budget | Measurement |
|-----------|--------|-------------|
| Hook execution | <100ms p95 | End-to-end (receive → sanitize → persist → enqueue) |
| Fast sanitization | <50ms p95 | Regex-based rules in hook |
| Database writes | <20ms p95 | WAL-mode insert |
| Job enqueue | <10ms p95 | INSERT with idempotency check |
| AI sanitization job | <2s p95 | Claude API call |
| Learning extraction job | <5s p95 | Claude API call |
| Upload job | 10-30s p95 | IPFS + blockchain network I/O |

---

## Testing Strategy

### Unit Tests

```typescript
describe('JobQueueRepository', () => {
  let db: Database;
  let repo: JobQueueRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new JobQueueRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should enqueue job with idempotency key', () => {
    const payload = { conversation_id: 'test-123' };
    const job = repo.create({
      type: 'sanitize_ai_validation',
      payload,
      idempotency_key: 'test-key'
    });

    expect(job.status).toBe('queued');
    expect(job.payload).toEqual(payload);

    // Duplicate should fail
    expect(() => {
      repo.create({
        type: 'sanitize_ai_validation',
        payload,
        idempotency_key: 'test-key'
      });
    }).toThrow();
  });

  it('should claim job with lease', () => {
    // Enqueue job
    repo.create({
      type: 'extract_learning',
      payload: { conversation_id: 'test-123' }
    });

    // Claim job
    const job = repo.dequeue();
    expect(job).not.toBeNull();
    expect(job!.status).toBe('in_progress');
    expect(job!.lease_owner).toBeDefined();
    expect(job!.lease_until).toBeDefined();

    // No more jobs
    const noJob = repo.dequeue();
    expect(noJob).toBeNull();
  });

  it('should retry failed job with backoff', () => {
    const job = repo.create({
      type: 'mine_upload',
      payload: { learning_id: 'test-123' },
      max_retries: 3
    });

    // Claim and fail
    const claimed = repo.dequeue();
    repo.markFailed(claimed!.id, 'Network error');

    // Check requeued with backoff
    const requeued = repo.findById(claimed!.id);
    expect(requeued!.status).toBe('queued');
    expect(requeued!.attempts).toBe(1);
    expect(new Date(requeued!.scheduled_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('should move to dead_letter after max retries', () => {
    const job = repo.create({
      type: 'extract_learning',
      payload: { conversation_id: 'test-123' },
      max_retries: 2
    });

    // Fail twice
    for (let i = 0; i < 2; i++) {
      const claimed = repo.dequeue();
      repo.markFailed(claimed!.id, `Error ${i + 1}`);
    }

    // Check dead_letter
    const deadJob = repo.findById(job.id);
    expect(deadJob!.status).toBe('dead_letter');
    expect(deadJob!.attempts).toBe(2);
  });
});
```

### Integration Tests

```typescript
describe('Worker Integration', () => {
  let db: Database;
  let worker: JobWorker;
  let handlerCalled = false;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);

    // Mock handler
    const mockHandler = async (payload: any) => {
      handlerCalled = true;
      return { success: true };
    };

    worker = new JobWorker({
      handlers: {
        test_job: mockHandler
      },
      pollInterval: 100
    });
  });

  afterEach(async () => {
    await worker.shutdown('TEST');
    db.close();
  });

  it('should process queued job', async () => {
    // Enqueue job
    const repo = new JobQueueRepository(db);
    repo.create({
      type: 'test_job',
      payload: { test: true }
    });

    // Start worker
    const workerPromise = worker.start();

    // Wait for handler to be called
    await waitFor(() => handlerCalled, 1000);

    // Stop worker
    await worker.shutdown('TEST');

    expect(handlerCalled).toBe(true);

    // Check job completed
    const jobs = repo.findByStatus('completed');
    expect(jobs).toHaveLength(1);
  });

  it('should handle job failure and retry', async () => {
    let attempts = 0;

    const failingHandler = async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Temporary failure');
      }
      return { success: true };
    };

    worker = new JobWorker({
      handlers: {
        test_job: failingHandler
      },
      pollInterval: 100
    });

    // Enqueue job
    const repo = new JobQueueRepository(db);
    repo.create({
      type: 'test_job',
      payload: { test: true },
      max_retries: 3
    });

    // Start worker
    const workerPromise = worker.start();

    // Wait for retry and success
    await waitFor(() => attempts >= 2, 5000);

    // Stop worker
    await worker.shutdown('TEST');

    expect(attempts).toBe(2);

    // Check job completed
    const jobs = repo.findByStatus('completed');
    expect(jobs).toHaveLength(1);
  });
});
```

### End-to-End Tests

```typescript
describe('Async Processing E2E', () => {
  it('should process conversation through full pipeline', async () => {
    // 1. Hook enqueues sanitization job
    const conversationId = ulid();
    await hookHandler({
      event: 'UserPromptSubmit',
      conversation_id: conversationId,
      content: 'Test message with potential PII: john@example.com'
    });

    // Check job enqueued
    const repo = new JobQueueRepository(db);
    const jobs = repo.findByType('sanitize_ai_validation');
    expect(jobs).toHaveLength(1);

    // 2. Worker processes sanitization job
    const worker = new JobWorker();
    await worker.start();

    await waitFor(() => {
      const job = repo.findById(jobs[0].id);
      return job!.status === 'completed';
    }, 5000);

    // 3. Check learning extraction job enqueued
    const learningJobs = repo.findByType('extract_learning');
    expect(learningJobs).toHaveLength(1);

    // 4. Worker processes learning extraction
    await waitFor(() => {
      const job = repo.findById(learningJobs[0].id);
      return job!.status === 'completed';
    }, 10000);

    // 5. Check learnings created
    const learningRepo = new LearningRepository(db);
    const learnings = learningRepo.findByConversation(conversationId);
    expect(learnings.length).toBeGreaterThan(0);

    // 6. Check upload job enqueued
    const uploadJobs = repo.findByType('mine_upload');
    expect(uploadJobs.length).toBeGreaterThan(0);

    await worker.shutdown('TEST');
  });
});
```

---

## Security Considerations

### 1. Payload Sanitization

**Risk**: Malicious payloads in job queue

**Mitigation**:
- Validate payload schema before execution
- Use TypeScript types for payload validation
- Never eval() or execute arbitrary code from payloads

```typescript
function validatePayload<T>(payload: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(payload);
  } catch (error) {
    throw new Error(`Invalid payload: ${error.message}`);
  }
}

// Example usage
const SanitizePayloadSchema = z.object({
  conversation_id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/), // ULID format
  message_ids: z.array(z.string()),
  sanitization_version: z.string()
});

async function sanitizeAIValidationHandler(rawPayload: unknown) {
  const payload = validatePayload(rawPayload, SanitizePayloadSchema);
  // Safe to use payload
}
```

### 2. Worker Isolation

**Risk**: Worker compromise affects system

**Mitigation**:
- Workers run as separate processes
- Limited database permissions (no DDL)
- No access to raw content (only sanitized)
- No network access except approved endpoints (Claude API, IPFS)

### 3. Idempotency Key Security

**Risk**: Predictable keys allow queue manipulation

**Mitigation**:
- Include random component in keys where appropriate
- Use cryptographic hashes for content-based keys
- Validate key format before use

```typescript
function generateIdempotencyKey(conversation_id: string, nonce?: string): string {
  const input = nonce
    ? `${conversation_id}:${nonce}`
    : conversation_id;

  return `sanitize-${crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)}`;
}
```

### 4. Dead Letter Queue Privacy

**Risk**: Failed jobs expose sensitive data

**Mitigation**:
- Never log full payloads in errors
- Sanitize error messages before storage
- Restrict access to dead letter queue
- Purge dead letter jobs after resolution

---

## Related Documents

### Standards
- [Global Project Standards](../STANDARDS.md) - Canonical schema, status enums, IDs

### Architecture
- [Global Context Network Architecture](./architecture-global-context-network-2025-01-16.md)
- [Hooks & Event Capture](./architecture-hooks-event-capture-2025-01-16.md)
- [Sanitization Pipeline](./architecture-sanitization-pipeline-2025-01-16.md)

### Decisions
- [ADR-006: Async Processing Model](../decisions/decision-async-processing-model-2025-01-16.md)
- [ADR-005: Use SQLite](../decisions/decision-use-sqlite-2025-01-16.md)
- [ADR-004: Sanitize Before Storage](../decisions/decision-sanitize-before-storage-2025-01-16.md)

### Reference
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md)
- [Job Types Reference](../reference/reference-job-types-2025-01-16.md)

### Plans
- [Phase 4: Async Processing](../plans/plan-phase-4-async-processing-2025-01-16.md)

---

## Changelog

### 2025-01-16 - Initial Version
- Complete async processing architecture
- SQLite-based job queue with canonical schema
- Worker model with lease-based execution
- Idempotency strategies
- Retry and backoff logic
- Dead letter queue handling
- Graceful shutdown procedures
- Monitoring and observability
- Operational procedures
- Security considerations
- 100% alignment with STANDARDS.md
