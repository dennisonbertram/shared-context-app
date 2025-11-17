# Architecture Decision Records (ADRs)

> Last updated: 2025-01-16

## Overview

This directory contains Architecture Decision Records for the Global Context Network MVP. Each ADR documents a significant architectural decision, the context that led to it, alternatives considered, and consequences.

## Purpose

ADRs capture the "why" behind major architectural decisions:
- Context that motivated the decision
- The decision itself
- Alternatives considered with pros/cons
- Consequences (positive, negative, neutral)
- Implementation notes
- Risks and mitigations

## Documents

### Active ADRs

| ADR | Date | Document | Decision | Status |
|-----|------|----------|----------|--------|
| 001 | 2025-01-16 | [decision-use-claude-hooks-2025-01-16.md](./decision-use-claude-hooks-2025-01-16.md) | Use Claude Code hooks for event capture | Accepted |
| 002 | 2025-01-16 | [decision-subagent-driven-development-2025-01-16.md](./decision-subagent-driven-development-2025-01-16.md) | All implementation via specialized subagents | Accepted |
| 003 | 2025-01-16 | [decision-claude-testing-harness-2025-01-16.md](./decision-claude-testing-harness-2025-01-16.md) | Claude Agent SDK for test generation and validation | Accepted |
| 004 | 2025-01-16 | [decision-sanitize-before-storage-2025-01-16.md](./decision-sanitize-before-storage-2025-01-16.md) | Sanitize ALL data BEFORE database insertion | Accepted |
| 005 | 2025-01-16 | [decision-use-sqlite-2025-01-16.md](./decision-use-sqlite-2025-01-16.md) | SQLite with migrations for MVP storage | Accepted |
| 006 | 2025-01-16 | [decision-async-processing-model-2025-01-16.md](./decision-async-processing-model-2025-01-16.md) | SQLite-based job queue with async workers | Accepted |
| **007** | **2025-01-16** | **[decision-data-licensing-consent-2025-01-16.md](./decision-data-licensing-consent-2025-01-16.md)** | **Local-first, opt-in consent and CC BY 4.0 licensing (CRITICAL)** | **Accepted** |
| 008 | 2025-01-16 | [decision-global-sharing-architecture-2025-01-16.md](./decision-global-sharing-architecture-2025-01-16.md) | IPFS + Base L2 for global sharing, Celestia deferred | Accepted |
| 009 | 2025-01-16 | [decision-token-rewards-sybil-resistance-2025-01-16.md](./decision-token-rewards-sybil-resistance-2025-01-16.md) | Defer token rewards to Phase 2; NTCCs in MVP | Accepted |
| 010 | 2025-01-16 | [decision-pii-detection-strategy-2025-01-16.md](./decision-pii-detection-strategy-2025-01-16.md) | 2-stage PII detection: fast rules + AI validation with 72+ categories | Accepted |
| 011 | 2025-01-16 | [decision-security-provenance-2025-01-16.md](./decision-security-provenance-2025-01-16.md) | Signing, attestations, and provenance for published learnings | Accepted |
| 012 | 2025-01-16 | [decision-data-model-schema-versioning-2025-01-16.md](./decision-data-model-schema-versioning-2025-01-16.md) | Semantic versioning with JSON Schema validation and Atlas migrations | Accepted |
| 013 | 2025-01-16 | [decision-observability-cost-slo-governance-2025-01-16.md](./decision-observability-cost-slo-governance-2025-01-16.md) | Observability, cost management, and SLO governance for Claude API usage | Accepted |

## Decision Summary

### Core Principles

The ADRs embody these key principles:

1. **Privacy First** (ADR-004) - Sanitize before storage, zero-trust PII handling
2. **Never Block User** (ADR-001, ADR-006) - Async everything, hooks < 100ms
3. **Quality Gates** (ADR-002, ADR-003) - Testing harness, subagent validation
4. **Local-First MVP** (ADR-005, ADR-006) - SQLite, no external dependencies
5. **Migration Path** - All decisions support future scaling

### Technology Stack Decisions

| Aspect | Decision | ADR | Rationale |
|--------|----------|-----|-----------|
| Event Capture | Claude Code Hooks | 001 | Source-level capture, < 100ms, complete context |
| Development Model | Subagent-Driven | 002 | Parallel execution, specialized expertise, quality gates |
| Testing Strategy | Claude Testing Harness | 003 | Comprehensive coverage, automated quality scoring |
| Privacy Architecture | Sanitize Before Storage | 004 | Zero-trust PII, database inherently safe |
| Database | SQLite with WAL | 005 | Zero-config, ACID, fast queries, easy backup |
| Async Processing | SQLite Job Queue | 006 | Persistent, no external deps, offline tolerant |

### Key Trade-offs

**Chosen**:
- Simple setup (SQLite, embedded queue)
- Privacy first (sanitize before storage)
- Quality over speed (comprehensive testing)
- Local-first (no cloud dependencies for MVP)

**Deferred**:
- Distributed processing (Temporal, PostgreSQL, Redis)
- Advanced analytics (DuckDB)
- Blockchain/token rewards (simplified in MVP)
- Multi-user support

## ADR Writing Guidelines

