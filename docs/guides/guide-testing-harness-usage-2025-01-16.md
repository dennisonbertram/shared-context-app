# Testing Harness Usage Guide

> Learn how to use the Claude-powered testing harness for AI-driven test generation and validation

---
title: Testing Harness Usage Guide
category: guide
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [guide, testing, vitest, mcp, test-generation, validation]
---

## Overview

This guide teaches you how to use the Claude-powered testing harness - a system where AI subagents generate, validate, and run tests automatically. The harness ensures comprehensive test coverage and quality through AI-powered validation.

**Time to complete**: 90-120 minutes

## What You'll Learn

- Set up the testing MCP server
- Generate tests with test-generator subagents
- Validate test quality automatically
- Run tests and interpret results
- Use coverage validation
- Integrate testing into your workflow

## Prerequisites

- **Phase 0 Setup Complete**: [guide-phase-0-foundation-setup-2025-01-16.md](./guide-phase-0-foundation-setup-2025-01-16.md)
- **Subagents Guide Complete**: [guide-using-subagents-2025-01-16.md](./guide-using-subagents-2025-01-16.md)
- **Vitest Installed**: Should be done in Phase 0
- **Understanding of testing**: Basic test concepts

## Testing Philosophy

**Test-Driven Development with AI Validation**

Traditional TDD:
1. Write test manually
2. Run test (should fail)
3. Implement code
4. Run test (should pass)

AI-Enhanced TDD:
1. **AI generates comprehensive test** (validator checks quality)
2. Run test (should fail)
3. **AI implements minimal code** (validator checks implementation)
4. Run test (should pass)
5. **AI validates quality** (coverage, security, performance)

## Step 1: Set Up MCP Test Runner Server

### 1.1 Create MCP Server Directory

```bash
mkdir -p src/mcp/test-runner
```

### 1.2 Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

### 1.3 Create Test Runner Server

Create `src/mcp/test-runner/server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

class TestRunnerServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'test-runner',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'run_unit_tests',
          description: 'Run Vitest unit tests',
          inputSchema: {
            type: 'object',
            properties: {
              testPattern: {
                type: 'string',
                description: 'Optional test file pattern (e.g., "sanitize")',
              },
            },
          },
        },
        {
          name: 'run_integration_tests',
          description: 'Run integration tests',
          inputSchema: {
            type: 'object',
            properties: {
              testPattern: {
                type: 'string',
                description: 'Optional test file pattern',
              },
            },
          },
        },
        {
          name: 'run_e2e_tests',
          description: 'Run end-to-end tests',
          inputSchema: {
            type: 'object',
            properties: {
              testPattern: {
                type: 'string',
                description: 'Optional test file pattern',
              },
            },
          },
        },
        {
          name: 'get_coverage_report',
          description: 'Get test coverage statistics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'validate_test_quality',
          description: 'Validates test code quality and returns score',
          inputSchema: {
            type: 'object',
            properties: {
              testFilePath: {
                type: 'string',
                description: 'Path to test file to validate',
              },
            },
            required: ['testFilePath'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'run_unit_tests':
          return this.runUnitTests(request.params.arguments?.testPattern as string);

        case 'run_integration_tests':
          return this.runIntegrationTests(request.params.arguments?.testPattern as string);

        case 'run_e2e_tests':
          return this.runE2ETests(request.params.arguments?.testPattern as string);

        case 'get_coverage_report':
          return this.getCoverageReport();

        case 'validate_test_quality':
          return this.validateTestQuality(
            request.params.arguments?.testFilePath as string
          );

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async runUnitTests(testPattern?: string) {
    const pattern = testPattern ? ` -- ${testPattern}` : '';
    const cmd = `npm run test:once${pattern}`;

    try {
      const { stdout, stderr } = await execAsync(cmd);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              stdout,
              stderr,
            }),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              stdout: error.stdout,
              stderr: error.stderr,
            }),
          },
        ],
      };
    }
  }

  private async runIntegrationTests(testPattern?: string) {
    const pattern = testPattern || 'integration';
    return this.runUnitTests(pattern);
  }

  private async runE2ETests(testPattern?: string) {
    const pattern = testPattern || 'e2e';
    return this.runUnitTests(pattern);
  }

  private async getCoverageReport() {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');

    if (!existsSync(coveragePath)) {
      // Run coverage first
      try {
        await execAsync('npm run coverage');
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Coverage generation failed',
              }),
            },
          ],
        };
      }
    }

    try {
      const coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'));
      const total = coverage.total;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              coverage: {
                lines: total.lines.pct,
                statements: total.statements.pct,
                functions: total.functions.pct,
                branches: total.branches.pct,
              },
            }),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }),
          },
        ],
      };
    }
  }

  private async validateTestQuality(testFilePath: string) {
    if (!existsSync(testFilePath)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              score: 0,
              issues: [`Test file not found: ${testFilePath}`],
            }),
          },
        ],
      };
    }

    const testContent = readFileSync(testFilePath, 'utf-8');

    // Simple static analysis
    let score = 1.0;
    const issues: string[] = [];

    // Check for describe blocks
    if (!testContent.includes('describe(')) {
      score -= 0.2;
      issues.push('Missing describe() blocks');
    }

    // Check for it/test blocks
    const testCount = (testContent.match(/it\(|test\(/g) || []).length;
    if (testCount < 3) {
      score -= 0.3;
      issues.push('Insufficient test cases (< 3)');
    }

    // Check for expect statements
    const expectCount = (testContent.match(/expect\(/g) || []).length;
    if (expectCount < testCount) {
      score -= 0.2;
      issues.push('Some tests missing assertions');
    }

    // Check for edge case keywords
    const hasEdgeCases =
      testContent.includes('edge') ||
      testContent.includes('boundary') ||
      testContent.includes('null') ||
      testContent.includes('undefined') ||
      testContent.includes('empty');

    if (!hasEdgeCases) {
      score -= 0.2;
      issues.push('No obvious edge case testing');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            score: Math.max(0, score),
            issues,
            strengths:
              score >= 0.8 ? ['Good test structure', 'Adequate coverage'] : [],
          }),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Test Runner MCP server running on stdio');
  }
}

const server = new TestRunnerServer();
server.run().catch(console.error);
```

