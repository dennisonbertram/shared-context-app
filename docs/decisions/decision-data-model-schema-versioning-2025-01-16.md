---
title: ADR-012: Data Model Schema Versioning Strategy
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [schema, versioning, migrations, compatibility, json-schema]
reviewed_by: GPT-5 (holistic review)
---

# ADR-012: Data Model Schema Versioning Strategy

## Status

Accepted (Revised per GPT-5 holistic review feedback)

Date: 2025-01-16
Last Updated: 2025-01-16

## Context

The Global Context Network has multiple data schemas that will evolve over time:

1. **Database schema** - SQLite tables (conversations, messages, learnings, job_queue, uploads, sanitization_log)
2. **Event schemas** - JSON structures passed through hooks (UserPromptSubmit, Stop, etc.)
3. **Learning schemas** - Extracted insights and patterns
4. **Upload schemas** - Data serialized for global network
5. **MCP response schemas** - Query result formats

**The Challenge**: As the system evolves, we need to:
- Add new fields to existing schemas
- Change validation rules
- Deprecate old fields
- Support clients on different versions
- Migrate existing data without data loss
- Maintain backward compatibility for MCP queries

**The Risk**: Without a versioning strategy:
- **Breaking changes** - Old clients fail on new schemas
- **Data migration failures** - Existing data becomes incompatible
- **Undefined behavior** - Unknown schema versions processed incorrectly
- **Cross-client incompatibility** - Different clients expect different formats
- **Upgrade friction** - Users afraid to upgrade due to breaking changes
- **No rollback path** - Cannot safely revert failed migrations

**Real-world scenarios**:
1. Adding a new field to `messages` table (e.g., `metadata` column)
2. Changing learning extraction format (adding confidence scores)
3. Adding new PII categories to sanitization
4. Updating MCP query response format
5. Adding new status values to job_queue

**Review feedback** (GPT-5 holistic review 2025-01-16):

Critical issues addressed in this revision:
1. **Sanitized-only guarantee**: ALL content fields MUST contain only pre-sanitized data (NEVER raw), per STANDARDS.md zero-trust privacy flow
2. **Canonical status enums**: Adopts `queued | in_progress | completed | failed | dead_letter` from STANDARDS.md (no drift)
3. **Single migration tool**: Atlas (NOT goose) for all database migrations
4. **Backward compatibility direction**: Servers accept older minor versions; no forward compatibility guarantee
5. **MCP version negotiation**: Server advertises versions, client requests, fallback to latest, error codes specified
6. **Broken links removed**: Referenced ADRs noted as pending; no broken cross-references

## Decision

Implement **canonical event schemas with embedded versioning** and **database migrations with backward compatibility guarantees**.

### 1. Event Schema Versioning

All events include a `schema_version` field:

```typescript
interface BaseEvent {
  schema_version: string;  // Semantic version: "1.0.0", "1.1.0", "2.0.0"
  event_type: string;
  timestamp: string;       // ISO-8601 UTC
  session_id: string;      // ULID
}

interface UserPromptSubmitEvent extends BaseEvent {
  schema_version: "1.0.0";
  event_type: "UserPromptSubmit";
  conversation_id: string;  // ULID
  role: "user";
  content: string;          // MUST be sanitized-only per STANDARDS.md (NEVER raw)
}
```

**Semantic versioning rules**:
- **Major version** (2.0.0): Breaking changes (removed fields, incompatible types, enum value removal)
- **Minor version** (1.1.0): Backward-compatible additions (new optional fields, new enum values)
- **Patch version** (1.0.1): Bug fixes, documentation, no schema changes

**Compatibility direction** (backward compatible only):
- **Servers MUST accept older minor versions** - A v1.1.0 server accepts v1.0.0 events (backward compatibility)
- **NO forward compatibility guarantee** - A v1.0.0 server MAY reject v1.1.0 events (no obligation to support newer versions)
- **Cross-major versions are incompatible** - v2.x servers MUST reject v1.x events (breaking change)

**Status enum evolution** (adopts canonical JobStatus from STANDARDS.md):
```typescript
type JobStatus =
  | 'queued'        // Initial state
  | 'in_progress'   // Worker claimed
  | 'completed'     // Succeeded
  | 'failed'        // Failed but retriable
  | 'dead_letter';  // Failed permanently
```
- New values: Minor version bump (additive only)
- Removed/changed values: Major version bump (breaking change)

