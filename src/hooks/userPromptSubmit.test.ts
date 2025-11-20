import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseEvent } from './userPromptSubmit';

describe('userPromptSubmit hook', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    logOutput = [];
    errorOutput = [];
    
    console.log = vi.fn((...args: unknown[]) => {
      logOutput.push(args.map(String).join(' '));
    });
    console.error = vi.fn((...args: unknown[]) => {
      errorOutput.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('should parse event from stdin', async () => {
    const mockEvent = { type: 'UserPromptSubmit', content: 'test' };
    const result = await parseEvent(JSON.stringify(mockEvent));
    expect(result.type).toBe('UserPromptSubmit');
    expect(result.content).toBe('test');
  });

  it('should handle malformed JSON gracefully', async () => {
    const result = await parseEvent('invalid json');
    expect(result).toBeNull();
    expect(errorOutput.length).toBeGreaterThan(0);
    expect(errorOutput[0]).toContain('Hook error');
  });

  it('should log event type and timestamp', async () => {
    const mockEvent = { type: 'UserPromptSubmit', content: 'test' };
    await parseEvent(JSON.stringify(mockEvent));
    
    expect(logOutput.length).toBeGreaterThan(0);
    // Check that log was called with the right structure
    const logCall = (console.log as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(logCall[0]).toBe('Event received:');
    expect(logCall[1]).toHaveProperty('type', 'UserPromptSubmit');
    expect(logCall[1]).toHaveProperty('timestamp');
  });
});

