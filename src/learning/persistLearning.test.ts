import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { extractAndSaveLearning } from './persistLearning';

describe('extractAndSaveLearning', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').run('conv-1', now, now);
  });

  afterEach(() => {
    db.close();
  });

  it('should persist learning when extractor finds code', () => {
    const conversation = {
      conversation_id: 'conv-1',
      messages: [
        { role: 'user' as const, content: 'Need sample code' },
        { role: 'assistant' as const, content: 'Here: ```py\nprint(\"hi\")\n```' }
      ]
    };

    const learning = extractAndSaveLearning(db, conversation);
    expect(learning).not.toBeNull();

    const row = db.prepare('SELECT * FROM learnings WHERE conversation_id = ?').get('conv-1') as {
      id: string;
      title: string;
    };

    expect(row).toBeDefined();
    expect(row.title).toBe('Code example shared');
  });

  it('should skip persistence when extractor returns null', () => {
    const conversation = {
      conversation_id: 'conv-1',
      messages: [
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello!' }
      ]
    };

    const learning = extractAndSaveLearning(db, conversation);
    expect(learning).toBeNull();

    const count = db.prepare('SELECT COUNT(*) as cnt FROM learnings').get() as { cnt: number };
    expect(count.cnt).toBe(0);
  });
});

