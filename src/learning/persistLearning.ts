import Database from 'better-sqlite3';
import { ulid } from 'ulid';
import { extractSimpleLearning, Conversation, Learning } from './simpleExtractor';

export function saveLearning(db: Database.Database, learning: Learning): void {
  db.prepare(
    `
      INSERT INTO learnings (id, conversation_id, category, title, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(learning.id, learning.conversation_id, learning.category, learning.title, learning.content, learning.created_at);
}

export function extractAndSaveLearning(db: Database.Database, conversation: Conversation): Learning | null {
  const found = extractSimpleLearning(conversation);
  if (!found) {
    return null;
  }

  const learningWithId = {
    ...found,
    id: ulid()
  } satisfies Learning;

  saveLearning(db, learningWithId);
  return learningWithId;
}

