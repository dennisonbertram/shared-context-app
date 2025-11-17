# Global Context Network - Project Standards

> **CRITICAL**: All documentation and code MUST follow these standards to ensure consistency across the entire system.

---
**Date**: 2025-01-16
**Status**: CANONICAL - These are the single source of truth for all project standards
**Authority**: Established from review feedback (GPT-5, Gemini 2.5 Pro) to resolve contradictions

---

## 1. Privacy & Data Flow Standard (MOST CRITICAL)

### Rule: NEVER Persist Raw Data

**Canonical Privacy Flow**:
```
User Input → Hook Receives Event (in-memory)
           → Fast Pre-Sanitization (<50ms, rule-based)
           → Persist ONLY Sanitized Content to Database
           → Optional AI Validation (async, downstream)
```

**What This Means**:
- ✅ **DO**: Pre-sanitize synchronously in hook using fast regex rules
- ✅ **DO**: Only write sanitized content to disk (messages table)
- ✅ **DO**: Use in-memory buffers if needed (exempt from persistence)
- ❌ **NEVER**: Persist raw content to SQLite (not even temporarily)
- ❌ **NEVER**: Write raw content to event_queue, events table, or any disk storage
- ❌ **NEVER**: Log raw content before sanitization

**Why**: Zero-trust PII handling. If raw data never touches disk, we can guarantee no PII leaks.

---

## 2. Schema Standard (CANONICAL)

### Official Tables

**Production Tables**:
1. `conversations` - Conversation metadata
2. `messages` - Individual messages (SANITIZED content only)
3. `learnings` - Extracted insights
4. `job_queue` - Async job processing
5. `uploads` - Network upload status
6. `sanitization_log` - Audit trail

**Eliminated Tables**:
- ❌ NO `events` table
- ❌ NO `event_queue` table
- **Rationale**: These implied raw content persistence. We write sanitized directly to `messages`.

### Data Flow

```
Hook (sanitize) → messages table (sanitized content)
                → job_queue (jobs for AI validation, learning extraction, upload)
```

---

## 3. Status Enum Standard (CANONICAL)

All async operations use this vocabulary:

```typescript
type JobStatus =
  | 'queued'        // Initial state
  | 'in_progress'   // Worker claimed
  | 'completed'     // Succeeded
  | 'failed'        // Failed but retriable
  | 'dead_letter';  // Failed permanently
```

**Usage**:
- `job_queue.status`: Uses this enum
- Upload status: Uses this enum
- Worker states: Uses this enum

**Eliminated Alternatives**:
- ❌ NO "pending/processing" (use queued/in_progress)
- ❌ NO "running/succeeded" (use in_progress/completed)
- ❌ NO "quarantined" (use dead_letter)

---

## 4. ID Strategy Standard (CANONICAL)

### Use ULID Globally

```typescript
import { ulid } from 'ulid';

// All IDs use ULID
const conversationId = ulid(); // Lexicographically sortable, chronological
const messageId = ulid();
const learningId = ulid();
```

**Why ULID over UUID**:
- Chronologically sortable
- Lexicographic ordering matches creation time
- No need for separate timestamps in indexes
- Better database index performance

**Eliminated**: UUID v4 (not sortable)

---

## 5. Hook Configuration Standard (CANONICAL)

### Config File Path
```
.claude/hooks.json
```
**NOT**: `.claude/hooks/hooks.json` (eliminated)

### Hook IO Method
```typescript
// Hooks receive events via stdin (JSON)
const event = JSON.parse(await readStdin());
```
**NOT**: `process.argv` (eliminated)

### Hook Format
```json
{
  "hooks": {
    "UserPromptSubmit": ".claude/hooks/dist/userPromptSubmit.js",
    "Stop": ".claude/hooks/dist/stop.js"
  }
}
```

**CRITICAL**:
- ✅ Point to compiled `.js` files (in `dist/` or `build/`)
- ❌ NEVER use ts-node at runtime (too slow for <100ms budget)
- ✅ Build step: `tsc` compiles TypeScript to JavaScript
- ✅ Hooks run compiled JS only

---

## 6. Chain-of-Thought Standard (CANONICAL)

### Rule: NEVER Capture Chain-of-Thought

**What We Capture**:
- ✅ User prompts
- ✅ Assistant responses (visible output)
- ✅ Tool calls and results
- ✅ File operations
- ✅ Error messages

