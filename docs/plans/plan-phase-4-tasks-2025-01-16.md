# Phase 4: Async Processing Tasks

> Job queue, workers, idempotency, and crash recovery

---
title: Phase 4 Async Processing Tasks
category: plan
date: 2025-01-16
status: active
tags: [phase-4, async, queue, workers, reliability]
---

## Goal

Implement reliable async processing with idempotent jobs, retry logic, and crash recovery.

## Duration

5-7 days

## Tasks

### Job Queue Implementation
- [ ] Implement SQLite-based job queue
- [ ] Add job types (sanitize, extract_learning, mine_upload)
- [ ] Implement priority levels
- [ ] Add job status tracking (pending, in_progress, completed, failed)
- [ ] Implement advisory locks for job claiming
- [ ] Add job visibility timeout

**Subagent**: `job-queue-agent`

**Acceptance**: Jobs enqueued atomically, no duplicate processing

### Job Idempotency
- [ ] Design dedupe key strategy (conversation_id + job_type)
- [ ] Implement idempotency checks before execution
- [ ] Test duplicate job submissions are ignored
- [ ] Implement outbox pattern for uploads
- [ ] Document idempotency guarantees

**Acceptance**: Duplicate jobs don't execute twice

### Worker Process Architecture
- [ ] Create worker process framework
- [ ] Implement graceful startup
- [ ] Implement graceful shutdown (wait for in-flight jobs)
- [ ] Add job checkpoint/resume on shutdown
- [ ] Implement worker heartbeat
- [ ] Support multiple worker instances

**Subagent**: `worker-agent`

**Acceptance**: Workers start/stop cleanly, no job loss

### Retry Logic
- [ ] Implement exponential backoff (1s, 2s, 4s, 8s, ...)
- [ ] Set max retry count (3 attempts)
- [ ] Add jitter to prevent retry storms
- [ ] Track retry count per job
- [ ] Implement retry cap per time window

**Acceptance**: Failed jobs retry with backoff, max 3 attempts

### Dead Letter Queue
- [ ] Implement DLQ for permanently failed jobs
- [ ] Add failure reason tracking
- [ ] Implement manual review workflow
- [ ] Add re-queue from DLQ capability
- [ ] Monitor DLQ size

**Acceptance**: Failed jobs moved to DLQ after max retries

### Crash Recovery
- [ ] Test worker crash mid-job
- [ ] Implement job timeout and re-queue
- [ ] Test DB locked scenario
- [ ] Test disk full scenario
- [ ] Test power loss scenario (via simulation)
- [ ] Verify no data loss on crash

**Acceptance**: All crash scenarios recover gracefully

### Concurrency Control
- [ ] Implement advisory locks in SQLite
- [ ] Test concurrent workers don't claim same job
- [ ] Implement worker registration/deregistration
- [ ] Add worker health checks
- [ ] Test scaling to N workers

**Acceptance**: Concurrent workers safe, no double-processing

### Job Monitoring
- [ ] Track jobs in each status
- [ ] Track average job duration by type
- [ ] Track retry rate
- [ ] Track DLQ size
- [ ] Expose metrics endpoint (simple JSON)

**Acceptance**: Metrics available for monitoring

## Dependencies

- Phase 3: Database for job storage

## Deliverables

1. Job queue implementation
2. Worker process framework
3. Retry logic with backoff
4. Dead letter queue
5. Crash recovery tests
6. Concurrency control system
7. Monitoring/metrics

## Success Criteria

- ✅ Jobs never lost (even on crash)
- ✅ Idempotent processing verified
- ✅ Graceful shutdown within 30s
- ✅ Exponential backoff working
- ✅ DLQ captures failed jobs
- ✅ Concurrent workers safe
- ✅ Crash recovery E2E tests pass

## Job Types

### sanitize_conversation
- Input: conversation_id, raw_events
- Output: sanitized_conversation_id
- Retry: Yes (max 3)
- Timeout: 30s

### extract_learning
- Input: sanitized_conversation_id
- Output: learning_ids[]
- Retry: Yes (max 3)
- Timeout: 60s

### mine_upload
- Input: learning_id
- Output: ipfs_cid, blockchain_tx_id
- Retry: Yes (max 3)
- Timeout: 120s

## Testing Strategy

- Unit tests for queue operations
- Unit tests for retry logic
- Integration tests for worker lifecycle
- Chaos tests (kill worker, DB unavailable, disk full)
- Concurrency tests (multiple workers)
- Idempotency tests (duplicate submissions)
- Load tests (1000+ jobs)

## Related Documents

- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
