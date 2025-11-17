# Subagent Types Reference

> Complete catalog of all subagent types with configurations, prompts, and usage patterns

---
title: Subagent Types Reference
category: reference
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [subagents, claude-agent-sdk, development, testing]
applies_to: Claude Agent SDK 1.x, Sonnet 4.5, Haiku 3.5
---

## Overview

This document provides a complete catalog of all subagent types used in the Global Context Network development. Each subagent is specialized for a specific task with defined inputs, outputs, tools, and success criteria.

**Total Subagents**: 22
- **Implementation**: 14 subagents
- **Test Generation**: 3 subagents
- **Test Validation**: 3 subagents
- **Quality Gates**: 3 subagents

## Subagent Contract Template

Each subagent follows this contract:

```typescript
interface SubagentContract {
  name: string;
  description: string;
  phase: number;
  category: 'implementation' | 'test-generation' | 'test-validation' | 'quality-gate';
  model: 'sonnet' | 'haiku';
  tools: string[];
  input_schema: object;
  output_schema: object;
  prompt_template: string;
  success_criteria: string[];
  timeout_ms: number;
  retry_policy: RetryPolicy;
  cost_sensitivity: 'low' | 'medium' | 'high';
  idempotent: boolean;
  concurrency: 'sequential' | 'parallel';
}
```

---

## Phase 0: Foundation

### foundation-setup-agent

**Purpose**: Initialize TypeScript project with Vitest testing infrastructure

**Configuration**:
```typescript
{
  name: "foundation-setup-agent",
  description: "Sets up TypeScript project with strict mode, Vitest, and project structure",
  phase: 0,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Bash", "Read"],
  timeout_ms: 120000,
  cost_sensitivity: "low",
  idempotent: true,
  concurrency: "sequential"
}
```

**Input Schema**:
```typescript
{
  project_name: string;
  node_version: string; // e.g., "20"
  package_manager: "npm" | "pnpm" | "yarn";
}
```

**Output Schema**:
```typescript
{
  files_created: string[];
  dependencies_installed: boolean;
  typescript_version: string;
  vitest_version: string;
}
```

**Prompt Template**:
```
You are a TypeScript project setup expert. Initialize a new TypeScript project with:

1. package.json with dependencies:
   - typescript (latest)
   - vitest (latest)
   - @types/node
   - @typescript-eslint/parser
   - @typescript-eslint/eslint-plugin

2. tsconfig.json with strict mode:
   - "strict": true
   - "esModuleInterop": true
   - "skipLibCheck": true
   - "target": "ES2022"
   - "module": "ESNext"
   - "moduleResolution": "bundler"

3. vitest.config.ts following reference-testing-strategy

4. Project structure:
   - src/
   - tests/
   - .gitignore

5. Install dependencies using {package_manager}

IMPORTANT:
- Use strict TypeScript settings
- Never use "any" types
- All configs must be valid JSON/TypeScript
```

**Success Criteria**:
- ✅ All files created
- ✅ Dependencies installed successfully
- ✅ `pnpm run type-check` passes
- ✅ `pnpm test` can run (even with no tests)

**Common Pitfalls**:
- Forgetting to enable strict mode
- Incorrect module resolution settings
- Missing test setup files

---

### database-schema-agent

**Purpose**: Create SQLite database schema with migrations

**Configuration**:
```typescript
{
  name: "database-schema-agent",
  description: "Designs and implements SQLite database schema with migration system",
  phase: 0,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Bash", "Read"],
  timeout_ms: 90000,
  cost_sensitivity: "medium",
  idempotent: true,
  concurrency: "parallel" // Can run with test-infrastructure
}
```

**Input Schema**:
```typescript
{
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; constraints?: string[] }>;
    indexes?: Array<{ columns: string[]; unique?: boolean }>;
  }>;
  enable_fts: boolean; // Full-text search for learnings
}
```

**Output Schema**:
```typescript
{
  migration_files: string[];
  schema_version: string;
  tables_created: string[];
  indexes_created: string[];
}
```

