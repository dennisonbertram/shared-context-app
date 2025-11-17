---
title: Database Setup Guide
category: guide
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [database, sqlite, setup, migrations, configuration]
difficulty: beginner
estimated_time: 30-45 minutes
prerequisites:
  - Node.js 18+ installed
  - npm or pnpm package manager
  - Basic SQL knowledge
  - Text editor or IDE
references:
  - docs/STANDARDS.md (Section 2: Schema Standard)
  - docs/reference/reference-database-schema-2025-01-16.md
  - docs/decisions/decision-use-sqlite-2025-01-16.md
  - docs/architecture/architecture-async-processing-2025-01-16.md
---

# Database Setup Guide

> Step-by-step guide to set up the SQLite database for the Global Context Network with proper configuration, migrations, and validation.

---

## Overview

This guide walks you through setting up the complete database infrastructure for the Global Context Network. You'll configure SQLite with optimal settings, create all six canonical tables, set up migrations, and verify everything works correctly.

**What You'll Build**:
- SQLite database with WAL mode and foreign key enforcement
- All 6 canonical tables (conversations, messages, learnings, job_queue, uploads, sanitization_log)
- Migration system using Atlas (preferred) or custom TypeScript migrations
- Performance indexes for fast queries
- Backup and recovery procedures
- Validation and testing scripts

**Time Estimate**: 30-45 minutes

---

## Prerequisites

Before starting, ensure you have:

1. **Node.js 18+** installed
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **Package Manager** (npm or pnpm)
   ```bash
   npm --version   # or: pnpm --version
   ```

3. **Project Repository** cloned and dependencies installed
   ```bash
   git clone <repository-url>
   cd shared-context-app
   npm install  # or: pnpm install
   ```

4. **Basic SQL Knowledge** - Understanding of CREATE TABLE, indexes, and foreign keys

5. **Text Editor or IDE** - VS Code, Cursor, or similar

---

## Step 1: Install Dependencies

### Core Database Dependencies

Install the required packages:

```bash
npm install better-sqlite3 ulid
npm install --save-dev @types/better-sqlite3
```

**Package Purposes**:
- `better-sqlite3` - SQLite database driver (synchronous, fast)
- `ulid` - ULID ID generation (time-sortable, lexicographic)
- `@types/better-sqlite3` - TypeScript type definitions

### Migration Tool (Atlas - Recommended)

Install Atlas CLI for database migrations:

**macOS (Homebrew)**:
```bash
brew install ariga/tap/atlas
```

**Linux**:
```bash
curl -sSf https://atlasgo.sh | sh
```

**Windows**:
```bash
# Download from https://github.com/ariga/atlas/releases
# Add to PATH
```

**Verify Installation**:
```bash
atlas version
# Should show: atlas version v0.x.x
```

**Alternative: Custom Migration System**

If you prefer a custom TypeScript migration runner (see Step 5 for implementation), no additional tools are needed beyond Node.js.

---

## Step 2: Configure SQLite

### Database File Location

Create a `src/database/` directory:

```bash
mkdir -p src/database
```

**Database File Path**: `src/database/context.db`

**IMPORTANT**: Add to `.gitignore`:
```bash
echo "src/database/*.db*" >> .gitignore
echo "src/database/*.db-shm" >> .gitignore
echo "src/database/*.db-wal" >> .gitignore
```

### SQLite Pragmas (Required)

Create `src/database/config.ts`:

```typescript
import Database from 'better-sqlite3';

/**
 * Database configuration with optimal SQLite settings
 *
 * CRITICAL: These PRAGMAs MUST be set on every connection
 */
export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  verbose?: boolean;
}

export function createDatabase(config: DatabaseConfig): Database.Database {
  const { path, readonly = false, verbose = false } = config;

  // Create database connection
  const db = new Database(path, {
    readonly,
    fileMustExist: false,
    timeout: 5000,
    verbose: verbose ? console.log : undefined
  });

  // CRITICAL: Set required PRAGMAs
  configurePragmas(db);

  return db;
}

/**
 * Configure SQLite PRAGMAs for optimal performance and safety
 *
 * From ADR-005 and STANDARDS.md
 */
function configurePragmas(db: Database.Database): void {
  // 1. FOREIGN KEYS - MUST be ON for referential integrity
  db.pragma('foreign_keys = ON');

  // 2. WAL MODE - Write-Ahead Logging for concurrency
  // Allows readers while writer is active
  db.pragma('journal_mode = WAL');

  // 3. SYNCHRONOUS - Balance between safety and performance
  // NORMAL is safe with WAL mode
  db.pragma('synchronous = NORMAL');

  // 4. BUSY TIMEOUT - Wait 5s for write locks
  db.pragma('busy_timeout = 5000');

  // 5. PAGE SIZE - 8KB pages (optimal for modern systems)
  // Set before first write to database
  const pageSize = db.pragma('page_size', { simple: true });
  if (pageSize !== 8192) {
    db.pragma('page_size = 8192');
  }

  // 6. CACHE SIZE - ~40MB cache (5000 pages * 8KB)
  db.pragma('cache_size = -40000');  // Negative = KB instead of pages

  // 7. TEMP STORE - Keep temp tables in memory
  db.pragma('temp_store = MEMORY');

  // 8. MMAP SIZE - Memory-mapped I/O (30GB max)
  db.pragma('mmap_size = 30000000000');

  // 9. AUTO VACUUM - Incremental to keep database compact
  db.pragma('auto_vacuum = INCREMENTAL');
}

/**
 * Verify database configuration
 *
 * Call after creating database to ensure proper setup
 */
export function verifyConfiguration(db: Database.Database): boolean {
  const checks = [
    { name: 'foreign_keys', expected: 1 },
    { name: 'journal_mode', expected: 'wal' },
    { name: 'synchronous', expected: 1 }  // NORMAL = 1
  ];

  for (const check of checks) {
    const value = db.pragma(check.name, { simple: true });
    if (value !== check.expected) {
      console.error(`PRAGMA ${check.name} = ${value}, expected ${check.expected}`);
      return false;
    }
  }

  return true;
}

/**
 * Get database info for debugging
 */
export function getDatabaseInfo(db: Database.Database): Record<string, any> {
  return {
    foreign_keys: db.pragma('foreign_keys', { simple: true }),
    journal_mode: db.pragma('journal_mode', { simple: true }),
    synchronous: db.pragma('synchronous', { simple: true }),
    page_size: db.pragma('page_size', { simple: true }),
    cache_size: db.pragma('cache_size', { simple: true }),
    temp_store: db.pragma('temp_store', { simple: true }),
    auto_vacuum: db.pragma('auto_vacuum', { simple: true })
  };
}
```

**Test Configuration**:

```bash
# Create test script: src/database/test-config.ts
cat > src/database/test-config.ts << 'EOF'
import { createDatabase, verifyConfiguration, getDatabaseInfo } from './config';

const db = createDatabase({ path: ':memory:', verbose: true });

console.log('Database Configuration:');
console.log(JSON.stringify(getDatabaseInfo(db), null, 2));

console.log('\nVerification:', verifyConfiguration(db) ? 'PASS' : 'FAIL');

db.close();
EOF

# Run test
npx tsx src/database/test-config.ts
```

**Expected Output**:
```json
{
  "foreign_keys": 1,
  "journal_mode": "wal",
  "synchronous": 1,
  "page_size": 8192,
  "cache_size": -40000,
  "temp_store": 2,
  "auto_vacuum": 2
}

Verification: PASS
```

---

## Step 3: Create Database Schema

### Option A: Using Atlas Migrations (Recommended)

**1. Create Atlas Configuration**

Create `atlas.hcl` in project root:

```hcl
# Atlas configuration for Global Context Network
# See: https://atlasgo.io/atlas-schema/sql

env "local" {
  src = "file://src/database/schema.sql"

  dev = "sqlite://file?mode=memory&_fk=1"

  url = "sqlite://src/database/context.db"

  migration {
    dir = "file://src/database/migrations"
  }
}
```

**2. Create Schema File**

Create `src/database/schema.sql` with the canonical schema:

