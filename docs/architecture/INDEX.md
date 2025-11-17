# Architecture Documentation

> Last updated: 2025-01-16

## Overview

This directory contains system design documents, component architectures, and technical specifications for the Global Context Network MVP.

## Documents

### Active Documents

| Date | Document | Status | Description |
|------|----------|--------|-------------|
| 2025-01-16 | [architecture-global-context-network-2025-01-16.md](./architecture-global-context-network-2025-01-16.md) | Active | Complete system architecture overview |
| 2025-01-16 | [architecture-subagent-system-2025-01-16.md](./architecture-subagent-system-2025-01-16.md) | Active | Subagent-driven development architecture |
| 2025-01-16 | [architecture-testing-harness-2025-01-16.md](./architecture-testing-harness-2025-01-16.md) | Active | Claude-powered testing infrastructure |
| 2025-01-16 | [architecture-hooks-event-capture-2025-01-16.md](./architecture-hooks-event-capture-2025-01-16.md) | Active | Hook implementation and event capture system |
| 2025-01-16 | [architecture-sanitization-pipeline-2025-01-16.md](./architecture-sanitization-pipeline-2025-01-16.md) | Active | PII detection and sanitization architecture |
| 2025-01-16 | [architecture-learning-extraction-2025-01-16.md](./architecture-learning-extraction-2025-01-16.md) | Active | Learning extraction and quality scoring |
| 2025-01-16 | [architecture-mcp-server-2025-01-16.md](./architecture-mcp-server-2025-01-16.md) | Active | MCP server implementation for agent queries |
| 2025-01-16 | [architecture-database-schema-2025-01-16.md](./architecture-database-schema-2025-01-16.md) | Active | Database schema design and migrations |
| 2025-01-16 | [architecture-async-processing-2025-01-16.md](./architecture-async-processing-2025-01-16.md) | Active | Complete async job queue architecture with workers, leasing, and retry logic |

## Key Architectural Patterns

### Privacy-First Design
ALL data is sanitized BEFORE storage. The system guarantees zero PII leaks through:
- Rule-based PII detection (fast, deterministic)
- AI-powered context-aware sanitization
- Hybrid validation pipeline
- Audit logging for continuous improvement

### Subagent-Driven Development
Every component is implemented by specialized subagents:
- Implementation subagents build features
- Test subagents generate and validate tests
- Quality gate subagents enforce standards
- Integration subagents verify component interactions

### Async-First Architecture
Non-blocking design with persistent queues:
- Event capture never blocks user
- Sanitization runs asynchronously
- Learning extraction happens in background
- Mining/upload processes independently

## System Components

1. **Event Capture Layer** (Hooks + Queue)
2. **Sanitization Pipeline** (Rules + AI)
3. **Storage Layer** (SQLite + Migrations)
4. **Async Processing** (Job Queue + Workers)
5. **Learning Extraction** (Analysis + Scoring)
6. **Query Interface** (MCP Server)
7. **Network Layer** (IPFS + Blockchain)

## Related Categories

- [Decisions](../decisions/INDEX.md) - ADRs explaining architectural choices
- [Plans](../plans/INDEX.md) - Implementation roadmaps
- [Reference](../reference/INDEX.md) - Technical specifications

## Quick Tips

- Start with the global architecture document for overview
- Review component-specific docs for deep dives
- Check ADRs for rationale behind decisions
- Use diagrams for understanding data flow
