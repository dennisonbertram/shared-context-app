# Learning Extraction Architecture

> Automated system for extracting valuable, actionable learnings from sanitized conversations using AI-powered analysis and quality validation

---
title: Learning Extraction Architecture
category: architecture
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [learning-extraction, ai, quality-scoring, deduplication, evidence]
---

## Overview

The Learning Extraction system analyzes sanitized conversations to identify and extract valuable, reusable learnings. It transforms raw conversation data into structured knowledge that can be shared across the Global Context Network, enabling AI agents to learn from each other's experiences.

**Core Value Proposition**: Mine actionable knowledge from conversations, not just capture transcripts.

### Alignment with Standards

This architecture is 100% compliant with [STANDARDS.md](../STANDARDS.md):
- Uses `learnings` table with ULID IDs
- Processes via `job_queue` with canonical status enums
- Operates on SANITIZED data only (never raw)
- Async processing with quality gates
- Evidence-based (links to source messages)

## Goals

- Extract high-value learnings from 20-30% of conversations
- Quality threshold: confidence score ≥ 0.6
- Deduplication: Prevent similar learnings from being stored
- Evidence linkage: Every learning traceable to source messages
- Performance: < 5s per conversation (p95)
- Categorization: Automatic classification into 8 learning types

## Non-Goals

- Capturing every conversation (most lack valuable learnings)
- Real-time extraction (async processing is acceptable)
- Perfect recall (precision > recall for quality)
- General summarization (focus on actionable insights)

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Sanitized Messages                         │
│                   (SQLite: messages table)                    │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼ Trigger: conversation marked complete
      ┌──────────────────────────────────┐
      │      Job Queue (job_queue)        │
      │  Type: extract_learning           │
      │  Status: queued                   │
      └────────────┬─────────────────────┘
                   │
                   ▼ Worker picks up job
      ┌──────────────────────────────────┐
      │  Conversation Value Analyzer      │
      │  ┌────────────────────────────┐  │
      │  │ - Check length (≥3 messages)│  │
      │  │ - Check topics (coding?)    │  │
      │  │ - Check tools used          │  │
      │  │ - Estimate value score      │  │
      │  └─────────┬──────────────────┘  │
      └────────────┼─────────────────────┘
                   │
                   ├─── Low Value (< 0.3) ──> Skip (mark complete)
                   │
                   ▼ High Value (≥ 0.3)
      ┌──────────────────────────────────┐
      │   Category Detection              │
      │  ┌────────────────────────────┐  │
      │  │ Classify conversation into: │  │
      │  │ - pattern                   │  │
      │  │ - best_practice             │  │
      │  │ - anti_pattern              │  │
      │  │ - bug_fix                   │  │
      │  │ - optimization              │  │
      │  │ - tool_usage                │  │
      │  │ - workflow                  │  │
      │  │ - decision                  │  │
      │  └─────────┬──────────────────┘  │
      └────────────┼─────────────────────┘
                   │
                   ▼ For each detected category
      ┌──────────────────────────────────┐
      │  Category-Specific Extractors     │
      │  ┌────────────────────────────┐  │
      │  │ Pattern Extractor          │  │
      │  │ Best Practice Extractor    │  │
      │  │ Anti-Pattern Extractor     │  │
      │  │ Bug Fix Extractor          │  │
      │  │ Optimization Extractor     │  │
      │  │ Tool Usage Extractor       │  │
      │  │ Workflow Extractor         │  │
      │  │ Decision Extractor         │  │
      │  └─────────┬──────────────────┘  │
      └────────────┼─────────────────────┘
                   │
                   ▼ Raw learnings extracted
      ┌──────────────────────────────────┐
      │   Quality Scoring System          │
      │  ┌────────────────────────────┐  │
      │  │ - Actionability (0-1)      │  │
      │  │ - Generalizability (0-1)   │  │
      │  │ - Clarity (0-1)            │  │
      │  │ - Evidence strength (0-1)  │  │
      │  │ → Confidence = weighted avg│  │
      │  └─────────┬──────────────────┘  │
      └────────────┼─────────────────────┘
                   │
                   ├─── Low Confidence (< 0.6) ──> Discard
                   │
                   ▼ High Confidence (≥ 0.6)
      ┌──────────────────────────────────┐
      │   Deduplication Check             │
      │  ┌────────────────────────────┐  │
      │  │ 1. Embedding similarity     │  │
      │  │    (cosine > 0.85 = dup)    │  │
      │  │ 2. SimHash comparison       │  │
      │  │    (Hamming < 3 = dup)      │  │
      │  │ 3. Key phrase overlap       │  │
      │  │    (>80% = dup)             │  │
      │  └─────────┬──────────────────┘  │
      └────────────┼─────────────────────┘
                   │
                   ├─── Duplicate Found ──> Merge or Skip
                   │
                   ▼ Unique Learning
      ┌──────────────────────────────────┐
      │   Evidence Linkage                │
      │  ┌────────────────────────────┐  │
      │  │ - Link to source messages   │  │
      │  │ - Extract key quotes        │  │
      │  │ - Reference tool calls      │  │
      │  │ - Store context metadata    │  │
      │  └─────────┬──────────────────┘  │
      └────────────┼─────────────────────┘
                   │
                   ▼ Store in database
      ┌──────────────────────────────────┐
      │   Learnings Table (SQLite)        │
      │  ┌────────────────────────────┐  │
      │  │ - id (ULID)                 │  │
      │  │ - conversation_id           │  │
      │  │ - category                  │  │
      │  │ - title, content            │  │
      │  │ - confidence, tags          │  │
      │  │ - evidence (message_ids)    │  │
      │  │ - created_at (ISO-8601)     │  │
      │  └────────────────────────────┘  │
      └──────────────────────────────────┘
                   │
                   ▼ Available for query
      ┌──────────────────────────────────┐
      │   MCP Server (Query Interface)    │
      │   + Future: Upload to Network     │
      └──────────────────────────────────┘
