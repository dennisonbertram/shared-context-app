# Phase 6: MCP Server Tasks

> Model Context Protocol server for agent queries

---
title: Phase 6 MCP Server Tasks
category: plan
date: 2025-01-16
status: active
tags: [phase-6, mcp, server, query-interface]
---

## Goal

Implement MCP protocol server enabling Claude Code and other agents to query learnings with < 200ms latency.

## Duration

3-4 days

## Tasks

### MCP SDK Integration
- [ ] Install @modelcontextprotocol/sdk
- [ ] Create server configuration
- [ ] Implement server initialization
- [ ] Configure loopback binding (127.0.0.1 only)
- [ ] Add optional API key authentication
- [ ] Test server starts and responds to ping

**Subagent**: `mcp-protocol-agent`

**Acceptance**: MCP server starts and Claude Code can connect

### search_learnings Tool
- [ ] Implement text search across learning content
- [ ] Add category filter (pattern, best_practice, etc.)
- [ ] Add tag filter (multiple tags support)
- [ ] Add confidence threshold filter
- [ ] Implement pagination (limit, offset)
- [ ] Implement sorting (by date, confidence, relevance)
- [ ] Validate input parameters and bounds

**Acceptance**: Search returns relevant learnings < 200ms

### get_learning_by_id Tool
- [ ] Implement fetch learning by ID
- [ ] Return full learning with metadata
- [ ] Handle not found errors gracefully
- [ ] Validate ID format

**Acceptance**: Fetch by ID < 50ms

### get_learning_context Tool
- [ ] Fetch full conversation for a learning
- [ ] Return sanitized conversation messages
- [ ] Include provenance information
- [ ] Handle privacy (only sanitized data)

**Acceptance**: Context retrieval < 200ms

### Resource Endpoints
- [ ] Implement `context://learnings/recent` (latest N learnings)
- [ ] Implement `context://learnings/top-rated` (highest confidence)
- [ ] Implement `context://stats` (total learnings, categories, etc.)
- [ ] Add caching for resource endpoints
- [ ] Document resource schemas

**Acceptance**: Resources load < 100ms

### Authentication & Authorization
- [ ] Implement optional API key authentication
- [ ] Default to localhost-only binding (no auth needed)
- [ ] Add config for enabling auth
- [ ] Reject requests without valid auth (if enabled)
- [ ] Document security model

**Acceptance**: Auth enforced when enabled, bypassed on localhost

### Input Validation
- [ ] Validate all tool parameters
- [ ] Enforce bounds (max limit, offset ranges)
- [ ] Sanitize search queries (prevent injection)
- [ ] Reject malformed requests
- [ ] Return clear error messages

**Acceptance**: Invalid requests rejected gracefully

### Rate Limiting
- [ ] Implement simple rate limiter (N requests per minute)
- [ ] Prevent local DoS scenarios
- [ ] Return 429 Too Many Requests when exceeded
- [ ] Make limits configurable

**Acceptance**: Rate limiting prevents abuse

### Query Optimization
- [ ] Use database indexes for filters
- [ ] Implement result caching for common queries
- [ ] Optimize full-text search queries
- [ ] Test performance with 10k+ learnings
- [ ] Profile slow queries

**Subagent**: `query-optimization-agent`

**Acceptance**: All queries < 200ms on 10k+ dataset

### MCP Protocol Conformance
- [ ] Test against MCP SDK examples
- [ ] Verify tool schemas are valid
- [ ] Verify resource schemas are valid
- [ ] Test error handling conforms to spec
- [ ] Test streaming responses (if applicable)

**Acceptance**: MCP conformance tests pass

## Dependencies

- Phase 5: Learnings to query

## Deliverables

1. MCP server implementation
2. Three query tools (search, get by ID, get context)
3. Three resource endpoints (recent, top-rated, stats)
4. Authentication layer (optional)
5. Rate limiting system
6. Performance benchmarks

## Success Criteria

- ✅ MCP protocol conformance tests pass
- ✅ All queries < 200ms
- ✅ Invalid queries rejected gracefully
- ✅ Auth enforced when enabled
- ✅ Rate limiting prevents abuse
- ✅ Claude Code integration working
- ✅ No data leaks via MCP

## MCP Tools

### search_learnings
```typescript
{
  name: "search_learnings",
  description: "Search for learnings by text, category, or tags",
  inputSchema: {
    query: "string (optional)",
    category: "string (optional)",
    tags: "string[] (optional)",
    minConfidence: "number (optional, default 0.6)",
    limit: "number (optional, default 10, max 100)",
    offset: "number (optional, default 0)"
  }
}
```

### get_learning_by_id
```typescript
{
  name: "get_learning_by_id",
  description: "Fetch a specific learning by ID",
  inputSchema: {
    id: "string (required)"
  }
}
```

### get_learning_context
```typescript
{
  name: "get_learning_context",
  description: "Get full conversation context for a learning",
  inputSchema: {
    learningId: "string (required)"
  }
}
```

## MCP Resources

- `context://learnings/recent`: Latest 50 learnings
- `context://learnings/top-rated`: Top 50 by confidence
- `context://stats`: Network statistics (total, categories, etc.)

## Testing Strategy

- Unit tests for each tool
- Integration tests for MCP protocol
- Performance tests (concurrent queries)
- Security tests (injection, auth bypass)
- Load tests (N concurrent clients)
- Conformance tests against MCP spec

## Related Documents

- [MCP Server Architecture](../architecture/architecture-mcp-server-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
