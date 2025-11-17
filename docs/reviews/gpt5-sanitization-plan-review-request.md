# GPT-5 Review Request: Sanitization Pipeline Architecture Plan

## Context

You are reviewing an architecture plan for a **2-stage sanitization pipeline** that is the MOST CRITICAL component of a privacy-first AI conversation capture system.

### Critical Background

**External Reviews Identified Critical Issue #1:**
- GPT-5 holistic review + Gemini 2.5 Pro both flagged: "Privacy contradiction - sanitize before storage vs persisting raw events"
- This is a BLOCKER for implementation
- This architecture doc must resolve the contradiction

**Canonical Standards (STANDARDS.md):**
1. **Privacy flow**: Pre-sanitize in hook (<50ms) → Persist ONLY sanitized → Optional AI validation (async)
2. **NEVER persist raw content to disk**
3. **Schema**: Write to `messages` table (no events/event_queue tables)
4. **Redaction format**: `[REDACTED_API_KEY]`, `[REDACTED_EMAIL]`, etc.
5. **Performance**: Fast sanitization <50ms, AI validation <2s

**ADR-004: Sanitize Before Storage**
- Zero-trust principle: "PII never touches disk"
- Rule: Sanitize ALL data BEFORE database insertion
- Architecture: Event Capture → Sanitization Pipeline → Database (PII never passes this gate)

### The Contradiction to Resolve

**Some existing docs show:**
- Persisting raw "content" to events table
- Generating idempotency keys using raw content
- Writing to queue before sanitization

**This plan must:**
- Align 100% with STANDARDS.md privacy flow
- Provide implementable architecture for zero-PII-leakage guarantee
- Show concrete integration with hooks, database, and job queue
- Include performance budgets and testing strategy

## Review Request

Please review the attached architecture plan for the sanitization pipeline.

### Critical Questions

1. **Alignment**: Does this architecture align 100% with STANDARDS.md and ADR-004?
   - Is the privacy flow correct? (Pre-sanitize → Persist sanitized → Optional AI validation)
   - Are there any contradictions with canonical standards?

2. **Privacy Guarantee**: Will this architecture guarantee zero PII leakage to disk?
   - Is the "raw content never persists" invariant maintained?
   - Are there any edge cases where PII could leak?
   - Is the in-memory-only approach for raw content sound?

3. **Completeness**: Are there missing components or specifications?
   - PII taxonomy comprehensive?
   - Regex patterns sufficient?
   - AI validation prompt adequate?
   - Error handling complete?

4. **Performance**: Are the budgets realistic and achievable?
   - <50ms for fast regex sanitization?
   - <100ms total hook execution?
   - <2s for AI validation?
   - Are there optimization opportunities?

5. **Integration**: Are the integration points clear?
   - How hook receives event → sanitizes → persists?
   - How job_queue triggers AI validation?
   - How messages table stores only sanitized content?
   - Database schema alignment?

6. **Testing**: Is the testing strategy sufficient?
   - Privacy invariant tests?
   - Performance benchmarks?
   - Adversarial tests?
   - End-to-end validation?

7. **Implementation Ready**: Can developers implement from this spec?
   - Are code samples complete and correct?
   - Are diagrams clear?
   - Are acceptance criteria explicit?

### Review Format

Please provide:

**1. Alignment Assessment** (Pass/Fail)
- Does it match STANDARDS.md? Specific issues if not.
- Does it match ADR-004? Specific issues if not.
- Are there any contradictions?

**2. Gap Analysis**
- What's missing from the architecture?
- What edge cases aren't covered?
- What needs more detail?

**3. Risk Assessment**
- What could go wrong with this design?
- Where could PII leak?
- What are performance risks?
- What are operational risks?

**4. Recommendations**
- Critical fixes before document creation
- Important improvements
- Nice-to-have enhancements

**5. Implementation Readiness Score** (1-10)
- Can developers implement Stage 1 (fast sanitization)?
- Can developers implement Stage 2 (AI validation)?
- Are all integration points specified?

### Success Criteria

The plan will be approved if:
- ✅ 100% alignment with STANDARDS.md
- ✅ Zero contradictions with ADR-004
- ✅ Provable zero-PII-leakage guarantee
- ✅ Realistic performance budgets
- ✅ Complete integration specifications
- ✅ Implementation-ready code samples
- ✅ Comprehensive testing strategy

---

## Plan to Review

See: `docs/plans/plan-sanitization-architecture-doc-2025-01-16.md`

**Key Sections:**
1. Overview - Privacy flow and principles
2. Stage 1: Fast Pre-Sanitization (synchronous, <50ms, regex)
3. Stage 2: AI Validation (asynchronous, <2s, context-aware)
4. Data Flow & Integration (how it all fits together)
5. Schema Integration (messages, sanitization_log, job_queue)
6. Performance budgets and benchmarking
7. Security & Privacy Guarantees (invariants and proofs)
8. Error Handling & Edge Cases
9. Testing Strategy (unit, integration, adversarial)

**Critical Code Samples:**
- `fastSanitize()` implementation
- `aiValidate()` implementation
- Database schema DDL
- Privacy invariant tests
- End-to-end integration flow

---

Please be thorough and critical. This is a BLOCKER for implementation, so any issues MUST be caught now.
