import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import type { Finding, FindingSeverity, FindingStatus, ScanModule, RoundType } from '../core/engine/types';

interface FindingRow {
  id: string;
  scan_id: string;
  site_id: string;
  round: number;
  module: string;
  severity: string;
  title: string;
  description: string;
  source_file: string | null;
  source_line: number | null;
  code_snippet: string | null;
  virus_total_result: string | null;
  ai_analysis: string | null;
  recommendation: string;
  fix_action: string | null;
  status: string;
  fixed_at: string | null;
  fix_log: string | null;
}

function rowToFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    scanId: row.scan_id,
    siteId: row.site_id,
    round: row.round as RoundType,
    module: row.module as ScanModule,
    severity: row.severity as FindingSeverity,
    title: row.title,
    description: row.description,
    sourceFile: row.source_file,
    sourceLine: row.source_line,
    codeSnippet: row.code_snippet,
    virusTotalResult: row.virus_total_result ? JSON.parse(row.virus_total_result) : null,
    aiAnalysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
    recommendation: row.recommendation,
    fixAction: row.fix_action,
    status: row.status as FindingStatus,
    fixedAt: row.fixed_at,
    fixLog: row.fix_log,
  };
}

export interface CreateFindingInput {
  scanId: string;
  siteId: string;
  round: RoundType;
  module: ScanModule;
  severity: FindingSeverity;
  title: string;
  description: string;
  sourceFile?: string;
  sourceLine?: number;
  codeSnippet?: string;
  virusTotalResult?: Record<string, unknown>;
  aiAnalysis?: Record<string, unknown>;
  recommendation: string;
  fixAction?: string;
}

export function createFinding(input: CreateFindingInput): Finding {
  const db = getDb();
  const existingCount = db.prepare(
    'SELECT COUNT(*) as count FROM findings WHERE scan_id = ?'
  ).get(input.scanId) as { count: number };

  const id = `F-${String(existingCount.count + 1).padStart(3, '0')}`;
  db.prepare(`
    INSERT INTO findings (id, scan_id, site_id, round, module, severity, title,
      description, source_file, source_line, code_snippet, virus_total_result,
      ai_analysis, recommendation, fix_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.scanId, input.siteId, input.round, input.module, input.severity,
    input.title, input.description, input.sourceFile ?? null, input.sourceLine ?? null,
    input.codeSnippet ?? null,
    input.virusTotalResult ? JSON.stringify(input.virusTotalResult) : null,
    input.aiAnalysis ? JSON.stringify(input.aiAnalysis) : null,
    input.recommendation, input.fixAction ?? null
  );
  return getFinding(id)!;
}

export function getFinding(id: string): Finding | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM findings WHERE id = ?').get(id) as FindingRow | undefined;
  return row ? rowToFinding(row) : null;
}

export function listFindingsForScan(scanId: string): Finding[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM findings WHERE scan_id = ? ORDER BY severity, id')
    .all(scanId) as FindingRow[];
  return rows.map(rowToFinding);
}

export function listFindingsForSite(siteId: string, status?: FindingStatus): Finding[] {
  const db = getDb();
  let query = 'SELECT * FROM findings WHERE site_id = ?';
  const params: string[] = [siteId];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params) as FindingRow[];
  return rows.map(rowToFinding);
}

export function updateFindingStatus(id: string, status: FindingStatus): void {
  const db = getDb();
  const now = status === 'fixed' ? `, fixed_at = datetime('now')` : '';
  db.prepare(`UPDATE findings SET status = ?${now} WHERE id = ?`).run(status, id);
}

export function approveFindingsForSite(siteId: string, scanId: string): Finding[] {
  const db = getDb();
  db.prepare(
    'UPDATE findings SET status = ? WHERE site_id = ? AND scan_id = ? AND severity IN (?, ?, ?, ?) AND status = ?'
  ).run('approved', siteId, scanId, 'critical', 'high', 'medium', 'low', 'new');
  return listFindingsForScan(scanId).filter(f => f.status === 'approved');
}

export function markFindingFixed(id: string, fixLog: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE findings SET status = 'fixed', fixed_at = datetime('now'), fix_log = ? WHERE id = ?"
  ).run(fixLog, id);
}