### ADR Template Structure

```markdown
---
title: ADR-NNN: [Decision Title]
category: decision
date: YYYY-MM-DD
status: [proposed|accepted|deprecated|superseded]
deciders: [Names]
---

# ADR-NNN: [Decision Title]

## Status
[Status and date]

## Context
[What problem are we solving? What constraints?]

## Decision
[What did we decide to do?]

## Consequences
### Positive
### Negative
### Neutral

## Alternatives Considered
### Alternative 1: [Name]
**Description**: [What]
**Pros**: [List]
**Cons**: [List]
**Why not chosen**: [Reason]

## Implementation
[How will this be implemented?]

## Risks and Mitigations
### Risk: [Name]
**Impact**: [High/Medium/Low]
**Mitigation**: [How we address it]

## Related Documents
[Links to architecture, plans, guides]
```

### When to Create an ADR

Create an ADR when:
- Making a significant architectural decision
- Choosing between multiple viable approaches
- Decision will be hard to reverse
- Decision affects multiple components
- Team needs alignment on approach
- Future developers will ask "why did we do this?"

Don't create an ADR for:
- Trivial implementation details
- Temporary/experimental approaches
- Decisions easily reversed
- Pure coding style preferences

### ADR Status Lifecycle

- **Proposed** - Under discussion, not yet decided
- **Accepted** - Decision made and being implemented
- **Deprecated** - No longer recommended but may exist in code
- **Superseded** - Replaced by another ADR (link to it)

## Future ADRs (Identified by GPT-5 Review)

### Critical for Post-MVP

| Priority | Topic | Rationale | Status |
|----------|-------|-----------|--------|
| ~~HIGH~~ | ~~Global Sharing Architecture~~ | ~~IPFS vs blockchain, what to share, pinning strategy~~ | **COMPLETED (ADR-008)** |
| ~~HIGH~~ | ~~Consent and Licensing~~ | ~~Opt-in model, data licensing, right-to-delete, age gating~~ | **COMPLETED (ADR-007) - Addresses GPT-5 & Gemini critical blocker** |
| ~~HIGH~~ | ~~PII Detection Strategy~~ | ~~Layered detection, taxonomy, confidence thresholds~~ | **COMPLETED (ADR-010)** |
| ~~HIGH~~ | ~~Security and Provenance~~ | ~~Signing artifacts, key management, attestations~~ | **COMPLETED (ADR-011)** |
| ~~MEDIUM~~ | ~~Token Rewards Model~~ | ~~Defer vs implement, sybil resistance~~ | **COMPLETED (ADR-009)** |
| ~~MEDIUM~~ | ~~Observability and Cost SLOs~~ | ~~Telemetry, budgets, alerting~~ | **COMPLETED (ADR-013)** |
| ~~MEDIUM~~ | ~~Data Model Versioning~~ | ~~Schema evolution, cross-client compatibility~~ | **COMPLETED (ADR-012)** |
| LOW | Chain-of-Thought Capture Policy | What to capture vs avoid (Addressed in ADR-001 & STANDARDS.md) |
| LOW | Right-to-Delete vs Immutability | GDPR/CCPA alignment strategy (Addressed in ADR-007) |

## GPT-5 Review Feedback

### What We Did Well
- Concise, principle-driven
- Honest about trade-offs
- Oriented to MVP constraints
- Clear migration paths

### What We Improved
- Corrected MongoDB ACID claim (ADR-005)
- Added more alternatives per ADR
- Expanded implementation notes
- Added risk/mitigation sections
- Removed "capture thinking" language (provider policy)
- Added consent and scope considerations (ADR-001)
- Improved "why" explanations

### Areas for Future Work
- Add missing ADRs for global sharing layer
- Document consent and licensing model
- Detail PII detection taxonomy
- Define security and provenance strategy

## Related Categories

- [Architecture](../architecture/INDEX.md) - System design documents
- [Plans](../plans/INDEX.md) - Implementation plans
- [Reference](../reference/INDEX.md) - Technical specifications

## Cross-References

### By Theme

**Privacy & Security**:
- ADR-004: Sanitize Before Storage
- ADR-007: Data Licensing and Consent Model (CRITICAL - addresses GPT-5 & Gemini blocker)
- ADR-010: PII Detection Strategy (72+ categories, 2-stage detection)
- ADR-011: Security and Provenance (signing, attestations, key management)
- ADR-013: Observability and Cost SLO Governance (privacy-safe telemetry)
- ADR-001: Claude Hooks (includes consent)

**Development Workflow**:
- ADR-002: Subagent-Driven Development
- ADR-003: Claude Testing Harness

**Technical Infrastructure**:
- ADR-005: SQLite Database
- ADR-006: Async Processing Model
- ADR-012: Data Model Schema Versioning
- ADR-008: Global Sharing Architecture

**User Experience**:
- ADR-001: Claude Hooks (< 100ms requirement)
- ADR-006: Async Processing (never block user)

## Quick Tips

- All ADRs follow the standard template
- Read ADR-001, ADR-004, ADR-002 for core principles
- Check "Alternatives Considered" to understand trade-offs
- Review "Implementation" sections for technical details
- "Related Documents" link to architecture and plans
