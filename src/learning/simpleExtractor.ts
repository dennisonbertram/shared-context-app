export type LearningCategory = 'technical' | 'workflow' | 'insight';

export interface Learning {
  id: string;
  category: LearningCategory;
  title: string;
  content: string;
  conversation_id: string;
  created_at: string;
}

export interface Conversation {
  conversation_id: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Simple heuristic extractor:
 * - If any assistant message contains a code block (```), emit a single learning.
 * - Otherwise return null.
 */
export function extractSimpleLearning(conversation: Conversation): Learning | null {
  const assistantWithCode = conversation.messages.find(
    (msg) => msg.role === 'assistant' && msg.content.includes('```')
  );

  if (!assistantWithCode) {
    return null;
  }

  return {
    id: conversation.conversation_id,
    category: 'technical',
    title: 'Code example shared',
    content: assistantWithCode.content,
    conversation_id: conversation.conversation_id,
    created_at: new Date().toISOString()
  };
}

