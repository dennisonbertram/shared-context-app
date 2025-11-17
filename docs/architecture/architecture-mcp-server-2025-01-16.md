# MCP Server Architecture

> Model Context Protocol server for querying learnings from the Global Context Network

---
title: MCP Server Architecture
category: architecture
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [mcp, server, learnings, query, protocol, performance]
applies_to: "@modelcontextprotocol/sdk 1.x, SQLite 3.40+, Node.js 18+"
related_standards: STANDARDS.md (canonical schema, status enums, ULID, performance budgets)
---

## Overview

The MCP (Model Context Protocol) server enables AI agents to query learnings from the Global Context Network. It provides a standardized interface for searching, retrieving, and contextualizing learnings with strict performance guarantees.

### Purpose

**Primary Goal**: Enable agents to discover and retrieve relevant learnings to inform their work.

**Key Requirements**:
- Query learnings via full-text search, filters, and direct lookup
- Serve recent and top-rated learnings as resources
- Maintain <200ms p95 query latency
- Support pagination, sorting, and filtering
- Secure local-only binding with optional auth
- MCP SDK-compliant schemas and responses

### Architecture Context

```
┌─────────────────────────────────────────────────────────┐
│              Claude Code Agent (Client)                  │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol (stdio)
                     ▼
          ┌──────────────────────┐
          │   MCP Server         │
          │  (This Document)     │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  SQLite Database     │
          │  - learnings table   │
          │  - learnings_fts     │
          │  - conversations     │
          │  - messages          │
          └──────────────────────┘
```

**Integration Points**:
- **Input**: Claude Code via MCP SDK client (stdio transport)
- **Output**: Learnings query results, statistics, metadata
- **Storage**: SQLite database (read-only for MCP server)
- **Discovery**: Claude Code auto-discovery via config

---

## MCP Server Implementation

### Server Configuration

**File**: `src/mcp/server.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Database from 'better-sqlite3';
import { LearningRepository } from '../database/repositories/learning-repository.js';
import { ConversationRepository } from '../database/repositories/conversation-repository.js';

export interface MCPServerConfig {
  name: string;
  version: string;
  dbPath: string;
  bindAddress?: string; // Default: '127.0.0.1' (local-only)
  port?: number; // Optional HTTP transport
  authToken?: string; // Optional API key auth
  maxResultsPerQuery?: number; // Default: 100
  enableStats?: boolean; // Default: true
}

export async function createMCPServer(config: MCPServerConfig): Promise<Server> {
  // Initialize database (read-only)
  const db = new Database(config.dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');
  db.pragma('query_only = ON'); // Extra safety: prevent writes

  const learningRepo = new LearningRepository(db);
  const conversationRepo = new ConversationRepository(db);

  // Create MCP server
  const server = new Server(
    {
      name: config.name || 'global-context-learnings',
      version: config.version || '1.0.0'
    },
    {
      capabilities: {
        tools: {}, // Provide tools for querying
        resources: {} // Provide resources for common queries
      }
    }
  );

  // Register handlers
  registerToolHandlers(server, learningRepo, conversationRepo, config);
  registerResourceHandlers(server, learningRepo, config);

  return server;
}
```

### Claude Code Discovery

**File**: `.claude/mcp.json` (auto-discovered by Claude Code)

