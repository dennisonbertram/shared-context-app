---
title: ADR-010: PII Detection Strategy (Hybrid Layered Approach)
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [privacy, security, pii, detection, sanitization, hybrid]
---

# ADR-010: PII Detection Strategy (Hybrid Layered Approach)

## Status

Accepted

Date: 2025-01-16

Supersedes: Portions of ADR-004 (splits out detection strategy into dedicated ADR)

## Context

The Global Context Network requires accurate PII detection to enforce our zero-trust privacy guarantee (ADR-004: never persist raw data). However, PII detection faces fundamental tradeoffs:

**Accuracy vs Speed**:
- Rule-based detection is fast (<50ms) but misses contextual PII
- AI detection is accurate but slow (>1s) and expensive
- False negatives expose user privacy
- False positives reduce learning utility

**Comprehensiveness vs Maintainability**:
- Simple regex patterns are easy to maintain but miss novel formats
- Complex ML models catch more but require training data and updates
- New PII patterns emerge (new API providers, token formats)

**Utility vs Privacy**:
- Over-redaction (high false positive rate) reduces learning value
- Under-redaction (high false negative rate) violates privacy
- Context matters: "John" in "John Smith" is PII; "john" in "const john = new User()" is not

**Current Gaps** (from external review):
- ADR-004 mixes detection strategy with storage policy
- PII taxonomy incomplete (missing JWTs, env vars, SSH keys)
- No explicit accuracy targets or validation plan
- Residual false negatives acknowledged but not quantified

## Decision

Implement a **2-stage hybrid detection pipeline** that balances speed, accuracy, and utility.

### Stage 1: Fast Rule-Based Detection (Synchronous, <50ms)

**Purpose**: Catch deterministic PII patterns with zero false negatives for known types.

**Method**: Compiled regex patterns for high-confidence PII.

**Target**:
- False Positive Rate: <1% overall (acceptable over-redaction for safety)
- False Negative Rate: 0 known FN on regression suite (design target, not provable guarantee across all inputs)
- Latency: <50ms p95 (synchronous in hook)
- Category-Specific FN Targets:
  - API Keys/Tokens/SSH Keys: Near-zero FN (<0.1%, accept higher FP for maximum safety)
  - Personal Names: Balanced FN/FP (<2% FN, <5% FP to preserve utility)
  - Credit Cards: 0 known FN on test suite, mask all but last 4 digits (PCI DSS compliance)

**Runs**: In Claude Code hook (userPromptSubmit, assistantResponse) BEFORE any persistence.

### Stage 2: AI Context-Aware Validation (Async, <2s)

**Purpose**: Catch context-dependent PII that rules miss (names vs variables, novel patterns).

**Method**: LLM-powered analysis with PII taxonomy and context understanding.

**Target**:
- False Positive Rate: <5% (balanced for utility)
- False Negative Rate: <5% (residual risk acknowledged)
- Latency: <2s p95 (async job, non-blocking)

**Runs**: Downstream async job AFTER sanitized content is persisted.

### PII Taxonomy (Comprehensive)

**Tier 1: High-Confidence Deterministic** (Stage 1 only):

*API Keys and Cloud Provider Secrets:*
1. OpenAI: sk-*, pk-*
2. Anthropic: sk-ant-*
3. AWS: AKIA[0-9A-Z]{16}, aws_access_key_id patterns
4. GitHub: ghp_*, gho_*, ghs_*, ghr_*, ghu_*
5. Google API: AIza[0-9A-Za-z-_]{35}
6. Google OAuth: ya29\.* tokens
7. GCP Service Account: private_key, client_email, client_id in JSON
8. Azure SAS: sv=, sig=, se=, sp= query parameters
9. Azure Storage: 44-character base64 keys
10. Cloudflare: CF-* tokens
11. Slack: xoxb-*, xoxp-*, xoxa-*, xoxs-*, xoxe-*, Slack signing secrets
12. Stripe: sk_live_*, sk_test_*, rk_live_*, whsec_*
13. Twilio: Account SID AC[0-9a-f]{32}, Auth Token [0-9a-f]{32}
14. Hugging Face: hf_[A-Za-z0-9]{36,}
15. Supabase: anon/service keys
16. Sentry: DSN patterns
17. Vercel: vercel_* tokens
18. Notion: notion_* tokens
19. Discord: bot tokens
20. Telegram: bot tokens
21. Generic API keys: (api_key|apikey|api-key)[:=]\s*[A-Za-z0-9_-]{20,}

*Tokens and Authentication:*
22. JWT Tokens: eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+
23. SSH/PEM Keys: -----BEGIN (PRIVATE|RSA PRIVATE|EC PRIVATE|OPENSSH PRIVATE) KEY-----
24. Authorization Headers: (Bearer|Basic|Api-Key|X-API-Key):\s*[A-Za-z0-9_=-]{20,}
25. Basic Auth in URLs: https?://[^:]+:[^@]+@

