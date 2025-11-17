# Event Schema Reference

> Complete reference for Claude Code hook event schemas with sanitized content and versioning

---
title: Event Schema Reference
category: reference
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [schema, events, hooks, validation, sanitization, versioning]
---

## Overview

This document defines the canonical event schemas for Claude Code hooks. All events capture user-agent interactions with **sanitized content only** (never raw content), include schema versioning, and use ULID for identifiers per [STANDARDS.md](../STANDARDS.md).

**CRITICAL Privacy Guarantee**: All content fields contain **sanitized content only**. Raw content is never persisted to disk per [ADR-004](../decisions/decision-sanitize-before-storage-2025-01-16.md).

## Core Principles

1. **Sanitized-Only Content**: All `content` fields MUST contain sanitized data (PII redacted)
2. **No Chain-of-Thought**: Internal LLM reasoning is never captured
3. **Schema Versioning**: Every event includes `schema_version` for evolution
4. **ULID Identifiers**: All IDs use ULID (chronologically sortable)
5. **ISO-8601 Timestamps**: All timestamps in UTC with `Z` suffix
6. **Canonical Status Enums**: Use `queued`, `in_progress`, `completed`, `failed`, `dead_letter`

## Event Types

### UserPromptSubmit Event

Captures user input when submitted to Claude Code (before processing).

**When triggered**: User presses Enter to submit prompt
**Hook name**: `UserPromptSubmit`
**Performance budget**: <100ms p95

#### TypeScript Interface (v1.0.0)

```typescript
interface UserPromptSubmitEvent {
  // Versioning
  schema_version: "1.0.0";
  event_type: "UserPromptSubmit";

  // Identity
  event_id: string;              // ULID - Unique event identifier
  conversation_id: string;       // ULID - Stable conversation identifier
  message_id: string;            // ULID - Unique message identifier
  session_id: string;            // ULID - Claude Code session ID

  // Content (SANITIZED ONLY - never raw)
  role: "user";
  content: string;               // MUST be sanitized before persistence
  attachments?: Attachment[];    // File attachments (paths sanitized)

  // Metadata
  sequence: number;              // Order within conversation (1-indexed)
  project_id?: string;           // Project identifier (if available)
  timestamp: string;             // ISO-8601 UTC (e.g., "2025-01-16T12:00:00.000Z")

  // Client information
  client_version: string;        // Claude Code version (e.g., "1.2.3")

  // Processing status
  sanitization_applied: boolean; // True if content was sanitized
  sanitization_rules_version: string; // Sanitization policy version (e.g., "1.0.0")
}

interface Attachment {
  name: string;                  // Original filename
  path: string;                  // SANITIZED path (no usernames)
  mime_type: string;             // MIME type (e.g., "image/png")
  size: number;                  // File size in bytes
}
```

