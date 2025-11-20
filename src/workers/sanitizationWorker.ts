import Database from 'better-sqlite3';
import { join } from 'path';
import { ulid } from 'ulid';
import { dequeueJob, markJobCompleted, markJobFailed } from '../queue/jobQueue';
import { validateSanitization } from '../sanitization/aiValidator';
import { createSchema } from '../db/schema';

const DEFAULT_DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data/context.db');

export async function processNextSanitizationJob(db: Database.Database): Promise<boolean> {
  const job = dequeueJob(db, 'sanitize_async');
  if (!job) {
    return false;
  }

  try {
    const payload = JSON.parse(job.payload) as { messageId: string };
    const message = db
      .prepare('SELECT id, content FROM messages WHERE id = ?')
      .get(payload.messageId) as { id: string; content: string } | undefined;

    if (!message) {
      markJobCompleted(db, job.id);
      return true;
    }

    const validation = await validateSanitization(message.content);
    if (!validation.isClean) {
      db.prepare(
        `
          INSERT INTO sanitization_log (id, message_id, issues, created_at)
          VALUES (?, ?, ?, ?)
        `
      ).run(ulid(), message.id, JSON.stringify(validation.issues), new Date().toISOString());
    }

    markJobCompleted(db, job.id);
  } catch (error) {
    markJobFailed(db, job.id, error instanceof Error ? error.message : String(error));
  }

  return true;
}

export async function runSanitizationWorker(options?: { dbPath?: string; pollIntervalMs?: number }): Promise<void> {
  const dbPath = options?.dbPath ?? DEFAULT_DB_PATH;
  const pollInterval = options?.pollIntervalMs ?? 1000;
  const db = new Database(dbPath);
  createSchema(db);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const processed = await processNextSanitizationJob(db);
    if (!processed) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

