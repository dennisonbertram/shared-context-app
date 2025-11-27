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

  it('should find learnings by title keyword', () => {
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('learn-2', 'conv-1', 'technical', 'TypeScript Tips', 'Use strict mode', new Date().toISOString());
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('learn-3', 'conv-1', 'workflow', 'React Hooks', 'useState is powerful', new Date().toISOString());

    const results = searchLearnings(db, { query: 'Type' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('learn-2');
  });

  it('should respect limit parameter', () => {
    db.prepare(
      'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('learn-limit-test', 'conv-1', 'technical', 'Second learning', 'Content 2', new Date().toISOString());

    const results = searchLearnings(db, { query: ' ', limit: 1 });
    expect(results).toHaveLength(1);
  });

  it('should return empty array when nothing matches', () => {
    const results = searchLearnings(db, { query: 'GraphQL' });
    expect(results).toHaveLength(0);
  });

  it('should clamp limit to maximum of 50', () => {
    for (let i = 10; i < 70; i++) {
      db.prepare(
        'INSERT INTO learnings (id, conversation_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(`learn-limit-${i}`, 'conv-1', 'technical', `Learning ${i}`, `Content ${i}`, new Date().toISOString());
    }

    const results = searchLearnings(db, { query: 'Learning', limit: 100 });
    expect(results).toHaveLength(50);
  });

  it('should clamp limit to minimum of 1', () => {
    const results = searchLearnings(db, { query: 'Test', limit: 0 });
    expect(results).toHaveLength(1);
  });
});