#### JSON Schema (v1.0.0)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/UserPromptSubmit/1.0.0",
  "title": "UserPromptSubmit Event Schema v1.0.0",
  "type": "object",
  "required": [
    "schema_version",
    "event_type",
    "event_id",
    "conversation_id",
    "message_id",
    "session_id",
    "role",
    "content",
    "sequence",
    "timestamp",
    "client_version",
    "sanitization_applied",
    "sanitization_rules_version"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0.0",
      "description": "Schema version for validation routing"
    },
    "event_type": {
      "const": "UserPromptSubmit",
      "description": "Event type discriminator"
    },
    "event_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$",
      "description": "ULID for this event"
    },
    "conversation_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$",
      "description": "ULID grouping related messages"
    },
    "message_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$",
      "description": "ULID for this message"
    },
    "session_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$",
      "description": "ULID for Claude Code session"
    },
    "role": {
      "const": "user",
      "description": "Message role (always 'user' for UserPromptSubmit)"
    },
    "content": {
      "type": "string",
      "minLength": 1,
      "description": "SANITIZED user prompt (PII redacted)"
    },
    "attachments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "path", "mime_type", "size"],
        "properties": {
          "name": {
            "type": "string",
            "description": "Original filename"
          },
          "path": {
            "type": "string",
            "description": "Sanitized file path"
          },
          "mime_type": {
            "type": "string",
            "description": "MIME type"
          },
          "size": {
            "type": "number",
            "minimum": 0,
            "description": "File size in bytes"
          }
        },
        "additionalProperties": false
      },
      "description": "File attachments (optional)"
    },
    "sequence": {
      "type": "integer",
      "minimum": 1,
      "description": "Message order within conversation"
    },
    "project_id": {
      "type": "string",
      "description": "Project identifier (optional)"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO-8601 UTC timestamp"
    },
    "client_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$",
      "description": "Semantic version of Claude Code client"
    },
    "sanitization_applied": {
      "type": "boolean",
      "description": "True if content was sanitized"
    },
    "sanitization_rules_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$",
      "description": "Sanitization policy version"
    }
  },
  "additionalProperties": false
}
```

#### Example Payload (v1.0.0)

```json
{
  "schema_version": "1.0.0",
  "event_type": "UserPromptSubmit",
  "event_id": "01HQZX3K5M4P2QRSTVWXYZ1234",
  "conversation_id": "01HQZX1A2B3C4D5E6F7G8H9J0K",
  "message_id": "01HQZX3K5M4P2QRSTVWXYZ5678",
  "session_id": "01HQZW9X8Y7Z6A5B4C3D2E1F0G",
  "role": "user",
  "content": "Create a function to validate [REDACTED_EMAIL] addresses in [REDACTED_PATH]",
  "attachments": [
    {
      "name": "example.ts",
      "path": "[REDACTED_PATH]/example.ts",
      "mime_type": "text/plain",
      "size": 1024
    }
  ],
  "sequence": 1,
  "project_id": "my-project",
  "timestamp": "2025-01-16T12:00:00.000Z",
  "client_version": "1.2.3",
  "sanitization_applied": true,
  "sanitization_rules_version": "1.0.0"
}
```

**Note**: Content shows `[REDACTED_EMAIL]` and `[REDACTED_PATH]` placeholders where PII was removed by pre-sanitization.

---

### Stop Event

Captures assistant response when completed.

**When triggered**: Claude finishes processing and returns response
**Hook name**: `Stop`
**Performance budget**: <100ms p95

#### TypeScript Interface (v1.0.0)

```typescript
interface StopEvent {
  // Versioning
  schema_version: "1.0.0";
  event_type: "Stop";

  // Identity
  event_id: string;              // ULID - Unique event identifier
  conversation_id: string;       // ULID - Stable conversation identifier
  message_id: string;            // ULID - Unique message identifier
  session_id: string;            // ULID - Claude Code session ID

  // Content (SANITIZED ONLY - never raw)
  role: "assistant";
  content: string;               // MUST be sanitized before persistence
  tool_calls?: ToolCall[];       // Tool invocations (sanitized)

  // Metadata
  sequence: number;              // Order within conversation (1-indexed)
  project_id?: string;           // Project identifier (if available)
  timestamp: string;             // ISO-8601 UTC

  // Client information
  client_version: string;        // Claude Code version

  // Processing status
  sanitization_applied: boolean; // True if content was sanitized
  sanitization_rules_version: string; // Sanitization policy version

  // Response metadata
  finish_reason?: "stop" | "length" | "tool_use" | "error";
  model?: string;                // Model identifier (e.g., "claude-sonnet-4")
}

