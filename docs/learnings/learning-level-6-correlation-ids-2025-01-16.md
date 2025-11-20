# Learning: Level 6 Correlation IDs

**Date**: 2025-01-16  
**Level**: 6  
**Status**: ✅ Complete

## What Was Accomplished

Implemented reliable conversation grouping with deterministic sequence numbers so multi-message threads remain coherent from the very first hook invocation.

### Deliverables

1. **Schema Enhancements**
   - Added `session_id` and `UNIQUE(session_id)` to `conversations`.
   - Added `sequence` column to `messages` plus index on `(conversation_id, sequence)`.

2. **Hook Logic**
   - `getOrCreateConversationId()` now maps Claude session IDs to stable ULIDs, reusing existing conversation IDs when available.
   - `getNextSequence()` calculates the next message order atomically.
   - Insert statements include both `session_id` and `sequence`.

3. **Integration Coverage**
   - `integration.test.ts` ensures multi-turn sessions reuse the same `conversation_id` with sequences `1, 2, …`.
   - PII integration test updated to handle single-line payloads and verify sanitized output.

### Key Learnings

1. **Session-Based Mapping**: Relying on `session_id` lets us survive hooks that don’t provide a `conversation_id` yet still keep transcripts grouped.
2. **Schema Versioning**: Adding NOT NULL columns required touching all schema-related tests; best to keep helper utilities (e.g., `createSchema`) reusable for tests and hooks.
3. **Shell Quirks**: Multi-line JSON payloads broke the stdin runner due to actual control characters. Encoding prompts as single lines keeps the hook happy without resorting to extra escaping logic.

### Next Steps

Proceed to **Level 7: Job Queue** to persist hook events for downstream async processing, completing Stage 1 of the sanitization pipeline before integrating the Claude Agent SDK (Stage 2).

### Related Documents

- [Iterative Build Strategy](../plans/plan-iterative-build-strategy-2025-01-16.md)
- [Hooks & Event Capture Architecture](../architecture/architecture-hooks-event-capture-2025-01-16.md)
- [Sanitization Standards](../STANDARDS.md#9-sanitization-standard)