**Prompt Template**:
```
You are a SQLite database expert. Create a production-ready database schema with:

1. Migration system (migrations/001_initial.sql, 002_add_fts.sql, etc.)

2. All tables from input schema with:
   - Primary keys (id TEXT PRIMARY KEY)
   - Foreign keys (with ON DELETE CASCADE where appropriate)
   - Timestamps (created_at, updated_at with triggers)
   - CHECK constraints for data validation

3. Indexes for all foreign keys and frequently queried columns

4. FTS5 virtual table for learnings.content if enable_fts=true

5. Migration runner in TypeScript (src/database/migrations/runner.ts)

CRITICAL REQUIREMENTS:
- Enable foreign keys: PRAGMA foreign_keys = ON
- Use WAL mode: PRAGMA journal_mode = WAL
- All timestamps as ISO 8601 strings
- Add CHECK constraints for confidence (0.0 to 1.0)
- Ensure ACID compliance

NEVER:
- Store unsanitized data (no "raw_content" columns)
- Use INTEGER for IDs (use TEXT for UUIDs/ULIDs)
- Forget indexes on foreign keys
```

**Success Criteria**:
- ✅ Migration runner executes without errors
- ✅ All tables created with proper constraints
- ✅ Foreign keys enforced
- ✅ Indexes created for performance
- ✅ FTS5 table if requested

**Common Pitfalls**:
- Forgetting PRAGMA foreign_keys = ON
- Not using WAL mode
- Missing indexes on foreign keys
- Incorrect timestamp handling

---

### test-infrastructure-agent

**Purpose**: Set up test utilities, helpers, and fixtures

**Configuration**:
```typescript
{
  name: "test-infrastructure-agent",
  description: "Creates test helpers, fixture factories, and test database utilities",
  phase: 0,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read"],
  timeout_ms: 60000,
  cost_sensitivity: "low",
  idempotent: true,
  concurrency: "parallel"
}
```

**Input Schema**:
```typescript
{
  test_types: Array<"unit" | "integration" | "e2e">;
  fixture_types: Array<"conversation" | "message" | "learning">;
}
```

**Output Schema**:
```typescript
{
  helper_files: string[];
  fixture_files: string[];
  test_setup_complete: boolean;
}
```

**Prompt Template**:
```
You are a test infrastructure expert. Create comprehensive test utilities:

1. Test setup (tests/setup.ts):
   - In-memory SQLite database
   - beforeEach/afterEach hooks
   - Test database cleanup

2. Fixture factories (tests/helpers/fixture-factory.ts):
   - createConversation()
   - createMessage()
   - createLearning()
   - Use @faker-js/faker for realistic data

3. Test helpers (tests/helpers/):
   - db-helpers.ts (query helpers, assertions)
   - mock-helpers.ts (LLM, MCP, IPFS mocks)

4. Sample fixtures (tests/fixtures/):
   - conversations/with-pii.json
   - sanitization/pii-corpus.json

REQUIREMENTS:
- All factories return valid, type-safe objects
- Fixtures should be realistic but synthetic
- Mock helpers should be deterministic
- Follow reference-testing-strategy guidelines
```

**Success Criteria**:
- ✅ Test setup file creates in-memory database
- ✅ Fixture factories generate valid data
- ✅ Mock helpers provide deterministic results
- ✅ Sample fixtures load successfully

---

## Phase 1: Event Capture

### hook-developer-agent

**Purpose**: Implement Claude Code hooks for event capture

**Configuration**:
```typescript
{
  name: "hook-developer-agent",
  description: "Creates UserPromptSubmit and Stop hooks with <100ms execution",
  phase: 1,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read", "Bash"],
  timeout_ms: 120000,
  cost_sensitivity: "high", // Critical path
  idempotent: true,
  concurrency: "sequential"
}
```

**Input Schema**:
```typescript
{
  hook_types: Array<"UserPromptSubmit" | "Stop">;
  output_path: string; // Where to write events
  max_execution_ms: number; // Default 100
}
```

**Output Schema**:
```typescript
{
  hook_scripts: string[];
  performance_p95: number; // Measured in tests
  error_handling: "silent" | "logged";
}
```