### 1.4 Add Server Script

Add to `package.json`:

```json
{
  "scripts": {
    "mcp:test-runner": "node dist/mcp/test-runner/server.js"
  }
}
```

### 1.5 Build and Run

```bash
# Build
npm run build

# Run MCP server (in separate terminal)
npm run mcp:test-runner
```

**Expected output**:
```
Test Runner MCP server running on stdio
```

## Step 2: Generate Tests with Subagents

### 2.1 Create Test Generator Workflow

Create `src/agents/workflows/generate-tests.ts`:

```typescript
import { invokeSubagent } from '../orchestration/invoke';
import { testGeneratorSubagents } from '../subagents/test-generators';

export async function generateUnitTests(
  functionDescription: string,
  filePath?: string
): Promise<string> {
  const prompt = `Generate comprehensive unit tests for:
  
Description: ${functionDescription}
${filePath ? `File: ${filePath}` : ''}

Requirements:
- Use Vitest (describe, it, expect)
- Test happy path
- Test edge cases (null, undefined, empty, very large)
- Test error conditions
- Use arrange-act-assert pattern
- Clear, descriptive test names
- Aim for >85% coverage`;

  return invokeSubagent('unit-test-generator', prompt, {
    agents: testGeneratorSubagents,
  });
}
```

### 2.2 Example Usage

```typescript
import { generateUnitTests } from './workflows/generate-tests';

const tests = await generateUnitTests(
  'Function sanitizeApiKeys(text: string): string that redacts API keys',
  'src/sanitization/sanitize.ts'
);

console.log(tests);
```

**Expected output**:
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeApiKeys } from './sanitize';