```json
{
  "mcpServers": {
    "global-context-learnings": {
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {
        "DB_PATH": "./context.db",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Auto-Discovery Process**:
1. Claude Code scans `.claude/mcp.json` on startup
2. Spawns MCP server as child process
3. Establishes stdio transport connection
4. Calls `tools/list` and `resources/list` to discover capabilities
5. Makes tools/resources available to agent

---

## Tools

### 1. search_learnings

**Purpose**: Full-text search across learnings with filters

**Tool Schema**:
```typescript
{
  name: 'search_learnings',
  description: 'Search learnings using full-text search with optional filters. Returns ranked results by relevance and confidence.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (searches title, content, and tags). Supports FTS5 syntax: AND, OR, NOT, "phrases", prefix*'
      },
      category: {
        type: 'string',
        description: 'Filter by category',
        enum: [
          'pattern',
          'best_practice',
          'anti_pattern',
          'bug_fix',
          'optimization',
          'tool_usage',
          'workflow',
          'decision'
        ]
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (AND logic: all tags must match)'
      },
      min_confidence: {
        type: 'number',
        description: 'Minimum confidence score (0.0-1.0)',
        minimum: 0.0,
        maximum: 1.0,
        default: 0.6
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return',
        minimum: 1,
        maximum: 100,
        default: 10
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        minimum: 0,
        default: 0
      }
    },
    required: ['query']
  }
}
```

**Implementation**:
```typescript
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'search_learnings') {
    const startTime = performance.now();

    const {
      query,
      category,
      tags = [],
      min_confidence = 0.6,
      limit = 10,
      offset = 0
    } = args;

    // Validate inputs
    if (!query || typeof query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    if (limit > config.maxResultsPerQuery) {
      throw new Error(`limit exceeds maximum (${config.maxResultsPerQuery})`);
    }

    // Execute search
    const results = learningRepo.search(query, {
      category,
      tags: tags.length > 0 ? tags : undefined,
      minConfidence: min_confidence,
      limit,
      offset
    });

    const duration = performance.now() - startTime;

    // Log performance
    if (duration > 200) {
      console.warn(`[MCP] search_learnings exceeded budget: ${duration.toFixed(2)}ms`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            results: results.map(l => ({
              id: l.id,
              title: l.title,
              category: l.category,
              confidence: l.confidence,
              tags: l.tags,
              created_at: l.created_at,
              excerpt: truncate(l.content, 200)
            })),
            count: results.length,
            query_time_ms: Math.round(duration)
          }, null, 2)
        }
      ]
    };
  }

  // ... other tools
});

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
```

**Example Request**:
```json
{
  "name": "search_learnings",
  "arguments": {
    "query": "typescript testing vitest",
    "category": "best_practice",
    "min_confidence": 0.7,
    "limit": 5
  }
}
```

**Example Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"results\":[{\"id\":\"01HN...\",\"title\":\"Use Vitest for TypeScript Testing\",\"category\":\"best_practice\",\"confidence\":0.85,\"tags\":[\"typescript\",\"testing\",\"vitest\"],\"created_at\":\"2025-01-15T10:30:00.000Z\",\"excerpt\":\"Vitest provides faster test execution than Jest for TypeScript projects...\"}],\"count\":5,\"query_time_ms\":45}"
    }
  ]
}
```

**Performance Optimization**:
```sql
-- FTS5 index (created in migrations)
CREATE VIRTUAL TABLE learnings_fts USING fts5(
  learning_id UNINDEXED,
  title,
  content,
  tags,
  content='learnings',
  content_rowid='rowid'
);

-- Query uses BM25 ranking
SELECT l.*
FROM learnings l
JOIN learnings_fts fts ON l.rowid = fts.rowid
WHERE fts MATCH ?
  AND l.confidence >= ?
  AND (? IS NULL OR l.category = ?)
ORDER BY bm25(fts), l.confidence DESC
LIMIT ? OFFSET ?;
```

**Performance Budget**: <200ms p95

---

### 2. get_learning_by_id

**Purpose**: Retrieve complete learning by ID

**Tool Schema**:
```typescript
{
  name: 'get_learning_by_id',
  description: 'Retrieve a specific learning by its ID. Returns full content and metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Learning ID (ULID format)'
      }
    },
    required: ['id']
  }
}
```

