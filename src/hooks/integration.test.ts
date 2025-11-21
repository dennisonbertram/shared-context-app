import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { join } from 'path';
import Database from 'better-sqlite3';
import { unlinkSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DB_PATH = join(process.cwd(), 'test-integration.db');
const HOOK_SCRIPT = join(process.cwd(), '.claude/hooks/dist/userPromptSubmit.js');

describe('End-to-End Hook Integration', () => {
  beforeAll(() => {
    try { unlinkSync(DB_PATH); } catch {}
  });

  afterAll(() => {
    try { unlinkSync(DB_PATH); } catch {}
  });

  it('should sanitize mixed PII types', async () => {
    const event = {
      type: 'UserPromptSubmit',
      prompt: 'Email: user@example.com, Phone: 123-456-7890, IP: 192.168.1.1, Path: /Users/me/file.txt',
      conversation_id: 'test-conv-mixed',
      timestamp: Date.now()
    };

    const command = `echo '${JSON.stringify(event)}' | DB_PATH="${DB_PATH}" node "${HOOK_SCRIPT}"`;
    await execAsync(command);

    const db = new Database(DB_PATH);
    const message = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').get(event.conversation_id) as any;
    
    expect(message.content).toContain('[REDACTED_EMAIL]');
    expect(message.content).toContain('[REDACTED_PHONE]');
    expect(message.content).toContain('[REDACTED_IP]');
    expect(message.content).toContain('[REDACTED_PATH]');
    expect(message.content).not.toContain('user@example.com');
    expect(message.content).not.toContain('123-456-7890');
    expect(message.content).not.toContain('192.168.1.1');
    expect(message.content).not.toContain('/Users/me/file.txt');
    
    db.close();
  });

  it('should maintain conversation sequence using session_id', async () => {
    const baseEvent = {
      type: 'UserPromptSubmit',
      session_id: 'session-abc',
      prompt: 'First message from session',
      timestamp: Date.now()
    };

    // First message
    await execAsync(`echo '${JSON.stringify(baseEvent)}' | DB_PATH="${DB_PATH}" node "${HOOK_SCRIPT}"`);

    // Second message (same session)
    const secondEvent = { ...baseEvent, prompt: 'Second message from same session' };
    await execAsync(`echo '${JSON.stringify(secondEvent)}' | DB_PATH="${DB_PATH}" node "${HOOK_SCRIPT}"`);

    const db = new Database(DB_PATH);
    const conversation = db
      .prepare('SELECT id FROM conversations WHERE session_id = ?')
      .get('session-abc') as { id: string } | undefined;

    expect(conversation).toBeDefined();

    const messages = db
      .prepare(
        `SELECT conversation_id, sequence, content FROM messages WHERE conversation_id = ? ORDER BY sequence ASC`
      )
      .all(conversation!.id) as Array<{ conversation_id: string; sequence: number; content: string }>;

    expect(messages).toHaveLength(2);
    expect(messages[0].sequence).toBe(1);
    expect(messages[1].sequence).toBe(2);
    db.close();
  });

  it('should enqueue job for async sanitization', async () => {
    const event = {
      type: 'UserPromptSubmit',
      prompt: 'Another message to queue job',
      conversation_id: 'job-test-1',
      timestamp: Date.now()
    };

    await execAsync(`echo '${JSON.stringify(event)}' | DB_PATH="${DB_PATH}" node "${HOOK_SCRIPT}"`);

    const db = new Database(DB_PATH);
    const job = db
      .prepare('SELECT type, status, payload FROM job_queue WHERE type = ? ORDER BY created_at DESC LIMIT 1')
      .get('sanitize_async') as { type: string; status: string; payload: string } | undefined;

    expect(job).toBeDefined();
    expect(job?.status).toBe('queued');
    const payload = JSON.parse(job!.payload);
    expect(payload.messageId).toBeDefined();
    expect(payload.conversationId).toBe('job-test-1');
    db.close();
  });

  it('should enqueue learning job when assistant message is captured', async () => {
    const event = {
      type: 'UserPromptSubmit',
      role: 'assistant',
      content: 'Here is code ```js const x = 1 ```',
      conversation_id: 'conv-learning',
      timestamp: Date.now()
    };

    await execAsync(`echo '${JSON.stringify(event)}' | DB_PATH="${DB_PATH}" node "${HOOK_SCRIPT}"`);
    const db = new Database(DB_PATH);
    const job = db
      .prepare('SELECT type FROM job_queue WHERE type = ? ORDER BY created_at DESC LIMIT 1')
      .get('extract_learning_ai') as { type: string } | undefined;
    expect(job).toBeDefined();
    db.close();
  });
});
