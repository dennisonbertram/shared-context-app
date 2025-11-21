# Shared Context App - Global Context Network MVP

> Privacy-first learning capture and sharing system

## Status

**Current Level**: Level 0 Complete ✅

**Implementation Strategy**: Iterative build with 15 levels (see `docs/plans/plan-iterative-build-strategy-2025-01-16.md`)

## Project Overview

This project implements a Global Context Network MVP that:
- Captures conversations via Claude hooks
- Sanitizes PII before storage (privacy-first)
- Extracts learnings from conversations
- Provides MCP server for querying learnings
- Enables global sharing via IPFS + blockchain (MVP+)

## Quick Start

### Prerequisites

- Node.js 18+
- npm 8+

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Development

### Testing

```bash
# Run tests once
npm run test:once

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run coverage
```

### Code Quality

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

## Repository Layout

```
docs/               # Architecture, plans, decisions, learnings
src/
  ├── db/           # SQLite schema, migrations, helpers
  ├── hooks/        # Claude hook logic + tests
  ├── sanitization/ # Regex + AI validators
  ├── learning/     # Extractors + persistence
  ├── mcp/          # MCP server + tooling
  ├── queue/        # Job queue primitives
  ├── workers/      # Async processors
  ├── test-utils/   # Shared testing helpers
  └── types/        # Shared TypeScript types
.claude/            # Hook build workspace (tsconfig, dist)
dist/               # Compiled JS artifacts
```

## Implementation Levels

Following the iterative build strategy:

- ✅ **Level 0**: Foundation (TypeScript, Vitest, Hello World)
- ✅ **Level 1**: SQLite Connection
- ✅ **Level 2**: Hook Skeleton
- ✅ **Level 3**: Fast Sanitization (One PII Type)
- ✅ **Level 4**: End-to-End (Hook + Sanitize + Write)
- ✅ **Level 5**: Add remaining PII types (Phone, IP, etc)
- ✅ **Level 6**: Correlation IDs (Conversation grouping)
- ✅ **Level 7**: Job Queue (Async processing)
- ✅ **Level 8**: AI Validation (Claude Agent SDK)
- ✅ **Level 9**: Simple Learning Extraction
- ✅ **Level 10**: Basic MCP Server
- ✅ **Level 11**: Learning Search / MCP Search
- ✅ **Level 12**: AI-Assisted Learning Extraction
- ✅ **Level 13**: ULID Migration + Timestamps
- ✅ **Level 14**: Full Sanitization (All PII Types)
- ⏳ **Level 15**: End-to-End QA & telemetry hardening

See `docs/plans/plan-iterative-build-strategy-2025-01-16.md` for complete roadmap.

## Sanitization Coverage

- `src/sanitization/patterns.ts` enumerates regexes for 12 high-risk categories (email, phone, IP, paths, OpenAI + Anthropic API keys, AWS access keys, GitHub tokens, JWTs, SSH private keys, credit cards, SSNs).
- `comprehensiveSanitize()` (and the `fastSanitize` alias) now redact all categories in <50ms while tracking how many redactions occur.
- `.claude/hooks/src/userPromptSubmit.ts` duplicates the same patterns to keep the hook hermetic and <100ms without bundling the entire app.

## Documentation

All documentation is in the `docs/` directory:

- **Architecture**: System design and architecture decisions
- **Decisions**: ADRs (Architecture Decision Records)
- **Plans**: Implementation plans and roadmaps
- **Guides**: Step-by-step guides for development
- **Reference**: API references and schemas

## Standards

All code follows the standards defined in `docs/STANDARDS.md`:

- **Privacy First**: Never persist raw data, pre-sanitize before storage
- **ULID IDs**: All identifiers use ULID (not UUID)
- **ISO-8601 Timestamps**: All timestamps in UTC with Z suffix
- **Strict TypeScript**: Full type safety with strict mode
- **TDD Workflow**: Test-driven development with Red-Green-Refactor

## License

MIT