**Prompt Template**:
```
You are a Claude Code hooks expert. Implement event capture hooks with STRICT performance requirements:

1. UserPromptSubmit hook (.claude/hooks/userPromptSubmit.ts):
   - Captures user input
   - Writes to event queue
   - MUST execute in <100ms P95
   - NEVER block user interaction

2. Stop hook (.claude/hooks/stop.ts):
   - Captures agent response
   - Includes thinking if available
   - MUST execute in <100ms P95
   - Silent error handling (log but don't throw)

3. Event serialization:
   - Correlation ID for conversation tracking
   - Timestamp (ISO 8601)
   - Event type
   - Payload

CRITICAL REQUIREMENTS:
- P95 latency < 100ms (measured in tests)
- Fail silently with logging
- Never throw errors that block user
- Atomic writes to queue
- Handle process crashes gracefully

FORBIDDEN:
- Synchronous I/O in hooks
- Network calls
- Complex processing
- Throwing errors to user
```

**Success Criteria**:
- ✅ Hooks execute in <100ms P95
- ✅ Events persisted atomically
- ✅ Silent error handling
- ✅ No user-blocking behavior
- ✅ Performance tests pass

**Common Pitfalls**:
- Synchronous file I/O
- Complex sanitization in hooks (do async)
- Not handling errors gracefully
- Missing correlation IDs

---

### event-collector-agent

**Purpose**: Aggregate events into conversations

**Configuration**:
```typescript
{
  name: "event-collector-agent",
  description: "Groups events by conversation with session tracking",
  phase: 1,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read"],
  timeout_ms: 90000,
  cost_sensitivity: "medium",
  idempotent: true,
  concurrency: "parallel"
}
```

**Input Schema**:
```typescript
{
  session_timeout_ms: number; // Default 30 minutes
  correlation_strategy: "session_id" | "time_window" | "hybrid";
}
```

**Output Schema**:
```typescript
{
  collector_module: string;
  conversations_created: number;
  events_processed: number;
}
```

**Prompt Template**:
```
You are an event aggregation expert. Implement conversation collector:

1. Event aggregation (src/events/collector.ts):
   - Group events by correlation_id
   - Detect conversation boundaries
   - Handle session timeouts
   - Support multiple concurrent conversations

2. Conversation assembly:
   - Pair UserPromptSubmit with Stop events
   - Preserve message order
   - Track conversation state (active/complete)

3. Persistence:
   - Write complete conversations to queue
   - Handle partial conversations (session timeout)

REQUIREMENTS:
- Conversations must be ordered correctly
- Handle concurrent sessions
- Graceful session timeout handling
- Idempotent processing (replay-safe)
```

**Success Criteria**:
- ✅ Events correctly grouped by conversation
- ✅ Message order preserved
- ✅ Session timeouts handled
- ✅ Concurrent conversations supported

---

### queue-system-agent

**Purpose**: Implement persistent job queue

**Configuration**:
```typescript
{
  name: "queue-system-agent",
  description: "Creates SQLite-based job queue with priority and retry logic",
  phase: 1,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read", "Bash"],
  timeout_ms: 90000,
  cost_sensitivity: "high",
  idempotent: true,
  concurrency: "sequential"
}
```

**Input Schema**:
```typescript
{
  job_types: string[]; // e.g., ["sanitize", "extract_learning", "upload"]
  priority_levels: number; // Default 3 (high, medium, low)
  max_retries: number; // Default 3
}
```

**Output Schema**:
```typescript
{
  queue_module: string;
  tables_created: string[];
  worker_ready: boolean;
}
```

**Prompt Template**:
```
You are a job queue expert. Implement a robust, persistent queue system:

1. Queue table (job_queue):
   - id, type, status, priority, run_at, locked_at, locked_by
   - payload (JSON), attempts, max_retries, last_error
   - Indexes for (status, priority, run_at)

2. Queue operations (src/queue/queue.ts):
   - enqueue(type, payload, options)
   - dequeue() with priority + run_at ordering
   - markComplete(id)
   - markFailed(id, error)
   - requeueWithBackoff(id)

3. Concurrency control:
   - Optimistic locking (UPDATE ... WHERE locked_at IS NULL)
   - Worker heartbeats
   - Dead letter queue for max retries exceeded

4. Retry logic:
   - Exponential backoff: 2^attempt * 1000ms
   - Max 3 retries by default
   - Quarantine after max retries

CRITICAL:
- ACID compliance for job claiming
- No duplicate processing
- Handle worker crashes (stale locks)
- Observable metrics (queue depth, latency)
```

