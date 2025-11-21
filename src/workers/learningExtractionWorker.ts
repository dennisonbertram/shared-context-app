import Database from 'better-sqlite3';
import { join } from 'path';
import { ulid } from 'ulid';
import { createSchema } from '../db/schema';
import { dequeueJob, markJobCompleted, markJobFailed } from '../queue/jobQueue';
import { getConversation } from '../learning/conversationService';
import { generateLearningFromConversation } from '../learning/aiExtractor';
import { saveLearning } from '../learning/persistLearning';

const DEFAULT_DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data/context.db');

export interface LearningWorkerOptions {
  dbPath?: string;
  pollIntervalMs?: number;
}

export async function processNextLearningJob(db: Database.Database): Promise<boolean> {
  const job = dequeueJob(db, 'extract_learning_ai');
  if (!job) {
    return false;
  }

  try {
    const payload = JSON.parse(job.payload) as { conversationId: string };
    const conversation = getConversation(db, payload.conversationId);
    if (!conversation.messages.length) {
      markJobCompleted(db, job.id);
      return true;
    }

    const learning = await generateLearningFromConversation(conversation);
    if (learning) {
      saveLearning(db, { ...learning, id: ulid() });
    }

    markJobCompleted(db, job.id);
  } catch (error) {
    markJobFailed(db, job.id, error instanceof Error ? error.message : String(error));
  }

  return true;
}

export async function runLearningExtractionWorker(options?: LearningWorkerOptions): Promise<void> {
  const dbPath = options?.dbPath ?? DEFAULT_DB_PATH;
  const pollInterval = options?.pollIntervalMs ?? 1000;
  const db = new Database(dbPath);
  createSchema(db);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const processed = await processNextLearningJob(db);
    if (!processed) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