### 2. JSON Schema Validation

Use JSON Schema for runtime validation with exact-version routing:

```typescript
import Ajv from "ajv";
import addFormats from "ajv-formats";

// Initialize Ajv with formats (required for date-time validation in Ajv v8+)
const ajv = new Ajv();
addFormats(ajv);

// Version 1.0.0 schema (exact version)
const userPromptSubmitSchemaV1_0_0 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["schema_version", "event_type", "timestamp", "session_id", "conversation_id", "role", "content"],
  properties: {
    schema_version: {
      type: "string",
      const: "1.0.0"  // Exact version for strict validation
    },
    event_type: {
      type: "string",
      const: "UserPromptSubmit"
    },
    timestamp: { type: "string", format: "date-time" },
    session_id: { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" },  // ULID pattern
    conversation_id: { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" },
    role: {
      type: "string",
      const: "user"
    },
    content: { type: "string", minLength: 1 }  // Sanitized content only (NEVER raw)
  },
  additionalProperties: false  // Strict: reject unknown fields
};

// Version 1.1.0 schema (backward compatible - adds optional metadata)
const userPromptSubmitSchemaV1_1_0 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["schema_version", "event_type", "timestamp", "session_id", "conversation_id", "role", "content"],
  properties: {
    schema_version: {
      type: "string",
      const: "1.1.0"
    },
    event_type: {
      type: "string",
      const: "UserPromptSubmit"
    },
    timestamp: { type: "string", format: "date-time" },
    session_id: { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" },
    conversation_id: { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" },
    role: {
      type: "string",
      const: "user"
    },
    content: { type: "string", minLength: 1 },  // Sanitized content only (NEVER raw)
    metadata: { type: "object" }  // New optional field in v1.1.0
  },
  additionalProperties: false
};

// Validation function with exact-version routing
function validateEvent(event: unknown): asserts event is UserPromptSubmitEvent {
  if (typeof event !== "object" || event === null) {
    throw new Error("Event must be an object");
  }

  const versionedEvent = event as { schema_version?: string; event_type?: string };
  const version = versionedEvent.schema_version;
  const eventType = versionedEvent.event_type;

  if (!version || !eventType) {
    throw new Error("Event missing schema_version or event_type");
  }

  // Fetch exact schema from registry
  const schema = getSchema(eventType, version);
  const validate = ajv.compile(schema);

  if (!validate(event)) {
    throw new Error(`Schema validation failed: ${ajv.errorsText(validate.errors)}`);
  }
}
```

**Tolerant reader option** (for servers accepting minor version ranges):
```typescript
// Alternative: Tolerant minor-version schema (accepts any v1.x.x)
const userPromptSubmitSchemaV1_tolerant = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["schema_version", "event_type", "timestamp", "session_id", "conversation_id", "role", "content"],
  properties: {
    schema_version: {
      type: "string",
      pattern: "^1\\.[0-9]+\\.[0-9]+$"  // Accepts 1.0.0, 1.1.0, 1.2.0, etc. (any v1.x.x)
    },
    event_type: {
      type: "string",
      const: "UserPromptSubmit"
    },
    timestamp: { type: "string", format: "date-time" },
    session_id: { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" },
    conversation_id: { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" },
    role: {
      type: "string",
      const: "user"
    },
    content: { type: "string", minLength: 1 }  // Sanitized content only (NEVER raw)
  },
  additionalProperties: true  // Tolerant: allow unknown fields from newer minor versions
};
```

**Decision**: Use exact-version routing for strictness. Servers achieve backward compatibility by registering multiple schema versions and routing to the requested version. Tolerant readers can be used by servers that want to accept any v1.x.x minor version with unknown field tolerance.

### 3. Database Migrations

**Migration tool**: Use Atlas (Ariga) for type-safe, versioned migrations.

**Why Atlas**:
- Native SQLite support with proper syntax handling
- Automatic checksum and version tracking
- Dry-run mode for migration preview
- Declarative schema-as-code option
- Built-in rollback support

**Migration file structure**:
```
migrations/
  20250116000001_initial_schema.sql       # Timestamp prefix
  20250116000002_add_metadata_column.sql
  20250116000003_add_sanitization_log.sql
  atlas.hcl                                # Atlas config
```