describe('sanitizeApiKeys', () => {
  it('should redact OpenAI API keys', () => {
    const input = 'My key is sk-abc123...';
    const result = sanitizeApiKeys(input);
    expect(result).toBe('My key is [REDACTED_API_KEY]');
  });

  it('should handle empty strings', () => {
    expect(sanitizeApiKeys('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(() => sanitizeApiKeys(null as any)).toThrow();
  });

  // ... more tests
});
```

## Step 3: Validate Test Quality

### 3.1 Use MCP Validation Tool

Create `src/agents/workflows/validate-tests.ts`:

```typescript
import { invokeSubagent } from '../orchestration/invoke';
import { validatorSubagents } from '../subagents/validators';
import { mcpServers } from '../../mcp/config';

export async function validateTestQuality(
  testFilePath: string
): Promise<{
  score: number;
  passed: boolean;
  issues: string[];
}> {
  const prompt = `Validate test quality for: ${testFilePath}

Use the validate_test_quality tool to get automated quality score.
Then review manually for:
- Test structure
- Coverage completeness
- Clear naming
- Proper assertions

Return JSON with:
- score (0-1)
- passed (true if score >= 0.8)
- issues (array of strings)`;

  const response = await invokeSubagent('test-quality-validator', prompt, {
    agents: validatorSubagents,
    mcpServers,
  });

  return JSON.parse(response);
}
```

### 3.2 Quality Gate

```typescript
export async function testQualityGate(testFilePath: string): Promise<void> {
  const validation = await validateTestQuality(testFilePath);

  if (!validation.passed) {
    throw new Error(
      `Test quality gate failed (score: ${validation.score})\nIssues:\n${validation.issues.join('\n')}`
    );
  }

  console.log(`✓ Test quality gate passed (score: ${validation.score})`);
}
```

## Step 4: Run Tests and Get Coverage

### 4.1 Run Tests via MCP

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { mcpServers } from '../mcp/config';

export async function runTestsViaMCP(
  testPattern?: string
): Promise<{ success: boolean; output: string }> {
  const prompt = `Run unit tests${testPattern ? ` matching: ${testPattern}` : ''}

Use the run_unit_tests tool.
Return the results.`;

  const response = query({
    prompt,
    options: {
      model: 'claude-sonnet-4-5',
      agents: {},
      mcpServers,
      tools: ['mcp__test-runner__run_unit_tests'],
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  });

  let result = '';
  for await (const message of response) {
    if (message.type === 'text') result += message.text;
  }

  const data = JSON.parse(result);
  return data;
}
```

### 4.2 Get Coverage Report

```typescript
export async function getCoverageViaMCP(): Promise<{
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}> {
  const prompt = 'Get test coverage report using get_coverage_report tool';

  const response = query({
    prompt,
    options: {
      model: 'claude-sonnet-4-5',
      agents: {},
      mcpServers,
      tools: ['mcp__test-runner__get_coverage_report'],
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  });

  let result = '';
  for await (const message of response) {
    if (message.type === 'text') result += message.text;
  }

  const data = JSON.parse(result);
  return data.coverage;
}
```

## Step 5: Complete Testing Workflow

### 5.1 Full TDD Cycle with Testing Harness

Create `src/agents/workflows/tdd-with-harness.ts`:

```typescript
import { generateUnitTests } from './generate-tests';
import { validateTestQuality } from './validate-tests';
import { runTestsViaMCP, getCoverageViaMCP } from './run-tests';
import { invokeSubagent } from '../orchestration/invoke';
import { implementationSubagents } from '../subagents/implementation';

export async function tddCycleWithHarness(
  featureDescription: string
): Promise<void> {
  console.log('=== TDD Cycle with Testing Harness ===\n');

  // 1. RED: Generate test
  console.log('🔴 RED: Generating tests...');
  const testCode = await generateUnitTests(featureDescription);
  console.log('✓ Tests generated\n');

  // 2. Validate test quality
  console.log('📊 Validating test quality...');
  const validation = await validateTestQuality('./generated-test.ts');
  if (!validation.passed) {
    throw new Error(`Test quality insufficient: ${validation.score}`);
  }
  console.log(`✓ Test quality: ${validation.score}\n`);

  // 3. Run tests (should fail)
  console.log('▶ Running tests (expecting failure)...');
  const initialRun = await runTestsViaMCP();
  if (initialRun.success) {
    console.warn('⚠ Warning: Tests passed before implementation!');
  } else {
    console.log('✓ Tests failed as expected\n');
  }

  // 4. GREEN: Implement
  console.log('🟢 GREEN: Implementing code...');
  const implementation = await invokeSubagent(
    'code-writer',
    `Implement minimal code to pass these tests:\n\n${testCode}`,
    { agents: implementationSubagents }
  );
  console.log('✓ Implementation complete\n');

  // 5. Run tests (should pass)
  console.log('▶ Running tests (expecting success)...');
  const finalRun = await runTestsViaMCP();
  if (!finalRun.success) {
    throw new Error('Tests still failing after implementation');
  }
  console.log('✓ Tests passing\n');

  // 6. Coverage check
  console.log('📈 Checking coverage...');
  const coverage = await getCoverageViaMCP();
  console.log('Coverage:', coverage);

  if (coverage.lines < 85) {
    console.warn(`⚠ Warning: Line coverage ${coverage.lines}% < 85%`);
  } else {
    console.log('✓ Coverage acceptable\n');
  }

  console.log('=== TDD Cycle Complete ===');
}
```

## Verification

Create `src/agents/test-harness.ts`:

```typescript
import { config } from 'dotenv';
import { tddCycleWithHarness } from './workflows/tdd-with-harness';

config();

async function main() {
  await tddCycleWithHarness(
    'Function sanitizeApiKeys(text: string) that redacts API keys'
  );
}

main().catch(console.error);
```

```bash
# Start MCP server in one terminal
npm run mcp:test-runner

# Run harness in another terminal
ts-node src/agents/test-harness.ts
```

## You're Done When...

- ✅ MCP test-runner server running
- ✅ Can generate tests via subagents
- ✅ Test quality validation working
- ✅ Can run tests via MCP
- ✅ Coverage reports accessible
- ✅ Complete TDD cycle functioning

## Troubleshooting

### MCP Server Not Running

```bash
# Check if process is running
ps aux | grep test-runner

# Restart server
npm run mcp:test-runner
```

### Tool Not Found

Ensure MCP server exposes the tool and client references it correctly:
- Server: `tools: [{ name: 'run_unit_tests', ... }]`
- Client: `tools: ['mcp__test-runner__run_unit_tests']`

### Coverage Not Generated

```bash
# Run coverage manually first
npm run coverage

# Check coverage directory exists
ls coverage/
```

## Best Practices

1. **Always validate test quality** before implementation
2. **Use MCP tools for consistency** across subagents
3. **Set coverage thresholds** (85% minimum)
4. **Run tests frequently** during development
5. **Monitor MCP server health** for reliable testing
6. **Cost control**: Limit AI validation to critical tests

## Next Steps

- [TDD Workflow Guide](./guide-tdd-workflow-2025-01-16.md) - Deep dive into TDD patterns
- [Phase 1 Hook Development](./guide-phase-1-hook-development-2025-01-16.md) - Apply testing to hooks

## Related Documents

- [Testing Harness Architecture](../architecture/architecture-testing-harness-2025-01-16.md)
- [Testing Strategy Reference](../reference/reference-testing-strategy-2025-01-16.md)
