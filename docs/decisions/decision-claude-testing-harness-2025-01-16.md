---
title: ADR-003: Claude-Powered Testing Harness
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [testing, quality, claude-agent-sdk, tdd]
---

# ADR-003: Claude-Powered Testing Harness

## Status

Accepted

Date: 2025-01-16

## Context

The Global Context Network has critical quality requirements:

1. **Zero PII leaks** - Privacy is non-negotiable, must be proven
2. **Correctness of learnings** - Extracted insights must be accurate
3. **Reliability** - Async processing must be robust with retries
4. **Performance** - Hooks < 100ms, queries < 200ms
5. **Security** - No injection vulnerabilities or exposed secrets

Standard unit tests underrepresent these risks because:
- **Edge cases** - Hard to manually enumerate all PII patterns
- **Context-aware** - Need to test sanitization in realistic scenarios
- **End-to-end validation** - Component tests miss integration issues
- **Quality variance** - Manual test quality varies across developers
- **Coverage gaps** - Easy to miss critical paths

We need validation beyond code coverage - we need **risk coverage** including:
- Privacy violations (PII leakage)
- Security vulnerabilities
- Performance regressions
- Correctness of learned facts
- Async failure scenarios

## Decision

Use Claude Agent SDK for test generation, validation, and quality gates.

**Components**:
1. **Test Generator Subagents** - Generate comprehensive test suites
2. **Test Quality Validator** - Score test quality and completeness
3. **Coverage Analyzer** - Ensure > 85% code coverage
4. **Privacy Red Team** - Generate adversarial PII test cases
5. **Implementation Validator** - Verify code matches tests

**TDD Workflow**:
```
RED: Test generator creates failing test
  ↓
VALIDATE: Test quality validator scores test
  ↓
GREEN: Implementation subagent passes test
  ↓
VERIFY: Implementation validator checks correctness
  ↓
REFACTOR: Code quality validator ensures standards
```

**Quality Gates** (all must pass):
- Test coverage > 85%
- All tests pass
- PII leakage score = 0
- Security scan clean
- Performance SLOs met

## Consequences

### Positive

- **Comprehensive coverage** - AI finds edge cases humans miss
- **Privacy assurance** - Red team generates PII test cases
- **Automated quality scoring** - Objective test quality metrics
- **Edge case discovery** - AI explores boundary conditions
- **Self-validating system** - Tests validate themselves
- **Consistent quality** - Same standards across all components
- **Fast iteration** - Automated test generation accelerates TDD

### Negative

- **API costs** - Claude API usage for test generation
- **Non-determinism** - Generated tests may vary between runs
- **Prompt dependency** - Test quality depends on prompt engineering
- **Maintenance** - Must maintain test generator prompts
- **Learning curve** - Team must understand AI-powered testing
- **Debugging** - Harder to debug generated test failures

### Neutral

- **Requires Claude API** - Adds external dependency
- **Token budget needed** - Must allocate costs for CI
- **Test data governance** - Ensure generated tests don't contain PII
- **Flaky test handling** - Need quarantine for non-deterministic tests

## Alternatives Considered

### Alternative 1: Manual Test Writing Only

**Description**: Developers write all tests manually following TDD.

**Pros**:
- Full control over test logic
- Deterministic results
- No API dependency
- Standard industry practice
- Easier debugging

**Cons**:
- Slow (bottleneck on human creativity)
- Inconsistent quality across developers
- Misses edge cases
- No automated quality validation
- High maintenance burden

**Why not chosen**: Too slow for aggressive MVP timeline, lacks comprehensive edge case coverage.

### Alternative 2: Property-Based Testing (Hypothesis/FastCheck)

**Description**: Use property-based testing frameworks for structured components.

**Pros**:
- Excellent for finding edge cases
- Deterministic with seeds
- No API costs
- Good for pure functions
- Shrinking finds minimal failing examples

**Cons**:
- Requires defining properties (still manual)
- Not suitable for all components
- Doesn't validate test quality
- No privacy-specific red team
- Learning curve for team

**Why not chosen**: Complementary approach, should be used alongside Claude harness. Will incorporate for structured components.

