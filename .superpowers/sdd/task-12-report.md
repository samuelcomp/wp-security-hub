# Task 12 Report: Core Integrity & Config Auditor

## Status: Complete

### Files Created
- `src/core/modules/core-integrity.ts` — `CoreIntegrity.check(connection, wpVersion, allFiles)`
- `src/core/modules/config-auditor.ts` — `ConfigAuditor.audit(connection)`
- `src/core/modules/user-auditor.ts` — `UserAuditor.audit(memory)`
- `src/core/modules/ssl-auditor.ts` — `SslAuditor.audit(domain)`
- `src/core/modules/blacklist-check.ts` — `BlacklistChecker.check(domain, apiKey?)`

### Import Paths Fixed
All files with `CreateFindingInput` use `../../storage/finding-repo` (correct path from `src/core/modules/`), matching the existing `recon.ts` pattern. The brief's `../../../storage/finding-repo` was incorrect.

### TypeScript Check
`npx tsc --noEmit` — **0 new errors.** All pre-existing errors in `malware-scanner.ts` (3 import path issues) and `site-repo.ts` (1 type cast) are unchanged.

### Module Details
| Module | Constructor | Method | Inputs |
|--------|-------------|--------|--------|
| `CoreIntegrity` | `(siteId, scanId)` | `check(connection, wpVersion, allFiles)` | Fetches WP.org checksums, compares md5, detects unknown root PHP files |
| `ConfigAuditor` | `(siteId, scanId)` | `audit(connection)` | Checks wp-config.php (debug, file edit, salts, DB creds), .htaccess, XML-RPC |
| `UserAuditor` | `(siteId, scanId)` | `audit(memory)` | Checks admin count, default "admin" user, suspicious usernames |
| `SslAuditor` | `(siteId, scanId)` | `audit(domain)` | TLS connect, checks expiration, self-signed, untrusted CA |
| `BlacklistChecker` | `(siteId, scanId)` | `check(domain, apiKey?)` | Google Safe Browsing API for malware/social engineering |