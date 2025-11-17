# Phase 5: Learning Extraction Tasks

> Extract valuable learnings with quality scoring and deduplication

---
title: Phase 5 Learning Extraction Tasks
category: plan
date: 2025-01-16
status: active
tags: [phase-5, learning, extraction, quality, dedup]
---

## Goal

Extract high-quality, reusable learnings from sanitized conversations with automated quality scoring and deduplication.

## Duration

6-8 days

## Tasks

### Conversation Analyzer
- [ ] Implement value detection (is conversation worth extracting from?)
- [ ] Analyze conversation length, complexity
- [ ] Detect problem-solving patterns
- [ ] Identify code implementations
- [ ] Filter trivial conversations
- [ ] Score conversation value (0-1)

**Subagent**: `learning-extractor-agent`

**Acceptance**: Accurate filtering of trivial vs valuable conversations

### Extraction Approach Design
- [ ] Design hybrid approach (rules + LLM + embeddings)
- [ ] Create extraction prompt templates
- [ ] Define metadata schema (tags, category, provenance, version)
- [ ] Set temperature=0 for deterministic extraction
- [ ] Implement chunking for long conversations

**Acceptance**: Extraction approach documented and implemented

### Category Extractors
- [ ] Implement pattern extractor (code patterns, architectures)
- [ ] Implement best_practice extractor
- [ ] Implement anti_pattern extractor
- [ ] Implement bug_fix extractor
- [ ] Implement optimization extractor
- [ ] Implement tool_usage extractor
- [ ] Implement workflow extractor
- [ ] Implement decision extractor

**Acceptance**: All 8 category extractors working

### Quality Scoring Algorithm
- [ ] Implement confidence scoring (0-1 scale)
- [ ] Define minimum information gain metric
- [ ] Filter learnings below confidence threshold (≥ 0.6)
- [ ] Ensure learning length ≥ 100 characters
- [ ] Validate learning has actionable content
- [ ] Score uniqueness vs existing learnings

**Subagent**: `quality-filter-agent`

**Acceptance**: 90% of high-scoring learnings rated "useful" by human reviewer

### Deduplication System
- [ ] Implement lexical similarity check
- [ ] Implement embedding-based similarity (cosine)
- [ ] Set similarity threshold (< 0.85 to keep)
- [ ] Implement windowed comparison (recent N learnings)
- [ ] Provide rejection reasons (duplicate of learning_id X)
- [ ] Test edge cases (near-duplicates, rephrasing)

**Acceptance**: No duplicate learnings (verified by similarity tests)

### Metadata & Provenance
- [ ] Capture conversation_id source
- [ ] Record timestamp of extraction
- [ ] Record sanitizer_version used
- [ ] Record extractor_version used
- [ ] Capture tags (auto-generated + manual)
- [ ] Record category

**Acceptance**: All metadata fields populated

### Negative Set (Anti-Patterns)
- [ ] Define examples of trivial learnings to reject
- [ ] Build negative test dataset
- [ ] Test extractor rejects trivial/generic content
- [ ] Document criteria for rejection
- [ ] Calibrate confidence threshold using negative set

**Acceptance**: Trivial learnings filtered out

### Human-in-the-Loop Review
- [ ] Create sample review interface (CLI or simple UI)
- [ ] Review random sample of extracted learnings (N=50)
- [ ] Rate each learning as useful/not useful
- [ ] Calculate approval rate (target ≥ 90%)
- [ ] Use feedback to tune thresholds

**Acceptance**: ≥ 90% approval rate on random sample

## Dependencies

- Phase 4: Async processing to run extraction jobs

## Deliverables

1. Conversation analyzer
2. 8 category-specific extractors
3. Quality scoring algorithm
4. Deduplication system
5. Metadata schema implementation
6. Negative test dataset
7. Human review process and results

## Success Criteria

- ✅ Confidence scores ≥ 0.6 for all extracted learnings
- ✅ No duplicate learnings (similarity < 0.85)
- ✅ Proper categorization (8 categories)
- ✅ Complete metadata (provenance, version, tags)
- ✅ 90% human approval rate on sample
- ✅ Trivial learnings filtered out
- ✅ Extraction < 5s per conversation

## Learning Categories

1. **pattern**: Code patterns, architectures, design patterns
2. **best_practice**: Recommended approaches, standards
3. **anti_pattern**: What to avoid, known pitfalls
4. **bug_fix**: Problem-solving strategies, debugging
5. **optimization**: Performance improvements, efficiency
6. **tool_usage**: How to use libraries, frameworks, tools
7. **workflow**: Development workflows, processes
8. **decision**: Architecture decisions, trade-offs

## Testing Strategy

- Unit tests for each category extractor
- Integration tests for end-to-end extraction
- Quality tests with known good/bad examples
- Deduplication tests with similar content
- Performance tests (< 5s per conversation)
- Human review on random sample (N=50)

## Related Documents

- [Learning Extraction Architecture](../architecture/architecture-learning-extraction-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
