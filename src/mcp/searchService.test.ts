import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { searchLearnings } from './searchService';

describe('searchService', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').run('conv-1', now, now);
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('l1', 'conv-1', 'technical', 'TypeScript Tips', 'Use strict mode', now);
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('l2', 'conv-1', 'workflow', 'React Hooks', 'useState is powerful', now);
  });

  afterEach(() => {
    db.close();
  });

  it('should find learnings by title keyword', () => {
    const results = searchLearnings(db, 'Type');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('l1');
  });

  it('should respect limit', () => {
    const results = searchLearnings(db, ' ', 1);
    expect(results).toHaveLength(1);
  });

  it('should return empty array when nothing matches', () => {
    const results = searchLearnings(db, 'GraphQL');
    expect(results).toHaveLength(0);
  });
});

