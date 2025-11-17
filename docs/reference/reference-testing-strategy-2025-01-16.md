# Testing Strategy Reference

> Comprehensive testing strategy, coverage requirements, and test organization for Global Context Network

---
title: Testing Strategy Reference
category: reference
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [testing, tdd, vitest, coverage, quality]
applies_to: Vitest 1.x, Node.js 20+
---

## Overview

This document defines the complete testing strategy for the Global Context Network MVP. Every component MUST follow TDD (Test-Driven Development) with strict coverage requirements and quality gates.

**Core Principle**: Write failing tests first, then minimal implementation, then refactor.

## Test Pyramid

### Distribution

```
        10%  E2E Tests (Full workflows)
       ────────────────────
      /                    \
     /    20% Integration   \
    /      (Component         \
   /       interactions)        \
  /                              \
 /      70% Unit Tests            \
/    (Isolated functions)          \
────────────────────────────────────
```

### Rationale

- **70% Unit Tests**: Fast feedback, easy debugging, isolated testing
- **20% Integration Tests**: Verify component interactions, database transactions
- **10% E2E Tests**: Validate complete workflows, catch integration issues

### Coverage by Type

| Test Type | Speed | Isolation | Setup Complexity | Debugging |
|-----------|-------|-----------|------------------|-----------|
| Unit | <10ms | High | Low | Easy |
| Integration | <100ms | Medium | Medium | Medium |
| E2E | <5s | Low | High | Hard |

## Coverage Requirements

### Global Thresholds

```json
{
  "coverage": {
    "lines": 85,
    "statements": 85,
    "branches": 70,
    "functions": 85
  }
}
```

### Per-Scope Requirements

**Critical Path Files** (sanitization, hooks, database):
- Lines: ≥ 100%
- Statements: ≥ 100%
- Branches: ≥ 90%
- Functions: ≥ 100%

**Standard Files** (utilities, helpers):
- Lines: ≥ 85%
- Statements: ≥ 85%
- Branches: ≥ 70%
- Functions: ≥ 85%

**Infrastructure Files** (config, types):
- Lines: ≥ 50%
- Statements: ≥ 50%
- Branches: ≥ 30%
- Functions: ≥ 50%

### Critical Path Definition

