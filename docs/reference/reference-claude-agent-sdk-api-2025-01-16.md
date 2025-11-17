# Claude Agent SDK API Reference

> Complete API reference for Claude Agent SDK with subagent patterns and MCP integration

---
title: Claude Agent SDK API Reference
category: reference
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [claude-agent-sdk, api, subagents, mcp, typescript]
applies_to: Claude Agent SDK 1.x, Sonnet 4.5, Haiku 3.5
---

## Overview

The Claude Agent SDK enables building AI agents with specialized subagents, MCP tool integration, and structured workflows. This document provides complete API reference and best practices.

**Package**: `@anthropic-ai/claude-agent-sdk` (verify actual package name)
**Models**: `claude-sonnet-4-5-20250929`, `claude-haiku-3-5-20250318`

---

## Core API

### query()

Main entry point for delegating tasks to subagents.

**Signature**:
```typescript
function query(options: QueryOptions): AsyncIterable<Message>;

interface QueryOptions {
  prompt: string;
  options?: {
    model?: string;
    agents?: Record<string, AgentDefinition>;
    mcpServers?: Record<string, MCPServerConfig>;
    maxTokens?: number;
    temperature?: number;
    abortSignal?: AbortSignal;
  };
}
```

**Parameters**:
- `prompt` (required): Main task description
- `options.model`: Model ID (default: `claude-sonnet-4-5-20250929`)
- `options.agents`: Subagent definitions (see AgentDefinition)
- `options.mcpServers`: MCP server configurations
- `options.maxTokens`: Token budget (default: 4096)
- `options.temperature`: Randomness 0-1 (default: 1.0)
- `options.abortSignal`: Cancellation signal

**Returns**: Async iterable of messages

**Example**:
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const response = query({
  prompt: 'Implement user authentication',
  options: {
    model: 'claude-sonnet-4-5-20250929',
    agents: {
      'implementation-agent': {
        description: 'Implements authentication logic',
        model: 'sonnet',
        tools: ['Write', 'Read', 'Bash'],
        prompt: 'You are an authentication expert...'
      }
    }
  }
});

for await (const message of response) {
  if (message.type === 'text') {
    console.log(message.content);
  }
}
```

---

### Message Types

**Event Stream Format**:
```typescript
type Message =
  | TextMessage
  | ToolCallMessage
  | ToolResultMessage
  | SubagentStartMessage
  | SubagentProgressMessage
  | SubagentEndMessage
  | ErrorMessage
  | LogMessage;

interface TextMessage {
  type: 'text';
  content: string;
  role: 'user' | 'assistant';
  correlation_id?: string;
}

interface ToolCallMessage {
  type: 'tool_call';
  tool_name: string;
  tool_input: any;
  tool_call_id: string;
  correlation_id?: string;
}

interface ToolResultMessage {
  type: 'tool_result';
  tool_call_id: string;
  result: any;
  error?: string;
  correlation_id?: string;
}

interface SubagentStartMessage {
  type: 'system';
  subtype: 'subagent_start';
  agent_name: string;
  agent_description: string;
  correlation_id: string;
  timestamp: string;
}

interface SubagentProgressMessage {
  type: 'system';
  subtype: 'subagent_progress';
  agent_name: string;
  progress: number; // 0-1
  message: string;
  correlation_id: string;
  timestamp: string;
}

interface SubagentEndMessage {
  type: 'system';
  subtype: 'subagent_end';
  agent_name: string;
  result: any;
  success: boolean;
  error?: string;
  correlation_id: string;
  timestamp: string;
  duration_ms: number;
}

interface ErrorMessage {
  type: 'error';
  error_type: string; // 'api_error' | 'tool_error' | 'timeout' | 'rate_limit'
  error_message: string;
  error_code?: string;
  correlation_id?: string;
  retry_after_ms?: number; // For rate limits
}

interface LogMessage {
  type: 'log';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  correlation_id?: string;
  metadata?: any;
}
```

---

## Subagent Configuration

### AgentDefinition

```typescript
interface AgentDefinition {
  name?: string; // Auto-set from key if not provided
  description: string; // What this agent does
  model: 'sonnet' | 'haiku' | string; // Model selection
  tools: string[]; // Available tool names
  resources?: string[]; // MCP resources
  prompt: string; // System prompt for agent
  output_schema?: JSONSchema; // Expected output format
  temperature?: number; // 0-1, default 1.0
  max_tokens?: number; // Token budget
  stop_sequences?: string[]; // Stop generation at these
  timeout_ms?: number; // Max execution time
  retry_policy?: RetryPolicy;
  metadata?: any; // Custom metadata
}

