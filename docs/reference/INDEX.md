# Reference Documentation

> Last updated: 2025-01-16

## Overview

This directory contains technical reference materials, API documentation, schemas, and specifications for the Global Context Network MVP. Reference docs are designed for quick lookup during implementation.

## Documents

### Active Documents

| Date | Document | Description |
|------|----------|-------------|
| 2025-01-16 | [reference-testing-strategy-2025-01-16.md](./reference-testing-strategy-2025-01-16.md) | Complete testing strategy with TDD, coverage requirements, and test organization |
| 2025-01-16 | [reference-subagent-types-2025-01-16.md](./reference-subagent-types-2025-01-16.md) | Catalog of all 22 subagent types with configurations and prompts |
| 2025-01-16 | [reference-database-schema-2025-01-16.md](./reference-database-schema-2025-01-16.md) | Complete SQLite schema with tables, indexes, migrations, and query patterns |
| 2025-01-16 | [reference-claude-agent-sdk-api-2025-01-16.md](./reference-claude-agent-sdk-api-2025-01-16.md) | Claude Agent SDK API reference with subagent patterns and MCP integration |
| 2025-01-16 | [reference-event-schema-2025-01-16.md](./reference-event-schema-2025-01-16.md) | Complete event schemas for Claude Code hooks with ULID IDs and ISO-8601 timestamps |
| 2025-01-16 | [reference-hook-configuration-2025-01-16.md](./reference-hook-configuration-2025-01-16.md) | Canonical .claude/hooks.json configuration with compiled .js hooks and stdin IO |

## Quick Reference

### Testing Strategy

**Coverage Requirements**:
- Global: ≥85% lines, ≥70% branches
- Critical path: 100% lines, 90% branches
- Test pyramid: 70% unit, 20% integration, 10% E2E

**Key Commands**:
```bash
pnpm test:unit           # Unit tests
pnpm test:integration    # Integration tests
pnpm test:e2e           # End-to-end tests
pnpm test:coverage      # Coverage report
pnpm test:watch         # Watch mode
```

**TDD Cycle**: Red (failing test) → Green (minimal implementation) → Refactor (improve quality)

### Subagent Types

**Total**: 22 subagents
- **14 Implementation**: foundation-setup, database-schema, hook-developer, etc.
- **3 Test Generation**: unit-test-generator, integration-test-generator, e2e-test-generator
- **3 Test Validation**: test-quality-validator, coverage-validator, implementation-validator
- **3 Quality Gates**: code-quality-validator, security-validator, performance-validator

**Model Selection**:
- **Sonnet**: Complex reasoning, code generation, validation
- **Haiku**: Simple tasks, quick validations, high-volume operations

### Database Schema

**Tables**: 6 core tables
- `conversations` - Sanitized conversation metadata
- `messages` - Individual sanitized messages
- `learnings` - Extracted insights with FTS5
- `job_queue` - Async job processing
- `uploads` - Network upload tracking
- `sanitization_log` - PII detection audit trail

**Critical**: NEVER store unsanitized data. `sanitized` column always = 1.

