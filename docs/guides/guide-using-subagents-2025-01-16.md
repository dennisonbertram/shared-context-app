# Using Subagents Guide

> Learn how to delegate tasks to specialized Claude subagents for focused expertise

---
title: Using Subagents Guide
category: guide
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [guide, subagents, delegation, orchestration, patterns]
---

## Overview

This guide teaches you how to effectively use subagents in the Global Context Network project. Subagents are specialized Claude instances with focused prompts and tools, designed to handle specific tasks better than a general-purpose agent.

**Time to complete**: 60-90 minutes

## What You'll Learn

- When to delegate vs implement directly
- How to define effective subagent configurations
- Invoking subagents via Claude Agent SDK
- Monitoring subagent progress
- Handling subagent responses
- Parallel and sequential delegation patterns

## Prerequisites

- **Phase 0 Setup Complete**: [guide-phase-0-foundation-setup-2025-01-16.md](./guide-phase-0-foundation-setup-2025-01-16.md)
- **Claude Agent SDK Integrated**: [guide-claude-agent-sdk-integration-2025-01-16.md](./guide-claude-agent-sdk-integration-2025-01-16.md)
- **Understanding of TypeScript**: async/await, Promises, types

## Core Principle

**Never implement directly - always delegate to specialized subagents.**

Why? Subagents provide:
- **Focused expertise**: Each knows its domain deeply
- **Consistent quality**: Specialized prompts ensure standards
- **Parallel execution**: Independent tasks run simultaneously
- **Built-in validation**: Quality checks at every step

## When to Use Subagents

### Delegate to Subagents When:

✅ **Implementing features**: Use implementation subagents
✅ **Writing tests**: Use test generator subagents
✅ **Validating code**: Use quality validator subagents
✅ **Complex workflows**: Use orchestrator patterns
✅ **Multiple independent tasks**: Use parallel execution

### Implement Directly When:

❌ **Trivial changes**: Simple one-line fixes
❌ **Configuration files**: package.json, tsconfig.json
❌ **Already tested patterns**: Proven, simple code
❌ **Time-sensitive debugging**: Immediate fixes needed

## Step 1: Understanding Subagent Anatomy

### 1.1 Subagent Definition Structure

```typescript
import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

const exampleAgent: AgentDefinition = {
  // What this agent does (for orchestrator selection)
  description: 'Implements TypeScript functions with strict types',

  // Specialized instructions (the agent's expertise)
  prompt: `You are an expert TypeScript developer.
  Your role: Implement functions following these rules:
  1. Use strict TypeScript types (never 'any')
  2. Add comprehensive JSDoc comments
  3. Handle edge cases explicitly
  4. Follow functional programming when possible
  5. Write defensive code with validation

  Quality bar: Production-ready, type-safe, well-documented code.`,

  // Available capabilities
  tools: ['Read', 'Write', 'Edit', 'Bash'],

  // Which model to use
  model: 'claude-sonnet-4-5',
};
```

### 1.2 Effective Prompt Design

**Bad Prompt** (too vague):
```typescript
prompt: "Write good code"
```

**Good Prompt** (specific, actionable):
```typescript
prompt: `You are a sanitization expert.
When implementing PII redaction:
1. Use regex for fast detection (API keys, emails, IPs)
2. Preserve code structure while masking values
3. Log redaction count for audit trail
4. Never miss potential PII - err on side of caution
5. Test with real-world examples

Performance: < 10ms per conversation
Accuracy: < 1% false negatives`
```

### 1.3 Tool Selection

Match tools to subagent needs:

| Subagent Type | Typical Tools |
|---------------|---------------|
| Implementation | Read, Write, Edit, Bash |
| Test Generator | Read, Write, Edit |
| Validator | Read, Grep, mcp__test-runner__* |
| Quality Checker | Read, Grep, Bash |
| Documentation | Read, Write, Edit |

## Step 2: Creating Specialized Subagents

### 2.1 Implementation Subagent

Create `src/agents/subagents/implementation.ts`:

```typescript
import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * Hook implementation specialist
 */
export const hookDeveloperAgent: AgentDefinition = {
  description: 'Implements Claude Code hooks with <100ms execution time',
  prompt: `You are a Claude Code hooks expert.

  When implementing hooks:
  1. NEVER block user interaction (< 100ms execution)
  2. Fail silently with structured logging
  3. Use fire-and-forget for I/O operations
  4. Validate input before processing
  5. Queue events asynchronously

  Event Schema:
  - id: unique identifier
  - conversation_id: thread identifier
  - role: 'user' | 'assistant'
  - content: sanitized message content
  - timestamp: Unix timestamp

  Error Handling:
  - Try-catch all operations
  - Log errors with context
  - Never throw to caller (hooks must not fail)

  Performance Budget: < 100ms total, < 50ms for queueing.`,
  tools: ['Read', 'Write', 'Edit', 'Bash'],
  model: 'claude-sonnet-4-5',
};

/**
 * Sanitization pipeline specialist
 */
export const sanitizationAgent: AgentDefinition = {
  description: 'Implements PII detection and redaction with hybrid approach',
  prompt: `You are a PII sanitization expert.

  Implement hybrid sanitization:

  Phase 1 - Rule-Based (Fast):
  - Regex for API keys: /sk-[a-zA-Z0-9]{48}/
  - Email: RFC 5322 compliant regex
  - IP addresses: IPv4/IPv6 patterns
  - File paths: absolute paths with usernames
  - URLs with tokens: query params containing 'token', 'key', 'secret'

  Phase 2 - AI-Powered (Accurate):
  - Context-aware name detection (distinguish from variables)
  - Company-specific terminology
  - Phone numbers (international formats)
  - Addresses

  Validation:
  - Combine rule-based + AI results
  - Log all redactions for audit
  - Performance: < 2s per conversation
  - Accuracy: < 1% false negatives, < 5% false positives

  Replacement Strategy:
  - API keys → [REDACTED_API_KEY]
  - Emails → [REDACTED_EMAIL]
  - Paths → [REDACTED_PATH]
  - Names → [REDACTED_NAME]`,
  tools: ['Read', 'Write', 'Edit'],
  model: 'claude-sonnet-4-5',
};

export const implementationSubagents = {
  'hook-developer': hookDeveloperAgent,
  'sanitization-developer': sanitizationAgent,
};
```

### 2.2 Test Generator Subagent

Create `src/agents/subagents/test-generators.ts`:

```typescript
import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * Unit test generator
 */
export const unitTestGenerator: AgentDefinition = {
  description: 'Generates comprehensive unit tests with Vitest',
  prompt: `You are a testing expert specializing in Vitest.

  When generating unit tests:

  Structure:
  - describe() for component/function
  - it() for individual behaviors
  - expect() for assertions (be specific, not just truthy)

  Coverage Requirements:
  - Happy path
  - Edge cases (empty, null, undefined, very large)
  - Error conditions
  - Boundary values

  Patterns:
  - Arrange-Act-Assert structure
  - One logical assertion per test
  - Clear, descriptive test names
  - Mock external dependencies
  - Use beforeEach for setup, afterEach for cleanup

  Quality:
  - Target: > 85% coverage
  - No flaky tests (deterministic)
  - Fast execution (< 100ms per test)
  - Independent tests (no shared state)

  Example:
  describe('sanitizeApiKeys', () => {
    it('should redact OpenAI API keys', () => {
      const input = 'My key is sk-abc123';
      const result = sanitizeApiKeys(input);
      expect(result).toBe('My key is [REDACTED_API_KEY]');
    });
  });`,
  tools: ['Read', 'Write', 'Edit'],
  model: 'claude-sonnet-4-5',
};

/**
 * Integration test generator
 */
export const integrationTestGenerator: AgentDefinition = {
  description: 'Generates integration tests for component interactions',
  prompt: `You are an integration testing expert.

  When generating integration tests:

  Scope:
  - Test real component interactions
  - Use actual database (test instance)
  - Test file I/O with temp files
  - Verify async behavior

  Patterns:
  - Set up realistic test data
  - Test complete workflows (hook → queue → sanitize → db)
  - Verify side effects (database writes, file creation)
  - Test error propagation between components
  - Clean up resources in afterEach

  Example:
  describe('Event Capture Flow', () => {
    it('should capture user prompt and queue for sanitization', async () => {
      const db = createTestDatabase();
      const queue = new EventQueue(db);

      await captureUserPrompt({ content: 'test' });

      const jobs = queue.getPendingJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].type).toBe('sanitize_conversation');
    });
  });`,
  tools: ['Read', 'Write', 'Edit', 'Bash'],
  model: 'claude-sonnet-4-5',
};

export const testGeneratorSubagents = {
  'unit-test-generator': unitTestGenerator,
  'integration-test-generator': integrationTestGenerator,
};
```