interface RetryPolicy {
  max_retries: number; // Default 3
  initial_delay_ms: number; // Default 1000
  max_delay_ms: number; // Default 60000
  backoff_multiplier: number; // Default 2 (exponential)
}

interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  // ... standard JSON Schema fields
}
```

**Example: Implementation Agent**:
```typescript
const implementationAgent: AgentDefinition = {
  description: 'Implements TypeScript functions following TDD',
  model: 'sonnet',
  tools: ['Write', 'Read', 'Bash'],
  prompt: `You are a TypeScript implementation expert.

REQUIREMENTS:
- Write type-safe code with strict mode
- Never use "any" types
- Follow TDD: tests exist before implementation
- Handle errors gracefully
- Add JSDoc comments

OUTPUT FORMAT:
Return JSON with:
- files_created: string[]
- tests_passing: boolean
- coverage_percentage: number
`,
  output_schema: {
    type: 'object',
    properties: {
      files_created: { type: 'array', items: { type: 'string' } },
      tests_passing: { type: 'boolean' },
      coverage_percentage: { type: 'number' }
    },
    required: ['files_created', 'tests_passing']
  },
  temperature: 0.7, // Slightly more focused
  max_tokens: 8192,
  timeout_ms: 120000, // 2 minutes
  retry_policy: {
    max_retries: 3,
    initial_delay_ms: 1000,
    max_delay_ms: 30000,
    backoff_multiplier: 2
  }
};
```

**Example: Test Generator**:
```typescript
const testGenerator: AgentDefinition = {
  description: 'Generates comprehensive unit tests',
  model: 'sonnet',
  tools: ['Write', 'Read', 'mcp__test-runner__run_unit_tests'],
  prompt: `You are a test generation expert.

Generate unit tests with:
- Arrange-Act-Assert pattern
- Edge cases (null, undefined, empty, boundary values)
- Error conditions
- Clear test names
- Proper mocking

TARGET: >85% coverage with high-quality tests
`,
  output_schema: {
    type: 'object',
    properties: {
      test_files: { type: 'array', items: { type: 'string' } },
      coverage: { type: 'number' },
      test_count: { type: 'number' }
    },
    required: ['test_files', 'coverage']
  },
  max_tokens: 16384, // More for comprehensive tests
  timeout_ms: 180000 // 3 minutes
};
```

---

## MCP Integration

### MCPServerConfig

```typescript
interface MCPServerConfig {
  name: string;
  command: string; // Executable path
  args?: string[]; // Command arguments
  env?: Record<string, string>; // Environment variables
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  timeout_ms?: number;
}
```

**Example: Test Runner MCP Server**:
```typescript
const testRunnerServer: MCPServerConfig = {
  name: 'test-runner',
  command: 'node',
  args: ['./mcp-servers/test-runner/index.js'],
  env: {
    NODE_ENV: 'test'
  },
  capabilities: {
    tools: true,
    resources: true
  },
  timeout_ms: 30000
};

// Use in query
const response = query({
  prompt: 'Run unit tests',
  options: {
    mcpServers: {
      'test-runner': testRunnerServer
    }
  }
});
```

### MCP Tool Definition

```typescript
// In your MCP server (test-runner/index.js)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'test-runner',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

// Define tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'run_unit_tests',
        description: 'Runs unit tests and returns results',
        inputSchema: {
          type: 'object',
          properties: {
            test_pattern: {
              type: 'string',
              description: 'Test file pattern (e.g., "**/*.test.ts")'
            },
            watch: {
              type: 'boolean',
              description: 'Run in watch mode',
              default: false
            }
          }
        }
      },
      {
        name: 'get_coverage_report',
        description: 'Returns coverage report',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Implement tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'run_unit_tests') {
    const { test_pattern = '**/*.test.ts', watch = false } = args;

    // Run tests
    const result = await runVitest({ pattern: test_pattern, watch });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: result.total,
            passed: result.passed,
            failed: result.failed,
            duration_ms: result.duration,
            coverage: result.coverage
          }, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### MCP Resource Definition

```typescript
// Define resources
server.setRequestHandler('resources/list', async () => {
  return {
    resources: [
      {
        uri: 'test://coverage/summary',
        name: 'Coverage Summary',
        description: 'Current test coverage summary',
        mimeType: 'application/json'
      },
      {
        uri: 'test://results/latest',
        name: 'Latest Test Results',
        description: 'Most recent test run results',
        mimeType: 'application/json'
      }
    ]
  };
});

// Implement resource reads
server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;

  if (uri === 'test://coverage/summary') {
    const coverage = await getCoverageSummary();

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(coverage, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});
```