**Required PRAGMAs**:
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
```

### Claude Agent SDK API

**Main Function**: `query(options: QueryOptions)`

**Agent Definition**:
```typescript
{
  description: string;
  model: 'sonnet' | 'haiku';
  tools: string[];
  prompt: string;
  output_schema?: JSONSchema;
  timeout_ms?: number;
}
```

**Execution Patterns**:
- **Parallel**: Independent subagents run simultaneously
- **Sequential**: Dependent subagents run in order
- **Fan-out/Fan-in**: Multiple validators, merge results

## Document Usage

### By Role

**For Developers**:
1. Start with Testing Strategy for TDD workflow
2. Reference Database Schema for queries and repositories
3. Use Claude Agent SDK API for subagent integration
4. Consult Subagent Types for specific agent configs

**For Testing**:
1. Testing Strategy for coverage requirements
2. Subagent Types for test generator configs
3. Database Schema for test database setup
4. Claude Agent SDK API for mocking

**For Architecture Review**:
1. Database Schema for data model validation
2. Subagent Types for agent responsibilities
3. Claude Agent SDK API for integration patterns
4. Testing Strategy for quality gates

### By Phase

**Phase 0 (Foundation)**:
- Testing Strategy: Vitest configuration
- Database Schema: Initial migration
- Subagent Types: foundation-setup, database-schema, test-infrastructure

**Phase 1 (Event Capture)**:
- Subagent Types: hook-developer, event-collector, queue-system
- Database Schema: conversations, messages, job_queue tables
- Testing Strategy: Hook performance tests

**Phase 2 (Sanitization)**:
- Subagent Types: rule-sanitizer, ai-sanitizer, sanitization-pipeline
- Database Schema: sanitization_log table
- Testing Strategy: Security testing, PII corpus

**Phase 3-7 (Later Phases)**:
- Refer to respective subagents
- Database Schema: learnings, uploads tables
- Testing Strategy: Integration and E2E tests

## Cross-References

### Related Categories

- **[Architecture](../architecture/INDEX.md)**: System design and component architecture
- **[Guides](../guides/INDEX.md)**: Step-by-step how-to guides
- **[Decisions](../decisions/INDEX.md)**: ADRs explaining technical choices
- **[Plans](../plans/INDEX.md)**: Implementation roadmaps and task breakdowns

### Key Cross-Links

**Testing Strategy** ↔ **Subagent Types**:
- Test generator subagents (unit, integration, E2E)
- Validation subagents (quality, coverage, implementation)

**Database Schema** ↔ **Testing Strategy**:
- In-memory test database setup
- Fixture factories
- Repository testing patterns

**Claude Agent SDK API** ↔ **Subagent Types**:
- Agent configuration examples
- Orchestration patterns
- MCP integration

**All References** ↔ **Architecture**:
- Architecture provides context
- References provide implementation details

## Version Information

### Schema Version
- **Database**: 1.0.0
- **Sanitization**: 1.0.0
- **API**: Claude Agent SDK 1.x

### Applies To
- **SQLite**: 3.40+
- **Node.js**: 20+
- **TypeScript**: 5.x
- **Vitest**: 1.x
- **Claude Models**: Sonnet 4.5, Haiku 3.5

## Quick Lookup Tables

### Coverage Thresholds

| Scope | Lines | Statements | Branches | Functions |
|-------|-------|------------|----------|-----------|
| Global | 85% | 85% | 70% | 85% |
| Critical Path | 100% | 100% | 90% | 100% |
| Infrastructure | 50% | 50% | 30% | 50% |

### Performance SLAs

| Component | P50 | P95 | P99 | Max |
|-----------|-----|-----|-----|-----|
| Hooks | <50ms | <100ms | <150ms | 200ms |
| Sanitization | <1s | <2s | <3s | 5s |
| DB Queries | <50ms | <100ms | <200ms | 500ms |
| MCP Queries | <100ms | <200ms | <500ms | 1s |

### Subagent Models

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Complex reasoning | Sonnet | Better quality |
| Code generation | Sonnet | Type-safe code |
| Simple validation | Haiku | Fast, cost-effective |
| High-volume ops | Haiku | Throughput |

### Database Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| conversations | idx_conversations_session | Session queries |
| conversations | idx_conversations_created | Recent conversations |
| messages | idx_messages_conversation | Conversation messages |
| learnings | idx_learnings_category | Category filtering |
| learnings_fts | FTS5 | Full-text search |
| job_queue | idx_job_queue_dequeue | Worker queries |

## Maintenance

### Updating References

When updating reference docs:

1. **Update version metadata** in frontmatter
2. **Add changelog entry** if schema/API changes
3. **Update this INDEX** with changes
4. **Cross-link** with related architecture docs
5. **Verify code examples** still work

### Schema Evolution

When database schema changes:

1. Create new migration file
2. Update reference-database-schema with new DDL
3. Update repository examples
4. Note breaking changes in changelog
5. Bump schema version

### API Changes

When Claude Agent SDK API changes:

1. Update reference-claude-agent-sdk-api
2. Update code examples
3. Test against new SDK version
4. Update "applies_to" metadata
5. Note deprecations

## Contributing

### Reference Doc Template

```markdown
# [Topic] Reference

> Brief description

---
title: [Topic] Reference
category: reference
date: YYYY-MM-DD
status: active
authors: Claude + Dennison
tags: [relevant, tags]
applies_to: Versions/Tools
---

## Overview
[What this reference covers]

## [Section 1]
[Technical details, code examples, tables]

## [Section 2]
[More technical content]

## Related Documents
[Cross-links to architecture, guides, etc.]
```

### Quality Checklist

- ✅ Clear, concise descriptions
- ✅ Complete code examples (runnable)
- ✅ Type signatures and schemas
- ✅ Performance characteristics noted
- ✅ Common pitfalls documented
- ✅ Cross-references complete
- ✅ Version information current
- ✅ Tables formatted consistently

---

*This index provides quick access to all technical reference materials for the Global Context Network MVP.*