### 2.3 Validator Subagent

Create `src/agents/subagents/validators.ts`:

```typescript
import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * Test quality validator
 */
export const testQualityValidator: AgentDefinition = {
  description: 'Validates test code quality and completeness',
  prompt: `You are a test quality auditor.

  Review tests for:

  Structure (0.3 weight):
  - Proper describe/it nesting
  - Clear, descriptive names
  - Logical grouping

  Coverage (0.4 weight):
  - Happy path tested
  - Edge cases covered
  - Error conditions tested
  - Boundary values checked

  Quality (0.3 weight):
  - Specific assertions (not just truthy)
  - No test interdependencies
  - Proper mocking
  - Arrange-Act-Assert pattern

  Scoring:
  - 1.0: Excellent, comprehensive
  - 0.8-0.9: Good, minor gaps
  - 0.6-0.7: Acceptable, some issues
  - < 0.6: Fail, major problems

  Return JSON:
  {
    "score": 0.92,
    "strengths": ["Excellent edge case coverage"],
    "weaknesses": ["Missing error condition test"],
    "required_fixes": []
  }`,
  tools: ['Read', 'Grep', 'mcp__test-runner__validate_test_quality'],
  model: 'claude-sonnet-4-5',
};

/**
 * Code quality validator
 */
export const codeQualityValidator: AgentDefinition = {
  description: 'Reviews code for quality, security, and standards compliance',
  prompt: `You are a code quality auditor.

  Review code for:

  TypeScript Standards:
  - Strict mode compliance
  - No 'any' types
  - Proper type annotations
  - Type safety in edge cases

  Code Quality:
  - Clear naming
  - DRY (no duplication)
  - SOLID principles
  - Appropriate abstractions
  - Error handling

  Security:
  - SQL injection vulnerabilities
  - Command injection risks
  - Path traversal
  - Hardcoded secrets

  Performance:
  - O(n) complexity acceptable
  - No unnecessary iterations
  - Efficient database queries

  Fail if:
  - Security vulnerabilities found
  - Uses 'any' type
  - Missing error handling
  - Performance issues

  Return JSON with pass/fail and specific issues.`,
  tools: ['Read', 'Grep', 'Bash'],
  model: 'claude-sonnet-4-5',
};

export const validatorSubagents = {
  'test-quality-validator': testQualityValidator,
  'code-quality-validator': codeQualityValidator,
};
```

## Step 3: Invoking Subagents

### 3.1 Single Subagent Invocation

Create `src/agents/orchestration/invoke.ts`:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

export interface SubagentConfig {
  agents: Record<string, any>;
  mcpServers?: Record<string, any>;
}

/**
 * Invokes a single subagent and returns response
 */
