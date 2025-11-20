import { describe, it, expect, vi } from 'vitest';
import { extractSimpleLearning } from './simpleExtractor';

describe('extractSimpleLearning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-16T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should extract learning when assistant shares code', () => {
    const conversation = {
      conversation_id: 'conv-1',
      messages: [
        { role: 'user' as const, content: 'How do I sort an array?' },
        { role: 'assistant' as const, content: 'Use ```js\narr.sort()\n``` to sort ascending.' }
      ]
    };

    const learning = extractSimpleLearning(conversation);
    expect(learning).not.toBeNull();
    expect(learning?.category).toBe('technical');
    expect(learning?.content).toContain('```js');
    expect(learning?.conversation_id).toBe('conv-1');
  });

  it('should return null when no code examples are present', () => {
    const conversation = {
      conversation_id: 'conv-2',
      messages: [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ]
    };

    const learning = extractSimpleLearning(conversation);
    expect(learning).toBeNull();
  });
});

