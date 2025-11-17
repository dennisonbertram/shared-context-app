# Subagent System Architecture

> Architecture for subagent-driven development using Claude Agent SDK

---
title: Subagent System Architecture
category: architecture
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [subagents, claude-agent-sdk, development-workflow, parallelization]
---

## Overview

The Global Context Network uses a **subagent-driven development model** where ALL implementation and testing is delegated to specialized Claude agents. This ensures focused expertise, parallel execution, and built-in quality validation.

**Core Principle**: Never implement directly - always delegate to specialized subagents.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Main Orchestrator Agent                        │
│                  (Claude Code Main Session)                       │
└────────────┬───────────────────────────────┬─────────────────────┘
             │                                │
             ▼ Delegation                    ▼ Delegation
┌────────────────────────┐      ┌────────────────────────┐
│ Implementation Subagent│      │    Test Subagent       │
│  - Reads requirements  │      │  - Generates tests     │
│  - Writes code         │      │  - Validates quality   │
│  - Runs locally        │      │  - Checks coverage     │
└────────────┬───────────┘      └────────────┬───────────┘
             │                                │
             │                                │
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────┐
│  Quality Gate Subagent │◄─────┤ Integration Subagent   │
│  - Lint + Type Check   │      │  - Component testing   │
│  - Security scan       │      │  - E2E validation      │
│  - Performance review  │      │  - Regression check    │
└────────────────────────┘      └────────────────────────┘
```

## Subagent Types

### 1. Implementation Subagents

**Purpose**: Build features and components

**Specialized By Phase**:

| Phase | Subagent | Responsibility | Tools |
|-------|----------|----------------|-------|
| 0 | `foundation-setup-agent` | TypeScript + Vitest setup | Write, Bash, Read |
| 0 | `database-schema-agent` | Schema + migrations | Write, Bash |
| 0 | `test-infrastructure-agent` | Test utilities | Write, Read |
| 1 | `hook-developer-agent` | Hook scripts | Write, Bash, Read |
| 1 | `event-collector-agent` | Event aggregation | Write, Read |
| 1 | `queue-system-agent` | Persistent queue | Write, Bash |
| 2 | `rule-sanitizer-agent` | Regex PII detection | Write, Read |
| 2 | `ai-sanitizer-agent` | LLM sanitization | Write, Read |
| 2 | `sanitization-pipeline-agent` | Pipeline orchestration | Write, Read |
| 3 | `repository-agent` | Repository pattern | Write, Read |
| 3 | `query-optimization-agent` | Indexes + queries | Write, Bash |
| 4 | `job-queue-agent` | Queue implementation | Write, Read |
| 4 | `worker-agent` | Worker processes | Write, Bash |
| 5 | `learning-extractor-agent` | Extraction pipeline | Write, Read |
| 5 | `quality-filter-agent` | Scoring + filtering | Write, Read |
| 6 | `mcp-protocol-agent` | MCP implementation | Write, Read |
| 6 | `query-optimization-agent` | Search + filtering | Write, Bash |
| 7 | `ipfs-integration-agent` | IPFS uploads | Write, Bash |
| 7 | `blockchain-agent` | Blockchain transactions | Write, Bash |

**Configuration Example**:
```typescript
{
  "hook-developer-agent": {
    description: "Implements Claude Code hooks for event capture",
    prompt: `You are a Claude Code hooks expert. Implement:
    - UserPromptSubmit hook (< 100ms)
    - Stop hook (< 100ms)
    - Event serialization
    - Error handling (never block user)
    Follow TDD: write tests first.`,
    tools: ["Write", "Read", "Bash", "mcp__test-runner__run_unit_tests"],
    model: "sonnet"
  }
}
```

### 2. Test Generation Subagents

**Purpose**: Create comprehensive test suites

**Types**:

**Unit Test Generator**:
```typescript
{
  "unit-test-generator": {
    description: "Generates unit tests with 100% coverage target",
    prompt: `Generate unit tests following TDD:
    - Test each function in isolation
    - Cover edge cases and boundaries
    - Test error conditions
    - Use proper arrange-act-assert
    - Mock external dependencies
    Target: > 85% coverage`,
    tools: ["Write", "Read", "mcp__test-runner__validate_test_quality"],
    model: "sonnet"
  }
}
```

**Integration Test Generator**:
```typescript
{
  "integration-test-generator": {
    description: "Creates integration tests for component interactions",
    prompt: `Generate integration tests:
    - Test component interactions
    - Use real dependencies where safe
    - Test database transactions
    - Verify async behavior
    - Check error propagation`,
    tools: ["Write", "Read", "Bash", "mcp__test-runner__run_integration_tests"],
    model: "sonnet"
  }
}
```

**E2E Test Generator**:
```typescript
{
  "e2e-test-generator": {
    description: "Creates end-to-end workflow tests",
    prompt: `Generate E2E tests:
    - Test complete user workflows
    - Hook → Database → MCP flow
    - Sanitization → Learning → Upload flow
    - Verify system behavior
    - Test failure scenarios`,
    tools: ["Write", "Read", "Bash", "mcp__test-runner__run_e2e_tests"],
    model: "sonnet"
  }
}
```

### 3. Test Validation Subagents

**Purpose**: Validate test quality and implementation

**Test Quality Validator**:
```typescript
{
  "test-quality-validator": {
    description: "Reviews test code quality and completeness",
    prompt: `Validate tests for:
    - Proper structure (describe, it, expect)
    - Clear test names
    - Complete edge case coverage
    - Proper assertions (not just truthy)
    - No flaky tests
    - Maintainability
    Score each test 0-1. Require > 0.8 to pass.`,
    tools: ["Read", "Grep", "mcp__test-runner__validate_test_quality"],
    model: "sonnet"
  }
}
```

**Coverage Validator**:
```typescript
{
  "coverage-validator": {
    description: "Ensures adequate test coverage",
    prompt: `Analyze coverage:
    - Lines, statements, functions, branches
    - Identify uncovered code paths
    - Flag critical missing tests
    - Require > 85% coverage
    - No untested error handlers`,
    tools: ["Read", "Bash", "mcp__test-runner__get_coverage_report"],
    model: "haiku"
  }
}
```

**Implementation Validator**:
```typescript
{
  "implementation-validator": {
    description: "Validates implementation against tests",
    prompt: `Verify implementation:
    - All tests pass
    - Handles all edge cases from tests
    - Proper error handling
    - No security vulnerabilities
    - Follows coding standards
    - Performance acceptable`,
    tools: ["Read", "Grep", "Bash", "mcp__test-runner__run_unit_tests"],
    model: "sonnet"
  }
}
```

### 4. Quality Gate Subagents

**Purpose**: Enforce standards before merge

**Code Quality Validator**:
```typescript
{
  "code-quality-validator": {
    description: "Reviews code quality and standards",
    prompt: `Review code for:
    - TypeScript strict mode compliance
    - ESLint rule adherence
    - Prettier formatting
    - Proper type annotations
    - Clear naming conventions
    - DRY principles
    - SOLID principles
    All checks must pass.`,
    tools: ["Read", "Bash", "Grep"],
    model: "sonnet"
  }
}
```

**Security Validator**:
```typescript
{
  "security-validator": {
    description: "Scans for security vulnerabilities",
    prompt: `Security audit:
    - SQL injection vulnerabilities
    - Command injection risks
    - Path traversal attempts
    - Hardcoded secrets
    - Insecure dependencies
    - XSS vectors
    Block if any critical issues found.`,
    tools: ["Read", "Bash", "Grep"],
    model: "sonnet"
  }
}
```

**Performance Validator**:
```typescript
{
  "performance-validator": {
    description: "Analyzes performance characteristics",
    prompt: `Analyze performance:
    - Algorithm complexity
    - Database query efficiency
    - Memory usage patterns
    - Blocking operations
    - Resource leaks
    Flag performance regressions.`,
    tools: ["Read", "Bash", "Grep"],
    model: "sonnet"
  }
}
```

## Subagent Workflow

### TDD Cycle with Subagents

```
1. 🔴 RED Phase (Test Generator Subagent)
   ├─► Generate failing test
   ├─► Validate test quality (Test Quality Validator)
   └─► Ensure test properly fails

