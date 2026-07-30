import { describe, it, expect, afterAll } from 'vitest';
import { initDb, openDb, closeDb } from '../../src/storage/db';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_DB = path.join(os.tmpdir(), 'wp-audit-test.db');

describe('Database', () => {
  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('initDb creates an encrypted database file', () => {
    initDb('test-passphrase-123', TEST_DB);
    const exists = fs.existsSync(TEST_DB);
    expect(exists).toBe(true);
  });

  it('openDb succeeds with correct passphrase', () => {
    closeDb();
    const db = openDb('test-passphrase-123', TEST_DB);
    expect(db).toBeDefined();
  });

  it('openDb fails with wrong passphrase', () => {
    closeDb();
    expect(() => openDb('wrong-passphrase', TEST_DB)).toThrow();
  });
});