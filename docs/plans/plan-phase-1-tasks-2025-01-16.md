# Phase 1: Event Capture Tasks

> Hook implementation, event collection, and persistent queue

---
title: Phase 1 Event Capture Tasks
category: plan
date: 2025-01-16
status: active
tags: [phase-1, hooks, events, queue]
---

## Goal

Capture all Claude Code interactions via hooks without blocking the user, with fast pre-sanitization before persistence.

## Duration

3-4 days

## Tasks

### Event Schema Design
- [ ] Define event payload schema (correlation IDs, timestamps, versioning)
- [ ] Define message ordering strategy
- [ ] Define idempotency keys (dedupe strategy)
- [ ] Design event versioning for future compatibility
- [ ] Document schema with TypeScript types

**Acceptance**: Schema documented and typed

### UserPromptSubmit Hook
- [ ] Create `.claude/hooks/userPromptSubmit.sh` script
- [ ] Implement fast pre-sanitizer (< 50ms, removes obvious PII)
- [ ] Capture user prompt with correlation ID
- [ ] Implement error handling (never block user)
- [ ] Add performance monitoring
- [ ] Test hook execution time < 100ms (p95)

**Subagent**: `hook-developer-agent`

**Acceptance**: Hook runs < 100ms, captures prompts, never blocks UI

### Stop Hook
- [ ] Create `.claude/hooks/stop.sh` script
- [ ] Implement fast pre-sanitizer
- [ ] Capture agent response with correlation ID
- [ ] Handle partial responses and tool calls
- [ ] Add error handling
- [ ] Test hook execution time < 100ms (p95)

**Acceptance**: Hook runs < 100ms, captures responses, never blocks UI

### Fast Pre-Sanitizer
- [ ] Implement rule-based PII removal (API keys, obvious paths, emails)
- [ ] Ensure < 50ms execution for typical payloads
- [ ] Redact with [REDACTED_TYPE] format
- [ ] Log what was pre-sanitized (audit trail)
- [ ] Unit test with common PII patterns

**Acceptance**: Pre-sanitization < 50ms, removes obvious PII before persistence

### Event Collector
- [ ] Aggregate events into conversation sessions
- [ ] Implement correlation ID tracking
- [ ] Handle out-of-order messages
- [ ] Deduplicate events by idempotency key
- [ ] Handle conversation boundaries

**Subagent**: `event-collector-agent`

**Acceptance**: Events properly grouped into conversations

### Persistent Queue
- [ ] Implement SQLite-based event queue
- [ ] Store pre-sanitized events only (no raw data persisted)
- [ ] Implement queue operations (enqueue, dequeue, peek)
- [ ] Add backpressure handling (disk full, DB unavailable)
- [ ] Implement graceful degradation (in-memory fallback)
- [ ] Test persistence across restarts

**Subagent**: `queue-system-agent`

**Acceptance**: Queue persists pre-sanitized events, handles backpressure

### Cross-Platform Support
- [ ] Test hooks on macOS
- [ ] Test hooks on Linux (if applicable)
- [ ] Test hooks on Windows (if applicable)
- [ ] Document installation steps per OS
- [ ] Handle permission requirements

**Acceptance**: Hooks work on primary development OS

### Hook Failure Modes
- [ ] Implement circuit-breaker for persistent failures
- [ ] Add silent retry for transient errors
- [ ] Create offline mode (queue in memory until reconnected)
- [ ] Log failures without blocking
- [ ] Test failure scenarios

**Acceptance**: Failures handled gracefully, never block user

## Dependencies

- Phase 0: Database schema, TypeScript setup

## Deliverables

1. `.claude/hooks/userPromptSubmit.sh`
2. `.claude/hooks/stop.sh`
3. Fast pre-sanitizer implementation
4. Event collector implementation
5. Persistent queue implementation
6. Hook performance benchmarks
7. Installation guide for hooks

## Success Criteria

- ✅ Hooks execute < 100ms (p95)
- ✅ Pre-sanitization removes obvious PII < 50ms
- ✅ Events persisted with correlation IDs
- ✅ No user-blocking errors
- ✅ Complete conversation capture
- ✅ Queue handles backpressure
- ✅ Idempotent event processing (no duplicates)
- ✅ No plaintext raw data persisted on disk

## Testing Strategy

- Unit tests for event collector
- Unit tests for queue operations
- Performance tests for hooks (p95, p99 latency)
- Integration tests for end-to-end flow
- Chaos tests (kill process mid-write)

## Related Documents

- [Hooks & Event Capture Architecture](../architecture/architecture-hooks-event-capture-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
