# Plan: Sanitization Pipeline Architecture Document

**Date**: 2025-01-16
**Status**: Ready for GPT-5 Review
**Priority**: CRITICAL - Blocks implementation
**Target Doc**: `docs/architecture/architecture-sanitization-pipeline-2025-01-16.md`

---

## Context

This plan outlines the complete architecture document for the 2-stage sanitization pipeline. This is identified as the **MOST CRITICAL MISSING DOCUMENT** by external reviews (GPT-5 holistic + Gemini 2.5 Pro).

**Why This Matters**:
- Privacy is the #1 architectural principle
- Zero-trust PII handling requires perfect sanitization
- Contradiction exists: some docs show raw persistence vs STANDARDS.md mandate
- Implementation cannot start without this spec

**Critical Requirements from STANDARDS.md**:
1. Privacy flow: Pre-sanitize in hook (<50ms) → Persist ONLY sanitized → Optional AI validation (async)
2. NEVER persist raw content to disk
3. Schema: Write to `messages` table (no events/event_queue tables)
4. Redaction format: `[REDACTED_API_KEY]`, `[REDACTED_EMAIL]`, etc.
5. Performance: Fast sanitization <50ms, AI validation <2s

---

## Document Structure

### 1. Overview Section
**Purpose**: Executive summary and architectural principles

**Contents**:
- System purpose: Zero-trust PII protection before storage
- Core principle: "PII never touches disk"
- Privacy guarantee: If raw data never persists, no PII leaks possible
- Performance targets: <50ms synchronous, <2s async
- References to ADR-004 and STANDARDS.md

**ASCII Diagram - High-Level Flow**:
```
User Input → Hook Receives Event (in-memory)
           ↓
           Fast Pre-Sanitization (<50ms, rule-based)
           ↓
           Persist ONLY Sanitized Content (messages table)
           ↓
           Optional AI Validation (async, <2s, context-aware)
```

### 2. Architecture Components

#### 2.1 Stage 1: Fast Pre-Sanitization (Synchronous)

**Purpose**: Lightning-fast rule-based redaction in hook before disk write

**Performance Budget**:
- Target: <50ms p95
- Maximum: <80ms p99
- Method: Compiled regex patterns only
- Constraint: Must complete before database write

**Component Diagram**:
```
┌─────────────────────────────────────────────────┐
│          UserPromptSubmit Hook                   │
│  ┌───────────────────────────────────────────┐  │
│  │ 1. Receive event (stdin JSON)             │  │
│  │ 2. Extract content string                 │  │
│  │ 3. Run fastSanitize(content)              │  │
│  │    - Apply regex patterns sequentially    │  │
│  │    - Replace matches with redaction tags  │  │
│  │    - Track detections for audit           │  │
│  │ 4. Write sanitized to messages table      │  │
│  │ 5. Enqueue AI validation job (async)      │  │
│  │ 6. Return success (<50ms total)           │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**PII Taxonomy - Stage 1 (Rule-Based)**:
| Category | Pattern | Redaction Format | Example |
|----------|---------|------------------|---------|
| API Keys | `sk_live_`, `pk_live_`, `api_key_`, `AKIA`, etc. | `[REDACTED_API_KEY]` | `sk_live_abc123` → `[REDACTED_API_KEY]` |
| Email | RFC 5322 compliant regex | `[REDACTED_EMAIL]` | `user@example.com` → `[REDACTED_EMAIL]` |
| Phone | E.164 + common formats | `[REDACTED_PHONE]` | `+1-555-123-4567` → `[REDACTED_PHONE]` |
| IP Address | IPv4/IPv6 patterns | `[REDACTED_IP]` | `192.168.1.1` → `[REDACTED_IP]` |
| File Paths | `/Users/`, `/home/`, `C:\Users\` | `[REDACTED_PATH]` | `/Users/john/file.txt` → `[REDACTED_PATH]` |
| URLs with Tokens | `?token=`, `?api_key=`, `?auth=` | `[REDACTED_URL]` | `https://api.com?token=abc` → `[REDACTED_URL]` |
| JWT Tokens | `eyJ...` pattern | `[REDACTED_JWT]` | `eyJhbGciOi...` → `[REDACTED_JWT]` |
| SSH/PEM Keys | `-----BEGIN` blocks | `[REDACTED_PRIVATE_KEY]` | `-----BEGIN RSA...` → `[REDACTED_PRIVATE_KEY]` |
| Credit Cards | Luhn algorithm + common patterns | `[REDACTED_CREDIT_CARD]` | `4532-1234-5678-9010` → `[REDACTED_CREDIT_CARD]` |
| SSN | `XXX-XX-XXXX` pattern | `[REDACTED_SSN]` | `123-45-6789` → `[REDACTED_SSN]` |