```sql
-- Global Context Network Database Schema
-- Version: 1.0.0
-- Date: 2025-01-16
--
-- CRITICAL: This is the CANONICAL schema from STANDARDS.md
-- All 6 production tables, NO events/event_queue tables

-- ============================================================================
-- TABLE: conversations
-- Stores sanitized conversation metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  -- Identity
  id TEXT PRIMARY KEY,                    -- ULID
  session_id TEXT NOT NULL,               -- Claude Code session ID
  correlation_id TEXT NOT NULL UNIQUE,    -- Tracking ID

  -- Timestamps (ISO-8601 format)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,                      -- When conversation ended

  -- Sanitization (ALWAYS true)
  sanitized BOOLEAN NOT NULL DEFAULT 1 CHECK (sanitized = 1),
  sanitization_version TEXT NOT NULL,     -- e.g., "1.0.0"

  -- Metrics
  message_count INTEGER NOT NULL DEFAULT 0,

  -- Additional data
  metadata JSON                           -- Flexible JSON field
);

-- Indexes
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX idx_conversations_correlation ON conversations(correlation_id);

-- Trigger: Auto-update updated_at
CREATE TRIGGER conversations_updated_at
AFTER UPDATE ON conversations
FOR EACH ROW
BEGIN
  UPDATE conversations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- TABLE: messages
-- Stores individual sanitized messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  -- Identity
  id TEXT PRIMARY KEY,                    -- ULID
  conversation_id TEXT NOT NULL,

  -- Content (SANITIZED ONLY)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,                  -- SANITIZED content
  content_hash TEXT NOT NULL,             -- SHA-256 for deduplication

  -- Ordering
  sequence INTEGER NOT NULL,              -- Order within conversation (0, 1, 2, ...)

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Metrics
  token_count INTEGER,                    -- Approximate tokens

  -- Additional data
  metadata JSON,                          -- Tool calls, thinking, etc.

  -- Constraints
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  UNIQUE (conversation_id, sequence)
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sequence);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_hash ON messages(content_hash);

-- Triggers: Update conversation message_count
CREATE TRIGGER messages_after_insert
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
  UPDATE conversations
  SET message_count = message_count + 1
  WHERE id = NEW.conversation_id;
END;

CREATE TRIGGER messages_after_delete
AFTER DELETE ON messages
FOR EACH ROW
BEGIN
  UPDATE conversations
  SET message_count = message_count - 1
  WHERE id = OLD.conversation_id;
END;

-- ============================================================================
-- TABLE: learnings
-- Stores extracted insights with full-text search
-- ============================================================================

CREATE TABLE IF NOT EXISTS learnings (
  -- Identity
  id TEXT PRIMARY KEY,                    -- ULID
  conversation_id TEXT NOT NULL,
  source_message_ids JSON NOT NULL,       -- Array of message IDs

  -- Content
  category TEXT NOT NULL CHECK (
    category IN (
      'pattern',
      'best_practice',
      'anti_pattern',
      'bug_fix',
      'optimization',
      'tool_usage',
      'workflow',
      'decision'
    )
  ),
  title TEXT NOT NULL,                    -- Short summary
  content TEXT NOT NULL,                  -- Detailed learning (SANITIZED)

  -- Quality
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  tags JSON NOT NULL DEFAULT '[]',        -- Array of strings
  dedupe_hash TEXT NOT NULL UNIQUE,       -- Prevent duplicates

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Additional data
  metadata JSON,

  -- Constraints
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_learnings_conversation ON learnings(conversation_id);
CREATE INDEX idx_learnings_category ON learnings(category, confidence DESC);
CREATE INDEX idx_learnings_confidence ON learnings(confidence DESC);
CREATE INDEX idx_learnings_created ON learnings(created_at DESC);
CREATE INDEX idx_learnings_dedupe ON learnings(dedupe_hash);

-- Full-Text Search (FTS5)
CREATE VIRTUAL TABLE learnings_fts USING fts5(
  learning_id UNINDEXED,
  title,
  content,
  tags,
  content='learnings',
  content_rowid='rowid'
);

-- FTS Sync Triggers
CREATE TRIGGER learnings_fts_insert
AFTER INSERT ON learnings
BEGIN
  INSERT INTO learnings_fts(rowid, learning_id, title, content, tags)
  VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content, NEW.tags);
END;

CREATE TRIGGER learnings_fts_delete
AFTER DELETE ON learnings
BEGIN
  DELETE FROM learnings_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER learnings_fts_update
AFTER UPDATE ON learnings
BEGIN
  DELETE FROM learnings_fts WHERE rowid = OLD.rowid;
  INSERT INTO learnings_fts(rowid, learning_id, title, content, tags)
  VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content, NEW.tags);
END;

-- ============================================================================
-- TABLE: job_queue
-- Persistent queue for async processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_queue (
  -- Identity
  id TEXT PRIMARY KEY,                    -- ULID
  type TEXT NOT NULL,                     -- 'sanitize_ai_validation', 'extract_learning', 'mine_upload'

  -- Status (CANONICAL from STANDARDS.md)
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'in_progress', 'completed', 'failed', 'dead_letter')
  ),

  -- Priority and Scheduling
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Worker Coordination (Lease-based)
  lease_owner TEXT,                       -- Worker ID (hostname:pid)
  lease_until TEXT,                       -- Lease expiry timestamp

  -- Payload
  payload TEXT NOT NULL,                  -- JSON job data
  idempotency_key TEXT UNIQUE,            -- Deduplication

  -- Retry Management
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error TEXT,                             -- Last error message

  -- Timestamps (ALL ISO-8601)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,                        -- When worker claimed
  completed_at TEXT,                      -- When finished

  -- Result
  result TEXT                             -- JSON result data
);

-- Indexes for worker queries
CREATE INDEX idx_job_queue_dequeue
  ON job_queue(status, priority, scheduled_at)
  WHERE status = 'queued';

CREATE INDEX idx_job_queue_lease_expiry
  ON job_queue(lease_until)
  WHERE status = 'in_progress';

CREATE INDEX idx_job_queue_type ON job_queue(type, status);
CREATE INDEX idx_job_queue_idempotency ON job_queue(idempotency_key);

-- Trigger: Auto-update updated_at
CREATE TRIGGER job_queue_updated_at
AFTER UPDATE ON job_queue
FOR EACH ROW
BEGIN
  UPDATE job_queue SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- TABLE: uploads
-- Tracks uploads to global network (IPFS + blockchain)
-- ============================================================================

CREATE TABLE IF NOT EXISTS uploads (
  -- Identity
  id TEXT PRIMARY KEY,                    -- ULID
  learning_id TEXT NOT NULL UNIQUE,

  -- Upload Status
  ipfs_cid TEXT UNIQUE,                   -- IPFS Content Identifier
  chain_tx_hash TEXT UNIQUE,              -- Blockchain transaction hash
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'ipfs_uploaded', 'tx_submitted', 'confirmed', 'failed')
  ),

  -- Retry Management
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,

  -- Rewards
  tokens_earned REAL,                     -- Reward if confirmed

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  uploaded_at TEXT,                       -- IPFS upload timestamp
  confirmed_at TEXT,                      -- Blockchain confirmation timestamp

  -- Constraints
  FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_uploads_learning ON uploads(learning_id);
CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_uploads_created ON uploads(created_at DESC);
CREATE UNIQUE INDEX idx_uploads_ipfs_cid ON uploads(ipfs_cid) WHERE ipfs_cid IS NOT NULL;
CREATE UNIQUE INDEX idx_uploads_tx_hash ON uploads(chain_tx_hash) WHERE chain_tx_hash IS NOT NULL;

-- Trigger: Auto-update updated_at
CREATE TRIGGER uploads_updated_at
AFTER UPDATE ON uploads
FOR EACH ROW
BEGIN
  UPDATE uploads SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- TABLE: sanitization_log
-- Audit trail of PII detections and redactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS sanitization_log (
  -- Identity
  id TEXT PRIMARY KEY,                    -- ULID
  conversation_id TEXT NOT NULL,
  message_id TEXT,                        -- NULL if conversation-level

  -- Detection
  category TEXT NOT NULL,                 -- PII type (api_key, email, file_path, etc.)
  rule_id TEXT,                           -- Which rule detected it
  original_snippet_hash TEXT NOT NULL,    -- SHA-256 of PII (NEVER store actual PII)
  replacement TEXT NOT NULL,              -- Replacement text used
  detector TEXT NOT NULL CHECK (detector IN ('rule', 'ai', 'hybrid')),
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Additional data
  metadata JSON,

  -- Constraints
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_sanitization_log_conversation ON sanitization_log(conversation_id);
CREATE INDEX idx_sanitization_log_message ON sanitization_log(message_id);
CREATE INDEX idx_sanitization_log_category ON sanitization_log(category);
CREATE INDEX idx_sanitization_log_created ON sanitization_log(created_at DESC);
```

