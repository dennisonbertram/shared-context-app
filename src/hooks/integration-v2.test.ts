import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { join } from 'path';
import Database from 'better-sqlite3';
import { unlinkSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DB_PATH = join(process.cwd(), 'test-integration-v2.db');
const HOOK_SCRIPT = join(process.cwd(), '.claude/hooks/dist/userPromptSubmit.js');

describe('End-to-End Hook Integration (Level 5)', () => {
  beforeAll(() => {
    try { unlinkSync(DB_PATH); } catch {}
  });

  afterAll(() => {
    try { unlinkSync(DB_PATH); } catch {}
  });

  it('should sanitize multiple PII types and persist event', async () => {
    const event = {
      type: 'UserPromptSubmit',
      prompt: 'My email is user@example.com, phone is 555-123-4567, IP is 192.168.1.1, file is /Users/alice/secret.txt',
      conversation_id: 'test-conv-level-5',
      timestamp: Date.now()
    };

    // Run hook with custom DB_PATH
    const command = `echo '${JSON.stringify(event)}' | DB_PATH="${DB_PATH}" node "${HOOK_SCRIPT}"`;
    
    const { stdout, stderr } = await execAsync(command);
    
    expect(stdout).toContain('Event processed');
    expect(stderr).toBe('');

    // Verify Database State
    const db = new Database(DB_PATH);
    
    const message = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').get(event.conversation_id) as any;
    
    expect(message).toBeDefined();
    expect(message.content).toContain('[REDACTED_EMAIL]');
    expect(message.content).toContain('[REDACTED_PHONE]');
    expect(message.content).toContain('[REDACTED_IP]');
    expect(message.content).toContain('[REDACTED_PATH]');
    
    expect(message.content).not.toContain('user@example.com');
    expect(message.content).not.toContain('555-123-4567');
    expect(message.content).not.toContain('192.168.1.1');
    expect(message.content).not.toContain('/Users/alice/secret.txt');
    
    db.close();
  });
});