**Regex Pattern Library** (TypeScript):
```typescript
// Fast, compiled patterns for Stage 1
export const FAST_PATTERNS = {
  API_KEY: /\b(sk_live_|pk_live_|sk_test_|pk_test_|api_key_|apikey=)[A-Za-z0-9_-]{20,}\b/gi,
  AWS_KEY: /\b(AKIA[0-9A-Z]{16})\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
  IP_V4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  FILE_PATH_UNIX: /(?:\/Users\/[^\/\s]+\/[^\s]*|\/home\/[^\/\s]+\/[^\s]*)/g,
  FILE_PATH_WIN: /C:\\Users\\[^\\]+\\[^\s]*/g,
  URL_WITH_TOKEN: /https?:\/\/[^\s]+[?&](token|key|auth|api_key|access_token)=[^\s&]+/gi,
  JWT: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  SSH_KEY: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]+?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g
} as const;
```

**Implementation - fastSanitize()**:
```typescript
import { performance } from 'node:perf_hooks';

interface SanitizationResult {
  sanitized: string;
  detections: Detection[];
  durationMs: number;
}

interface Detection {
  category: string;
  originalLength: number;
  position: number;
}

function fastSanitize(content: string): SanitizationResult {
  const start = performance.now();
  const detections: Detection[] = [];
  let sanitized = content;

  // Apply patterns in priority order (most critical first)
  const patterns = [
    { name: 'API_KEY', regex: FAST_PATTERNS.API_KEY, format: '[REDACTED_API_KEY]' },
    { name: 'AWS_KEY', regex: FAST_PATTERNS.AWS_KEY, format: '[REDACTED_AWS_KEY]' },
    { name: 'JWT', regex: FAST_PATTERNS.JWT, format: '[REDACTED_JWT]' },
    { name: 'SSH_KEY', regex: FAST_PATTERNS.SSH_KEY, format: '[REDACTED_PRIVATE_KEY]' },
    { name: 'CREDIT_CARD', regex: FAST_PATTERNS.CREDIT_CARD, format: '[REDACTED_CREDIT_CARD]' },
    { name: 'SSN', regex: FAST_PATTERNS.SSN, format: '[REDACTED_SSN]' },
    { name: 'EMAIL', regex: FAST_PATTERNS.EMAIL, format: '[REDACTED_EMAIL]' },
    { name: 'PHONE', regex: FAST_PATTERNS.PHONE, format: '[REDACTED_PHONE]' },
    { name: 'IP_V4', regex: FAST_PATTERNS.IP_V4, format: '[REDACTED_IP]' },
    { name: 'FILE_PATH_UNIX', regex: FAST_PATTERNS.FILE_PATH_UNIX, format: '[REDACTED_PATH]' },
    { name: 'FILE_PATH_WIN', regex: FAST_PATTERNS.FILE_PATH_WIN, format: '[REDACTED_PATH]' },
    { name: 'URL_WITH_TOKEN', regex: FAST_PATTERNS.URL_WITH_TOKEN, format: '[REDACTED_URL]' }
  ];

  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern.regex, (match, ...args) => {
      const offset = args[args.length - 2]; // Regex match offset
      detections.push({
        category: pattern.name,
        originalLength: match.length,
        position: offset
      });
      return pattern.format;
    });
  }

  const duration = performance.now() - start;

  // Log performance warning if over budget
  if (duration > 50) {
    console.warn(`[SANITIZE] Fast sanitization took ${duration}ms (budget: 50ms)`);
  }

  return {
    sanitized,
    detections,
    durationMs: duration
  };
}
```

**Error Handling**:
- If sanitization throws: Log error, write empty string to DB (fail-safe)
- If over time budget: Complete anyway, log warning, investigate pattern optimization
- Never block user: Hook must return within 100ms total (50ms sanitization + 20ms DB write + 30ms buffer)

#### 2.2 Stage 2: AI-Powered Validation (Asynchronous)

**Purpose**: Context-aware detection of PII that regex cannot catch

**Performance Budget**:
- Target: <2s p95 per conversation
- Method: Claude API call with specialized prompt
- Timing: Runs AFTER sanitized content persisted
- Non-blocking: User never waits for this

**Component Diagram**:
```
┌─────────────────────────────────────────────────┐
│          Async Worker Process                    │
│  ┌───────────────────────────────────────────┐  │
│  │ 1. Poll job_queue for sanitization jobs  │  │
│  │ 2. Fetch sanitized message from DB        │  │
│  │ 3. Call Claude API with validation prompt │  │
│  │ 4. Parse AI response for detections       │  │
│  │ 5. If PII found:                          │  │
│  │    - Re-sanitize with AI suggestions      │  │
│  │    - Update message in DB                 │  │
│  │    - Log to sanitization_log              │  │
│  │ 6. Mark job completed                     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**PII Taxonomy - Stage 2 (AI-Detected)**:
| Category | Detection Method | Example |
|----------|------------------|---------|
| Person Names | NER + context | "John Smith shared his code" → "[REDACTED_PERSON] shared his code" |
| Organization Names | Context-aware | "Acme Corp's API key" → "[REDACTED_ORG]'s API key" |
| Location/Address | Geographic context | "123 Main St, Springfield" → "[REDACTED_ADDRESS]" |
| Custom Identifiers | Heuristic patterns | "employee-id-12345" → "[REDACTED_IDENTIFIER]" |
| Contextual Secrets | Semantic analysis | "my password is correcthorsebattery" → "my password is [REDACTED_PASSWORD]" |

**AI Validation Prompt Template**:
```
You are a privacy protection system. Analyze the following text for personally identifiable information (PII) that was not caught by rule-based sanitization.