**3. Generate Migration**

```bash
atlas migrate diff initial \
  --env local \
  --to file://src/database/schema.sql
```

**4. Apply Migration**

```bash
atlas migrate apply \
  --env local \
  --url sqlite://src/database/context.db
```

**5. Verify Schema**

```bash
atlas schema inspect \
  --env local \
  --url sqlite://src/database/context.db
```

### Option B: Custom TypeScript Migrations

If you prefer custom migrations, create `src/database/migrations/runner.ts`:

```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

/**
 * Create migrations tracking table
 */
function createMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Get current schema version
 */
function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null };
  return row.version ?? 0;
}

/**
 * Load migration files from directory
 */
function loadMigrations(dir: string): Migration[] {
  const files = fs.readdirSync(dir).sort();
  const migrations: Migration[] = [];

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;

    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    const name = match[2];
    const content = fs.readFileSync(path.join(dir, file), 'utf8');

    // Split on -- UP / -- DOWN markers
    const [up, down] = content.split(/--\s*DOWN/i);
    const upSql = up.replace(/--\s*UP/i, '').trim();
    const downSql = down?.trim() || '';

    migrations.push({ version, name, up: upSql, down: downSql });
  }

  return migrations;
}

/**
 * Run pending migrations
 */
export function runMigrations(db: Database.Database, targetVersion?: number): void {
  createMigrationsTable(db);

  const currentVersion = getCurrentVersion(db);
  const migrationsDir = path.join(__dirname, 'sql');
  const migrations = loadMigrations(migrationsDir);

  const toApply = migrations.filter(m =>
    m.version > currentVersion && (!targetVersion || m.version <= targetVersion)
  );

  if (toApply.length === 0) {
    console.log('No migrations to apply');
    return;
  }

  for (const migration of toApply) {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);

    const applyMigration = db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
    });

    applyMigration();
  }

  console.log(`Migrated to version ${toApply[toApply.length - 1].version}`);
}

/**
 * Rollback migrations to target version
 */
export function rollbackMigrations(db: Database.Database, targetVersion: number): void {
  const currentVersion = getCurrentVersion(db);
  const migrationsDir = path.join(__dirname, 'sql');
  const migrations = loadMigrations(migrationsDir);

  const toRollback = migrations
    .filter(m => m.version > targetVersion && m.version <= currentVersion)
    .reverse();

  if (toRollback.length === 0) {
    console.log('No migrations to rollback');
    return;
  }

  for (const migration of toRollback) {
    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);

    const rollback = db.transaction(() => {
      db.exec(migration.down);
      db.prepare('DELETE FROM _migrations WHERE version = ?').run(migration.version);
    });

    rollback();
  }

  console.log(`Rolled back to version ${targetVersion}`);
}
```

