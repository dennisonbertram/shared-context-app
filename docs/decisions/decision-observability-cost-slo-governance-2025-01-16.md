---
title: "ADR-013: Observability, Cost Management, and SLO Governance"
category: decision
date: 2025-01-16
status: ready-for-implementation
authors: System Architecture Team
reviewers: [GPT-5]
tags: [observability, performance, cost-management, slo, telemetry, privacy]
related:
  - ../STANDARDS.md
  - ./decision-sanitize-before-storage-2025-01-16.md
  - ../architecture/architecture-hooks-event-capture-2025-01-16.md
  - ../reviews/gpt5-holistic-review-2025-01-16.txt
  - ../reviews/gpt5-adr013-review-2025-01-16.txt
  - ../reviews/gemini-holistic-review-2025-01-16.txt
---

# ADR-013: Observability, Cost Management, and SLO Governance

## Status

**READY FOR IMPLEMENTATION** - All GPT-5 priority fixes integrated (2025-01-16)

## Context

### Business Need

The Global Context Network relies on external Claude API calls for sanitization validation and learning extraction. Without proper monitoring, cost controls, and SLO enforcement:

1. **Runaway costs**: Uncontrolled API usage could exhaust budgets
2. **Performance degradation**: No visibility into SLO violations
3. **Operational blindness**: Cannot diagnose failures or bottlenecks
4. **User experience risk**: Slow responses or failures go undetected

### Review Feedback

External reviews identified critical gaps:

**GPT-5 Review** (lines 66-67):
> "Add a brief operational runbook (how to restart workers, recover queues, apply migrations, backup/restore) and a **cost/SLO budget table for Claude API use**."

**Gemini 2.5 Pro Review** (line 90):
> "**Cost Analysis & Management:** There's no plan for monitoring or controlling the operational costs of the Claude API calls, which will be substantial for sanitization and learning extraction."

### Requirements

1. **Privacy-safe telemetry**: No PII in logs or metrics
2. **Cost control**: Budget caps with graceful degradation
3. **SLO enforcement**: Meet performance targets from STANDARDS.md
4. **Local-first**: Telemetry stored locally by default
5. **Opt-in sharing**: Anonymous metrics sharing only with consent
6. **Actionable**: Metrics must enable debugging and optimization

## Decision

We will implement a **privacy-first observability stack** with cost controls and SLO enforcement:

### 1. Privacy-Safe Telemetry

#### Structured Logging (JSON)

**Format**:
```typescript
interface LogEntry {
  timestamp: string;        // ISO-8601 UTC
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;        // 'hook' | 'sanitizer' | 'learner' | 'worker' | 'mcp'
  event: string;            // 'message_captured' | 'sanitization_complete' | etc.
  correlation_id: string;   // ULID for request tracing
  duration_ms?: number;     // For performance tracking
  metadata: Record<string, unknown>;  // NEVER contains PII
}
```

**Privacy Rules** (Allowlist-Based):
- ✅ **DO log**: IDs, durations, counts, status codes, component names
- ✅ **DO log**: Sanitized content (if debugging enabled, user opt-in, with sampling/short retention)
- ❌ **NEVER log**: Raw content before sanitization
- ❌ **NEVER log**: PII (emails, paths, API keys, etc.)
- ❌ **NEVER log**: Chain-of-thought or hidden reasoning

**Allowlist-Based Event Schemas**:
```typescript
// Define strict allowed fields per event type
const EVENT_SCHEMAS = {
  message_captured: {
    allowed_keys: ['correlation_id', 'conversation_id', 'message_id', 'role', 'content_length', 'timestamp'],
    required_keys: ['correlation_id', 'message_id', 'role']
  },
  sanitization_complete: {
    allowed_keys: ['correlation_id', 'message_id', 'redaction_count', 'duration_ms', 'timestamp'],
    required_keys: ['correlation_id', 'message_id', 'redaction_count', 'duration_ms']
  },
  api_call_complete: {
    allowed_keys: ['correlation_id', 'operation', 'model', 'input_tokens', 'output_tokens', 'cost_cents', 'duration_ms', 'timestamp'],
    required_keys: ['correlation_id', 'operation', 'model', 'input_tokens', 'output_tokens', 'cost_cents']
  }
  // ... other event types
};

// Runtime validation with strict allowlist
function validateMetadata(event: string, metadata: Record<string, unknown>): Record<string, unknown> {
  const schema = EVENT_SCHEMAS[event];
  if (!schema) {
    throw new Error(`Unknown event type: ${event}`);
  }

  const validated: Record<string, unknown> = {};

  // Only include allowed keys
  for (const key of schema.allowed_keys) {
    if (key in metadata) {
      validated[key] = metadata[key];
    }
  }

  // Ensure required keys are present
  for (const key of schema.required_keys) {
    if (!(key in validated)) {
      throw new Error(`Missing required key '${key}' for event '${event}'`);
    }
  }

  // Reject any keys not in allowlist
  const extraKeys = Object.keys(metadata).filter(k => !schema.allowed_keys.includes(k));
  if (extraKeys.length > 0) {
    logger.warn('Rejected disallowed keys in metadata', { event, rejected_keys: extraKeys });
  }

  return validated;
}
```

