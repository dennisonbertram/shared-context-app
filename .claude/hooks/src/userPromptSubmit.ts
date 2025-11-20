/**
 * UserPromptSubmit Hook
 * Receives events from Claude via stdin, sanitizes them, and persists to SQLite
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { ulid } from 'ulid';

// ------------------------------------------------------------------
// Sanitization Logic (Duplicated from src/sanitization/fast-sanitize.ts)
// ------------------------------------------------------------------

// Email regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone regex (with lookbehind)
const PHONE_REGEX = /(?<=^|\s|\b)(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// IP regex
const IP_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

// Path regex
const PATH_REGEX = /(\/Users\/|\/home\/)[a-zA-Z0-9_-]+\/[^\s]*/g;

function sanitize(text: string): string {
  if (!text) return text;
  let result = text;
  result = result.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
  result = result.replace(PHONE_REGEX, '[REDACTED_PHONE]');
  result = result.replace(IP_REGEX, '[REDACTED_IP]');
  result = result.replace(PATH_REGEX, '[REDACTED_PATH]');
  return result;
}

// ------------------------------------------------------------------
// Hook Infrastructure
// ------------------------------------------------------------------

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data/context.db');

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks as readonly Uint8Array[]).toString('utf-8');
}

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(session_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS job_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued', 'in_progress', 'completed', 'failed', 'dead_letter')),
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_job_queue_status_type
      ON job_queue(status, type, created_at);

    CREATE TABLE IF NOT EXISTS sanitization_log (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      issues TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `);
}

function getNextSequence(db: Database.Database, conversationId: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(sequence), 0) as max_sequence FROM messages WHERE conversation_id = ?')
    .get(conversationId) as { max_sequence?: number } | undefined;
  const maxSequence = row?.max_sequence ?? 0;
  return maxSequence + 1;
}

function getOrCreateConversationId(
  db: Database.Database,
  event: { conversation_id?: string; session_id?: string },
  now: string
): string {
  if (event.conversation_id) {
    return event.conversation_id;
  }

  if (event.session_id) {
    const existing = db
      .prepare('SELECT id FROM conversations WHERE session_id = ?')
      .get(event.session_id) as { id: string } | undefined;
    if (existing?.id) {
      return existing.id;
    }

    const newId = ulid();
    db.prepare(
      'INSERT OR IGNORE INTO conversations (id, session_id, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(newId, event.session_id, now, now);
    return newId;
  }

  return ulid();
}

function enqueueJob(db: Database.Database, type: string, payload: unknown, maxAttempts = 3): void {
  const id = ulid();
  const now = new Date().toISOString();
  const serialized = JSON.stringify(payload);

  db.prepare(
    `
      INSERT INTO job_queue (id, type, payload, status, attempts, max_attempts, created_at, updated_at)
      VALUES (?, ?, ?, 'queued', 0, ?, ?, ?)
    `
  ).run(id, type, serialized, maxAttempts, now, now);
}

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!input) return;

    const event = JSON.parse(input);
    
    // Sanitize content
    const content = (event as { prompt?: string }).prompt || ''; 
    const sanitizedContent = sanitize(content);

    // Persist to DB
    const db = getDb();
    ensureSchema(db);

    const now = new Date().toISOString();
    const conversationId = getOrCreateConversationId(db, event, now);
    const messageId = ulid();
    const sequence = getNextSequence(db, conversationId);

    // Ensure conversation exists
    db.prepare(`
      INSERT OR IGNORE INTO conversations (id, session_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, (event as { session_id?: string }).session_id ?? null, now, now);

    // Insert message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, sequence, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(messageId, conversationId, 'user', sanitizedContent, sequence, now);

    enqueueJob(db, 'sanitize_async', {
      messageId,
      conversationId,
      sequence,
      created_at: now
    });

    db.close();

    console.log('Event processed:', {
      type: 'UserPromptSubmit',
      id: messageId,
      sanitized: sanitizedContent !== content
    });

  } catch (error) {
    // Fail silently - never block user
    console.error('Hook error:', error);
  }
}

main();
