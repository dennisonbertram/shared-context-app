# Learning Log: Level 12 — AI-Assisted Learning Extraction

**Date**: 2025-01-16  
**Status**: ✅ Complete  
**Goal**: Use the Claude Agent SDK to generate richer learnings from conversations asynchronously.

## Highlights

- **AI Extractor**
  - `generateLearningFromConversation()` prompts Claude (with deterministic fallback when `ANTHROPIC_API_KEY` is absent) and returns structured learnings.
  - Tests cover both fallback and mock Anthropic responses.

- **Learning Worker**
  - New `extract_learning_ai` jobs are enqueued whenever the hook captures an assistant message.
  - `runLearningExtractionWorker` dequeues jobs, loads full conversations, invokes the AI extractor, and persists learnings.
  - CLI entry `npm run worker:learning` added for local operation.

- **Schema & Persistence**
  - Reused the existing `learnings` table plus audit logs (via job queue + sanitization log).
  - Conversation service, persistence helpers, and integration tests ensure end-to-end coverage.

## Key Learnings

1. **Composable Queue Architecture** — Reusing `job_queue` + ULID helpers kept the new worker implementation minimal; adding another AI stage was mostly plumbing.
2. **Graceful Fallbacks** — The AI extractor mirrors the sanitization design: deterministic heuristics keep CI stable, while production can flip on Anthropic with an env var.
3. **Conversation Replay** — Storing message `sequence` numbers upfront paid off: the worker reconstructs conversations without extra metadata or queries.

## Next Steps

- Proceed to Level 13 (ULID migration already done) / Level 14 (Full Sanitization) as per the roadmap, or continue enhancing learnings with scoring/deduplication.

## Related Docs

- [Iterative Build Strategy](../plans/plan-iterative-build-strategy-2025-01-16.md)
- [Learning Extraction Architecture](../architecture/architecture-learning-extraction-2025-01-16.md)
- [Project Standards](../STANDARDS.md)

