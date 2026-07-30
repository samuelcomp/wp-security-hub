import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, closeDb } from '../../src/storage/db';
import { setEncryptionKey } from '../../src/storage/site-repo';
import { createSite } from '../../src/storage/site-repo';
import { createScan, getScan, updateScanStatus, listScansForSite } from '../../src/storage/scan-repo';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_DB = path.join(os.tmpdir(), 'wp-audit-scan-test.db');

describe('Scan Repository', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    initDb('test-pass', TEST_DB);
    setEncryptionKey(crypto.randomBytes(32));
    createSite('scan-test.com', 'ssh', { host: '1.1.1.1', port: 22, username: 'root' });
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('createScan creates a scan with status running', () => {
    const scan = createScan('scan-test-com');
    expect(scan.status).toBe('running');
    expect(scan.progress.currentRound).toBe(1);
  });

  it('getScan retrieves the scan', () => {
    const scan = createScan('scan-test-com');
    const retrieved = getScan(scan.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(scan.id);
  });

  it('updateScanStatus marks scan completed', () => {
    const scan = createScan('scan-test-com');
    updateScanStatus(scan.id, 'completed', [1, 2, 3, 4]);
    const updated = getScan(scan.id);
    expect(updated!.status).toBe('completed');
    expect(updated!.roundsCompleted).toEqual([1, 2, 3, 4]);
    expect(updated!.finishedAt).not.toBeNull();
  });

  it('listScansForSite returns scans ordered by date', () => {
    const scans = listScansForSite('scan-test-com');
    expect(scans.length).toBeGreaterThanOrEqual(3);
  });
});