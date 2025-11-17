---
title: ADR-006: Async Processing Model with Job Queue
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [async, job-queue, performance, reliability]
---

# ADR-006: Async Processing Model with Job Queue

## Status

Accepted

Date: 2025-01-16

## Context

The Global Context Network has several processing stages that must not block user interaction:

1. **Event capture** - Hooks must complete < 100ms
2. **Sanitization** - PII detection takes 1-2s per conversation
3. **Learning extraction** - AI analysis takes 5-10s
4. **Upload to network** - IPFS/blockchain can take 10-30s
5. **Quality validation** - Multi-stage validation takes time

**Requirements**:
- **Never block user** - Claude Code must remain responsive
- **Persist across restarts** - Jobs survive crashes/shutdowns
- **Retry failed jobs** - Network issues, temporary failures
- **Ordered processing** - Respect dependencies (sanitize before extract)
- **Idempotency** - Safe to retry jobs
- **Offline tolerance** - Queue locally, sync when online
- **Observable** - Monitor queue depth, latency, errors

**Why Async is Critical**:
- User experience constraint: < 100ms p95 for hooks
- Processing is inherently slow: sanitization, learning extraction, uploads
- Network operations are unpredictable: IPFS, blockchain
- Offline capability: must work without constant connectivity
- Predictable local operation before global publishing

## Decision

Use SQLite-based persistent job queue with async workers.

**Architecture**:
```
Hook (< 100ms) → Event Queue → Async Workers → Results
                       ↓
                   (Persisted)
```

**Job Types**:
1. `sanitize_conversation` - Run PII sanitization pipeline
2. `extract_learning` - Generate learnings from conversation
3. `mine_upload` - Upload to IPFS/blockchain

**Queue Properties**:
- Persistent (survives restarts)
- Priority-based (critical jobs first)
- Retry with exponential backoff
- Dead letter queue for failed jobs
- Atomic enqueue (outbox pattern)

**Worker Design**:
- Independent processes
- Poll queue for jobs
- Lease-based execution
- Idempotent job handlers
- Graceful shutdown

## Consequences

### Positive

- **Never blocks user** - Hooks return immediately (< 50ms)
- **Persists across restarts** - Jobs survive crashes
- **Retry with backoff** - Handles transient failures
- **No external dependencies** - SQLite-based, local-first
- **Offline tolerance** - Queue locally, flush when online
- **Predictable local operation** - No network required for queueing
- **Observable** - Full visibility into queue state
- **Ordered processing** - Dependency management built-in

### Negative

- **Single-process limitation** - One worker at a time (MVP acceptable)
- **No distributed processing** - Can't scale horizontally (fine for MVP)
- **Polling overhead** - Workers poll queue continuously
- **At-least-once semantics** - Exactly-once impossible (need idempotency)
- **Delayed feedback** - Users don't see immediate results

### Neutral

- **Job states** - Need to track queued, in-progress, completed, failed
- **Lease expiry** - Jobs can be retried if worker crashes
- **Metrics tracking** - Monitor queue depth, age, success rate
- **Backpressure handling** - May need to sample or drop if overwhelmed

## Alternatives Considered

### Alternative 1: Synchronous Processing

**Description**: Process everything in the hook itself.

**Pros**:
- Simpler code
- Immediate feedback
- No queue complexity
- Easier debugging

**Cons**:
- **Blocks user** - Unacceptable UX (2-10s delays)
- **Hook timeout** - Claude Code enforces timeout
- **Poor offline support** - Fails if network down
- **No retry** - Transient failures permanent

**Why not chosen**: Violates UX constraint (< 100ms hooks). Blocking user is unacceptable.

### Alternative 2: Redis/RabbitMQ/SQS

**Description**: Use external queue service.

**Pros**:
- Production-ready
- Distributed by design
- Excellent tooling
- Battle-tested

**Cons**:
- **External dependency** - Violates local-first principle
- **Setup overhead** - Install, configure, manage
- **Network dependency** - Offline mode broken
- **Operational complexity** - Monitor, backup, upgrade
- **Overkill for MVP** - Single user doesn't need distributed queue

**Why not chosen**: Too much operational overhead for single-user MVP. SQLite meets all requirements.

### Alternative 3: OS Job Schedulers (cron, systemd timers, launchd)

**Description**: Use OS-level job scheduling.

**Pros**:
- No custom queue needed
- OS handles execution
- Standard tooling

