# Claude Agent SDK Integration Guide

> Complete guide to integrating Claude Agent SDK for subagent orchestration

---
title: Claude Agent SDK Integration Guide
category: guide
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [guide, claude-agent-sdk, subagents, integration, orchestration]
---

## Overview

This guide shows you how to integrate the Claude Agent SDK into your TypeScript project to orchestrate specialized subagents. You'll learn the core concepts, installation, configuration, and advanced patterns for building multi-agent systems.

**Time to complete**: 60-90 minutes

## What You'll Learn

- Install and configure Claude Agent SDK
- Create your first subagent configuration
- Invoke subagents and handle streaming responses
- Integrate MCP servers for tools
- Handle errors and implement retry logic
- Run subagents in parallel and sequence

## Prerequisites

- **Phase 0 Setup Complete**: TypeScript project with Vitest
- **Node.js 18+**: `node --version`
- **Anthropic API Key**: Get from https://console.anthropic.com
- **Understanding of async/await**: Basic Promise knowledge

## Core Concepts

### What is the Claude Agent SDK?

The Claude Agent SDK enables you to:
- Define specialized "subagents" with focused prompts and tools
- Delegate tasks to these subagents programmatically
- Stream responses asynchronously
- Integrate external tools via Model Context Protocol (MCP)

### The `query()` API

The primary API for invoking agents:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const response = query({
  prompt: "Your task description",
  options: {
    model: "claude-sonnet-4-5",
    agents: { /* subagent definitions */ },
    mcpServers: { /* MCP server connections */ }
  }
});
```

### Subagent Architecture

```
Main Orchestrator
    │
    ├─► Subagent A (specialized task)
    ├─► Subagent B (specialized task)
    └─► Subagent C (validation)
```

Each subagent has:
- **Description**: What it does
- **Prompt**: Specialized instructions
- **Tools**: Available capabilities (Read, Write, Bash, MCP tools)
- **Model**: Which Claude model to use

## Step 1: Install Claude Agent SDK

### 1.1 Install Package

**IMPORTANT NOTE**: As of January 2025, the Claude Agent SDK package name may be different from what's shown here. Check the official Anthropic documentation for the correct package name and installation instructions.

For this guide, we'll use the placeholder package name:

```bash
# Install Claude Agent SDK (VERIFY ACTUAL PACKAGE NAME)
npm install @anthropic-ai/claude-agent-sdk

# Install types if separate package
npm install -D @types/anthropic-ai__claude-agent-sdk
```

**Official Documentation**: https://docs.anthropic.com/en/docs/agents

### 1.2 Set Up Environment Variables

Add to `.env`:

```bash
# Anthropic API Key (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx

# Optional: Override default model
DEFAULT_MODEL=claude-sonnet-4-5

# Optional: Enable debug logging
AGENT_SDK_DEBUG=true
```

### 1.3 Load Environment Variables

Update `src/index.ts` (or create if missing):

```typescript
import { config } from 'dotenv';

// Load environment variables
config();

// Validate required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required. Set it in .env file.');
}

console.log('✓ Environment variables loaded');
```

### Verification Step 1

```bash
# Test environment loading
node -r ts-node/register src/index.ts
```

**Expected output**:
```
✓ Environment variables loaded
```

## Step 2: Create Your First Subagent

### 2.1 Create Agents Directory

```bash
mkdir -p src/agents
```

### 2.2 Define a Simple Subagent

Create `src/agents/hello-agent.ts`:

```typescript
import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * Simple "hello world" subagent that greets users
 */
export const helloAgent: AgentDefinition = {
  description: 'Greets users in a friendly manner',
  prompt: `You are a friendly greeter.
  When given a name, respond with a warm, personalized greeting.
  Be enthusiastic but professional.`,
  tools: [], // No tools needed for simple greeting
  model: 'claude-sonnet-4-5',
};

/**
 * All subagent definitions for easy import
 */
export const agents = {
  'hello-agent': helloAgent,
};
```

### 2.3 Create Orchestrator

Create `src/agents/orchestrator.ts`:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { agents } from './hello-agent';

/**
 * Invokes a subagent and returns the complete response
 */
export async function invokeSubagent(
  agentName: string,
  prompt: string
): Promise<string> {
  console.log(`Invoking subagent: ${agentName}`);
  console.log(`Prompt: ${prompt}`);

  const response = query({
    prompt,
    options: {
      model: 'claude-sonnet-4-5',
      agents,
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  });

  let fullResponse = '';
  let messageCount = 0;

  for await (const message of response) {
    messageCount++;

    // Log message type for debugging
    if (process.env.AGENT_SDK_DEBUG === 'true') {
      console.log('Message:', message.type, message.subtype || '');
    }

    // Handle different message types
    if (message.type === 'system' && message.subtype === 'subagent_start') {
      console.log(`  → Subagent started: ${message.agent_name}`);
    }

    if (message.type === 'system' && message.subtype === 'subagent_end') {
      console.log(`  ✓ Subagent completed: ${message.agent_name}`);
    }

    if (message.type === 'text') {
      fullResponse += message.text;
    }
  }

  console.log(`Received ${messageCount} messages`);
  return fullResponse;
}
```