export async function invokeSubagent(
  agentName: string,
  prompt: string,
  config: SubagentConfig
): Promise<string> {
  console.log(`→ Invoking: ${agentName}`);

  const response = query({
    prompt,
    options: {
      model: 'claude-sonnet-4-5',
      agents: config.agents,
      mcpServers: config.mcpServers,
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  });

  let fullResponse = '';

  for await (const message of response) {
    if (message.type === 'system' && message.subtype === 'subagent_start') {
      console.log(`  ▸ Started: ${message.agent_name}`);
    }

    if (message.type === 'text') {
      fullResponse += message.text;
    }

    if (message.type === 'system' && message.subtype === 'subagent_end') {
      console.log(`  ✓ Completed: ${message.agent_name}`);
    }
  }

  return fullResponse;
}
```

**Example usage**:

```typescript
import { invokeSubagent } from './orchestration/invoke';
import { implementationSubagents } from './subagents/implementation';

const hookCode = await invokeSubagent(
  'hook-developer',
  'Implement UserPromptSubmit hook that queues events in < 100ms',
  { agents: implementationSubagents }
);
```

### 3.2 Parallel Execution

```typescript
/**
 * Runs multiple independent subagents in parallel
 */
export async function runParallel(
  tasks: Array<{ agent: string; prompt: string }>,
  config: SubagentConfig
): Promise<string[]> {
  console.log(`Running ${tasks.length} subagents in parallel`);

  const promises = tasks.map((task) =>
    invokeSubagent(task.agent, task.prompt, config)
  );

  return Promise.all(promises);
}
```

**Example usage** (implement hooks + tests simultaneously):

```typescript
const [hookCode, hookTests] = await runParallel(
  [
    {
      agent: 'hook-developer',
      prompt: 'Implement UserPromptSubmit hook',
    },
    {
      agent: 'unit-test-generator',
      prompt: 'Generate tests for UserPromptSubmit hook',
    },
  ],
  {
    agents: { ...implementationSubagents, ...testGeneratorSubagents },
  }
);
```

### 3.3 Sequential with Dependencies

```typescript
/**
 * Runs subagents in sequence, passing results forward
 */
export async function runSequential(
  steps: Array<{
    agent: string;
    promptTemplate: (results: string[]) => string;
  }>,
  config: SubagentConfig
): Promise<string[]> {
  const results: string[] = [];

  for (const step of steps) {
    const prompt = step.promptTemplate(results);
    const result = await invokeSubagent(step.agent, prompt, config);
    results.push(result);
  }

  return results;
}
```

**Example usage** (TDD Red-Green-Refactor):

```typescript
const [test, implementation, validation] = await runSequential(
  [
    {
      agent: 'unit-test-generator',
      promptTemplate: () => 'Generate test for sanitizeApiKeys(text)',
    },
    {
      agent: 'sanitization-developer',
      promptTemplate: (results) =>
        `Implement minimal code to pass:\n\n${results[0]}`,
    },
    {
      agent: 'code-quality-validator',
      promptTemplate: (results) =>
        `Validate:\n\nTest: ${results[0]}\n\nCode: ${results[1]}`,
    },
  ],
  {
    agents: {
      ...testGeneratorSubagents,
      ...implementationSubagents,
      ...validatorSubagents,
    },
  }
);
```

## Step 4: Real-World Patterns

### 4.1 Implement Feature with Quality Gates

Create `src/agents/workflows/implement-feature.ts`:

```typescript
import { runSequential } from '../orchestration/invoke';
import {
  implementationSubagents,
  testGeneratorSubagents,
  validatorSubagents,
} from '../subagents';

export async function implementFeature(
  featureDescription: string
): Promise<{
  test: string;
  implementation: string;
  qualityScore: number;
}> {
  console.log('=== Implementing Feature with Quality Gates ===');

  const [test, implementation, qualityReport] = await runSequential(
    [
      // RED: Generate test
      {
        agent: 'unit-test-generator',
        promptTemplate: () => `Generate comprehensive tests for: ${featureDescription}`,
      },

      // GREEN: Implement
      {
        agent: 'sanitization-developer', // Use appropriate implementation agent
        promptTemplate: (results) =>
          `Implement minimal code to pass these tests:\n\n${results[0]}`,
      },

      // VALIDATE: Quality gate
      {
        agent: 'code-quality-validator',
        promptTemplate: (results) =>
          `Validate implementation:\n\nTests: ${results[0]}\n\nCode: ${results[1]}`,
      },
    ],
    {
      agents: {
        ...testGeneratorSubagents,
        ...implementationSubagents,
        ...validatorSubagents,
      },
    }
  );

  // Parse quality score from report
  const qualityData = JSON.parse(qualityReport);

  if (qualityData.score < 0.8) {
    throw new Error(
      `Quality gate failed: ${qualityData.score}\nIssues: ${qualityData.issues.join(', ')}`
    );
  }

  return {
    test,
    implementation,
    qualityScore: qualityData.score,
  };
}
```

### 4.2 Parallel Validation

```typescript
/**
 * Runs multiple validators in parallel
 */
export async function validateQuality(
  testCode: string,
  implCode: string
): Promise<{
  testQuality: number;
  codeQuality: number;
  passed: boolean;
}> {
  const [testReport, codeReport] = await runParallel(
    [
      {
        agent: 'test-quality-validator',
        prompt: `Validate test quality:\n\n${testCode}`,
      },
      {
        agent: 'code-quality-validator',
        prompt: `Validate code quality:\n\n${implCode}`,
      },
    ],
    { agents: validatorSubagents }
  );

  const testQuality = JSON.parse(testReport).score;
  const codeQuality = JSON.parse(codeReport).score;

  return {
    testQuality,
    codeQuality,
    passed: testQuality >= 0.8 && codeQuality >= 0.8,
  };
}
```

## Step 5: Monitoring and Debugging

### 5.1 Subagent Progress Logging

```typescript
export async function invokeWithLogging(
  agentName: string,
  prompt: string,
  config: SubagentConfig
): Promise<string> {
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] Starting: ${agentName}`);
  console.log(`Prompt length: ${prompt.length} chars`);

  const response = await invokeSubagent(agentName, prompt, config);

  const duration = Date.now() - startTime;
  console.log(`[${new Date().toISOString()}] Completed in ${duration}ms`);
  console.log(`Response length: ${response.length} chars`);

  return response;
}
```

### 5.2 Error Context

```typescript
export async function safeInvoke(
  agentName: string,
  prompt: string,
  config: SubagentConfig
): Promise<string> {
  try {
    return await invokeSubagent(agentName, prompt, config);
  } catch (error) {
    console.error('Subagent failed:', {
      agent: agentName,
      promptPreview: prompt.substring(0, 100),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

## Verification

Create `src/agents/test-subagents.ts`:

```typescript
import { config } from 'dotenv';
import { implementFeature } from './workflows/implement-feature';

config();

async function main() {
  const result = await implementFeature(
    'Function sanitizeApiKeys(text: string): string that redacts API keys'
  );

  console.log('\n=== Results ===');
  console.log('Quality Score:', result.qualityScore);
  console.log('\nTest:\n', result.test);
  console.log('\nImplementation:\n', result.implementation);
}

main();
```

```bash
ts-node src/agents/test-subagents.ts
```

## You're Done When...

- ✅ Understand when to delegate vs implement
- ✅ Can define effective subagent configurations
- ✅ Can invoke subagents with proper error handling
- ✅ Understand parallel and sequential patterns
- ✅ Can monitor subagent progress
- ✅ Have working examples of all patterns

## Best Practices

1. **Specific Prompts**: Give clear, detailed instructions
2. **Appropriate Tools**: Match tools to tasks
3. **Error Handling**: Always wrap in try-catch
4. **Logging**: Track invocations and timing
5. **Validation**: Use quality gates consistently
6. **Parallel When Possible**: Independent tasks run together
7. **Sequential When Dependent**: Pass results forward

## Next Steps

- [Testing Harness Usage](./guide-testing-harness-usage-2025-01-16.md) - AI-powered testing
- [TDD Workflow Guide](./guide-tdd-workflow-2025-01-16.md) - Test-driven development
- [Phase 1 Hook Development](./guide-phase-1-hook-development-2025-01-16.md) - Apply subagents to hooks

## Related Documents

- [Subagent System Architecture](../architecture/architecture-subagent-system-2025-01-16.md)
- [Claude Agent SDK Integration](./guide-claude-agent-sdk-integration-2025-01-16.md)
- [Implementation Roadmap](../plans/plan-implementation-roadmap-2025-01-16.md)