**Implementation**:
```typescript
if (name === 'get_learning_by_id') {
  const startTime = performance.now();
  const { id } = args;

  if (!id || typeof id !== 'string') {
    throw new Error('id must be a non-empty string');
  }

  const learning = learningRepo.findById(id);

  if (!learning) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'Learning not found',
            id
          }, null, 2)
        }
      ],
      isError: true
    };
  }

  const duration = performance.now() - startTime;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          learning: {
            id: learning.id,
            conversation_id: learning.conversation_id,
            source_message_ids: learning.source_message_ids,
            category: learning.category,
            title: learning.title,
            content: learning.content,
            confidence: learning.confidence,
            tags: learning.tags,
            created_at: learning.created_at,
            metadata: learning.metadata
          },
          query_time_ms: Math.round(duration)
        }, null, 2)
      }
    ]
  };
}
```

**Performance Budget**: <50ms p95

---

### 3. get_learning_context

**Purpose**: Retrieve full conversation context for a learning

**Tool Schema**:
```typescript
{
  name: 'get_learning_context',
  description: 'Retrieve the full conversation context that produced a learning. Includes all messages from the source conversation.',
  inputSchema: {
    type: 'object',
    properties: {
      learning_id: {
        type: 'string',
        description: 'Learning ID'
      },
      include_metadata: {
        type: 'boolean',
        description: 'Include conversation and message metadata',
        default: false
      }
    },
    required: ['learning_id']
  }
}
```

**Implementation**:
```typescript
if (name === 'get_learning_context') {
  const startTime = performance.now();
  const { learning_id, include_metadata = false } = args;

  // Get learning
  const learning = learningRepo.findById(learning_id);
  if (!learning) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Learning not found' }) }],
      isError: true
    };
  }

  // Get conversation
  const conversation = conversationRepo.findById(learning.conversation_id);
  if (!conversation) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Conversation not found' }) }],
      isError: true
    };
  }

  // Get messages
  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY sequence ASC
  `).all(learning.conversation_id);

  const duration = performance.now() - startTime;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          learning: {
            id: learning.id,
            title: learning.title,
            category: learning.category
          },
          conversation: include_metadata ? conversation : {
            id: conversation.id,
            created_at: conversation.created_at
          },
          messages: messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            sequence: m.sequence,
            created_at: m.created_at,
            ...(include_metadata && { metadata: JSON.parse(m.metadata || '{}') })
          })),
          query_time_ms: Math.round(duration)
        }, null, 2)
      }
    ]
  };
}
```

**Performance Budget**: <200ms p95

---

## Resources

Resources provide static or computed data that agents can read directly (without parameters).

### Resource Registration

```typescript
function registerResourceHandlers(
  server: Server,
  learningRepo: LearningRepository,
  config: MCPServerConfig
): void {
  // List available resources
  server.setRequestHandler('resources/list', async () => {
    return {
      resources: [
        {
          uri: 'context://learnings/recent',
          name: 'Recent Learnings',
          description: 'Latest 20 learnings ordered by creation time',
          mimeType: 'application/json'
        },
        {
          uri: 'context://learnings/top-rated',
          name: 'Top-Rated Learnings',
          description: 'Top 20 learnings by confidence score',
          mimeType: 'application/json'
        },
        {
          uri: 'context://stats',
          name: 'Network Statistics',
          description: 'Global Context Network statistics',
          mimeType: 'application/json'
        }
      ]
    };
  });

  // Read resource contents
  server.setRequestHandler('resources/read', async (request) => {
    const { uri } = request.params;
    const startTime = performance.now();

    if (uri === 'context://learnings/recent') {
      const learnings = learningRepo.findRecent(20);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              learnings: learnings.map(l => ({
                id: l.id,
                title: l.title,
                category: l.category,
                confidence: l.confidence,
                tags: l.tags,
                created_at: l.created_at,
                excerpt: truncate(l.content, 150)
              })),
              count: learnings.length,
              generated_at: new Date().toISOString(),
              query_time_ms: Math.round(performance.now() - startTime)
            }, null, 2)
          }
        ]
      };
    }

    if (uri === 'context://learnings/top-rated') {
      const learnings = learningRepo.findTopRated(20);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              learnings: learnings.map(l => ({
                id: l.id,
                title: l.title,
                category: l.category,
                confidence: l.confidence,
                tags: l.tags,
                created_at: l.created_at,
                excerpt: truncate(l.content, 150)
              })),
              count: learnings.length,
              generated_at: new Date().toISOString(),
              query_time_ms: Math.round(performance.now() - startTime)
            }, null, 2)
          }
        ]
      };
    }

    if (uri === 'context://stats') {
      if (!config.enableStats) {
        throw new Error('Statistics disabled');
      }

      const stats = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM learnings) as total_learnings,
          (SELECT COUNT(*) FROM conversations) as total_conversations,
          (SELECT COUNT(*) FROM messages) as total_messages,
          (SELECT AVG(confidence) FROM learnings) as avg_confidence,
          (SELECT COUNT(DISTINCT category) FROM learnings) as categories_count,
          (SELECT created_at FROM learnings ORDER BY created_at DESC LIMIT 1) as latest_learning_at
      `).get();

      const categoryBreakdown = db.prepare(`
        SELECT category, COUNT(*) as count
        FROM learnings
        GROUP BY category
        ORDER BY count DESC
      `).all();

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              statistics: stats,
              category_breakdown: categoryBreakdown,
              generated_at: new Date().toISOString(),
              query_time_ms: Math.round(performance.now() - startTime)
            }, null, 2)
          }
        ]
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });
}
```