---

## Execution Patterns

### Parallel Execution

When subagents have no dependencies, run them in parallel:

```typescript
const response = query({
  prompt: 'Implement Phase 0 Foundation',
  options: {
    agents: {
      'foundation-setup': foundationSetupAgent,
      'database-schema': databaseSchemaAgent,
      'test-infrastructure': testInfraAgent
    }
  }
});

const results: Record<string, any> = {};

for await (const message of response) {
  if (message.type === 'system' && message.subtype === 'subagent_end') {
    results[message.agent_name] = message.result;
    console.log(`✅ ${message.agent_name} completed in ${message.duration_ms}ms`);
  }
}

// All three agents ran in parallel
console.log('All agents complete:', results);
```

### Sequential with Dependencies

When subagents depend on each other's outputs:

```typescript
// Step 1: Generate tests
const testResult = await runSubagent('test-generator', {
  function_name: 'detectAPIKeys',
  requirements: 'Detect AWS, OpenAI, GitHub API keys'
});

// Step 2: Implement (needs test output)
const implResult = await runSubagent('implementation-agent', {
  tests: testResult.test_files,
  requirements: 'Implement to pass tests'
});

// Step 3: Validate (needs both)
const validationResult = await runSubagent('implementation-validator', {
  implementation: implResult.files_created,
  tests: testResult.test_files
});

// Helper function
async function runSubagent(agentName: string, input: any): Promise<any> {
  const response = query({
    prompt: JSON.stringify(input),
    options: {
      agents: {
        [agentName]: agentConfigs[agentName]
      }
    }
  });

  let result: any = null;

  for await (const message of response) {
    if (message.type === 'system' && message.subtype === 'subagent_end') {
      result = message.result;
    }
  }

  return result;
}
```

### Fan-Out / Fan-In

Run multiple subagents, then merge results:

```typescript
async function runValidators(code: string): Promise<ValidationReport> {
  const response = query({
    prompt: `Validate this code:\n${code}`,
    options: {
      agents: {
        'code-quality': codeQualityValidator,
        'security': securityValidator,
        'performance': performanceValidator
      }
    }
  });

  const validationResults: Record<string, any> = {};

  for await (const message of response) {
    if (message.type === 'system' && message.subtype === 'subagent_end') {
      validationResults[message.agent_name] = message.result;
    }
  }

  // Merge results
  return {
    code_quality: validationResults['code-quality'],
    security: validationResults['security'],
    performance: validationResults['performance'],
    overall_pass: Object.values(validationResults).every(r => r.passed)
  };
}
```

---

## Error Handling