**Success Criteria**:
- ✅ Jobs persist across restarts
- ✅ No duplicate processing
- ✅ Priority ordering respected
- ✅ Retry logic with backoff
- ✅ Dead letter queue for failures

---

## Phase 2: Sanitization

### rule-sanitizer-agent

**Purpose**: Regex-based PII detection

**Configuration**:
```typescript
{
  name: "rule-sanitizer-agent",
  description: "Fast regex-based PII detection with <1% false positive rate",
  phase: 2,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read"],
  timeout_ms: 90000,
  cost_sensitivity: "high",
  idempotent: true,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a PII detection expert. Implement rule-based sanitization:

1. Detection patterns (src/sanitization/patterns.ts):
   - API keys (AWS, OpenAI, GitHub, etc.)
   - File paths (absolute with usernames)
   - Email addresses
   - IP addresses
   - Phone numbers
   - Credit cards

2. Rule detector (src/sanitization/rule-detector.ts):
   - detectPII(content) → Detection[]
   - Fast execution (<10ms per message)
   - <1% false positive rate on test corpus

3. Replacement strategy:
   - [API_KEY], [FILE_PATH], [EMAIL], etc.
   - Preserve structure for code examples
   - Audit log all detections

REQUIREMENTS:
- All patterns tested against corpus
- Performance: <10ms per 1KB content
- False positive rate <1%
- False negative rate <5%
```

**Success Criteria**:
- ✅ Detects all PII types from corpus
- ✅ Execution time <10ms per message
- ✅ False positive rate <1%
- ✅ Audit log complete

---

### ai-sanitizer-agent

**Purpose**: LLM-powered context-aware sanitization

**Configuration**:
```typescript
{
  name: "ai-sanitizer-agent",
  description: "Context-aware PII detection using LLM with <5% false negative rate",
  phase: 2,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read"],
  timeout_ms: 120000,
  cost_sensitivity: "high",
  idempotent: false, // LLM calls not deterministic
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are an AI-powered sanitization expert. Implement LLM-based PII detection:

1. AI Sanitizer (src/sanitization/ai-sanitizer.ts):
   - Use Claude API for context-aware detection
   - Distinguish person names from variable names
   - Handle company-specific terminology
   - Provide confidence scores

2. Prompt engineering:
   - "Identify PII in this developer conversation..."
   - Return structured JSON with detections
   - Include confidence (0-1)
   - Explain each detection

3. Error handling:
   - Timeout protection (5s max)
   - Fallback to rule-based if API fails
   - Rate limiting
   - Cost tracking

REQUIREMENTS:
- False negative rate <5%
- Execution time <2s per message
- Graceful degradation on API errors
- Cost awareness (token usage)
```

**Success Criteria**:
- ✅ Detects contextual PII (names vs variables)
- ✅ False negative rate <5%
- ✅ API failures handled gracefully
- ✅ Cost tracking implemented

---

### sanitization-pipeline-agent

**Purpose**: Orchestrate hybrid sanitization

**Configuration**:
```typescript
{
  name: "sanitization-pipeline-agent",
  description: "Combines rule-based and AI sanitization with validation",
  phase: 2,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read"],
  timeout_ms: 90000,
  cost_sensitivity: "high",
  idempotent: true,
  concurrency: "sequential"
}
```

**Prompt Template**:
```
You are a sanitization pipeline expert. Combine rule-based and AI sanitization:

1. Pipeline orchestration (src/sanitization/pipeline.ts):
   - Run rule-based detector first (fast)
   - Run AI sanitizer for validation
   - Merge results with deduplication
   - Apply replacements
   - Generate audit log

2. Hybrid validation:
   - Rules catch obvious cases
   - AI validates and enhances
   - Confidence scoring
   - Human review queue for low confidence

3. Output:
   - Sanitized content
   - Detection list
   - Audit log
   - Confidence score

CRITICAL:
- NEVER store unsanitized content
- All detections logged
- Replacements deterministic
- Preserve code structure
```

