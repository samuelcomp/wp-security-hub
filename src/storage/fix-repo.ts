import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import type { FixRecord } from '../core/engine/types';

export function createFixRecord(
  findingId: string,
  siteId: string,
  action: string,
  beforeState: string | null,
  afterState: string | null,
  success: boolean
): FixRecord {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO fix_history (id, finding_id, site_id, action, before_state, after_state, success)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, findingId, siteId, action, beforeState, afterState, success ? 1 : 0);
  return {
    id,
    findingId,
    siteId,
    action,
    beforeState,
    afterState,
    executedAt: new Date().toISOString(),
    success,
  };
}

export function listFixHistoryForSite(siteId: string): FixRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM fix_history WHERE site_id = ? ORDER BY executed_at DESC')
    .all(siteId) as Array<{
      id: string; finding_id: string; site_id: string; action: string;
      before_state: string | null; after_state: string | null;
      executed_at: string; success: number;
    }>;
  return rows.map(r => ({
    id: r.id,
    findingId: r.finding_id,
    siteId: r.site_id,
    action: r.action,
    beforeState: r.before_state,
    afterState: r.after_state,
    executedAt: r.executed_at,
    success: r.success === 1,
  }));
}