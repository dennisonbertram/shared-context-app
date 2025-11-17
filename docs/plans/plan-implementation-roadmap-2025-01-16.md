# Implementation Roadmap - Global Context Network MVP

> 7-phase implementation roadmap with timeline and dependencies

---
title: Global Context Network Implementation Roadmap
category: plan
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [roadmap, timeline, phases, dependencies]
---

## Overview

This document provides the complete implementation roadmap for the Global Context Network MVP, broken down into 7 phases with clear dependencies, deliverables, and success criteria.

**Total Duration**: 7-9 weeks (with 15-20% buffer for integration and testing)

**Development Approach**: Subagent-driven development with Claude-powered testing harness

## Roadmap Summary

| Phase | Focus | Duration | Deliverables | Status |
|-------|-------|----------|--------------|--------|
| 0 | Foundation | 2-3 days | TypeScript setup, DB schema, test infrastructure | Planned |
| 1 | Event Capture | 3-4 days | Hooks, event queue, correlation IDs | Planned |
| 2 | Sanitization | 7-10 days | Rule + AI sanitizer, gold dataset, metrics | Planned |
| 3 | Database & Storage | 2-3 days | Repository pattern, migrations, indexes | Planned |
| 4 | Async Processing | 5-7 days | Job queue, workers, idempotency | Planned |
| 5 | Learning Extraction | 6-8 days | Extractors, dedup, quality scoring | Planned |
| 6 | MCP Server | 3-4 days | MCP protocol, query tools, resources | Planned |
| 7 | Mining & Upload | 4-10 days | IPFS upload, blockchain integration | MVP+ |

## Phase Dependencies

```
Phase 0 (Foundation)
    ↓
Phase 1 (Event Capture)  ←  Requires: Project setup, DB schema
    ↓
Phase 2 (Sanitization)   ←  Requires: Events to sanitize
    ↓
Phase 3 (Database)       ←  Requires: Sanitized data to store
    ↓
Phase 4 (Async Queue)    ←  Requires: Storage for jobs
    ↓
Phase 5 (Learning)       ←  Requires: Async processing
    ↓
Phase 6 (MCP Server)     ←  Requires: Learnings to query
    ↓
Phase 7 (Upload)         ←  Requires: Quality learnings
```

## Critical Path

**Week 1**: Phase 0 + Phase 1
**Weeks 2-3**: Phase 2 (Sanitization - critical for privacy)
**Week 3**: Phase 3 (Database)
**Week 4**: Phase 4 (Async Processing)
**Weeks 4-5**: Phase 5 (Learning Extraction)
**Weeks 5-6**: Phase 6 (MCP Server)
**Weeks 6-7+**: Phase 7 (Network Upload - MVP+)

## Key Milestones

### Milestone 1: Local Capture (End of Week 1)
- ✅ Hooks working and non-blocking
- ✅ Events persisted to queue
- ✅ TypeScript + Vitest running
- **Value**: Can capture conversations

### Milestone 2: Privacy Guarantee (End of Week 3)
- ✅ PII sanitization working
- ✅ Gold dataset with precision/recall metrics
- ✅ Zero plaintext raw data on disk
- **Value**: Trust in privacy

### Milestone 3: Persistent Learnings (End of Week 5)
- ✅ Learnings extracted and scored
- ✅ Database storing sanitized data
- ✅ Deduplication working
- **Value**: Learnings saved locally

### Milestone 4: Query Interface (End of Week 6)
- ✅ MCP server running
- ✅ Agents can query learnings
- ✅ Performance < 200ms
- **Value**: Cross-project sharing

### Milestone 5: Global Network (Week 7-9) - MVP+
- ✅ IPFS uploads working
- ✅ Blockchain integration
- ✅ Token tracking
- **Value**: Global sharing + rewards

## Timeline Details

### Week 1: Foundation + Event Capture

**Days 1-3: Phase 0**
- TypeScript project with strict mode
- Vitest configuration
- Database schema design
- Migration system
- Test utilities

**Days 4-7: Phase 1**
- UserPromptSubmit hook
- Stop hook
- Event collector
- Persistent queue (with pre-sanitization for privacy)
- Performance monitoring