**Example**:
```typescript
logger.info('Message sanitized', {
  correlation_id: '01HQZX...',
  conversation_id: '01HQZY...',
  message_id: '01HQZZ...',
  role: 'user',
  content_length: 1247,
  redaction_count: 3,
  duration_ms: 42
});
```

#### Correlation IDs and Context Propagation

**Purpose**: Trace requests across components

**Implementation**:
- Generate ULID **once** at hook entry point using `AsyncLocalStorage`
- Automatically propagate through all downstream calls without manual passing
- Include in all log entries and metrics for the request
- Enables end-to-end tracing: hook → queue → worker → API → storage
- Support nested spans with `parent_span_id` for detailed tracing

**AsyncLocalStorage Pattern**:
```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  correlation_id: string;
  parent_span_id?: string;
  operation?: string;
}

const correlationContext = new AsyncLocalStorage<RequestContext>();

// Set correlation context at hook entry
export function withCorrelation<T>(fn: () => T): T {
  const context: RequestContext = {
    correlation_id: ulid()
  };
  return correlationContext.run(context, fn);
}

// Retrieve correlation ID anywhere without passing through signatures
export function getCorrelationId(): string | undefined {
  return correlationContext.getStore()?.correlation_id;
}

// Usage in hook
export const onMessage = withCorrelation((message) => {
  logger.info('Message received', {
    correlation_id: getCorrelationId(), // Automatically available
    message_id: message.id
  });
  // All downstream calls automatically have access to correlation_id
});
```

**Example flow**:
```
correlation_id: 01HQZX...
  ├─ [hook] Message received (0ms)
  ├─ [hook] Pre-sanitization complete (42ms)
  ├─ [hook] Persisted to messages table (58ms)
  ├─ [worker] AI validation started (1.2s)
  ├─ [worker] Claude API call complete (2.8s)
  └─ [worker] Sanitization log updated (2.85s)
```

#### Metrics Storage

**Local-Only by Default**:
- Store in SQLite: `metrics.db`
- **Encryption**: Use SQLCipher or OS-level encryption for privacy
- **File Permissions**: Create with mode 0600 (owner-only read/write)
- **Storage Location**: OS-specific app data directory
  - macOS: `~/Library/Application Support/gcn/metrics.db`
  - Linux: `~/.local/share/gcn/metrics.db`
  - Windows: `%APPDATA%\gcn\metrics.db`

- **Retention Policy**: Auto-prune logs after 30 days (configurable)
- Schema:
  ```sql
  CREATE TABLE performance_metrics (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    component TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    value REAL NOT NULL,
    tags TEXT,  -- JSON object (low-cardinality only)
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_metrics_component_time
    ON performance_metrics(component, timestamp);

  -- Logs table with retention
  CREATE TABLE logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    component TEXT NOT NULL,
    event TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    metadata TEXT,  -- JSON object, validated against allowlist
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_logs_correlation
    ON logs(correlation_id);
  CREATE INDEX idx_logs_timestamp
    ON logs(timestamp);
  ```

**SQLite Configuration for Performance**:
```typescript
// Pragmas for <5ms impact target
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('temp_store = MEMORY');

// Batch log writes every 100ms
const logBatchQueue: LogEntry[] = [];
setInterval(() => {
  if (logBatchQueue.length > 0) {
    const batch = [...logBatchQueue];
    logBatchQueue.length = 0;

    const insert = db.prepare(`
      INSERT INTO logs (id, timestamp, level, component, event, correlation_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((entries: LogEntry[]) => {
      for (const entry of entries) {
        insert.run(
          ulid(),
          entry.timestamp,
          entry.level,
          entry.component,
          entry.event,
          entry.correlation_id,
          JSON.stringify(entry.metadata)
        );
      }
    });

    insertMany(batch);
  }
}, 100);
```

**Retention and Compaction**:
```typescript
// Daily cleanup job
function pruneOldLogs(db: Database.Database, retentionDays: number = 30): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  db.prepare('DELETE FROM logs WHERE timestamp < ?').run(cutoffDate.toISOString());
  db.prepare('DELETE FROM performance_metrics WHERE timestamp < ?').run(cutoffDate.toISOString());

  // Compact database
  db.pragma('vacuum');
  db.pragma('optimize');
}

// Run daily at 3 AM
schedule.daily('03:00', () => pruneOldLogs(db));
```

**Opt-In Anonymous Sharing**:
- User must explicitly enable in config
- Only aggregate metrics (no correlation IDs, no logs)
- Future: Upload to privacy-preserving analytics service
- MVP: Local-only (no sharing implemented)

### 2. Service Level Objectives (SLOs)

Enforced SLOs from [STANDARDS.md Section 12](../STANDARDS.md#12-performance-budgets):

| Component | SLO (p95) | Measurement Point | Alerting Threshold |
|-----------|-----------|-------------------|-------------------|
| Hook execution | <100ms | Event received → DB persist complete | >110ms for 5 consecutive events |
| Fast sanitization | <50ms | Pre-sanitization regex execution | >60ms for 5 consecutive events |
| Database writes | <20ms | WAL insert operation | >25ms for 10 consecutive writes |
| Database queries | <100ms | MCP query handler (search + serialize) | >120ms for 5 consecutive queries |
| MCP queries | <200ms | MCP request received → response sent | >220ms for 5 consecutive requests |
| AI sanitization | <2s | Claude API call for validation | >2.5s for 3 consecutive calls |
| Learning extraction | <5s | Claude API call for insights | >6s for 3 consecutive calls |

#### SLO Tracking

**Instrumentation**:
```typescript
import { performance } from 'node:perf_hooks';