**Cons**:
- **No dynamic queueing** - Can't enqueue at runtime
- **Poor job management** - Hard to track state
- **No retries** - Must implement separately
- **Platform-specific** - Different on macOS/Linux/Windows

**Why not chosen**: Not suitable for dynamic event-driven queueing.

### Alternative 4: Simple setTimeout/setInterval

**Description**: Use JavaScript timers for delayed execution.

**Pros**:
- Very simple
- No dependencies
- Easy to understand

**Cons**:
- **No persistence** - Lost on restart
- **No retry** - Failures disappear
- **No ordering** - Race conditions
- **No observability** - Can't inspect pending jobs

**Why not chosen**: Violates "never lose data" requirement. Jobs must persist across restarts.

### Alternative 5: Temporal/Prefect/Dagster

**Description**: Use workflow orchestration framework.

**Pros**:
- Excellent DAG orchestration
- Built-in retry and error handling
- Great observability
- Scales to production
- Durable execution

**Cons**:
- **Heavy** - Requires server infrastructure
- **Overkill** - Too complex for MVP
- **Operational overhead** - Deploy, manage orchestrator
- **Not local-first** - Network dependency

**Why not chosen**: Great for future scaling but too heavy for MVP. Can migrate post-MVP.

### Alternative 6: Embedded Job Queue Libraries

**Description**: Use existing SQLite-based queue libraries.

**Pros**:
- Proven implementation
- Less code to write
- Community support

**Cons**:
- External dependency
- May not fit exact needs
- Learning curve for team
- Less control

**Why not chosen**: Considered but decided custom implementation is simple enough and gives more control. Can re-evaluate if complexity grows.

## Implementation

### Job Queue Schema

```typescript
CREATE TABLE job_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'sanitize_conversation', 'extract_learning', 'mine_upload'
  status TEXT NOT NULL, -- 'queued', 'in_progress', 'completed', 'failed', 'dead_letter'
  priority INTEGER NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
  payload TEXT NOT NULL, -- JSON
  idempotency_key TEXT UNIQUE, -- For deduplication
  created_at INTEGER NOT NULL,
  scheduled_at INTEGER NOT NULL, -- When to execute (for delays)
  started_at INTEGER, -- When worker picked up
  completed_at INTEGER,
  lease_expires_at INTEGER, -- Worker lease expiry
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error TEXT, -- Last error message
  result TEXT -- JSON result
);

CREATE INDEX idx_jobs_status_priority ON job_queue(status, priority, created_at);
CREATE INDEX idx_jobs_scheduled ON job_queue(scheduled_at) WHERE status = 'queued';
CREATE INDEX idx_jobs_lease_expiry ON job_queue(lease_expires_at) WHERE status = 'in_progress';
CREATE INDEX idx_jobs_idempotency ON job_queue(idempotency_key);
```

### Outbox Pattern (Atomic Enqueue)

```typescript
// Enqueue job atomically with conversation insert
async function captureAndEnqueue(conversation: Conversation) {
  db.transaction(() => {
    // 1. Insert conversation
    db.prepare(`
      INSERT INTO conversations (id, created_at, status)
      VALUES (?, ?, ?)
    `).run(conversation.id, Date.now(), "pending_sanitization");

    // 2. Enqueue sanitization job (same transaction)
    db.prepare(`
      INSERT INTO job_queue (id, type, status, priority, payload, idempotency_key, created_at, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      "sanitize_conversation",
      "queued",
      1, // High priority
      JSON.stringify({ conversationId: conversation.id }),
      `sanitize-${conversation.id}`, // Idempotency key
      Date.now(),
      Date.now() // Execute immediately
    );
  })();
}
```

### Job States and Transitions

```typescript
enum JobStatus {
  QUEUED = "queued",           // Waiting to execute
  IN_PROGRESS = "in_progress", // Worker processing
  COMPLETED = "completed",     // Successfully finished
  FAILED = "failed",           // Failed but can retry
  DEAD_LETTER = "dead_letter"  // Failed max retries
}

// State transitions
const validTransitions = {
  [JobStatus.QUEUED]: [JobStatus.IN_PROGRESS],
  [JobStatus.IN_PROGRESS]: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.QUEUED], // Queued = lease expired
  [JobStatus.FAILED]: [JobStatus.QUEUED, JobStatus.DEAD_LETTER],
  [JobStatus.COMPLETED]: [], // Terminal
  [JobStatus.DEAD_LETTER]: [] // Terminal
};
```

### Worker Implementation

```typescript
class JobWorker {
  private running = false;
  private pollInterval = 1000; // 1s
  private leaseDuration = 60000; // 60s

