import Database from 'better-sqlite3';

/**
 * Initialize database schema
 * Creates all required tables and indexes if they don't exist
 */
export function createSchema(db: Database.Database): void {
  // 1. Conversations table
  // Stores metadata about conversation sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(session_id)
    );
  `);

  // 2. Messages table
  // Stores INDIVIDUAL messages. Content MUST be sanitized before insertion.
  // Raw PII should NEVER touch this table.
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, sequence);

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

    CREATE INDEX IF NOT EXISTS idx_sanitization_log_message
      ON sanitization_log(message_id, created_at);
  `);
}
