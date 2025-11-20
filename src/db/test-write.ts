import Database from 'better-sqlite3';

// Initialize table if it doesn't exist
function ensureTable(db: Database.Database): void {
  db.prepare('CREATE TABLE IF NOT EXISTS test (id TEXT PRIMARY KEY, message TEXT)').run();
}

/**
 * Writes a test record to the database
 * @param db - Database instance
 * @param message - Message to store
 * @returns The ID of the created record
 */
export function writeTestRecord(db: Database.Database, message: string): string {
  ensureTable(db);
  // Use timestamp + random component to avoid collisions
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  db.prepare('INSERT INTO test (id, message) VALUES (?, ?)').run(id, message);
  return id;
}

/**
 * Reads a test record from the database
 * @param db - Database instance
 * @param id - Record ID
 * @returns The message or null if not found
 */
export function readTestRecord(db: Database.Database, id: string): string | null {
  ensureTable(db);
  const row = db.prepare('SELECT message FROM test WHERE id = ?').get(id) as
    | { message: string }
    | undefined;
  return row?.message ?? null;
}