**Atlas configuration** (`atlas.hcl`):
```hcl
env "local" {
  src = "file://migrations"
  url = "sqlite://context.db"
  dev = "sqlite://file?mode=memory"

  migration {
    dir = "file://migrations"
    format = atlas
  }
}
```

**Migration format** (Atlas native, no goose markers):
```sql
-- 20250116000002_add_metadata_column.sql
-- Create migration (up)
ALTER TABLE messages ADD COLUMN metadata TEXT DEFAULT '{}';
CREATE INDEX idx_messages_metadata ON messages((json_extract(metadata, '$.priority')));
```

**Rollback migration** (separate down file):
```sql
-- 20250116000002_add_metadata_column.down.sql
-- Rollback migration (down)
DROP INDEX idx_messages_metadata;
-- Note: SQLite DROP COLUMN requires ≥3.35 or table reconstruction
ALTER TABLE messages DROP COLUMN metadata;
```

**SQLite compatibility notes**:
- **DROP COLUMN**: Requires SQLite ≥3.35 (2021). For older versions, use table reconstruction pattern.
- **JSON indexes**: Requires JSON1 extension (enabled by default in modern SQLite).
- **Expression indexes**: `json_extract` in CREATE INDEX requires expression index support (SQLite ≥3.9).
- **Transactions**: Atlas automatically wraps migrations in transactions for rollback safety.

**Atlas migration metadata** (managed automatically by Atlas):
- Atlas uses its own `atlas_schema_revisions` table
- Tracks version, checksum, applied_at, execution time
- No need for custom `schema_migrations` table

### 4. Backward Compatibility Strategy

**Rule**: Old data must remain readable after schema updates.

**Approach 1: Optional fields**
```typescript
// v1.0.0
interface Message {
  id: string;
  content: string;
}

// v1.1.0 (backward compatible)
interface Message {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;  // New optional field
}
```

**Approach 2: Default values**
```sql
-- Add column with default value
ALTER TABLE messages ADD COLUMN metadata TEXT DEFAULT '{}';
```

**Approach 3: Data transformers**
```typescript
function migrateMessageV1ToV2(v1: MessageV1): MessageV2 {
  return {
    ...v1,
    metadata: {}  // Default for old records
  };
}
```

### 5. Version Detection and Routing

```typescript
interface VersionedEvent {
  schema_version: string;
  [key: string]: unknown;
}

async function processEvent(event: VersionedEvent) {
  const version = semver.parse(event.schema_version);

  if (!version) {
    throw new Error(`Invalid schema_version: ${event.schema_version}`);
  }

  // Route to appropriate handler
  if (semver.satisfies(version, "^1.0.0")) {
    return processEventV1(event as UserPromptSubmitEventV1);
  } else if (semver.satisfies(version, "^2.0.0")) {
    return processEventV2(event as UserPromptSubmitEventV2);
  } else {
    throw new Error(`Unsupported schema version: ${event.schema_version}`);
  }
}
```

### 6. Schema Registry

Centralized schema definitions:

```typescript
// src/schemas/registry.ts
export const SCHEMA_REGISTRY = {
  "UserPromptSubmit": {
    "1.0.0": userPromptSubmitSchemaV1_0_0,
    "1.1.0": userPromptSubmitSchemaV1_1_0,
    "2.0.0": userPromptSubmitSchemaV2_0_0
  },
  "Stop": {
    "1.0.0": stopSchemaV1_0_0
  }
};

export function getSchema(eventType: string, version: string): JSONSchema {
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
  if (!eventSchemas) {
    return [];
  }
  return Object.keys(eventSchemas);
}
```

### 7. MCP Version Negotiation

MCP servers expose schema versions via capabilities and handle client version requests:

**Step 1: Server advertises supported versions**
```typescript
// MCP server initialization response includes supported schema versions
{
  "capabilities": {
    "resources": {
      "schema_version": "1.1.0",                      // Server's current/latest version
      "supported_versions": ["1.0.0", "1.1.0"]        // All versions server can serve
    }
  }
}
```

**Step 2: Client requests specific version**
```typescript
// Client includes optional schema_version in resource query
{
  "method": "resources/read",
  "params": {
    "uri": "context://conversations/latest",
    "schema_version": "1.0.0"  // Optional: client requests v1.0.0 explicitly
  }
}
```