**Success Criteria**:
- ✅ Zero PII leaks in test corpus
- ✅ Combined FP <1%, FN <3%
- ✅ Complete audit trail
- ✅ Execution time <2s per conversation

---

## Phase 3: Database & Storage

### repository-agent

**Purpose**: Implement repository pattern for database access

**Configuration**:
```typescript
{
  name: "repository-agent",
  description: "Creates type-safe repository interfaces with transaction support",
  phase: 3,
  category: "implementation",
  model: "sonnet",
  tools: ["Write", "Read"],
  timeout_ms: 90000,
  cost_sensitivity: "medium",
  idempotent: true,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a database repository expert. Implement the repository pattern:

1. Base repository (src/database/repositories/base-repository.ts):
   - Transaction support
   - Error handling
   - Type safety
   - Query builders

2. Specific repositories:
   - ConversationRepository
   - MessageRepository
   - LearningRepository
   - JobQueueRepository

3. Repository methods:
   - create(data) → Promise<T>
   - findById(id) → Promise<T | null>
   - update(id, data) → Promise<T>
   - delete(id) → Promise<void>
   - Custom queries (findByConversationId, etc.)

REQUIREMENTS:
- All methods type-safe
- Parameterized queries (no SQL injection)
- Transaction support
- Error wrapping
- NEVER accept unsanitized content
```

**Success Criteria**:
- ✅ All repositories implemented
- ✅ Type safety enforced
- ✅ Transactions working
- ✅ No SQL injection vulnerabilities

---

## Test Generation Subagents

### unit-test-generator

**Configuration**:
```typescript
{
  name: "unit-test-generator",
  description: "Generates comprehensive unit tests with >85% coverage",
  category: "test-generation",
  model: "sonnet",
  tools: ["Write", "Read", "mcp__test-runner__run_unit_tests"],
  timeout_ms: 120000,
  cost_sensitivity: "medium",
  idempotent: false,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a unit test expert. Generate comprehensive unit tests:

1. Test structure:
   - Arrange-Act-Assert pattern
   - Clear test names (should/when/given)
   - One assertion per test
   - Proper mocking of dependencies

2. Coverage:
   - All functions tested
   - Edge cases (empty, null, undefined, boundary values)
   - Error conditions
   - Happy path and sad path

3. Test quality:
   - Fast (<10ms per test)
   - Isolated (no side effects)
   - Deterministic (no flaky tests)
   - Maintainable (clear, DRY)

TARGET: >85% coverage with high-quality tests
```

**Success Criteria**:
- ✅ Coverage ≥85%
- ✅ All tests pass
- ✅ No flaky tests
- ✅ Test quality score ≥0.8

---

### integration-test-generator

**Configuration**:
```typescript
{
  name: "integration-test-generator",
  description: "Creates integration tests for component interactions",
  category: "test-generation",
  model: "sonnet",
  tools: ["Write", "Read", "Bash"],
  timeout_ms: 120000,
  cost_sensitivity: "medium",
  idempotent: false,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are an integration test expert. Generate integration tests:

1. Component interactions:
   - Hook → Queue
   - Sanitization → Database
   - Learning extraction → Upload
   - MCP server → Database

2. Test scenarios:
   - Multi-step workflows
   - Error propagation
   - Transaction rollback
   - Concurrent operations

3. Test data:
   - Use fixture factories
   - Test database per test
   - Cleanup after each test

TARGET: Cover all component boundaries
```

**Success Criteria**:
- ✅ All component interactions tested
- ✅ Error scenarios covered
- ✅ Transactions validated
- ✅ No test pollution

---

### e2e-test-generator

**Configuration**:
```typescript
{
  name: "e2e-test-generator",
  description: "Creates end-to-end workflow tests",
  category: "test-generation",
  model: "sonnet",
  tools: ["Write", "Read", "Bash"],
  timeout_ms: 180000,
  cost_sensitivity: "low",
  idempotent: false,
  concurrency: "sequential"
}
```

