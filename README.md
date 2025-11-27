# Global Context Network MVP

Privacy-first system for capturing, sanitizing, and sharing learnings from Claude Code conversations.

## Status

✅ **Levels 0-15 Complete** (83 passing tests)

## Overview

Captures Claude Code conversations through hooks, sanitizes all PII using regex + AI validation, extracts learnings, and exposes them via MCP for agent queries. Future phases will add IPFS + blockchain for global sharing.

## Quick Start

```bash
npm install
npm run test:once  # Run all 83 tests
npm run build      # Compile TypeScript
npm run lint       # Check code quality
```

### Running Components

```bash
# Workers (process async jobs)
npm run worker:sanitize
npm run worker:learning

# MCP Server (query learnings)
npm run mcp:server
```

### MCP Configuration

To enable learning queries in Claude Code, configure the MCP server:

**1. Build the project:**
```bash
npm run build
```

**2. Create `.mcp.json` in project root:**
```json
{
  "mcpServers": {
    "gcn-learnings": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {
        "DB_PATH": "./data/context.db"
      }
    }
  }
}
```

**3. Query learnings in Claude Code:**
```
Search learnings for "typescript"
Get learning 01HQ2X3Y4Z5A6B7C8D9E0F1G2H
```

See `docs/guides/guide-mcp-server-setup.md` for complete setup instructions.

## Architecture

```
src/
  ├── hooks/        # Claude Code event capture
  ├── sanitization/ # 12 PII patterns (regex + AI validation)
  ├── queue/        # SQLite-based job queue
  ├── workers/      # Async sanitization + learning extraction
  ├── learning/     # Heuristic + AI-powered extractors
  ├── mcp/          # Model Context Protocol server
  ├── db/           # SQLite schema + migrations
  └── e2e/          # Full pipeline integration tests
.claude/hooks/      # Compiled hook artifacts (<100ms budget)
docs/               # Architecture, decisions, plans, learnings
```

## Key Features

### Privacy-First Sanitization
- **12 PII patterns**: emails, phones, IPs, paths, API keys (OpenAI, Anthropic, AWS, GitHub), JWTs, SSH keys, credit cards, SSNs
- **<50ms regex-based** fast sanitization in hooks before any disk write
- **AI validation** via async workers for missed patterns
- Full test coverage in `src/e2e/full-flow.test.ts`

### Learning Extraction
- Heuristic extraction (code blocks) + AI-powered analysis
- Async job queue for non-blocking processing
- Conversation correlation via ULIDs + sequences

### MCP Integration
- `get_learning` and `search_learnings` tools
- JSON-based query interface for agent access

## Development Standards

- **Privacy**: Never persist raw PII—sanitize before storage
- **IDs**: ULID (sortable, collision-resistant)
- **Timestamps**: ISO-8601 with UTC
- **TypeScript**: Strict mode, full type safety
- **Testing**: TDD with 83 passing tests (19 test files)

## Documentation

- `docs/architecture/` - System design
- `docs/decisions/` - ADRs (14 files)
- `docs/plans/` - Implementation roadmap (15-level strategy)
- `docs/learnings/` - Level-by-level retrospectives (17 files)
- `docs/STANDARDS.md` - Canonical coding standards

See `docs/INDEX.md` for complete navigation.

## License

MIT
