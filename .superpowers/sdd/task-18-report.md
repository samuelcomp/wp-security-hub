# Task 18 — Fix Engine

**Status:** ✅ Complete

## Files Created

- `src/fix/fix-engine.ts` — Fix engine with `executeApproved()` that:
  - Connects to the remote server
  - Pulls approved findings for a scan
  - Takes a before-snapshot of affected files
  - Executes the fix action (delete-file, replace-file, update-plugin, update-core, delete-user, disable-xmlrpc, chmod, htaccess-rule, wp-config-edit)
  - Takes an after-snapshot
  - Marks the finding as fixed and creates a fix record
  - Returns `{ fixed, failed, records }`

## Type Check

```text
npx tsc --noEmit
```

All errors are pre-existing in other modules. `fix-engine.ts` has zero type errors.

## Import Paths Verified

- `../core/engine/types` → `src/core/engine/types.ts` ✓
- `../core/connectors/types` → `src/core/connectors/types.ts` ✓
- `../storage/finding-repo` → `src/storage/finding-repo.ts` ✓
- `../storage/fix-repo` → `src/storage/fix-repo.ts` ✓