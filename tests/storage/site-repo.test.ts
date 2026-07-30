import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, openDb, closeDb } from '../../src/storage/db';
import { setEncryptionKey } from '../../src/storage/site-repo';
import {
  createSite,
  getSite,
  listSites,
  updateSite,
  deleteSite,
  updateHealthScore,
} from '../../src/storage/site-repo';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_DB = path.join(os.tmpdir(), 'wp-audit-site-repo-test.db');

describe('Site Repository', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    initDb('test-pass', TEST_DB);
    setEncryptionKey(crypto.randomBytes(32));
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('createSite adds a site and returns it', () => {
    const site = createSite('example.com', 'ssh', {
      host: '192.168.1.1',
      port: 22,
      username: 'root',
      password: 'secret',
    });
    expect(site.domain).toBe('example.com');
    expect(site.connection).toBe('ssh');
  });

  it('getSite returns null for nonexistent site', () => {
    expect(getSite('nonexistent')).toBeNull();
  });

  it('getSite returns the site by id', () => {
    const site = getSite('example-com');
    expect(site).not.toBeNull();
    expect(site!.domain).toBe('example.com');
  });

  it('listSites returns all sites', () => {
    createSite('test.org', 'cpanel', {
      host: 'test.org',
      port: 2083,
      username: 'admin',
      apiToken: 'token123',
    });
    const sites = listSites();
    expect(sites.length).toBe(2);
  });

  it('updateSite updates fields', () => {
    const updated = updateSite('example-com', { healthScore: 85 });
    expect(updated!.healthScore).toBe(85);
  });

  it('deleteSite removes a site', () => {
    deleteSite('test-org');
    expect(getSite('test-org')).toBeNull();
    expect(listSites().length).toBe(1);
  });

  it('updateHealthScore sets score directly', () => {
    updateHealthScore('example-com', 50);
    const site = getSite('example-com');
    expect(site!.healthScore).toBe(50);
  });
});