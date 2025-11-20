import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { getLearningById, searchLearnings } from './learningService';

describe('learningService', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').run('conv-1', now, now);
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('learn-1', 'conv-1', 'technical', 'Test', 'Content', now);
  });

  afterEach(() => {
    db.close();
  });

  it('should return learning when id exists', () => {
    const learning = getLearningById(db, 'learn-1');
    expect(learning).not.toBeNull();
    expect(learning?.title).toBe('Test');
  });

  it('should return null when id is missing', () => {
    const learning = getLearningById(db, 'missing');
    expect(learning).toBeNull();
  });

  it('should search learnings by keyword', () => {
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('learn-2', 'conv-1', 'technical', 'Array sorting', 'Use sort()', new Date().toISOString());

    const results = searchLearnings(db, { query: 'sort' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Array');
  });
});

