# Learning Log: Level 15 – End-to-End QA & Telemetry Hardening

**Date:** 2025-01-16  
**Status:** ✅ Complete

## Summary
- Added `src/e2e/full-flow.test.ts`, a black-box test that drives the compiled Claude hook (`.claude/hooks/dist/userPromptSubmit.js`) via STDIN, reuses the production job queue, and queries learnings through `searchLearnings`.
- The test asserts that all 12 PII placeholders are present in the stored conversation, that both `sanitize_async` jobs and the `extract_learning_ai` job complete, and that the learning is retrievable with the `code` keyword.

## What Changed
1. **E2E Fixture**
   - Spawns the hook with a temporary `DB_PATH`, writes user + assistant events, and then drains workers using `processNextSanitizationJob` / `processNextLearningJob`.
2. **MCP Validation**
   - Calls `searchLearnings(db, 'code', 5)` to mimic an MCP search request and ensures the new learning references the active conversation.
3. **Test Data**
   - Uses representative secrets (OpenAI/Anthropic keys, AWS access key, GitHub token, JWT, SSH block, credit card, SSN) to prove regex coverage in a production-like run.

## Incorrect Assumptions & Resolutions
- **Assumption:** Only one sanitization job would exist per conversation.  
  **Resolution:** The test now expects two `sanitize_async` jobs (one per message) plus the learning job.
- **Assumption:** `searchLearnings` accepted an options object.  
  **Resolution:** Updated to match the actual `(db, query, limit)` signature so the TypeScript compiler enforces correct usage.

## Verification
- `npm run test:once`
- `npm run lint`
- `npm run build`
- Manual hook rebuild: `cd .claude/hooks && npm run build`

## Next Steps
- Conduct the requested repository organization review before starting post-Level-15 tasks.