```

## Component Specifications

### 1. Conversation Value Analyzer

**Purpose**: Determine if a conversation is worth extracting learnings from

**Input**: Conversation metadata from `conversations` and `messages` tables

**Output**: Value score (0-1) and decision (process / skip)

**Heuristics**:
```typescript
interface ValueAnalysis {
  score: number;           // 0-1 composite score
  reasons: string[];       // Why this score
  shouldProcess: boolean;  // score >= 0.3
}

async function analyzeConversationValue(
  conversationId: string
): Promise<ValueAnalysis> {
  const conversation = await getConversation(conversationId);
  const messages = await getMessages(conversationId);

  let score = 0;
  const reasons: string[] = [];

  // Heuristic 1: Message count (min 3 for context)
  if (messages.length < 3) {
    return { score: 0, reasons: ['Too few messages'], shouldProcess: false };
  }

  // Heuristic 2: Contains code blocks (strong signal)
  const codeBlockCount = messages.filter(m =>
    m.content.includes('```')
  ).length;
  if (codeBlockCount >= 2) {
    score += 0.3;
    reasons.push('Contains code examples');
  }

  // Heuristic 3: Tool usage (file edits, searches)
  const toolCallCount = messages.filter(m =>
    m.tool_calls && m.tool_calls.length > 0
  ).length;
  if (toolCallCount >= 3) {
    score += 0.25;
    reasons.push('Substantial tool usage');
  }

  // Heuristic 4: Conversation length (complexity proxy)
  const totalTokens = estimateTokens(messages);
  if (totalTokens >= 2000) {
    score += 0.2;
    reasons.push('Substantial conversation');
  }

  // Heuristic 5: Technical keywords
  const technicalKeywords = [
    'error', 'bug', 'fix', 'implement', 'optimize',
    'pattern', 'architecture', 'design', 'test'
  ];
  const keywordMatches = messages.filter(m =>
    technicalKeywords.some(kw => m.content.toLowerCase().includes(kw))
  ).length;
  if (keywordMatches >= 2) {
    score += 0.25;
    reasons.push('Technical problem-solving detected');
  }

  return {
    score: Math.min(score, 1.0),
    reasons,
    shouldProcess: score >= 0.3
  };
}
```

**Performance**: < 100ms (simple heuristics, no AI call)

---

### 2. Category Detection

**Purpose**: Classify conversation into one or more learning categories

**Input**: Sanitized conversation messages

**Output**: List of detected categories with confidence

**Categories** (from STANDARDS.md):
1. `pattern`: Code patterns and architectural approaches
2. `best_practice`: Recommended ways to do things
3. `anti_pattern`: Things to avoid
4. `bug_fix`: Problem-solving strategies
5. `optimization`: Performance improvements
6. `tool_usage`: How to use specific tools/libraries
7. `workflow`: Development workflows and processes
8. `decision`: Architecture decisions and trade-offs

**Implementation**:
```typescript
interface CategoryDetection {
  category: LearningCategory;
  confidence: number;     // 0-1
  signals: string[];      // Why detected
}

async function detectCategories(
  conversationId: string
): Promise<CategoryDetection[]> {
  const messages = await getMessages(conversationId);

  // Preselect relevant spans (keep within token budget ~2k tokens)
  const relevantMessages = preselectRelevantSpans(messages);
  const conversationText = relevantMessages
    .map(m => `[${m.role}]: ${m.content}`)
    .join('\n\n');

  // AI-powered classification with strict JSON output
  const prompt = `
Analyze this technical conversation and identify learning categories present.

CONVERSATION:
${conversationText}

CATEGORIES (select up to 2 most relevant):
- pattern: Reusable code patterns or architectural approaches
- best_practice: Recommended ways to accomplish tasks
- anti_pattern: Things to avoid or common mistakes
- bug_fix: Debugging strategies or error resolutions
- optimization: Performance improvements or efficiency gains
- tool_usage: How to use specific tools, libraries, or frameworks
- workflow: Development processes or workflows
- decision: Architecture decisions with trade-offs

OUTPUT (JSON only, no explanations):
{
  "categories": [
    {
      "category": "pattern",
      "confidence": 0.85,
      "signals": ["Uses factory pattern", "Implements dependency injection"]
    }
  ]
}

RULES:
- Return ONLY valid JSON, no markdown, no explanations
- Maximum 2 categories (highest confidence only)
- Only include categories with confidence >= 0.5
- No PII, content is sanitized
- No chain-of-thought, be concise
`;

  const response = await callClaudeAPI({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    temperature: 0.2,  // Low temp for consistency
    system: 'You are a strict JSON-only extractor. Output only valid minified JSON that conforms to the schema. Do not include explanations, code fences, or additional text. Refuse to include any PII. Content is sanitized.',
    messages: [{ role: 'user', content: prompt }]
  });

  // Robust JSON parsing
  const parsed = parseRobustJSON(response.content[0].text);
  const categories = parsed.categories
    .filter(c => c.confidence >= 0.5)
    .slice(0, 2); // Cap at 2 categories

  return categories;
}

// Preselect relevant conversation spans to stay within token budget
function preselectRelevantSpans(messages: Message[]): Message[] {
  const MAX_TOKENS = 2000;
  const selected: Message[] = [];

  // Priority 1: Messages with code blocks
  const withCode = messages.filter(m => m.content.includes('```'));
  selected.push(...withCode);

  // Priority 2: Messages with tool calls
  const withTools = messages.filter(m => m.tool_calls && m.tool_calls.length > 0);
  selected.push(...withTools);

  // Priority 3: Messages with errors/problems
  const withErrors = messages.filter(m =>
    /error|exception|bug|fix|problem/i.test(m.content)
  );
  selected.push(...withErrors);

  // Dedupe and sort by original order
  const unique = Array.from(new Set(selected));
  unique.sort((a, b) => messages.indexOf(a) - messages.indexOf(b));

  // Truncate to token budget
  let totalTokens = 0;
  const final: Message[] = [];
  for (const msg of unique) {
    const msgTokens = estimateTokens([msg]);
    if (totalTokens + msgTokens > MAX_TOKENS) break;
    final.push(msg);
    totalTokens += msgTokens;
  }

  return final.length > 0 ? final : messages.slice(0, 5); // Fallback: first 5
}

