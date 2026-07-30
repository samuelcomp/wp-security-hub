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
    credentials: dec(row.credentials) as unknown as SiteCredentials,
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