import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import type { ScanResult, ScanStatus, ScanProgress, RoundType } from '../core/engine/types';

interface ScanRow {
  id: string;
  site_id: string;
  status: string;
  rounds_completed: string;
  started_at: string;
  finished_at: string | null;
  progress: string;
}

function rowToScan(row: ScanRow): ScanResult {
  return {
    id: row.id,
    siteId: row.site_id,
    status: row.status as ScanStatus,
    roundsCompleted: JSON.parse(row.rounds_completed),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    progress: JSON.parse(row.progress),
    findings: [],
  };
}

export function createScan(siteId: string): ScanResult {
  const db = getDb();
  const id = uuid();
  const progress: ScanProgress = {
    currentRound: 1,
    roundProgress: 0,
    findingsCount: 0,
    modulesCompleted: [],
    modulesPending: ['recon'],
  };
  db.prepare(`
    INSERT INTO scans (id, site_id, status, progress)
    VALUES (?, ?, 'running', ?)
  `).run(id, siteId, JSON.stringify(progress));
  return getScan(id)!;
}

export function getScan(id: string): ScanResult | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as ScanRow | undefined;
  return row ? rowToScan(row) : null;
}

export function updateScanProgress(
  scanId: string,
  progress: ScanProgress
): void {
  const db = getDb();
  db.prepare('UPDATE scans SET progress = ? WHERE id = ?')
    .run(JSON.stringify(progress), scanId);
}

export function updateScanStatus(
  scanId: string,
  status: ScanStatus,
  roundsCompleted: RoundType[],
): void {
  const db = getDb();
  db.prepare(`
    UPDATE scans SET status = ?, rounds_completed = ?, finished_at = datetime('now')
    WHERE id = ?
  `).run(status, JSON.stringify(roundsCompleted), scanId);
}

export function listScansForSite(siteId: string): ScanResult[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM scans WHERE site_id = ? ORDER BY started_at DESC')
    .all(siteId) as ScanRow[];
  return rows.map(rowToScan);
}