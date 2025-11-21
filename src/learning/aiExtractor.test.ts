import { describe, it, expect, vi } from 'vitest';
import { Conversation } from './simpleExtractor';
import { generateLearningFromConversation } from './aiExtractor';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                category: 'technical',
                title: 'Use map',
                content: 'Prefer Array.map for transformations.'
              })
            }
          ]
        })
      }
    }))
  };
});

describe('generateLearningFromConversation', () => {
  const conversation: Conversation = {
    conversation_id: 'conv-ai',
    messages: [
      { role: 'user', content: 'How do I transform arrays?' },
      { role: 'assistant', content: 'Use ```js\narr.map()\n```' }
    ]
  };

  it('should fallback when no API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const learning = await generateLearningFromConversation(conversation);
    expect(learning).not.toBeNull();
    expect(learning?.title).toBe('Assistant insight');
  });

  it('should use anthropic client when api key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const learning = await generateLearningFromConversation(conversation);
    expect(learning?.title).toBe('Use map');
  });
});

