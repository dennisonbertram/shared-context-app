# Testing Harness Architecture

> Claude-powered testing infrastructure with TDD enforcement and quality gates

---
title: Testing Harness Architecture
category: architecture
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [testing, claude-agent-sdk, tdd, quality-gates, subagents]
---

## Overview

The Testing Harness is a Claude-powered infrastructure that ensures code quality through Test-Driven Development (TDD), automated test generation, continuous validation, and quality gate enforcement. It leverages the Claude Agent SDK to create specialized subagents for different testing concerns.

**Core Principle**: Every feature is test-first, every test is validated, every implementation is verified.

## Goals

- Enforce TDD workflow (Red-Green-Refactor)
- Generate comprehensive test suites automatically
- Validate test quality and coverage
- Ensure zero regressions through continuous testing
- Provide fast feedback loops (< 30s for unit tests)
- Support deterministic testing for LLM-powered components

## Non-Goals

- Manual test writing (delegated to subagents)
- UI-based test runners (CLI-only for MVP)
- Cross-browser testing (not needed for Node.js backend)
- Performance testing (covered separately)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Claude Agent SDK                           │
│                  (Main Orchestrator)                         │
└──────────┬──────────────────────────────────────────────────┘
           │
           ├──────────────────────────────────────┐
           │                                       │
           ▼ Delegation                           ▼ Delegation
┌──────────────────────────┐          ┌──────────────────────────┐
│  Test Generator Subagent │          │ Test Validator Subagent  │
│  ┌────────────────────┐  │          │  ┌────────────────────┐  │
│  │ Unit Test Gen      │  │          │  │ Quality Validator  │  │
│  │ Integration Gen    │  │          │  │ Coverage Validator │  │
│  │ E2E Test Gen       │  │          │  │ Impl Validator     │  │
│  └────────────────────┘  │          │  └────────────────────┘  │
└──────────┬───────────────┘          └───────────┬──────────────┘
           │                                       │
           │                                       │
           ▼                                       ▼
┌──────────────────────────┐          ┌──────────────────────────┐
│   Implementation Agent   │          │  Quality Gate Subagent   │
│  - Writes minimal code   │          │  ┌────────────────────┐  │
│  - Passes tests          │◄─────────┤  │ Lint Validator     │  │
│  - Refactors             │          │  │ Type Validator     │  │
└──────────────────────────┘          │  │ Security Validator │  │
                                       │  │ Performance Check  │  │
                                       │  └────────────────────┘  │
                                       └──────────────────────────┘
           │                                       │
           └───────────────┬───────────────────────┘
                           ▼
                  ┌─────────────────┐
                  │  MCP Test Tool  │
                  │  ┌───────────┐  │
                  │  │ Run Tests │  │
                  │  │ Coverage  │  │
                  │  │ Validate  │  │
                  │  └───────────┘  │
                  └─────────┬───────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │   Vitest        │
                  │   (Test Runner) │
                  └─────────────────┘
