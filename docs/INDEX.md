# Documentation Index

> Last updated: 2025-01-17

## 🚨 Critical Update (2025-01-17)

**IMPORTANT**: A comprehensive hooks alignment audit identified 6 critical architectural issues with the Claude Code hooks integration. All issues have been remediated. See [Hooks Alignment Remediation Report](./reviews/hooks-alignment-remediation-2025-01-17.md) for details.

**Status**: Documentation updated with correct Claude Code hooks implementation. Review remediation report before proceeding with implementation.

## Overview

This directory contains all project documentation for the Global Context Network MVP - a system that captures Claude Code conversations, sanitizes them for PII, stores learnings, and shares them globally via blockchain/IPFS with token rewards.

**Core Philosophy**: Subagent-driven development with Claude-powered testing harness.

## Quick Links

- [Architecture](./architecture/INDEX.md) - System design, components, and data flow
- [Decisions](./decisions/INDEX.md) - Architecture Decision Records (ADRs)
- [Plans](./plans/INDEX.md) - Implementation plans, roadmaps, and task breakdowns
- [Guides](./guides/INDEX.md) - How-to guides for development and testing
- [Reference](./reference/INDEX.md) - Technical reference materials and APIs
- [Learnings](./learnings/INDEX.md) - Insights, retrospectives, and discoveries

## Project Goals

1. **Capture**: Hook into Claude Code to capture conversations
2. **Sanitize**: Remove ALL PII before storage (privacy-first)
3. **Extract**: Generate valuable, reusable learnings
4. **Share**: Upload to global network (IPFS + blockchain)
5. **Query**: MCP server for agents to access learnings
6. **Reward**: Token rewards for quality contributions

## Recent Documents

| Date | Category | Document | Description |
|------|----------|----------|-------------|
| 2025-01-16 | decision | [ADR-001: Use Claude Hooks](./decisions/decision-use-claude-hooks-2025-01-16.md) | Event capture via Claude Code hooks |
| 2025-01-16 | decision | [ADR-002: Subagent-Driven Development](./decisions/decision-subagent-driven-development-2025-01-16.md) | All implementation via specialized subagents |
| 2025-01-16 | decision | [ADR-003: Claude Testing Harness](./decisions/decision-claude-testing-harness-2025-01-16.md) | AI-powered test generation and validation |
| 2025-01-16 | decision | [ADR-004: Sanitize Before Storage](./decisions/decision-sanitize-before-storage-2025-01-16.md) | Privacy-first architecture decision |
| 2025-01-16 | decision | [ADR-005: Use SQLite](./decisions/decision-use-sqlite-2025-01-16.md) | SQLite for MVP storage |
| 2025-01-16 | decision | [ADR-006: Async Processing Model](./decisions/decision-async-processing-model-2025-01-16.md) | SQLite-based job queue |
| 2025-01-16 | decision | [ADR-007: Data Licensing & Consent](./decisions/decision-data-licensing-consent-2025-01-16.md) | GDPR/CCPA compliance, opt-in model ⭐ |
| 2025-01-16 | decision | [ADR-010: PII Detection Strategy](./decisions/decision-pii-detection-strategy-2025-01-16.md) | 72+ categories, 2-stage detection |
| 2025-01-16 | decision | [ADR-011: Security & Provenance](./decisions/decision-security-provenance-2025-01-16.md) | Signing, attestations, key management |
| 2025-01-16 | decision | [ADR-013: Observability & Cost](./decisions/decision-observability-cost-slo-governance-2025-01-16.md) | SLO governance, cost management |
| 2025-01-16 | plans | [Global Context Network MVP](./plans/plan-global-context-network-mvp-2025-01-16.md) | Complete MVP implementation plan |
| 2025-01-16 | plans | [Implementation Roadmap](./plans/plan-implementation-roadmap-2025-01-16.md) | 7-phase roadmap with timeline |
| 2025-01-16 | plans | [Iterative Build Strategy](./plans/plan-iterative-build-strategy-2025-01-16.md) | 15-level iteration plan ⭐ |
| 2025-01-16 | guides | [Database Setup Guide](./guides/guide-database-setup-2025-01-16.md) | Step-by-step SQLite setup |
| 2025-01-16 | reference | [Event Schema Reference](./reference/reference-event-schema-2025-01-16.md) | Complete event schemas (ULID, ISO-8601) |
| 2025-01-16 | reference | [Hook Configuration Reference](./reference/reference-hook-configuration-2025-01-16.md) | Canonical .claude/hooks.json |
| 2025-01-16 | architecture | [Global Context Network](./architecture/architecture-global-context-network-2025-01-16.md) | System architecture overview |
| 2025-01-16 | architecture | [Subagent System](./architecture/architecture-subagent-system-2025-01-16.md) | Subagent-driven development architecture |
| 2025-01-16 | architecture | [Async Processing](./architecture/architecture-async-processing-2025-01-16.md) | Complete async job queue architecture |

## Document Count by Category