**Deliverables**:
- `tsconfig.json` with strict settings
- `vitest.config.ts` configured
- Database migrations 001-004
- Hook scripts in `.claude/hooks/`
- Event queue implementation

**Acceptance Criteria**:
- TypeScript compiles with no errors
- All tests pass
- Hooks execute < 100ms (p95)
- Events persisted with correlation IDs

### Week 2-3: Sanitization Pipeline

**Days 1-3: Rule-Based Detector**
- PII regex patterns (emails, phones, IPs, paths, keys, URLs)
- Per-category unit tests
- Redaction format conventions
- Performance optimization

**Days 4-7: AI Sanitizer**
- Claude API integration
- Context-aware detection
- Prompt templates (temp=0 for determinism)
- Fallback to rules-only

**Days 8-10: Gold Dataset & Metrics**
- Build/adopt labeled PII dataset
- Precision/recall scoring harness
- Per-category thresholds (precision ≥ 98%, recall ≥ 95%)
- Adversarial test suite

**Deliverables**:
- Rule-based sanitizer with 20+ PII patterns
- AI sanitizer with prompt templates
- Gold dataset with 1000+ labeled examples
- Scoring harness with per-category metrics
- Audit logging system

**Acceptance Criteria**:
- Precision ≥ 98% per PII category
- Recall ≥ 95% per PII category
- No plaintext raw data on disk
- Sanitization < 2s per conversation
- Chain-of-thought excluded from storage

### Week 3: Database & Storage

**Days 1-2: Repository Pattern**
- Conversation repository
- Messages repository
- Learnings repository
- Job queue repository

**Days 3: Query Optimization**
- Indexes for common queries
- WAL mode enabled
- Foreign key constraints
- Concurrent writer tests

**Deliverables**:
- Repository implementations
- Migration scripts with versioning
- Query optimization indexes
- ACID compliance tests

**Acceptance Criteria**:
- All queries < 100ms
- No orphan messages (FK constraints enforced)
- Migrations reversible
- Concurrent writes don't corrupt data

### Week 4: Async Processing

**Days 1-3: Job Queue**
- SQLite-based queue
- Priority handling
- Job status tracking
- Advisory locks for concurrency

**Days 4-5: Workers**
- Worker process architecture
- Job idempotency (dedupe keys)
- Graceful shutdown
- Checkpoint/resume

**Days 6-7: Reliability**
- Exponential backoff retry
- Dead letter queue
- Crash recovery tests
- Chaos testing (DB locked, disk full)

**Deliverables**:
- Job queue implementation
- Worker processes for 3 job types
- Retry logic with backoff
- Monitoring and metrics

**Acceptance Criteria**:
- Jobs never lost
- Idempotent processing verified
- Graceful shutdown within 30s
- Crash recovery E2E tests pass

### Week 4-5: Learning Extraction

**Days 1-2: Conversation Analyzer**
- Value detection (is conversation worth learning from?)
- Category identification
- Quality pre-filtering

**Days 3-5: Extractors**
- Rule-based + LLM approach
- Category-specific extractors
- Metadata schema (tags, provenance, version)
- Prompt templates

**Days 6-8: Quality & Dedup**
- Confidence scoring (≥ 0.6 threshold)
- Deduplication (cosine similarity < 0.85)
- Negative set to prevent trivial learnings
- Human-in-the-loop sample review

**Deliverables**:
- Conversation analyzer
- 8 category extractors
- Quality scoring algorithm
- Deduplication system
- Sample review process

**Acceptance Criteria**:
- 90% of sample rated "useful" by reviewer
- No duplicate learnings (verified by similarity)
- Confidence scores calibrated
- Metadata complete with provenance

### Week 5-6: MCP Server

**Days 1-2: Protocol Setup**
- MCP SDK integration
- Server configuration
- Loopback binding (127.0.0.1)
- Optional API key auth

**Days 3-4: Tools Implementation**
- `search_learnings` with filters
- `get_learning_by_id`
- `get_learning_context`
- Input validation and bounds

