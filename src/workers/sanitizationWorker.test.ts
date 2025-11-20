import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { enqueueJob } from '../queue/jobQueue';
import { processNextSanitizationJob } from './sanitizationWorker';

vi.mock('../sanitization/aiValidator', () => ({
  validateSanitization: vi.fn(async (text: string) => ({
    isClean: !text.includes('LEAK'),
    issues: text.includes('LEAK') ? ['detected leak'] : []
  }))
}));

const { validateSanitization } = await import('../sanitization/aiValidator');

describe('Sanitization Worker', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)')
      .run('conv-1', now, now);
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('msg-clean', 'conv-1', 'user', 'Hello world', 1, now);
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('msg-leak', 'conv-1', 'user', 'LEAK secret', 2, now);
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  it('should mark job completed when message is clean', async () => {
    enqueueJob(db, 'sanitize_async', { messageId: 'msg-clean' });
    const processed = await processNextSanitizationJob(db);
    expect(processed).toBe(true);
    const job = db.prepare('SELECT status FROM job_queue').get() as { status: string };
    expect(job.status).toBe('completed');
    const logs = db.prepare('SELECT * FROM sanitization_log').all();
    expect(logs).toHaveLength(0);
  });

  it('should log issues when validation finds PII', async () => {
    enqueueJob(db, 'sanitize_async', { messageId: 'msg-leak' });
    await processNextSanitizationJob(db);
    const log = db.prepare('SELECT issues FROM sanitization_log WHERE message_id = ?').get('msg-leak') as {
      issues: string;
    };
    expect(log).toBeDefined();
    expect(JSON.parse(log.issues)).toContain('detected leak');
  });

  it('should mark job failed when validator throws', async () => {
    (validateSanitization as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));
    enqueueJob(db, 'sanitize_async', { messageId: 'msg-clean' });
    await processNextSanitizationJob(db);
    const job = db.prepare('SELECT status FROM job_queue').get() as { status: string };
    expect(job.status).toBe('failed');
  });
});