**Step 3: Server responds with negotiated version**
```typescript
// Server returns data in requested version (or latest if not specified)
{
  "contents": [{
    "schema_version": "1.0.0",  // Actual version returned (matches request or server default)
    "uri": "context://conversations/latest",
    "mimeType": "application/json",
    "text": "{...}"  // Data formatted according to schema v1.0.0
  }]
}
```

**Version negotiation logic**:
```typescript
function negotiateVersion(
  clientRequestedVersion: string | undefined,
  serverSupportedVersions: string[]
): string {
  // If client specifies version, validate it's supported
  if (clientRequestedVersion) {
    if (!serverSupportedVersions.includes(clientRequestedVersion)) {
      throw new MCPError(
        ErrorCode.UNSUPPORTED_SCHEMA_VERSION,
        `Unsupported schema version ${clientRequestedVersion}. ` +
        `Server supports: ${serverSupportedVersions.join(", ")}`
      );
    }
    return clientRequestedVersion;
  }

  // Fallback: return latest supported version (last in array)
  return serverSupportedVersions[serverSupportedVersions.length - 1];
}
```

**Error codes**:
- `UNSUPPORTED_SCHEMA_VERSION` (-32001): Client requested version not in server's supported list
- `INVALID_SCHEMA_VERSION` (-32002): Malformed version string (not semver format)
- `SCHEMA_VERSION_REQUIRED` (-32003): Server requires explicit version (no default fallback)

**Fallback behavior**:
- If client omits `schema_version`: Server returns latest supported version
- If client requests unsupported version: Server returns error (no silent fallback to avoid breaking client assumptions)
- If client requests older version: Server transforms response to match older schema (backward compatibility)

### 8. Breaking Change Policy

**When breaking changes are necessary**:

1. **Announce deprecation** - 2 minor versions before removal
2. **Support both versions** - Old and new schemas during transition
3. **Provide migration path** - Document upgrade steps
4. **Version bump** - Major version increment
5. **Update docs** - Migration guide

**Example deprecation**:
```typescript
// v1.5.0 - Deprecate field
interface Message {
  id: string;
  content: string;
  /** @deprecated Use metadata.priority instead. Will be removed in v2.0.0 */
  priority?: number;
  metadata?: {
    priority?: number;
  };
}

// v2.0.0 - Remove deprecated field
interface Message {
  id: string;
  content: string;
  metadata: {
    priority?: number;
  };
}
```

## Consequences

### Positive

- **Predictable upgrades** - Semantic versioning communicates impact
- **Cross-client interoperability** - Clients declare supported versions
- **Safe migrations** - Rollback capability with down migrations
- **Runtime validation** - JSON Schema catches invalid data early
- **Audit trail** - Schema migrations table tracks all changes
- **Developer experience** - Clear versioning strategy reduces confusion
- **No data loss** - Backward compatibility preserves old data

### Negative

- **Migration complexity** - Writing migrations requires care
- **Version maintenance** - Must support multiple versions during transitions
- **Testing burden** - Must test all supported version combinations
- **Schema registry overhead** - Centralized registry needs maintenance
- **Breaking change friction** - Major version bumps require coordination

### Neutral

- **Version detection cost** - Small runtime overhead to parse version
- **Storage overhead** - Version field in every event
- **Documentation debt** - Must document migration paths

## Alternatives Considered

### Alternative 1: No Versioning (Breaking Changes Allowed)

**Description**: Evolve schemas freely, clients must stay up-to-date.

**Pros**:
- Simplest implementation
- No version overhead
- Faster iteration

**Cons**:
- **Breaks existing clients** - Forced upgrades
- **Data migration failures** - No backward compatibility
- **Poor user experience** - Unpredictable breaking changes
- **Cross-client issues** - Clients on different versions fail

**Why not chosen**: Violates stability principle. Users expect data to survive upgrades.

### Alternative 2: Avro/Protocol Buffers

**Description**: Use binary schema formats with built-in versioning.

**Pros**:
- **Stricter typing** - Schema evolution rules enforced
- **Smaller payloads** - Binary encoding
- **Better tooling** - Code generation, validation
- **Forward/backward compatibility** - Built into format

