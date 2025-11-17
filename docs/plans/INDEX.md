# Plans Documentation

> Last updated: 2025-01-16

## Overview

This directory contains implementation plans, task breakdowns, and roadmaps for the Global Context Network MVP. All plans follow a subagent-driven development approach with Claude-powered testing.

## Master Plans

| Date | Document | Status | Description |
|------|----------|--------|-------------|
| 2025-01-16 | [plan-global-context-network-mvp-2025-01-16.md](./plan-global-context-network-mvp-2025-01-16.md) | Active | Complete MVP implementation plan overview |
| 2025-01-16 | [plan-implementation-roadmap-2025-01-16.md](./plan-implementation-roadmap-2025-01-16.md) | Active | 7-phase roadmap with timeline and dependencies |
| 2025-01-16 | [plan-iterative-build-strategy-2025-01-16.md](./plan-iterative-build-strategy-2025-01-16.md) | Active | 15-level iteration plan with working software at each step |
| 2025-01-16 | [plan-subagent-workflow-2025-01-16.md](./plan-subagent-workflow-2025-01-16.md) | Active | How specialized subagents work together |
| 2025-01-16 | [plan-original-user-vision-2025-01-16.md](./plan-original-user-vision-2025-01-16.md) | Active | User's original concept and requirements |

## Phase-Specific Task Plans

| Phase | Focus | Duration | Document | Status |
|-------|-------|----------|----------|--------|
| 0 | Foundation | 2-3 days | [plan-phase-0-tasks-2025-01-16.md](./plan-phase-0-tasks-2025-01-16.md) | Planned |
| 1 | Event Capture | 3-4 days | [plan-phase-1-tasks-2025-01-16.md](./plan-phase-1-tasks-2025-01-16.md) | Planned |
| 2 | Sanitization | 7-10 days | [plan-phase-2-tasks-2025-01-16.md](./plan-phase-2-tasks-2025-01-16.md) | Planned |
| 3 | Database | 2-3 days | [plan-phase-3-tasks-2025-01-16.md](./plan-phase-3-tasks-2025-01-16.md) | Planned |
| 4 | Async Processing | 5-7 days | [plan-phase-4-tasks-2025-01-16.md](./plan-phase-4-tasks-2025-01-16.md) | Planned |
| 5 | Learning Extraction | 6-8 days | [plan-phase-5-tasks-2025-01-16.md](./plan-phase-5-tasks-2025-01-16.md) | Planned |
| 6 | MCP Server | 3-4 days | [plan-phase-6-tasks-2025-01-16.md](./plan-phase-6-tasks-2025-01-16.md) | Planned |
| 7 | Mining & Upload | 4-10 days | [plan-phase-7-tasks-2025-01-16.md](./plan-phase-7-tasks-2025-01-16.md) | MVP+ |

## Total Plan Documents

**Count**: 12 documents (5 master plans + 7 phase plans)

## Key Implementation Principles

### Subagent-Driven Development
- All implementation delegated to specialized subagents
- Implementation, test generation, and validation subagents
- Parallel execution where possible
- Quality gates enforced automatically

### Test-Driven Development (TDD)
- Tests generated first (Red phase)
- Minimal implementation (Green phase)
- Refactor for quality (Refactor phase)
- Automated quality gates

### Privacy-First Architecture
- Pre-sanitize in hooks before any persistence
- Full sanitization before final storage
- Gold dataset with precision/recall metrics
- Zero plaintext raw data on disk
- Chain-of-thought excluded

### Quality Gates
- ≥ 85% test coverage
- Precision ≥ 98% per PII category
- Recall ≥ 95% per PII category
- Performance SLOs met (hooks < 100ms, queries < 100ms, MCP < 200ms)
- Security scan clean
- Lint + type-check passing

## Timeline Summary

**Total Duration**: 7-9 weeks (with 15-20% buffer)

### Week 1
- Phase 0: Foundation (days 1-3)
- Phase 1: Event Capture (days 4-7)

### Week 2-3
- Phase 2: Sanitization Pipeline (7-10 days)

### Week 3
- Phase 3: Database & Storage (2-3 days)

### Week 4
- Phase 4: Async Processing (5-7 days)

### Weeks 4-5
- Phase 5: Learning Extraction (6-8 days)

### Weeks 5-6
- Phase 6: MCP Server (3-4 days)

