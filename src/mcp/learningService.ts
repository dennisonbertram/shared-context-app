import Database from 'better-sqlite3';
import { Learning } from '../learning/simpleExtractor';

export function getLearningById(db: Database.Database, id: string): Learning | null {
  const row = db
    .prepare(
      `
        SELECT id, conversation_id, category, title, content, created_at
        FROM learnings
        WHERE id = ?
      `
    )
    .get(id) as Learning | undefined;

  return row ?? null;
}

export interface SearchLearningsParams {
  query: string;
  limit?: number;
}

export function searchLearnings(db: Database.Database, params: SearchLearningsParams): Learning[] {
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
  const term = `%${params.query}%`;

  const rows = db
    .prepare(
      `
        SELECT id, conversation_id, category, title, content, created_at
        FROM learnings
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `
    )
    .all(term, term, limit) as Learning[];

  return rows;
}