### 2.4 Create Test Runner

Create `src/agents/run-hello.ts`:

```typescript
import { config } from 'dotenv';
import { invokeSubagent } from './orchestrator';

config();

async function main() {
  try {
    console.log('=== Hello Agent Test ===\n');

    const response = await invokeSubagent('hello-agent', 'My name is Alice');

    console.log('\n=== Response ===');
    console.log(response);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
```

### Verification Step 2

```bash
# Run the hello agent
ts-node src/agents/run-hello.ts
```

**Expected output**:
```
=== Hello Agent Test ===

Invoking subagent: hello-agent
Prompt: My name is Alice
  → Subagent started: hello-agent
  ✓ Subagent completed: hello-agent
Received 5 messages

=== Response ===
Hello Alice! It's wonderful to meet you. I hope you're having a great day!
```

## Step 3: Advanced Subagent Patterns

### 3.1 Subagent with File Access

Create `src/agents/implementation-agents.ts`:

```typescript
import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * Implementation subagent that can write code
 */
export const codeWriterAgent: AgentDefinition = {
  description: 'Writes TypeScript code following best practices',
  prompt: `You are an expert TypeScript developer.
  When asked to implement a function:
  1. Write clean, type-safe code
  2. Add JSDoc comments
  3. Handle edge cases
  4. Follow functional programming principles when possible
  5. Use strict TypeScript types (no 'any')`,
  tools: ['Write', 'Read', 'Edit'], // File manipulation tools
  model: 'claude-sonnet-4-5',
};

/**
 * Test generator subagent
 */
export const testGeneratorAgent: AgentDefinition = {
  description: 'Generates comprehensive unit tests using Vitest',
  prompt: `You are a testing expert specializing in Vitest.
  When asked to generate tests:
  1. Use describe/it/expect structure
  2. Cover happy path, edge cases, and errors
  3. Use proper arrange-act-assert pattern
  4. Mock external dependencies
  5. Aim for >85% coverage
  Target: Comprehensive, maintainable tests.`,
  tools: ['Write', 'Read', 'Edit'],
  model: 'claude-sonnet-4-5',
};

export const implementationAgents = {
  'code-writer': codeWriterAgent,
  'test-generator': testGeneratorAgent,
};
```

### 3.2 Parallel Subagent Execution

Create `src/agents/parallel-orchestrator.ts`:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Runs multiple subagents in parallel
 */