2. 🟢 GREEN Phase (Implementation Subagent)
   ├─► Write minimal code to pass test
   ├─► Run tests continuously
   └─► Validate implementation (Implementation Validator)

3. 🔵 REFACTOR Phase (Refactor Subagent)
   ├─► Improve code quality
   ├─► Maintain passing tests
   └─► Re-validate quality (Code Quality Validator)

4. ✅ QUALITY GATE (Quality Gate Subagents)
   ├─► Run all validators in parallel
   ├─► Coverage > 85%
   ├─► Security scan passes
   ├─► Performance acceptable
   └─► All gates MUST pass
```

### Parallel Execution

Subagents can run in parallel when independent:

```typescript
// Phase 0 example: Parallel execution
const response = query({
  prompt: "Implement Phase 0 Foundation",
  options: {
    agents: {
      "foundation-setup": { ... },
      "database-schema": { ... },
      "test-infrastructure": { ... }
    }
  }
});

// All three agents work simultaneously
// Main agent coordinates and integrates results
```

### Sequential Dependencies

Some subagents must wait for others:

```
foundation-setup ─► database-schema ─► test-infrastructure
                    (needs project)    (needs database)
```

## Subagent Communication

### Via Main Agent

Subagents communicate through the main orchestrator:

```typescript
// Main agent delegates
const testGenResult = await runSubagent("unit-test-generator", {...});

// Main agent passes results to next subagent
const implResult = await runSubagent("implementation-agent", {
  tests: testGenResult.tests
});