Text (already pre-sanitized with [REDACTED_*] tags):
---
{sanitized_content}
---

Identify any remaining PII in these categories:
1. Person names (not variable names or code identifiers)
2. Organization/company names
3. Physical addresses
4. Custom identifiers (employee IDs, account numbers)
5. Contextual secrets (passwords mentioned in prose)
6. Any other sensitive information

For each detection, provide:
- Category
- Exact text to redact
- Start/end position
- Confidence (0-1)
- Reasoning (why this is PII vs legitimate content)

Output JSON:
{
  "detections": [
    {
      "category": "PERSON_NAME",
      "text": "John Smith",
      "start": 45,
      "end": 55,
      "confidence": 0.95,
      "reasoning": "Proper name in context 'John Smith shared', not a code variable"
    }
  ]
}
```

**AI Response Processing**:
```typescript
interface AIDetection {
  category: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  reasoning: string;
}

async function aiValidate(messageId: string, sanitizedContent: string): Promise<void> {
  const start = performance.now();

  try {
    // Call Claude API
    const response = await claudeClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0, // Deterministic for privacy
      messages: [
        {
          role: 'user',
          content: AI_VALIDATION_PROMPT.replace('{sanitized_content}', sanitizedContent)
        }
      ]
    });

    // Parse detections
    const result = JSON.parse(response.content[0].text);
    const detections: AIDetection[] = result.detections || [];

    // Filter by confidence threshold
    const highConfidence = detections.filter(d => d.confidence >= 0.8);

    if (highConfidence.length > 0) {
      // Re-sanitize with AI detections
      let reSanitized = sanitizedContent;
      for (const detection of highConfidence.reverse()) { // Reverse to maintain positions
        const redactionTag = `[REDACTED_${detection.category}]`;
        reSanitized =
          reSanitized.slice(0, detection.start) +
          redactionTag +
          reSanitized.slice(detection.end);
      }

      // Update message in database
      await db.prepare(`
        UPDATE messages
        SET content = ?, ai_validated = 1, ai_detections = ?
        WHERE id = ?
      `).run(reSanitized, JSON.stringify(highConfidence), messageId);

      // Log to audit trail
      await db.prepare(`
        INSERT INTO sanitization_log (message_id, stage, detections, timestamp)
        VALUES (?, 'ai_validation', ?, ?)
      `).run(messageId, JSON.stringify(highConfidence), new Date().toISOString());
    } else {
      // No additional PII found
      await db.prepare(`
        UPDATE messages SET ai_validated = 1 WHERE id = ?
      `).run(messageId);
    }

    const duration = performance.now() - start;
    console.log(`[AI VALIDATE] Completed in ${duration}ms, found ${highConfidence.length} issues`);

  } catch (error) {
    console.error('[AI VALIDATE] Failed:', error);
    // Don't fail the message - it's already pre-sanitized
    await db.prepare(`
      UPDATE messages SET ai_validated = 0, ai_error = ? WHERE id = ?
    `).run(error.message, messageId);
  }
}
```

**Cost Management**:
- Only validate new conversations (not every message)
- Batch multiple messages per API call when possible
- Set max tokens to control cost
- Track spending via job_queue metadata

### 3. Data Flow & Integration

#### 3.1 Complete Privacy Flow

**End-to-End Diagram**:
```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User submits prompt in Claude Code                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. UserPromptSubmit Hook triggered                                  │
│    - Receives event via stdin (JSON)                                │
│    - Event contains: { role: 'user', content: 'raw text...' }       │
│    - Raw content ONLY in memory (never written to disk)             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Fast Pre-Sanitization (Stage 1)                                  │
│    const { sanitized, detections } = fastSanitize(event.content)    │
│    - Applies regex patterns                                         │
│    - Returns sanitized string + detection metadata                  │
│    - Duration: <50ms                                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Persist ONLY Sanitized Content                                   │
│    INSERT INTO messages (id, conversation_id, role, content, ...)   │
│    VALUES (?, ?, 'user', sanitized, ...)                            │
│    - Raw content NEVER written to disk                              │
│    - Only sanitized string persisted                                │
│    - Duration: <20ms (WAL mode)                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Enqueue AI Validation Job (Async)                                │
│    INSERT INTO job_queue (type, payload, status)                    │
│    VALUES ('ai_sanitization_validation',                            │
│            JSON({ message_id }), 'queued')                          │
│    - Non-blocking                                                   │
│    - User interaction continues                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Hook Returns Success                                             │
│    - Total time: <100ms (50ms sanitize + 20ms DB + 30ms overhead)   │
│    - User never blocked                                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ (Meanwhile, async worker runs...)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Async Worker: AI Validation (Stage 2)                            │
│    - Polls job_queue for 'queued' jobs                              │
│    - Fetches sanitized message from messages table                  │
│    - Calls Claude API with validation prompt                        │
│    - If additional PII found: re-sanitize and update DB             │
│    - Marks job 'completed'                                          │
│    - Duration: <2s (non-blocking to user)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. Final State: Fully Sanitized Message in DB                       │
│    - messages.content = fully sanitized text                        │
│    - messages.ai_validated = 1                                      │
│    - sanitization_log = audit trail                                 │
│    - GUARANTEE: No PII on disk                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.2 Schema Integration (Per STANDARDS.md)

