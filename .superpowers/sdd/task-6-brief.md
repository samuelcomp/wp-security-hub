 Site Repository (CRUD)

**Files:**
- Create: `wp-security-hub/src/storage/site-repo.ts`
- Create: `wp-security-hub/tests/storage/site-repo.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `db.ts`, `createSchema()` from `schema.ts`
- Produces: `SiteRepo` with `createSite`, `getSite`, `listSites`, `updateSite`, `deleteSite`, `updateHealthScore`

- [ ] **Step 1: Write site-repo.ts**

```typescript
import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import { encrypt, decrypt } from './db';
import type { SiteConfig, ConnectionType, SiteCredentials } from '../core/engine/types';

const MASTER_KEY: { current: Buffer | null } = { current: null };

export function setEncryptionKey(key: Buffer): void {
  MASTER_KEY.current = key;
}

function enc(data: Record<string, unknown>): string {
  if (!MASTER_KEY.current) throw new Error('Encryption key not set');
  const { iv, encrypted } = encrypt(JSON.stringify(data), MASTER_KEY.current);
  return JSON.stringify({ iv, encrypted });
}

function dec(data: string): Record<string, unknown> {
  if (!MASTER_KEY.current) throw new Error('Encryption key not set');
  const { iv, encrypted } = JSON.parse(data);
  return JSON.parse(decrypt(encrypted, iv, MASTER_KEY.current));
}

export interface SiteRow {
  id: string;
  domain: string;
  connection: string;
  credentials: string;
  tech_stack: string;
  health_score: number;
  created_at: string;
  updated_at: string;
}

function rowToSite(row: SiteRow): SiteConfig {
  return {
    id: row.id,
    domain: row.domain,
    connection: row.connection as ConnectionType,
    credentials: dec(row.credentials) as SiteCredentials,
    techStack: JSON.parse(row.tech_stack),
    healthScore: row.health_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSite(
  domain: string,
  connection: ConnectionType,
  credentials: SiteCredentials
): SiteConfig {
  const db = getDb();
  const id = domain.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const stmt = db.prepare(`
    INSERT INTO sites (id, domain, connection, credentials)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, domain, connection, enc(credentials as unknown as Record<string, unknown>));
  return getSite(id)!;
}

export function getSite(id: string): SiteConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as SiteRow | undefined;
  return row ? rowToSite(row) : null;
}

export function listSites(): SiteConfig[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sites ORDER BY domain').all() as SiteRow[];
  return rows.map(rowToSite);
}

export function updateSite(id: string, updates: Partial<Pick<SiteConfig, 'techStack' | 'healthScore' | 'credentials'>>): SiteConfig | null {
  const db = getDb();
  const existing = getSite(id);
  if (!existing) return null;

  if (updates.techStack) {
    db.prepare('UPDATE sites SET tech_stack = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(updates.techStack), id);
  }
  if (updates.healthScore !== undefined) {
    db.prepare('UPDATE sites SET health_score = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(updates.healthScore, id);
  }
  if (updates.credentials) {
    db.prepare('UPDATE sites SET credentials = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(enc(updates.credentials as unknown as Record<string, unknown>), id);
  }
  return getSite(id);
}

export function deleteSite(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateHealthScore(id: string, score: number): void {
  const db = getDb();
  db.prepare('UPDATE sites SET health_score = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(score, id);
}
```

- [ ] **Step 2: Write test for site-repo**

```typescript
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
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/storage/site-repo.test.ts
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/storage/site-repo.ts tests/storage/site-repo.test.ts
git commit -m "feat: add site repository with encrypted credential storage"
```

---