// Main agent validates
const validationResult = await runSubagent("implementation-validator", {
  implementation: implResult.code,
  tests: testGenResult.tests
});
```

### Via Shared Context

Subagents can access shared resources:
- File system (read/write)
- Database (queries)
- Test results (via MCP tools)
- Coverage reports (via MCP tools)

## Benefits of Subagent Architecture

### 1. Specialization
Each subagent is expert in its domain:
- Hook developer knows hook best practices
- Test generator knows testing patterns
- Security validator knows OWASP top 10

### 2. Parallelization
Independent tasks run concurrently:
- Multiple components implemented simultaneously
- Tests generated while implementation proceeds
- Validators run in parallel for quality gates

### 3. Quality Assurance
Built-in validation at every step:
- Test quality validated before implementation
- Implementation validated against tests
- Quality gates enforce standards

### 4. Maintainability
Clear separation of concerns:
- Each subagent has focused responsibility
- Easy to update individual agents
- Consistent patterns across codebase

### 5. Auditability
Complete trace of decisions:
- Each subagent produces artifacts
- Validation results documented
- Quality scores tracked

## Configuration Management

### Subagent Definitions

Stored in configuration files:

```typescript
// subagents/implementation-agents.ts
export const implementationAgents = {
  "hook-developer-agent": { ... },
  "event-collector-agent": { ... },
  // ... more agents
};

// subagents/test-agents.ts
export const testAgents = {
  "unit-test-generator": { ... },
  "integration-test-generator": { ... },
  // ... more agents
};

// subagents/validation-agents.ts
export const validationAgents = {
  "test-quality-validator": { ... },
  "coverage-validator": { ... },
  // ... more agents
};
```

### Agent Orchestration

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { implementationAgents, testAgents, validationAgents } from './subagents';

export async function implementPhase(phaseNumber: number) {
  const response = query({
    prompt: `Implement Phase ${phaseNumber} following TDD`,
    options: {
      model: "claude-sonnet-4-5",
      agents: {
        ...implementationAgents,
        ...testAgents,
        ...validationAgents
      },
      mcpServers: {
        "test-runner": testRunnerServer
      }
    }
  });

  for await (const message of response) {
    // Process subagent communications
    if (message.type === 'system' && message.subtype === 'subagent_start') {
      console.log(`Starting: ${message.agent_name}`);
    }
    if (message.type === 'system' && message.subtype === 'subagent_end') {
      console.log(`Completed: ${message.agent_name}`);
    }
  }
}
```

## Error Handling

### Subagent Failures

**Retry Logic**:
```typescript
async function runWithRetry(subagentName: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await runSubagent(subagentName);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(2 ** i * 1000); // Exponential backoff
    }
  }
}
```

**Fallback Strategies**:
- If test generator fails → Manual test creation prompt
- If implementation fails → Simplify requirements
- If validator fails → Manual review required

### Quality Gate Failures

**Block and Report**:
```typescript
if (validationResult.coverageScore < 0.85) {
  throw new Error(`Coverage ${validationResult.coverageScore} < 0.85 required`);
}

if (validationResult.securityIssues.length > 0) {
  throw new Error(`Security issues: ${validationResult.securityIssues.join(', ')}`);
}
```

## Performance Optimization

### Selective Subagent Invocation

Don't invoke all subagents for every task:

```typescript
// Simple task: minimal validation
if (task.complexity === 'simple') {
  agents = ['implementation-agent', 'unit-test-generator'];
}

// Complex task: full validation
if (task.complexity === 'complex') {
  agents = [
    'implementation-agent',
    'unit-test-generator',
    'integration-test-generator',
    'test-quality-validator',
    'code-quality-validator',
    'security-validator'
  ];
}
```

### Caching Results

Cache subagent results to avoid re-runs:

```typescript
const cache = new Map<string, SubagentResult>();

async function getCachedSubagentResult(name: string, input: any) {
  const key = `${name}:${JSON.stringify(input)}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  const result = await runSubagent(name, input);
  cache.set(key, result);
  return result;
}
```

## Monitoring & Metrics

### Subagent Performance

Track subagent execution:
- Invocation count
- Success rate
- Average duration
- Error types

### Quality Metrics

Track validation results:
- Test coverage trends
- Quality gate pass rate
- Security issue count
- Performance regression count

## Related Documents

### Architecture
- [Global Context Network](./architecture-global-context-network-2025-01-16.md)
- [Testing Harness](./architecture-testing-harness-2025-01-16.md)

### Decisions
- [ADR: Subagent-Driven Development](../decisions/decision-subagent-driven-development-2025-01-16.md)

### Guides
- [Using Subagents](../guides/guide-using-subagents-2025-01-16.md)
- [TDD Workflow](../guides/guide-tdd-workflow-2025-01-16.md)

### Reference
- [Subagent Types](../reference/reference-subagent-types-2025-01-16.md)
- [Claude Agent SDK API](../reference/reference-claude-agent-sdk-api-2025-01-16.md)