```

## Components

### 1. Test Generator Subagents

**Purpose**: Automatically generate comprehensive test suites

#### Unit Test Generator

```typescript
{
  "unit-test-generator": {
    description: "Generates unit tests following TDD principles",
    prompt: `Generate unit tests with these requirements:
    - Test each function in complete isolation
    - Cover all edge cases and boundary conditions
    - Test error conditions thoroughly
    - Use arrange-act-assert pattern
    - Mock all external dependencies
    - Target coverage: > 85% lines, > 80% branches

    Use deterministic fixtures for LLM-powered components.
    Include property-based tests for complex logic.`,
    tools: ["Write", "Read", "mcp__test-runner__run_unit_tests"],
    model: "sonnet-4-5"
  }
}
```

**Key Features**:
- Deterministic testing for LLM steps (fixture-based outputs)
- Property-based testing using fast-check
- Adversarial test cases for PII detection
- Cost controls (local mocks for CI, cloud models for validation)

#### Integration Test Generator

```typescript
{
  "integration-test-generator": {
    description: "Creates integration tests for component interactions",
    prompt: `Generate integration tests:
    - Test real component interactions
    - Use actual database (SQLite in-memory for tests)
    - Verify async behavior and timing
    - Test transaction boundaries
    - Check error propagation paths
    - Validate job queue semantics`,
    tools: ["Write", "Read", "Bash", "mcp__test-runner__run_integration_tests"],
    model: "sonnet-4-5"
  }
}
```

**Key Features**:
- Real database interactions (in-memory SQLite)
- Async behavior verification
- Transaction testing
- Queue semantics validation

#### E2E Test Generator

```typescript
{
  "e2e-test-generator": {
    description: "Creates end-to-end workflow tests",
    prompt: `Generate E2E tests for complete workflows:
    - Hook → Event Queue → Sanitization → Database
    - Learning Extraction → Quality Filter → MCP Query
    - Mining Upload → IPFS → Blockchain
    - Test failure scenarios and recovery
    - Verify data integrity end-to-end`,
    tools: ["Write", "Read", "Bash", "mcp__test-runner__run_e2e_tests"],
    model: "sonnet-4-5"
  }
}
```

**Key Features**:
- Complete system workflows
- Failure scenario testing
- Data integrity verification
- Recovery path validation

### 2. Test Validation Subagents

**Purpose**: Ensure test quality and completeness

#### Test Quality Validator

```typescript
{
  "test-quality-validator": {
    description: "Reviews test code quality",
    prompt: `Validate tests against quality criteria:
    - Proper structure (describe, it, expect with clear names)
    - Complete edge case coverage
    - Strong assertions (not just truthy checks)
    - No flaky tests (deterministic execution)
    - Maintainable code (clear intent, minimal duplication)
    - Performance tests have clear thresholds

    Score each test 0-1. Require score > 0.8 to pass.
    Flag any non-deterministic behavior.`,
    tools: ["Read", "Grep", "mcp__test-runner__validate_test_quality"],
    model: "sonnet-4-5"
  }
}
```

**Quality Criteria**:
- Clear test names describing behavior
- Proper arrange-act-assert structure
- Strong, specific assertions
- Deterministic execution
- No shared mutable state
- Timing-independent

#### Coverage Validator

```typescript
{
  "coverage-validator": {
    description: "Ensures adequate test coverage",
    prompt: `Analyze test coverage:
    - Lines, statements, functions, branches
    - Critical paths MUST be covered
    - Sanitization code > 95% coverage
    - Queue error paths > 90% coverage
    - Hook handlers > 90% coverage
    - Overall target: > 85%

    Flag uncovered critical code.
    Fail if any critical path lacks coverage.`,
    tools: ["Read", "Bash", "mcp__test-runner__get_coverage_report"],
    model: "haiku"
  }
}
```

**Coverage Gates**:
- Sanitization: > 95% lines/branches
- Hooks: > 90% coverage
- Queue: > 90% error paths
- Overall: > 85% coverage
- No untested critical paths

#### Implementation Validator

```typescript
{
  "implementation-validator": {
    description: "Validates implementation against tests",
    prompt: `Verify implementation quality:
    - All tests pass
    - Handles all edge cases from tests
    - Proper error handling (no silent failures)
    - No security vulnerabilities (SQL injection, path traversal)
    - Follows TypeScript strict mode
    - Performance acceptable (within budgets)
    - No LLM over-trust (validate all outputs)`,
    tools: ["Read", "Grep", "Bash", "mcp__test-runner__run_unit_tests"],
    model: "sonnet-4-5"
  }
}
```

**Validation Checks**:
- All tests passing
- Error handling comprehensive
- Security vulnerabilities absent
- Performance within budgets
- Type safety enforced

### 3. Quality Gate Subagents

**Purpose**: Enforce standards before code integration

#### Code Quality Validator

```typescript
{
  "code-quality-validator": {
    description: "Reviews code quality standards",
    prompt: `Review code for quality:
    - TypeScript strict mode compliance
    - ESLint rules adhered to
    - Prettier formatting applied
    - Proper type annotations (no 'any')
    - Clear naming conventions
    - DRY principles followed
    - SOLID principles applied

    All checks MUST pass.`,
    tools: ["Read", "Bash", "Grep"],
    model: "sonnet-4-5"
  }
}
```

**Quality Checks**:
- Lint: ESLint passing
- Types: Strict TypeScript
- Format: Prettier applied
- Style: Naming conventions
- Architecture: SOLID principles

#### Security Validator

```typescript
{
  "security-validator": {
    description: "Scans for security vulnerabilities",
    prompt: `Security audit:
    - SQL injection (use parameterized queries only)
    - Command injection (sanitize shell inputs)
    - Path traversal (validate file paths)
    - Hardcoded secrets (reject commits with secrets)
    - Prompt injection resistance (LLM as stateless classifier)
    - Deserialization risks (validate JSON schemas)
    - Supply chain (check npm dependencies with Socket)

    Block if ANY critical issues found.`,
    tools: ["Read", "Bash", "Grep", "mcp__socket__depscore"],
    model: "sonnet-4-5"
  }
}
```

**Security Checks**:
- SQL injection prevention
- Command injection blocking
- Path traversal validation
- Secrets scanning
- Dependency security (Socket)
- Prompt injection resistance

#### Performance Validator

```typescript
{
  "performance-validator": {
    description: "Analyzes performance characteristics",
    prompt: `Analyze performance:
    - Algorithm complexity (avoid O(n²) in hot paths)
    - Database query efficiency (use EXPLAIN)
    - Memory usage patterns (no leaks)
    - Blocking operations (async where needed)
    - Resource leaks (proper cleanup)

    Performance budgets:
    - Hook execution: < 100ms
    - Event queueing: < 50ms
    - DB queries: < 100ms
    - MCP queries: < 200ms

    Fail if budgets exceeded.`,
    tools: ["Read", "Bash", "Grep"],
    model: "sonnet-4-5"
  }
}
```

**Performance Budgets**:
- Hook execution: < 100ms
- Event queueing: < 50ms
- Database queries: < 100ms
- MCP queries: < 200ms
- Sanitization: < 2s per conversation

### 4. MCP Test Runner Server

**Purpose**: Provide testing tools to subagents

#### Tool Schemas

**run_unit_tests**:
```typescript
{
  name: "run_unit_tests",
  description: "Execute unit tests with coverage",
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Test file pattern (e.g., '*.test.ts')" },
      timeout: { type: "number", default: 30000, description: "Timeout in ms" },
      coverage: { type: "boolean", default: true, description: "Collect coverage" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      passed: { type: "number" },
      failed: { type: "number" },
      skipped: { type: "number" },
      coverage: {
        type: "object",
        properties: {
          lines: { type: "number" },
          statements: { type: "number" },
          functions: { type: "number" },
          branches: { type: "number" }
        }
      },
      duration: { type: "number" },
      errors: { type: "array", items: { type: "string" } }
    }
  }
}
```

**validate_test_quality**:
```typescript
{
  name: "validate_test_quality",
  description: "Validate test code quality",
  inputSchema: {
    type: "object",
    properties: {
      testFile: { type: "string", description: "Path to test file" }
    },
    required: ["testFile"]
  },
  outputSchema: {
    type: "object",
    properties: {
      score: { type: "number", minimum: 0, maximum: 1 },
      issues: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } }
    }
  }
}
```

**get_coverage_report**:
```typescript
{
  name: "get_coverage_report",
  description: "Get detailed coverage report",
  inputSchema: {
    type: "object",
    properties: {
      format: { type: "string", enum: ["json", "html", "lcov"], default: "json" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: {
        type: "object",
        properties: {
          lines: { type: "object" },
          statements: { type: "object" },
          functions: { type: "object" },
          branches: { type: "object" }
        }
      },
      files: { type: "array" },
      uncovered: { type: "array", description: "Critical uncovered paths" }
    }
  }
}
```

## TDD Workflow

### Red-Green-Refactor Cycle

```
1. 🔴 RED Phase
   ├─► Test Generator creates failing test
   ├─► Test Quality Validator reviews test
   ├─► Run test → confirm it fails correctly
   └─► Score test quality (must be > 0.8)

2. 🟢 GREEN Phase
   ├─► Implementation Agent writes minimal code
   ├─► Run tests continuously
   ├─► Implementation Validator checks quality
   └─► All tests passing

3. 🔵 REFACTOR Phase
   ├─► Improve code quality
   ├─► Code Quality Validator reviews
   ├─► Run tests (must still pass)
   └─► Performance Validator checks budgets

4. ✅ QUALITY GATE
   ├─► Lint passing (ESLint)
   ├─► Types passing (TypeScript strict)
   ├─► Coverage > 85%
   ├─► Security scan clean
   ├─► Performance budgets met
   └─► ALL gates MUST pass
```

### Deterministic Testing for LLM Components

**Challenge**: LLM outputs are non-deterministic

**Solution**: Fixture-based testing

```typescript
// tests/fixtures/sanitization-outputs.ts
export const sanitizationFixtures = {
  "test-case-1": {
    input: "My email is john@example.com",
    expected: "My email is <EMAIL_1>",
    piiDetected: [
      { type: "email", value: "john@example.com", replacement: "<EMAIL_1>" }
    ]
  },
  "test-case-2": {
    input: "API key: sk-1234567890abcdef",
    expected: "API key: <API_KEY_1>",
    piiDetected: [
      { type: "api_key", value: "sk-1234567890abcdef", replacement: "<API_KEY_1>" }
    ]
  }
};

// tests/sanitization.test.ts
describe("Sanitization", () => {
  it("should sanitize using fixtures", () => {
    const fixture = sanitizationFixtures["test-case-1"];
    const result = sanitize(fixture.input, { useMock: true });
    expect(result.sanitized).toBe(fixture.expected);
    expect(result.piiDetected).toEqual(fixture.piiDetected);
  });
});
```

**Cost Controls**:
- CI uses local mocks (fixtures)
- Validation uses real LLM (rate-limited)
- Budget caps per day
- Graceful degradation to rules-only

### Property-Based Testing

For complex logic (especially PII detection):

```typescript
import { fc } from "fast-check";

describe("PII Detection Properties", () => {
  it("should detect all email formats", () => {
    fc.assert(
      fc.property(fc.emailAddress(), (email) => {
        const result = detectPII(email);
        return result.some(pii => pii.type === "email");
      })
    );
  });

  it("should be idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const first = sanitize(input);
        const second = sanitize(first.sanitized);
        return first.sanitized === second.sanitized;
      })
    );
  });
});
```

### Fuzz Testing for PII

```typescript
import { generatePIITestCases } from "./fuzz-generators";