**Days 5: Resources & Performance**
- Resource endpoints (recent, top-rated, stats)
- Query optimization
- Pagination and sorting
- Rate limiting

**Deliverables**:
- MCP server implementation
- 3 tools + 3 resources
- Authentication layer
- Performance tests

**Acceptance Criteria**:
- MCP protocol conformance tests pass
- All queries < 200ms
- Invalid queries rejected gracefully
- No data leaks via MCP

### Week 6-9: Mining & Upload (MVP+)

**Days 1-3: IPFS Integration**
- IPFS client setup (pinning provider vs self-hosted)
- Content upload implementation
- CID generation and tracking
- Retry logic

**Days 4-7: Blockchain Integration**
- Choose network (testnet first)
- Wallet generation and key management
- CID anchoring (simple registry or contract)
- Transaction confirmation

**Days 8-10: Token System (if time)**
- Reward calculation
- Upload status tracking
- User controls (opt-in, manual approval)
- License metadata

**Deliverables**:
- IPFS upload working
- Blockchain integration
- Key management system
- User controls

**Acceptance Criteria**:
- CID retrievable via 2+ gateways
- N confirmed blocks for on-chain record
- Keys stored securely (OS keychain)
- Manual approval gate before upload

## Risk Management

### Critical Risks

**PII Leakage** (Impact: Critical)
- Mitigation: Pre-sanitize in hook, gold dataset, audit logging
- Gates: Zero leaks in test suite, precision/recall thresholds

**Hook Performance** (Impact: High)
- Mitigation: < 100ms requirement, fast pre-sanitizer, monitoring
- Gates: p95/p99 latency tests, load testing

**Data Loss** (Impact: High)
- Mitigation: Idempotent jobs, persistent queue, crash recovery
- Gates: Chaos tests, concurrent writer tests

### Deferred Risks (Post-MVP)

- Validator network attacks
- Multi-user access control
- International PII patterns
- IP/licensing compliance

## Quality Gates

**Before Phase Completion**:
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Lint + type-check clean
- [ ] Coverage ≥ 85%
- [ ] Performance SLOs met
- [ ] Security scan clean
- [ ] Documentation updated

**Before MVP Release**:
- [ ] E2E tests pass
- [ ] Privacy audit complete (zero PII leaks)
- [ ] Performance benchmarks met
- [ ] User controls working (opt-in, delete)
- [ ] Installation guide complete
- [ ] Monitoring/logging working

## Parallel Work Opportunities

### Week 1
- Phase 0 foundation (sequential)
- Phase 1 hooks can be prototyped in parallel

### Week 2-3
- Rule-based sanitizer (parallel track 1)
- AI sanitizer (parallel track 2)
- Gold dataset creation (parallel track 3)

### Week 4
- Job queue (parallel track 1)
- Workers (parallel track 2, depends on queue)

### Week 5-6
- Learning extraction refinement
- MCP server implementation (can start earlier)

## Post-MVP Roadmap

### Months 1-3
- Semantic search for learnings
- Enhanced categorization
- User feedback loops
- Analytics dashboard

### Months 3-6
- Validator network (multi-agent)
- Quorum-based consensus
- Advanced token economics
- Multi-user support

### Months 6+
- Distributed storage
- Trend analysis
- Community curation
- Mobile support

## Related Documents

- [MVP Plan](./plan-global-context-network-mvp-2025-01-16.md)
- [Subagent Workflow](./plan-subagent-workflow-2025-01-16.md)
- [Phase 0 Tasks](./plan-phase-0-tasks-2025-01-16.md)
- [Phase 1 Tasks](./plan-phase-1-tasks-2025-01-16.md)
- [Phase 2 Tasks](./plan-phase-2-tasks-2025-01-16.md)
- [Phase 3 Tasks](./plan-phase-3-tasks-2025-01-16.md)
- [Phase 4 Tasks](./plan-phase-4-tasks-2025-01-16.md)
- [Phase 5 Tasks](./plan-phase-5-tasks-2025-01-16.md)
- [Phase 6 Tasks](./plan-phase-6-tasks-2025-01-16.md)
- [Phase 7 Tasks](./plan-phase-7-tasks-2025-01-16.md)
