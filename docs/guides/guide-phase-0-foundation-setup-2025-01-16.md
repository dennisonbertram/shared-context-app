# Phase 0 Foundation Setup Guide

> Complete step-by-step guide to set up TypeScript, Vitest, and SQLite infrastructure

---
title: Phase 0 Foundation Setup Guide
category: guide
date: 2025-01-16
status: active
authors: Claude + Dennison
tags: [guide, phase-0, typescript, vitest, sqlite, setup]
---

## Overview

This guide walks you through setting up the foundation for the Global Context Network MVP. By the end, you'll have a production-ready TypeScript project with strict type checking, comprehensive testing infrastructure, and SQLite database with migrations.

**Time to complete**: 60-90 minutes

## What You'll Build

- TypeScript project with strict mode enabled
- Vitest testing infrastructure with coverage
- SQLite database with type-safe queries
- Migration system for schema evolution
- Linting and formatting toolchain
- Complete project structure

## Prerequisites

- **Node.js 18+**: Check with `node --version`
- **npm 8+**: Check with `npm --version`
- **Basic TypeScript knowledge**: Understanding of types, interfaces, async/await
- **Command line familiarity**: Comfortable with terminal/bash commands

### OS-Specific Requirements

**Windows Users**:
```bash
# Install build tools for better-sqlite3
npm install --global windows-build-tools
```

**macOS/Linux**:
```bash
# Ensure you have build-essential (usually pre-installed)
# macOS: Install Xcode Command Line Tools if prompted
```

## Step 1: Initialize TypeScript Project

### 1.1 Create Project Directory

```bash
# Create and enter project directory
mkdir global-context-network
cd global-context-network

# Initialize git
git init
```

### 1.2 Initialize npm Project

```bash
# Create package.json
npm init -y
```

### 1.3 Install Dependencies

```bash
# TypeScript and build tools
npm install -D typescript@5.3.3 ts-node@10.9.2 @types/node@20.10.6

# Testing infrastructure
npm install -D vitest@1.1.0 @vitest/ui@1.1.0 @vitest/coverage-v8@1.1.0

# Database
npm install better-sqlite3@9.2.2
npm install -D @types/better-sqlite3@7.6.8

# Code quality
npm install -D eslint@8.56.0 @typescript-eslint/eslint-plugin@6.17.0 @typescript-eslint/parser@6.17.0
npm install -D prettier@3.1.1

# Utility libraries
npm install dotenv@16.3.1
```

**Expected output**:
```
added 234 packages, and audited 235 packages in 12s
```

### 1.4 Create TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 1.5 Create ESLint Configuration

Create `.eslintrc.cjs`:

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

### 1.6 Create Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### 1.7 Update package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\"",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:once": "vitest run",
    "coverage": "vitest run --coverage",
    "db:migrate": "ts-node src/db/migrate.ts",
    "db:reset": "rm -f data/context.db && npm run db:migrate"
  }
}
```

### Verification Step 1

```bash
# Type check should pass (no files yet, that's OK)
npm run typecheck

# Lint should pass
npm run lint
```

**Expected output**:
```
✓ No TypeScript errors
✓ ESLint: no problems
```

## Step 2: Set Up Testing Infrastructure

### 2.1 Create Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'src/db/migrate.ts',
      ],
      all: true,
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85,
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 2.2 Create Test Utilities Directory

```bash
mkdir -p src/test-utils
```

Create `src/test-utils/db.ts`:

```typescript
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

/**
 * Creates an in-memory SQLite database for testing
 */
export function createTestDatabase(): Database.Database {
  return new Database(':memory:', { verbose: console.log });
}

/**
 * Creates a temporary file-based database for testing
 */
export function createTempDatabase(): Database.Database {
  const dbPath = join(tmpdir(), `test-${randomUUID()}.db`);
  return new Database(dbPath);
}

/**
 * Runs migrations on a test database
 */
