---
title: ADR-005: Use SQLite for MVP Storage
category: decision
date: 2025-01-16
status: accepted
deciders: Claude + Dennison
tags: [database, sqlite, storage, local-first]
---

# ADR-005: Use SQLite for MVP Storage

## Status

Accepted

Date: 2025-01-16

## Context

The Global Context Network MVP needs persistent storage for:

1. **Sanitized conversations** - User prompts and agent responses
2. **Extracted learnings** - Insights and patterns
3. **Job queue** - Async processing tasks
4. **Upload tracking** - Network synchronization state
5. **Sanitization audit log** - PII redaction history

**Requirements**:
- ACID compliance (data integrity critical)
- Fast queries (< 100ms p95 for MCP server)
- Persistent across restarts
- Local-first (no network dependency)
- Simple setup (zero-config ideal)
- Migration support (schema evolution)
- Indexing for performance
- Transaction support for atomicity

**Constraints**:
- MVP is single-user, local-only
- Development machine environment
- No distributed access needed (yet)
- Budget-conscious (avoid operational overhead)

## Decision

Use SQLite with migrations for MVP storage.

**Configuration**:
- Write-Ahead Logging (WAL) mode for concurrency
- `synchronous=NORMAL` for performance/safety balance
- `busy_timeout=5000` for write contention
- Versioned migrations (forward-only)
- Indexes on all query paths

**Migration path to PostgreSQL** defined for post-MVP scaling.

## Consequences

### Positive

- **Zero-configuration** - Embedded database, no setup
- **ACID compliance** - Full transactional guarantees
- **Fast queries** - Indexed queries < 100ms easily achieved
- **Easy backup** - Single file copy
- **No operational overhead** - No server to maintain
- **Proven technology** - Battle-tested, stable
- **Great tooling** - SQLite CLI, many GUIs
- **Small footprint** - Minimal resource usage
- **Clear migration path** - Can upgrade to PostgreSQL later

### Negative

- **Single writer** - Only one write at a time (fine for MVP)
- **Not distributed** - Can't share across machines
- **File-based limits** - Performance degrades at very large sizes
- **No built-in replication** - Must implement separately
- **Limited concurrency** - Not ideal for high-concurrency workloads

### Neutral

- **File permissions** - Must manage OS-level access
- **Backup strategy** - Need to implement file copying
- **Corruption recovery** - Rare but need plan
- **Size monitoring** - Watch for growth

## Alternatives Considered

### Alternative 1: PostgreSQL

**Description**: Use PostgreSQL from the start.

**Pros**:
- Multi-writer concurrency
- Excellent performance at scale
- Robust replication
- Advanced features (JSONB, full-text search)
- Industry standard

**Cons**:
- **Overkill for MVP** - Single user doesn't need multi-writer
- **Setup complexity** - Install, configure, manage server
- **Operational overhead** - Monitor, backup, upgrade server
- **Resource usage** - Heavier than SQLite
- **Network dependency** - Even for local use

**Why not chosen**: Too much overhead for single-user MVP. Can migrate later when multi-user is needed.

### Alternative 2: MongoDB

**Description**: Use document database.

**Pros**:
- Flexible schema
- Good for unstructured data
- Horizontal scaling
- (Note: MongoDB does have ACID transactions since v4.x in replica sets)

**Cons**:
- **Operational overhead** - Server management
- **Document model not needed** - Our data is structured
- **Replica set needed for ACID** - Adds complexity
- **Resource usage** - Heavier than SQLite
- **Migration complexity** - Harder to move to SQL later

**Why not chosen**: Document model and schema flexibility not needed. Operational overhead too high for MVP.

### Alternative 3: JSON Files

**Description**: Store data as JSON files on disk.

**Pros**:
- Very simple
- Human-readable
- Easy to inspect/debug
- No dependencies

**Cons**:
- **No query performance** - Must load entire files
- **No transactions** - Race conditions possible
- **No ACID guarantees** - Data corruption risk
- **Indexing impossible** - Linear scans only
- **Concurrency issues** - File locking problems

**Why not chosen**: Unacceptable performance and reliability for production system.

### Alternative 4: In-Memory Database (Redis, Memcached)

**Description**: Keep all data in memory.

**Pros**:
- Extremely fast
- Simple data structures
- Good for caching

**Cons**:
- **Data loss on restart** - Not persistent (or requires snapshots)
- **Memory constraints** - Limited by RAM
- **No complex queries** - Limited query capabilities
- **Operational overhead** - Server management

**Why not chosen**: "Never lose data" requirement demands persistence. Not suitable for primary storage.

### Alternative 5: DuckDB

**Description**: Use DuckDB (analytical database) for local storage.

**Pros**:
- Embedded like SQLite
- Excellent analytical queries
- Columnar storage
- Very fast aggregations

