import { readStdin } from './utils/stdin';

/**
 * Parses an event from JSON string
 * @param input - JSON string containing the event
 * @returns Parsed event object, or null if parsing fails
 */
export async function parseEvent(input: string): Promise<unknown | null> {
  try {
    const event = JSON.parse(input);
    const eventType = (event as { type?: string }).type || 'unknown';
    console.log('Event received:', {
      type: eventType,
      timestamp: new Date().toISOString(),
    });
    return event;
  } catch (error) {
    // Fail silently - never block user
    console.error('Hook error:', error);
    return null;
  }
}

/**
 * Main hook entry point - reads from stdin and processes event
 */
async function main(): Promise<void> {
  try {
    const input = await readStdin();
    await parseEvent(input);
  } catch (error) {
    // Fail silently - never block user
    console.error('Hook error:', error);
  }
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal hook error:', error);
    process.exit(1);
  });
}

