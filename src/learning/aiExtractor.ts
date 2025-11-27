import Anthropic from '@anthropic-ai/sdk';
import { Conversation, Learning } from './simpleExtractor';

export interface AiLearningOptions {
  client?: Anthropic;
  model?: string;
}

function fallbackLearning(conversation: Conversation): Learning | null {
  const assistant = conversation.messages.find((m) => m.role === 'assistant');
  if (!assistant) {
    return null;
  }

  return {
    id: conversation.conversation_id,
    category: 'insight',
    title: 'Assistant insight',
    content: assistant.content.slice(0, 280),
    conversation_id: conversation.conversation_id,
    created_at: new Date().toISOString()
  };
}

export async function generateLearningFromConversation(
  conversation: Conversation,
  options?: AiLearningOptions
): Promise<Learning | null> {
  if (!conversation.messages.length) {
    return null;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !options?.client) {
    return fallbackLearning(conversation);
  }

  const client = options?.client ?? new Anthropic({ apiKey: apiKey! });
  const prompt = `You summarize coding conversations into concise learnings.

Conversation ID: ${conversation.conversation_id}

Messages:
${conversation.messages
  .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
  .join('\n')}

Respond with JSON:
{
  "category": "technical" | "workflow" | "insight",
  "title": "short title",
  "content": "actionable learning"
}`;

  try {
    const response = await client.messages.create({
      model: options?.model ?? 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content?.[0];
    if (content?.type === 'text') {
      const parsed = JSON.parse(content.text);
      return {
        id: conversation.conversation_id,
        category: parsed.category || 'insight',
        title: parsed.title || 'Assistant insight',
        content: parsed.content || '',
        conversation_id: conversation.conversation_id,
        created_at: new Date().toISOString()
      };
    }
  } catch {
    // fall back to heuristic
  }

  return fallbackLearning(conversation);
}