// Sliding-window percentile tracking
class SlidingWindowTracker {
  private windows = new Map<string, number[]>();
  private readonly windowSize = 1000; // Last 1000 samples
  private readonly maxWindowDuration = 3600_000; // 1 hour in ms

  record(operation: string, durationMs: number): void {
    const key = operation;
    if (!this.windows.has(key)) {
      this.windows.set(key, []);
    }
    const window = this.windows.get(key)!;
    window.push(durationMs);

    // Keep only last N samples
    if (window.length > this.windowSize) {
      window.shift();
    }
  }

  getPercentiles(operation: string): { p50: number; p95: number; p99: number } | null {
    const window = this.windows.get(operation);
    if (!window || window.length === 0) return null;

    const sorted = [...window].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { p50, p95, p99 };
  }

  checkSLOViolation(operation: string, sloThresholdMs: number): boolean {
    const percentiles = this.getPercentiles(operation);
    return percentiles ? percentiles.p95 > sloThresholdMs : false;
  }
}

const sloTracker = new SlidingWindowTracker();

async function trackPerformance<T>(
  component: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const correlationId = getCorrelationId(); // Use AsyncLocalStorage context
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    // Record in sliding window
    const operationKey = `${component}.${operation}`;
    sloTracker.record(operationKey, duration);

    // Record raw metric for reporting
    metrics.record({
      component,
      metric: `${operation}_duration_ms`,
      value: duration,
      correlation_id: correlationId
    });

    // Check SLO violation based on p95 across sliding window
    const slo = SLO_THRESHOLDS[component][operation];
    const percentiles = sloTracker.getPercentiles(operationKey);

    if (percentiles && percentiles.p95 > slo) {
      logger.warn('SLO p95 violation', {
        component,
        operation,
        current_duration_ms: duration,
        window_p50: percentiles.p50,
        window_p95: percentiles.p95,
        window_p99: percentiles.p99,
        slo_ms: slo,
        correlation_id: correlationId
      });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error('Operation failed', {
      component,
      operation,
      duration_ms: duration,
      error: error.message,
      correlation_id: correlationId
    });
    throw error;
  }
}
```

**SLO Reporting**:
- Sliding-window percentiles (p50, p95, p99) computed over last 1000 samples or 1 hour
- Daily summary aggregates for each component/operation
- Percentile-based violation detection (not single-call warnings)
- Per-component breakdown with trend analysis
- Stored in local metrics database with periodic aggregates

### 3. Cost Management

#### LLM API Budget Controls

**Budget Structure** (Integer Cents Schema):
```typescript
interface CostBudget {
  daily_limit_cents: number;      // Integer cents to avoid float drift
  monthly_limit_cents: number;
  per_operation_limit_cents: number;
  current_daily_spend_cents: number;
  current_monthly_spend_cents: number;
  budget_period_start: string;    // ISO-8601
  last_reset_timestamp: string;   // ISO-8601, for startup reconciliation
}
```

**SQLite Schema**:
```sql
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY,
  period TEXT NOT NULL,                    -- 'daily' | 'monthly'
  daily_limit_cents INTEGER NOT NULL,
  monthly_limit_cents INTEGER NOT NULL,
  per_operation_limit_cents INTEGER NOT NULL,
  current_daily_spend_cents INTEGER NOT NULL DEFAULT 0,
  current_monthly_spend_cents INTEGER NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL,              -- ISO-8601
  last_reset_timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_call_metrics (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  operation TEXT NOT NULL,                 -- 'sanitization' | 'learning'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd_cents INTEGER NOT NULL,         -- Integer cents
  correlation_id TEXT,
  status TEXT NOT NULL,                    -- 'success' | 'error' | 'cancelled'
  estimated_cost_cents INTEGER,            -- Pre-call estimation
  idempotency_key TEXT UNIQUE,             -- For retry safety
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_calls_operation_time
  ON api_call_metrics(operation, timestamp);
CREATE INDEX idx_api_calls_correlation
  ON api_call_metrics(correlation_id);
CREATE INDEX idx_api_calls_idempotency
  ON api_call_metrics(idempotency_key);
```

**Default Budgets (MVP)**:
```typescript
const DEFAULT_BUDGETS = {
  daily_limit_cents: 500,          // $5.00 - Conservative for MVP
  monthly_limit_cents: 10000,      // $100.00 - ~20 days of full usage
  per_operation_limit_cents: 50,   // $0.50 - Safety per API call
  sanitization_per_call_cents: 10, // $0.10 - ~1000 tokens avg
  learning_per_call_cents: 25      // $0.25 - ~2500 tokens avg
};
```

#### Cost Tracking and Pre-Call Estimation

**Per-Operation Metering**:
```typescript
interface ApiCallMetrics {
  operation: 'sanitization' | 'learning';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd_cents: number;  // Integer cents
  timestamp: string;
  correlation_id: string;
  estimated_cost_cents: number;  // Pre-call estimation
  idempotency_key: string;       // correlation_id-derived for retry safety
  status: 'success' | 'error' | 'cancelled';
}
```

**Model-Aware Pricing Configuration**:
```typescript
// Pricing per model (versioned, with last updated timestamp)
interface ModelPricing {
  model: string;
  input_per_mtok_cents: number;   // Integer cents per million input tokens
  output_per_mtok_cents: number;  // Integer cents per million output tokens
  last_updated: string;           // ISO-8601
  version: string;
}

const PRICING_CONFIG: ModelPricing[] = [
  {
    model: 'claude-sonnet-4-5',
    input_per_mtok_cents: 300,    // $3.00 per million input tokens
    output_per_mtok_cents: 1500,  // $15.00 per million output tokens
    last_updated: '2025-01-16',
    version: '1.0'
  }
  // Support multiple models and hot reload
];

function getPricing(model: string): ModelPricing {
  const pricing = PRICING_CONFIG.find(p => p.model === model);
  if (!pricing) {
    throw new Error(`No pricing configured for model: ${model}`);
  }
  return pricing;
}
```

**Pre-Call Cost Estimation**:
```typescript
function estimateTokens(content: string, operation: 'sanitization' | 'learning'): {
  input: number;
  output: number;
} {
  // Rough estimation: 1 token ≈ 4 characters
  const contentTokens = Math.ceil(content.length / 4);

  // Add system prompt tokens based on operation
  const systemPromptTokens = operation === 'sanitization' ? 200 : 500;
  const inputTokens = contentTokens + systemPromptTokens;

  // Estimate output tokens based on operation
  const outputTokens = operation === 'sanitization'
    ? Math.ceil(contentTokens * 1.1)  // Similar length + small additions
    : Math.ceil(contentTokens * 0.3); // Summary/insights

  return { input: inputTokens, output: outputTokens };
}

function calculateCost(input: number, output: number, model: string): number {
  const pricing = getPricing(model);
  const inputCostCents = Math.ceil((input / 1_000_000) * pricing.input_per_mtok_cents);
  const outputCostCents = Math.ceil((output / 1_000_000) * pricing.output_per_mtok_cents);
  return inputCostCents + outputCostCents;
}
```

**Atomic Budget Reservation with Pre-Call Enforcement**:
```typescript
import Database from 'better-sqlite3';

async function enforceApiCallBudget(
  db: Database.Database,
  operation: 'sanitization' | 'learning',
  content: string,
  model: string
): Promise<{ estimatedCostCents: number; idempotencyKey: string }> {
  // Estimate cost before API call
  const { input, output } = estimateTokens(content, operation);
  const estimatedCostCents = calculateCost(input, output, model);

  // Generate idempotency key from correlation ID
  const correlationId = getCorrelationId();
  const idempotencyKey = `${correlationId}-${operation}`;

  // Atomic budget reservation in transaction
  const reservation = db.transaction(() => {
    // Check for idempotent retry
    const existing = db.prepare(
      'SELECT cost_usd_cents, status FROM api_call_metrics WHERE idempotency_key = ?'
    ).get(idempotencyKey);

    if (existing) {
      // Already processed this call
      if (existing.status === 'success') {
        throw new Error('Request already processed successfully');
      }
      // Allow retry for errors
      return { estimatedCostCents: existing.cost_usd_cents, idempotencyKey };
    }

    // Load current budget
    const budget = db.prepare('SELECT * FROM budgets WHERE id = 1').get() as CostBudget;

    // Check if adding estimated cost exceeds limits
    if (budget.current_daily_spend_cents + estimatedCostCents > budget.daily_limit_cents) {
      throw new BudgetExceededError('Daily budget would be exceeded');
    }

    if (budget.current_monthly_spend_cents + estimatedCostCents > budget.monthly_limit_cents) {
      throw new BudgetExceededError('Monthly budget would be exceeded');
    }

    if (estimatedCostCents > budget.per_operation_limit_cents) {
      throw new BudgetExceededError('Per-operation budget would be exceeded');
    }

    // Reserve estimated budget atomically (BEGIN IMMEDIATE transaction)
    db.prepare(`
      UPDATE budgets
      SET current_daily_spend_cents = current_daily_spend_cents + ?,
          current_monthly_spend_cents = current_monthly_spend_cents + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(estimatedCostCents, estimatedCostCents);

    // Record reservation
    db.prepare(`
      INSERT INTO api_call_metrics (
        id, timestamp, operation, model, input_tokens, output_tokens,
        cost_usd_cents, correlation_id, status, estimated_cost_cents, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?)
    `).run(
      ulid(),
      new Date().toISOString(),
      operation,
      model,
      input,
      output,
      estimatedCostCents,
      correlationId,
      estimatedCostCents,
      idempotencyKey
    );

    return { estimatedCostCents, idempotencyKey };
  })();

  return reservation;
}

// Post-call reconciliation
async function reconcileApiCallCost(
  db: Database.Database,
  idempotencyKey: string,
  actualInputTokens: number,
  actualOutputTokens: number,
  model: string,
  status: 'success' | 'error'
): Promise<void> {
  const actualCostCents = calculateCost(actualInputTokens, actualOutputTokens, model);

  db.transaction(() => {
    const record = db.prepare(
      'SELECT estimated_cost_cents FROM api_call_metrics WHERE idempotency_key = ?'
    ).get(idempotencyKey) as { estimated_cost_cents: number };

    const deltaCents = actualCostCents - record.estimated_cost_cents;

    // Update actual cost
    db.prepare(`
      UPDATE api_call_metrics
      SET input_tokens = ?,
          output_tokens = ?,
          cost_usd_cents = ?,
          status = ?
      WHERE idempotency_key = ?
    `).run(actualInputTokens, actualOutputTokens, actualCostCents, status, idempotencyKey);

    // Adjust budget for delta (credit if overestimated, debit if underestimated)
    db.prepare(`
      UPDATE budgets
      SET current_daily_spend_cents = current_daily_spend_cents + ?,
          current_monthly_spend_cents = current_monthly_spend_cents + ?
      WHERE id = 1
    `).run(deltaCents, deltaCents);
  })();
}
```

#### Graceful Degradation and Privacy Safeguards

When budget is exhausted:

**Sanitization**:
- Fall back to **rules-only mode** (regex pre-sanitization)
- Skip AI validation
- Log budget exhaustion event
- User notification: "AI-enhanced sanitization paused (budget limit)"
- **Privacy safeguard**: Continue using strict static rules

**Learning Extraction**:
- Queue jobs as `paused` status
- Do not call Claude API
- Resume when budget resets (daily/monthly)
- User notification: "Learning extraction paused (budget limit)"
- **Privacy safeguard for decentralized uploads**:
  - When AI validation is disabled, hold uploads to decentralized network
  - Require manual approval OR pass stricter static policy (whitelist patterns)
  - Only allow uploads that pass high-confidence static analysis
  - Prevent privacy risk from unvalidated content reaching network

**Budget Reset with Clock Skew Handling**:
- Daily: Reset at midnight UTC
- Monthly: Reset on 1st of month
- **Startup reconciliation**: Check if reset should have occurred during downtime
- **Persist reset timestamps**: Track `last_reset_timestamp` in budgets table
- **Dry-run projection**: CLI command to project daily cost based on current usage
- User can manually increase limits via config

**Budget Notification Thresholds**:
```typescript
const BUDGET_WARNING_THRESHOLDS = [0.80, 0.90, 1.00]; // 80%, 90%, 100%

function checkBudgetWarnings(budget: CostBudget): void {
  const dailyUsage = budget.current_daily_spend_cents / budget.daily_limit_cents;
  const monthlyUsage = budget.current_monthly_spend_cents / budget.monthly_limit_cents;

  for (const threshold of BUDGET_WARNING_THRESHOLDS) {
    if (dailyUsage >= threshold && !hasNotified('daily', threshold)) {
      notify(`Daily budget ${threshold * 100}% exhausted`);
      markNotified('daily', threshold);
    }
    if (monthlyUsage >= threshold && !hasNotified('monthly', threshold)) {
      notify(`Monthly budget ${threshold * 100}% exhausted`);
      markNotified('monthly', threshold);
    }
  }
}
```

### 4. Telemetry Implementation

#### Logger Interface

```typescript
interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

// Privacy-aware implementation with allowlist validation
class PrivacyLogger implements Logger {
  constructor(
    private storage: LogStorage,
    private sanitizer: ContentSanitizer
  ) {}

  private validateAndSanitizeMetadata(
    event: string,
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    // Apply allowlist validation
    const validated = validateMetadata(event, metadata);

    // Additional sanitization for content fields (if opted-in)
    if ('content' in validated && typeof validated.content === 'string') {
      validated.content = this.sanitizer.sanitize(validated.content);
      validated.sanitization_version = '1.0'; // Track transform version
    }

    return validated;
  }

  info(event: string, metadata?: Record<string, unknown>): void {
    const correlationId = getCorrelationId(); // From AsyncLocalStorage

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      component: correlationContext.getStore()?.component || 'unknown',
      event,
      correlation_id: correlationId || ulid(),
      metadata: this.validateAndSanitizeMetadata(event, metadata || {})
    };

    // Add to batch queue (flushed every 100ms)
    logBatchQueue.push(entry);
  }

  // ... other levels
}

// HTTP client redaction wrapper
class RedactedHttpClient {
  private redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

    for (const key of sensitiveKeys) {
      if (key.toLowerCase() in redacted) {
        redacted[key] = '[REDACTED]';
      }
    }

    return redacted;
  }

  private redactUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Redact query parameters that might contain sensitive data
      parsed.search = parsed.search ? '[REDACTED]' : '';
      return parsed.toString();
    } catch {
      return '[INVALID_URL]';
    }
  }

  async request(url: string, options: RequestInit): Promise<Response> {
    logger.debug('http_request', {
      url: this.redactUrl(url),
      method: options.method || 'GET',
      headers: this.redactSensitiveHeaders(options.headers as Record<string, string>)
    });

    return fetch(url, options);
  }
}
```

#### Metrics Interface

```typescript
interface Metrics {
  record(metric: MetricEntry): void;
  query(filter: MetricFilter): MetricEntry[];
  getSLOReport(component: string, duration: string): SLOReport;
}

interface MetricEntry {
  component: string;
  metric: string;
  value: number;
  timestamp?: string;  // Auto-generated if omitted
  tags?: Record<string, string>;
  correlation_id?: string;
}

interface SLOReport {
  component: string;
  period: { start: string; end: string };
  metrics: {
    operation: string;
    slo_ms: number;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    violation_count: number;
    total_count: number;
  }[];
}
```

### 5. Operational Dashboard (Future)

**MVP**: CLI-based queries with content redaction by default
```bash
# View SLO compliance
gcn metrics slo --component hook --period 7d

# View cost summary
gcn metrics cost --period month

# View correlation trace (content redacted by default)
gcn trace 01HQZX...

# View trace with sanitized content (requires explicit flag + confirmation)
gcn trace 01HQZX... --include-content
# Prompt: "This will display sanitized content. Continue? (y/N)"

# Export metrics (never includes content by default)
gcn metrics export --format csv --output metrics.csv

# Dry-run cost projection
gcn metrics cost --dry-run --period day
```

**CLI Safety Rules**:
- **Default behavior**: Redact all content fields from output
- **Explicit opt-in**: Require `--include-content` flag for sanitized content
- **Interactive confirmation**: Prompt user in interactive sessions
- **Never raw content**: Even with flags, only show sanitized content
- **Audit trail**: Log when content is viewed via CLI

**Post-MVP**: Local web UI (privacy-safe, runs on localhost)

## Alternatives Considered

### Alternative 1: No Telemetry

**Pros**:
- Zero privacy risk
- Simplest implementation

**Cons**:
- Impossible to debug production issues
- No SLO compliance visibility
- Cannot detect cost overruns
- Cannot optimize performance

**Rejected**: Operational blindness is unacceptable for production system

### Alternative 2: Always-On Cloud Telemetry

**Pros**:
- Centralized monitoring
- Cross-user insights
- Professional tooling (Datadog, New Relic, etc.)

**Cons**:
- Privacy concerns (even with sanitization)
- Cost (monthly SaaS fees)
- External dependency
- Against "local-first" principle

**Rejected**: Conflicts with privacy-first architecture

### Alternative 3: OpenTelemetry Standard

**Pros**:
- Industry standard
- Rich ecosystem
- Future interoperability

**Cons**:
- Overkill for MVP
- Complex setup
- Large dependency footprint

**Deferred**: Consider post-MVP for standardization

## Consequences

### Positive

1. **Cost control**: Budget caps prevent runaway spending
2. **SLO compliance**: Measurable performance guarantees
3. **Privacy-safe**: No PII in telemetry by design
4. **Debuggability**: Correlation IDs enable end-to-end tracing
5. **User trust**: Local-first, opt-in sharing respects privacy
6. **Graceful degradation**: System remains functional when budget exhausted
7. **Operational visibility**: Can identify and fix bottlenecks

### Negative

1. **Implementation overhead**: Additional code for tracking
2. **Storage cost**: Metrics database grows over time (mitigated by retention policy)
3. **Performance impact**: Logging adds ~1-5ms per operation (acceptable)
4. **Complexity**: More moving parts to test and maintain

### Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Metrics database grows unbounded | Implement 30-day retention policy with auto-pruning |
| Logging impacts hook performance | Async log writes; batch to disk every 100ms |
| Budget limits too restrictive | User-configurable; clear notifications when limits hit |
| PII leaks into logs | Sanitize all metadata; automated canary tests |
| Cost calculation drift from actual | Periodic reconciliation with Anthropic billing API |

## Operational Runbook

### Database Management

#### Rotate and Compact Databases
```bash
# Manual rotation (creates backup with timestamp)
gcn db rotate --backup

# Compact and optimize
gcn db compact

# This performs:
# 1. VACUUM to reclaim space
# 2. PRAGMA optimize
# 3. Rebuild indices
# 4. Update statistics
```

#### Backup and Restore
```bash
# Backup all databases
gcn db backup --output ~/backups/gcn-$(date +%Y%m%d).tar.gz

# Backup includes:
# - metrics.db (performance metrics, logs)
# - budgets.db (cost tracking)
# - conversations.db (sanitized messages)

# Restore from backup
gcn db restore --input ~/backups/gcn-20250116.tar.gz

# Verify backup integrity
gcn db verify --backup ~/backups/gcn-20250116.tar.gz
```

#### Handle Corrupt Database
```bash
# Detect corruption
gcn db check

# Attempt auto-recovery
gcn db recover --auto

# Manual recovery steps:
# 1. Stop all GCN processes
# 2. Create backup of corrupt database
cp metrics.db metrics.db.corrupt.$(date +%Y%m%d)

# 3. Export salvageable data
sqlite3 metrics.db ".dump" > metrics_dump.sql

# 4. Create new database from dump
sqlite3 metrics_new.db < metrics_dump.sql

# 5. Replace corrupt database
mv metrics_new.db metrics.db

# 6. Restart GCN
gcn start
```

#### Schema Migration
```bash
# Check current schema version
gcn db version

# Apply pending migrations
gcn db migrate

# Rollback last migration
gcn db migrate --rollback

# Migration safety:
# - Always create backup before migration
# - Migrations are transactional
# - Rollback support for all migrations
```

### Budget and Cost Management

#### Reset Budgets
```bash
# Manual daily reset
gcn budget reset --period daily

# Manual monthly reset
gcn budget reset --period monthly

# View current budget status
gcn budget status

# Output:
# Daily: $3.47 / $5.00 (69%)
# Monthly: $47.23 / $100.00 (47%)
# Next reset: 2025-01-17 00:00:00 UTC
```

#### Adjust Budget Limits
```bash
# Increase daily limit
gcn budget set --daily 10.00

# Increase monthly limit
gcn budget set --monthly 200.00

# Set per-operation limit
gcn budget set --per-operation 1.00

# Config file location:
# ~/.config/gcn/budget.json
```

### Queue Management

#### Inspect Stuck Queues
```bash
# View queue status
gcn queue status

# Output:
# Sanitization queue: 3 pending, 0 processing, 12 completed
# Learning queue: 47 pending (paused: budget limit), 0 processing, 8 completed

# View stuck jobs (processing > 5 minutes)
gcn queue stuck

# Retry stuck jobs
gcn queue retry --job-id 01HQZX...

# Clear failed jobs
gcn queue clear --status failed
```

#### Resume Paused Queues
```bash
# Resume learning extraction (after budget reset)
gcn queue resume --type learning

# Process specific job
gcn queue process --job-id 01HQZX...
```

### Debugging and Diagnostics

#### Enable Debug Logging
```bash
# Enable debug logging (session-only)
gcn debug enable

# Enable with content logging (requires confirmation)
gcn debug enable --include-content
# Prompt: "This will log sanitized content. Continue? (y/N)"

# Disable debug logging
gcn debug disable

# View debug logs
gcn logs --level debug --tail 100
```

#### Trace Request Flow
```bash
# Trace correlation ID end-to-end
gcn trace 01HQZX... --verbose

# Output:
# correlation_id: 01HQZX...
#   [hook] Message received (0ms)
#   [hook] Pre-sanitization complete (42ms)
#   [hook] Persisted to messages table (58ms)
#   [worker] AI validation started (1.2s)
#   [worker] Claude API call complete (2.8s)
#   [worker] Sanitization log updated (2.85s)
# Total duration: 2.85s
```

#### Check SLO Violations
```bash
# View recent violations
gcn slo violations --period 24h

# View component breakdown
gcn slo violations --component hook --period 7d

# View percentile trends
gcn slo trends --component worker --operation ai_sanitization
```

### Recovery Procedures

#### Recover from Budget Overrun
```bash
# If budget was exceeded due to race condition:

# 1. Check actual spend
gcn budget status --detailed

# 2. Reconcile with Anthropic billing (manual)
# Compare gcn spend with Anthropic dashboard

# 3. Adjust budget if needed
gcn budget set --monthly 150.00

# 4. Resume queues
gcn queue resume --all
```

#### Recover from Worker Crash
```bash
# 1. Check worker status
gcn workers status

# 2. View crash logs
gcn logs --component worker --level error --tail 50

# 3. Restart workers
gcn workers restart

# 4. Retry failed jobs
gcn queue retry --status failed
```

#### Recover from Disk Full
```bash
# 1. Check database sizes
gcn db size

# 2. Prune old logs manually
gcn logs prune --older-than 7d

# 3. Compact databases
gcn db compact

# 4. Move databases to larger volume (if needed)
gcn db relocate --path /mnt/large-volume/gcn

# 5. Update config with new location
# Edit ~/.config/gcn/config.json
```

### Performance Monitoring

#### Check Performance Impact
```bash
# View hook execution overhead
gcn metrics overhead --component hook --period 24h

# Target: <5ms p95 overhead
# If exceeded, check:
# 1. Batch logging queue size
# 2. Database write latency
# 3. Disk I/O saturation
```

#### Benchmark Database Operations
```bash
# Run performance benchmark
gcn db benchmark

# Output:
# Insert (single): 0.8ms p95
# Insert (batch 100): 12ms p95
# Query (correlation_id): 3.2ms p95
# Query (timestamp range): 45ms p95
```

## Implementation Plan

### Phase 1: Core Telemetry (Week 1)
- [ ] Implement `PrivacyLogger` with SQLite storage and allowlist validation
- [ ] Add AsyncLocalStorage for correlation ID propagation
- [ ] Implement sliding-window percentile tracking
- [ ] Instrument hooks with performance tracking
- [ ] Add encryption and file permissions

### Phase 2: Cost Tracking (Week 2)
- [ ] Implement integer cents schema and concrete tables
- [ ] Add pre-call cost estimation
- [ ] Implement atomic budget reservations with transactions
- [ ] Add idempotency keys and retry handling
- [ ] Implement graceful degradation with privacy safeguards

### Phase 3: Reporting (Week 3)
- [ ] Implement CLI commands with content redaction
- [ ] Add SLO compliance reports with percentiles
- [ ] Add cost summaries and dry-run projections
- [ ] Implement correlation trace viewer
- [ ] Add budget warning thresholds

### Phase 4: Operations and Automation (Week 4)
- [ ] Add automated retention and compaction
- [ ] Implement database backup/restore
- [ ] Create queue management commands
- [ ] Add recovery procedures
- [ ] Document operational runbook
- [ ] Add performance benchmarks

## Acceptance Criteria

- [ ] All SLOs tracked using sliding-window percentiles (p50, p95, p99)
- [ ] AsyncLocalStorage propagates correlation IDs automatically
- [ ] Allowlist-based event schemas prevent PII leaks (verified by canary tests)
- [ ] Integer cents schema prevents floating-point drift
- [ ] Pre-call cost estimation prevents budget overruns
- [ ] Atomic budget reservations handle concurrent workers
- [ ] Idempotency keys prevent double-billing on retries
- [ ] Budget enforcement with 80%/90%/100% warning thresholds
- [ ] Graceful degradation with privacy safeguards for decentralized uploads
- [ ] CLI redacts content by default, requires --include-content flag
- [ ] SQLite encrypted (SQLCipher) or OS-level encryption enforced
- [ ] File permissions set to 0600 (owner-only)
- [ ] 30-day retention with automated pruning and compaction
- [ ] Performance impact <5ms per hook execution (verified by benchmarks)
- [ ] Operational runbook covers backup/restore/recovery procedures
- [ ] HTTP client redacts sensitive headers and URLs
- [ ] Model-aware pricing with version tracking
- [ ] Startup reconciliation handles clock skew for budget resets

## Related Documents

- [STANDARDS.md - Section 12: Performance Budgets](../STANDARDS.md#12-performance-budgets)
- [STANDARDS.md - Section 14: Logging Standards](../STANDARDS.md#14-logging-standards)
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md)
- [Architecture: Hooks & Event Capture](../architecture/architecture-hooks-event-capture-2025-01-16.md)
- [GPT-5 Holistic Review](../reviews/gpt5-holistic-review-2025-01-16.txt)
- [GPT-5 ADR-013 Review](../reviews/gpt5-adr013-review-2025-01-16.txt)
- [Gemini 2.5 Pro Holistic Review](../reviews/gemini-holistic-review-2025-01-16.txt)

## Notes

**Privacy Guarantee**: This ADR maintains the zero-trust PII policy. Telemetry is designed to be privacy-safe by default, with:
- Allowlist-based event schemas (not blocklists)
- AsyncLocalStorage context propagation
- HTTP client redaction wrapper
- CLI content redaction by default
- Encrypted storage with strict file permissions
- 30-day retention with automated cleanup

**Cost Philosophy**: Budgets are intentionally conservative for MVP. Real-world usage will inform appropriate limits. Key safeguards:
- Pre-call cost estimation prevents overruns
- Atomic reservations handle concurrent workers
- Idempotency keys prevent double-billing on retries
- Model-aware pricing with version tracking
- 80%/90%/100% warning thresholds

**SLO Philosophy**: Targets are aspirational but achievable:
- Sliding-window percentiles (not single-call warnings)
- p95 allows for occasional spikes while maintaining good UX
- Measured at app-observable points (not internal DB operations)
- Platform-aware (may need different targets for Windows/slow disks)
- Violations can trigger adaptive throttling or load shedding

**Implementation Notes**:
- SQLite WAL mode with NORMAL synchronous for <5ms impact
- Batch log writes every 100ms to reduce I/O
- Low-cardinality metrics (no correlation_id in time-series)
- In-memory HDR histograms for percentile computation
- Ring buffer fallback if disk unavailable

**GPT-5 Review Integration**: This ADR incorporates all 10 priority fixes from the GPT-5 review (2025-01-16):
1. AsyncLocalStorage for correlation context propagation
2. Sliding-window percentiles for SLO tracking
3. Atomic budget reservations with SQLite transactions
4. Integer cents schema with concrete budgets/api_call_metrics tables
5. Pre-call estimation with abort-on-exceed logic
6. Allowlist validation replacing blocklist approach
7. 30-day retention policies with compaction/vacuuming
8. Encryption guidance (SQLCipher or OS-level)
9. Operational runbook with DB rotation, backup/restore, recovery
10. CLI safety with content redaction by default

**Future Work**:
- Integration with Anthropic billing API for real-time cost tracking
- Predictive budget alerts based on usage trends
- Multi-user cost allocation (post-MVP)
- OpenTelemetry adoption for standardization
- Optional anonymous metric sharing for ecosystem insights
- Automated adaptive throttling on SLO breach
- Model fallback (cheaper models when approaching budget limits)