### Error Types

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class ToolError extends Error {
  constructor(
    message: string,
    public tool_name: string,
    public tool_input: any
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

class TimeoutError extends Error {
  constructor(
    message: string,
    public timeout_ms: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class RateLimitError extends Error {
  constructor(
    message: string,
    public retry_after_ms: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

### Retry Logic

```typescript
async function queryWithRetry(
  options: QueryOptions,
  maxRetries = 3
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = query(options);
      let result: any = null;

      for await (const message of response) {
        if (message.type === 'error') {
          throw new APIError(
            message.error_message,
            message.error_code || 'unknown',
            message.retry_after_ms
          );
        }

        if (message.type === 'system' && message.subtype === 'subagent_end') {
          if (!message.success) {
            throw new Error(message.error || 'Subagent failed');
          }
          result = message.result;
        }
      }

      return result;

    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors
      if (error instanceof Error && error.message.includes('validation')) {
        throw error;
      }

      // Rate limit: wait before retry
      if (error instanceof RateLimitError) {
        await sleep(error.retry_after_ms);
        continue;
      }

      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 60000);
      await sleep(backoffMs);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Graceful Degradation

```typescript
async function sanitizeWithFallback(content: string): Promise<string> {
  try {
    // Try AI sanitization first
    const result = await runSubagent('ai-sanitizer', { content });
    return result.sanitized_content;

  } catch (error) {
    console.warn('AI sanitization failed, falling back to rules:', error);

    // Fallback to rule-based
    const result = await runSubagent('rule-sanitizer', { content });
    return result.sanitized_content;
  }
}
```

---

## Best Practices

### When to Use Subagents

**✅ Use subagents for**:
- Complex, multi-step tasks
- Tasks requiring specialized expertise
- Tasks that can run in parallel
- Tasks requiring different model sizes (Sonnet vs Haiku)
- Tasks needing different tool sets

**❌ Don't use subagents for**:
- Simple, single-step operations
- Tasks where delegation overhead > task complexity
- Tightly coupled operations better done in one context

### Model Selection

**Sonnet (claude-sonnet-4-5)**:
- Complex reasoning
- Code generation
- Architecture decisions
- Creative tasks
- Quality validation

**Haiku (claude-haiku-3-5)**:
- Simple transformations
- Format conversions
- Quick validations
- High-volume operations
- Cost-sensitive tasks

**Example**:
```typescript
const agents = {
  // Sonnet for complex implementation
  'implementation': {
    model: 'claude-sonnet-4-5-20250929',
    description: 'Implements complex authentication logic',
    // ...
  },

  // Haiku for simple validation
  'coverage-checker': {
    model: 'claude-haiku-3-5-20250318',
    description: 'Checks if coverage >= 85%',
    // ...
  }
};
```

### Output Schema Validation

Always validate subagent outputs:

```typescript
import Ajv from 'ajv';

const ajv = new Ajv();

async function runSubagentWithValidation(
  agentName: string,
  input: any,
  expectedSchema: JSONSchema
): Promise<any> {
  const result = await runSubagent(agentName, input);

  const validate = ajv.compile(expectedSchema);
  if (!validate(result)) {
    throw new Error(`Invalid output from ${agentName}: ${JSON.stringify(validate.errors)}`);
  }

  return result;
}

// Usage
const result = await runSubagentWithValidation(
  'implementation-agent',
  { function: 'detectAPIKeys' },
  {
    type: 'object',
    properties: {
      files_created: { type: 'array', items: { type: 'string' } },
      tests_passing: { type: 'boolean' }
    },
    required: ['files_created', 'tests_passing']
  }
);
```

### Correlation IDs

Track execution across subagents:

```typescript
import { randomUUID } from 'crypto';

async function runWithCorrelation(taskName: string, fn: () => Promise<any>): Promise<any> {
  const correlationId = randomUUID();

  console.log(`[${correlationId}] Starting: ${taskName}`);

  try {
    const result = await fn();
    console.log(`[${correlationId}] Success: ${taskName}`);
    return result;
  } catch (error) {
    console.error(`[${correlationId}] Failed: ${taskName}`, error);
    throw error;
  }
}
```

### Cost Tracking

Monitor token usage and costs:

```typescript
interface UsageStats {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

const PRICING = {
  'claude-sonnet-4-5': {
    input: 0.003 / 1000,  // $3 per 1M input tokens
    output: 0.015 / 1000  // $15 per 1M output tokens
  },
  'claude-haiku-3-5': {
    input: 0.00025 / 1000,  // $0.25 per 1M input tokens
    output: 0.00125 / 1000  // $1.25 per 1M output tokens
  }
};

function calculateCost(usage: UsageStats, model: string): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;

  return (
    usage.input_tokens * pricing.input +
    usage.output_tokens * pricing.output
  );
}

async function runWithCostTracking(options: QueryOptions): Promise<{ result: any; cost: number }> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const response = query(options);
  let result: any = null;

  for await (const message of response) {
    // Track usage from messages
    if ('usage' in message) {
      totalInputTokens += message.usage?.input_tokens || 0;
      totalOutputTokens += message.usage?.output_tokens || 0;
    }

    if (message.type === 'system' && message.subtype === 'subagent_end') {
      result = message.result;
    }
  }

  const cost = calculateCost(
    {
      total_tokens: totalInputTokens + totalOutputTokens,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cost_usd: 0
    },
    options.options?.model || 'claude-sonnet-4-5-20250929'
  );

  return { result, cost };
}
```

---

## Testing with SDK

### Mocking the SDK

```typescript
import { vi } from 'vitest';

export function mockQuery(responses: Array<Message[]>) {
  let callCount = 0;

  return vi.fn((options: QueryOptions) => {
    const messages = responses[callCount] || [];
    callCount++;

    return (async function* () {
      for (const message of messages) {
        yield message;
      }
    })();
  });
}

// Usage in tests
it('should handle subagent success', async () => {
  const mockQueryFn = mockQuery([
    [
      {
        type: 'system',
        subtype: 'subagent_start',
        agent_name: 'test-agent',
        correlation_id: '123',
        timestamp: new Date().toISOString()
      },
      {
        type: 'system',
        subtype: 'subagent_end',
        agent_name: 'test-agent',
        result: { files_created: ['test.ts'] },
        success: true,
        correlation_id: '123',
        timestamp: new Date().toISOString(),
        duration_ms: 1000
      }
    ]
  ]);

  // Test your function that uses query()
  const result = await myFunction(mockQueryFn);

  expect(result).toEqual({ files_created: ['test.ts'] });
});
```

### Testing MCP Servers

```typescript
import { createMockMCPServer } from '../helpers/mock-mcp-server';

it('should call MCP tool correctly', async () => {
  const mockServer = createMockMCPServer();

  mockServer.addTool('run_unit_tests', async (args) => {
    return {
      total: 10,
      passed: 10,
      failed: 0
    };
  });

  const response = query({
    prompt: 'Run tests',
    options: {
      mcpServers: {
        'test-runner': mockServer.config
      }
    }
  });

  // Assert tool was called
  expect(mockServer.toolCalls['run_unit_tests']).toHaveLength(1);
});
```

---

## Complete Example

### TDD Workflow with Subagents

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

interface TDDResult {
  tests_created: string[];
  implementation_created: string[];
  all_tests_passing: boolean;
  coverage: number;
}

async function implementFeatureTDD(
  featureName: string,
  requirements: string
): Promise<TDDResult> {
  console.log(`\n🔴 RED: Generating failing tests for ${featureName}...`);

  // Step 1: Generate tests
  const testGenResult = await runSubagent('test-generator', {
    feature: featureName,
    requirements
  });

  console.log(`✅ Tests created: ${testGenResult.test_files.join(', ')}`);

  console.log(`\n🟢 GREEN: Implementing ${featureName}...`);

  // Step 2: Implement
  const implResult = await runSubagent('implementation-agent', {
    feature: featureName,
    requirements,
    tests: testGenResult.test_files
  });

  console.log(`✅ Implementation created: ${implResult.files_created.join(', ')}`);

  console.log(`\n🔵 REFACTOR: Validating quality...`);

  // Step 3: Validate quality (parallel)
  const validationResponse = query({
    prompt: `Validate ${featureName} implementation`,
    options: {
      agents: {
        'code-quality': codeQualityValidator,
        'security': securityValidator,
        'coverage': coverageValidator
      }
    }
  });

  const validations: Record<string, any> = {};

  for await (const message of validationResponse) {
    if (message.type === 'system' && message.subtype === 'subagent_end') {
      validations[message.agent_name] = message.result;

      if (!message.success) {
        throw new Error(`${message.agent_name} failed: ${message.error}`);
      }
    }
  }

  console.log(`\n✅ All quality gates passed!`);

  return {
    tests_created: testGenResult.test_files,
    implementation_created: implResult.files_created,
    all_tests_passing: implResult.tests_passing,
    coverage: validations['coverage'].percentage
  };
}

// Agent configurations
const testGenerator = {
  description: 'Generates comprehensive unit tests',
  model: 'sonnet',
  tools: ['Write', 'Read'],
  prompt: `Generate unit tests following TDD best practices...`,
  output_schema: {
    type: 'object',
    properties: {
      test_files: { type: 'array', items: { type: 'string' } },
      test_count: { type: 'number' }
    },
    required: ['test_files']
  }
};

const implementationAgent = {
  description: 'Implements features to pass tests',
  model: 'sonnet',
  tools: ['Write', 'Read', 'Bash'],
  prompt: `Implement features following TDD...`,
  output_schema: {
    type: 'object',
    properties: {
      files_created: { type: 'array', items: { type: 'string' } },
      tests_passing: { type: 'boolean' }
    },
    required: ['files_created', 'tests_passing']
  }
};

const codeQualityValidator = {
  description: 'Validates code quality',
  model: 'sonnet',
  tools: ['Read', 'Bash'],
  prompt: `Check code quality standards...`
};

const securityValidator = {
  description: 'Scans for security issues',
  model: 'sonnet',
  tools: ['Read', 'Bash'],
  prompt: `Scan for security vulnerabilities...`
};

const coverageValidator = {
  description: 'Checks test coverage',
  model: 'haiku', // Simple task
  tools: ['Bash', 'Read'],
  prompt: `Calculate test coverage percentage...`
};

// Usage
const result = await implementFeatureTDD(
  'API Key Detection',
  'Detect AWS, OpenAI, and GitHub API keys in content'
);

console.log(JSON.stringify(result, null, 2));
```

---

## Related Documents

### Architecture
- [Subagent System Architecture](../architecture/architecture-subagent-system-2025-01-16.md)
- [Global Context Network](../architecture/architecture-global-context-network-2025-01-16.md)

### Reference
- [Subagent Types](./reference-subagent-types-2025-01-16.md)
- [Testing Strategy](./reference-testing-strategy-2025-01-16.md)

### Guides
- [Using Subagents](../guides/guide-using-subagents-2025-01-16.md)
- [TDD Workflow](../guides/guide-tdd-workflow-2025-01-16.md)