**What We NEVER Capture**:
- ❌ Hidden chain-of-thought (internal reasoning)
- ❌ "Thinking" blocks (if present)
- ❌ Internal model reasoning traces

**Why**:
1. Provider policy compliance
2. Privacy concerns
3. No reliable access anyway (Claude Code doesn't expose it)

**Action**: Remove all references to "thinking processes" or "reasoning capture" from docs.

---

## 7. Timestamp Standard (CANONICAL)

### Use ISO-8601 Strings

```typescript
// All timestamps in database
created_at: '2025-01-16T12:00:00.000Z'  // ISO-8601 UTC string

// Generated via:
new Date().toISOString()
```

**Why**:
- Human-readable
- Standard format
- Timezone-aware (always UTC with Z)
- SQLite text column compatible

**Eliminated**: Unix epoch milliseconds (not human-readable)

---

## 8. Import Standards

### Performance Timing
```typescript
import { performance } from 'node:perf_hooks';

const start = performance.now();
// ... work ...
const duration = performance.now() - start;
```
**NOT**: `performance.now()` without import (will error)

### Database
```typescript
import Database from 'better-sqlite3';

const db = new Database('context.db');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
```

### IDs
```typescript
import { ulid } from 'ulid';

const id = ulid();
```

---

## 9. Sanitization Standard

### Fast Pre-Sanitization (In Hook)

**Budget**: <50ms (synchronous, rule-based)

**What to Redact**:
1. API keys (OpenAI, Anthropic, AWS, Google, GitHub, etc.)
2. Absolute file paths with usernames
3. Email addresses
4. IP addresses
5. Phone numbers
6. URLs with tokens/secrets
7. JWT tokens
8. Environment variable values
9. SSH keys, PEM blocks
10. Credit card numbers, SSNs

**Redaction Format**:
```typescript
"[REDACTED_API_KEY]"
"[REDACTED_EMAIL]"
"[REDACTED_PATH]"
"[REDACTED_IP]"
```

**Pseudonymization** (optional, session-scoped):
```typescript
"<EMAIL_1>", "<EMAIL_2>"  // Same email = same placeholder within session
"<PATH_1>", "<PATH_2>"    // Same path = same placeholder
```

### AI Validation (Async, Downstream)

**Budget**: <2s per conversation (async job)

**Purpose**:
- Catch context-aware PII (names that look like variables)
- Validate pre-sanitization caught everything
- Handle edge cases

**Not a replacement**: AI runs AFTER pre-sanitization, not instead of.

---

## 10. File Path Standards

### Hook Scripts
```
.claude/hooks/
  src/
    userPromptSubmit.ts
    stop.ts
  dist/              # Compiled output
    userPromptSubmit.js
    stop.js
  tsconfig.json
  package.json
```

### Project Structure
```
docs/
  architecture/
  decisions/
  plans/
  guides/
  reference/
  learnings/
  reviews/
src/
  hooks/
  sanitization/
  learning/
  mcp/
  database/
tests/
  unit/
  integration/
  e2e/
```

---

## 11. Testing Standards

### Coverage Requirements
- **Global**: ≥85% line coverage
- **Critical paths** (sanitization, hooks): ≥95% line + branch coverage
- **Learnings extraction**: ≥80%

### Test Types
- **70% Unit tests**: Isolated, fast, mocked
- **20% Integration tests**: Component interactions
- **10% E2E tests**: Full workflows

### Naming
```typescript
describe('sanitizeContent', () => {
  it('should redact API keys', () => {
    // arrange
    const input = 'key: sk-1234567890';

    // act
    const result = sanitizeContent(input);

    // assert
    expect(result).toBe('key: [REDACTED_API_KEY]');
  });
});
```

---

## 12. Performance Budgets

| Component | Budget | Measurement |
|-----------|--------|-------------|
| Hook execution | <100ms p95 | End-to-end (receive → sanitize → persist) |
| Fast sanitization | <50ms p95 | Regex-based rules only |
| Database writes | <20ms p95 | WAL-mode insert |
| Database queries | <100ms p95 | Indexed lookups |
| MCP queries | <200ms p95 | Search + serialization |
| AI sanitization | <2s p95 | Claude API call |
| Learning extraction | <5s p95 | Claude API call |

---

## 13. Error Handling Standards

### Hooks
```typescript
try {
  // Hook work
} catch (error) {
  // NEVER throw or block user
  logger.error('Hook failed', { error, event });
  // Fail silently
}
```

### Workers
```typescript
// Retry with exponential backoff
const maxAttempts = 3;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    await processJob(job);
    break;
  } catch (error) {
    if (attempt === maxAttempts) {
      await moveToDeadLetter(job, error);
    } else {
      await sleep(2 ** attempt * 1000);
    }
  }
}
```

---

## 14. Logging Standards

### Structured Logging
```typescript
logger.info('Event captured', {
  conversation_id: conversationId,
  message_id: messageId,
  role: 'user',
  content_length: sanitizedContent.length,  // NEVER log raw content
  duration_ms: duration
});
```

### Privacy in Logs
- ❌ NEVER log raw content
- ❌ NEVER log PII before sanitization
- ✅ Log sanitized content (optional, for debugging)
- ✅ Log metadata (IDs, lengths, durations)

---

## 15. Blockchain Standard (Clarified)

### EVM Chain Selection (Not Celestia)

**For MVP**:
- Target: Ethereum L2 (Base, Arbitrum, Optimism, or Polygon)
- **NOT Celestia**: Celestia is data availability layer, not EVM-compatible

**Celestia Usage** (optional, future):
- Can use for data availability (content commitments)
- Requires separate integration

**Clarification**:
- Smart contracts = EVM chain
- Data availability = Celestia
- Don't conflate the two

---

## 16. Consent & Licensing Standard

### Default Behavior
- **Default**: Local-only mode (no uploads)
- **Opt-in required**: User must explicitly enable global sharing
- **Manual approval gate**: Each upload requires confirmation (MVP)

### License for Learnings
- **Recommended**: CC BY 4.0 or ODC-By for shared learnings
- **Prohibited**: Sharing raw conversations (only derived learnings)

**ADR Required**: ADR-007 must formalize this

---

## 17. Documentation Standards

### File Naming
```
category-topic-YYYY-MM-DD.md

Examples:
- architecture-sanitization-pipeline-2025-01-16.md
- decision-use-ulid-2025-01-16.md
- guide-hook-development-2025-01-16.md
```

### Frontmatter (Required)
```yaml
---
title: Document Title
category: architecture|decision|plan|guide|reference|learning
date: 2025-01-16
status: active|draft|archived
authors: Name(s)
tags: [tag1, tag2]
---
```

### Cross-Linking
- Always link to related docs in "Related Documents" section
- Use relative paths: `../architecture/file.md`
- Update category INDEX.md when adding files

---

## 18. Code Standards

### TypeScript Strict Mode
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### No `any` Types
```typescript
// ❌ BAD
function process(data: any) { }

// ✅ GOOD
function process(data: unknown) {
  if (typeof data === 'string') {
    // Type guard
  }
}

// ✅ BETTER
interface EventData {
  role: string;
  content: string;
}
function process(data: EventData) { }
```

---

## Enforcement

### All New Documents MUST:
1. Reference this STANDARDS.md file
2. Use canonical schema (messages + job_queue)
3. Use canonical status enums (queued → in_progress → completed → failed → dead_letter)
4. Use ULID for all IDs
5. Follow privacy flow (pre-sanitize, never persist raw)
6. Exclude chain-of-thought universally
7. Use .claude/hooks.json path
8. Use compiled .js hooks
9. Use ISO-8601 timestamps
10. Follow performance budgets

### Review Checklist

Before any document is finalized:
- [ ] Uses canonical schema (no events/event_queue tables)
- [ ] Uses canonical status enums
- [ ] Uses ULID for IDs
- [ ] Pre-sanitizes in hook (never persists raw)
- [ ] Excludes chain-of-thought
- [ ] Uses .claude/hooks.json config path
- [ ] References compiled .js hooks (not ts-node)
- [ ] Uses ISO-8601 timestamps
- [ ] Performance budgets specified
- [ ] Privacy guarantees maintained

---

## Related Documents

- [ADR-004: Sanitize Before Storage](./decisions/decision-sanitize-before-storage-2025-01-16.md)
- [Database Schema Reference](./reference/reference-database-schema-2025-01-16.md)
- [Architecture: Hooks & Event Capture](./architecture/architecture-hooks-event-capture-2025-01-16.md)

---

*This document is the canonical source of truth for all project standards. When in doubt, refer here. If standards conflict with other docs, THIS document wins.*
