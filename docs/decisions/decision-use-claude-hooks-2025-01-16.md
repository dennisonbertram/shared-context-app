---
title: ADR-001: Use Claude Code Hooks for Event Capture
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [hooks, event-capture, claude-code, privacy]
---

# ADR-001: Use Claude Code Hooks for Event Capture

## Status

Accepted

Date: 2025-01-16

## Context

The Global Context Network needs to capture user prompts and agent responses to extract learnings. This capture must:

1. **Never block user interaction** - UX constraint of p95 < 100ms
2. **Minimize data surface area pre-sanitization** - Privacy-first architecture
3. **Capture complete conversations** - User prompts, agent responses, tool calls
4. **Preserve context** - Conversation flow, timestamps, metadata
5. **Be reliable** - No missed events, persist across restarts

The capture point must happen as close to the source as possible to ensure sanitization occurs before data spreads through the system.

## Decision

Use Claude Code's native hook system (UserPromptSubmit and Stop hooks) for event capture.

**Implementation**:
- Configure hooks via `.claude/hooks.json`
- UserPromptSubmit hook captures user input
- Stop hook captures agent responses and tool calls
- Events queued to persistent storage < 50ms
- Fire-and-forget with bounded ring buffer
- Explicit user opt-in per project

**Performance SLOs**:
- Hook execution p95 < 100ms
- Event queueing < 50ms
- Timeout after 100ms to prevent blocking
- Bounded ring buffer (max 1000 events) for backpressure

## Consequences

### Positive

- **Non-blocking capture** - Hooks execute asynchronously, never block user
- **Source-level access** - Captures data before it spreads through system
- **Complete conversation context** - Access to full prompt/response pairs
- **Native integration** - Uses Claude Code's supported APIs
- **Minimal data surface area** - Sanitization can happen immediately after capture
- **Tool call visibility** - Captures all tool invocations and results
- **Privacy-preserving** - Nothing persisted until sanitization passes

### Negative

- **Vendor lock-in** - Tightly coupled to Claude Code
- **API stability risk** - Hook contract may change between versions
- **Configuration overhead** - Requires hooks.json setup
- **Limited portability** - Can't easily switch to other AI coding tools
- **Versioning complexity** - Need to handle hook schema changes

### Neutral

- **Per-project opt-in** - Users must explicitly enable per project
- **Requires configuration** - Not zero-config out of the box
- **Event schema versioning** - Must track hook versions for compatibility

## Alternatives Considered

### Alternative 1: IDE/LSP Plugin Instrumentation

**Description**: Build VS Code extension that captures prompts/responses via Language Server Protocol.

**Pros**:
- Not tied to Claude Code specifically
- Could work with multiple AI coding tools
- More portable across editors

**Cons**:
- Higher latency (>100ms) due to additional layers
- Can't capture internal state or tool calls
- More complex setup and maintenance
- Delayed capture point (data already spread)

**Why not chosen**: Higher latency violates UX constraints, and delayed capture point increases PII surface area before sanitization.

### Alternative 2: Export APIs (Periodic Batch Export)

**Description**: Export conversations periodically via Claude Code's export functionality.

**Pros**:
- Simpler integration
- No runtime performance impact
- Decoupled from real-time execution

**Cons**:
- No real-time capture
- Missing intermediate states
- Can't capture ongoing conversations
- User must remember to export
- Higher PII risk (longer time before sanitization)

**Why not chosen**: Fails to meet "never lose data" requirement and delays sanitization dangerously.

### Alternative 3: HTTP/SOCKS Proxy with MITM

**Description**: Intercept HTTP traffic between Claude Code and Anthropic API.

**Pros**:
- Tool-agnostic
- Complete capture of API traffic

**Cons**:
- Not viable with certificate pinning
- Breaks E2E encryption
- Complex setup
- Security risk
- Can't capture local tool calls

**Why not chosen**: Security concerns and incompatible with Claude Code's implementation.

### Alternative 4: Manual Logging

**Description**: Users manually trigger capture via commands.

**Pros**:
- Simple implementation
- Full user control