interface ToolCall {
  tool_name: string;             // Tool identifier (e.g., "Read", "Bash")
  tool_input: Record<string, unknown>; // SANITIZED input parameters
  tool_output?: string;          // SANITIZED output (if available)
  status: "pending" | "success" | "error";
  error?: string;                // Error message (if status === "error")
}
```

#### JSON Schema (v1.0.0)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/Stop/1.0.0",
  "title": "Stop Event Schema v1.0.0",
  "type": "object",
  "required": [
    "schema_version",
    "event_type",
    "event_id",
    "conversation_id",
    "message_id",
    "session_id",
    "role",
    "content",
    "sequence",
    "timestamp",
    "client_version",
    "sanitization_applied",
    "sanitization_rules_version"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0.0"
    },
    "event_type": {
      "const": "Stop"
    },
    "event_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "conversation_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "message_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "session_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "role": {
      "const": "assistant"
    },
    "content": {
      "type": "string",
      "description": "SANITIZED assistant response"
    },
    "tool_calls": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["tool_name", "tool_input", "status"],
        "properties": {
          "tool_name": {
            "type": "string",
            "description": "Tool identifier"
          },
          "tool_input": {
            "type": "object",
            "description": "Sanitized tool input parameters"
          },
          "tool_output": {
            "type": "string",
            "description": "Sanitized tool output"
          },
          "status": {
            "enum": ["pending", "success", "error"],
            "description": "Tool execution status"
          },
          "error": {
            "type": "string",
            "description": "Error message if status is error"
          }
        },
        "additionalProperties": false
      }
    },
    "sequence": {
      "type": "integer",
      "minimum": 1
    },
    "project_id": {
      "type": "string"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "client_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "sanitization_applied": {
      "type": "boolean"
    },
    "sanitization_rules_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "finish_reason": {
      "enum": ["stop", "length", "tool_use", "error"],
      "description": "Why the response ended"
    },
    "model": {
      "type": "string",
      "description": "Model identifier"
    }
  },
  "additionalProperties": false
}
```

#### Example Payload (v1.0.0)

```json
{
  "schema_version": "1.0.0",
  "event_type": "Stop",
  "event_id": "01HQZX4M6N7O8P9Q0R1S2T3U4V",
  "conversation_id": "01HQZX1A2B3C4D5E6F7G8H9J0K",
  "message_id": "01HQZX4M6N7O8P9Q0R1S2T9999",
  "session_id": "01HQZW9X8Y7Z6A5B4C3D2E1F0G",
  "role": "assistant",
  "content": "I'll create a function to validate email addresses. Let me read the file first.",
  "tool_calls": [
    {
      "tool_name": "Read",
      "tool_input": {
        "file_path": "[REDACTED_PATH]/example.ts"
      },
      "tool_output": "// File contents (sanitized)",
      "status": "success"
    },
    {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": "[REDACTED_PATH]/example.ts",
        "old_string": "// TODO",
        "new_string": "function validateEmail(email: string): boolean { /* ... */ }"
      },
      "status": "success"
    }
  ],
  "sequence": 2,
  "project_id": "my-project",
  "timestamp": "2025-01-16T12:00:05.000Z",
  "client_version": "1.2.3",
  "sanitization_applied": true,
  "sanitization_rules_version": "1.0.0",
  "finish_reason": "stop",
  "model": "claude-sonnet-4"
}
```

**Note**: Tool input/output paths are sanitized. Content shows visible assistant response only (no chain-of-thought).

---

## Schema Versioning

All events follow [ADR-012 Schema Versioning Strategy](../decisions/decision-data-model-schema-versioning-2025-01-16.md).

### Version Format

**Semantic versioning**: `MAJOR.MINOR.PATCH`

- **Major** (2.0.0): Breaking changes (removed fields, incompatible types)
- **Minor** (1.1.0): Backward-compatible additions (new optional fields)
- **Patch** (1.0.1): Bug fixes, documentation (no schema changes)

### Compatibility Rules

- **Backward compatible**: Servers MUST accept older minor versions (v1.1.0 server accepts v1.0.0 events)
- **No forward compatibility**: Older servers MAY reject newer minor versions (v1.0.0 server rejects v1.1.0 events)
- **Cross-major incompatible**: v2.x servers MUST reject v1.x events

### Schema Registry

All schemas stored in centralized registry:

```typescript
// src/schemas/registry.ts
import { JSONSchema7 } from "json-schema";

export const SCHEMA_REGISTRY: Record<string, Record<string, JSONSchema7>> = {
  "UserPromptSubmit": {
    "1.0.0": userPromptSubmitSchemaV1_0_0,
    "1.1.0": userPromptSubmitSchemaV1_1_0  // Future version
  },
  "Stop": {
    "1.0.0": stopSchemaV1_0_0
  }
};

export function getSchema(eventType: string, version: string): JSONSchema7 {
  const eventSchemas = SCHEMA_REGISTRY[eventType];
  if (!eventSchemas) {
    throw new Error(`Unknown event type: ${eventType}`);
  }

  const schema = eventSchemas[version];
  if (!schema) {
    throw new Error(`Unknown schema version ${version} for event ${eventType}`);
  }

  return schema;
}

export function getSupportedVersions(eventType: string): string[] {
  const eventSchemas = SCHEMA_REGISTRY[eventType];
  return eventSchemas ? Object.keys(eventSchemas).sort() : [];
}
```

