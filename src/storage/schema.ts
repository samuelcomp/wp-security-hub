import { getDb } from './db';

export function createSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id          TEXT PRIMARY KEY,
      domain      TEXT NOT NULL UNIQUE,
      connection  TEXT NOT NULL CHECK(connection IN ('ssh', 'cpanel', 'wp-admin')),
      credentials TEXT NOT NULL,
      tech_stack  TEXT DEFAULT '{}',
      health_score INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scans (
      id              TEXT PRIMARY KEY,
      site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      status          TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'interrupted')),
      rounds_completed TEXT DEFAULT '[]',
      started_at      TEXT DEFAULT (datetime('now')),
      finished_at     TEXT,
      progress        TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_scans_site_id ON scans(site_id);
    CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);

    CREATE TABLE IF NOT EXISTS findings (
      id              TEXT PRIMARY KEY,
      scan_id         TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      round           INTEGER NOT NULL CHECK(round BETWEEN 1 AND 4),
      module          TEXT NOT NULL,
      severity        TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')),
      title           TEXT NOT NULL,
      description     TEXT DEFAULT '',
      source_file     TEXT,
      source_line     INTEGER,
      code_snippet    TEXT,
      virus_total_result TEXT,
      ai_analysis     TEXT,
      recommendation  TEXT DEFAULT '',
      fix_action      TEXT,
      status          TEXT DEFAULT 'new' CHECK(status IN ('new', 'reviewed', 'approved', 'fixed', 'ignored')),
      fixed_at        TEXT,
      fix_log         TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
    CREATE INDEX IF NOT EXISTS idx_findings_site_id ON findings(site_id);
    CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
    CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);

    CREATE TABLE IF NOT EXISTS fix_history (
      id            TEXT PRIMARY KEY,
      finding_id    TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
      site_id       TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      action        TEXT NOT NULL,
      before_state  TEXT,
      after_state   TEXT,
      executed_at   TEXT DEFAULT (datetime('now')),
      success       INTEGER NOT NULL CHECK(success IN (0, 1))
    );

    CREATE INDEX IF NOT EXISTS idx_fix_history_site_id ON fix_history(site_id);

    CREATE TABLE IF NOT EXISTS schedules (
      id        TEXT PRIMARY KEY,
      site_id   TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      cron_expr TEXT NOT NULL,
      enabled   INTEGER DEFAULT 1 CHECK(enabled IN (0, 1)),
      last_run  TEXT,
      next_run  TEXT
    );

    CREATE TABLE IF NOT EXISTS vault_state (
      site_id  TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      context  TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}