Then create your first migration file at `src/database/migrations/sql/001_initial.sql` with the schema from Option A above, formatted as:

```sql
-- UP

[Full schema SQL here]

-- DOWN

DROP TRIGGER IF EXISTS sanitization_log_created;
-- ... (drop all objects in reverse order)
```

---

## Step 4: Validate Schema

Create a validation script `src/database/validate-schema.ts`:

```typescript
import { createDatabase, verifyConfiguration } from './config';
import Database from 'better-sqlite3';

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

/**
 * Validate database schema against STANDARDS.md
 */
export function validateSchema(db: Database.Database): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
    info: []
  };

  // Check configuration
  if (!verifyConfiguration(db)) {
    result.errors.push('Database configuration invalid');
    result.passed = false;
  }

  // Check all 6 canonical tables exist
  const requiredTables = [
    'conversations',
    'messages',
    'learnings',
    'job_queue',
    'uploads',
    'sanitization_log'
  ];

  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'
  `).all() as { name: string }[];

  const tableNames = tables.map(t => t.name);

  for (const table of requiredTables) {
    if (!tableNames.includes(table)) {
      result.errors.push(`Missing canonical table: ${table}`);
      result.passed = false;
    } else {
      result.info.push(`✓ Table exists: ${table}`);
    }
  }

  // Check forbidden tables (from old schema)
  const forbiddenTables = ['events', 'event_queue'];
  for (const table of forbiddenTables) {
    if (tableNames.includes(table)) {
      result.errors.push(`Forbidden table exists: ${table} (violates STANDARDS.md)`);
      result.passed = false;
    }
  }

  // Check indexes
  const criticalIndexes = [
    'idx_conversations_session',
    'idx_messages_conversation',
    'idx_learnings_category',
    'idx_job_queue_dequeue',
    'idx_uploads_learning',
    'idx_sanitization_log_conversation'
  ];

  const indexes = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='index'
  `).all() as { name: string }[];

  const indexNames = indexes.map(i => i.name);

  for (const index of criticalIndexes) {
    if (!indexNames.includes(index)) {
      result.warnings.push(`Missing recommended index: ${index}`);
    } else {
      result.info.push(`✓ Index exists: ${index}`);
    }
  }

  // Check FTS table
  if (!tableNames.includes('learnings_fts')) {
    result.errors.push('Missing FTS table: learnings_fts');
    result.passed = false;
  } else {
    result.info.push('✓ FTS table exists: learnings_fts');
  }

  // Check triggers
  const triggers = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='trigger'
  `).all() as { name: string }[];

  const criticalTriggers = [
    'conversations_updated_at',
    'messages_after_insert',
    'learnings_fts_insert',
    'job_queue_updated_at',
    'uploads_updated_at'
  ];

  const triggerNames = triggers.map(t => t.name);

  for (const trigger of criticalTriggers) {
    if (!triggerNames.includes(trigger)) {
      result.warnings.push(`Missing trigger: ${trigger}`);
    } else {
      result.info.push(`✓ Trigger exists: ${trigger}`);
    }
  }

  // Check foreign keys are enabled
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  if (foreignKeys !== 1) {
    result.errors.push('Foreign keys are NOT enabled');
    result.passed = false;
  } else {
    result.info.push('✓ Foreign keys enabled');
  }

  // Check WAL mode
  const journalMode = db.pragma('journal_mode', { simple: true });
  if (journalMode !== 'wal') {
    result.errors.push(`Journal mode is ${journalMode}, expected WAL`);
    result.passed = false;
  } else {
    result.info.push('✓ WAL mode enabled');
  }

  return result;
}