---

## Content Sanitization

**CRITICAL**: All `content` fields MUST be sanitized before persistence. This is enforced in hook handlers before writing to database.

### Sanitization Process

```typescript
// Hook execution flow (fast pre-sanitization)
async function handleUserPromptSubmit(rawEvent: unknown) {
  const start = performance.now();

  try {
    // 1. Parse raw event
    const parsed = JSON.parse(await readStdin());

    // 2. SANITIZE IMMEDIATELY (< 50ms budget)
    const sanitizedContent = preSanitizeSync(parsed.content);
    const sanitizedAttachments = sanitizeAttachments(parsed.attachments);

    // 3. Build sanitized event
    const event: UserPromptSubmitEvent = {
      schema_version: "1.0.0",
      event_type: "UserPromptSubmit",
      event_id: ulid(),
      conversation_id: getOrCreateConversationId(parsed.session_id),
      message_id: ulid(),
      session_id: parsed.session_id,
      role: "user",
      content: sanitizedContent,  // SANITIZED (never raw)
      attachments: sanitizedAttachments,
      sequence: getNextSequence(conversationId),
      timestamp: new Date().toISOString(),
      client_version: parsed.client_version || "unknown",
      sanitization_applied: true,
      sanitization_rules_version: "1.0.0"
    };

    // 4. Validate against schema
    validateEvent(event);

    // 5. Persist ONLY sanitized content to database
    await persistToMessages(event);

    const duration = performance.now() - start;
    if (duration > 100) {
      console.warn(`Hook exceeded budget: ${duration}ms`);
    }

  } catch (error) {
    // NEVER throw - fail silently with logging
    console.error("Hook error:", error);
  }

  // Always exit successfully
  process.exit(0);
}
```

### Sanitization Rules (v1.0.0)

Fast rule-based redaction (<50ms budget):

1. **API Keys**: `sk-[a-zA-Z0-9]+` → `[REDACTED_API_KEY]`
2. **Absolute Paths**: `/Users/username/...` → `[REDACTED_PATH]/...`
3. **Email Addresses**: `user@domain.com` → `[REDACTED_EMAIL]`
4. **IP Addresses**: `192.168.1.1` → `[REDACTED_IP]`
5. **Phone Numbers**: `(555) 123-4567` → `[REDACTED_PHONE]`
6. **URLs with Tokens**: `?token=abc123` → `?token=[REDACTED]`
7. **JWT Tokens**: `eyJ...` (Base64 JWT pattern) → `[REDACTED_JWT]`
8. **Environment Variables**: `export SECRET=...` → `export SECRET=[REDACTED]`
9. **SSH Keys**: `-----BEGIN PRIVATE KEY-----` → `[REDACTED_SSH_KEY]`
10. **Credit Cards**: `4111-1111-1111-1111` → `[REDACTED_CC]`

**See**: [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md) for complete rules.

### Sanitization Metadata

Events track sanitization status:

```typescript
{
  "sanitization_applied": true,      // Was content sanitized?
  "sanitization_rules_version": "1.0.0"  // Which policy version?
}
```

Optional: Log sanitization events to `sanitization_log` table for audit trail.

---

## Validation

### Runtime Validation

Use Ajv with JSON Schema:

```typescript
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { getSchema } from "./schemas/registry";

// Initialize Ajv (required for date-time format in Ajv v8+)
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

/**
 * Validate event against exact schema version
 * Throws if validation fails
 */
function validateEvent(event: unknown): asserts event is UserPromptSubmitEvent | StopEvent {
  if (typeof event !== "object" || event === null) {
    throw new Error("Event must be an object");
  }

  const versionedEvent = event as { schema_version?: string; event_type?: string };
  const { schema_version, event_type } = versionedEvent;

  if (!schema_version || !event_type) {
    throw new Error("Event missing schema_version or event_type");
  }

  // Get exact schema from registry
  const schema = getSchema(event_type, schema_version);
  const validate = ajv.compile(schema);

  if (!validate(event)) {
    const errors = ajv.errorsText(validate.errors);
    throw new Error(`Schema validation failed: ${errors}`);
  }
}
```