### Alternative 3: Mutation Testing (Stryker, PIT)

**Description**: Measure test suite sensitivity by mutating code.

**Pros**:
- Validates test effectiveness
- Finds weak tests
- Deterministic results
- No external dependency

**Cons**:
- Slow (must re-run tests for each mutation)
- Doesn't generate tests
- Doesn't understand domain (privacy, security)
- High computational cost

**Why not chosen**: Useful for validation but doesn't generate tests. Can add as quality check later.

### Alternative 4: Golden File / Record-Replay Testing

**Description**: Record inputs/outputs, replay for regression testing.

**Pros**:
- Deterministic
- Catches regressions
- Fast execution
- Easy to maintain

**Cons**:
- Doesn't generate new tests
- Brittle to intentional changes
- No edge case discovery
- Not suitable for privacy testing

**Why not chosen**: Useful for integration tests but doesn't solve test generation problem.

### Alternative 5: Static Analysis and Linters Only

**Description**: Rely on ESLint, TypeScript, security scanners.

**Pros**:
- Fast feedback
- Deterministic
- No API costs
- Catches common issues
- Standard tooling

**Cons**:
- No runtime behavior testing
- Can't verify correctness
- Misses logic bugs
- No PII detection testing
- Limited to structural issues

**Why not chosen**: Necessary but insufficient. Will use alongside testing harness.

## Implementation

### Test Generator Configuration

```typescript
interface TestGeneratorConfig {
  component: string;
  testType: "unit" | "integration" | "e2e";
  coverageTarget: number; // 0.0 - 1.0
  edgeCaseFocus: string[]; // ["pii", "performance", "errors"]
  model: "sonnet" | "opus";
  temperature: number;
}

const unitTestGenerator = {
  component: "sanitization-pipeline",
  testType: "unit",
  coverageTarget: 0.95, // Critical component
  edgeCaseFocus: ["pii", "errors", "boundaries"],
  model: "sonnet",
  temperature: 0.3
};
```

### Privacy Red Team Generator

Generate adversarial PII test cases:

```typescript
const piiRedTeamPrompt = `Generate PII edge cases for sanitization testing.

Include:
- Obfuscated emails (user[at]domain[dot]com)
- International phone formats
- API keys with unusual formats
- Names in code (variable names vs person names)
- Paths with usernames in unexpected places
- Combined PII (email + phone in same string)
- Unicode/emoji in PII
- Base64-encoded secrets
- Uncommon PII patterns

Generate 50 unique test cases.
Each must be realistic and challenging.`;
```

### Test Quality Scoring

```typescript
interface TestQualityScore {
  structure: number; // 0-1: proper describe/it/expect
  clarity: number; // 0-1: clear test names
  assertions: number; // 0-1: meaningful assertions
  edgeCases: number; // 0-1: boundary conditions covered
  isolation: number; // 0-1: proper mocking/independence
  maintainability: number; // 0-1: clear and DRY
  overall: number; // weighted average
}

// Require overall > 0.8 to pass
```

### Determinism for CI

```typescript
// For CI runs: low temperature, fixed seed
const ciTestConfig = {
  temperature: 0.1,
  seed: "ci-run-20250116",
  maxRetries: 1, // Don't retry in CI
  timeout: 300000 // 5min max
};

// For exploration: higher temperature
const exploreConfig = {
  temperature: 0.7,
  seed: null, // Random
  maxRetries: 3
};
```

### Cost Budgets

```typescript
interface TestingBudget {
  maxTokensPerComponent: number;
  maxTokensPerCIRun: number;
  smokeTestTokens: number; // Quick validation
  fullTestTokens: number; // Nightly comprehensive
}

const budget = {
  maxTokensPerComponent: 20000,
  maxTokensPerCIRun: 100000, // Cap CI costs
  smokeTestTokens: 10000, // PR validation
  fullTestTokens: 500000 // Nightly deep testing
};
```

### Test Data Governance

Ensure generated tests don't contain real PII:

```typescript
async function validateGeneratedTests(tests: string[]): Promise<boolean> {
  // Scan generated test code for PII
  const detector = new PIIDetector();

  for (const test of tests) {
    const findings = await detector.scan(test);
    if (findings.length > 0) {
      throw new Error(`Generated test contains PII: ${findings}`);
    }
  }

  return true;
}
```

### Smoke vs Exhaustive Suites

```typescript
// Smoke tests: Fast, run on every PR
const smokeTests = {
  coverage: 0.70, // Lower bar
  timeout: 60000, // 1min
  tokenBudget: 10000,
  tests: ["happy-path", "basic-errors"]
};

// Exhaustive tests: Comprehensive, run nightly
const exhaustiveTests = {
  coverage: 0.95, // High bar
  timeout: 600000, // 10min
  tokenBudget: 500000,
  tests: ["all-edge-cases", "red-team", "property-based"]
};
```

### Flaky Test Quarantine

```typescript
interface FlakyTestHandler {
  maxFailureRate: number; // 0.05 = 5%
  minRuns: number; // Need 20 runs to determine flakiness
  quarantineDuration: number; // 7 days

  async handleFlaky(test: Test): Promise<void> {
    // Move to quarantine
    await moveToQuarantine(test);

    // Create issue for investigation
    await createIssue({
      title: `Flaky test: ${test.name}`,
      labels: ["flaky-test", "needs-investigation"]
    });

    // Notify team
    await notify(`Test ${test.name} quarantined due to flakiness`);
  }
}
```

### Integration with Property-Based Testing

```typescript
// Combine Claude generation with property-based testing
const hybridTests = {
  // Claude generates properties to test
  generateProperties: async (component: string) => {
    const properties = await claudeGenerateProperties(component);
    return properties;
  },

  // FastCheck validates properties
  validateWithFastCheck: (properties: Property[]) => {
    for (const prop of properties) {
      fc.assert(fc.property(prop.generators, prop.predicate));
    }
  }
};
```

### Coverage Validation

```typescript
interface CoverageRequirements {
  lines: number; // 0.85
  statements: number; // 0.85
  functions: number; // 0.90
  branches: number; // 0.80

  // Special requirements for critical paths
  criticalPaths: {
    [path: string]: number; // 1.0 for sanitization
  };
}

const requirements = {
  lines: 0.85,
  statements: 0.85,
  functions: 0.90,
  branches: 0.80,
  criticalPaths: {
    "src/sanitization/": 0.95, // High bar for privacy
    "src/hooks/": 0.90 // High bar for performance
  }
};
```

## Risks and Mitigations

### Risk: Non-Determinism Breaks CI

**Impact**: High - Unreliable builds

**Mitigation**:
- Low temperature (0.1) for CI
- Fixed seeds for reproducibility
- Retry same seed on failure
- Quarantine flaky tests
- Smoke tests with deterministic config

### Risk: API Cost Overruns

**Impact**: Medium - Budget concerns

**Mitigation**:
- Hard token limits per component
- Use Haiku for simple tests
- Cache test generation results
- Progressive test generation (smoke → full)
- Alert at 80% of budget

### Risk: Generated Tests Contain PII

**Impact**: High - Privacy violation

**Mitigation**:
- Scan generated tests for PII
- Use synthetic data only
- Review generated tests before commit
- Automated PII detection on test code

### Risk: Test Quality Variance

**Impact**: Medium - Unreliable validation

**Mitigation**:
- Quality scoring (require > 0.8)
- Human review for critical components
- Version and track prompts
- Continuous prompt improvement

## Related Documents

### Architecture
- [Testing Harness Architecture](../architecture/architecture-testing-harness-2025-01-16.md)
- [Subagent System](../architecture/architecture-subagent-system-2025-01-16.md)

### Decisions
- [ADR-002: Subagent-Driven Development](./decision-subagent-driven-development-2025-01-16.md)
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md)

### Guides
- [TDD Workflow Guide](../guides/guide-tdd-workflow-2025-01-16.md)
- [Testing Harness Usage](../guides/guide-testing-harness-usage-2025-01-16.md)

### Reference
- [Testing Strategy Reference](../reference/reference-testing-strategy-2025-01-16.md)
