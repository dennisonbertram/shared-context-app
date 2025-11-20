/**
 * Reads all data from stdin as a string
 * @returns Promise resolving to the stdin content as UTF-8 string
 */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