**Cons**:
- **OLAP not OLTP** - Optimized for analytics, not transactions
- **Overkill for MVP** - We don't have complex analytical needs yet
- **Less mature** - Newer than SQLite
- **Write performance** - Optimized for reads, not writes

**Why not chosen**: Wrong optimization target. We need OLTP (transactional), not OLAP (analytical). Could add later for analytics.

### Alternative 6: SQLCipher (SQLite with Encryption)

**Description**: Use encrypted SQLite variant.

**Pros**:
- All SQLite benefits
- Encryption at rest
- Good for sensitive data
- Drop-in SQLite replacement

**Cons**:
- Performance overhead (encryption/decryption)
- Key management complexity
- Not needed for MVP (data is sanitized)

**Why not chosen**: Since we sanitize before storage, encryption at rest is lower priority. Can add post-MVP if needed.

### Alternative 7: LiteFS / Litestream

**Description**: SQLite with replication/streaming backup.

**Pros**:
- SQLite compatibility
- Built-in replication
- Continuous backup
- Multi-region support

**Cons**:
- Additional complexity
- Not needed for single-user MVP
- Operational overhead

**Why not chosen**: Replication not needed for MVP. Can add when multi-user support required.

## Implementation

### SQLite Configuration

```typescript
import Database from "better-sqlite3";

const db = new Database("global-context.db", {
  // WAL mode for better concurrency
  // Allows readers while writer is active
  wal: true,

  // Read-only mode (false for read-write)
  readonly: false,

  // Create if doesn't exist
  fileMustExist: false,

  // Timeout for busy database
  timeout: 5000 // 5 seconds
});

// Performance and safety tuning
db.pragma("synchronous = NORMAL"); // Balance safety and performance
db.pragma("cache_size = 10000"); // ~40MB cache
db.pragma("temp_store = memory"); // Temporary tables in memory
db.pragma("mmap_size = 30000000000"); // Memory-mapped I/O
db.pragma("journal_mode = WAL"); // Write-Ahead Logging
db.pragma("busy_timeout = 5000"); // 5 second timeout on locks
```

### Schema Versioning and Migrations

```typescript
interface Migration {
  version: number;
  name: string;
  up: string; // SQL to apply migration
  down: string; // SQL to rollback (optional for MVP)
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial-schema",
    up: `
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        message_count INTEGER DEFAULT 0
      );

      CREATE INDEX idx_conversations_created ON conversations(created_at);
      CREATE INDEX idx_conversations_status ON conversations(status);

      CREATE TABLE migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `,
    down: `
      DROP TABLE conversations;
      DROP TABLE migrations;
    `
  },
  {
    version: 2,
    name: "add-learnings-table",
    up: `
      CREATE TABLE learnings (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE INDEX idx_learnings_conversation ON learnings(conversation_id);
      CREATE INDEX idx_learnings_category ON learnings(category);
      CREATE INDEX idx_learnings_confidence ON learnings(confidence);
    `,
    down: "DROP TABLE learnings;"
  }
  // ... more migrations
];

async function runMigrations() {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  // Get current version
  const current = db.prepare("SELECT MAX(version) as version FROM migrations").get();
  const currentVersion = current?.version || 0;

  // Apply pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);

      db.transaction(() => {
        db.exec(migration.up);
        db.prepare(`
          INSERT INTO migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(migration.version, migration.name, Date.now());
      })();

      console.log(`✓ Migration ${migration.version} applied`);
    }
  }
}
```

### Index Strategy

All query paths must be indexed:

```sql
-- Conversations
CREATE INDEX idx_conversations_created ON conversations(created_at);
CREATE INDEX idx_conversations_status ON conversations(status);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Learnings
CREATE INDEX idx_learnings_conversation ON learnings(conversation_id);
CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_confidence ON learnings(confidence);
CREATE INDEX idx_learnings_created ON learnings(created_at);

-- Composite index for common query
CREATE INDEX idx_learnings_category_confidence
  ON learnings(category, confidence);

-- Job queue
CREATE INDEX idx_jobs_status ON job_queue(status);
CREATE INDEX idx_jobs_priority_created ON job_queue(priority, created_at);
```

### Query Budget Enforcement

```typescript
interface QueryBudget {
  maxDuration: number; // ms
  slowQueryThreshold: number; // ms
  logSlowQueries: boolean;
}

const budget: QueryBudget = {
  maxDuration: 100, // p95 target
  slowQueryThreshold: 50, // Log if > 50ms
  logSlowQueries: true
};

