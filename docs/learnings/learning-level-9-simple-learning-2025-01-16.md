# Learning: Level 9 Simple Learning Extraction

**Date**: 2025-01-16  
**Level**: 9  
**Status**: ✅ Complete

## What Was Accomplished

Implemented the first learning extractor (code-sample heuristic) and persisted its output to the canonical `learnings` table, completing the Level 9 milestone.

### Deliverables

1. **Schema**
   - Added `learnings` table with FK to `conversations`, indexes on `(conversation_id, created_at)`.

2. **Extractor Module**
   - `extractSimpleLearning()` identifies assistant messages containing ``` code blocks and emits a `technical` learning with a stock title.
   - Deterministic, zero-dependency logic (<1 ms).

3. **Persistence Layer**
   - `extractAndSaveLearning()` wraps the extractor, assigns ULIDs, inserts into the DB, and returns the stored record.
   - `conversationService.getConversation()` pulls ordered messages to feed the extractor.

4. **Tests**
   - Unit tests for extractor and persistence.
   - Integration test spins up an in-memory DB, inserts a mini conversation, runs extraction, and asserts a learning row exists.

### Key Learnings

1. **Conversation Replay**: Having ordered `sequence` columns made reconstructing conversations trivial—no extra metadata needed.
2. **Predictable IDs**: Using ULIDs at persistence time ensures learning IDs remain sortable and unique without schema churn.
3. **Extensibility**: Keeping the extractor dead-simple now sets us up to plug in richer heuristics or AI later without touching storage.

### Next Steps

Moving to Level 10 (Basic MCP Server) so these stored learnings can be queried by external agents via the Model Context Protocol.

### Related Documents

- [Iterative Build Strategy](../plans/plan-iterative-build-strategy-2025-01-16.md)
- [Learning Extraction Architecture](../architecture/architecture-learning-extraction-2025-01-16.md)
- [Project Standards](../STANDARDS.md)