**Cons**:
- **Complexity** - Requires schema compiler
- **JSON incompatible** - Can't use with existing JSON tools
- **Learning curve** - Team must learn Avro/Protobuf
- **Ecosystem** - Less JavaScript/TypeScript support than JSON Schema

**Why not chosen**: Overkill for MVP. JSON Schema provides sufficient validation with better ecosystem fit. **Reconsider post-MVP** if binary formats needed for performance.

### Alternative 3: Database-Only Versioning (No Event Versioning)

**Description**: Version database schema only, not events.

**Pros**:
- Simpler event handling
- Fewer version checks
- Less overhead

**Cons**:
- **No cross-client safety** - Clients can send invalid events
- **Runtime errors** - Invalid data discovered late
- **No migration path** - Can't transform old events
- **Poor debugging** - Unknown event formats

**Why not chosen**: Events are the API contract. Must version the contract.

### Alternative 4: Copy-On-Write Versioning

**Description**: Create new tables for each schema version (e.g., `messages_v1`, `messages_v2`).

**Pros**:
- No migration needed
- Old data untouched
- Easy rollback

**Cons**:
- **Table proliferation** - Multiple tables for same entity
- **Query complexity** - Must UNION across versions
- **Storage duplication** - Data copied across versions
- **Index maintenance** - Multiple indexes to maintain

**Why not chosen**: Doesn't scale. Too many tables to manage.

### Alternative 5: Schema Evolution via Views

**Description**: Use SQL views to provide version compatibility.

**Pros**:
- Single source table
- Views provide version mapping
- No data duplication

**Cons**:
- **View complexity** - Complex transformations hard to express
- **Performance** - Views may be slower than direct queries
- **Limited transformations** - Can't express all migrations as views
- **SQLite limitations** - No materialized views

**Why not chosen**: Limited by SQLite view capabilities. Migrations more explicit.

## Implementation

### Phase 1: Add Schema Version to Events (Week 1)

**Tasks**:
1. Add `schema_version` field to all event interfaces
2. Update hook code to include version in events
3. Add version validation in event processing
4. Create schema registry with v1.0.0 schemas

**Acceptance**:
- All events include `schema_version: "1.0.0"`
- Invalid versions rejected with clear error
- Schema registry accessible

### Phase 2: JSON Schema Validation (Week 1)

**Tasks**:
1. Install `ajv`, `ajv-formats` dependencies
2. Write JSON Schema for all event types (v1.0.0)
3. Add validation to event processing pipeline
4. Generate TypeScript types from JSON Schemas (using `json-schema-to-typescript`)
5. Add validation tests with valid/invalid events

**Acceptance**:
- All events validated against JSON Schema
- TypeScript types auto-generated from schemas (no drift)
- Invalid events logged with detailed error
- 100% test coverage for validation

**Type generation**:
```bash
# Generate TypeScript types from JSON Schemas
npm install -D json-schema-to-typescript
npx json-schema-to-typescript src/schemas/*.schema.json -o src/schemas/types/
```

### Phase 3: Database Migrations (Week 2)

**Tasks**:
1. Install Atlas migration tool
2. Create initial migration (20250116000001_initial_schema.sql)
3. Configure atlas.hcl with SQLite environment
4. Write migration up/down tests
5. Verify SQLite version ≥3.35 for DROP COLUMN support
6. Document migration workflow (apply, rollback, dry-run)

**Acceptance**:
- Migrations apply successfully with `atlas migrate apply`
- Rollback (down) works correctly with .down.sql files
- Migration metadata tracked in `atlas_schema_revisions` (Atlas-managed)
- CI runs migrations in test environment
- Dry-run mode tested (`atlas migrate apply --dry-run`)

### Phase 4: Backward Compatibility Tests (Week 2)

**Tasks**:
1. Create test suite for version compatibility matrix
2. Test old events on new schema (v1.0.0 → v1.1.0)
3. Test new events on old schema (should fail gracefully or be rejected)
4. Test migration paths (v1 → v2) with data transformers
5. Add property-based tests for schema validation
6. Create deprecation tracker and CI warnings

**Version matrix testing**:
```typescript
const versionMatrix = [
  { client: "1.0.0", server: "1.0.0", expected: "success" },
  { client: "1.0.0", server: "1.1.0", expected: "success" }, // Backward compat
  { client: "1.1.0", server: "1.0.0", expected: "error" },   // No forward compat
  { client: "1.0.0", server: "2.0.0", expected: "error" },   // Major version incompatible
];
```

