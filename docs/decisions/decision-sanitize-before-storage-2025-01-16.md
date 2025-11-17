---
title: ADR-004: Sanitize Before Storage (Privacy-First Architecture)
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [privacy, security, pii, sanitization, zero-trust]
---

# ADR-004: Sanitize Before Storage (Privacy-First Architecture)

## Status

Accepted

Date: 2025-01-16

## Context

The Global Context Network captures user conversations with AI agents, which inevitably contain:
- **API keys and secrets** - Authentication tokens, passwords
- **Personal information** - Names, emails, phone numbers
- **File paths** - Absolute paths with usernames
- **IP addresses** - Network information
- **Organization-specific data** - Company names, project names
- **URLs with tokens** - Authentication in query params

This data will be:
1. Stored locally in SQLite database
2. Extracted for learning generation
3. Potentially shared globally via IPFS/blockchain
4. Queried by other AI agents via MCP

**The Risk**: If PII is stored unsanitized, it can leak through:
- Database breaches
- Accidental sharing
- Query results
- Learning extractions
- Global network uploads
- Developer debugging
- Log files

**Data Minimization Principle**: The safest PII is PII we never store. Once stored, it can spread through the system unpredictably.

**Zero-Trust Privacy**: We cannot trust that all downstream components will properly handle PII. The only safe approach is to never let PII enter storage.

## Decision

Sanitize ALL data BEFORE database insertion. Never store unsanitized conversation data.

**Architecture**:
```
Event Capture → Sanitization Pipeline → Database
                        ↑
                  (PII never passes this gate)
```

**Sanitization happens**:
- BEFORE any database write
- In the event queue processing worker
- Using hybrid detection (rules + AI)
- With audit trail of all redactions

**Sanitization methods**:
1. **Rule-based detector** - Fast regex for known patterns
2. **AI-powered detector** - Context-aware LLM analysis
3. **Hybrid validator** - Combines both approaches
4. **Audit logger** - Tracks what was redacted

**Redaction format**:
- Irreversible redaction by default
- Placeholder tokens: `<EMAIL_1>`, `<API_KEY_1>`, `<PERSON_1>`
- Optional per-session pseudonymization for within-session linking
- Separate encrypted mapping (if pseudonymization enabled)

## Consequences

### Positive

- **Zero-trust PII handling** - Database inherently safe
- **Safe default sharing** - No risk of accidental PII in learnings
- **Breach impact minimized** - No PII to steal
- **Compliance friendly** - Easier GDPR/CCPA alignment
- **Developer safety** - Devs can access database without PII exposure
- **Query safety** - MCP queries can't return PII
- **Audit trail** - Full log of what was redacted

### Negative

- **Irreversible** - Can't recover original data if over-redaction occurs
- **Async delay** - 1-2s sanitization delay before storage
- **False negatives risk** - May miss novel PII patterns
- **Utility loss** - Over-redaction reduces learning value
- **Complexity** - Hybrid pipeline is more complex than simple storage

### Neutral

- **Processing overhead** - Sanitization adds computational cost
- **Confidence thresholds** - Must tune detection sensitivity
- **Review workflow** - Borderline cases need manual review
- **Detector maintenance** - Must update PII patterns over time

## Alternatives Considered

### Alternative 1: Sanitize on Query

**Description**: Store raw data, sanitize when querying.

**Pros**:
- Can recover original data if needed
- Simpler storage path
- Faster writes

**Cons**:
- **Database contains PII** - Breach exposes everything
- **Too late** - PII already persisted and spread
- **Query bugs leak PII** - One bug exposes all data
- **Compliance risk** - Storing PII requires strict controls
- **Multiple sanitization points** - Must sanitize every query path

**Why not chosen**: Violates zero-trust principle. Database breach or query bug exposes all PII.

### Alternative 2: Sanitize on Upload Only

**Description**: Store raw locally, sanitize only for global sharing.

**Pros**:
- Local utility preserved
- Only sanitize what's shared
- Can debug with full data

**Cons**:
- **Local database contains PII** - User machine breach exposes PII
- **Accidental sharing risk** - One bug uploads raw data
- **Developer access risk** - Devs see PII during debugging
- **Log leakage** - Logs may contain PII
- **MCP queries return PII** - Agents see raw data

**Why not chosen**: Too many opportunities for PII leakage. Doesn't minimize data surface area.

### Alternative 3: Trust Users to Redact

**Description**: Provide UI for users to review and redact before storage.

