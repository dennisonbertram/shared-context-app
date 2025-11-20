import Database from 'better-sqlite3';
import { ulid } from 'ulid';

export type JobStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'dead_letter';

export interface JobRecord {
  id: string;
  type: string;
  payload: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

export function enqueueJob(
  db: Database.Database,
  type: string,
  payload: unknown,
  options?: { maxAttempts?: number }
): string {
  const id = ulid();
  const now = new Date().toISOString();
  const serializedPayload = JSON.stringify(payload);

  db.prepare(
    `
      INSERT INTO job_queue (id, type, payload, status, attempts, max_attempts, created_at, updated_at)
      VALUES (?, ?, ?, 'queued', 0, ?, ?, ?)
    `
  ).run(id, type, serializedPayload, options?.maxAttempts ?? 3, now, now);

  return id;
}

export function dequeueJob(db: Database.Database, type: string): JobRecord | null {
  const now = new Date().toISOString();
  const job = db
    .prepare(
      `
        SELECT * FROM job_queue
        WHERE status = 'queued' AND type = ?
        ORDER BY created_at ASC
        LIMIT 1
      `
    )
    .get(type) as JobRecord | undefined;

  if (!job) {
    return null;
  }

  db.prepare(
    `
      UPDATE job_queue
      SET status = 'in_progress', updated_at = ?
      WHERE id = ?
    `
  ).run(now, job.id);

  return { ...job, status: 'in_progress', updated_at: now };
}

export function markJobCompleted(db: Database.Database, id: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE job_queue
      SET status = 'completed', updated_at = ?, error = NULL
      WHERE id = ?
    `
  ).run(now, id);
}

export function markJobFailed(db: Database.Database, id: string, error: string): void {
  const now = new Date().toISOString();
  const job = db
    .prepare('SELECT attempts, max_attempts FROM job_queue WHERE id = ?')
    .get(id) as { attempts: number; max_attempts: number } | undefined;

  if (!job) {
    return;
  }

  const attempts = job.attempts + 1;
  const status: JobStatus = attempts >= job.max_attempts ? 'dead_letter' : 'failed';

  db.prepare(
    `
      UPDATE job_queue
      SET status = ?, attempts = ?, error = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(status, attempts, error, now, id);
}

