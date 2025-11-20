import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { extractAndSaveLearning } from './persistLearning';
import { getConversation } from './conversationService';

describe('Learning Extraction Integration', () => {
  it('should load conversation and persist learning', () => {
    const db = new Database(':memory:');
    createSchema(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').run('conv-learn', now, now);
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('msg-1', 'conv-learn', 'user', 'Show me code', 1, now);
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('msg-2', 'conv-learn', 'assistant', 'Use ```js\nconsole.log("hi")\n```', 2, now);

    const conversation = getConversation(db, 'conv-learn');
    const learning = extractAndSaveLearning(db, conversation);

    expect(learning).not.toBeNull();
    const stored = db.prepare('SELECT * FROM learnings WHERE conversation_id = ?').get('conv-learn');
    expect(stored).toBeDefined();
    db.close();
  });
});