**Prompt Template**:
```
You are an E2E test expert. Generate end-to-end tests:

1. Complete workflows:
   - User prompt → Sanitization → Database → MCP query
   - Conversation → Learning extraction → Network upload
   - Hook capture → Processing → Availability

2. System verification:
   - Real database (ephemeral)
   - Real MCP server (test instance)
   - Mocked external services (IPFS, blockchain)

3. Failure scenarios:
   - Service unavailable
   - Timeout handling
   - Retry logic
   - Recovery procedures

TARGET: Validate complete system behavior
```

**Success Criteria**:
- ✅ Happy path works end-to-end
- ✅ Failure scenarios handled
- ✅ Recovery tested
- ✅ Performance acceptable

---

## Test Validation Subagents

### test-quality-validator

**Configuration**:
```typescript
{
  name: "test-quality-validator",
  description: "Reviews test code quality and completeness",
  category: "test-validation",
  model: "sonnet",
  tools: ["Read", "Grep"],
  timeout_ms: 60000,
  cost_sensitivity: "low",
  idempotent: true,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a test quality reviewer. Validate test quality:

1. Structure:
   - Proper describe/it nesting
   - Clear test names
   - AAA pattern
   - One assertion per test

2. Coverage:
   - Edge cases covered
   - Error conditions tested
   - Assertions not just truthy

3. Quality:
   - No test.skip without issue reference
   - No disabled assertions
   - Proper cleanup
   - No magic numbers

SCORE: 0-1, require >0.8 to pass
```

**Success Criteria**:
- ✅ Quality score ≥0.8
- ✅ All issues documented
- ✅ Recommendations provided

---

### coverage-validator

**Configuration**:
```typescript
{
  name: "coverage-validator",
  description: "Ensures adequate test coverage",
  category: "test-validation",
  model: "haiku",
  tools: ["Bash", "Read"],
  timeout_ms: 30000,
  cost_sensitivity: "low",
  idempotent: true,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a coverage validator. Analyze test coverage:

1. Coverage metrics:
   - Lines, statements, functions, branches
   - Per-file coverage
   - Critical path 100% coverage

2. Gaps:
   - Uncovered lines
   - Uncovered branches
   - Missing error handlers

3. Report:
   - Coverage percentage
   - Critical gaps
   - Recommendations

REQUIRE: >85% coverage, critical paths 100%
```

**Success Criteria**:
- ✅ Coverage ≥85%
- ✅ Critical paths 100%
- ✅ Gaps identified

---

### implementation-validator

**Configuration**:
```typescript
{
  name: "implementation-validator",
  description: "Validates implementation against tests",
  category: "test-validation",
  model: "sonnet",
  tools: ["Read", "Bash"],
  timeout_ms: 90000,
  cost_sensitivity: "medium",
  idempotent: true,
  concurrency: "sequential"
}
```

**Prompt Template**:
```
You are an implementation validator. Verify implementation:

1. Test alignment:
   - All tests pass
   - Implementation matches specs
   - No untested edge cases

2. Code quality:
   - TypeScript strict mode
   - No "any" types
   - Proper error handling

3. Security:
   - No SQL injection
   - No command injection
   - No hardcoded secrets

4. Performance:
   - Meets SLAs
   - No obvious bottlenecks

REQUIRE: All tests pass, no security issues
```

**Success Criteria**:
- ✅ All tests pass
- ✅ Security scan clean
- ✅ Performance acceptable
- ✅ Code quality high

---

## Quality Gate Subagents

### code-quality-validator

**Configuration**:
```typescript
{
  name: "code-quality-validator",
  description: "Reviews code quality and standards",
  category: "quality-gate",
  model: "sonnet",
  tools: ["Read", "Bash"],
  timeout_ms: 60000,
  cost_sensitivity: "low",
  idempotent: true,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a code quality reviewer. Enforce standards:

1. TypeScript:
   - Strict mode compliance
   - No "any" types
   - Proper type annotations

2. Code style:
   - ESLint passes
   - Prettier formatted
   - Consistent naming

3. Best practices:
   - DRY (Don't Repeat Yourself)
   - SOLID principles
   - Clear function names
   - Proper error handling

BLOCK: If any critical issues found
```