### Type Guards

TypeScript type guards for runtime safety:

```typescript
function isUserPromptSubmitEvent(event: unknown): event is UserPromptSubmitEvent {
  try {
    validateEvent(event);
    return (event as any).event_type === "UserPromptSubmit";
  } catch {
    return false;
  }
}

function isStopEvent(event: unknown): event is StopEvent {
  try {
    validateEvent(event);
    return (event as any).event_type === "Stop";
  } catch {
    return false;
  }
}
```

---

## Common Fields

All events share these base fields:

```typescript
interface BaseEvent {
  // Versioning (REQUIRED)
  schema_version: string;        // Semantic version (e.g., "1.0.0")
  event_type: string;            // Event discriminator (e.g., "UserPromptSubmit")

  // Identity (REQUIRED - all ULIDs)
  event_id: string;              // Unique event identifier
  conversation_id: string;       // Groups related messages
  message_id: string;            // Unique message identifier
  session_id: string;            // Claude Code session

  // Content (REQUIRED)
  role: "user" | "assistant";
  content: string;               // SANITIZED ONLY (never raw)

  // Metadata (REQUIRED)
  sequence: number;              // Message order (1-indexed)
  timestamp: string;             // ISO-8601 UTC
  client_version: string;        // Claude Code version

  // Sanitization (REQUIRED)
  sanitization_applied: boolean;
  sanitization_rules_version: string;

  // Optional
  project_id?: string;
}
```

### Field Constraints

| Field | Type | Validation | Example |
|-------|------|------------|---------|
| `schema_version` | string | Semantic version regex | `"1.0.0"` |
| `event_id` | string | ULID pattern (26 chars) | `"01HQZX3K5M4P2QRSTVWXYZ1234"` |
| `conversation_id` | string | ULID pattern | `"01HQZX1A2B3C4D5E6F7G8H9J0K"` |
| `message_id` | string | ULID pattern | `"01HQZX3K5M4P2QRSTVWXYZ5678"` |
| `session_id` | string | ULID pattern | `"01HQZW9X8Y7Z6A5B4C3D2E1F0G"` |
| `role` | enum | `"user"` or `"assistant"` | `"user"` |
| `content` | string | Non-empty, sanitized | `"Create a function..."` |
| `sequence` | integer | ≥ 1 | `1` |
| `timestamp` | string | ISO-8601 date-time | `"2025-01-16T12:00:00.000Z"` |
| `client_version` | string | Semantic version | `"1.2.3"` |
| `sanitization_rules_version` | string | Semantic version | `"1.0.0"` |

---

## Tool Call Events

Tool invocations are embedded in `Stop` events via `tool_calls` array.

### Tool Call Schema

```typescript
interface ToolCall {
  tool_name: string;             // Tool identifier (e.g., "Read", "Bash", "Edit")
  tool_input: Record<string, unknown>; // SANITIZED input parameters
  tool_output?: string;          // SANITIZED output (if available)
  status: "pending" | "success" | "error";
  error?: string;                // Error message (if status === "error")
}
```

### Common Tool Examples

#### Read Tool

```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "[REDACTED_PATH]/example.ts"
  },
  "tool_output": "// File contents (sanitized)",
  "status": "success"
}
```

#### Edit Tool

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "[REDACTED_PATH]/example.ts",
    "old_string": "// TODO",
    "new_string": "function validateEmail(email: string): boolean { /* ... */ }"
  },
  "status": "success"
}
```

#### Bash Tool

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "tool_output": "PASS src/validation.test.ts\n✓ validates email addresses (5 ms)",
  "status": "success"
}
```