### Weeks 6-9 (MVP+)
- Phase 7: Mining & Upload (4-10 days, optional for MVP)

## Phase Dependencies

```
Phase 0 (Foundation)
    ↓
Phase 1 (Event Capture)
    ↓
Phase 2 (Sanitization)
    ↓
Phase 3 (Database)
    ↓
Phase 4 (Async Processing)
    ↓
Phase 5 (Learning Extraction)
    ↓
Phase 6 (MCP Server)
    ↓
Phase 7 (Mining & Upload) [MVP+]
```

## Critical Milestones

1. **Local Capture** (End of Week 1): Hooks working, events captured
2. **Privacy Guarantee** (End of Week 3): PII sanitization validated
3. **Persistent Learnings** (End of Week 5): Learnings extracted and stored
4. **Query Interface** (End of Week 6): MCP server accessible to agents
5. **Global Network** (Week 7-9): IPFS + blockchain integration [MVP+]

## MVP vs MVP+ Scope

### Core MVP (Weeks 1-6)
- ✅ Event capture via hooks
- ✅ PII sanitization with metrics
- ✅ Database storage
- ✅ Async job processing
- ✅ Learning extraction
- ✅ MCP query interface
- ✅ Local cross-project sharing

**Value**: Privacy-first learning capture and local sharing

### MVP+ (Weeks 7-9)
- ✅ IPFS upload
- ✅ Blockchain integration
- ✅ Token reward tracking
- ✅ Global network sharing

**Value**: Global sharing with incentives

## GPT-5 Review Feedback Incorporated

This implementation plan incorporates comprehensive feedback from GPT-5 review on:

### Critical Issues Addressed
1. **Privacy Contradiction Resolved**: Pre-sanitization in hooks before any persistence
2. **Gold Dataset**: 1000+ labeled PII examples with precision/recall thresholds per category
3. **Chain-of-Thought Exclusion**: Never stored, even sanitized
4. **Timeline Adjusted**: 7-10 days for sanitization (was 4-5), Phase 7 marked as MVP+
5. **Acceptance Criteria Clarified**: Measurable, automated, per-category metrics

### Enhanced Task Breakdowns
1. **Phase 1**: Added event schema, correlation IDs, idempotency, backpressure, cross-platform support
2. **Phase 2**: Enumerated exact PII categories, redaction formats, AI prompt templates, adversarial tests
3. **Phase 3**: Added migration versioning, data retention, purge policies, vacuum schedule
4. **Phase 4**: Added locking strategy, idempotency design, checkpoint/resume, chaos tests
5. **Phase 5**: Specified extraction approach, dedup strategy, negative set, human review process
6. **Phase 6**: Added auth model, pagination, rate limiting, input validation
7. **Phase 7**: Clarified smart contract vs simple registry, key management, user controls

### New Testing Requirements
1. **Performance**: p95/p99 latencies under load with concurrent clients
2. **Reliability**: Crash recovery, DB locked, disk full, concurrent writers
3. **Security**: Adversarial PII tests, prompt injection, SQLi prevention, log redaction
4. **Metrics**: Per-category precision/recall, F1 scores, gold dataset scoring

## Related Categories

- [Architecture](../architecture/INDEX.md) - System design and components
- [Decisions](../decisions/INDEX.md) - Architecture Decision Records
- [Guides](../guides/INDEX.md) - How-to documentation
- [Reference](../reference/INDEX.md) - Technical specifications

## Using These Plans

### For Implementation
1. Start with [MVP Plan](./plan-global-context-network-mvp-2025-01-16.md) for overview
2. Review [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md) for timeline
3. **Use [Iterative Build Strategy](./plan-iterative-build-strategy-2025-01-16.md) for step-by-step implementation**
4. Understand [Subagent Workflow](./plan-subagent-workflow-2025-01-16.md) for process
5. Execute phase-specific task plans in order

### For Understanding Scope
1. Read [Original User Vision](./plan-original-user-vision-2025-01-16.md) for context
2. Review phase plans to understand effort required
3. Check timeline and dependencies for scheduling

### For Quality Assurance
1. Follow TDD workflow in [Subagent Workflow](./plan-subagent-workflow-2025-01-16.md)
2. Enforce quality gates documented in each phase plan
3. Use acceptance criteria to validate completeness

---

*All plans follow the subagent-driven development model with Claude-powered testing harness. Each phase includes detailed tasks, success criteria, testing strategy, and clear dependencies.*
