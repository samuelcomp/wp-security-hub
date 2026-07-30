# Task 16 Report — Orchestrator (Parallel Site Management)

## Status: ✅ Complete

### Created
- `src/core/engine/orchestrator.ts`

### Implementation
- `Orchestrator` class extends `EventEmitter` for progress events
- `scanSite(siteId)` — scans a single site with `connecting` → `running` → `completed`/`failed` events
- `scanAll()` — scans all sites in parallel chunks (up to `maxParallelScans` from Settings), using `Promise.allSettled` to handle partial failures
- `getScanHistory(siteId)` — delegates to `listScansForSite` from scan-repo
- `getActiveScans()` — returns IDs of currently running scans

### Type Check
`npx tsc --noEmit` passes with no new errors. All 3 pre-existing errors are unrelated to this file.

### ScanEvent
| Field | Type |
|-------|------|
| siteId | `string` |
| domain | `string` |
| status | `'connecting' \| 'running' \| 'round-start' \| 'round-complete' \| 'completed' \| 'failed'` |
| round | `number?` |
| progress | `number?` |
| findingsCount | `number?` |
| error | `string?` |