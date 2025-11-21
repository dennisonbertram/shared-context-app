# Global Learnings

> Centralized notes that cut across individual level logs.

## 2025-01-16

### Level 14 – Full Sanitization
- Maintaining a single `PII_PATTERNS` catalog (and mirroring it inside hooks) prevents silent drift between the fast sanitizer and the production hook.
- Tracking redaction counts + match metadata at the sanitizer layer gives observability hooks (workers, MCP) the ability to reason about privacy posture without re-running regexes.
- Performance stays <50 ms for a 12 KB prompt even with 12 regex families, so we can iterate on patterns safely before reaching for heavier AI validation.

### Level 15 – End-to-End QA
- Exercising the compiled hook via STDIN inside `src/e2e/full-flow.test.ts` is the closest approximation to Claude’s runtime we can achieve locally, so regressions surface before deploy.
- Draining both worker types in tests ensures job queue invariants (two `sanitize_async`, one `extract_learning_ai`) hold and that retries/dead-letter logic is observable.
- Querying `searchLearnings` after the worker run closes the privacy loop: sanitized content → AI validation → persisted learning → MCP search.

