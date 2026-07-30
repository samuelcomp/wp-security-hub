# Task 4 Report — Database Schema

**Status:** COMPLETE

## Files changed

1. **`src/storage/schema.ts`** (created) — `createSchema()` function with 6 tables and 7 indexes
2. **`src/storage/db.ts`** (modified) — imports `createSchema` and calls it in `initDb` after pragmas
3. **`tests/storage/db.test.ts`** (modified) — added schema verification test

## Tables created

| Table | Primary Key | Key columns |
|-------|------------|-------------|
| sites | id | domain, connection, credentials |
| scans | id | site_id, status, rounds_completed |
| findings | id | scan_id, site_id, round, module, severity, status |
| fix_history | id | finding_id, site_id, action, success |
| schedules | id | site_id, cron_expr, enabled |
| vault_state | site_id | context |

## Indexes created

- `idx_scans_site_id`, `idx_scans_status`
- `idx_findings_scan_id`, `idx_findings_site_id`, `idx_findings_severity`, `idx_findings_status`
- `idx_fix_history_site_id`

## Test results

```
✓ tests/storage/db.test.ts (4 tests) 926ms
  ✓ initDb creates an encrypted database file
  ✓ openDb succeeds with correct passphrase
  ✓ openDb fails with wrong passphrase
  ✓ initDb creates all required tables
```

4/4 passing.