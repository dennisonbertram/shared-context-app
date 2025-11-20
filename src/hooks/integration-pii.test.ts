import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { join } from 'path';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { unlinkSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DB_PATH = join(process.cwd(), 'test-integration-pii.db');
const HOOK_SCRIPT = join(process.cwd(), '.claude/hooks/dist/userPromptSubmit.js');

describe('End-to-End Hook Integration with PII', () => {
  beforeAll(() => {
    try { unlinkSync(DB_PATH); } catch {}
  });

  afterAll(() => {
    try { unlinkSync(DB_PATH); } catch {}
  });

  it('should sanitize all PII types and persist event', async () => {
    const prompt =
      'Email: user@example.com | Phone: 123-456-7890 | IP: 192.168.1.1 | Path: /Users/alice/secret.txt';

    const event = {
      type: 'UserPromptSubmit',
      prompt,
      conversation_id: 'test-conv-pii',
      timestamp: Date.now()
    };

    // Ensure schema exists before hook runs (safety for flaky environments)
    const setupDb = new Database(DB_PATH);
    createSchema(setupDb);
    setupDb.close();

    const command = `echo '${JSON.stringify(event)}' | DB_PATH="${DB_PATH}" node "${HOOK_SCRIPT}"`;
    
    const { stdout, stderr } = await execAsync(command);
    expect(stderr).toBe('');
    expect(stdout).toContain('Event processed');

    const db = new Database(DB_PATH);
    const message = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').get(event.conversation_id) as any;
    
    expect(message).toBeDefined();
    expect(message.content).toContain('[REDACTED_EMAIL]');
    expect(message.content).toContain('[REDACTED_PHONE]');
    expect(message.content).toContain('[REDACTED_IP]');
    expect(message.content).toContain('[REDACTED_PATH]');
    
    expect(message.content).not.toContain('user@example.com');
    expect(message.content).not.toContain('123-456-7890');
    expect(message.content).not.toContain('192.168.1.1');
    expect(message.content).not.toContain('/Users/alice/secret.txt');
    
    db.close();
  });
});