function query<T>(sql: string, params: any[]): T {
  const start = Date.now();

  try {
    const result = db.prepare(sql).all(...params);
    const duration = Date.now() - start;

    if (duration > budget.slowQueryThreshold) {
      console.warn(`Slow query (${duration}ms): ${sql}`);
    }

    return result as T;
  } catch (error) {
    console.error(`Query failed: ${sql}`, error);
    throw error;
  }
}
```

### Backup Strategy

```typescript
async function backup() {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const backupPath = `./backups/global-context-${timestamp}.db`;

  // Use SQLite backup API
  const backup = db.backup(backupPath);

  return new Promise((resolve, reject) => {
    backup.step(-1); // Copy entire database
    backup.finish();

    // Verify backup
    const backupDb = new Database(backupPath, { readonly: true });
    const integrity = backupDb.pragma("integrity_check");
    backupDb.close();

    if (integrity[0].integrity_check === "ok") {
      console.log(`✓ Backup created: ${backupPath}`);
      resolve(backupPath);
    } else {
      reject(new Error("Backup integrity check failed"));
    }
  });
}

// Schedule daily backups
schedule("0 3 * * *", backup);
```

### File Permissions

```typescript
import { chmod } from "fs/promises";

// Restrict database file to owner only
async function secureDatabaseFile() {
  await chmod("global-context.db", 0o600); // rw-------
  await chmod("global-context.db-shm", 0o600); // Shared memory file
  await chmod("global-context.db-wal", 0o600); // WAL file
}
```

### Corruption Recovery

```typescript
async function checkDatabaseIntegrity(): Promise<boolean> {
  try {
    const result = db.pragma("integrity_check");
    return result[0].integrity_check === "ok";
  } catch (error) {
    console.error("Integrity check failed:", error);
    return false;
  }
}

async function recoverFromCorruption() {
  console.error("Database corruption detected");

  // 1. Close database
  db.close();

  // 2. Try to dump to SQL
  const dumpPath = `./recovery/dump-${Date.now()}.sql`;
  exec(`sqlite3 global-context.db .dump > ${dumpPath}`);

  // 3. Create new database from dump
  const recoveredPath = `./recovery/recovered-${Date.now()}.db`;
  exec(`sqlite3 ${recoveredPath} < ${dumpPath}`);

  // 4. Verify recovered database
  const recoveredDb = new Database(recoveredPath);
  const integrity = recoveredDb.pragma("integrity_check");

  if (integrity[0].integrity_check === "ok") {
    console.log("✓ Database recovered successfully");
    // Replace original with recovered
    fs.renameSync(recoveredPath, "global-context.db");
  } else {
    console.error("Recovery failed - restore from backup");
    // Restore latest backup
    await restoreFromBackup();
  }
}
```

### Migration Threshold to PostgreSQL

Define when to migrate:

```typescript
interface MigrationTriggers {
  maxDatabaseSize: number; // bytes
  maxConcurrentWriters: number;
  requiresCrossMAchineAccess: boolean;
  requiresReplication: boolean;
}

const postgresThresholds: MigrationTriggers = {
  maxDatabaseSize: 5 * 1024 * 1024 * 1024, // 5GB
  maxConcurrentWriters: 1, // > 1 needs PostgreSQL
  requiresCrossMAchineAccess: false, // true needs PostgreSQL
  requiresReplication: false // true needs PostgreSQL
};

function shouldMigrateToPostgres(): boolean {
  const dbSize = fs.statSync("global-context.db").size;

  return (
    dbSize > postgresThresholds.maxDatabaseSize ||
    // Future checks:
    // concurrentWriters > postgresThresholds.maxConcurrentWriters ||
    // requiresCrossMAchineAccess ||
    // requiresReplication
  );
}
```

## Risks and Mitigations

### Risk: Database Corruption

**Impact**: High - Data loss

**Mitigation**:
- Daily backups with integrity checks
- WAL mode reduces corruption risk
- Regular integrity checks
- Recovery procedure documented
- Keep multiple backup generations

### Risk: Performance Degradation at Scale

**Impact**: Medium - Slow queries

**Mitigation**:
- Monitor database size
- Index all query paths
- Prune old data
- Migrate to PostgreSQL if needed
- Set query budgets and alerts

### Risk: Concurrent Write Contention

**Impact**: Low - MVP is single-threaded

**Mitigation**:
- WAL mode allows concurrent reads
- Busy timeout prevents immediate failures
- Transaction batching reduces locks
- Monitor lock wait times

## Related Documents

### Architecture
- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Database Schema](../architecture/architecture-database-schema-2025-01-16.md)

### Decisions
- [ADR-004: Sanitize Before Storage](./decision-sanitize-before-storage-2025-01-16.md)
- [ADR-006: Async Processing Model](./decision-async-processing-model-2025-01-16.md)

### Plans
- [Phase 3: Database and Storage](../plans/plan-phase-3-database-storage-2025-01-16.md)

### Reference
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md)