---

## Query Optimization

### Database Indexes

**Required Indexes** (from STANDARDS.md schema):
```sql
-- learnings table
CREATE INDEX idx_learnings_conversation ON learnings(conversation_id);
CREATE INDEX idx_learnings_category ON learnings(category, confidence DESC);
CREATE INDEX idx_learnings_confidence ON learnings(confidence DESC);
CREATE INDEX idx_learnings_created ON learnings(created_at DESC);
CREATE INDEX idx_learnings_dedupe ON learnings(dedupe_hash);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE learnings_fts USING fts5(
  learning_id UNINDEXED,
  title,
  content,
  tags,
  content='learnings',
  content_rowid='rowid'
);
```

### Query Plans

**Verify with EXPLAIN**:
```typescript
// Verify search_learnings uses FTS index
const plan = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT l.*
  FROM learnings l
  JOIN learnings_fts fts ON l.rowid = fts.rowid
  WHERE fts MATCH ?
    AND l.confidence >= ?
  ORDER BY bm25(fts), l.confidence DESC
  LIMIT ?
`).all('test query', 0.6, 10);

console.log('Query plan:', plan);
// Should show: "SCAN learnings_fts VIRTUAL TABLE INDEX"
```

### Performance Monitoring

```typescript
import { performance } from 'node:perf_hooks';

interface QueryMetrics {
  tool_name: string;
  duration_ms: number;
  result_count: number;
  timestamp: string;
}

const queryMetrics: QueryMetrics[] = [];

function recordQueryMetric(metric: QueryMetrics): void {
  queryMetrics.push(metric);

  // Log slow queries
  if (metric.duration_ms > 200) {
    console.warn(`[MCP] Slow query: ${metric.tool_name} took ${metric.duration_ms.toFixed(2)}ms`);
  }

  // Keep last 1000 metrics
  if (queryMetrics.length > 1000) {
    queryMetrics.shift();
  }
}

// Calculate p95
function getP95Latency(): number {
  if (queryMetrics.length === 0) return 0;

  const sorted = queryMetrics
    .map(m => m.duration_ms)
    .sort((a, b) => a - b);

  const p95Index = Math.floor(sorted.length * 0.95);
  return sorted[p95Index];
}
```

### Tag Filtering Optimization

**Efficient tag AND filtering**:
```typescript
// For tags=['typescript', 'testing'], generate SQL
function buildTagFilter(tags: string[]): { sql: string; params: any[] } {
  if (tags.length === 0) {
    return { sql: '', params: [] };
  }

  // Use JSON array contains checks
  const conditions = tags.map(() => `json_each.value = ?`);
  const sql = `
    AND (
      SELECT COUNT(DISTINCT json_each.value)
      FROM json_each(l.tags)
      WHERE ${conditions.join(' OR ')}
    ) = ?
  `;

  return { sql, params: [...tags, tags.length] };
}