describe("PII Fuzz Tests", () => {
  it("should detect adversarial PII patterns", () => {
    const testCases = generatePIITestCases(1000);

    for (const testCase of testCases) {
      const result = detectPII(testCase.input);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(pii => pii.type === testCase.expectedType)).toBe(true);
    }
  });
});
```

## Performance Testing

### Performance Test Structure

```typescript
describe("Performance Tests", () => {
  it("hook execution should be < 100ms", async () => {
    const start = performance.now();
    await hookHandler({ type: "UserPromptSubmit", data: sampleData });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it("should handle 100 concurrent events", async () => {
    const events = Array(100).fill(null).map(() => createEvent());
    const start = performance.now();

    await Promise.all(events.map(e => processEvent(e)));

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5000); // 50ms per event avg
  });
});
```

### Load Testing

```typescript
// tests/load/sanitization-load.test.ts
describe("Sanitization Load Tests", () => {
  it("should maintain performance at 10k conversations", async () => {
    const conversations = generateConversations(10000);

    const start = performance.now();
    for (const conv of conversations) {
      await sanitizeConversation(conv);
    }
    const duration = performance.now() - start;

    const avgDuration = duration / conversations.length;
    expect(avgDuration).toBeLessThan(2000); // < 2s per conversation
  });
});
```

## Error Handling

### Test Execution Errors

**Flaky Tests**:
```typescript
// Detect flaky tests
const results = [];
for (let i = 0; i < 10; i++) {
  results.push(await runTest());
}

const allPassed = results.every(r => r.passed);
const allFailed = results.every(r => !r.passed);

if (!allPassed && !allFailed) {
  throw new Error("Flaky test detected!");
}
```

**Timeout Handling**:
```typescript
// tests/utils/timeout.ts
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Test timeout")), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}
```

### Subagent Failures

**Retry Logic**:
```typescript
async function runSubagentWithRetry(
  subagentName: string,
  maxRetries = 3
): Promise<SubagentResult> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await runSubagent(subagentName);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(2 ** i * 1000); // Exponential backoff
    }
  }
  throw new Error("Max retries exceeded");
}
```

**Fallback Strategies**:
- Test generator fails → Manual test creation prompt
- Implementation fails → Simplify requirements
- Validator fails → Manual review required

## Integration with Claude Agent SDK

### Agent Configuration

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

export async function implementFeatureWithTDD(feature: string) {
  const response = query({
    prompt: `Implement ${feature} following strict TDD`,
    options: {
      model: "claude-sonnet-4-5",
      agents: {
        "unit-test-generator": unitTestGeneratorConfig,
        "implementation-agent": implementationAgentConfig,
        "test-quality-validator": testQualityValidatorConfig,
        "coverage-validator": coverageValidatorConfig,
        "code-quality-validator": codeQualityValidatorConfig
      },
      mcpServers: {
        "test-runner": testRunnerServer
      }
    }
  });

  for await (const message of response) {
    if (message.type === 'system' && message.subtype === 'subagent_start') {
      console.log(`Starting: ${message.agent_name}`);
    }
    if (message.type === 'system' && message.subtype === 'subagent_end') {
      console.log(`Completed: ${message.agent_name}`);
    }
  }
}
```

