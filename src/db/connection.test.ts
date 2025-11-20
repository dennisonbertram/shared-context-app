import { describe, it, expect, afterEach } from 'vitest';
import { createDb } from './connection';
import { writeTestRecord, readTestRecord } from './test-write';

describe('Database Connection', () => {
  let db: ReturnType<typeof createDb>;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('should create an in-memory database', () => {
    db = createDb();
    expect(db).toBeDefined();
    expect(db.memory).toBe(true);
  });

  it('should write and read a record', () => {
    db = createDb();
    const id = writeTestRecord(db, 'test message');
    const message = readTestRecord(db, id);
    expect(message).toBe('test message');
  });

  it('should return null for non-existent record', () => {
    db = createDb();
    const message = readTestRecord(db, 'non-existent-id');
    expect(message).toBeNull();
  });

  it('should handle multiple records', () => {
    db = createDb();
    const id1 = writeTestRecord(db, 'message 1');
    const id2 = writeTestRecord(db, 'message 2');
    
    expect(readTestRecord(db, id1)).toBe('message 1');
    expect(readTestRecord(db, id2)).toBe('message 2');
  });
});

