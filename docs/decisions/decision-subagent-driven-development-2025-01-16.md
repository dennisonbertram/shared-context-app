---
title: ADR-002: Subagent-Driven Development
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [subagents, claude-agent-sdk, development-workflow, architecture]
---

# ADR-002: Subagent-Driven Development

## Status

Accepted

Date: 2025-01-16

## Context

The Global Context Network is a complex system with multiple specialized components:
- Event capture with strict latency constraints
- Privacy-critical sanitization pipeline
- Async job processing with reliability guarantees
- Learning extraction requiring domain expertise
- MCP server implementation
- Blockchain/IPFS integration

Each component requires:
- **Specialized expertise** in its domain
- **Comprehensive testing** with high coverage
- **Quality validation** at every step
- **Consistent implementation** across components
- **Parallel development** where possible

Traditional development approaches struggle with:
1. **Context limits** - Single agent can't hold all system knowledge
2. **Specialization** - One agent can't be expert in all domains
3. **Quality variance** - No built-in validation of implementation quality
4. **Sequential bottlenecks** - Can't parallelize independent tasks
5. **Test generation gaps** - Manual test writing is slow and incomplete

The system naturally decomposes into a DAG of asynchronous enrichment tasks (capture → sanitize → store → extract → publish) where independent agents map well to pipeline stages.

## Decision

Use specialized subagents (via Claude Agent SDK) for ALL implementation and testing.

**Core Principle**: Never implement directly - always delegate to specialized subagents.

**Subagent Types**:
1. **Implementation subagents** - Build features (hooks, sanitization, MCP, etc.)
2. **Test generation subagents** - Create comprehensive test suites
3. **Test validation subagents** - Validate test quality and coverage
4. **Quality gate subagents** - Enforce code standards and security
5. **Integration subagents** - Verify component interactions

**Orchestration**:
- Main agent coordinates subagent execution
- DAG orchestration with explicit inputs/outputs
- Idempotency contracts per subagent
- Parallel execution of independent subagents
- Sequential execution for dependencies

## Consequences

### Positive

- **Parallel execution** - Independent components built simultaneously
- **Specialized expertise** - Each subagent expert in its domain
- **Built-in validation** - Quality gates at every step
- **Comprehensive testing** - Automated test generation and validation
- **Consistent patterns** - Same approach across all components
- **Clear separation** - Focused responsibility per subagent
- **Auditability** - Complete trace of decisions and artifacts
- **Maintainability** - Easy to update individual subagents

### Negative

- **Orchestration complexity** - Managing subagent dependencies and DAG
- **Vendor dependency** - Requires Claude Agent SDK and API access
- **Cost** - API token usage for subagent-to-subagent communication
- **Non-determinism** - LLM outputs can vary between runs
- **Debugging complexity** - Harder to trace issues across subagents
- **Learning curve** - Team must understand subagent orchestration

### Neutral

- **Requires Claude Agent SDK** - Adds dependency on SDK
- **Prompt engineering** - Quality depends on subagent prompt design
- **Artifact storage** - Need to store subagent outputs and prompts
- **Versioning** - Must version subagent configurations

## Alternatives Considered

### Alternative 1: Human-Written Code with Automated Checks

**Description**: Developers write code manually, CI runs automated linting/tests.

**Pros**:
- Full control over implementation
- No LLM dependency
- Deterministic results
- Standard industry practice

**Cons**:
- Slower development (no parallel execution)
- Inconsistent quality across developers
- Manual test writing is time-consuming
- No automated test quality validation
- Harder to maintain consistency across components

**Why not chosen**: Too slow for MVP timeline, lacks automated test generation, no built-in quality validation.

### Alternative 2: Monolithic Agent (Single Large Prompt)

**Description**: One agent with a large prompt containing all system knowledge.

**Pros**:
- Simpler orchestration
- No coordination overhead
- Single context window

