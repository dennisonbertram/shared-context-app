# Subagent Workflow - How Subagents Work Together

> Detailed workflow for using specialized subagents to implement the Global Context Network

---
title: Subagent-Driven Development Workflow
category: plan
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [subagents, workflow, tdd, development-process]
---

## Overview

This document describes how specialized subagents collaborate to implement features using Test-Driven Development (TDD) and automated quality gates.

**Core Principle**: Never implement directly - always delegate to specialized subagents.

## Subagent Roles

### Implementation Subagents
Build features and components following TDD
- Read requirements from plans
- Write tests first (Red phase)
- Implement minimal code (Green phase)
- Refactor for quality (Refactor phase)

### Test Generation Subagents
Create comprehensive test suites
- Generate unit tests (70% coverage target)
- Generate integration tests (20% coverage target)
- Generate E2E tests (10% coverage target)
- Validate test quality

### Validation Subagents
Enforce quality gates
- Test quality validator
- Coverage validator
- Implementation validator
- Code quality validator
- Security validator
- Performance validator

## TDD Workflow with Subagents

### Step 1: Test Generation (RED Phase)

**Subagent**: `unit-test-generator`

**Inputs**:
- Feature requirements
- Interface/API design
- Edge cases to cover

**Outputs**:
- Failing test suite
- Test quality score

**Process**:
```typescript
// Main orchestrator delegates to test generator
const testResult = await runSubagent("unit-test-generator", {
  feature: "Event sanitization",
  requirements: phaseRequirements,
  coverage: "edges, errors, boundaries"
});

// Validate test quality
const qualityCheck = await runSubagent("test-quality-validator", {
  tests: testResult.tests
});

// Require quality score ≥ 0.8
if (qualityCheck.score < 0.8) {
  throw new Error("Test quality insufficient");
}

// Run tests - confirm they FAIL
const testRun = await runTests(testResult.tests);
if (!testRun.allFailed) {
  throw new Error("Tests should fail before implementation");
}
```

### Step 2: Implementation (GREEN Phase)

**Subagent**: `implementation-agent` (phase-specific)

**Inputs**:
- Failing tests
- Requirements
- Architecture guidelines

**Outputs**:
- Implementation code
- All tests passing

**Process**:
```typescript
// Main orchestrator delegates to implementation agent
const implResult = await runSubagent("hook-developer-agent", {
  tests: testResult.tests,
  requirements: phaseRequirements,
  constraints: "< 100ms execution time"
});

// Run tests - confirm they PASS
const testRun = await runTests(testResult.tests);
if (!testRun.allPassed) {
  throw new Error("Implementation must pass all tests");
}

// Validate implementation
const implCheck = await runSubagent("implementation-validator", {
  code: implResult.code,
  tests: testResult.tests
});
```

### Step 3: Refactor (REFACTOR Phase)

**Subagent**: `refactor-agent`

**Inputs**:
- Working implementation
- Passing tests
- Code quality standards

**Outputs**:
- Refactored code
- Still passing tests
- Improved quality scores

**Process**:
```typescript
// Main orchestrator delegates to refactor agent
const refactorResult = await runSubagent("refactor-agent", {
  code: implResult.code,
  tests: testResult.tests,
  focus: "DRY, clear naming, SOLID principles"
});

// Run tests - confirm still PASS
const testRun = await runTests(testResult.tests);
if (!testRun.allPassed) {
  throw new Error("Refactoring broke tests");
}
```

### Step 4: Quality Gates (VALIDATION Phase)

**Subagents**: Multiple validators in parallel

**Process**:
```typescript
// Run all validators in parallel
const [coverageCheck, codeQualityCheck, securityCheck, perfCheck] = await Promise.all([
  runSubagent("coverage-validator", { tests: testResult.tests }),
  runSubagent("code-quality-validator", { code: refactorResult.code }),
  runSubagent("security-validator", { code: refactorResult.code }),
  runSubagent("performance-validator", { code: refactorResult.code })
]);

// All gates must pass
const allGatesPassed =
  coverageCheck.coverage >= 0.85 &&
  codeQualityCheck.passed &&
  securityCheck.issues.length === 0 &&
  perfCheck.acceptable;

if (!allGatesPassed) {
  throw new Error("Quality gates failed");
}
```

## Phase-Specific Workflows

### Phase 0: Foundation

**Subagents**:
- `foundation-setup-agent`: TypeScript + Vitest setup
- `database-schema-agent`: Schema design
- `test-infrastructure-agent`: Test utilities

**Workflow**:
1. Foundation agent sets up project
2. Database agent creates schema
3. Test infrastructure agent creates helpers
4. All work in parallel (independent)

**Coordination**:
```typescript
// Parallel execution
const [foundation, database, testInfra] = await Promise.all([
  runSubagent("foundation-setup-agent", {...}),
  runSubagent("database-schema-agent", {...}),
  runSubagent("test-infrastructure-agent", {...})
]);
```

### Phase 1: Event Capture

**Subagents**:
- `hook-developer-agent`: Hook implementations
- `event-collector-agent`: Event aggregation
- `queue-system-agent`: Persistent queue

**Workflow**:
1. Test generator creates hook tests
2. Hook developer implements hooks
3. Event collector aggregates events
4. Queue system persists events
5. Integration testing validates flow