**Messages Table** (sanitized content only):
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,                 -- ULID
  conversation_id TEXT NOT NULL,       -- ULID
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,               -- SANITIZED content (never raw)
  sequence INTEGER NOT NULL,

  -- Sanitization metadata
  pre_sanitized INTEGER DEFAULT 1,     -- Always 1 (all messages pre-sanitized)
  ai_validated INTEGER DEFAULT 0,      -- 1 after Stage 2 validation
  ai_detections TEXT,                  -- JSON array of AI-found issues
  ai_error TEXT,                       -- Error message if AI validation failed

  -- Timestamps
  created_at TEXT NOT NULL,            -- ISO-8601 UTC

  -- Constraints
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, sequence);
CREATE INDEX idx_messages_ai_pending ON messages(ai_validated) WHERE ai_validated = 0;
```

**Sanitization Log Table** (audit trail):
```sql
CREATE TABLE sanitization_log (
  id TEXT PRIMARY KEY,                 -- ULID
  message_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('pre_sanitization', 'ai_validation')),
  detections TEXT NOT NULL,            -- JSON array of Detection objects
  timestamp TEXT NOT NULL,             -- ISO-8601 UTC

  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX idx_sanitization_log_message ON sanitization_log(message_id);
CREATE INDEX idx_sanitization_log_stage ON sanitization_log(stage, timestamp);
```

**Job Queue Table** (async processing):
```sql
CREATE TABLE job_queue (
  id TEXT PRIMARY KEY,                 -- ULID
  type TEXT NOT NULL CHECK(type IN ('ai_sanitization_validation', 'learning_extraction', 'network_upload')),
  payload TEXT NOT NULL,               -- JSON with job-specific data
  status TEXT NOT NULL CHECK(status IN ('queued', 'in_progress', 'completed', 'failed', 'dead_letter')),

  -- Retry handling
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error TEXT,

  -- Timestamps
  created_at TEXT NOT NULL,            -- ISO-8601 UTC
  started_at TEXT,
  completed_at TEXT,

  -- Scheduling
  scheduled_for TEXT,                  -- ISO-8601 UTC (for delayed jobs)
  priority INTEGER DEFAULT 5           -- 1 (high) to 10 (low)
);

CREATE INDEX idx_job_queue_status ON job_queue(status, scheduled_for, priority);
CREATE INDEX idx_job_queue_type ON job_queue(type, status);
```

**NO events or event_queue tables** - eliminated per STANDARDS.md

### 4. Performance Characteristics

#### 4.1 Performance Budgets

| Component | Budget | Measurement | Notes |
|-----------|--------|-------------|-------|
| Hook execution (total) | <100ms p95 | End-to-end UserPromptSubmit hook | Includes all stages |
| Fast sanitization | <50ms p95 | fastSanitize() function | Rule-based regex only |
| Database write | <20ms p95 | INSERT into messages | WAL mode enabled |
| AI validation | <2s p95 | Claude API call + processing | Async, non-blocking |
| Job queue poll | <100ms p95 | SELECT pending jobs | Worker loop |

#### 4.2 Benchmarking Strategy

**Unit Benchmarks**:
```typescript
// Benchmark each regex pattern individually
for (const [name, pattern] of Object.entries(FAST_PATTERNS)) {
  const iterations = 10000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    TEST_CORPUS.replace(pattern, '[REDACTED]');
  }

  const avgMs = (performance.now() - start) / iterations;
  console.log(`Pattern ${name}: ${avgMs}ms per iteration`);

  assert(avgMs < 0.005, `Pattern ${name} too slow: ${avgMs}ms`); // 5μs max per pattern
}
```

**Integration Benchmarks**:
```typescript
// Benchmark full fastSanitize() with realistic data
const testCases = [
  { name: 'Small (100 chars)', content: '...' },
  { name: 'Medium (1KB)', content: '...' },
  { name: 'Large (10KB)', content: '...' },
  { name: 'Mixed PII', content: '...' }
];