**Pros**:
- User control
- High precision (users know what's sensitive)
- No false positives

**Cons**:
- **Users make mistakes** - Will forget to redact
- **Poor UX** - Friction on every interaction
- **Incomplete coverage** - Users miss subtle PII
- **Not scalable** - Can't review every conversation

**Why not chosen**: Users are not reliable. Automated approach required.

### Alternative 4: Encryption Only (No Redaction)

**Description**: Encrypt sensitive data, don't redact.

**Pros**:
- Reversible
- Data preserved
- Simple implementation

**Cons**:
- **Key management complexity** - Where to store keys?
- **Still have access to raw data** - Can decrypt when needed
- **Doesn't minimize surface** - PII still in system
- **Compliance unclear** - Encrypted PII may still be PII
- **Key leak exposes all** - Single point of failure

**Why not chosen**: Doesn't eliminate PII, just obscures it. Key management introduces new risks.

### Alternative 5: Layered Detection (Rules + ML NER + LLM)

**Description**: Use multiple detection layers: regex, ML NER models, LLM adjudicator.

**Pros**:
- Higher accuracy than single method
- Catches different PII types
- Reduces false negatives

**Cons**:
- More complex pipeline
- Higher latency
- More expensive (ML model + LLM calls)
- More maintenance

**Why not chosen**: **ACTUALLY CHOSEN** - This is the hybrid approach we're implementing (rules + LLM). Could add ML NER post-MVP for even better accuracy.

## Implementation

### PII Taxonomy

Define what we detect:

```typescript
enum PIICategory {
  API_KEY = "API_KEY",           // API keys, tokens, passwords
  EMAIL = "EMAIL",               // Email addresses
  PHONE = "PHONE",               // Phone numbers (all formats)
  SSN = "SSN",                   // Social Security Numbers
  CREDIT_CARD = "CREDIT_CARD",   // Credit card numbers
  IP_ADDRESS = "IP_ADDRESS",     // IPv4/IPv6 addresses
  MAC_ADDRESS = "MAC_ADDRESS",   // Hardware addresses
  PERSON_NAME = "PERSON_NAME",   // Human names (not code names)
  FILE_PATH = "FILE_PATH",       // Absolute paths with usernames
  URL_WITH_TOKEN = "URL_WITH_TOKEN", // URLs with auth params
  AWS_KEY = "AWS_KEY",           // AWS access keys
  PRIVATE_KEY = "PRIVATE_KEY",   // SSH/TLS private keys
  JWT = "JWT",                   // JSON Web Tokens
  ORGANIZATION = "ORGANIZATION"  // Company/org names
}
```

### Detection Patterns

```typescript
const piiPatterns = {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
  API_KEY: /\b(sk_live_|pk_live_|api_key_|apikey=)[A-Za-z0-9_-]{20,}\b/gi,
  AWS_KEY: /\b(AKIA[0-9A-Z]{16})\b/g,
  FILE_PATH: /\/Users\/[^\/\s]+\/.*|\/home\/[^\/\s]+\/.*/g,
  URL_WITH_TOKEN: /https?:\/\/[^\s]+[?&](token|key|auth|api_key)=[^\s&]+/gi,
  // ... more patterns
};
```

### Layered Detection Pipeline

```typescript
interface SanitizationResult {
  sanitized: string;
  detections: Detection[];
  confidence: number; // 0-1
  method: "rules" | "ai" | "hybrid";
}

interface Detection {
  category: PIICategory;
  original: string;
  placeholder: string;
  confidence: number;
  position: { start: number; end: number };
  detector: "rules" | "ai";
}

async function sanitize(text: string): Promise<SanitizationResult> {
  // Layer 1: Fast rule-based detection (< 10ms)
  const ruleDetections = detectWithRules(text);

  // Layer 2: AI-powered context-aware detection (< 2s)
  const aiDetections = await detectWithAI(text, ruleDetections);

  // Layer 3: Hybrid validator combines results
  const allDetections = mergeDetections(ruleDetections, aiDetections);

  // Layer 4: Apply redactions
  const sanitized = applyRedactions(text, allDetections);

  // Layer 5: Audit log
  await logSanitization(text, sanitized, allDetections);

  return {
    sanitized,
    detections: allDetections,
    confidence: calculateConfidence(allDetections),
    method: "hybrid"
  };
}
```

### Reversible Pseudonymization (Optional)

For within-session linking:

```typescript
interface PseudonymizationMapping {
  sessionId: string;
  mappings: Map<string, string>; // original → placeholder
  encrypted: boolean;
  ttl: number; // Auto-delete after N seconds
}

// Per-session mapping stored separately with envelope encryption
const sessionMapping = {
  sessionId: "conv-123",
  mappings: new Map([
    ["user@example.com", "<EMAIL_1>"],
    ["John Doe", "<PERSON_1>"]
  ]),
  encrypted: true,
  ttl: 86400 // 24 hours
};
```

### Confidence Thresholds

```typescript
interface SanitizationPolicy {
  minConfidence: number; // 0.8 = require 80% confidence
  reviewThreshold: number; // 0.6 = manual review if 60-80%
  blockThreshold: number; // 0.0 = block if any PII detected

  async handleBorderline(result: SanitizationResult): Promise<Action> {
    if (result.confidence < this.minConfidence) {
      if (result.confidence >= this.reviewThreshold) {
        return "QUARANTINE_FOR_REVIEW";
      } else {
        return "BLOCK_STORAGE";
      }
    }
    return "ALLOW_STORAGE";
  }
}
```

### Redaction Format with Entity Tags

```typescript
function applyRedactions(text: string, detections: Detection[]): string {
  let sanitized = text;
  const entityCounts = new Map<PIICategory, number>();

  // Sort by position (reverse) to maintain indices
  detections.sort((a, b) => b.position.start - a.position.start);

  for (const detection of detections) {
    // Increment counter for this entity type
    const count = (entityCounts.get(detection.category) || 0) + 1;
    entityCounts.set(detection.category, count);

    // Generate placeholder
    const placeholder = `<${detection.category}_${count}>`;

    // Replace
    sanitized =
      sanitized.slice(0, detection.position.start) +
      placeholder +
      sanitized.slice(detection.position.end);
  }

  return sanitized;
}
```

### Streaming Sanitization

Avoid buffering raw content:

```typescript
async function* streamingSanitize(
  eventStream: AsyncIterable<string>
): AsyncGenerator<string> {
  let buffer = "";

  for await (const chunk of eventStream) {
    buffer += chunk;

    // Process complete sentences
    const sentences = buffer.split(/[.!?]\s+/);
    buffer = sentences.pop() || ""; // Keep incomplete sentence

    for (const sentence of sentences) {
      const { sanitized } = await sanitize(sentence);
      yield sanitized + ". ";
    }
  }

  // Process remaining buffer
  if (buffer) {
    const { sanitized } = await sanitize(buffer);
    yield sanitized;
  }
}
```

### Evidence of Sanitization

Store metadata with every record:

```typescript
interface SanitizationEvidence {
  recordId: string;
  timestamp: string;
  detectorVersion: string; // "rules-v1.2 + ai-v2.0"
  detectionsCount: number;
  categoriesDetected: PIICategory[];
  confidence: number;
  reviewStatus: "auto" | "reviewed" | "quarantined";
  auditor: string; // "automated" | "human-reviewer-id"
}
```

### Right to Delete Process

Even for sanitized data:

```typescript
async function handleDeletionRequest(userId: string, conversationId: string) {
  // 1. Delete sanitized conversation
  await db.conversations.delete({ id: conversationId });

  // 2. Delete pseudonymization mappings
  await db.pseudonymMappings.delete({ conversationId });

  // 3. Delete derived learnings
  await db.learnings.delete({ sourceConversationId: conversationId });

  // 4. Add to revocation list for global network
  await db.revocations.insert({
    conversationId,
    timestamp: new Date(),
    reason: "user-requested-deletion"
  });

  // 5. If already uploaded, publish revocation
  const upload = await db.uploads.findOne({ conversationId });
  if (upload) {
    await publishRevocation(upload.ipfsCid);
  }
}
```

### Post-Ingest Audits

Continuous validation:

```typescript
async function runSanitizationAudit() {
  // Randomly sample stored conversations
  const samples = await db.conversations.sample(100);

  for (const conv of samples) {
    // Re-run detection on stored data
    const { detections } = await sanitize(conv.sanitizedContent);

    if (detections.length > 0) {
      // Found PII in supposedly sanitized data!
      await alert({
        severity: "CRITICAL",
        message: `PII found in stored conversation ${conv.id}`,
        detections
      });

      // Quarantine
      await db.conversations.update(conv.id, {
        status: "QUARANTINED",
        quarantineReason: "post-ingest-pii-detection"
      });
    }
  }
}

// Run nightly
schedule("0 2 * * *", runSanitizationAudit);
```

### Canary Scans

Inject known PII to verify detection:

```typescript
const canaryTests = [
  "My email is canary-test-001@example.com",
  "API key: sk_test_canary_12345",
  "My SSN is 123-45-6789",
  // ... more canaries
];

async function runCanaryTest() {
  for (const canary of canaryTests) {
    const { detections } = await sanitize(canary);

    if (detections.length === 0) {
      await alert({
        severity: "CRITICAL",
        message: "Sanitization canary test failed",
        canary
      });
    }
  }
}

// Run on every deployment
```

## Risks and Mitigations

### Risk: False Negatives (Missed PII)

**Impact**: Critical - Privacy violation

**Mitigation**:
- Layered detection (rules + AI)
- Post-ingest audits (random sampling)
- Canary tests for known patterns
- User reporting mechanism
- Kill-switch for publishing if issues found
- Continuous pattern updates

### Risk: Over-Redaction (Utility Loss)

**Impact**: Medium - Reduced learning value

**Mitigation**:
- Confidence thresholds (tune to balance precision/recall)
- Context-aware AI detection (distinguish names from code)
- Manual review queue for borderline cases
- Feedback loop to improve detection
- Metrics on redaction rate

### Risk: Novel PII Patterns

**Impact**: High - New PII types not detected

**Mitigation**:
- Continuous pattern updates
- AI detection catches unknowns
- User feedback
- Regular security audits
- Bug bounty for finding missed PII

## Related Documents

### Architecture
- [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md)
- [Global Context Network](../architecture/architecture-global-context-network-2025-01-16.md)

### Decisions
- [ADR-001: Use Claude Hooks](./decision-use-claude-hooks-2025-01-16.md)
- [ADR-005: Use SQLite](./decision-use-sqlite-2025-01-16.md)

### Plans
- [Phase 2: Sanitization Pipeline](../plans/plan-phase-2-sanitization-2025-01-16.md)

### Reference
- [PII Detection Patterns](../reference/reference-pii-patterns-2025-01-16.md)