// Usage
const tagFilter = buildTagFilter(tags);
const query = `
  SELECT l.*
  FROM learnings l
  JOIN learnings_fts fts ON l.rowid = fts.rowid
  WHERE fts MATCH ?
    AND l.confidence >= ?
    ${tagFilter.sql}
  ORDER BY bm25(fts), l.confidence DESC
  LIMIT ? OFFSET ?
`;

const results = db.prepare(query).all(
  searchQuery,
  minConfidence,
  ...tagFilter.params,
  limit,
  offset
);
```

---

## Security Model

### Local-Only Binding

**Default**: Bind to `127.0.0.1` only (no network access)

```typescript
export interface MCPServerConfig {
  bindAddress?: string; // Default: '127.0.0.1'
  // ...
}

// Only allow localhost
if (config.bindAddress && config.bindAddress !== '127.0.0.1') {
  throw new Error('Remote binding not allowed in MVP. Use 127.0.0.1 only.');
}
```

### Optional Authentication

**API Key Auth** (for future HTTP transport):
```typescript
function authenticateRequest(authToken: string | undefined, config: MCPServerConfig): void {
  if (!config.authToken) {
    return; // Auth disabled
  }

  if (!authToken || authToken !== config.authToken) {
    throw new Error('Unauthorized: Invalid auth token');
  }
}

// Usage in handlers
server.setRequestHandler('tools/call', async (request) => {
  const authHeader = request.params._meta?.authToken;
  authenticateRequest(authHeader, config);

  // ... process request
});
```

### Read-Only Database

**Prevent writes**:
```typescript
const db = new Database(config.dbPath, {
  readonly: true // Enforces read-only at SQLite level
});

db.pragma('query_only = ON'); // Extra safety
```

### Input Validation

**Sanitize all inputs**:
```typescript
function validateSearchQuery(query: string): void {
  if (query.length > 1000) {
    throw new Error('Query too long (max 1000 characters)');
  }

  // Prevent malicious FTS queries
  const dangerousPatterns = [
    /UNION/i,
    /DROP/i,
    /DELETE/i,
    /INSERT/i,
    /UPDATE/i,
    /;/
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      throw new Error('Invalid query: contains forbidden pattern');
    }
  }
}
```

### Rate Limiting

**Simple token bucket**:
```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens = 100, refillRate = 10) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

const rateLimiter = new RateLimiter(100, 10); // 100 max, 10/sec refill

