import Database from 'better-sqlite3';
import { Learning } from '../learning/simpleExtractor';

export function searchLearnings(
  db: Database.Database,
  query: string,
  limit: number = 10
): Learning[] {
  const like = `%${query}%`;
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
    .all(like, like, limit) as Learning[];

  return rows;
}