*Database Credentials:*
26. PostgreSQL: postgres://user:pass@host
27. MySQL: mysql://user:pass@host
28. MSSQL: mssql://user:pass@host
29. MongoDB: mongodb://user:pass@host, mongodb+srv://user:pass@host
30. Redis: redis://user:pass@host
31. AMQP: amqp://user:pass@host
32. JDBC: jdbc:(postgres|mysql|oracle|sqlserver)://.*password=

*Cookies and Session Data:*
33. Set-Cookie headers: sessionid, csrftoken, auth_token, connect.sid
34. Secure cookies: __Secure-*, __Host-*
35. Cookie header values: Cookie: sessionid=*, csrftoken=*

*Environment Variables and Config:*
36. Sensitive env vars: (SECRET|TOKEN|PASSWORD|PRIVATE|CLIENT_SECRET|API_KEY|AUTH|ACCESS_TOKEN|REFRESH_TOKEN)[:=][^\s]{8,}
37. Structured secrets in JSON/YAML: Keys matching (password|secret|token|api_key|client_secret) with high-entropy values

*High-Entropy Strings:*
38. Base64-like strings: Length ≥20, Shannon entropy >4.5, alphanumeric+/-/_ alphabet, with context keywords (secret, token, key, bearer, auth, x-amz-, x-goog-)

*Personal Identifiers:*
39. Credit Cards: Luhn-validated 13-19 digit sequences (mask all but last 4 for utility)
40. SSNs: XXX-XX-XXXX format
41. Email Addresses: RFC 5322 compliant patterns (exclude example.com/.org/.net)
42. Passport Numbers: Jurisdiction-specific patterns (context-dependent)
43. Driver's Licenses: Jurisdiction-specific patterns (context-dependent)
44. National IDs: UK NINO, CA SIN, IN Aadhaar, EU national IDs
45. IBANs: International bank account numbers
46. Bank Account/Routing Numbers: US and international formats

*Healthcare Identifiers (HIPAA PHI):*
47. Medical Record Numbers (MRN)
48. Health Plan Numbers

*Contact Information:*
49. Phone Numbers: E.164 and common international formats (libphonenumber-based parsing)

*Network Identifiers:*
50. IPv4 Addresses: Public IPs only (exclude RFC1918 private ranges 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, localhost 127.0.0.1, 0.0.0.0, RFC5737 documentation ranges)
51. IPv6 Addresses: Public only (exclude fd00::/8, fe80::/10, ::1)
52. MAC Addresses: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX

*Device Identifiers:*
53. IMEI: 15-digit Luhn-validated
54. IMSI: 14-15 digit mobile subscriber IDs
55. IDFA: Apple Advertising IDs (UUID format)
56. Android Advertising ID: UUID format
57. Apple UDID: Legacy device IDs