/**
 * Run validation and print results
 */
function main() {
  const dbPath = process.argv[2] || 'src/database/context.db';

  console.log(`Validating database: ${dbPath}\n`);

  const db = createDatabase({ path: dbPath });

  try {
    const result = validateSchema(db);

    // Print results
    if (result.info.length > 0) {
      console.log('INFO:');
      result.info.forEach(msg => console.log(`  ${msg}`));
      console.log();
    }

    if (result.warnings.length > 0) {
      console.log('WARNINGS:');
      result.warnings.forEach(msg => console.log(`  ⚠️  ${msg}`));
      console.log();
    }

    if (result.errors.length > 0) {
      console.log('ERRORS:');
      result.errors.forEach(msg => console.log(`  ❌ ${msg}`));
      console.log();
    }

    if (result.passed) {
      console.log('✅ VALIDATION PASSED');
      process.exit(0);
    } else {
      console.log('❌ VALIDATION FAILED');
      process.exit(1);
    }
  } finally {
    db.close();
  }
}

if (require.main === module) {
  main();
}
```

**Run Validation**:

```bash
npx tsx src/database/validate-schema.ts
```

**Expected Output**:
```
Validating database: src/database/context.db

INFO:
  ✓ Table exists: conversations
  ✓ Table exists: messages
  ✓ Table exists: learnings
  ✓ Table exists: job_queue
  ✓ Table exists: uploads
  ✓ Table exists: sanitization_log
  ✓ FTS table exists: learnings_fts
  ✓ Foreign keys enabled
  ✓ WAL mode enabled

✅ VALIDATION PASSED
```

---

## Step 5: Create Backup Procedures

Create `src/database/backup.ts`:

```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Backup database to specified path
 */
