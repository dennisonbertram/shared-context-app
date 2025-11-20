import { describe, it, expect, afterEach } from 'vitest';
import { createDb } from './connection';
import { createSchema } from './schema';

describe('Database Schema', () => {
  let db: ReturnType<typeof createDb>;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('should create tables successfully', () => {
    db = createDb();
    createSchema(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('job_queue');
    expect(tableNames).toContain('sanitization_log');
    expect(tableNames).toContain('learnings');
  });

  it('should enforce foreign key constraints', () => {
    db = createDb();
    createSchema(db);

    // Insert conversation
    db.prepare('INSERT INTO conversations (id, session_id, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('conv-1', 'session-1', '2024-01-01', '2024-01-01');

    // Insert message (valid)
    db.prepare('INSERT INTO messages (id, conversation_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('msg-1', 'conv-1', 'user', 'hello', 1, '2024-01-01');

    // Insert message (invalid FK)
    expect(() => {
      db.prepare('INSERT INTO messages (id, conversation_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('msg-2', 'conv-999', 'user', 'hello', 1, '2024-01-01');
    }).toThrow();
  });
});
