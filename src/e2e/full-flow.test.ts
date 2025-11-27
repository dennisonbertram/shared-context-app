import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { processNextSanitizationJob } from '../workers/sanitizationWorker';
import { processNextLearningJob } from '../workers/learningExtractionWorker';
import { searchLearnings } from '../mcp/learningService';

const DB_PATH = join(process.cwd(), 'test-e2e-full.db');
const HOOK_SCRIPT = join(process.cwd(), '.claude/hooks/dist/userPromptSubmit.js');

async function runHook(event: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [HOOK_SCRIPT], {
      env: { ...process.env, DB_PATH },
      stdio: ['pipe', 'ignore', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Hook exited with code ${code}: ${stderr}`));
      }
    });

    child.stdin.write(JSON.stringify(event));
    child.stdin.end();
  });
}

async function drainSanitizationJobs(db: Database.Database): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const processed = await processNextSanitizationJob(db);
    if (!processed) break;
  }
}

async function drainLearningJobs(db: Database.Database): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const processed = await processNextLearningJob(db);
    if (!processed) break;
  }
}

function cleanupDb(): void {
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
  }
}

describe('Full system integration', () => {
  beforeAll(() => {
    cleanupDb();
  });

  afterAll(() => {
    cleanupDb();
  });

  it('captures, sanitizes, processes jobs, and exposes learnings via MCP search', async () => {
    const conversationId = `conv-${Date.now()}`;
    const openAiKey = `sk-${'a'.repeat(48)}`;
    const anthropicKey = `sk-ant-${'b'.repeat(95)}`;
    const awsKey = 'AKIA1234567890ABCDEF';
    const githubToken = `ghp_${'c'.repeat(36)}`;
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRlbm4iLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const sshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAB
-----END OPENSSH PRIVATE KEY-----`;
    const creditCard = '4111 1111 1111 1111';
    const ssn = '123-45-6789';

    const userPrompt = [
      `Email user@example.com so I can send ${creditCard}`,
      `Phone +1 (404) 555-1212 or IP 203.0.113.42 for SSH ${sshKey}`,
      `Config path /Users/dennis/secrets.txt & OpenAI ${openAiKey}`,
      `Anthropic ${anthropicKey} AWS ${awsKey}`,
      `GitHub token ${githubToken} JWT ${jwt} SSN ${ssn}`
    ].join(' | ');

    await runHook({
      type: 'UserPromptSubmit',
      role: 'user',
      prompt: userPrompt,
      conversation_id: conversationId,
      timestamp: new Date().toISOString()
    });

    await runHook({
      type: 'UserPromptSubmit',
      role: 'assistant',
      content: 'Here is the code fix:\n```ts\nconst answer = 42;\n```',
      conversation_id: conversationId,
      timestamp: new Date().toISOString()
    });

    const db = new Database(DB_PATH);
    createSchema(db);

    const messages = db
      .prepare(
        'SELECT sequence, content FROM messages WHERE conversation_id = ? ORDER BY sequence ASC'
      )
      .all(conversationId) as Array<{ sequence: number; content: string }>;

    expect(messages).toHaveLength(2);
    const firstMessage = messages[0]?.content ?? '';
    expect(firstMessage).toContain('[REDACTED_EMAIL]');
    expect(firstMessage).toContain('[REDACTED_PHONE]');
    expect(firstMessage).toContain('[REDACTED_IP]');
    expect(firstMessage).toContain('[REDACTED_PATH]');
    expect(firstMessage).toContain('[REDACTED_API_KEY_OPENAI]');
    expect(firstMessage).toContain('[REDACTED_API_KEY_ANTHROPIC]');
    expect(firstMessage).toContain('[REDACTED_AWS_ACCESS_KEY]');
    expect(firstMessage).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(firstMessage).toContain('[REDACTED_JWT]');
    expect(firstMessage).toContain('[REDACTED_SSH_KEY]');
    expect(firstMessage).toContain('[REDACTED_CREDIT_CARD]');
    expect(firstMessage).toContain('[REDACTED_SSN]');
    expect(firstMessage).not.toContain('user@example.com');
    expect(firstMessage).not.toContain(openAiKey);
    expect(firstMessage).not.toContain(awsKey);

    await drainSanitizationJobs(db);
    await drainLearningJobs(db);

    const jobs = db
      .prepare('SELECT type, status FROM job_queue ORDER BY created_at ASC')
      .all() as Array<{ type: string; status: string }>;

    expect(jobs).toHaveLength(3);
    expect(jobs.every((job) => job.status === 'completed')).toBe(true);
    expect(jobs.filter((job) => job.type === 'sanitize_async')).toHaveLength(2);
    expect(jobs.filter((job) => job.type === 'extract_learning_ai')).toHaveLength(1);

    const learnings = searchLearnings(db, { query: 'code', limit: 5 });
    expect(learnings.length).toBeGreaterThan(0);
    expect(learnings.some((learning) => learning.conversation_id === conversationId)).toBe(true);

    db.close();
  });
});