export async function backupDatabase(
  sourceDb: Database.Database,
  destPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Ensure backup directory exists
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Use SQLite backup API
      const backup = sourceDb.backup(destPath);

      const doBackup = () => {
        const remaining = backup.step(100); // Pages per step
        if (remaining === 0) {
          backup.close();
          resolve();
        } else {
          setImmediate(doBackup);
        }
      };

      doBackup();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Verify backup integrity
 */
export function verifyBackup(backupPath: string): boolean {
  const db = new Database(backupPath, { readonly: true });
  try {
    const result = db.pragma('integrity_check', { simple: true });
    return result === 'ok';
  } finally {
    db.close();
  }
}

/**
 * Create timestamped backup
 */
export async function createTimestampedBackup(
  sourceDb: Database.Database,
  backupDir: string = 'backups'
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupPath = path.join(backupDir, `context-${timestamp}.db`);

  await backupDatabase(sourceDb, backupPath);

  // Verify backup
  if (!verifyBackup(backupPath)) {
    throw new Error('Backup verification failed');
  }

  console.log(`✓ Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * Restore from backup
 */
export async function restoreFromBackup(
  backupPath: string,
  destPath: string
): Promise<void> {
  // Verify backup before restoring
  if (!verifyBackup(backupPath)) {
    throw new Error('Backup is corrupted, cannot restore');
  }

  // Create backup of current database (if exists)
  if (fs.existsSync(destPath)) {
    const currentBackup = `${destPath}.before-restore-${Date.now()}`;
    fs.copyFileSync(destPath, currentBackup);
    console.log(`✓ Current database backed up to: ${currentBackup}`);
  }

  // Copy backup to destination
  fs.copyFileSync(backupPath, destPath);

  console.log(`✓ Restored from backup: ${backupPath}`);
}

/**
 * Clean up old backups (keep last N)
 */
export function cleanupOldBackups(backupDir: string, keepCount: number = 7): void {
  if (!fs.existsSync(backupDir)) {
    return;
  }

  const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  // Keep latest N backups
  const toDelete = backups.slice(keepCount);

  for (const backup of toDelete) {
    fs.unlinkSync(backup.path);
    console.log(`✓ Deleted old backup: ${backup.name}`);
  }

  console.log(`✓ Kept ${Math.min(backups.length, keepCount)} most recent backups`);
}
```

**Test Backup**:

```bash
# Create test script
cat > src/database/test-backup.ts << 'EOF'
import { createDatabase } from './config';
import { createTimestampedBackup, verifyBackup } from './backup';

async function main() {
  const db = createDatabase({ path: 'src/database/context.db' });

  try {
    const backupPath = await createTimestampedBackup(db);
    console.log('Backup created:', backupPath);

    const isValid = verifyBackup(backupPath);
    console.log('Backup valid:', isValid);
  } finally {
    db.close();
  }
}

main().catch(console.error);
EOF

npx tsx src/database/test-backup.ts
```

---

## Step 6: Testing the Setup

Create comprehensive test suite `src/database/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from '../config';
import { validateSchema } from '../validate-schema';
import { ulid } from 'ulid';

describe('Database Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase({ path: ':memory:' });
    // Apply migrations here (if using custom migrations)
  });

  afterEach(() => {
    db.close();
  });

  it('should pass schema validation', () => {
    const result = validateSchema(db);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should enforce foreign keys', () => {
    // Try to insert message without conversation
    expect(() => {
      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, content_hash, sequence)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(ulid(), 'nonexistent', 'user', 'test', 'hash', 0);
    }).toThrow();
  });

  it('should cascade delete messages when conversation deleted', () => {
    const conversationId = ulid();
    const messageId = ulid();

    // Insert conversation
    db.prepare(`
      INSERT INTO conversations (id, session_id, correlation_id, sanitization_version)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, 'session-1', ulid(), '1.0.0');

    // Insert message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, content_hash, sequence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(messageId, conversationId, 'user', 'test', 'hash', 0);

    // Verify message exists
    let message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    expect(message).toBeDefined();

    // Delete conversation
    db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);

    // Verify message was cascade deleted
    message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    expect(message).toBeUndefined();
  });

  it('should update message_count trigger', () => {
    const conversationId = ulid();

    // Insert conversation
    db.prepare(`
      INSERT INTO conversations (id, session_id, correlation_id, sanitization_version)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, 'session-1', ulid(), '1.0.0');

    // Check initial count
    let conv = db.prepare('SELECT message_count FROM conversations WHERE id = ?').get(conversationId) as any;
    expect(conv.message_count).toBe(0);

    // Insert message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, content_hash, sequence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ulid(), conversationId, 'user', 'test', 'hash', 0);

    // Check count incremented
    conv = db.prepare('SELECT message_count FROM conversations WHERE id = ?').get(conversationId) as any;
    expect(conv.message_count).toBe(1);
  });

  it('should enforce job status enum', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO job_queue (id, type, status, payload)
        VALUES (?, ?, ?, ?)
      `).run(ulid(), 'test', 'invalid_status', '{}');
    }).toThrow();
  });

  it('should support FTS search on learnings', () => {
    const conversationId = ulid();
    const learningId = ulid();

    // Insert conversation
    db.prepare(`
      INSERT INTO conversations (id, session_id, correlation_id, sanitization_version)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, 'session-1', ulid(), '1.0.0');

    // Insert learning
    db.prepare(`
      INSERT INTO learnings (
        id, conversation_id, source_message_ids, category,
        title, content, confidence, dedupe_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      learningId,
      conversationId,
      JSON.stringify([]),
      'pattern',
      'TypeScript best practices',
      'Always use strict type checking',
      0.95,
      'hash-123'
    );

    // Search FTS
    const results = db.prepare(`
      SELECT l.title, l.content
      FROM learnings l
      JOIN learnings_fts fts ON l.rowid = fts.rowid
      WHERE learnings_fts MATCH 'typescript'
    `).all();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'TypeScript best practices'
    });
  });
});
```

**Run Tests**:

```bash
npx vitest run src/database/__tests__/schema.test.ts
```

---

## Step 7: Common Troubleshooting

### Issue: Foreign Keys Not Working

**Symptoms**: Can insert orphaned records

**Solution**:
```typescript
// Check if foreign keys are enabled
const fk = db.pragma('foreign_keys', { simple: true });
console.log('Foreign keys:', fk); // Should be 1

// Enable if not
db.pragma('foreign_keys = ON');
```

### Issue: WAL Mode Not Persisting

**Symptoms**: `journal_mode` returns 'delete' instead of 'wal'

**Solution**:
```typescript
// Set WAL mode on database creation
db.pragma('journal_mode = WAL');

// Verify
console.log(db.pragma('journal_mode', { simple: true })); // Should be 'wal'