#### Bash Tool (Error)

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "status": "error",
  "error": "Command failed with exit code 1"
}
```

**Note**: All file paths in tool calls are sanitized. Tool output is also sanitized to remove PII.

---

## File Operation Events

File operations (Read, Write, Edit) are captured via tool calls in `Stop` events.

### Read Operation

```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "[REDACTED_PATH]/src/utils.ts"
  },
  "tool_output": "export function sanitize(text: string): string { /* ... */ }",
  "status": "success"
}
```

### Write Operation

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "[REDACTED_PATH]/src/validation.ts",
    "content": "export function validateEmail(email: string): boolean { /* ... */ }"
  },
  "status": "success"
}
```

### Edit Operation

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "[REDACTED_PATH]/src/utils.ts",
    "old_string": "// TODO: implement",
    "new_string": "return text.replace(/sensitive/g, '[REDACTED]');"
  },
  "status": "success"
}
```

### Glob Operation

```json
{
  "tool_name": "Glob",
  "tool_input": {
    "pattern": "**/*.ts"
  },
  "tool_output": "[REDACTED_PATH]/src/utils.ts\n[REDACTED_PATH]/src/validation.ts",
  "status": "success"
}
```

**Privacy note**: All file paths are sanitized to remove usernames. File contents are sanitized to remove PII.

---

## Example Conversations

### Simple Request-Response

**Turn 1: User prompt**
```json
{
  "schema_version": "1.0.0",
  "event_type": "UserPromptSubmit",
  "event_id": "01HQZX3K5M4P2QRSTVWXYZ0001",
  "conversation_id": "01HQZX1A2B3C4D5E6F7G8H9J0K",
  "message_id": "01HQZX3K5M4P2QRSTVWXYZ0001",
  "session_id": "01HQZW9X8Y7Z6A5B4C3D2E1F0G",
  "role": "user",
  "content": "What is the capital of France?",
  "sequence": 1,
  "timestamp": "2025-01-16T12:00:00.000Z",
  "client_version": "1.2.3",
  "sanitization_applied": false,
  "sanitization_rules_version": "1.0.0"
}
```

**Turn 2: Assistant response**
```json
{
  "schema_version": "1.0.0",
  "event_type": "Stop",
  "event_id": "01HQZX4M6N7O8P9Q0R1S2T0002",
  "conversation_id": "01HQZX1A2B3C4D5E6F7G8H9J0K",
  "message_id": "01HQZX4M6N7O8P9Q0R1S2T0002",
  "session_id": "01HQZW9X8Y7Z6A5B4C3D2E1F0G",
  "role": "assistant",
  "content": "The capital of France is Paris.",
  "sequence": 2,
  "timestamp": "2025-01-16T12:00:01.000Z",
  "client_version": "1.2.3",
  "sanitization_applied": false,
  "sanitization_rules_version": "1.0.0",
  "finish_reason": "stop",
  "model": "claude-sonnet-4"
}
```

### Multi-Tool Conversation (with sanitization)

**Turn 1: User prompt (sanitized)**
```json
{
  "schema_version": "1.0.0",
  "event_type": "UserPromptSubmit",
  "event_id": "01HQZX3K5M4P2QRSTVWXYZ0003",
  "conversation_id": "01HQZX1A2B3C4D5E6F7G8H9J1M",
  "message_id": "01HQZX3K5M4P2QRSTVWXYZ0003",
  "session_id": "01HQZW9X8Y7Z6A5B4C3D2E1F1H",
  "role": "user",
  "content": "Add email validation to [REDACTED_PATH]/validators.ts using the pattern from [REDACTED_EMAIL]",
  "sequence": 1,
  "timestamp": "2025-01-16T12:05:00.000Z",
  "client_version": "1.2.3",
  "sanitization_applied": true,
  "sanitization_rules_version": "1.0.0"
}
```

**Turn 2: Assistant response with tool calls**
```json
{
  "schema_version": "1.0.0",
  "event_type": "Stop",
  "event_id": "01HQZX4M6N7O8P9Q0R1S2T0004",
  "conversation_id": "01HQZX1A2B3C4D5E6F7G8H9J1M",
  "message_id": "01HQZX4M6N7O8P9Q0R1S2T0004",
  "session_id": "01HQZW9X8Y7Z6A5B4C3D2E1F1H",
  "role": "assistant",
  "content": "I'll add email validation to the validators file. Let me read it first, then add the validation function.",
  "tool_calls": [
    {
      "tool_name": "Read",
      "tool_input": {
        "file_path": "[REDACTED_PATH]/validators.ts"
      },
      "tool_output": "export function validateUrl(url: string): boolean { /* ... */ }",
      "status": "success"
    },
    {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": "[REDACTED_PATH]/validators.ts",
        "old_string": "export function validateUrl(url: string): boolean { /* ... */ }",
        "new_string": "export function validateUrl(url: string): boolean { /* ... */ }\n\nexport function validateEmail(email: string): boolean {\n  const pattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n  return pattern.test(email);\n}"
      },
      "status": "success"
    },
    {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npm test -- validators.test.ts",
        "description": "Run validator tests"
      },
      "tool_output": "PASS src/validators.test.ts\n✓ validateEmail accepts valid emails (3 ms)\n✓ validateEmail rejects invalid emails (2 ms)",
      "status": "success"
    }
  ],
  "sequence": 2,
  "timestamp": "2025-01-16T12:05:10.000Z",
  "client_version": "1.2.3",
  "sanitization_applied": true,
  "sanitization_rules_version": "1.0.0",
  "finish_reason": "stop",
  "model": "claude-sonnet-4"
}
```

**Note**: Paths and email addresses are sanitized in both content and tool calls. Tool output is also sanitized.

---

## Performance Requirements

Per [STANDARDS.md Performance Budgets](../STANDARDS.md#12-performance-budgets):

| Component | Budget | Measured At |
|-----------|--------|-------------|
| Hook execution | <100ms p95 | End-to-end (receive → sanitize → persist) |
| Pre-sanitization | <50ms p95 | Regex-based rules only |
| Database writes | <20ms p95 | WAL-mode insert |
| Schema validation | <10ms p95 | Ajv compile + validate |

**Enforcement**: Hooks log warnings if budget exceeded.

```typescript
const start = performance.now();
// ... hook work ...
const duration = performance.now() - start;

