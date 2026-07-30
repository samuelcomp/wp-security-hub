# TASK 9 Report — cPanel and WP-Admin Connectors

**Status:** Complete

## Files Created

| File | Path |
|------|------|
| cPanel connector | `src/core/connectors/cpanel.ts` |
| WP-Admin connector | `src/core/connectors/wp-admin.ts` |

## Implementation

- `CpanelConnection` — Implements `RemoteConnection`. Connects via cPanel API using `CpanelCredentials`
  - `connect()` validates via `get_user_information` endpoint
  - `downloadFile()` fetches file content via `Fileman/get_file_content`
  - `listFiles()` returns `RemoteFile[]` via `Fileman/list_files`
  - `exec()` throws — raw command execution unsupported

- `WpAdminConnection` — Implements `RemoteConnection`. Connects via WordPress login form using `WpAdminCredentials`
  - `connect()` POSTs to `wp-login.php`, stores session cookie
  - `exec()` dispatches to WordPress REST API endpoints
  - `downloadFile()` and `listFiles()` throw — WP-Admin has no filesystem access
  - Extra methods: `getCookies()`, `getBaseUrl()`

## Deviation from Brief

The import path `../../engine/types` in the brief was incorrect (would resolve to `src/engine/types` which doesn't exist). Corrected to `../engine/types` matching the existing `ssh.ts` connector.

## TypeScript Check

```
npx tsc --noEmit
```

- Zero errors in `cpanel.ts` and `wp-admin.ts`
- One pre-existing error in `src/storage/site-repo.ts:40` (unrelated to this task)