**Acceptance**:
- Old events (v1.0.0) work on v1.1.0 server (backward compatibility)
- v1.1.0 events rejected by v1.0.0 server (no forward compatibility)
- Cross-major versions incompatible (v2.x rejects v1.x)
- Data migration preserves all fields
- Property-based tests pass (generate random valid/invalid events)

## Risks and Mitigations

### Risk: Migration Failure on Production Database

**Impact**: Critical - Data loss, system downtime

**Mitigation**:
- **Always backup before migration** - Automated pre-migration backup
- **Test migrations on copy** - Run on production copy first
- **Dry-run mode** - Show SQL without applying
- **Rollback script** - Every migration has down script
- **Canary migrations** - Test on subset first

### Risk: Schema Drift Across Components

**Impact**: High - Components expect different schemas

**Mitigation**:
- **Single schema registry** - Centralized source of truth
- **Type generation** - Generate TypeScript from schemas
- **CI validation** - Schema changes require review
- **Version matrix testing** - Test all version combinations

### Risk: Forgotten Deprecations

**Impact**: Medium - Old fields never removed

**Mitigation**:
- **Deprecation tracker** - Document all deprecations with removal version
- **CI warnings** - Alert on deprecated field usage
- **Sunset timeline** - 2 versions before removal
- **Changelog** - Track all deprecations

### Risk: Over-Versioning

**Impact**: Low - Too many versions to maintain

**Mitigation**:
- **Minimize breaking changes** - Prefer backward-compatible additions
- **Batch changes** - Group breaking changes into single major version
- **Support policy** - Support N-1 major versions only

## Success Metrics

1. **Zero data loss** - All migrations preserve existing data
2. **Backward compatibility** - Old events (v1.0.0) work on current system
3. **Migration success rate** - 100% successful migrations in CI
4. **Version coverage** - All events include schema_version
5. **Documentation completeness** - Every schema version documented

## Related Documents

### Standards
- [Global Context Network Standards](../STANDARDS.md) - Canonical schema definitions, status enums, privacy guarantees

### Decisions
- ADR-004: Sanitize Before Storage - Mandates sanitized-only content in all schemas
- ADR-005: Use SQLite - Database choice and constraints
- ADR-006: Async Processing Model - Job queue and status workflow

### Reviews
- [GPT-5 Holistic Review](../reviews/gpt5-holistic-review-2025-01-16.txt) - Identified need for schema versioning strategy

**Note**: Referenced ADRs (004, 005, 006) are pending creation. This ADR establishes the versioning foundation that those ADRs will reference.

---

## Summary

This ADR establishes the canonical schema versioning strategy for all data models in the Global Context Network:

**Key decisions**:
1. **Semantic versioning** with embedded `schema_version` field in all events
2. **JSON Schema validation** with exact-version routing via central registry (ajv + ajv-formats)
3. **Atlas migrations** for database schema evolution with automatic rollback support (NOT goose)
4. **Backward compatibility** guaranteed for minor versions (servers MUST accept older events)
5. **No forward compatibility** for minor versions (older servers MAY reject newer events)
6. **MCP version negotiation** with server version advertisement, client requests, fallback to latest, and error codes
7. **Status enum evolution** follows canonical JobStatus from STANDARDS.md (queued, in_progress, completed, failed, dead_letter)
8. **Sanitized-only content guarantee** - ALL content fields MUST contain ONLY pre-sanitized data (NEVER raw input), per STANDARDS.md privacy flow

**Enforcement**:
- All events MUST include `schema_version` field
- All schemas MUST validate via JSON Schema with ajv + ajv-formats (NOT plain ajv without formats)
- All database changes MUST use Atlas migrations with up/down scripts (NOT goose)
- All content fields MUST contain ONLY sanitized data (NEVER raw input, per STANDARDS.md zero-trust privacy flow)
- All status enums MUST use canonical vocabulary from STANDARDS.md (queued, in_progress, completed, failed, dead_letter)
- All MCP servers MUST advertise supported_versions and handle version negotiation with proper error codes

*This ADR is the authoritative source for schema versioning. Any schema changes must follow these rules to ensure stability and interoperability.*