- **Architecture**: 9 documents (system design, components, data flow) ✅ **COMPLETE**
- **Decisions**: 13 ADRs (major architectural decisions) ✅ **COMPLETE**
- **Plans**: 13 plans (MVP plan, roadmap, phase tasks, iterative strategy) ✅ **COMPLETE**
- **Guides**: 7 guides (foundation, database, SDK, subagents, testing, TDD, hooks) ✅ **COMPLETE**
- **Reference**: 6 references (testing, subagents, database, SDK, events, hooks) ✅ **COMPLETE**
- **Learnings**: 0 (will be populated during implementation)

**Total**: 48 documents (all core documentation complete)

## Key Architectural Decisions

1. **Hooks-Based Capture** - Use Claude Code hooks (UserPromptSubmit, Stop)
2. **Privacy-First** - Sanitize BEFORE database storage, never store raw PII
3. **Subagent-Driven** - ALL implementation via specialized subagents
4. **Claude Testing** - Self-validating system using Claude Agent SDK
5. **Async Processing** - Job queue for sanitization and learning extraction
6. **SQLite Storage** - Local persistence with migration system
7. **MCP Interface** - Standard protocol for agent queries
8. **IPFS + Blockchain** - Decentralized global storage with rewards

## Development Phases

| Phase | Focus | Duration | Status | Plan |
|-------|-------|----------|--------|------|
| 0 | Foundation (TypeScript, DB, Tests) | 2-3 days | Planned | [Phase 0 Tasks](./plans/plan-phase-0-tasks-2025-01-16.md) |
| 1 | Event Capture (Hooks, Queue) | 3-4 days | Planned | [Phase 1 Tasks](./plans/plan-phase-1-tasks-2025-01-16.md) |
| 2 | Sanitization (PII Removal) | 7-10 days | Planned | [Phase 2 Tasks](./plans/plan-phase-2-tasks-2025-01-16.md) |
| 3 | Database & Storage | 2-3 days | Planned | [Phase 3 Tasks](./plans/plan-phase-3-tasks-2025-01-16.md) |
| 4 | Async Processing (Job Queue) | 5-7 days | Planned | [Phase 4 Tasks](./plans/plan-phase-4-tasks-2025-01-16.md) |
| 5 | Learning Extraction | 6-8 days | Planned | [Phase 5 Tasks](./plans/plan-phase-5-tasks-2025-01-16.md) |
| 6 | MCP Server | 3-4 days | Planned | [Phase 6 Tasks](./plans/plan-phase-6-tasks-2025-01-16.md) |
| 7 | Mining & Upload (IPFS/Blockchain) | 4-10 days | MVP+ | [Phase 7 Tasks](./plans/plan-phase-7-tasks-2025-01-16.md) |

## How to Use This Documentation

### For Implementation
1. Start with [Implementation Roadmap](./plans/plan-implementation-roadmap-2025-01-16.md)
2. **Follow [Iterative Build Strategy](./plans/plan-iterative-build-strategy-2025-01-16.md) for step-by-step implementation**
3. Review [Subagent Workflow](./plans/plan-subagent-workflow-2025-01-16.md)
4. Follow phase-specific guides in `guides/`
5. Reference architecture docs as needed

### For Understanding the System
1. Read [Global Context Network Architecture](./architecture/architecture-global-context-network-2025-01-16.md)
2. Review [Architectural Decisions](./decisions/) for rationale
3. Explore component-specific architecture docs

### For Testing
1. Follow [TDD Workflow Guide](./guides/guide-tdd-workflow-2025-01-16.md)
2. Use [Testing Harness Usage](./guides/guide-testing-harness-usage-2025-01-16.md)
3. Reference [Testing Strategy](./reference/reference-testing-strategy-2025-01-16.md)

## Contributing

When adding documentation:

1. **Choose Category**: architecture, decisions, plans, guides, reference, or learnings
2. **Name Properly**: `category-topic-2025-01-16.md` format
3. **Use Template**: Follow markdown-organizer templates
4. **Add Frontmatter**: Include all required metadata
5. **Update Category INDEX**: Add entry to category's INDEX.md
6. **Update This File**: Add to "Recent Documents" and update counts
7. **Cross-Link**: Add "Related Documents" section with links

## Templates

All documentation follows standardized templates:
- **Architecture**: System design with diagrams, components, trade-offs
- **ADR**: Context, decision, consequences, alternatives
- **Plan**: Goals, tasks, risks, success criteria
- **Guide**: Step-by-step instructions with examples
- **Reference**: Technical specifications and API docs
- **Learning**: Insights with context and application

## Navigation Tips

- Use category INDEX.md files for complete listings
- Search by topic using your editor's find function
- Follow cross-links in "Related Documents" sections
- Check this master index for recent additions
- All paths are relative for easy navigation

## Project Links

- **GitHub**: [Repository URL when created]
- **Documentation**: This directory
- **Tests**: `/tests/` directory
- **Source**: `/src/` directory

## Status Legend

- 📝 **Planned**: Not yet started
- 🚧 **In Progress**: Currently being implemented
- ✅ **Complete**: Finished and validated
- 📦 **Archived**: Superseded or no longer active

---

*This documentation follows the markdown-organizer skill guidelines for consistent, discoverable, well-organized documentation.*