if (duration > 100) {
  console.warn(`Hook exceeded 100ms budget: ${duration}ms`);
}
```

---

## Security Considerations

### Never Capture

1. **Chain-of-thought reasoning** - Internal LLM thinking (not accessible anyway)
2. **Raw content before sanitization** - Privacy violation
3. **API keys in logs** - Use `[REDACTED_API_KEY]` placeholders
4. **User credentials** - Sanitize before capture
5. **Session tokens** - Redact from URLs

### Always Sanitize

1. **User prompts** - Before writing to database
2. **Assistant responses** - Before writing to database
3. **Tool inputs** - File paths, command arguments
4. **Tool outputs** - File contents, command results
5. **Error messages** - May contain paths or secrets

### Audit Trail

Log sanitization events to `sanitization_log` table:

```sql
CREATE TABLE sanitization_log (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  sanitization_rules_version TEXT NOT NULL,
  redactions_applied INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(message_id) REFERENCES messages(id)
);
```

**Example log entry**:
```json
{
  "id": "01HQZX5N6O7P8Q9R0S1T2U3V4W",
  "message_id": "01HQZX3K5M4P2QRSTVWXYZ0003",
  "sanitization_rules_version": "1.0.0",
  "redactions_applied": 2,
  "created_at": "2025-01-16T12:05:00.000Z"
}
```

---

## Testing

### Schema Validation Tests

```typescript
import { describe, it, expect } from "vitest";
import { validateEvent } from "../validation";
import { userPromptSubmitSchemaV1_0_0 } from "../schemas/registry";