  async start() {
    this.running = true;
    console.log("Worker started");

    while (this.running) {
      try {
        const job = await this.claimJob();

        if (job) {
          await this.executeJob(job);
        } else {
          // No jobs, wait before polling again
          await sleep(this.pollInterval);
        }
      } catch (error) {
        console.error("Worker error:", error);
        await sleep(this.pollInterval);
      }
    }

    console.log("Worker stopped");
  }

  async stop() {
    this.running = false;
    // Graceful shutdown: finish current job
  }

  private async claimJob(): Promise<Job | null> {
    const now = Date.now();

    return db.transaction(() => {
      // Find next job to process
      const job = db.prepare(`
        SELECT * FROM job_queue
        WHERE status = 'queued'
          AND scheduled_at <= ?
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
      `).get(now);

      if (!job) {
        // Also check for expired leases
        const expiredJob = db.prepare(`
          SELECT * FROM job_queue
          WHERE status = 'in_progress'
            AND lease_expires_at < ?
          ORDER BY priority ASC, created_at ASC
          LIMIT 1
        `).get(now);

        if (expiredJob) {
          // Reset to queued for retry
          db.prepare(`
            UPDATE job_queue
            SET status = 'queued',
                lease_expires_at = NULL,
                started_at = NULL
            WHERE id = ?
          `).run(expiredJob.id);

          return expiredJob;
        }

        return null;
      }

      // Claim job with lease
      db.prepare(`
        UPDATE job_queue
        SET status = 'in_progress',
            started_at = ?,
            lease_expires_at = ?
        WHERE id = ?
      `).run(now, now + this.leaseDuration, job.id);

      return job;
    })();
  }

  private async executeJob(job: Job) {
    try {
      console.log(`Executing job ${job.id} (${job.type})`);

      // Get handler for job type
      const handler = this.getHandler(job.type);

      // Execute with idempotency
      const result = await handler(JSON.parse(job.payload));

      // Mark completed
      db.prepare(`
        UPDATE job_queue
        SET status = 'completed',
            completed_at = ?,
            result = ?
        WHERE id = ?
      `).run(Date.now(), JSON.stringify(result), job.id);

      console.log(`✓ Job ${job.id} completed`);
    } catch (error) {
      console.error(`✗ Job ${job.id} failed:`, error);

      // Retry logic
      await this.handleFailure(job, error);
    }
  }

  private async handleFailure(job: Job, error: Error) {
    const retryCount = job.retry_count + 1;

    if (retryCount >= job.max_retries) {
      // Move to dead letter queue
      db.prepare(`
        UPDATE job_queue
        SET status = 'dead_letter',
            retry_count = ?,
            error = ?
        WHERE id = ?
      `).run(retryCount, error.message, job.id);

      // Alert
      await alert({
        severity: "ERROR",
        message: `Job ${job.id} moved to dead letter queue`,
        error: error.message
      });
    } else {
      // Retry with exponential backoff
      const backoff = this.calculateBackoff(retryCount);

      db.prepare(`
        UPDATE job_queue
        SET status = 'queued',
            retry_count = ?,
            scheduled_at = ?,
            error = ?,
            lease_expires_at = NULL,
            started_at = NULL
        WHERE id = ?
      `).run(retryCount, Date.now() + backoff, error.message, job.id);

      console.log(`Retrying job ${job.id} in ${backoff}ms (attempt ${retryCount})`);
    }
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1s
    const maxDelay = 60000; // 60s
    const exponential = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    const jitter = Math.random() * 1000; // 0-1s jitter

    return exponential + jitter;
  }