**Success Criteria**:
- ✅ ESLint passes
- ✅ TypeScript strict mode
- ✅ No "any" types
- ✅ Formatted correctly

---

### security-validator

**Configuration**:
```typescript
{
  name: "security-validator",
  description: "Scans for security vulnerabilities",
  category: "quality-gate",
  model: "sonnet",
  tools: ["Read", "Bash"],
  timeout_ms: 90000,
  cost_sensitivity: "medium",
  idempotent: true,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a security auditor. Scan for vulnerabilities:

1. Code analysis:
   - SQL injection (use parameterized queries)
   - Command injection (no shell=true)
   - Path traversal (validate paths)
   - XSS vectors (sanitize output)

2. Dependencies:
   - Known vulnerabilities
   - Outdated packages
   - License issues

3. Secrets:
   - No hardcoded API keys
   - No passwords in code
   - Proper env var usage

BLOCK: If any critical vulnerabilities found
```

**Success Criteria**:
- ✅ No SQL injection
- ✅ No command injection
- ✅ No hardcoded secrets
- ✅ Dependencies clean

---

### performance-validator

**Configuration**:
```typescript
{
  name: "performance-validator",
  description: "Analyzes performance characteristics",
  category: "quality-gate",
  model: "sonnet",
  tools: ["Read", "Bash"],
  timeout_ms: 60000,
  cost_sensitivity: "low",
  idempotent: true,
  concurrency: "parallel"
}
```

**Prompt Template**:
```
You are a performance analyst. Check performance:

1. Algorithm complexity:
   - O(n) acceptable, O(n²) flag
   - No unnecessary loops
   - Proper data structures

2. Database:
   - Indexes on foreign keys
   - No N+1 queries
   - Batch operations where possible

3. Resource usage:
   - No memory leaks
   - Proper stream handling
   - Connection pooling

FLAG: Performance regressions or obvious bottlenecks
```

**Success Criteria**:
- ✅ Algorithm complexity acceptable
- ✅ No N+1 queries
- ✅ No obvious bottlenecks
- ✅ Resource usage reasonable

---

## Orchestration Patterns

### Parallel Execution

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Phase 0: All can run in parallel
const response = query({
  prompt: 'Implement Phase 0 Foundation',
  options: {
    model: 'claude-sonnet-4-5',
    agents: {
      'foundation-setup-agent': foundationSetupConfig,
      'database-schema-agent': databaseSchemaConfig,
      'test-infrastructure-agent': testInfraConfig
    }
  }
});

for await (const message of response) {
  if (message.type === 'system' && message.subtype === 'subagent_end') {
    console.log(`Completed: ${message.agent_name}`);
  }
}
```

### Sequential with Dependencies

```typescript
// Phase 1: Sequential dependencies
// 1. Setup hooks first
const hooksResult = await query({
  prompt: 'Implement hooks',
  options: {
    agents: { 'hook-developer-agent': hookConfig }
  }
});

// 2. Then event collector (needs hooks to test)
const collectorResult = await query({
  prompt: 'Implement event collector',
  options: {
    agents: { 'event-collector-agent': collectorConfig }
  }
});

// 3. Finally queue system
const queueResult = await query({
  prompt: 'Implement queue system',
  options: {
    agents: { 'queue-system-agent': queueConfig }
  }
});
```

## Related Documents

### Architecture
- [Subagent System Architecture](../architecture/architecture-subagent-system-2025-01-16.md)
- [Global Context Network](../architecture/architecture-global-context-network-2025-01-16.md)

### Reference
- [Claude Agent SDK API](./reference-claude-agent-sdk-api-2025-01-16.md)
- [Testing Strategy](./reference-testing-strategy-2025-01-16.md)
- [Database Schema](./reference-database-schema-2025-01-16.md)

### Guides
- [Using Subagents](../guides/guide-using-subagents-2025-01-16.md)
- [TDD Workflow](../guides/guide-tdd-workflow-2025-01-16.md)