// WAL mode persists across connections
```

### Issue: Database Locked Errors

**Symptoms**: `SQLITE_BUSY` errors during writes

**Solutions**:
1. Increase busy timeout:
   ```typescript
   db.pragma('busy_timeout = 10000'); // 10 seconds
   ```

2. Use transactions for bulk operations:
   ```typescript
   const insertMany = db.transaction((items) => {
     for (const item of items) {
       stmt.run(item);
     }
   });
   ```

3. Check for long-running readers in WAL mode

### Issue: FTS Search Not Working

**Symptoms**: FTS queries return no results

**Solution**:
```typescript
// Rebuild FTS index
db.exec("INSERT INTO learnings_fts(learnings_fts) VALUES('rebuild')");

// Verify triggers exist
const triggers = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='trigger' AND name LIKE 'learnings_fts%'
`).all();

console.log('FTS triggers:', triggers); // Should have 3 triggers
```

### Issue: Migration Version Mismatch

**Symptoms**: Migrations don't apply or report wrong version

**Solution**:
```typescript
// Check current version
const version = db.prepare(
  'SELECT MAX(version) as version FROM _migrations'
).get();

console.log('Current version:', version);

// Reset migration table (DANGER: Only in development)
db.exec('DROP TABLE IF EXISTS _migrations');
```

---

## Step 8: Production Checklist

Before deploying to production:

- [ ] **Schema Validation Passes**
  ```bash
  npx tsx src/database/validate-schema.ts
  ```

- [ ] **All Tests Pass**
  ```bash
  npm test
  ```

- [ ] **Backup System Configured**
  ```bash
  # Test backup creation
  npx tsx src/database/test-backup.ts
  ```

- [ ] **Database Files in .gitignore**
  ```bash
  grep "*.db" .gitignore  # Should exist
  ```

- [ ] **WAL Mode Enabled**
  ```sql
  PRAGMA journal_mode;  -- Should return 'wal'
  ```

- [ ] **Foreign Keys Enabled**
  ```sql
  PRAGMA foreign_keys;  -- Should return 1
  ```

- [ ] **Performance Indexes Created**
  ```sql
  SELECT COUNT(*) FROM sqlite_master WHERE type='index';
  -- Should be 20+ indexes
  ```

- [ ] **File Permissions Secure**
  ```bash
  ls -la src/database/*.db  # Should be -rw------- (600)
  ```

- [ ] **Monitoring Setup**
  - Database size tracking
  - Query performance monitoring
  - Backup verification schedule

---

## Next Steps

After completing this setup:

1. **Implement Repository Layer** - Create TypeScript repositories for each table
   - See: `docs/reference/reference-database-schema-2025-01-16.md` (Query Patterns section)

2. **Set Up Job Workers** - Implement async job processing
   - See: `docs/architecture/architecture-async-processing-2025-01-16.md`

3. **Create Hooks** - Build Claude Code hooks that use this database
   - See: `docs/architecture/architecture-hooks-event-capture-2025-01-16.md`

4. **Configure MCP Server** - Expose learnings via MCP
   - See: `docs/plans/plan-phase-5-mcp-server-2025-01-16.md`

5. **Set Up Monitoring** - Track database health and performance
   - Database size growth
   - Query latency (p50, p95, p99)
   - Backup success rate
   - Job queue depth

---

## Additional Resources

### Documentation
- [STANDARDS.md](../STANDARDS.md) - Canonical schema and patterns
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md) - Complete schema DDL
- [ADR-005: Use SQLite](../decisions/decision-use-sqlite-2025-01-16.md) - Why SQLite for MVP
- [Async Processing Architecture](../architecture/architecture-async-processing-2025-01-16.md) - Job queue usage

### External Links
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3/wiki)
- [SQLite PRAGMA Documentation](https://www.sqlite.org/pragma.html)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [Atlas Migrations](https://atlasgo.io/getting-started)
- [FTS5 Full-Text Search](https://www.sqlite.org/fts5.html)

### Tools
- **SQLite CLI**: `sqlite3 src/database/context.db`
- **DB Browser for SQLite**: GUI for exploring database
- **Atlas**: Schema migrations and versioning
- **better-sqlite3-helper**: Additional utilities for better-sqlite3

---

## Summary

You now have a fully configured SQLite database for the Global Context Network with:

✅ Optimal SQLite configuration (WAL mode, foreign keys, performance tuning)
✅ All 6 canonical tables (conversations, messages, learnings, job_queue, uploads, sanitization_log)
✅ Full-text search on learnings (FTS5)
✅ Proper indexes for query performance
✅ Migration system (Atlas or custom TypeScript)
✅ Backup and recovery procedures
✅ Validation and testing scripts
✅ 100% alignment with STANDARDS.md

**Database File**: `src/database/context.db`

**Next**: Implement repository layer and start building hooks!

---

**Questions or Issues?**

- Check the troubleshooting section above
- Review the referenced documentation
- Verify your setup against the validation script
- Check that all prerequisites are met