### Local Sandboxing

**Security**: Subagents run in restricted environment

```typescript
// Disable shell access unless explicitly allowed
const subagentConfig = {
  tools: ["Write", "Read"], // NO Bash by default
  allowedPaths: ["/project/src", "/project/tests"], // Restrict file access
  networkAccess: false, // No network by default
  maxExecutionTime: 300000 // 5 minute timeout
};
```

## Monitoring and Metrics

### Key Metrics

**Test Performance**:
- Test execution time (target: < 30s for unit tests)
- Coverage percentage (target: > 85%)
- Flaky test count (target: 0)
- Test quality score (target: > 0.8)

**Quality Gates**:
- Gate pass rate (target: 100%)
- Blocker issues (target: 0)
- Security vulnerabilities (target: 0)
- Performance budget violations (target: 0)

**Subagent Performance**:
- Invocation count per type
- Success rate per subagent
- Average duration per subagent
- Retry rate

### Logging

```typescript
// Structured logging for test runs
logger.info("test_run_started", {
  testType: "unit",
  pattern: "*.test.ts",
  coverage: true,
  timestamp: Date.now()
});

logger.info("test_run_completed", {
  passed: 42,
  failed: 0,
  duration: 15234,
  coverage: { lines: 87.5, branches: 82.3 },
  timestamp: Date.now()
});
```

## Related Documents

### Architecture
- [Global Context Network](./architecture-global-context-network-2025-01-16.md)
- [Subagent System](./architecture-subagent-system-2025-01-16.md)

### Guides
- [TDD Workflow](../guides/guide-tdd-workflow-2025-01-16.md)
- [Testing Harness Usage](../guides/guide-testing-harness-usage-2025-01-16.md)

### Reference
- [Testing Strategy](../reference/reference-testing-strategy-2025-01-16.md)
- [Claude Agent SDK API](../reference/reference-claude-agent-sdk-api-2025-01-16.md)
