import Database from 'better-sqlite3';
import { Conversation } from './simpleExtractor';

export function getConversation(db: Database.Database, conversationId: string): Conversation {
  const rows = db
    .prepare(
      `
        SELECT conversation_id, role, content
        FROM messages
        WHERE conversation_id = ?
        ORDER BY sequence ASC
      `
    )
    .all(conversationId) as Array<{ conversation_id: string; role: 'user' | 'assistant'; content: string }>;

  return {
    conversation_id: conversationId,
    messages: rows
  };
}