export function migrateTestDatabase(db: Database.Database): void {
  // Run schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      message_count INTEGER DEFAULT 0,
      sanitized BOOLEAN DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE INDEX idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX idx_conversations_started ON conversations(started_at);
  `);
}

/**
 * Cleans up test database
 */
export function cleanupTestDatabase(db: Database.Database): void {
  try {
    db.close();
  } catch (error) {
    console.warn('Failed to close database:', error);
  }
}
```

### 2.3 Create Example Test

Create `src/test-utils/db.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { createTestDatabase, migrateTestDatabase, cleanupTestDatabase } from './db';

describe('Test Database Utilities', () => {
  let db: ReturnType<typeof createTestDatabase>;

  afterEach(() => {
    if (db) {
      cleanupTestDatabase(db);
    }
  });

  it('should create an in-memory database', () => {
    db = createTestDatabase();
    expect(db).toBeDefined();
    expect(db.memory).toBe(true);
  });

  it('should run migrations successfully', () => {
    db = createTestDatabase();
    migrateTestDatabase(db);

    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();

    const tableNames = tables.map((t: any) => t.name);
    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('messages');
  });

  it('should insert and retrieve a conversation', () => {
    db = createTestDatabase();
    migrateTestDatabase(db);

    const conversationId = 'test-123';
    const startedAt = Date.now();

    db.prepare(
      `INSERT INTO conversations (id, started_at) VALUES (?, ?)`
    ).run(conversationId, startedAt);

    const result = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);

    expect(result).toBeDefined();
    expect((result as any).id).toBe(conversationId);
    expect((result as any).started_at).toBe(startedAt);
  });
});
```

### Verification Step 2

```bash
# Run tests
npm run test:once
```

**Expected output**:
```
✓ src/test-utils/db.test.ts (3)
  ✓ Test Database Utilities (3)
    ✓ should create an in-memory database
    ✓ should run migrations successfully
    ✓ should insert and retrieve a conversation

Test Files  1 passed (1)
     Tests  3 passed (3)
```

## Step 3: Set Up Database Infrastructure

### 3.1 Create Database Directory

```bash
mkdir -p src/db
mkdir -p data
```

### 3.2 Create Database Schema

Create `src/db/schema.sql`:

```sql
-- Conversations table (sanitized)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  message_count INTEGER DEFAULT 0,
  sanitized BOOLEAN DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Messages table (sanitized)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Learnings table
CREATE TABLE IF NOT EXISTS learnings (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT, -- JSON array
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Job queue table
CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Sanitization log (audit trail)
CREATE TABLE IF NOT EXISTS sanitization_log (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  pii_type TEXT NOT NULL,
  redaction_count INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at);
CREATE INDEX IF NOT EXISTS idx_learnings_conversation ON learnings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
CREATE INDEX IF NOT EXISTS idx_learnings_confidence ON learnings(confidence);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_created ON job_queue(created_at);
```

### 3.3 Create Migration Runner

Create `src/db/migrate.ts`:

```typescript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/context.db');

export function runMigrations(): Database.Database {
  console.log(`Running migrations on database: ${DB_PATH}`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Read and execute schema
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  db.exec(schema);

  console.log('✓ Migrations complete');
  return db;
}

// Run if executed directly
if (require.main === module) {
  runMigrations();
}
```

### 3.4 Create Database Connection Module

Create `src/db/index.ts`:

```typescript
import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/context.db');

let dbInstance: Database.Database | null = null;

/**
 * Get singleton database connection
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    try {
      dbInstance = new Database(DB_PATH);
      dbInstance.pragma('journal_mode = WAL');
      dbInstance.pragma('foreign_keys = ON');
      console.log(`✓ Database connected: ${DB_PATH}`);
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
      dbInstance = null;
      console.log('✓ Database connection closed');
    } catch (error) {
      console.warn('Failed to close database:', error);
    }
  }
}

/**
 * Execute database query with error handling
 */
export function executeQuery<T>(
  queryFn: (db: Database.Database) => T
): T {
  const db = getDatabase();
  try {
    return queryFn(db);
  } catch (error) {
    console.error('Database query failed:', error);
    throw error;
  }
}
```

### 3.5 Create Database Test

Create `src/db/index.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase, executeQuery } from './index';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Use temp database for tests
process.env.DB_PATH = join(tmpdir(), `test-${randomUUID()}.db`);

describe('Database Connection', () => {
  beforeAll(async () => {
    // Run migrations
    const { runMigrations } = await import('./migrate');
    runMigrations();
  });

  afterAll(() => {
    closeDatabase();
  });

  it('should connect to database', () => {
    const db = getDatabase();
    expect(db).toBeDefined();
  });

  it('should execute queries successfully', () => {
    const result = executeQuery((db) => {
      return db.prepare('SELECT 1 as result').get();
    });

    expect(result).toEqual({ result: 1 });
  });

  it('should insert and retrieve data', () => {
    const conversationId = 'test-' + randomUUID();

    executeQuery((db) => {
      db.prepare(
        'INSERT INTO conversations (id, started_at) VALUES (?, ?)'
      ).run(conversationId, Date.now());
    });

    const conversation = executeQuery((db) => {
      return db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    });

    expect(conversation).toBeDefined();
    expect((conversation as any).id).toBe(conversationId);
  });
});
```

### Verification Step 3

```bash
# Run migrations
npm run db:migrate

# Run database tests
npm run test:once -- src/db/index.test.ts
```

**Expected output**:
```
Running migrations on database: /path/to/data/context.db
✓ Migrations complete

✓ src/db/index.test.ts (3)
  ✓ Database Connection (3)
```

## Step 4: Create Environment Configuration

### 4.1 Create .env File

Create `.env`:

```bash
# Database
DB_PATH=./data/context.db

# Logging
LOG_LEVEL=info

# Anthropic API (for future use)
ANTHROPIC_API_KEY=your-api-key-here

# MCP Test Runner (for future use)
MCP_TEST_RUNNER_URL=http://localhost:3000
```

### 4.2 Create .env.example

Create `.env.example`:

```bash
# Database
DB_PATH=./data/context.db

# Logging
LOG_LEVEL=info

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# MCP Test Runner
MCP_TEST_RUNNER_URL=http://localhost:3000
```

### 4.3 Create .gitignore

Create `.gitignore`:

```
# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Environment
.env
.env.local

# Database
data/
*.db
*.db-shm
*.db-wal

# Testing
coverage/
.vitest/

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Repomix
*repomix*.txt
```

## Step 5: Create Project Structure

### 5.1 Create Directory Structure

```bash
mkdir -p src/{hooks,sanitization,queue,learning,mcp,types}
```

### 5.2 Create Types Directory

Create `src/types/index.ts`:

```typescript
/**
 * Core domain types
 */

export interface Conversation {
  id: string;
  started_at: number;
  ended_at?: number;
  message_count: number;
  sanitized: boolean;
  created_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  created_at: number;
}

export interface Learning {
  id: string;
  conversation_id: string;
  category: LearningCategory;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  created_at: number;
}

export type LearningCategory =
  | 'pattern'
  | 'best_practice'
  | 'anti_pattern'
  | 'bug_fix'
  | 'optimization'
  | 'tool_usage'
  | 'workflow'
  | 'decision';

export interface Job {
  id: string;
  type: JobType;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  error?: string;
  created_at: number;
  updated_at: number;
}

export type JobType = 'sanitize_conversation' | 'extract_learning' | 'mine_upload';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SanitizationLog {
  id: string;
  conversation_id: string;
  pii_type: PIIType;
  redaction_count: number;
  timestamp: number;
}

export type PIIType =
  | 'api_key'
  | 'file_path'
  | 'email'
  | 'ip_address'
  | 'name'
  | 'phone'
  | 'url_token';
```

### 5.3 Verify Project Structure

```bash
tree -L 2 src/
```

**Expected output**:
```
src/
├── db
│   ├── index.test.ts
│   ├── index.ts
│   ├── migrate.ts
│   └── schema.sql
├── hooks
├── learning
├── mcp
├── queue
├── sanitization
├── test-utils
│   ├── db.test.ts
│   └── db.ts
└── types
    └── index.ts
```

## Final Verification

### Run All Checks

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Format check
npm run format:check

# Run all tests
npm run test:once

# Generate coverage
npm run coverage

# Build
npm run build
```

**Expected output**:
```
✓ TypeScript: No errors
✓ ESLint: No problems
✓ Prettier: All files formatted
✓ Tests: 6 passed
✓ Coverage: 100% (minimal code so far)
✓ Build: Successful
```

### Verify Database

```bash
# Check database was created
ls -lh data/context.db

# Inspect schema
sqlite3 data/context.db ".schema"
```

**Expected output**:
```
-rw-r--r-- 1 user staff 28K Jan 16 10:00 data/context.db

CREATE TABLE conversations (...);
CREATE TABLE messages (...);
CREATE TABLE learnings (...);
...
```

## You're Done When...

- ✅ All npm scripts run successfully
- ✅ Type checking passes with strict mode
- ✅ All tests pass (6/6)
- ✅ Coverage report generates
- ✅ Database migrations run without errors
- ✅ Project builds to `dist/` directory
- ✅ `.env` file configured
- ✅ Directory structure matches specification

## Troubleshooting

### Issue: better-sqlite3 build fails

**Windows**:
```bash
npm install --global windows-build-tools
npm rebuild better-sqlite3
```

**macOS**:
```bash
xcode-select --install
npm rebuild better-sqlite3
```

**Linux**:
```bash
sudo apt-get install build-essential
npm rebuild better-sqlite3
```

### Issue: TypeScript errors on strict mode

Check `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

Add explicit types to all functions and variables.

### Issue: Vitest not finding tests

Ensure test files end with `.test.ts` or `.spec.ts` and are in `src/` directory.

### Issue: Database locked

Close any open connections:
```bash
npm run db:reset
```

If still locked, find and kill SQLite processes:
```bash
# macOS/Linux
lsof | grep context.db
kill -9 <PID>
```

## Next Steps

Now that your foundation is set up, you can proceed to:

1. [Claude Agent SDK Integration](./guide-claude-agent-sdk-integration-2025-01-16.md) - Set up the Agent SDK for subagent orchestration
2. [Using Subagents](./guide-using-subagents-2025-01-16.md) - Learn to delegate to specialized agents
3. [Phase 1 Hook Development](./guide-phase-1-hook-development-2025-01-16.md) - Implement event capture hooks

## Related Documents

- [Global Context Network Architecture](../architecture/architecture-global-context-network-2025-01-16.md)
- [Database Schema Reference](../reference/reference-database-schema-2025-01-16.md)
- [Testing Strategy](../reference/reference-testing-strategy-2025-01-16.md)
- [Implementation Roadmap](../plans/plan-implementation-roadmap-2025-01-16.md)