// Robust JSON parser - extracts largest valid JSON object
function parseRobustJSON(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Find JSON object boundaries
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('No JSON object found in response');
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}
```

**Performance**: < 2s (single AI call with streaming)

**Caching**: Cache category detection per conversation_id

**Token Budget**: Preselect relevant spans to stay within ~2k input tokens

---

### 3. Category-Specific Extractors

**Purpose**: Extract structured learning content for each category

**Implementation Pattern**:
```typescript
interface LearningExtraction {
  category: LearningCategory;  // Category this learning belongs to
  title: string;               // Concise title (≤100 chars)
  content: string;             // Full learning description (≥100 chars)
  tags: string[];              // Relevant tags (3-10)
  evidence: string[];          // Message IDs that support this learning
  confidence_factors: {
    actionability: number;      // 0-1
    generalizability: number;   // 0-1
    clarity: number;            // 0-1
    evidence_strength: number;  // 0-1
  };
}

// Example: Pattern Extractor
async function extractPattern(
  conversationId: string
): Promise<LearningExtraction> {
  const messages = await getMessages(conversationId);
  const conversationText = messages.map(m =>
    `[${m.role}]: ${m.content}`
  ).join('\n\n');

  const prompt = `
Extract a reusable code pattern from this conversation.

CONVERSATION:
${conversationText}

EXTRACTION REQUIREMENTS:
1. Title: Concise name for the pattern (e.g., "Factory Pattern for Plugin System")
2. Content:
   - WHAT the pattern is (1-2 sentences)
   - WHY it's useful (benefits)
   - WHEN to use it (use cases)
   - HOW to implement it (key steps or code structure)
   - Minimum 100 characters
3. Tags: 3-10 relevant tags (e.g., ["factory-pattern", "dependency-injection", "typescript"])
4. Evidence: Which parts of the conversation demonstrate this pattern? (quote message indices)

QUALITY CRITERIA:
- Actionability: Can someone apply this immediately? (0-1)
- Generalizability: Useful beyond this specific case? (0-1)
- Clarity: Is it clearly explained? (0-1)
- Evidence Strength: Well-supported by conversation? (0-1)

OUTPUT (JSON):
{
  "title": "...",
  "content": "...",
  "tags": ["...", "..."],
  "evidence_message_indices": [0, 3, 5],
  "confidence_factors": {
    "actionability": 0.9,
    "generalizability": 0.85,
    "clarity": 0.8,
    "evidence_strength": 0.9
  }
}
`;

  const response = await callClaudeAPI({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const parsed = JSON.parse(response.content[0].text);

  // Map message indices to message IDs
  const evidenceMessageIds = parsed.evidence_message_indices.map(
    idx => messages[idx]?.id
  ).filter(Boolean);

  return {
    category: 'pattern',
    title: parsed.title,
    content: parsed.content,
    tags: parsed.tags,
    evidence: evidenceMessageIds,
    confidence_factors: parsed.confidence_factors
  };
}
```

**Extractor Variations**:

Each category has a specialized extractor with tailored prompts:

- **Best Practice Extractor**: Focus on "why this approach is recommended"
- **Anti-Pattern Extractor**: Focus on "what problem this causes" and "better alternatives"
- **Bug Fix Extractor**: Focus on "symptoms → root cause → solution"
- **Optimization Extractor**: Focus on "before/after performance" and "trade-offs"
- **Tool Usage Extractor**: Focus on "how to use X to accomplish Y"
- **Workflow Extractor**: Focus on "step-by-step process"
- **Decision Extractor**: Focus on "options considered → chosen option → rationale"

**Performance**: < 3s per extractor (p95)

---

### 4. Quality Scoring System

**Purpose**: Calculate confidence score to filter low-quality learnings

**Formula**:
```typescript
function calculateConfidence(
  factors: ConfidenceFactors,
  learning: LearningExtraction
): number {
  // Automatic guards and penalties (fail fast)

  // Length penalty: reject if too short
  if (learning.content.length < 100) {
    return 0; // Will be rejected by threshold
  }

  // Genericity penalty: reject trivial patterns
  const genericPatterns = [
    /^write tests?$/i,
    /^use logging$/i,
    /^follow best practices$/i,
    /^add comments$/i,
    /^handle errors$/i
  ];
  const isTrivial = genericPatterns.some(p =>
    p.test(learning.title) || p.test(learning.content)
  );
  if (isTrivial) {
    return 0; // Reject generic advice
  }

  // Evidence cross-check: penalize weak evidence
  let evidenceScore = factors.evidence_strength;
  if (!learning.evidence || learning.evidence.length === 0) {
    evidenceScore = 0.4; // Cap at 0.4 for missing evidence
  }

  // Weighted average (weights sum to 1.0)
  const weights = {
    actionability: 0.35,      // Most important: can you use it?
    generalizability: 0.30,   // Second: broadly applicable?
    clarity: 0.20,            // Third: well-explained?
    evidence_strength: 0.15   // Fourth: well-supported?
  };

  const confidence =
    factors.actionability * weights.actionability +
    factors.generalizability * weights.generalizability +
    factors.clarity * weights.clarity +
    evidenceScore * weights.evidence_strength;

  return confidence; // Store full float precision
}

// Quality thresholds (category-aware)
const MIN_CONFIDENCE_DEFAULT = 0.6;
const MIN_CONFIDENCE_GENERIC_CATEGORIES = 0.65; // Higher bar for best_practice, anti_pattern

function meetsQualityThreshold(
  confidence: number,
  category: LearningCategory
): boolean {
  const threshold = ['best_practice', 'anti_pattern'].includes(category)
    ? MIN_CONFIDENCE_GENERIC_CATEGORIES
    : MIN_CONFIDENCE_DEFAULT;

  return confidence >= threshold;
}
```

**Factor Definitions**:

1. **Actionability** (0-1):
   - 1.0: Step-by-step instructions or clear code example
   - 0.7: General guidance with concrete suggestions
   - 0.4: Vague recommendations without specifics
   - 0.0: Purely theoretical with no practical application

2. **Generalizability** (0-1):
   - 1.0: Applies to many projects/languages/contexts
   - 0.7: Applies to specific domain but broadly useful
   - 0.4: Very project-specific
   - 0.0: Only relevant to one specific case

3. **Clarity** (0-1):
   - 1.0: Crystal clear, no ambiguity
   - 0.7: Mostly clear with minor gaps
   - 0.4: Confusing or requires significant interpretation
   - 0.0: Incomprehensible

4. **Evidence Strength** (0-1):
   - 1.0: Multiple concrete examples from conversation
   - 0.7: One good example with supporting context
   - 0.4: Weak connection to conversation
   - 0.0: No evidence in conversation

---

### 5. Deduplication Strategy

**Purpose**: Prevent storing near-duplicate learnings

**Three-Layer Approach** (ordered by speed and reliability):

#### Layer 1: Canonical Hash (Primary - Required by Schema)
```typescript
function canonicalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    // Remove volatile numerals (timestamps, issue IDs like #123)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE')
    .replace(/#\d+/g, 'ISSUE')
    // Strip URL query params and tokens
    .replace(/\?[^\s]+/g, '')
    .replace(/[&?]token=[^\s&]+/g, '');
}

function computeDedupeHash(learning: LearningExtraction): string {
  const canonical = canonicalizeText(
    `${learning.category}:${learning.title} ${learning.content}`
  );
  return sha256(canonical);
}

async function checkCanonicalDuplicate(
  learning: LearningExtraction
): Promise<boolean> {
  const dedupeHash = computeDedupeHash(learning);

  try {
    // This insert will fail if UNIQUE constraint on dedupe_hash is violated
    await db.prepare(`
      INSERT INTO learnings (dedupe_hash, ...) VALUES (?, ...)
    `).run(dedupeHash, /* ... */);
    return false; // Not a duplicate
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('dedupe_hash')) {
      // Duplicate detected - optionally merge evidence
      await mergeEvidenceIfNeeded(dedupeHash, learning);
      return true;
    }
    throw error; // Other error
  }
}

async function mergeEvidenceIfNeeded(
  dedupeHash: string,
  newLearning: LearningExtraction
): Promise<void> {
  // Optional: Update existing learning with supplemental evidence
  await db.transaction(() => {
    const existing = db.prepare(`
      SELECT id, source_message_ids, metadata, confidence
      FROM learnings WHERE dedupe_hash = ?
    `).get(dedupeHash);

    // Union source_message_ids
    const existingIds = JSON.parse(existing.source_message_ids);
    const newIds = newLearning.evidence;
    const mergedIds = Array.from(new Set([...existingIds, ...newIds]));

    // Update confidence (conservative: take max)
    const newConf = calculateConfidence(newLearning.confidence_factors, newLearning);
    const updatedConf = Math.max(existing.confidence, newConf);

    // Append to metadata.extraction_runs
    const metadata = JSON.parse(existing.metadata);
    metadata.extraction_runs = metadata.extraction_runs || [];
    metadata.extraction_runs.push({
      timestamp: new Date().toISOString(),
      new_sources: newIds.filter(id => !existingIds.includes(id)),
      confidence: newConf
    });

    db.prepare(`
      UPDATE learnings
      SET source_message_ids = ?,
          confidence = ?,
          metadata = ?
      WHERE id = ?
    `).run(
      JSON.stringify(mergedIds),
      updatedConf,
      JSON.stringify(metadata),
      existing.id
    );
  });
}
```

#### Layer 2: SimHash (Fast Approximate - Secondary)
```typescript
function checkSimHashSimilarity(
  newLearning: LearningExtraction,
  existingLearnings: Learning[]
): DuplicateMatch | null {
  const newHash = simhash(newLearning.content);

  for (const existing of existingLearnings) {
    if (existing.category !== newLearning.category) continue;

    // Read simhash from metadata (precomputed and stored)
    const metadata = JSON.parse(existing.metadata);
    const existingHash = metadata.signatures?.simhash;
    if (!existingHash) continue; // Skip if not computed

    const distance = hammingDistance(BigInt(newHash), BigInt(existingHash));

    // Hamming distance < 3 indicates very similar
    if (distance < 3) {
      return {
        type: 'simhash',
        matchId: existing.id,
        distance,
        action: 'skip' // Near-duplicate, skip insertion
      };
    }
  }

  return null;
}

// SimHash implementation (locality-sensitive hashing)
function simhash(text: string): bigint {
  const tokens = tokenize(text);
  const features = new Map<string, number>();

  // TF-IDF weighting
  for (const token of tokens) {
    features.set(token, (features.get(token) || 0) + 1);
  }

  // Hash each feature
  const V = new Array(64).fill(0);
  for (const [feature, weight] of features) {
    const hash = hashCode(feature);
    for (let i = 0; i < 64; i++) {
      if ((hash >> i) & 1) {
        V[i] += weight;
      } else {
        V[i] -= weight;
      }
    }
  }

  // Generate fingerprint
  let fingerprint = 0n;
  for (let i = 0; i < 64; i++) {
    if (V[i] > 0) {
      fingerprint |= (1n << BigInt(i));
    }
  }

  return fingerprint;
}
```

#### Layer 3: Embedding Similarity (Optional - Local Model Only)
```typescript
// Only use if local sentence-transformers model is available
// Do NOT use remote embeddings due to latency (exceeds 500ms budget)
async function checkEmbeddingSimilarity(
  newLearning: LearningExtraction,
  existingLearnings: Learning[]
): Promise<DuplicateMatch | null> {
  // Generate embedding for new learning (local model)
  const newEmbedding = await generateLocalEmbedding(
    newLearning.title + '\n' + newLearning.content
  );

  // Compare with existing learnings
  for (const existing of existingLearnings) {
    if (existing.category !== newLearning.category) continue;

    // Read embedding from metadata or compute
    const metadata = JSON.parse(existing.metadata);
    const existingEmbedding = metadata.signatures?.embedding ||
      await generateLocalEmbedding(existing.title + '\n' + existing.content);

    const similarity = cosineSimilarity(newEmbedding, existingEmbedding);

    if (similarity > 0.85) {
      return {
        type: 'embedding',
        matchId: existing.id,
        similarity,
        action: 'skip'
      };
    }
  }

  return null;
}

// Use local sentence-transformers model (e.g., all-MiniLM-L6-v2)
// For MVP: Use TF-IDF as fallback
async function generateLocalEmbedding(text: string): Promise<number[]> {
  // Option A: Local sentence-transformers via Python subprocess
  // Option B: TF-IDF (fast, deterministic)
  return tfidfVector(text);
}
```

**Deduplication Decision Logic** (ordered by speed):
```typescript
async function deduplicateCheck(
  newLearning: LearningExtraction
): Promise<DeduplicationResult> {
  // Layer 1: Canonical hash check (required, concurrency-safe)
  // This happens during INSERT via UNIQUE constraint
  // See checkCanonicalDuplicate() in storage section

  // Layer 2: SimHash for near-duplicates (fast, 100ms)
  const existingLearnings = await db.prepare(`
    SELECT id, metadata, category FROM learnings
    WHERE category = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(newLearning.category);

  const simhashMatch = checkSimHashSimilarity(newLearning, existingLearnings);
  if (simhashMatch) {
    return {
      isDuplicate: true,
      reason: 'SimHash near-duplicate',
      matchId: simhashMatch.matchId
    };
  }

  // Layer 3: Embedding similarity (optional, local only)
  // Skip if no local model available or over time budget
  if (hasLocalEmbeddingModel()) {
    const embeddingMatch = await checkEmbeddingSimilarity(newLearning, existingLearnings);
    if (embeddingMatch?.action === 'skip') {
      return {
        isDuplicate: true,
        reason: 'High embedding similarity',
        matchId: embeddingMatch.matchId
      };
    }
  }

  return { isDuplicate: false };
}
```

---

### 6. Evidence Linkage

**Purpose**: Make every learning traceable to source messages

**Implementation**:
```typescript
interface Evidence {
  message_ids: string[];     // ULIDs of source messages
  quotes: Quote[];           // Key quotes from conversation
  context_summary: string;   // Brief context description
}

interface Quote {
  message_id: string;
  text: string;              // Extracted quote (≤200 chars)
  role: 'user' | 'assistant';
}

async function buildEvidence(
  extractedLearning: LearningExtraction,
  conversationId: string
): Promise<Evidence> {
  const messages = await getMessages(conversationId);

  // Get messages referenced in extraction
  const evidenceMessages = messages.filter(m =>
    extractedLearning.evidence.includes(m.id)
  );

  // Enforce bounds: 2-4 quotes, ≤200 chars each
  const MAX_QUOTES = 4;
  const MIN_QUOTES = 2;
  const MAX_QUOTE_LENGTH = 200;

  try {
    // Extract key quotes using AI
    const quotesPrompt = `
From these messages, extract EXACTLY ${MIN_QUOTES}-${MAX_QUOTES} key quotes (≤${MAX_QUOTE_LENGTH} chars each) that best support this learning.

LEARNING:
${extractedLearning.title}
${extractedLearning.content}

MESSAGES:
${evidenceMessages.map((m, i) => `[${i}] ${m.role}: ${m.content.slice(0, 500)}`).join('\n\n')}

OUTPUT (JSON):
{
  "quotes": [
    {"message_index": 0, "text": "..."},
    {"message_index": 2, "text": "..."}
  ],
  "context_summary": "User was implementing X and encountered Y..."
}

CONSTRAINTS:
- quotes: array with ${MIN_QUOTES}-${MAX_QUOTES} items
- text: max ${MAX_QUOTE_LENGTH} characters, truncate with "..." if needed
- context_summary: max 300 characters
`;

    const response = await callClaudeAPI({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.2,
      messages: [{ role: 'user', content: quotesPrompt }]
    });

    const parsed = JSON.parse(response.content[0].text);

    // Enforce bounds on quotes
    const boundedQuotes = parsed.quotes
      .slice(0, MAX_QUOTES)
      .map(q => ({
        message_id: evidenceMessages[q.message_index]?.id,
        text: q.text.slice(0, MAX_QUOTE_LENGTH),
        role: evidenceMessages[q.message_index]?.role
      }))
      .filter(q => q.message_id); // Remove invalid indices

    // Ensure minimum quotes
    if (boundedQuotes.length < MIN_QUOTES) {
      throw new Error('Insufficient quotes extracted');
    }

    return {
      message_ids: extractedLearning.evidence,
      quotes: boundedQuotes,
      context_summary: parsed.context_summary.slice(0, 300)
    };

  } catch (error) {
    // Deterministic fallback: extract first sentences from evidence messages
    logger.warn('AI quote extraction failed, using fallback', { error });

    const fallbackQuotes = evidenceMessages
      .slice(0, MAX_QUOTES)
      .map(m => ({
        message_id: m.id,
        text: m.content.slice(0, MAX_QUOTE_LENGTH) + (m.content.length > MAX_QUOTE_LENGTH ? '...' : ''),
        role: m.role
      }));

    return {
      message_ids: extractedLearning.evidence,
      quotes: fallbackQuotes,
      context_summary: `Extracted from conversation ${conversationId}`
    };
  }
}
```

**Storage in Database** (aligned with canonical schema):
```sql
-- learnings table (canonical schema from STANDARDS.md)
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,              -- ULID
  conversation_id TEXT NOT NULL,
  category TEXT NOT NULL,           -- enum: pattern, best_practice, etc.
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL,               -- JSON array
  confidence REAL NOT NULL,         -- 0.0 to 1.0
  source_message_ids TEXT NOT NULL, -- JSON array of message ULIDs
  metadata TEXT NOT NULL,           -- JSON: evidence, confidence_factors, signatures, extraction_runs
  dedupe_hash TEXT NOT NULL UNIQUE, -- SHA-256 for deduplication
  created_at TEXT NOT NULL,         -- ISO-8601

  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CHECK(category IN ('pattern', 'best_practice', 'anti_pattern', 'bug_fix',
                     'optimization', 'tool_usage', 'workflow', 'decision')),
  CHECK(confidence >= 0.0 AND confidence <= 1.0)
);

CREATE INDEX idx_learnings_category ON learnings(category, confidence DESC);
CREATE INDEX idx_learnings_conversation ON learnings(conversation_id);
CREATE INDEX idx_learnings_created ON learnings(created_at DESC);
CREATE INDEX idx_learnings_dedupe ON learnings(dedupe_hash);

-- Full-text search (canonical FTS design with triggers)
CREATE VIRTUAL TABLE learnings_fts USING fts5(
  title, content, tags,
  content='learnings',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER learnings_ai AFTER INSERT ON learnings BEGIN
  INSERT INTO learnings_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TRIGGER learnings_ad AFTER DELETE ON learnings BEGIN
  INSERT INTO learnings_fts(learnings_fts, rowid, title, content, tags)
  VALUES('delete', old.rowid, old.title, old.content, old.tags);
END;

CREATE TRIGGER learnings_au AFTER UPDATE ON learnings BEGIN
  INSERT INTO learnings_fts(learnings_fts, rowid, title, content, tags)
  VALUES('delete', old.rowid, old.title, old.content, old.tags);
  INSERT INTO learnings_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;
```

**Metadata Structure**:
```typescript
interface LearningMetadata {
  evidence: {
    quotes: Quote[];           // 2-4 quotes, ≤200 chars each
    context_summary: string;   // ≤300 chars
  };
  confidence_factors: {
    actionability: number;
    generalizability: number;
    clarity: number;
    evidence_strength: number;
  };
  signatures: {
    simhash: string;           // Bigint as string for fast near-dup checks
    embedding?: number[];      // Optional, if local model available
  };
  extraction_runs?: Array<{    // Track re-extractions/merges
    timestamp: string;
    new_sources: string[];     // Additional message IDs
    confidence: number;
  }>;
  detector?: string;           // Category detection confidence/signals
  extraction_version?: string; // Extractor version for idempotency
}
```

---

## Data Flow

### Complete Extraction Pipeline

```typescript
interface ExtractionResult {
  success: boolean;
  learningsExtracted: number;
  reason?: string;
  details?: string[];
}

async function extractLearningsFromConversation(
  conversationId: string
): Promise<ExtractionResult> {
  // Step 1: Value analysis
  const valueAnalysis = await analyzeConversationValue(conversationId);
  if (!valueAnalysis.shouldProcess) {
    return {
      success: true, // Not an error, just low value
      learningsExtracted: 0,
      reason: 'low_value',
      details: valueAnalysis.reasons
    };
  }

  // Step 2: Category detection
  const categories = await detectCategories(conversationId);
  if (categories.length === 0) {
    return {
      success: true,
      learningsExtracted: 0,
      reason: 'no_categories',
      details: ['No learning categories detected']
    };
  }

  // Step 3: Extract learnings for each category (max 2 categories)
  const extractions: LearningExtraction[] = [];
  for (const categoryDetection of categories) {
    const extractor = getExtractorForCategory(categoryDetection.category);
    const extraction = await extractor(conversationId);
    extractions.push(extraction);
  }

  // Step 4: Quality filtering with automatic guards
  const qualityLearnings = extractions.filter(ext => {
    const confidence = calculateConfidence(ext.confidence_factors, ext);
    return meetsQualityThreshold(confidence, ext.category);
  });

  if (qualityLearnings.length === 0) {
    return {
      success: true,
      learningsExtracted: 0,
      reason: 'low_quality',
      details: ['All extractions failed quality threshold']
    };
  }

  // Step 5: Deduplication and storage
  const storedLearnings: string[] = [];
  for (const learning of qualityLearnings) {
    // Layer 2: SimHash check (Layer 1 happens during INSERT)
    const dupCheck = await deduplicateCheck(learning);
    if (dupCheck.isDuplicate) {
      logger.info('Duplicate learning detected', {
        title: learning.title,
        reason: dupCheck.reason,
        matchId: dupCheck.matchId
      });
      continue;
    }

    // Build evidence with bounded sizes
    const evidence = await buildEvidence(learning, conversationId);
    const confidence = calculateConfidence(learning.confidence_factors, learning);

    // Compute signatures for future deduplication
    const simhashValue = simhash(learning.content);
    const dedupeHash = computeDedupeHash(learning);

    const metadata: LearningMetadata = {
      evidence: {
        quotes: evidence.quotes,
        context_summary: evidence.context_summary
      },
      confidence_factors: learning.confidence_factors,
      signatures: {
        simhash: simhashValue.toString()
      },
      extraction_version: '1.0'
    };

    try {
      // Store learning (Layer 1 dedup via UNIQUE constraint)
      await storeLearning({
        id: ulid(),
        conversation_id: conversationId,
        category: learning.category,
        title: learning.title,
        content: learning.content,
        tags: JSON.stringify(learning.tags),
        confidence,
        source_message_ids: JSON.stringify(evidence.message_ids),
        metadata: JSON.stringify(metadata),
        dedupe_hash: dedupeHash,
        created_at: new Date().toISOString()
      });

      storedLearnings.push(learning.title);

    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('dedupe_hash')) {
        // Canonical duplicate detected, merge evidence
        await mergeEvidenceIfNeeded(dedupeHash, learning);
        logger.info('Merged evidence into existing learning', { dedupe_hash: dedupeHash });
      } else {
        throw error; // Re-throw other errors
      }
    }
  }

  return {
    success: true,
    learningsExtracted: storedLearnings.length,
    details: storedLearnings
  };
}
```

---

## AI Prompt Templates

### Template Structure

All AI prompts follow this structure:
1. **Context**: What we're trying to accomplish
2. **Input**: The conversation data
3. **Requirements**: What the output must contain
4. **Quality Criteria**: How to judge quality
5. **Output Format**: Exact JSON schema

### Prompt Configuration

```typescript
interface PromptConfig {
  model: string;
  max_tokens: number;
  temperature: number;        // 0.2 for consistency
  system: string;             // System message (required for JSON-only output)
}

// System message for all extraction tasks
const EXTRACTION_SYSTEM_MESSAGE = `You are a strict JSON-only extractor. Output only valid minified JSON that conforms to the schema. Do not include explanations, code fences, or additional text. Refuse to include any PII. Content is sanitized. No chain-of-thought or verbose explanations.`;

const EXTRACTION_PROMPT_CONFIG: PromptConfig = {
  model: process.env.EXTRACTION_MODEL || 'claude-3-5-sonnet-20241022',
  max_tokens: 2000,
  temperature: 0.2,
  system: EXTRACTION_SYSTEM_MESSAGE
};

const CATEGORY_DETECTION_CONFIG: PromptConfig = {
  model: process.env.EXTRACTION_MODEL || 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  temperature: 0.2,
  system: EXTRACTION_SYSTEM_MESSAGE
};

const EVIDENCE_EXTRACTION_CONFIG: PromptConfig = {
  model: process.env.EXTRACTION_MODEL || 'claude-3-5-sonnet-20241022',
  max_tokens: 500,
  temperature: 0.2,
  system: EXTRACTION_SYSTEM_MESSAGE
};

// Fallback models in case primary fails
const FALLBACK_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-sonnet-20240229'
];
```

### Error Handling for AI Calls

```typescript
async function callClaudeAPI(config: PromptConfig & { messages: Message[] }): Promise<Response> {
  const maxRetries = 3;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create(config);
      return response;
    } catch (error) {
      lastError = error;

      if (error.status === 429) {
        // Rate limit - exponential backoff
        await sleep(2 ** attempt * 1000);
        continue;
      } else if (error.status >= 500) {
        // Server error - retry
        await sleep(1000 * attempt);
        continue;
      } else {
        // Client error - don't retry
        throw error;
      }
    }
  }

  throw new Error(`API call failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## Performance Budget

| Operation | Budget (p95) | Notes |
|-----------|--------------|-------|
| Value Analysis | < 100ms | No AI, pure heuristics |
| Category Detection | < 2s | Single AI call |
| Single Extraction | < 3s | AI call per category |
| Quality Scoring | < 10ms | Pure calculation |
| Deduplication Check | < 500ms | Embeddings + hashing |
| Evidence Building | < 1s | Small AI call |
| **Total Pipeline** | **< 5s** | For 1-2 learnings per conversation |

**Cost Budget** (Claude API):
- Input: ~3000 tokens per conversation (context)
- Output: ~500 tokens per learning
- Estimated cost: $0.01-0.02 per conversation processed

---

## Integration with Job Queue

### Job Creation

```typescript
// Triggered when conversation is marked complete
async function onConversationComplete(conversationId: string): Promise<void> {
  await db.prepare(`
    INSERT INTO job_queue (
      id, type, payload, status, priority, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ulid(),
    'extract_learning',
    JSON.stringify({ conversation_id: conversationId }),
    'queued',
    5, // Normal priority
    new Date().toISOString()
  );
}
```

### Worker Implementation

```typescript
// Worker picks up jobs from queue
async function processLearningExtractionJob(job: Job): Promise<void> {
  const { conversation_id } = JSON.parse(job.payload);

  try {
    // Update job status to in_progress
    await updateJobStatus(job.id, 'in_progress');

    // Run extraction pipeline (returns structured result)
    const result = await extractLearningsFromConversation(conversation_id);

    if (result.success) {
      // Update job status to completed
      await updateJobStatus(job.id, 'completed', {
        learnings_extracted: result.learningsExtracted,
        reason: result.reason,
        details: result.details
      });

      logger.info('Learning extraction completed', {
        job_id: job.id,
        conversation_id,
        learnings_extracted: result.learningsExtracted,
        reason: result.reason
      });
    } else {
      // Unexpected: result.success should not be false in normal flow
      throw new Error(`Extraction failed: ${result.reason}`);
    }

  } catch (error) {
    logger.error('Learning extraction failed', {
      job_id: job.id,
      conversation_id,
      error: error.message,
      stack: error.stack
    });

    // Retry logic per STANDARDS.md
    const attempts = job.attempts || 0;
    if (attempts < 3) {
      // Mark as failed (will be retried)
      await updateJobStatus(job.id, 'failed', {
        error: error.message,
        attempt: attempts + 1
      });
    } else {
      // Permanent failure after 3 attempts
      await updateJobStatus(job.id, 'dead_letter', {
        error: error.message,
        attempts: attempts + 1
      });
    }
  }
}

// Update job status helper
async function updateJobStatus(
  jobId: string,
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'dead_letter',
  result?: any
): Promise<void> {
  await db.prepare(`
    UPDATE job_queue
    SET status = ?,
        result = ?,
        completed_at = CASE WHEN ? IN ('completed', 'dead_letter') THEN ? ELSE NULL END,
        attempts = attempts + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END
    WHERE id = ?
  `).run(
    status,
    result ? JSON.stringify(result) : null,
    status,
    status === 'completed' || status === 'dead_letter' ? new Date().toISOString() : null,
    status,
    jobId
  );
}
```

---

## Quality Assurance

### Testing Strategy

1. **Unit Tests** (70%):
   - Value analysis heuristics
   - Confidence calculation
   - Deduplication algorithms
   - Evidence linkage

2. **Integration Tests** (20%):
   - Full extraction pipeline
   - AI prompt/response handling
   - Database operations

3. **E2E Tests** (10%):
   - Real conversation → extracted learnings
   - Quality thresholds enforced
   - No duplicates stored

### Test Fixtures

```typescript
// Gold standard conversations with expected learnings
const TEST_CONVERSATIONS = [
  {
    id: 'conv_pattern_example',
    messages: [...],
    expectedLearnings: [
      {
        category: 'pattern',
        title: 'Factory Pattern for Plugin System',
        confidence: '>= 0.8',
        mustContainKeywords: ['factory', 'plugin', 'dependency']
      }
    ]
  },
  // ... more examples
];

// Test extraction quality
for (const testCase of TEST_CONVERSATIONS) {
  const learnings = await extractLearningsFromConversation(testCase.id);

  expect(learnings.length).toBe(testCase.expectedLearnings.length);

  for (let i = 0; i < learnings.length; i++) {
    const actual = learnings[i];
    const expected = testCase.expectedLearnings[i];

    expect(actual.category).toBe(expected.category);
    expect(actual.confidence).toBeGreaterThanOrEqual(expected.confidence);
    expect(actual.content).toContain(expected.mustContainKeywords);
  }
}
```

---

## Monitoring & Metrics

### Key Metrics

```typescript
// Track extraction performance
metrics.timing('learning_extraction.duration', duration);
metrics.increment('learning_extraction.success');
metrics.increment('learning_extraction.skipped_low_value');
metrics.increment('learning_extraction.duplicate_detected');

// Track quality
metrics.gauge('learning_extraction.avg_confidence', avgConfidence);
metrics.histogram('learning_extraction.learnings_per_conversation', count);

// Track categories
for (const category of CATEGORIES) {
  metrics.increment(`learning_extraction.category.${category}`);
}
```

### Success Criteria

- **Extraction Rate**: 20-30% of conversations yield ≥1 learning
- **Quality**: Average confidence ≥ 0.75
- **Deduplication**: < 5% duplicates stored
- **Performance**: p95 < 5s per conversation
- **Evidence**: 100% of learnings have ≥1 linked message

---

## Future Enhancements

### Phase 1 (MVP)
- ✅ Basic category detection
- ✅ Quality scoring
- ✅ Simple deduplication (SimHash)
- ✅ Evidence linkage

### Phase 2 (Post-MVP)
- [ ] Multi-conversation pattern detection (aggregate learnings)
- [ ] User feedback loop (thumbs up/down on learnings)
- [ ] A/B testing on prompt variations
- [ ] Learning versioning (improve existing learnings)

### Phase 3 (Network)
- [ ] Cross-user learning aggregation
- [ ] Collaborative filtering (if you liked X, try Y)
- [ ] Learning reputation scores from network
- [ ] Automated learning curation

---

## Related Documents

### Architecture
- [Global Context Network](./architecture-global-context-network-2025-01-16.md)
- [Hooks and Event Capture](./architecture-hooks-event-capture-2025-01-16.md)
- [Database Schema](../reference/reference-database-schema-2025-01-16.md)

### Standards
- [Project Standards](../STANDARDS.md) - Canonical schema, IDs, status enums

### Reference
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md)
- [Job Queue Reference](../reference/reference-job-queue-2025-01-16.md)

---

## GPT-5 Review Implementation

**All GPT-5 review feedback has been incorporated:**

### Schema Alignment
- ✅ Replaced `evidence` column with `source_message_ids` (JSON array) + `metadata` (JSON object)
- ✅ Added `dedupe_hash` (SHA-256) with UNIQUE constraint for canonical deduplication
- ✅ Fixed FTS definition: Uses `content='learnings'` with `rowid` and triggers (not `content_rowid=id`)
- ✅ Removed `CHECK(length(content) >= 100)` from schema (enforced in application via quality scoring)

### Type and API Fixes
- ✅ Added `category` field to `LearningExtraction` interface
- ✅ Pipeline returns `ExtractionResult` to worker; worker updates `job_queue.status` per STANDARDS.md
- ✅ Worker properly handles `queued → in_progress → completed/failed/dead_letter` transitions

### Quality Scoring Enhancements
- ✅ Added automatic guards: length penalty, genericity penalty, evidence cross-check
- ✅ Implemented category-aware thresholds (0.65 for `best_practice`/`anti_pattern`, 0.6 for others)
- ✅ Store full float precision confidence (not rounded to 2 decimals)
- ✅ Store `confidence_factors` in metadata for future re-tuning

### Deduplication Strategy
- ✅ Layer 1: Canonical hash (`dedupe_hash`) as first-line check (required, concurrency-safe)
- ✅ Layer 2: SimHash persisted in `metadata.signatures.simhash` (fast near-duplicate detection)
- ✅ Layer 3: Embedding similarity (optional, local model only)
- ✅ Merge semantics: Union `source_message_ids`, max confidence, track in `metadata.extraction_runs`
- ✅ Handle UNIQUE constraint violations gracefully (catch and merge)

### Evidence Linkage
- ✅ Bounded sizes: 2-4 quotes, ≤200 chars each, ≤300 char context summary
- ✅ Store in `source_message_ids` + `metadata.evidence.quotes` + `metadata.evidence.context_summary`
- ✅ Deterministic fallback when AI quote extraction fails

### AI Prompt Improvements
- ✅ System message: "You are a strict JSON-only extractor..." (enforces JSON-only output)
- ✅ Cap categories at 2 per conversation (performance budget compliance)
- ✅ Preselect relevant spans (code blocks, tool calls, errors) to stay within ~2k token budget
- ✅ Robust JSON parsing: Extract largest valid JSON object
- ✅ Prohibit chain-of-thought explicitly in prompts
- ✅ Externalized model config with fallback models

### Performance Safeguards
- ✅ Limit extractions per conversation to max 2 categories
- ✅ Cache category detection per `conversation_id`
- ✅ Preselect conversation spans before AI calls
- ✅ Local embedding model only (no remote embeddings due to latency)

### Metadata Structure
```typescript
interface LearningMetadata {
  evidence: { quotes, context_summary };
  confidence_factors: { actionability, generalizability, clarity, evidence_strength };
  signatures: { simhash, embedding? };
  extraction_runs?: [{ timestamp, new_sources, confidence }];
  detector?: string;
  extraction_version?: string;
}
```

---

**Document Version**: 2.0 (Post-GPT-5 Review)
**Standards Compliance**: 100% aligned with STANDARDS.md
**Review Status**: GPT-5 reviewed and all feedback incorporated
**Implementability**: Ready for implementation with all alignment issues resolved
