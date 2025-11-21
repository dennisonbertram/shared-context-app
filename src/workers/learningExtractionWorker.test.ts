import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { enqueueJob } from '../queue/jobQueue';
import { processNextLearningJob } from './learningExtractionWorker';

vi.mock('../learning/aiExtractor', () => ({
  generateLearningFromConversation: vi.fn(async () => ({
    id: 'conv-1',
    category: 'insight',
    title: 'AI summary',
    content: 'Summary text',
    conversation_id: 'conv-1',
    created_at: new Date().toISOString()
  }))
}));

const { generateLearningFromConversation } = await import('../learning/aiExtractor');

describe('learningExtractionWorker', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').run('conv-1', now, now);
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('msg-1', 'conv-1', 'assistant', 'Some response', 1, now);
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  it('should store AI learning result', async () => {
    enqueueJob(db, 'extract_learning_ai', { conversationId: 'conv-1' });
    const processed = await processNextLearningJob(db);
    expect(processed).toBe(true);
    const learning = db.prepare('SELECT * FROM learnings WHERE conversation_id = ?').get('conv-1');
    expect(learning).toBeDefined();
  });

  it('should handle AI returning null', async () => {
    (generateLearningFromConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    enqueueJob(db, 'extract_learning_ai', { conversationId: 'conv-1' });
    await processNextLearningJob(db);
    const count = db.prepare('SELECT COUNT(*) as cnt FROM learnings').get() as { cnt: number };
    expect(count.cnt).toBe(0);
  });
});

