import Database from 'better-sqlite3';

/**
 * Creates a SQLite database connection
 * @param path - Database path (default: ':memory:' for in-memory database)
 * @returns Database instance
 */
export function createDb(path: string = ':memory:'): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

