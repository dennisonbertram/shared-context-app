# Guides Documentation

> Last updated: 2025-01-16

## Overview

This directory contains step-by-step how-to guides for developing the Global Context Network MVP. Each guide is designed to be completed in < 2 hours with working code examples and verification steps.

## Quick Start Path

**Recommended Learning Order**:

```
1. Phase 0 Foundation Setup (90 min)
        ↓
2. Database Setup (30-45 min)
        ↓
3. Claude Agent SDK Integration (90 min)
        ↓
4. Using Subagents (90 min)
        ↓
5. Testing Harness Usage (120 min)
        ↓
6. TDD Workflow (90 min)
        ↓
7. Phase 1 Hook Development (150 min)
```

**Total Time**: ~10.5-11 hours to complete all guides

## Available Guides

| Date | Document | Time | Status | Description |
|------|----------|------|--------|-------------|
| 2025-01-16 | [guide-phase-0-foundation-setup-2025-01-16.md](./guide-phase-0-foundation-setup-2025-01-16.md) | 90 min | ✅ Ready | Set up TypeScript, Vitest, SQLite foundation |
| 2025-01-16 | [guide-database-setup-2025-01-16.md](./guide-database-setup-2025-01-16.md) | 30-45 min | ✅ Ready | Step-by-step SQLite database setup with canonical schema and Atlas migrations |
| 2025-01-16 | [guide-claude-agent-sdk-integration-2025-01-16.md](./guide-claude-agent-sdk-integration-2025-01-16.md) | 90 min | ✅ Ready | Integrate Claude Agent SDK for subagent orchestration |
| 2025-01-16 | [guide-using-subagents-2025-01-16.md](./guide-using-subagents-2025-01-16.md) | 90 min | ✅ Ready | Delegate to specialized subagents effectively |
| 2025-01-16 | [guide-testing-harness-usage-2025-01-16.md](./guide-testing-harness-usage-2025-01-16.md) | 120 min | ✅ Ready | Use Claude-powered testing for AI-driven validation |
| 2025-01-16 | [guide-tdd-workflow-2025-01-16.md](./guide-tdd-workflow-2025-01-16.md) | 90 min | ✅ Ready | Master Red-Green-Refactor with subagents |
| 2025-01-16 | [guide-phase-1-hook-development-2025-01-16.md](./guide-phase-1-hook-development-2025-01-16.md) | 150 min | ✅ Ready | Implement Claude Code hooks for event capture |

## Guide Structure

Each guide follows a consistent format:

### 1. Overview
- What you'll learn
- Time to complete
- What you'll build

### 2. Prerequisites
- Required setup
- Prior guides to complete
- Knowledge requirements

### 3. Step-by-Step Instructions
- Numbered steps with clear goals
- Complete, copy-paste code examples
- Expected output shown
- Verification at each step

### 4. Troubleshooting
- Common issues and solutions
- OS-specific caveats
- Debugging tips

### 5. Verification
- "You're done when..." checklist
- How to verify everything works
- What to check

### 6. Next Steps
- Links to related guides
- What to learn next
- How to apply knowledge

## Guide Categories

### Foundation & Setup
- **Phase 0 Foundation Setup**: TypeScript project, Vitest, SQLite, linting
- **Claude Agent SDK Integration**: SDK installation, configuration, basic usage

### Development Patterns
- **Using Subagents**: Delegation patterns, parallel/sequential execution
- **TDD Workflow**: Red-Green-Refactor with AI validation
- **Testing Harness Usage**: AI-powered test generation and validation

### Feature Implementation
- **Phase 1 Hook Development**: Event capture with Claude Code hooks

## Learning Paths

### Path 1: Quick Start (Backend Developer)
If you're experienced with TypeScript/Node.js:

1. **Phase 0 Setup** (skim if familiar)
2. **Claude Agent SDK** (focus on query() API)
3. **Using Subagents** (core delegation patterns)
4. **Phase 1 Hooks** (apply to real feature)

**Time**: ~6 hours

### Path 2: Full TDD Journey
For comprehensive TDD mastery:

1. **Phase 0 Setup**
2. **Testing Harness Usage**
3. **TDD Workflow**
4. **Phase 1 Hooks** (applying TDD)

**Time**: ~7.5 hours

### Path 3: Subagent Expert
Deep dive into AI orchestration:

1. **Phase 0 Setup**
2. **Claude Agent SDK** (all patterns)
3. **Using Subagents** (parallel/sequential)
4. **Testing Harness** (MCP integration)
5. **TDD Workflow** (subagent-driven)

**Time**: ~8 hours

## Prerequisites by Guide

### Phase 0 Foundation Setup
- Node.js 18+
- Basic TypeScript knowledge
- Command line familiarity

### Claude Agent SDK Integration
- Phase 0 complete
- Anthropic API key
- Understanding of async/await

### Using Subagents
- Phase 0 complete
- Claude Agent SDK integrated
- Understanding of delegation patterns

### Testing Harness Usage
- Subagents guide complete
- Vitest installed
- MCP server basics