**Coordination**:
```typescript
// Sequential with dependencies
const hookTests = await runSubagent("unit-test-generator", { feature: "hooks" });
const hooks = await runSubagent("hook-developer-agent", { tests: hookTests });

// Event collector needs hooks
const collectorTests = await runSubagent("unit-test-generator", { feature: "event-collector" });
const collector = await runSubagent("event-collector-agent", {
  tests: collectorTests,
  hooks: hooks
});

// Queue system needs collector schema
const queueTests = await runSubagent("unit-test-generator", { feature: "queue" });
const queue = await runSubagent("queue-system-agent", {
  tests: queueTests,
  schema: collector.eventSchema
});
```

### Phase 2: Sanitization

**Subagents**:
- `rule-sanitizer-agent`: Regex patterns
- `ai-sanitizer-agent`: LLM sanitization
- `sanitization-pipeline-agent`: Orchestration

**Workflow**:
1. Build gold dataset first
2. Rule sanitizer in parallel with AI sanitizer
3. Pipeline orchestrator combines both
4. Validation with precision/recall metrics

**Coordination**:
```typescript
// Create gold dataset first
const goldDataset = await runSubagent("dataset-builder-agent", {
  categories: ["email", "phone", "ip", "path", "key", "url"],
  size: 1000
});

// Parallel sanitizer development
const [ruleTests, aiTests] = await Promise.all([
  runSubagent("unit-test-generator", { feature: "rule-sanitizer", dataset: goldDataset }),
  runSubagent("unit-test-generator", { feature: "ai-sanitizer", dataset: goldDataset })
]);

const [ruleSanitizer, aiSanitizer] = await Promise.all([
  runSubagent("rule-sanitizer-agent", { tests: ruleTests, dataset: goldDataset }),
  runSubagent("ai-sanitizer-agent", { tests: aiTests, dataset: goldDataset })
]);

// Pipeline combines both
const pipelineTests = await runSubagent("integration-test-generator", { feature: "sanitization-pipeline" });
const pipeline = await runSubagent("sanitization-pipeline-agent", {
  tests: pipelineTests,
  ruleSanitizer,
  aiSanitizer,
  dataset: goldDataset
});
```

## Quality Gate Details

### Coverage Gate

**Validator**: `coverage-validator`

**Requirements**:
- Line coverage ≥ 85%
- Statement coverage ≥ 85%
- Function coverage ≥ 85%
- Branch coverage ≥ 80%

**Process**:
```bash
vitest run --coverage
```

**Gate**:
```typescript
if (coverage.lines < 0.85 || coverage.statements < 0.85 ||
    coverage.functions < 0.85 || coverage.branches < 0.80) {
  throw new Error(`Coverage insufficient: ${JSON.stringify(coverage)}`);
}
```

### Code Quality Gate

**Validator**: `code-quality-validator`

**Requirements**:
- ESLint clean
- Prettier formatted
- TypeScript strict mode compliant
- No `any` types
- Clear naming conventions

**Process**:
```bash
npm run lint
npm run type-check
```

**Gate**: All checks must pass

### Security Gate

**Validator**: `security-validator`

**Requirements**:
- No SQL injection vectors
- No command injection
- No path traversal
- No hardcoded secrets
- No insecure dependencies

**Process**:
```bash
npm audit
grep -r "apiKey.*=" src/  # Example check
```

**Gate**: Zero critical issues

### Performance Gate

**Validator**: `performance-validator`

**Requirements**:
- Hooks < 100ms (p95)
- DB queries < 100ms
- MCP queries < 200ms
- Sanitization < 2s per conversation

**Process**: Benchmark tests with realistic data

**Gate**: All SLOs met

## Error Handling in Workflows

### Subagent Failure

**Strategy**: Retry with exponential backoff

```typescript
async function runWithRetry(agentName: string, input: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await runSubagent(agentName, input);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(2 ** i * 1000);
    }
  }
}
```

### Quality Gate Failure

**Strategy**: Block and report

```typescript
if (!qualityGatePassed) {
  // Log detailed failure reasons
  console.error("Quality gate failed:", {
    coverage: coverageCheck,
    codeQuality: codeQualityCheck,
    security: securityCheck,
    performance: perfCheck
  });

  // Block merge/commit
  throw new Error("Quality gates must pass before proceeding");
}
```

### Test Flakiness

**Strategy**: Deterministic tests only

- Pin LLM model/version
- Use temperature=0 for AI calls
- Snapshot test outputs
- Avoid time-dependent assertions
- Mock external dependencies

## Monitoring Subagent Performance

### Metrics to Track

- Subagent invocation count
- Success rate per subagent
- Average execution time
- Error types and frequency
- Quality gate pass rate

### Dashboard (Future)

```typescript
{
  "unit-test-generator": {
    "invocations": 150,
    "successRate": 0.98,
    "avgDuration": "45s",
    "qualityScore": 0.87
  },
  "hook-developer-agent": {
    "invocations": 12,
    "successRate": 1.0,
    "avgDuration": "3m 20s",
    "testsPass": true
  }
}
```

## Related Documents

- [Subagent System Architecture](../architecture/architecture-subagent-system-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
- [TDD Workflow Guide](../guides/guide-tdd-workflow-2025-01-16.md)
- [Using Subagents Guide](../guides/guide-using-subagents-2025-01-16.md)