**Cons**:
- Context limits (can't hold entire system)
- No specialization
- Can't parallelize
- Lower quality (jack-of-all-trades)
- Loses focus across components

**Why not chosen**: Doesn't scale, can't parallelize, quality suffers from lack of specialization.

### Alternative 3: Orchestrator Frameworks (Temporal, Prefect, Dagster)

**Description**: Use workflow orchestration framework for task DAG.

**Pros**:
- Battle-tested orchestration
- Built-in retry and error handling
- Good observability
- Scales to production

**Cons**:
- Still need to write task code manually
- Doesn't provide specialized expertise
- No automated test generation
- Operational overhead (deploy orchestrator)
- Overkill for MVP

**Why not chosen**: Solves orchestration but not the core problem (specialized implementation and test generation). Could be adopted post-MVP.

### Alternative 4: Non-Claude Agent Ecosystems (LangChain, LlamaIndex, OpenAI Assistants)

**Description**: Use alternative agent frameworks.

**Pros**:
- Reduces vendor lock-in
- More ecosystem options
- Potentially lower cost

**Cons**:
- Less integrated with Claude Code
- Different quality characteristics
- Need to learn new frameworks
- May lack specialization features
- Migration cost if switching

**Why not chosen**: Claude Agent SDK integrates best with Claude Code, proven quality. Can evaluate alternatives post-MVP.

### Alternative 5: Reduced Surface (Few Composable Tools)

**Description**: One orchestrator agent with a few composable tools instead of many subagents.

**Pros**:
- Simpler architecture
- Easier to reason about
- Lower cost

**Cons**:
- Less specialization
- Can't parallelize as effectively
- Lower quality per component
- Manual test generation still needed

**Why not chosen**: Doesn't leverage specialization benefits, sacrifices quality for simplicity.

## Implementation

### DAG Orchestration

```typescript
interface SubagentConfig {
  name: string;
  description: string;
  prompt: string;
  tools: string[];
  model: "sonnet" | "opus" | "haiku";
  temperature: number; // Near-deterministic for CI
  inputs: string[]; // Required input artifacts
  outputs: string[]; // Produced artifacts
  idempotencyKey: (inputs: any) => string;
}

interface SubagentResult {
  success: boolean;
  artifacts: Record<string, any>;
  metrics: {
    latency: number;
    tokenSpend: number;
    retries: number;
  };
}
```

### Subagent Execution

```typescript
async function executeSubagent(
  config: SubagentConfig,
  inputs: any
): Promise<SubagentResult> {
  // Check idempotency
  const key = config.idempotencyKey(inputs);
  if (cache.has(key)) {
    return cache.get(key);
  }

  // Execute with SDK
  const result = await query({
    prompt: config.prompt,
    options: {
      model: config.model,
      temperature: config.temperature,
      agents: { [config.name]: config }
    }
  });

  // Track metrics
  const metrics = {
    latency: Date.now() - start,
    tokenSpend: result.tokenUsage,
    retries: retryCount
  };

  // Cache result
  cache.set(key, { success: true, artifacts: result, metrics });

  return { success: true, artifacts: result, metrics };
}
```

### Prompt Template Versioning

Store prompts with version control:

```typescript
// subagents/v1/hook-developer.ts
export const hookDeveloperPrompt = {
  version: "1.0",
  template: `You are a Claude Code hooks expert.

  Implement:
  - UserPromptSubmit hook (< 100ms)
  - Stop hook (< 100ms)
  - Event serialization
  - Error handling (never block user)

  Follow TDD: write tests first.

  Inputs: {{requirements}}

  Success criteria:
  - All tests pass
  - Hook latency < 100ms p95
  - No user blocking
  - Proper error handling`,
  temperature: 0.3 // Near-deterministic
};
```

### Cost and SLO Budgets

Per-subagent budget tracking:

```typescript
interface SubagentBudget {
  maxTokensPerRun: number;
  maxLatencyMs: number;
  maxRetries: number;
  alertThreshold: number; // % of budget
}

const budgets: Record<string, SubagentBudget> = {
  "hook-developer": {
    maxTokensPerRun: 10000,
    maxLatencyMs: 30000,
    maxRetries: 3,
    alertThreshold: 0.8
  }
};
```

### Guardrails and Acceptance Criteria

Define quality thresholds per subagent:

```typescript
interface SubagentAcceptanceCriteria {
  minTestCoverage: number;
  maxPIILeakageScore: number;
  maxSecurityIssues: number;
  requiredChecks: string[];
}

const criteria = {
  "sanitization-pipeline": {
    minTestCoverage: 0.95, // Critical component
    maxPIILeakageScore: 0.0, // Zero tolerance
    maxSecurityIssues: 0,
    requiredChecks: ["pii-detection", "redaction-audit"]
  }
};
```

### Observability Per Subagent

Track metrics for each subagent:

```typescript
interface SubagentMetrics {
  invocationCount: number;
  successRate: number;
  averageLatency: number;
  p95Latency: number;
  totalTokenSpend: number;
  errorRate: number;
  retryRate: number;
}
```

### Determinism and Reproducibility

For CI and debugging:

1. **Set low temperature** (0.1-0.3) for near-deterministic outputs
2. **Use fixed seeds** when possible
3. **Mock external dependencies** for test subagents
4. **Store prompt versions** with git hash
5. **Capture full inputs/outputs** for replay

### Traceability

Each subagent execution produces:

```typescript
interface SubagentTrace {
  subagentName: string;
  version: string;
  executionId: string;
  timestamp: string;
  inputs: any;
  outputs: any;
  promptUsed: string;
  metrics: SubagentMetrics;
  artifacts: string[]; // Paths to generated files
}
```

## Risks and Mitigations

### Risk: Cost Explosion from Agent Chatter

**Impact**: High - Could exceed budget

**Mitigation**:
- Set token budgets per subagent
- Monitor spend in real-time
- Alert at 80% of budget
- Use Haiku for simple tasks
- Cache subagent results aggressively

### Risk: Non-Determinism Breaks CI

**Impact**: Medium - Flaky builds

**Mitigation**:
- Low temperature (0.1-0.3) for production subagents
- Retry with same seed
- Quarantine flaky results
- Human review for critical paths

### Risk: Debugging Difficulty

**Impact**: Medium - Hard to trace issues

**Mitigation**:
- Full trace logging per subagent
- Artifact preservation
- Replay capability
- Clear error messages with context

### Risk: Vendor Lock-In

**Impact**: Medium - Hard to migrate

**Mitigation**:
- Abstract subagent interface
- Store prompts as configuration
- Document alternative frameworks
- Plan migration path for post-MVP

## Related Documents

### Architecture
- [Subagent System Architecture](../architecture/architecture-subagent-system-2025-01-16.md)
- [Global Context Network](../architecture/architecture-global-context-network-2025-01-16.md)

### Decisions
- [ADR-003: Claude Testing Harness](./decision-claude-testing-harness-2025-01-16.md)

### Guides
- [Using Subagents Guide](../guides/guide-using-subagents-2025-01-16.md)
- [TDD Workflow with Subagents](../guides/guide-tdd-workflow-2025-01-16.md)

### Reference
- [Subagent Types Reference](../reference/reference-subagent-types-2025-01-16.md)
- [Claude Agent SDK API](../reference/reference-claude-agent-sdk-api-2025-01-16.md)