### TDD Workflow
- Testing harness complete
- Subagents guide complete
- Understanding of TDD concepts

### Phase 1 Hook Development
- Phase 0 complete
- TDD workflow understood
- Subagents guide complete

## Key Concepts Covered

### TypeScript & Tooling
- Strict mode configuration
- ESLint and Prettier setup
- Vitest test runner
- Type-safe database queries

### Claude Agent SDK
- query() API usage
- Subagent definitions
- Streaming responses
- MCP server integration
- Error handling and retry logic

### Testing
- Test-driven development
- AI-powered test generation
- Test quality validation
- Coverage requirements
- Integration and E2E testing

### Subagents
- Delegation patterns
- Parallel execution
- Sequential dependencies
- Quality gates
- Monitoring and debugging

### Claude Code Hooks
- Event capture
- Performance requirements (< 100ms)
- Fast sanitization
- Persistent queues
- Error handling

## Common Patterns

### Pattern 1: Generate Tests with Subagent

```typescript
const testCode = await invokeSubagent(
  'unit-test-generator',
  'Generate tests for sanitizeApiKeys(text)',
  { agents: testGeneratorSubagents }
);
```

### Pattern 2: Validate Quality

```typescript
const validation = await validateTestQuality('./test-file.ts');
if (!validation.passed) {
  throw new Error(`Quality gate failed: ${validation.score}`);
}
```

### Pattern 3: Parallel Execution

```typescript
const [impl, tests] = await runParallel(
  [
    { agent: 'code-writer', prompt: 'Implement feature' },
    { agent: 'test-generator', prompt: 'Generate tests' },
  ],
  config
);
```

### Pattern 4: TDD Cycle

```typescript
// RED: Generate failing test
const test = await generateTest(feature);

// GREEN: Implement minimal code
const impl = await implementFeature(test);

// REFACTOR: Improve quality
const refactored = await refactorCode(impl);
```

## Troubleshooting Resources

### Common Issues

**Issue**: TypeScript strict mode errors

**Solution**: See [Phase 0 Foundation Setup - Troubleshooting](./guide-phase-0-foundation-setup-2025-01-16.md#troubleshooting)

**Issue**: MCP server not connecting

**Solution**: See [Testing Harness Usage - Troubleshooting](./guide-testing-harness-usage-2025-01-16.md#troubleshooting)

**Issue**: Hooks too slow (> 100ms)

**Solution**: See [Phase 1 Hook Development - Troubleshooting](./guide-phase-1-hook-development-2025-01-16.md#troubleshooting)

## Related Categories

- [Architecture](../architecture/INDEX.md) - System design and component architecture
- [Plans](../plans/INDEX.md) - Implementation plans and roadmaps
- [Reference](../reference/INDEX.md) - Technical specifications and APIs
- [Decisions](../decisions/INDEX.md) - ADRs explaining choices

## Quick Reference

### Environment Variables

```bash
# Required for all guides
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Database
DB_PATH=./data/context.db

# MCP Test Runner
MCP_TEST_RUNNER_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

### Essential Commands

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Tests
npm run test

# Coverage
npm run coverage

# Build
npm run build

# Database migrations
npm run db:migrate

# MCP Test Runner
npm run mcp:test-runner
```

### File Structure

```
project/
├── .claude/
│   └── hooks/           # Claude Code hooks
│       ├── hooks.json
│       ├── user-prompt-submit.ts
│       └── stop.ts
├── src/
│   ├── agents/          # Subagent configurations
│   │   ├── subagents/
│   │   ├── orchestration/
│   │   └── workflows/
│   ├── db/              # Database utilities
│   ├── queue/           # Event queue
│   ├── sanitization/    # PII redaction
│   ├── mcp/             # MCP servers
│   └── types/           # TypeScript types
├── tests/               # Test files
├── data/                # SQLite database
└── docs/                # Documentation
```

## Tips for Success

1. **Follow the order**: Guides build on each other
2. **Complete verification**: Check "You're done when..." sections
3. **Run all examples**: Don't skip code execution
4. **Use provided code**: Copy-paste to avoid typos
5. **Check expected output**: Verify results match
6. **Troubleshoot early**: Don't skip error checks
7. **Ask questions**: Reference architecture docs for deep dives

## Getting Help

If you're stuck:

1. Check the guide's **Troubleshooting** section
2. Review **Expected output** sections
3. Consult related **Architecture** documents
4. Review **Reference** documentation for APIs
5. Check **Decisions** for context on choices

## Contributing

When adding new guides:

1. Follow the standard structure
2. Include copy-paste code examples
3. Show expected outputs
4. Add verification steps
5. Include troubleshooting section
6. Link to related documents
7. Update this INDEX.md
8. Test all code examples work

## Naming Convention

```
guide-{topic}-YYYY-MM-DD.md
```

Examples:
- `guide-phase-0-foundation-setup-2025-01-16.md`
- `guide-using-subagents-2025-01-16.md`
- `guide-tdd-workflow-2025-01-16.md`

---

*These guides are designed to be beginner-friendly while maintaining professional depth. Complete them in order for the best learning experience.*