  private getHandler(jobType: string): JobHandler {
    const handlers = {
      sanitize_conversation: sanitizeConversationHandler,
      extract_learning: extractLearningHandler,
      mine_upload: mineUploadHandler
    };

    return handlers[jobType] || (() => {
      throw new Error(`Unknown job type: ${jobType}`);
    });
  }
}
```

### Idempotency

```typescript
// Every job handler must be idempotent
async function sanitizeConversationHandler(payload: { conversationId: string }) {
  const { conversationId } = payload;

  // Check if already sanitized
  const conversation = db.prepare(
    "SELECT * FROM conversations WHERE id = ?"
  ).get(conversationId);

  if (conversation.status === "sanitized") {
    console.log(`Conversation ${conversationId} already sanitized`);
    return { skipped: true, reason: "already-sanitized" };
  }

  // Perform sanitization...
  const sanitized = await sanitize(conversation.content);

  // Update atomically
  db.transaction(() => {
    db.prepare(`
      UPDATE conversations
      SET sanitized_content = ?,
          status = 'sanitized',
          updated_at = ?
      WHERE id = ?
    `).run(sanitized, Date.now(), conversationId);
  })();

  return { success: true };
}
```

### Graceful Shutdown

```typescript
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");

  // Stop accepting new jobs
  worker.stop();

  // Wait for current job to finish (with timeout)
  await Promise.race([
    worker.waitForCompletion(),
    sleep(30000) // 30s max wait
  ]);

  // Close database
  db.close();

  process.exit(0);
});
```

### Metrics and Monitoring

```typescript
interface QueueMetrics {
  queueDepth: number; // Jobs waiting
  queueAge: number; // Oldest queued job age (ms)
  inProgressCount: number;
  p95Latency: number; // 95th percentile job duration
  successRate: number; // Completed / Total
  deadLetterCount: number;
}

async function getQueueMetrics(): Promise<QueueMetrics> {
  const stats = db.prepare(`
    SELECT
      status,
      COUNT(*) as count,
      MIN(created_at) as oldest,
      AVG(completed_at - started_at) as avg_duration,
      MAX(completed_at - started_at) as max_duration
    FROM job_queue
    WHERE created_at > ? -- Last 24 hours
    GROUP BY status
  `).all(Date.now() - 86400000);

  // Calculate metrics...
  return metrics;
}

// Expose metrics for monitoring
setInterval(async () => {
  const metrics = await getQueueMetrics();

  if (metrics.queueDepth > 100) {
    await alert({
      severity: "WARNING",
      message: `Queue depth high: ${metrics.queueDepth}`
    });
  }

  if (metrics.queueAge > 3600000) { // 1 hour
    await alert({
      severity: "WARNING",
      message: `Old jobs in queue: ${metrics.queueAge}ms`
    });
  }
}, 60000); // Check every minute
```

### Backpressure Handling

```typescript
async function enqueueWithBackpressure(job: Job) {
  const queueDepth = db.prepare(
    "SELECT COUNT(*) as count FROM job_queue WHERE status = 'queued'"
  ).get().count;

  const maxQueueSize = 10000;

  if (queueDepth >= maxQueueSize) {
    // Queue full - implement backpressure
    if (job.priority > 5) {
      // Drop low-priority jobs
      console.warn(`Queue full, dropping low-priority job ${job.type}`);
      return { dropped: true };
    } else {
      // Block and wait for high-priority jobs
      await waitForQueueSpace(maxQueueSize);
    }
  }

  // Enqueue job
  db.prepare(`
    INSERT INTO job_queue (...)
    VALUES (...)
  `).run(...);

  return { enqueued: true };
}
```

## Risks and Mitigations

### Risk: Jobs Lost on Crash

**Impact**: Medium - Work needs to be redone

**Mitigation**:
- Persistent queue (survives crashes)
- Lease-based execution (requeue if worker dies)
- Idempotent handlers (safe to retry)
- Monitor dead letter queue

### Risk: Queue Buildup

**Impact**: Medium - Delayed processing

**Mitigation**:
- Monitor queue depth
- Alert on high queue age
- Backpressure mechanism
- Can add more workers post-MVP

### Risk: Duplicate Processing

**Impact**: Low - Wasted resources

**Mitigation**:
- Idempotency keys prevent duplicates
- Idempotent job handlers
- Check state before processing

## Related Documents

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Async Processing Layer](../architecture/architecture-async-processing-2025-01-16.md)

### Decisions
- [ADR-001: Use Claude Hooks](./decision-use-claude-hooks-2025-01-16.md)
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md)
- [ADR-005: Use SQLite](./decision-use-sqlite-2025-01-16.md)

### Plans
- [Phase 4: Async Processing](../plans/plan-phase-4-async-processing-2025-01-16.md)

### Reference
- [Job Types Reference](../reference/reference-job-types-2025-01-16.md)