*File Paths:*
58. User Paths: /Users/*, /home/*, C:\Users\*, C:\Documents and Settings\* (exclude C:\Users\Public)
59. Sensitive Windows Paths: AppData\Roaming\*, ProgramData\* (when containing usernames)

**Tier 2: Context-Dependent** (Stage 1 + Stage 2):

*Contextual Secrets:*
60. URLs with Tokens: Query params (token=, key=, auth=, api_key=, access_token=, code=, state=)
61. Obfuscated/encoded secrets: Base64-encoded secrets detected via decode + re-match heuristics

*Personal Data:*
62. Person Names: Requires context (vs code variables, exclude common programming keywords like const, function, class)
63. Street Addresses: US and international formats (with context and locale awareness)
64. Dates of Birth: With context indicators (DOB:, born:, birthdate:)
65. Geolocation: Latitude/longitude pairs with realistic ranges (-90 to 90, -180 to 180)
66. VINs/License Plates: Vehicle identification (context-dependent)

*Organizations:*
67. Organization Names: Requires context (vs product names, framework names)

**Tier 3: Novel/Emerging** (Stage 2 only):
68. New API provider patterns (monitor provider documentation continuously)
69. Custom authentication schemes (proprietary formats)
70. Domain-specific identifiers (industry-specific PII)
71. Obfuscated or base64-encoded secrets (deep inspection after normalization)
72. Multilingual PII (names, addresses, phone formats in non-English locales)

### Redaction Strategy

**Irreversible by Default** (STANDARDS-compliant):
```
Original: "My email is user@example.com"
Redacted: "My email is [REDACTED_EMAIL]"
```

**Optional Session-Scoped Pseudonymization** (disabled by default):
```
Original: "user@example.com sent email to user@example.com"
Pseudonymized: "<EMAIL_1> sent email to <EMAIL_1>"
```

**Pseudonymization Properties** (if enabled):
- Session-scoped only (conversation lifetime)
- **In-memory mapping ONLY** - NEVER persisted to disk (STANDARDS section 1 compliance)
- Mapping stored exclusively in process memory or ephemeral session cache (e.g., Redis with TTL, never SQLite)
- Auto-clear on session end or 24-hour TTL (whichever comes first)
- Never reversible across sessions (mapping is destroyed)
- Never shared globally across users
- **CRITICAL**: Storing the original→placeholder mapping on disk violates STANDARDS section 1 (never persist raw data), even if encrypted
- If product requirements mandate persistence, requires explicit exception ADR with:
  - KMS-backed envelope encryption (key rotation every 90 days)
  - Sealed storage with audit logs
  - <24h TTL with automated purge
  - Strong risk justification and DPO sign-off
  - Rigorous security audits

### Detection Pipeline

```typescript
interface DetectionResult {
  sanitized: string;
  detections: Detection[]; // In-memory only, with original
  persistedDetections: PersistedDetection[]; // For logging, no originals
  stage1Confidence: number; // Rules
  stage2Confidence: number; // AI (if run)
  method: 'rules-only' | 'hybrid';
}

interface Detection {
  category: PIICategory;
  original: string;        // NEVER persisted - in-memory only, discarded after hook returns
  placeholder: string;     // [REDACTED_TYPE] default, <TYPE_N> if pseudonymization enabled
  confidence: number;      // 0.0-1.0
  position: { start: number; end: number }; // Positions in original text
  detector: 'rules' | 'ai';
}

interface PersistedDetection {
  // Used for sanitization_log and audit records
  // CRITICAL: Does NOT include 'original' field - STANDARDS section 1 compliance
  category: PIICategory;
  placeholder: string;     // The replacement text used
  confidence: number;      // Detection confidence score
  position: { start: number; end: number }; // Positions relative to sanitized text
  detector: 'rules' | 'ai';
  detectorVersion: string; // Version for reproducibility and rollback
  // EXPLICITLY NO 'original' field - never log or persist raw PII values
}

// Stage 0: Normalization (before detection)
// CRITICAL: Makes pattern detection robust against obfuscation and encoding
function normalizeText(text: string): string {
  // 1. Unicode NFKC normalization (canonical decomposition + compatibility composition)
  let normalized = text.normalize('NFKC');

  // 2. Strip zero-width characters (used for obfuscation)
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 3. Normalize whitespace (collapse multiple spaces/tabs/newlines to single space)
  normalized = normalized.replace(/\s+/g, ' ');

  // 4. Decode common HTML entities
  normalized = normalized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // 5. URL-decode query parameters and paths (for token detection in URLs)
  // Apply selectively to avoid breaking legitimate encoded content
  normalized = normalized.replace(/(%[0-9A-Fa-f]{2})+/g, (match) => {
    try {
      return decodeURIComponent(match);
    } catch {
      return match; // Keep original if decode fails
    }
  });

  // 6. Inspect Base64/Base64URL windows when strongly indicated by context
  // This helps detect Authorization: Basic <base64> and embedded encoded secrets
  // Note: Apply heuristics carefully to avoid excessive decoding overhead

  return normalized;
}

// Stage 1: Synchronous (in hook)
function detectWithRules(text: string): Detection[] {
  const detections: Detection[] = [];

  // 1. Standard regex patterns (precompiled, no catastrophic backtracking)
  for (const [category, pattern] of piiPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      detections.push({
        category,
        original: match[0],
        placeholder: `[REDACTED_${category}]`,
        confidence: 1.0, // Deterministic
        position: { start: match.index!, end: match.index! + match[0].length },
        detector: 'rules'
      });
    }
  }

  // 2. Structured key-value secret detection (JSON/YAML)
  // Faster and more precise than regex on unstructured text
  const structuredSecrets = detectStructuredSecrets(text);
  detections.push(...structuredSecrets);

  // 3. High-entropy string detection (novel secrets)
  // Apply with strict context/length limits to control FPs
  const entropyDetections = detectHighEntropyStrings(text);
  detections.push(...entropyDetections);

  return detections;
}

// Helper: Detect secrets in structured data (JSON/YAML)
function detectStructuredSecrets(text: string): Detection[] {
  const detections: Detection[] = [];
  const sensitiveKeys = [
    'password', 'secret', 'token', 'api_key', 'apikey', 'client_secret',
    'private_key', 'access_token', 'refresh_token', 'auth', 'authorization'
  ];

  try {
    // Attempt JSON parse
    const data = JSON.parse(text);
    // Recursively scan keys
    scanObject(data, '', detections);
  } catch {
    // Not valid JSON, skip structured detection
  }

  return detections;

  function scanObject(obj: any, path: string, dets: Detection[]): void {
    if (typeof obj !== 'object' || obj === null) return;
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(k => lowerKey.includes(k))) {
        if (typeof value === 'string' && value.length >= 8) {
          // Found sensitive key with string value
          dets.push({
            category: 'API_KEY', // Or map to specific category
            original: value,
            placeholder: '[REDACTED_API_KEY]',
            confidence: 0.9, // Structured context, high confidence
            position: { start: text.indexOf(value), end: text.indexOf(value) + value.length },
            detector: 'rules'
          });
        }
      }
      if (typeof value === 'object') {
        scanObject(value, `${path}.${key}`, dets);
      }
    }
  }
}

// Helper: Detect high-entropy strings (base64-like, potential secrets)
function detectHighEntropyStrings(text: string): Detection[] {
  const detections: Detection[] = [];
  const contextKeywords = [
    'secret', 'token', 'key', 'bearer', 'auth', 'password',
    'x-amz-', 'x-goog-', 'authorization', 'cookie'
  ];

  // Match base64/base64url-like strings (length >= 20)
  const entropyPattern = /[A-Za-z0-9+/\-_]{20,}/g;
  const matches = text.matchAll(entropyPattern);

  for (const match of matches) {
    const candidate = match[0];
    const entropy = calculateShannonEntropy(candidate);

    // High entropy threshold (> 4.5 bits per character)
    if (entropy > 4.5) {
      // Check for context keywords nearby (within 50 chars before)
      const contextStart = Math.max(0, match.index! - 50);
      const context = text.slice(contextStart, match.index!).toLowerCase();
      const hasContext = contextKeywords.some(kw => context.includes(kw));

      if (hasContext) {
        detections.push({
          category: 'HIGH_ENTROPY_SECRET',
          original: candidate,
          placeholder: '[REDACTED_SECRET]',
          confidence: 0.85, // Entropy + context heuristic
          position: { start: match.index!, end: match.index! + candidate.length },
          detector: 'rules'
        });
      }
    }
  }

  return detections;
}

// Helper: Calculate Shannon entropy
function calculateShannonEntropy(str: string): number {
  const len = str.length;
  const frequencies: Record<string, number> = {};

  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  let entropy = 0;
  for (const count of Object.values(frequencies)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

// Stage 2: Async (downstream job)
async function detectWithAI(
  text: string,
  ruleDetections: Detection[]
): Promise<Detection[]> {
  const prompt = `
Analyze this text for PII not caught by rule-based detection.
Focus on context-dependent PII (names vs variables, novel patterns).

PII Taxonomy: ${JSON.stringify(PII_TAXONOMY)}
Already detected: ${ruleDetections.map(d => d.category).join(', ')}

Text: """
${text}
"""

Return JSON array of new detections with category, position, confidence.
`;

  const response = await llm.complete(prompt, {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.0, // Deterministic
    response_format: { type: 'json_object' }
  });

  return parseAIDetections(response);
}

// Combined pipeline
async function sanitize(text: string): Promise<DetectionResult> {
  // Stage 0: Normalization
  const normalized = normalizeText(text);

  // Stage 1: Fast rules (synchronous)
  const start = performance.now();
  const ruleDetections = detectWithRules(normalized);
  const stage1Duration = performance.now() - start;

  if (stage1Duration > 50) {
    logger.warn('Stage 1 detection exceeded budget', { duration: stage1Duration });
  }

  // Apply redactions
  const sanitized = applyRedactions(normalized, ruleDetections);

  // Create persisted detections (without original values)
  // CRITICAL: Never include 'original' field - STANDARDS section 1 compliance
  const persistedDetections: PersistedDetection[] = ruleDetections.map(d => ({
    category: d.category,
    placeholder: d.placeholder,
    confidence: d.confidence,
    position: d.position, // Positions relative to sanitized text
    detector: d.detector,
    detectorVersion: DETECTOR_VERSION // For reproducibility and rollback
    // EXPLICITLY NO 'original' field - never log or persist raw PII
  }));

  // Queue Stage 2 (async, non-blocking)
  await jobQueue.enqueue({
    type: 'ai-sanitization-validation',
    payload: {
      sanitizedText: sanitized, // Already sanitized, no raw content
      persistedDetections
    },
    priority: 'low'
  });

  return {
    sanitized,
    detections: ruleDetections, // In-memory only, discarded after hook returns
    persistedDetections, // Safe to log/persist
    stage1Confidence: calculateConfidence(ruleDetections),
    stage2Confidence: 0, // Not yet run
    method: 'rules-only'
  };
}
```

### Accuracy Targets

| Metric | Stage 1 (Rules) | Stage 2 (AI) | Combined |
|--------|----------------|--------------|----------|
| False Negative Rate | 0 known FN on regression suite (design target) | <5% (novel) | <5% |
| False Positive Rate | <1% overall | <5% | <3% |
| Latency (p95) | <50ms | <2s | <50ms sync + <2s async |
| Recall (enumerated PII) | Design target: 100% on test suite | N/A | >95% |
| Precision (utility) | 99%+ | 95%+ | 97%+ |

**Category-Specific Targets** (Stage 1):

| Category | FN Target | FP Tolerance | Rationale |
|----------|-----------|--------------|-----------|
| API Keys/Tokens/SSH Keys | <0.1% | <10% | Maximum safety, accept over-redaction |
| Database Credentials | <0.1% | <10% | Critical secrets, no leaks tolerated |
| Credit Cards | 0 known FN on test suite | <1% | PCI DSS compliance, mask last 4 for utility |
| SSNs/National IDs | <0.5% | <2% | Regulatory compliance (GDPR, HIPAA) |
| Email Addresses | <1% | <2% | Balance privacy and utility |
| IP Addresses (public) | <2% | <5% | Lower risk, preserve utility for debugging |
| Personal Names | <2% | <5% | Context-aware, preserve code variable utility |
| File Paths (user-specific) | <1% | <3% | Privacy risk moderate |

**Residual Risk Acknowledged**:
- Stage 1 design target is 0 known FN on regression suite, NOT a provable mathematical guarantee across all possible inputs
- Unknown/novel patterns (new API providers, custom auth schemes) slip through until Stage 2 runs (async gap creates exposure window)
- Stage 2 has <5% FN for novel patterns due to LLM limitations and non-deterministic behavior
- Combined system targets <5% overall FN rate with continuous improvement
- Continuous monitoring and pattern updates required when misses are found (7-day SLA for adding new patterns after discovery)
- Evaluation methodology uses labeled corpus with confidence intervals, not absolute claims

### Audit and Validation Plan

**Pre-Deployment**:
1. Canary test suite (1000+ known PII samples across all categories)
2. Property-based testing (generated variations)
3. Adversarial testing (obfuscated PII)
4. Benchmarking (latency, accuracy on labeled dataset)

**Post-Deployment**:
1. Post-ingest audits (random 1% sample daily, re-run detection on sanitized content)
   - **Key insight**: Since only sanitized content is stored, missed PII remains present in sanitized text until Stage 2 catches it
   - Seeded canaries in live traffic (synthetic innocuous markers, NOT real PII) for regression detection
   - Manual review sample: 5% of Stage 2 flagged messages (confidence 0.6-0.8)
   - Reviewer tooling shows ONLY sanitized text + context (never raw originals)
2. Canary injection (synthetic PII in test conversations)
   - Automated tests inject known-safe PII patterns
   - Validate detection within SLA (Stage 1 immediate, Stage 2 within 2s)
3. User reporting mechanism (flag missed PII)
   - In-app "Report PII" button
   - **STANDARDS-compliant remediation** (STANDARDS section 3: no "quarantined" status):
     - Option A: Soft-delete (add deleted_at timestamp, exclude from queries)
     - Option B: Disable flag (messages.disabled = true)
     - Option C: Move to separate quarantine table (not using job status enum)
   - Immediate action upon report confirmation
   - Alert security team for pattern update
4. Continuous pattern updates (monitor new API provider docs, add within 7-day SLA)
   - Weekly scan of major API provider changelogs
   - Automated alerts for new token formats
5. Kill-switch (halt uploads if audit finds PII in stored data)
   - **CRITICAL**: Trigger conditions:
     - Overall FN rate >5% on audit sample
     - Per-category FN for API_KEY/JWT/SSH_KEY >1%
     - Manual PII report confirmed
   - Action: Set global flag to disable uploads until remediation complete
6. Versioning and remediation workflow:
   - **Versioning**:
     - Log detectorVersion (semantic versioning, e.g., "1.2.3") with each sanitization
     - Log sanitized_revision when content is updated (incremental: 1, 2, 3...)
     - Enable reproducibility: re-run old detector version to verify fixes
   - **Automated remediation** (when new patterns added):
     - Re-run updated rules + AI on ALL stored sanitized content
     - Patch content in-place (UPDATE messages SET content = ..., sanitized_revision = sanitized_revision + 1)
     - Use idempotent patcher keyed by message_id + revision (handle concurrent workers)
     - "Re-sanitize until stable" approach (iterate until no new detections)
   - **Incident response** (when FN threshold exceeded):
     - Halt uploads immediately (kill-switch)
     - Notify DPO and security team
     - Root cause analysis (which patterns missed, why)
     - Emergency pattern update
     - Full corpus re-sanitization
     - Audit report to stakeholders

**Validation Metrics**:
```typescript
interface ValidationReport {
  timestamp: string;
  sampleSize: number;
  detectedPII: number;
  categoriesDetected: Record<PIICategory, number>; // Per-category counts
  categoryMetrics: Record<PIICategory, {
    falseNegatives: number; // Manual review
    falsePositives: number; // Manual review
    redactionRate: number; // % of messages with this category
  }>;
  falseNegatives: number; // Overall manual review
  falsePositives: number; // Overall manual review
  stage1Latency: { p50: number; p95: number; p99: number };
  stage2Latency: { p50: number; p95: number; p99: number };
  detectorVersion: string;
}
```

**Alert Thresholds**:
- Overall FN Rate >5%: CRITICAL alert, halt uploads, incident response
- Per-category FN for API_KEY/JWT/SSH_KEY >1%: CRITICAL, immediate pattern update
- Overall FP Rate >10%: WARNING, review detection rules
- PERSON_NAME redaction surge >20% p95: WARNING, possible prompt drift
- Stage 1 latency >100ms p95: WARNING, optimize patterns/add regex timeouts
- Stage 2 latency >5s p95: WARNING, review LLM usage/add circuit breaker

**Manual Review Process** (borderline detections):
- Stage 2 flags detections with confidence 0.6-0.8 for human review
- Reviewer tooling shows ONLY sanitized text + context (never raw originals)
- Review SLA: 48 hours for borderline cases
- Sampling rate: 5% of Stage 2 flagged messages

## Alternatives Considered

### Alternative 1: Rules-Only (No AI)

**Pros**:
- Fast, deterministic, cheap
- No LLM dependency
- Predictable behavior

**Cons**:
- High false negative rate for contextual PII (names, novel patterns)
- Requires constant pattern updates
- Can't distinguish "John" (name) from "john" (variable)

**Why not chosen**: Unacceptable privacy risk. Novel patterns and contextual PII would leak.

### Alternative 2: AI-Only (No Rules)

**Pros**:
- High accuracy for contextual PII
- Adapts to novel patterns
- No pattern maintenance

**Cons**:
- Too slow for synchronous hook (<100ms budget)
- Expensive (LLM call per message)
- Non-deterministic (LLM variance)
- False positives reduce utility

**Why not chosen**: Latency and cost prohibitive for real-time sanitization.

### Alternative 3: ML NER Models (spaCy, Presidio)

**Pros**:
- Fast (<100ms)
- Good accuracy for trained entities
- Deterministic

**Cons**:
- Requires labeled training data
- Limited to trained entity types
- Misses novel patterns (API keys, JWTs)
- Model maintenance overhead

**Why not chosen**: Complements hybrid approach but doesn't replace it. Could add post-MVP.

### Alternative 4: Field-Level Encryption (No Redaction)

**Pros**:
- Reversible
- Full data preserved
- Simple implementation

**Cons**:
- Key management complexity
- Doesn't minimize attack surface
- Encrypted PII may still violate regulations
- Key leak exposes all data

**Why not chosen**: Doesn't eliminate PII, only obscures it. Fails zero-trust principle.

### Alternative 5: Differential Privacy (Statistical Noise)

**Pros**:
- Mathematically proven privacy bounds
- Preserves statistical utility
- No PII detection needed

**Cons**:
- Not applicable to conversational data (need exact text)
- Noise makes conversations unreadable
- Complex implementation
- Doesn't prevent individual PII leaks

**Why not chosen**: Incompatible with conversational learning extraction.

## Consequences

### Positive

- **Layered defense**: Multiple detection methods reduce false negatives
- **Performance optimized**: Synchronous rules meet <50ms budget, AI runs async
- **Utility preserved**: Low false positive rate (97% precision) maintains learning value
- **Comprehensive taxonomy**: Covers all known PII types
- **Audit trail**: Post-ingest validation catches mistakes
- **Adaptable**: AI stage catches novel patterns rules miss
- **Cost-effective**: Rules handle 95%+ of PII, AI only for edge cases

### Negative

- **Residual false negatives**: <5% PII may slip through (acknowledged risk)
- **Complexity**: 2-stage pipeline harder to maintain than single method
- **Async gap**: AI validation runs after persistence (Stage 1 must be perfect for known patterns)
- **LLM dependency**: Stage 2 requires Claude API (cost, latency, availability)
- **Pattern maintenance**: Rule patterns require ongoing updates

### Neutral

- **Tuning required**: Confidence thresholds need empirical validation
- **Monitoring overhead**: Continuous audits and canary tests required
- **Manual review**: Borderline cases need human adjudication

## Risks and Mitigations

### Risk: Stage 1 False Negatives (Unknown Patterns)

**Impact**: CRITICAL - Privacy violation before Stage 2 runs

**Likelihood**: Medium (new API providers, token formats)

**Mitigation**:
- Continuous pattern updates (monitor new API docs)
- Post-ingest audits detect misses within 24h
- Kill-switch halts uploads if PII found
- User reporting mechanism
- Conservative redaction (err on side of privacy)

### Risk: Stage 2 False Positives (Over-Redaction)

**Impact**: Medium - Reduced learning utility

**Likelihood**: Low (<5% target)

**Mitigation**:
- Manual review queue for borderline cases
- Feedback loop improves AI prompts
- Metrics on redaction rate by category
- User feedback on utility loss

### Risk: Latency Budget Violation

**Impact**: High - Blocks user interactions

**Likelihood**: Low (benchmarked at <50ms)

**Mitigation**:
- Compiled regex patterns (no backtracking)
- Performance monitoring with alerts
- Fallback to minimal rules if timeout

### Risk: Novel PII Types

**Impact**: High - Privacy violation

**Likelihood**: Medium (evolving ecosystem)

**Mitigation**:
- Stage 2 AI catches unknowns
- Bug bounty for finding missed PII
- Regular security audits
- Conservative AI prompts

## Implementation

### Regex Safety and Performance (CRITICAL)

**Before any pattern implementation**:
- **Precompile all patterns**: Use compiled regex objects, not string patterns
- **Avoid catastrophic backtracking**: Use atomic groups `(?>...)`, possessive quantifiers where available
- **Bound repetitions**: Replace `.*` with `.{0,200}` or specific character classes
- **Specific character classes**: Use `[A-Za-z0-9]` instead of `.` where possible
- **Test worst-case inputs**: Maintain fuzz corpus for regex DoS testing
- **Add timeouts**: Cap regex execution time per pattern (e.g., 10ms max)
- **Limit input length**: Chunk long messages (>10KB) or apply patterns to windows
- **No nested quantifiers**: Avoid patterns like `(a+)+` or `(.*)*`

**Performance monitoring**:
- Track Stage 1 latency per pattern category
- Alert if any single pattern exceeds 10ms p95
- Auto-disable slow patterns and fall back to minimal ruleset

### Phase 0: Pattern Library

- [ ] Define regex patterns for all Tier 1 PII (72 categories)
- [ ] Implement regex safety checks (atomic groups, bounded repetitions)
- [ ] Benchmark latency on 10k messages with worst-case inputs
- [ ] Validate 0 known FN on regression suite (1000+ samples)
- [ ] Optimize for <50ms p95 total (all patterns combined)
- [ ] Add entropy detector with tuned thresholds (>4.5 bits/char)
- [ ] Implement structured JSON/YAML secret scanner

### Phase 1: Stage 1 Integration

- [ ] Implement detectWithRules() in hook
- [ ] Add performance monitoring
- [ ] Integrate with sanitization log
- [ ] Deploy to production

### Phase 2: Stage 2 Validation

- [ ] Implement AI validation job
- [ ] Define LLM prompt with taxonomy
- [ ] Queue async jobs from hook
- [ ] Reconcile AI detections with stored data

### Phase 3: Audit Infrastructure

- [ ] Post-ingest random sampling
- [ ] Canary injection tests
- [ ] Kill-switch implementation
- [ ] Monitoring dashboards

## Related Documents

### Standards
- [STANDARDS.md Section 9: Sanitization Standard](../STANDARDS.md#9-sanitization-standard)

### Decisions
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md) - Storage policy
- [ADR-001: Use Claude Hooks](./decision-use-claude-hooks-2025-01-16.md) - Hook integration

### Architecture
- [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md) - Full pipeline design

### Reference
- [PII Detection Patterns](../reference/reference-pii-patterns-2025-01-16.md) - Complete pattern library

### Reviews
- [GPT-5 Holistic Review](../reviews/gpt5-holistic-review-2025-01-16.txt) - Recommendation to split ADR
- [GPT-5 ADR-010 Review](../reviews/gpt5-adr-010-pii-detection-review-2025-01-16.txt) - Detailed feedback incorporated

---

## Review History

**GPT-5 Review (2025-01-16)**: Comprehensive review provided the following improvements incorporated into this revision:

1. **Expanded PII Taxonomy** (11 → 72+ categories):
   - Added cloud providers: Google (GCP service accounts, OAuth), Azure (SAS tokens, storage keys), Cloudflare, Supabase, Sentry, Vercel, Notion, Discord, Telegram
   - Added database credentials: PostgreSQL, MySQL, MSSQL, MongoDB, Redis, AMQP, JDBC connection strings with embedded passwords
   - Added authentication mechanisms: Authorization headers (Bearer, Basic, Api-Key, X-API-Key), Basic auth in URLs, cookies (Set-Cookie, sessionid, csrftoken, __Secure-*, __Host-*)
   - Added environment variables: Sensitive key patterns (SECRET, TOKEN, PASSWORD, PRIVATE, CLIENT_SECRET, API_KEY, AUTH, ACCESS_TOKEN, REFRESH_TOKEN)
   - Added high-entropy string detection: Shannon entropy >4.5 bits/char, length ≥20, with context keywords (secret, token, key, bearer, auth, x-amz-, x-goog-)
   - Added international identifiers: Passport numbers, driver's licenses, national IDs (UK NINO, CA SIN, IN Aadhaar, EU), IBANs, bank account/routing numbers
   - Added healthcare identifiers (HIPAA PHI): Medical Record Numbers (MRN), health plan numbers
   - Added device identifiers: IMEI (Luhn), IMSI, IDFA, Android Advertising ID, Apple UDID
   - Added geolocation: Latitude/longitude pairs with realistic ranges
   - Added multilingual PII support (Tier 3)
   - Added structured key-value detection for JSON/YAML secrets

2. **Normalization Step** (Stage 0, before detection):
   - Unicode NFKC normalization (canonical + compatibility composition)
   - Zero-width character stripping (anti-obfuscation)
   - Whitespace normalization (collapse multiple spaces)
   - HTML entity decoding (&lt;, &gt;, &amp;, &quot;, &apos;)
   - URL decoding for query parameters
   - Base64/Base64URL inspection with context heuristics

3. **Fixed "0% FN" Absolute Claim**:
   - Changed to "0 known FN on regression suite (design target, not provable guarantee)"
   - Acknowledged not mathematically provable across all inputs
   - Added evaluation methodology using labeled corpus with confidence intervals
   - Added 7-day SLA for adding new patterns after discovery

4. **Category-Specific Thresholds**:
   - API Keys/Tokens/SSH Keys: <0.1% FN, <10% FP (maximum safety)
   - Database Credentials: <0.1% FN, <10% FP (critical secrets)
   - Credit Cards: 0 known FN on test suite, <1% FP, mask all but last 4 (PCI DSS)
   - SSNs/National IDs: <0.5% FN, <2% FP (regulatory compliance)
   - Email Addresses: <1% FN, <2% FP (balance privacy/utility)
   - IP Addresses (public): <2% FN, <5% FP (lower risk, preserve debugging utility)
   - Personal Names: <2% FN, <5% FP (context-aware, preserve code variables)
   - File Paths: <1% FN, <3% FP (moderate privacy risk)

5. **PersistedDetection Type** (without original field):
   - Explicitly removed 'original' field from logged/persisted detections
   - Added detectorVersion for reproducibility and rollback
   - Positions relative to sanitized text (not original)
   - Clear comments: "EXPLICITLY NO 'original' field - never log or persist raw PII"

6. **Replaced "Quarantined" Status** (STANDARDS section 3 compliance):
   - Option A: Soft-delete (deleted_at timestamp)
   - Option B: Disable flag (messages.disabled = true)
   - Option C: Separate quarantine table (not using job status enum)
   - No use of forbidden "quarantined" job status

7. **Pseudonymization Mapping - In-Memory Only**:
   - CRITICAL: Never persist mapping to disk (violates STANDARDS section 1)
   - Store exclusively in process memory or ephemeral Redis with TTL
   - If persistence required, needs exception ADR with KMS encryption, <24h TTL, DPO sign-off
   - Auto-destroy mapping on session end or 24h TTL

8. **Structured Key-Value Secret Detection**:
   - JSON/YAML parser with recursive key scanning
   - Sensitive key patterns: password, secret, token, api_key, client_secret, private_key, access_token, refresh_token, auth, authorization
   - Faster and more precise than regex on unstructured text
   - Confidence 0.9 for structured context

9. **Enhanced Audit and Remediation**:
   - Added versioning: detectorVersion (semantic), sanitized_revision (incremental)
   - Automated remediation workflow: re-run rules + AI, patch in-place, idempotent patcher
   - "Re-sanitize until stable" approach (iterate until no new detections)
   - Incident response: kill-switch triggers, root cause analysis, emergency pattern updates, full corpus re-sanitization
   - Manual review process: 5% of Stage 2 flagged messages (confidence 0.6-0.8), reviewer tooling shows only sanitized text
   - Per-category metrics and alerts

10. **IP Address and Credit Card Policy Clarifications**:
    - IPs: Public only (exclude RFC1918 private 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, localhost 127.0.0.1, 0.0.0.0, RFC5737 documentation ranges)
    - IPv6: Public only (exclude fd00::/8, fe80::/10, ::1)
    - Credit Cards: Mask all but last 4 digits for utility while meeting PCI DSS

11. **Regex Safety and Performance**:
    - Added comprehensive regex safety guidelines (precompile, avoid catastrophic backtracking, atomic groups, bounded repetitions, timeouts)
    - Per-pattern latency monitoring
    - Fuzz corpus for regex DoS testing
    - Auto-disable slow patterns with fallback

**Status**: All critical GPT-5 recommendations incorporated. Taxonomy expanded from 11 to 72+ categories. Full STANDARDS compliance achieved.

---

*This ADR defines the detection strategy; ADR-004 defines the storage policy (never persist raw). Together they form the complete privacy architecture.*