describe("UserPromptSubmit schema validation", () => {
  it("should accept valid v1.0.0 event", () => {
    const validEvent = {
      schema_version: "1.0.0",
      event_type: "UserPromptSubmit",
      event_id: "01HQZX3K5M4P2QRSTVWXYZ0001",
      conversation_id: "01HQZX1A2B3C4D5E6F7G8H9J0K",
      message_id: "01HQZX3K5M4P2QRSTVWXYZ0001",
      session_id: "01HQZW9X8Y7Z6A5B4C3D2E1F0G",
      role: "user",
      content: "Test prompt",
      sequence: 1,
      timestamp: "2025-01-16T12:00:00.000Z",
      client_version: "1.2.3",
      sanitization_applied: false,
      sanitization_rules_version: "1.0.0"
    };

    expect(() => validateEvent(validEvent)).not.toThrow();
  });

  it("should reject event with missing required fields", () => {
    const invalidEvent = {
      schema_version: "1.0.0",
      event_type: "UserPromptSubmit",
      // Missing event_id, conversation_id, etc.
    };

    expect(() => validateEvent(invalidEvent)).toThrow(/validation failed/i);
  });

  it("should reject event with invalid ULID format", () => {
    const invalidEvent = {
      schema_version: "1.0.0",
      event_type: "UserPromptSubmit",
      event_id: "invalid-ulid",  // Wrong format
      // ... other fields ...
    };

    expect(() => validateEvent(invalidEvent)).toThrow(/pattern/i);
  });

  it("should reject event with invalid timestamp format", () => {
    const invalidEvent = {
      schema_version: "1.0.0",
      event_type: "UserPromptSubmit",
      // ... other fields ...
      timestamp: "2025-01-16 12:00:00",  // Not ISO-8601
    };

    expect(() => validateEvent(invalidEvent)).toThrow(/format/i);
  });
});
```

### Sanitization Tests

```typescript
describe("Content sanitization", () => {
  it("should redact API keys from content", () => {
    const content = "Use this key: sk-1234567890abcdef";
    const sanitized = preSanitizeSync(content);

    expect(sanitized).toBe("Use this key: [REDACTED_API_KEY]");
  });

  it("should redact absolute paths with usernames", () => {
    const content = "Check /Users/alice/Documents/secret.txt";
    const sanitized = preSanitizeSync(content);

    expect(sanitized).toBe("Check [REDACTED_PATH]/Documents/secret.txt");
  });

  it("should redact email addresses", () => {
    const content = "Contact alice@example.com for details";
    const sanitized = preSanitizeSync(content);

    expect(sanitized).toBe("Contact [REDACTED_EMAIL] for details");
  });

  it("should complete sanitization within 50ms budget", () => {
    const largeContent = "a".repeat(10000);  // 10KB content
    const start = performance.now();

    preSanitizeSync(largeContent);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});
```

### Version Compatibility Tests

```typescript
describe("Schema version compatibility", () => {
  it("should accept v1.0.0 event on v1.1.0 server (backward compat)", () => {
    const v1_0_event = { schema_version: "1.0.0", /* ... */ };

    // Server running v1.1.0 schema
    expect(() => validateEvent(v1_0_event)).not.toThrow();
  });

  it("should reject v1.1.0 event on v1.0.0 server (no forward compat)", () => {
    const v1_1_event = { schema_version: "1.1.0", /* ... with new fields */ };

    // Server running v1.0.0 schema
    expect(() => validateEvent(v1_1_event)).toThrow(/unsupported.*version/i);
  });

  it("should reject v2.0.0 event on v1.x server (major version incompatible)", () => {
    const v2_event = { schema_version: "2.0.0", /* ... */ };

    // Server running v1.x schema
    expect(() => validateEvent(v2_event)).toThrow(/unsupported.*version/i);
  });
});
```

---

## Related Documents

### Standards
- [STANDARDS.md](../STANDARDS.md) - Canonical project standards (ULID, ISO-8601, status enums, privacy flow)

### Architecture
- [Hooks and Event Capture Architecture](../architecture/architecture-hooks-event-capture-2025-01-16.md) - Hook implementation and performance
- [Sanitization Pipeline Architecture](../architecture/architecture-sanitization-pipeline-2025-01-16.md) - Complete sanitization rules and workflow

### Decisions
- [ADR-004: Sanitize Before Storage](../decisions/decision-sanitize-before-storage-2025-01-16.md) - Privacy guarantee (never persist raw content)
- [ADR-012: Schema Versioning Strategy](../decisions/decision-data-model-schema-versioning-2025-01-16.md) - Version evolution and compatibility rules

### Reference
- [Database Schema Reference](./reference-database-schema-2025-01-16.md) - Messages table and storage schema

---

*This document is the canonical reference for all event schemas. All hook implementations MUST follow these schemas exactly. Content fields MUST contain sanitized data only (never raw). Schema versioning MUST follow ADR-012.*
