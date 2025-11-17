# Phase 3: Database & Storage Tasks

> Repository pattern, query optimization, and data persistence

---
title: Phase 3 Database & Storage Tasks
category: plan
date: 2025-01-16
status: active
tags: [phase-3, database, storage, sqlite, migrations]
---

## Goal

Persist sanitized data with ACID guarantees, fast queries, and reversible migrations.

## Duration

2-3 days

## Tasks

### Repository Pattern Implementation
- [ ] Create ConversationRepository
- [ ] Create MessageRepository
- [ ] Create LearningRepository
- [ ] Create JobQueueRepository
- [ ] Create UploadRepository
- [ ] Implement common CRUD operations
- [ ] Add transaction support

**Subagent**: `repository-agent`

**Acceptance**: All repositories implemented with typed interfaces

### Conversation Table
- [ ] Implement create conversation
- [ ] Implement find conversation by ID
- [ ] Implement list conversations with pagination
- [ ] Implement update conversation metadata
- [ ] Implement soft delete (if needed)
- [ ] Add indexes for common queries

**Acceptance**: All operations < 100ms

### Messages Table
- [ ] Implement create message
- [ ] Implement find messages by conversation ID
- [ ] Implement message ordering (by timestamp)
- [ ] Implement foreign key constraints to conversations
- [ ] Add indexes for conversation_id, timestamp

**Acceptance**: Foreign keys enforced, queries < 100ms

### Learnings Table
- [ ] Implement create learning
- [ ] Implement find learning by ID
- [ ] Implement search learnings (text, category, tags)
- [ ] Implement quality scoring filter (confidence ≥ threshold)
- [ ] Add full-text search indexes
- [ ] Add category and tag indexes

**Acceptance**: Search queries < 100ms

### Job Queue Table
- [ ] Implement enqueue job
- [ ] Implement dequeue job (with locking)
- [ ] Implement update job status
- [ ] Implement retry tracking
- [ ] Add indexes for status, priority, created_at

**Acceptance**: Queue operations atomic and < 50ms

### Migration Versioning
- [ ] Implement migration version tracking table
- [ ] Create migration 001: initial tables
- [ ] Create migration 002: indexes
- [ ] Create migration 003: audit tables
- [ ] Test rollback for each migration
- [ ] Document migration process

**Acceptance**: Migrations reversible, version tracked

### Query Optimization
- [ ] Enable WAL mode for SQLite
- [ ] Create indexes for all foreign keys
- [ ] Create indexes for common filters (status, category, created_at)
- [ ] Add full-text search index for learnings
- [ ] Test query performance with realistic dataset (10k+ rows)
- [ ] Benchmark and document query times

**Subagent**: `query-optimization-agent`

**Acceptance**: All queries < 100ms on 10k+ dataset

### ACID Compliance Testing
- [ ] Test concurrent writers don't corrupt data
- [ ] Test foreign key constraints enforced
- [ ] Test transactions rollback on error
- [ ] Test no orphan messages after conversation delete
- [ ] Test isolation levels

**Acceptance**: All ACID tests pass

### Data Retention Policies
- [ ] Implement purge old conversations (configurable retention)
- [ ] Implement delete conversation with cascade
- [ ] Implement right-to-delete support
- [ ] Implement vacuum schedule for SQLite
- [ ] Document retention policies

**Acceptance**: Deletion works correctly, vacuum reduces DB size

## Dependencies

- Phase 0: Database schema
- Phase 2: Sanitized data to store

## Deliverables

1. Repository implementations for all tables
2. Migration scripts (001-003+)
3. Query optimization indexes
4. ACID compliance test suite
5. Data retention utilities
6. Performance benchmark results

## Success Criteria

- ✅ All queries < 100ms
- ✅ ACID compliance verified (concurrent writes, FK constraints)
- ✅ Migrations reversible
- ✅ WAL mode enabled
- ✅ No orphan records
- ✅ Full-text search working for learnings

## Testing Strategy

- Unit tests for each repository method
- Integration tests for cross-table operations
- Concurrent writer tests
- Foreign key constraint tests
- Performance tests with 10k+ rows
- Migration rollback tests

## Related Documents

- [Database Schema Architecture](../architecture/architecture-database-schema-2025-01-16.md)
- [Implementation Roadmap](./plan-implementation-roadmap-2025-01-16.md)