**Cons**:
- Error-prone (users forget)
- Incomplete coverage
- Poor UX
- Not suitable for automated learning extraction

**Why not chosen**: Unreliable, defeats purpose of automated learning extraction.

### Alternative 5: File System Watchers

**Description**: Watch Claude Code's conversation storage files.

**Pros**:
- No Claude Code integration needed
- Simple implementation

**Cons**:
- Too late (data already persisted)
- Can't capture thinking/tool calls
- Depends on undocumented file formats
- Brittle to Claude Code updates
- Misses pre-sanitization window

**Why not chosen**: Violates privacy-first principle (capture happens after persistence).

## Implementation

### Hook Configuration

```json
{
  "hooks": {
    "UserPromptSubmit": {
      "command": "node",
      "args": [".claude/hooks/capture-prompt.js"],
      "timeout": 100
    },
    "Stop": {
      "command": "node",
      "args": [".claude/hooks/capture-response.js"],
      "timeout": 100
    }
  }
}
```

### Event Schema

Define canonical event model versioned for compatibility:

```typescript
interface CapturedEvent {
  version: "1.0";
  timestamp: string; // ISO8601
  type: "UserPromptSubmit" | "Stop";
  conversationId: string;
  clientVersion: string;

  // UserPromptSubmit fields
  prompt?: string;

  // Stop fields
  response?: string;
  toolCalls?: ToolCall[];

  // Metadata
  redactionStatus: "pending" | "sanitized" | "failed";
  hookVersion: string;
}
```

### Consent and Scope

- **Explicit opt-in** - Per-project .claude/hooks.json must be created
- **Guard rails** - Nothing persisted until sanitization passes
- **User control** - Users can disable hooks at any time
- **Transparency** - Clear documentation of what's captured

### Performance Safeguards

- **Timeout enforcement** - 100ms hard limit
- **Ring buffer** - Bounded queue (1000 events max)
- **Backpressure handling** - Drop oldest events if overwhelmed
- **Offline mode** - Queue persists, flushes when online
- **Sampling** - Can reduce capture rate if system overloaded

### Observability

Privacy-safe counters (no PII logged):

```typescript
{
  eventsCaptures: number;
  eventsDropped: number;
  eventsSanitized: number;
  eventsFailed: number;
  averageHookLatency: number;
  p95HookLatency: number;
}
```

### Compatibility and Versioning

- **Hook contract documentation** - Events, fields, versions tracked
- **Version detection** - Check Claude Code version on startup
- **Fallback strategy** - Graceful degradation if hooks unavailable
- **Migration plan** - Handle schema changes across versions

### What We Do NOT Capture

**CRITICAL: Chain-of-thought prohibition**

- **Do NOT capture hidden chain-of-thought** - Violates provider policies
- **Only capture observable outputs** - User-visible responses only
- **Only capture tool calls** - Structured, user-approved actions
- **Only capture explicit rationales** - If model emits them publicly

This aligns with Anthropic's usage policies and prevents compliance risks.

## Risks and Mitigations

### Risk: Hook API Changes

**Impact**: High - Could break capture entirely

**Mitigation**:
- Version detection on startup
- Graceful degradation if unsupported
- Test against multiple Claude Code versions
- Monitor Claude Code release notes

### Risk: Performance Degradation

**Impact**: High - Could block users

**Mitigation**:
- Hard 100ms timeout
- Ring buffer prevents unbounded growth
- Monitoring of p95 latency
- Circuit breaker if latency spikes

### Risk: Incomplete Capture

**Impact**: Medium - Missing events reduces learning quality

**Mitigation**:
- Persistent queue survives restarts
- Retry failed events
- Alert on high drop rate
- Audit trail of dropped events

## Related Documents

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Event Capture System](../architecture/architecture-hooks-event-capture-2025-01-16.md)

### Decisions
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md)
- [ADR-006: Async Processing Model](./decision-async-processing-model-2025-01-16.md)

### Plans
- [Phase 1: Event Capture](../plans/plan-phase-1-event-capture-2025-01-16.md)

### Reference
- [Event Schema Reference](../reference/reference-event-schema-2025-01-16.md)