Files matching these patterns require 100% coverage:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        perFile: true,
        'src/sanitization/**/*.ts': {
          lines: 100,
          statements: 100,
          branches: 90,
          functions: 100
        },
        'src/hooks/**/*.ts': {
          lines: 100,
          statements: 100,
          branches: 90,
          functions: 100
        },
        'src/database/repositories/**/*.ts': {
          lines: 100,
          statements: 100,
          branches: 90,
          functions: 100
        }
      }
    }
  }
});
```

### Exclusions Policy

**Excluded from coverage**:
- `**/*.d.ts` - Type definitions
- `**/generated/**` - Generated code
- `**/migrations/**/*.sql` - SQL migrations
- `**/config/**/*.ts` - Configuration files (but test loading logic)
- `**/__mocks__/**` - Test mocks
- `**/test-helpers/**` - Test utilities

**Must be tested**:
- Configuration loading and validation
- Migration application logic
- Generated code usage (integration tests)

## Testing Framework Configuration

### Canonical Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Isolation
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true
      }
    },

    // Test matching
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{git,cache,output,temp}/**'
    ],

    // Environment
    environment: 'node',
    environmentOptions: {},

    // Setup files
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/global-setup.ts'],

    // Timeouts
    testTimeout: 5000,
    hookTimeout: 10000,

    // Retry flaky tests once
    retry: 1,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/*.d.ts',
        '**/generated/**',
        '**/migrations/**',
        '**/config/**',
        '**/__mocks__/**',
        '**/test-helpers/**'
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 70,
        functions: 85
      }
    },

    // Fake timers
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
    },

    // Inline snapshots
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath.replace(/\.test\.([tj]sx?)/, `.test${snapExtension}.$1`);
    }
  }
});
```

### SQLite Test Database Setup

```typescript
// tests/setup.ts
import { beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations';

let testDb: Database.Database | null = null;

export function getTestDb(): Database.Database {
  if (!testDb) {
    // In-memory database for fast tests
    testDb = new Database(':memory:');

    // Enable WAL mode (even for in-memory)
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('synchronous = FULL');
    testDb.pragma('foreign_keys = ON');

    // Run all migrations
    runMigrations(testDb);
  }
  return testDb;
}

// Reset database between tests
beforeEach(() => {
  const db = getTestDb();

  // Clear all tables
  db.exec(`
    DELETE FROM sanitization_log;
    DELETE FROM uploads;
    DELETE FROM learnings;
    DELETE FROM messages;
    DELETE FROM conversations;
    DELETE FROM job_queue;
  `);
});

afterEach(() => {
  // Verify no locks
  if (testDb) {
    const locks = testDb.pragma('database_list', { simple: true });
    // Assert no active transactions
  }
});

// Cleanup after all tests
process.on('beforeExit', () => {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
});
```

### CI/CD Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20, 22]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm run lint

      - name: Type check
        run: pnpm run type-check

      - name: Unit tests
        run: pnpm run test:unit

      - name: Integration tests
        run: pnpm run test:integration

      - name: E2E tests
        run: pnpm run test:e2e

      - name: Coverage check
        run: pnpm run test:coverage

      - name: Security audit
        run: pnpm audit --audit-level=moderate

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Test Organization

### Directory Structure

```
tests/
├── unit/                     # Unit tests (70%)
│   ├── sanitization/
│   │   ├── rule-detector.test.ts
│   │   ├── ai-sanitizer.test.ts
│   │   └── hybrid-validator.test.ts
│   ├── hooks/
│   │   ├── user-prompt-submit.test.ts
│   │   └── stop-hook.test.ts
│   ├── database/
│   │   ├── repositories/
│   │   │   ├── conversation-repository.test.ts
│   │   │   └── learning-repository.test.ts
│   │   └── migrations/
│   │       └── migration-runner.test.ts
│   └── utils/
│       └── validators.test.ts
│
├── integration/              # Integration tests (20%)
│   ├── event-capture.int.test.ts
│   ├── sanitization-pipeline.int.test.ts
│   ├── learning-extraction.int.test.ts
│   └── mcp-server.int.test.ts
│
├── e2e/                      # End-to-end tests (10%)
│   ├── conversation-to-learning.e2e.test.ts
│   ├── hook-to-database.e2e.test.ts
│   └── query-via-mcp.e2e.test.ts
│
├── fixtures/                 # Test data
│   ├── conversations/
│   │   ├── with-pii.json
│   │   └── sanitized.json
│   ├── learnings/
│   │   └── examples.json
│   └── sanitization/
│       ├── api-keys.txt
│       ├── file-paths.txt
│       └── pii-corpus.json
│
├── helpers/                  # Test utilities
│   ├── db-helpers.ts
│   ├── fixture-factory.ts
│   └── mock-helpers.ts
│
├── setup.ts                  # Test setup
└── global-setup.ts           # Global setup
```

### Naming Conventions

**Files**:
- Unit tests: `*.test.ts`
- Integration tests: `*.int.test.ts`
- E2E tests: `*.e2e.test.ts`

**Test cases**:
```typescript
describe('RuleBasedDetector', () => {
  describe('detectAPIKeys', () => {
    it('should detect AWS access keys', () => {
      // Test implementation
    });

    it('should detect OpenAI API keys', () => {
      // Test implementation
    });

    it('should return empty array for clean content', () => {
      // Test implementation
    });
  });
});
```

## TDD Workflow

### Red-Green-Refactor with Subagents

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 RED PHASE (Test Generator Subagent)                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Generate failing test                                    │
│ 2. Validate test quality (Test Quality Validator)           │
│ 3. Run test → confirm proper failure                        │
│ 4. Commit test                                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 🟢 GREEN PHASE (Implementation Subagent)                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Write minimal code to pass test                          │
│ 2. Run tests continuously                                    │
│ 3. Validate implementation (Implementation Validator)       │
│ 4. All tests pass → proceed                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 🔵 REFACTOR PHASE (Code Quality Validator)                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Improve code quality                                     │
│ 2. Maintain passing tests                                   │
│ 3. Re-validate quality                                      │
│ 4. Commit refactoring                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ ✅ QUALITY GATE (All Validators in Parallel)                │
├─────────────────────────────────────────────────────────────┤
│ • Coverage ≥ 85%                                             │
│ • Security scan passes                                       │
│ • Performance acceptable                                     │
│ • Lint + TypeScript strict mode                             │
└─────────────────────────────────────────────────────────────┘
```

### Example TDD Cycle

```typescript
// 🔴 RED: Write failing test first
describe('detectAPIKeys', () => {
  it('should detect AWS access keys', () => {
    const content = 'AKIAIOSFODNN7EXAMPLE';
    const result = detectAPIKeys(content);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'aws_access_key',
      start: 0,
      end: 20,
      confidence: 1.0
    });
  });
});

// Run: pnpm test
// ❌ FAIL: ReferenceError: detectAPIKeys is not defined

// 🟢 GREEN: Minimal implementation
export function detectAPIKeys(content: string): Detection[] {
  const AWS_KEY_REGEX = /AKIA[0-9A-Z]{16}/g;
  const matches: Detection[] = [];

  let match;
  while ((match = AWS_KEY_REGEX.exec(content)) !== null) {
    matches.push({
      type: 'aws_access_key',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 1.0
    });
  }

  return matches;
}

// Run: pnpm test
// ✅ PASS

// 🔵 REFACTOR: Extract regex patterns
const API_KEY_PATTERNS = {
  aws_access_key: /AKIA[0-9A-Z]{16}/g,
  openai: /sk-[a-zA-Z0-9]{48}/g,
  github: /ghp_[a-zA-Z0-9]{36}/g
};

export function detectAPIKeys(content: string): Detection[] {
  const matches: Detection[] = [];

  for (const [type, pattern] of Object.entries(API_KEY_PATTERNS)) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      matches.push({
        type,
        start: match.index,
        end: match.index + match[0].length,
        confidence: 1.0
      });
    }
  }

  return matches;
}

// Run: pnpm test
// ✅ PASS (all tests still pass after refactor)
```

## Mocking Strategy

### When to Mock vs Stub vs Fake

| Dependency | Strategy | Rationale |
|------------|----------|-----------|
| Database | Fake (in-memory SQLite) | Fast, realistic behavior |
| LLM API | Stub (recorded fixtures) | Deterministic, no API costs |
| MCP Server | Fake (local test server) | Contract testing |
| IPFS | Stub (deterministic CIDs) | No external dependency |
| Blockchain | Stub (fake tx hashes) | No real transactions |
| File System | Real (temp directory) | OS compatibility testing |
| Time | Fake (vitest fake timers) | Deterministic timing |
| Random | Seeded RNG | Reproducible tests |

### LLM Call Mocking

```typescript
// tests/helpers/mock-llm.ts
import { vi } from 'vitest';

interface MockCompletion {
  input: string;
  output: string;
  model?: string;
}

export function mockLLMWithFixtures(fixtures: MockCompletion[]) {
  return vi.fn(async (input: string) => {
    const fixture = fixtures.find(f => f.input === input);
    if (!fixture) {
      throw new Error(`No fixture for input: ${input}`);
    }
    return fixture.output;
  });
}

// Usage in tests
import { sanitizeWithAI } from '../src/sanitization/ai-sanitizer';

it('should sanitize PII using AI', async () => {
  const mockLLM = mockLLMWithFixtures([
    {
      input: 'My email is john@example.com',
      output: 'My email is [EMAIL]'
    }
  ]);

  const result = await sanitizeWithAI('My email is john@example.com', mockLLM);
  expect(result).toBe('My email is [EMAIL]');
});
```

### MCP Server Mocking

```typescript
// tests/helpers/mock-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createMockMCPServer() {
  const server = new Server({
    name: 'test-context-server',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {},
      resources: {}
    }
  });

  // Mock search_learnings tool
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name === 'search_learnings') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: '1', content: 'Test learning', confidence: 0.9 }
            ])
          }
        ]
      };
    }
    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}
```

### Deterministic Time and Randomness

```typescript
// Use fake timers
import { vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-16T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

it('should retry after 1 second', async () => {
  const fn = vi.fn()
    .mockRejectedValueOnce(new Error('Fail'))
    .mockResolvedValueOnce('Success');

  const promise = retryWithBackoff(fn, { initialDelay: 1000 });

  await vi.advanceTimersByTimeAsync(1000);

  const result = await promise;
  expect(result).toBe('Success');
  expect(fn).toHaveBeenCalledTimes(2);
});

// Seeded random for reproducibility
import seedrandom from 'seedrandom';

const rng = seedrandom('test-seed-123');

it('should randomly sample with seed', () => {
  const samples = Array.from({ length: 10 }, () => rng());
  // Always produces same sequence
  expect(samples[0]).toBeCloseTo(0.9282578795792454);
});
```

## Performance Testing

### Component SLAs

| Component | P50 | P95 | P99 | Max |
|-----------|-----|-----|-----|-----|
| Hook execution | <50ms | <100ms | <150ms | 200ms |
| Event queueing | <10ms | <50ms | <100ms | 200ms |
| Sanitization | <1s | <2s | <3s | 5s |
| Database queries | <50ms | <100ms | <200ms | 500ms |
| MCP queries | <100ms | <200ms | <500ms | 1s |
| Learning extraction | <2s | <5s | <10s | 30s |

### Measurement Strategy

```typescript
// tests/performance/hook-performance.test.ts
import { performance } from 'perf_hooks';

describe('Hook Performance', () => {
  it('should execute UserPromptSubmit hook under 100ms P95', async () => {
    const samples: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await userPromptSubmitHook({ prompt: 'Test prompt' });
      const duration = performance.now() - start;
      samples.push(duration);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];

    expect(p95).toBeLessThan(100);
  });
});
```

### Load Testing

```javascript
// tests/load/k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% under 200ms
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/learnings/search?q=test');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

## Security Testing

### Static Analysis

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:security/recommended"
  ],
  "plugins": ["security"],
  "rules": {
    "security/detect-object-injection": "error",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-unsafe-regex": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-child-process": "error",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-non-literal-require": "error",
    "security/detect-possible-timing-attacks": "warn",
    "security/detect-pseudoRandomBytes": "error"
  }
}
```

### Dependency Scanning

```bash
# Run in CI
pnpm audit --audit-level=moderate
pnpm outdated

# Use npm-check-updates
npx ncu -u
```

### Secret Scanning

```yaml
# .github/workflows/security.yml
- name: Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Sanitization Red-Team Tests

```typescript
// tests/security/sanitization-redteam.test.ts
import { sanitizationPipeline } from '../src/sanitization/pipeline';
import { piiCorpus } from '../fixtures/sanitization/pii-corpus';

describe('Sanitization Red Team Tests', () => {
  // Test against curated corpus of PII
  it.each(piiCorpus.api_keys)('should detect API key: %s', async (apiKey) => {
    const content = `Here is my key: ${apiKey}`;
    const result = await sanitizationPipeline(content);

    expect(result.content).not.toContain(apiKey);
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0].type).toBe('api_key');
  });

  // Adversarial prompts
  it('should handle obfuscated API keys', async () => {
    const content = 'My key is: A K I A I O S F O D N N 7 E X A M P L E';
    const result = await sanitizationPipeline(content);

    // Should still detect when spaces are normalized
    expect(result.content).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  // False positive checks
  it('should not flag variable names as API keys', async () => {
    const content = 'const apiKey = getEnvVar("API_KEY");';
    const result = await sanitizationPipeline(content);

    expect(result.detections).toHaveLength(0);
  });
});
```

### PII Corpus Structure

```json
// fixtures/sanitization/pii-corpus.json
{
  "api_keys": {
    "aws": ["AKIAIOSFODNN7EXAMPLE", "AKIAI44QH8DHBEXAMPLE"],
    "openai": ["sk-proj-abc123..."],
    "github": ["ghp_1234567890abcdef..."]
  },
  "file_paths": {
    "absolute_with_username": [
      "/Users/john/projects/app",
      "C:\\Users\\jane\\Documents"
    ],
    "relative_safe": [
      "./src/index.ts",
      "../utils/helpers.ts"
    ]
  },
  "emails": [
    "john.doe@example.com",
    "test+filter@domain.co.uk"
  ],
  "ip_addresses": [
    "192.168.1.1",
    "10.0.0.1",
    "2001:0db8:85a3::8a2e:0370:7334"
  ],
  "person_names": [
    "John Doe",
    "Jane Smith"
  ],
  "phone_numbers": [
    "+1-555-123-4567",
    "(555) 987-6543"
  ]
}
```

## Test Data Management

### Fixture Factories

```typescript
// tests/helpers/fixture-factory.ts
import { faker } from '@faker-js/faker';

export function createConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: faker.string.uuid(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    session_id: faker.string.alphanumeric(32),
    correlation_id: faker.string.uuid(),
    sanitized: true,
    ...overrides
  };
}

export function createMessage(overrides?: Partial<Message>): Message {
  return {
    id: faker.string.uuid(),
    conversation_id: faker.string.uuid(),
    role: faker.helpers.arrayElement(['user', 'assistant']),
    content: faker.lorem.paragraph(),
    created_at: new Date().toISOString(),
    sequence: faker.number.int({ min: 0, max: 100 }),
    ...overrides
  };
}

export function createLearning(overrides?: Partial<Learning>): Learning {
  return {
    id: faker.string.uuid(),
    conversation_id: faker.string.uuid(),
    category: faker.helpers.arrayElement(['pattern', 'best_practice', 'bug_fix']),
    content: faker.lorem.sentences(3),
    confidence: faker.number.float({ min: 0.6, max: 1.0 }),
    tags: faker.helpers.arrayElements(['typescript', 'testing', 'database'], { min: 1, max: 3 }),
    created_at: new Date().toISOString(),
    dedupe_hash: faker.string.alphanumeric(64),
    ...overrides
  };
}
```

### Synthetic vs Real Data

**Unit Tests**: 100% synthetic data via faker
**Integration Tests**: Synthetic data + realistic fixtures
**E2E Tests**: Sanitized real-world examples

### Data Versioning

```typescript
// fixtures/conversations/v1/with-pii.json
{
  "version": "1.0.0",
  "schema": "conversation-with-messages",
  "data": {
    // ...
  }
}
```

## Canonical Commands

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:perf": "k6 run tests/load/k6-load-test.js",
    "test:mutation": "stryker run",
    "test:ci": "pnpm run lint && pnpm run type-check && pnpm run test:coverage && pnpm run test:perf"
  }
}
```

## Flaky Test Policy

### Rules

1. **No disabled tests in main branch**
2. **Quarantine flaky tests** to separate file
3. **Fix within 7 days** or remove
4. **Track flakiness** in test metadata

### Quarantine Process

```typescript
// tests/quarantine/flaky-tests.test.ts
import { describe, it, skip } from 'vitest';

describe.skip('Quarantined Tests', () => {
  it.skip('flaky test - issue #123', () => {
    // Test that needs fixing
  });
});
```

## Mutation Testing

```javascript
// stryker.config.mjs
export default {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [
    'src/sanitization/**/*.ts',
    'src/hooks/**/*.ts',
    'src/database/repositories/**/*.ts'
  ],
  thresholds: { high: 80, low: 60, break: 50 }
};
```

## Related Documents

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Subagent System](../architecture/architecture-subagent-system-2025-01-16.md)

### Guides
- [TDD Workflow Guide](../guides/guide-tdd-workflow-2025-01-16.md)
- [Testing Harness Usage](../guides/guide-testing-harness-usage-2025-01-16.md)

### Reference
- [Subagent Types](./reference-subagent-types-2025-01-16.md)
- [Database Schema](./reference-database-schema-2025-01-16.md)
