# Task 13 — External Intel Module

## Status: ✅ Complete

### Steps
1. ✅ Created `src/core/modules/external-intel.ts` — `ExternalIntel` class with `checkWpscan` and `checkSucuri` methods
2. ✅ Verified compiles (`npx tsc --noEmit` — no errors from this file)
3. ⏳ Commit not performed (not requested)

### Fix Applied
- Corrected import path: `../../engine/types` → `../engine/types` (the types file is at `src/core/engine/types`, not `src/engine/types`)

### Pre-existing Errors (not from this task)
- `src/core/modules/malware-scanner.ts` — 3 import path errors (broken relative paths)
- `src/storage/site-repo.ts` — 1 type cast error