// Usage
if (!rateLimiter.tryAcquire()) {
  throw new Error('Rate limit exceeded. Try again later.');
}
```

---

## Server Entry Point

**File**: `src/mcp/index.ts`

```typescript
#!/usr/bin/env node
import { createMCPServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';

async function main(): Promise<void> {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'context.db');

  const config = {
    name: 'global-context-learnings',
    version: '1.0.0',
    dbPath,
    bindAddress: '127.0.0.1',
    maxResultsPerQuery: 100,
    enableStats: true
  };

  const server = await createMCPServer(config);

  // Use stdio transport for Claude Code
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Global Context Learnings server started');
  console.error('[MCP] Database:', dbPath);
  console.error('[MCP] Listening on stdio...');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
```

**Build and Run**:
```bash
# Compile TypeScript
npx tsc src/mcp/index.ts --outDir dist/mcp

# Run server
node dist/mcp/index.js

# Or via npm script
npm run mcp:start
```

---

## Testing Strategy

### Unit Tests

**Test tool handlers**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMCPServer } from '../src/mcp/server.js';
import Database from 'better-sqlite3';

describe('MCP Server - search_learnings', () => {
  let db: Database.Database;
  let server: Server;

  beforeEach(async () => {
    // In-memory database with test data
    db = new Database(':memory:');

    // Run migrations
    await runMigrations(db);

    // Seed test data
    db.prepare(`
      INSERT INTO learnings (id, conversation_id, category, title, content, confidence, tags, dedupe_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test-learning-1',
      'test-conv-1',
      'best_practice',
      'Use Vitest for TypeScript',
      'Vitest is faster than Jest for TypeScript projects...',
      0.85,
      JSON.stringify(['typescript', 'testing', 'vitest']),
      'dedupe-hash-1'
    );

    // Create FTS entry
    db.prepare(`
      INSERT INTO learnings_fts (rowid, learning_id, title, content, tags)
      SELECT rowid, id, title, content, tags FROM learnings WHERE id = ?
    `).run('test-learning-1');

    server = await createMCPServer({
      name: 'test-server',
      version: '1.0.0',
      dbPath: ':memory:',
      db // Pass in-memory db for testing
    });
  });

  it('should search learnings by query', async () => {
    const result = await server.callTool('search_learnings', {
      query: 'vitest typescript',
      min_confidence: 0.8,
      limit: 10
    });

    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].title).toBe('Use Vitest for TypeScript');
    expect(data.query_time_ms).toBeLessThan(200);
  });

  it('should filter by category', async () => {
    const result = await server.callTool('search_learnings', {
      query: 'typescript',
      category: 'best_practice',
      limit: 10
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.results.every((r: any) => r.category === 'best_practice')).toBe(true);
  });

  it('should filter by tags', async () => {
    const result = await server.callTool('search_learnings', {
      query: 'testing',
      tags: ['typescript', 'vitest'],
      limit: 10
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.results[0].tags).toContain('typescript');
    expect(data.results[0].tags).toContain('vitest');
  });

  it('should enforce pagination', async () => {
    // Seed 30 learnings
    for (let i = 0; i < 30; i++) {
      // ... insert learnings
    }

    const page1 = await server.callTool('search_learnings', {
      query: 'test',
      limit: 10,
      offset: 0
    });

    const page2 = await server.callTool('search_learnings', {
      query: 'test',
      limit: 10,
      offset: 10
    });

    const data1 = JSON.parse(page1.content[0].text);
    const data2 = JSON.parse(page2.content[0].text);

    expect(data1.results).toHaveLength(10);
    expect(data2.results).toHaveLength(10);
    expect(data1.results[0].id).not.toBe(data2.results[0].id);
  });

  it('should meet performance budget (<200ms)', async () => {
    const start = performance.now();

    await server.callTool('search_learnings', {
      query: 'vitest',
      limit: 10
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });
});
```

### Integration Tests

**Test with real Claude Code client**:
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

describe('MCP Server - Integration', () => {
  it('should connect and query via stdio', async () => {
    // Spawn MCP server
    const serverProcess = spawn('node', ['./dist/mcp/index.js'], {
      env: { DB_PATH: './test-fixtures/test.db' }
    });

    // Create client
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['./dist/mcp/index.js'],
      env: { DB_PATH: './test-fixtures/test.db' }
    });

    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);

    // List tools
    const tools = await client.listTools();
    expect(tools.tools.some(t => t.name === 'search_learnings')).toBe(true);

    // Call tool
    const result = await client.callTool('search_learnings', {
      query: 'test',
      limit: 5
    });

    expect(result.content[0].type).toBe('text');

    // Cleanup
    await client.close();
    serverProcess.kill();
  });
});
```

### Performance Tests

**Load testing**:
```typescript
import { performance } from 'node:perf_hooks';

describe('MCP Server - Performance', () => {
  it('should handle 100 concurrent queries', async () => {
    const queries = Array(100).fill(null).map((_, i) =>
      server.callTool('search_learnings', {
        query: `test query ${i}`,
        limit: 10
      })
    );

    const start = performance.now();
    const results = await Promise.all(queries);
    const duration = performance.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(5000); // 100 queries in <5s
  });

  it('should maintain p95 latency <200ms under load', async () => {
    const latencies: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const start = performance.now();

      await server.callTool('search_learnings', {
        query: 'typescript testing',
        limit: 10
      });

      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    expect(p95).toBeLessThan(200);
  });
});
```

---

## Deployment

### Package.json Scripts

```json
{
  "scripts": {
    "mcp:build": "tsc src/mcp/index.ts --outDir dist/mcp",
    "mcp:start": "node dist/mcp/index.js",
    "mcp:dev": "tsx watch src/mcp/index.ts",
    "mcp:test": "vitest run src/mcp/**/*.test.ts"
  }
}
```

### Claude Code Configuration

**File**: `.claude/mcp.json`

```json
{
  "mcpServers": {
    "global-context-learnings": {
      "command": "node",
      "args": ["./dist/mcp/index.js"],
      "env": {
        "DB_PATH": "./context.db",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Monitoring

**Health check endpoint** (future HTTP transport):
```typescript
app.get('/health', (req, res) => {
  const isHealthy = db.prepare('SELECT 1').get();

  res.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    uptime_seconds: process.uptime(),
    p95_latency_ms: getP95Latency(),
    total_queries: queryMetrics.length
  });
});
```

---

## Performance Budget Summary

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| search_learnings | <200ms p95 | FTS5 query + filters + serialization |
| get_learning_by_id | <50ms p95 | Primary key lookup |
| get_learning_context | <200ms p95 | Join + messages fetch |
| Resource reads | <100ms p95 | Indexed queries |
| Server startup | <1s | Database connection + index load |

---

## Related Documents

### Standards
- [STANDARDS.md](../STANDARDS.md) - Canonical schema, status enums, ULID, performance budgets

### Architecture
- [Global Context Network](./architecture-global-context-network-2025-01-16.md) - System overview
- [Database Schema](../reference/reference-database-schema-2025-01-16.md) - learnings table, FTS5 indexes

### Reference
- [Claude Agent SDK API](../reference/reference-claude-agent-sdk-api-2025-01-16.md) - MCP integration patterns

### Guides
- [Phase 6 Tasks](../plans/plan-phase-6-tasks-2025-01-16.md) - MCP server implementation tasks

---

## Appendix: MCP SDK Compliance

### Tools Schema Compliance

**Required Fields**:
- `name`: Tool identifier (kebab-case)
- `description`: Human-readable description
- `inputSchema`: JSON Schema (draft-07)

**Example**:
```typescript
{
  name: 'search_learnings',
  description: 'Search learnings using full-text search',
  inputSchema: {
    type: 'object',
    properties: { /* ... */ },
    required: ['query']
  }
}
```

### Resources Schema Compliance

**Required Fields**:
- `uri`: Unique resource identifier (custom scheme)
- `name`: Human-readable name
- `description`: Resource description
- `mimeType`: Content type (e.g., 'application/json')

**Example**:
```typescript
{
  uri: 'context://learnings/recent',
  name: 'Recent Learnings',
  description: 'Latest 20 learnings',
  mimeType: 'application/json'
}
```

### Response Format

**Tool Call Response**:
```typescript
{
  content: [
    {
      type: 'text',
      text: '{"results": [...]}' // JSON string
    }
  ],
  isError?: boolean // Optional error flag
}
```

**Resource Read Response**:
```typescript
{
  contents: [
    {
      uri: 'context://learnings/recent',
      mimeType: 'application/json',
      text: '{"learnings": [...]}'
    }
  ]
}
```

---

**Document Status**: Active - Implementation-ready with complete schemas, performance plans, and security model

**Next Steps**:
1. Get external review (GPT-5) to validate MCP SDK compliance
2. Implement server.ts with tool and resource handlers
3. Add comprehensive tests (unit, integration, performance)
4. Validate <200ms p95 latency with real database
5. Document Claude Code discovery integration