for (const testCase of testCases) {
  const iterations = 1000;
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const { durationMs } = fastSanitize(testCase.content);
    durations.push(durationMs);
  }

  const p50 = percentile(durations, 0.5);
  const p95 = percentile(durations, 0.95);
  const p99 = percentile(durations, 0.99);

  console.log(`${testCase.name}: p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`);

  assert(p95 < 50, `${testCase.name} p95 over budget: ${p95}ms`);
}
```

**End-to-End Benchmarks**:
```typescript
// Benchmark full hook execution (sanitize + DB write)
async function benchmarkHook(eventPayload: HookEvent) {
  const start = performance.now();

  // Simulate hook execution
  const { sanitized, detections } = fastSanitize(eventPayload.content);

  await db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, sequence, created_at, pre_sanitized)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(
    ulid(),
    eventPayload.conversation_id,
    eventPayload.role,
    sanitized,
    eventPayload.sequence,
    new Date().toISOString()
  );

  const totalMs = performance.now() - start;
  return totalMs;
}

// Run 1000 iterations
const durations = await Promise.all(
  Array(1000).fill(0).map(() => benchmarkHook(generateTestEvent()))
);

const p95 = percentile(durations, 0.95);
console.log(`Hook p95: ${p95}ms`);
assert(p95 < 100, `Hook p95 over budget: ${p95}ms`);
```

### 5. Security & Privacy Guarantees

#### 5.1 Privacy Invariants

**Invariant 1: Raw Content Never Persists**
```
∀ event ∈ EventStream:
  IF event.content contains PII
  THEN messages.content = sanitize(event.content)
  AND sanitize(x) contains NO PII
```

**Verification**:
```typescript
// Privacy canary test
async function testPrivacyInvariant() {
  const piiContent = "My email is test@example.com and API key is sk_live_abc123xyz";

  // Simulate hook processing
  const { sanitized } = fastSanitize(piiContent);

  // Persist (simulating hook behavior)
  const messageId = ulid();
  await db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, sequence, created_at, pre_sanitized)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(messageId, ulid(), 'user', sanitized, 1, new Date().toISOString());

  // Verify: Fetch from DB and check for PII
  const stored = await db.prepare(`SELECT content FROM messages WHERE id = ?`).get(messageId);

  assert(!stored.content.includes('test@example.com'), 'Email leaked to database!');
  assert(!stored.content.includes('sk_live_abc123xyz'), 'API key leaked to database!');
  assert(stored.content.includes('[REDACTED_EMAIL]'), 'Email not redacted');
  assert(stored.content.includes('[REDACTED_API_KEY]'), 'API key not redacted');
}
```

**Invariant 2: In-Memory Only for Raw Content**
```
∀ event ∈ EventStream:
  raw_content ∈ Memory(Hook Process)
  AND raw_content ∉ Disk(Database)
  AND raw_content ∉ Disk(Logs)
  AND raw_content ∉ Disk(Temporary Files)
```

**Verification**:
- No code writes raw content to SQLite
- No logs include raw content (only metadata)
- No temporary files created with raw content
- Hook process memory clears on exit

**Invariant 3: Sanitization Before Any Persistence**
```
∀ write_operation ∈ DatabaseWrites:
  write_operation MUST be preceded by sanitize_operation
  AND sanitize_operation completes before write_operation
```

**Verification**:
```typescript
// Code review enforcement: All INSERT/UPDATE to messages must use sanitized content
// Static analysis rule: Grep for "INSERT INTO messages" and verify preceding sanitize() call

// Example enforcement in schema:
CREATE TRIGGER enforce_sanitization
BEFORE INSERT ON messages
FOR EACH ROW
WHEN NEW.pre_sanitized != 1
BEGIN
  SELECT RAISE(ABORT, 'Cannot insert unsanitized message');