export async function runParallelSubagents(
  tasks: Array<{ agentName: string; prompt: string }>,
  agents: Record<string, any>
): Promise<string[]> {
  console.log(`Running ${tasks.length} subagents in parallel`);

  const promises = tasks.map(async (task) => {
    const response = query({
      prompt: task.prompt,
      options: {
        model: 'claude-sonnet-4-5',
        agents,
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    });

    let fullResponse = '';
    for await (const message of response) {
      if (message.type === 'text') {
        fullResponse += message.text;
      }
    }
    return fullResponse;
  });

  return Promise.all(promises);
}
```

Example usage:

```typescript
const results = await runParallelSubagents(
  [
    { agentName: 'code-writer', prompt: 'Implement add(a, b) function' },
    { agentName: 'test-generator', prompt: 'Generate tests for add(a, b)' },
  ],
  implementationAgents
);

console.log('Implementation:', results[0]);
console.log('Tests:', results[1]);
```

### 3.3 Sequential with Dependencies

Create `src/agents/sequential-orchestrator.ts`:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Runs subagents sequentially, passing results between them
 */
export async function runSequentialSubagents(
  steps: Array<{
    agentName: string;
    promptTemplate: (previousResults: string[]) => string;
  }>,
  agents: Record<string, any>
): Promise<string[]> {
  const results: string[] = [];

  for (const step of steps) {
    const prompt = step.promptTemplate(results);

    const response = query({
      prompt,
      options: {
        model: 'claude-sonnet-4-5',
        agents,
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    });

    let fullResponse = '';
    for await (const message of response) {
      if (message.type === 'text') {
        fullResponse += message.text;
      }
    }

    results.push(fullResponse);
  }

  return results;
}
```

Example usage (TDD workflow):

```typescript
const tddResults = await runSequentialSubagents(
  [
    {
      agentName: 'test-generator',
      promptTemplate: () => 'Generate failing test for sanitizeApiKeys(text)',
    },
    {
      agentName: 'code-writer',
      promptTemplate: (results) =>
        `Implement minimal code to pass this test:\n\n${results[0]}`,
    },
    {
      agentName: 'code-quality-validator',
      promptTemplate: (results) =>
        `Review this implementation:\n\nTest: ${results[0]}\n\nCode: ${results[1]}`,
    },
  ],
  { ...implementationAgents, ...validationAgents }
);
```

## Step 4: Integrate MCP Tools

### 4.1 Understanding MCP Integration

MCP servers expose tools that subagents can use. For example, a test-runner MCP server might expose:
- `run_unit_tests`: Run Vitest unit tests
- `get_coverage_report`: Get coverage statistics
- `validate_test_quality`: Score test quality

### 4.2 MCP Server Configuration

Create `src/mcp/config.ts`:

```typescript
import { MCPServerConfig } from '@anthropic-ai/claude-agent-sdk';

/**
 * MCP server configurations
 */
export const mcpServers: Record<string, MCPServerConfig> = {
  'test-runner': {
    url: process.env.MCP_TEST_RUNNER_URL || 'http://localhost:3000',
    transport: 'http',
    auth: {
      type: 'none', // Or 'bearer' with token
    },
  },
};
```

### 4.3 Subagent with MCP Tools

Update `src/agents/implementation-agents.ts`:

```typescript
export const testValidatorAgent: AgentDefinition = {
  description: 'Validates test quality using MCP tools',
  prompt: `You are a test quality expert.
  Use the validate_test_quality tool to score tests.
  Require a score ≥ 0.8 to pass.
  Provide specific feedback on failing tests.`,
  tools: [
    'Read',
    'mcp__test-runner__validate_test_quality',
    'mcp__test-runner__get_coverage_report',
  ],
  model: 'claude-sonnet-4-5',
};
```

### 4.4 Invoking with MCP

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { mcpServers } from '../mcp/config';

const response = query({
  prompt: 'Validate the tests in src/sanitization/sanitize.test.ts',
  options: {
    model: 'claude-sonnet-4-5',
    agents: {
      'test-validator': testValidatorAgent,
    },
    mcpServers, // Connect MCP servers
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

**Expected MCP Tool Call**:
```json
{
  "type": "tool_use",
  "name": "mcp__test-runner__validate_test_quality",
  "input": {
    "testFilePath": "src/sanitization/sanitize.test.ts"
  }
}
```

**Expected MCP Response**:
```json
{
  "score": 0.92,
  "feedback": "Excellent coverage of edge cases. Clear test names.",
  "issues": []
}
```

## Step 5: Error Handling and Retry Logic

### 5.1 Error Types

Common errors when using the SDK:

- **Authentication Error**: Invalid API key
- **Rate Limit Error**: Too many requests (HTTP 429)
- **Network Error**: Connection timeout
- **Validation Error**: Invalid agent configuration

### 5.2 Retry with Exponential Backoff

Create `src/agents/retry.ts`:

```typescript
/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('authentication')) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 5.3 Safe Subagent Invocation

```typescript
import { retryWithBackoff } from './retry';

export async function safeInvokeSubagent(
  agentName: string,
  prompt: string,
  agents: Record<string, any>
): Promise<string> {
  return retryWithBackoff(async () => {
    return invokeSubagent(agentName, prompt, agents);
  });
}
```

### 5.4 Token Budget Guard

Create `src/agents/budget.ts`:

```typescript
/**
 * Tracks token usage to prevent runaway costs
 */
export class TokenBudget {
  private usedTokens = 0;

  constructor(private maxTokens: number) {}

  /**
   * Check if we can spend more tokens
   */
  canSpend(estimatedTokens: number): boolean {
    return this.usedTokens + estimatedTokens <= this.maxTokens;
  }

  /**
   * Record token usage
   */
  recordUsage(tokens: number): void {
    this.usedTokens += tokens;
  }

  /**
   * Get remaining budget
   */
  remaining(): number {
    return this.maxTokens - this.usedTokens;
  }

  /**
   * Reset budget
   */
  reset(): void {
    this.usedTokens = 0;
  }
}

// Usage
const budget = new TokenBudget(100000); // 100k tokens max

if (!budget.canSpend(5000)) {
  throw new Error('Token budget exceeded');
}

// After subagent invocation
budget.recordUsage(response.usage.total_tokens);
```

## Step 6: Complete Example

### 6.1 TDD Workflow with Subagents

Create `src/agents/tdd-workflow.ts`:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { implementationAgents } from './implementation-agents';
import { retryWithBackoff } from './retry';

interface TDDResult {
  test: string;
  implementation: string;
  validationScore: number;
}

/**
 * Complete TDD cycle: Red → Green → Refactor
 */
export async function runTDDCycle(
  featureDescription: string
): Promise<TDDResult> {
  console.log('=== TDD Cycle ===');
  console.log('Feature:', featureDescription);

  // RED: Generate failing test
  console.log('\n🔴 RED: Generating test...');
  const test = await retryWithBackoff(async () => {
    const response = query({
      prompt: `Generate a failing test for: ${featureDescription}`,
      options: {
        model: 'claude-sonnet-4-5',
        agents: { 'test-generator': implementationAgents['test-generator'] },
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    });

    let result = '';
    for await (const message of response) {
      if (message.type === 'text') result += message.text;
    }
    return result;
  });

  console.log('✓ Test generated');

  // GREEN: Implement minimal code
  console.log('\n🟢 GREEN: Implementing code...');
  const implementation = await retryWithBackoff(async () => {
    const response = query({
      prompt: `Implement minimal code to pass this test:\n\n${test}`,
      options: {
        model: 'claude-sonnet-4-5',
        agents: { 'code-writer': implementationAgents['code-writer'] },
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    });

    let result = '';
    for await (const message of response) {
      if (message.type === 'text') result += message.text;
    }
    return result;
  });

  console.log('✓ Implementation complete');

  // Validate
  console.log('\n✅ Validating...');
  const validationScore = 0.9; // Would use MCP tool in real implementation

  return { test, implementation, validationScore };
}
```

### 6.2 Run Complete Example

Create `src/agents/run-tdd-example.ts`:

```typescript
import { config } from 'dotenv';
import { runTDDCycle } from './tdd-workflow';

config();

async function main() {
  try {
    const result = await runTDDCycle(
      'A function sanitizeApiKeys(text) that redacts API keys and tokens'
    );

    console.log('\n=== Results ===\n');
    console.log('TEST:\n', result.test);
    console.log('\nIMPLEMENTATION:\n', result.implementation);
    console.log('\nVALIDATION SCORE:', result.validationScore);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
```

## Verification

### Run All Examples

```bash
# Hello agent
ts-node src/agents/run-hello.ts

# TDD workflow example
ts-node src/agents/run-tdd-example.ts
```

## You're Done When...

- ✅ Claude Agent SDK installed and configured
- ✅ Environment variables set (ANTHROPIC_API_KEY)
- ✅ Simple subagent working (hello-agent)
- ✅ Streaming responses handled correctly
- ✅ Error handling with retry implemented
- ✅ Understand parallel and sequential patterns
- ✅ Ready to integrate MCP tools

## Troubleshooting

### Issue: Authentication error

```
Error: Invalid API key
```

**Solution**:
- Verify `ANTHROPIC_API_KEY` in `.env`
- Check API key is valid at https://console.anthropic.com
- Ensure `.env` is loaded: `config()` called before using SDK

### Issue: Rate limit errors

```
Error: Rate limit exceeded (HTTP 429)
```

**Solution**:
- Implement retry with backoff (see Step 5.2)
- Add delays between requests
- Use token budget guard

### Issue: Streaming not working

```
TypeError: response is not iterable
```

**Solution**:
- Use `for await (const message of response)`
- Not `response.forEach()` or `map()`
- Ensure async/await pattern is correct

### Issue: MCP tools not found

```
Error: Tool mcp__test-runner__validate_test_quality not found
```

**Solution**:
- Verify MCP server is running
- Check `mcpServers` configuration
- Ensure tool names match exactly (case-sensitive)

## Best Practices

1. **Always use environment variables** for API keys
2. **Implement retry logic** for production code
3. **Monitor token usage** to control costs
4. **Log subagent invocations** for debugging
5. **Use specific prompts** for better subagent performance
6. **Clean up resources** after streaming completes
7. **Test error paths** (missing API key, network failures)

## Next Steps

Now that you understand the Claude Agent SDK, proceed to:

1. [Using Subagents Guide](./guide-using-subagents-2025-01-16.md) - Patterns for delegation
2. [Testing Harness Usage](./guide-testing-harness-usage-2025-01-16.md) - AI-powered testing
3. [TDD Workflow Guide](./guide-tdd-workflow-2025-01-16.md) - Test-driven development with subagents

## Related Documents

- [Subagent System Architecture](../architecture/architecture-subagent-system-2025-01-16.md)
- [Testing Harness Architecture](../architecture/architecture-testing-harness-2025-01-16.md)
- [Implementation Roadmap](../plans/plan-implementation-roadmap-2025-01-16.md)
