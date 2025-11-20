import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema';
import { enqueueJob, dequeueJob, markJobCompleted, markJobFailed } from './jobQueue';

describe('Job Queue', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should enqueue jobs', () => {
    const jobId = enqueueJob(db, 'sanitize_async', { messageId: 'msg-1' });
    const jobs = db.prepare('SELECT * FROM job_queue WHERE id = ?').get(jobId);
    expect(jobs).toBeDefined();
    expect(jobs.type).toBe('sanitize_async');
    expect(jobs.status).toBe('queued');
  });

  it('should dequeue jobs in FIFO order', () => {
    const first = enqueueJob(db, 'sanitize_async', { idx: 1 });
    const second = enqueueJob(db, 'sanitize_async', { idx: 2 });

    const job1 = dequeueJob(db, 'sanitize_async');
    expect(job1?.id).toBe(first);
    expect(job1?.status).toBe('in_progress');

    const job2 = dequeueJob(db, 'sanitize_async');
    expect(job2?.id).toBe(second);
  });

  it('should mark jobs completed', () => {
    const jobId = enqueueJob(db, 'sanitize_async', {});
    dequeueJob(db, 'sanitize_async');
    markJobCompleted(db, jobId);

    const job = db.prepare('SELECT status FROM job_queue WHERE id = ?').get(jobId) as { status: string };
    expect(job.status).toBe('completed');
  });

  it('should retry and move to dead letter when max attempts exceeded', () => {
    const jobId = enqueueJob(db, 'sanitize_async', {}, { maxAttempts: 2 });
    dequeueJob(db, 'sanitize_async');
    markJobFailed(db, jobId, 'error 1');

    let job = db.prepare('SELECT status, attempts FROM job_queue WHERE id = ?').get(jobId) as {
      status: string;
      attempts: number;
    };
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(1);

    dequeueJob(db, 'sanitize_async');
    markJobFailed(db, jobId, 'error 2');
    job = db.prepare('SELECT status, attempts FROM job_queue WHERE id = ?').get(jobId) as {
      status: string;
      attempts: number;
    };
    expect(job.status).toBe('dead_letter');
    expect(job.attempts).toBe(2);
  });
});