END;
```

#### 5.2 Audit Trail

**Every sanitization operation logged**:
```typescript
async function logSanitization(
  messageId: string,
  stage: 'pre_sanitization' | 'ai_validation',
  detections: Detection[]
) {
  await db.prepare(`
    INSERT INTO sanitization_log (id, message_id, stage, detections, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    ulid(),
    messageId,
    stage,
    JSON.stringify(detections),
    new Date().toISOString()
  );
}
```

**Audit queries**:
```sql
-- How many PII instances detected in last 24 hours?
SELECT
  stage,
  json_each.value->>'category' as category,
  COUNT(*) as count
FROM sanitization_log,
     json_each(detections)
WHERE timestamp > datetime('now', '-1 day')
GROUP BY stage, category;

-- Which messages had most PII?
SELECT
  message_id,
  COUNT(*) as detection_count
FROM sanitization_log,
     json_each(detections)
GROUP BY message_id
ORDER BY detection_count DESC
LIMIT 10;

-- AI validation coverage
SELECT
  COUNT(*) FILTER (WHERE ai_validated = 1) * 100.0 / COUNT(*) as pct_validated
FROM messages;
```

### 6. Error Handling & Edge Cases

#### 6.1 Sanitization Failures

**Scenario 1: Regex compilation error**
```typescript
// Graceful fallback if pattern fails
try {
  sanitized = content.replace(FAST_PATTERNS.API_KEY, '[REDACTED_API_KEY]');
} catch (error) {
  console.error('[SANITIZE] Pattern failed:', error);
  // Fail-safe: Redact entire message rather than risk PII leak
  sanitized = '[ERROR: Message blocked for safety]';
  await logError('regex_failure', { pattern: 'API_KEY', error });
}
```

**Scenario 2: Performance timeout**
```typescript
// If sanitization takes >80ms, log warning but complete anyway
if (durationMs > 80) {
  console.warn('[SANITIZE] Over budget:', { durationMs, contentLength: content.length });
  await metrics.increment('sanitization.timeout', { durationMs });
}
// Don't throw - complete the operation
```

**Scenario 3: Out of memory**
```typescript
// For extremely large content (>1MB), reject
if (content.length > 1_000_000) {
  throw new Error('Content too large for sanitization (>1MB)');
  // Hook will catch this and log error, not persist message
}
```

#### 6.2 AI Validation Failures

**Scenario 1: Claude API timeout**
```typescript
try {
  const response = await claudeClient.messages.create({
    // ... params
    timeout: 10000 // 10 second timeout
  });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('[AI VALIDATE] Timeout:', error);
    // Message already pre-sanitized, so this is enhancement only
    // Mark as failed validation, retry later
    await updateJob(jobId, { status: 'failed', error: error.message, attempts: attempts + 1 });
    return;
  }
  throw error;
}
```

**Scenario 2: API rate limit**
```typescript
// Exponential backoff with max 3 retries
const maxRetries = 3;
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return await claudeClient.messages.create({ /* ... */ });
  } catch (error) {
    if (error.status === 429) { // Rate limit
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.warn(`[AI VALIDATE] Rate limited, retry in ${delayMs}ms`);
      await sleep(delayMs);
      continue;
    }
    throw error;
  }
}
// After 3 retries, move to dead_letter queue
await updateJob(jobId, { status: 'dead_letter', error: 'Rate limit exceeded after retries' });
```

**Scenario 3: AI returns invalid JSON**
```typescript
try {
  const result = JSON.parse(response.content[0].text);
} catch (error) {
  console.error('[AI VALIDATE] Invalid JSON response:', error);
  // Log the raw response for debugging
  await logError('ai_invalid_json', { response: response.content[0].text, error });
  // Skip AI detections, message already pre-sanitized
  await updateMessage(messageId, { ai_validated: 0, ai_error: 'Invalid AI response' });
}
```

### 7. Testing Strategy

#### 7.1 Unit Tests

**Fast Sanitization Tests**:
```typescript
describe('fastSanitize', () => {
  it('should redact API keys', () => {
    const input = 'My key is sk_live_abc123xyz456789012345';
    const { sanitized, detections } = fastSanitize(input);

    expect(sanitized).toBe('My key is [REDACTED_API_KEY]');
    expect(detections).toHaveLength(1);
    expect(detections[0].category).toBe('API_KEY');
  });

  it('should redact multiple PII types', () => {
    const input = 'Email: test@example.com, Phone: 555-123-4567, IP: 192.168.1.1';
    const { sanitized } = fastSanitize(input);

    expect(sanitized).toBe('Email: [REDACTED_EMAIL], Phone: [REDACTED_PHONE], IP: [REDACTED_IP]');
  });

  it('should complete within 50ms for 10KB content', () => {
    const input = generateLargeContent(10_000); // 10KB
    const { durationMs } = fastSanitize(input);

    expect(durationMs).toBeLessThan(50);
  });

  it('should handle edge cases without crashing', () => {
    const edgeCases = [
      '',                          // Empty string
      'a'.repeat(100_000),        // Large content
      '🔑 sk_live_émoji123',      // Unicode
      null,                        // Null (should throw)
      undefined                    // Undefined (should throw)
    ];

    for (const testCase of edgeCases) {
      expect(() => fastSanitize(testCase)).not.toThrow();
    }
  });
});
```

**AI Validation Tests**:
```typescript
describe('aiValidate', () => {
  it('should detect person names missed by regex', async () => {
    const sanitized = 'John Smith shared his API credentials'; // Name not in regex
    const messageId = await createTestMessage(sanitized);

    await aiValidate(messageId, sanitized);

    const updated = await getMessage(messageId);
    expect(updated.content).toContain('[REDACTED_PERSON]');
    expect(updated.ai_validated).toBe(1);
  });

  it('should not re-sanitize if no additional PII found', async () => {
    const sanitized = 'The function returns [REDACTED_API_KEY] as output';
    const messageId = await createTestMessage(sanitized);

    await aiValidate(messageId, sanitized);

    const updated = await getMessage(messageId);
    expect(updated.content).toBe(sanitized); // Unchanged
    expect(updated.ai_validated).toBe(1);
  });

  it('should handle API failures gracefully', async () => {
    // Mock API to throw error
    claudeClient.messages.create.mockRejectedValue(new Error('API timeout'));

    const messageId = await createTestMessage('test content');
    await aiValidate(messageId, 'test content');

    const updated = await getMessage(messageId);
    expect(updated.ai_validated).toBe(0);
    expect(updated.ai_error).toContain('API timeout');
  });
});
```

#### 7.2 Integration Tests

**End-to-End Privacy Test**:
```typescript
describe('Privacy Guarantee', () => {
  it('should never persist raw PII to database', async () => {
    const rawContent = `
      User details:
      Email: user@example.com
      Phone: +1-555-123-4567
      API Key: sk_live_abc123xyz456
      AWS Key: AKIAIOSFODNN7EXAMPLE
      File: /Users/john/secret.txt
    `;

    // Simulate hook execution
    const event = {
      role: 'user',
      content: rawContent,
      conversation_id: ulid(),
      sequence: 1
    };

    // Process through hook
    await userPromptSubmitHook(event);

    // Verify: Check database for any PII
    const messages = await db.prepare(`
      SELECT content FROM messages WHERE conversation_id = ?
    `).all(event.conversation_id);

    for (const msg of messages) {
      // Assert NO raw PII in database
      expect(msg.content).not.toContain('user@example.com');
      expect(msg.content).not.toContain('555-123-4567');
      expect(msg.content).not.toContain('sk_live_abc123xyz456');
      expect(msg.content).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(msg.content).not.toContain('/Users/john/secret.txt');

      // Assert redaction tags present
      expect(msg.content).toContain('[REDACTED_EMAIL]');
      expect(msg.content).toContain('[REDACTED_PHONE]');
      expect(msg.content).toContain('[REDACTED_API_KEY]');
      expect(msg.content).toContain('[REDACTED_AWS_KEY]');
      expect(msg.content).toContain('[REDACTED_PATH]');
    }
  });
});
```

**Performance Integration Test**:
```typescript
describe('Performance Budgets', () => {
  it('should complete hook execution in <100ms', async () => {
    const durations: number[] = [];

    for (let i = 0; i < 100; i++) {
      const event = generateTestEvent();
      const start = performance.now();

      await userPromptSubmitHook(event);

      const duration = performance.now() - start;
      durations.push(duration);
    }

    const p95 = percentile(durations, 0.95);
    expect(p95).toBeLessThan(100);
  });
});
```

#### 7.3 Adversarial Tests

**Obfuscated PII**:
```typescript
describe('Adversarial Sanitization', () => {
  it('should catch obfuscated email addresses', () => {
    const inputs = [
      'user@example.com',           // Normal
      'user [at] example [dot] com', // Obfuscated
      'user(at)example(dot)com',    // Alternative
      'user AT example DOT com'     // Caps
    ];

    for (const input of inputs) {
      const { sanitized } = fastSanitize(input);
      // First pattern should catch, others may need AI
      expect(sanitized).toContain('[REDACTED');
    }
  });

  it('should catch API keys with mixed case', () => {
    const inputs = [
      'sk_live_abc123',
      'SK_LIVE_ABC123',
      'Sk_Live_Abc123'
    ];

    for (const input of inputs) {
      const { sanitized } = fastSanitize(input);
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    }
  });
});
```

### 8. Operational Considerations

#### 8.1 Monitoring & Alerts

**Key Metrics**:
```typescript
// Performance metrics
metrics.timing('sanitization.fast.duration_ms', durationMs);
metrics.timing('sanitization.ai.duration_ms', durationMs);
metrics.timing('hook.total_duration_ms', totalMs);

// Detection metrics
metrics.increment('sanitization.detections', { category: detection.category });
metrics.increment('sanitization.ai.additional_detections');

// Error metrics
metrics.increment('sanitization.errors', { error_type: 'regex_failure' });
metrics.increment('sanitization.ai.errors', { error_type: 'api_timeout' });

// Coverage metrics
metrics.gauge('sanitization.ai_validation_rate', validatedCount / totalCount);
```

**Alerts**:
- Hook p95 latency > 100ms → Page on-call
- Fast sanitization p95 > 50ms → Warning
- AI validation failure rate > 10% → Investigation
- Zero detections for 1 hour → Potential sanitization bypass

#### 8.2 Maintenance & Updates

**Pattern Updates**:
```typescript
// Versioned pattern library
export const PATTERN_VERSIONS = {
  'v1.0': { /* initial patterns */ },
  'v1.1': { /* added AWS keys */ },
  'v1.2': { /* improved email regex */ }
} as const;

// Current version
export const CURRENT_PATTERN_VERSION = 'v1.2';

// Migration path
async function migratePatterns(fromVersion: string, toVersion: string) {
  // Re-sanitize messages that used old patterns
  const messages = await db.prepare(`
    SELECT id, content FROM messages
    WHERE pattern_version = ?
  `).all(fromVersion);

  for (const msg of messages) {
    const { sanitized } = fastSanitize(msg.content); // Uses new patterns
    await db.prepare(`
      UPDATE messages
      SET content = ?, pattern_version = ?
      WHERE id = ?
    `).run(sanitized, toVersion, msg.id);
  }
}
```

**AI Prompt Updates**:
```typescript
// Versioned prompts
export const AI_PROMPT_VERSIONS = {
  'v1.0': { /* initial prompt */ },
  'v1.1': { /* improved reasoning instructions */ }
} as const;

// A/B testing new prompts
async function abTestPrompt(messageId: string, content: string) {
  const useNewPrompt = Math.random() < 0.1; // 10% traffic
  const promptVersion = useNewPrompt ? 'v1.1' : 'v1.0';

  const result = await aiValidate(messageId, content, promptVersion);

  // Track metrics by version
  metrics.increment('ai.detections', { version: promptVersion, count: result.detections.length });
}
```

### 9. Future Enhancements

#### 9.1 Machine Learning NER (Post-MVP)

**Add Transformer-based NER** for better person/org detection:
```
Stage 1.5: ML NER (between regex and AI)
- Use spaCy or Hugging Face model
- Detect: PERSON, ORG, GPE (location)
- Budget: <200ms (still synchronous)
- Trade-off: Better accuracy vs added latency
```

#### 9.2 Pseudonymization (Optional)

**Within-session linking** while preserving privacy:
```typescript
// Map PII to consistent placeholders per session
const sessionMapping = new Map<string, string>();

function pseudonymize(pii: string, category: string): string {
  if (sessionMapping.has(pii)) {
    return sessionMapping.get(pii)!;
  }

  const placeholder = `<${category}_${sessionMapping.size + 1}>`;
  sessionMapping.set(pii, placeholder);
  return placeholder;
}

// Example:
// "John emailed john@example.com" → "<PERSON_1> emailed <EMAIL_1>"
// "John called Mary" → "<PERSON_1> called <PERSON_2>"
```

#### 9.3 Differential Privacy (Research)

**Add noise to prevent re-identification**:
- Aggregate statistics only (no individual queries)
- K-anonymity guarantees
- Research application for learning extraction

---

## Success Criteria

This architecture document will be considered complete when:

1. **Alignment with STANDARDS.md**: 100% consistency with canonical flow, schema, enums
2. **Privacy Guarantee**: Clear proof that raw PII never persists
3. **Implementation Ready**: Developers can implement both stages from this spec
4. **Performance Targets**: Explicit budgets with measurement strategy
5. **Testing Coverage**: Comprehensive test strategy for privacy and performance
6. **Integration Clear**: Shows how sanitization fits with hooks, DB, job queue
7. **GPT-5 Validated**: External review confirms no contradictions or gaps

---

## Next Steps

1. **Get GPT-5 Review** (Now):
   - Share this plan + repomix project context
   - Ask: "Does this architecture align with STANDARDS.md and ADR-004?"
   - Ask: "Are there any gaps, contradictions, or missing components?"
   - Ask: "Will this provide zero-PII-leakage guarantee?"

2. **Incorporate Feedback**:
   - Address any issues raised
   - Refine sections as needed

3. **Create Final Document**:
   - Write `docs/architecture/architecture-sanitization-pipeline-2025-01-16.md`
   - Include all diagrams, code samples, and specifications
   - Cross-link to STANDARDS.md, ADR-004, and related docs

4. **Update INDEX**:
   - Add to `docs/architecture/INDEX.md`
   - Update references in other docs

---

## GPT-5 Review Request

**Prompt for GPT-5**:

```
You are reviewing a sanitization pipeline architecture plan for a privacy-first system that captures AI conversations.

CONTEXT:
- Full project context: [attach project-context-repomix-2025-01-16.txt]
- STANDARDS.md: Canonical source of truth for all standards
- ADR-004: Privacy decision - sanitize before storage
- Critical issue: Some docs show raw persistence (contradiction)

REQUIREMENTS:
1. Privacy flow MUST be: Pre-sanitize (<50ms) → Persist ONLY sanitized → Optional AI validation (async)
2. Raw content NEVER persists to disk
3. Schema uses `messages` table (no events/event_queue)
4. Performance: <50ms pre-sanitization, <2s AI validation
5. Redaction format: [REDACTED_API_KEY], [REDACTED_EMAIL], etc.

REVIEW THIS PLAN:
[attach this plan document]

QUESTIONS:
1. Does this architecture align 100% with STANDARDS.md and ADR-004?
2. Are there any contradictions with the canonical privacy flow?
3. Will this guarantee zero PII leakage to disk?
4. Are there any missing components or edge cases?
5. Is the performance budget realistic and achievable?
6. Are the integration points with hooks/DB/job_queue clear?
7. Is the testing strategy sufficient to prove privacy guarantees?

Please provide:
- Alignment assessment (pass/fail with specific issues)
- Gap analysis (what's missing)
- Risk assessment (what could go wrong)
- Recommendations for improvements
```

---

**Document Status**: Ready for GPT-5 review
**Created**: 2025-01-16
**Author**: Claude (based on STANDARDS.md, ADR-004, and external reviews)
