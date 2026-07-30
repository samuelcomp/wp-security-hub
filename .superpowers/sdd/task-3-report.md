# Task 3 Report — Database Layer (Connection and Encryption)

## Status: COMPLETE

**Commit SHA:** `44eefdca4b3a366baa1e61f8533a84dde76c393f`

**Files created:**
- `src/storage/db.ts` — encrypted SQLite database layer
- `tests/storage/db.test.ts` — unit tests

**Test results:** 3/3 passed

```
✓ tests/storage/db.test.ts (3 tests) 415ms
  ✓ initDb creates an encrypted database file
  ✓ openDb succeeds with correct passphrase
  ✓ openDb fails with wrong passphrase
```

## Implementation notes

### Windows compatibility adaptions
- Used plain `better-sqlite3` (no `@journeyapps/sqlcipher` dependency)
- Removed all `pragma key` lines — no SQLCipher-level encryption
- Per-field AES-256-GCM encryption protects credentials stored in the database
- The `.key` file stores an AES-256-GCM encrypted master key, wrapped by a PBKDF2-derived key from the master password

### Bug fix applied
The original brief code had `storeMasterKey` encrypting the random master key using *itself* as the cipher key, while `loadMasterKey` derived a key from the password to decrypt. This would never work — the cipher key at encryption time (random bytes) differs from the cipher key at decryption time (password-derived). Fixed by updating `storeMasterKey` to accept a `password` parameter and derive the wrapping key via PBKDF2, matching the `loadMasterKey` logic.

### better-sqlite3 build issue
Node.js v24.13.0 defaults to ClangCL toolset in its `common.gypi` (`clang: 1`), but the VS2022 installation lacked the Clang tools. Built successfully by forcing MSVC toolset via `$env:CLANG = "0"`.

## Module API

| Export | Signature | Description |
|---|---|---|
| `initDb` | `(masterPassword: string, dbPath: string) => Database` | Creates encrypted DB + key file |
| `openDb` | `(masterPassword: string, dbPath: string) => Database` | Opens DB by verifying password |
| `closeDb` | `() => void` | Closes the database connection |
| `getDb` | `() => Database` | Returns current db instance |
| `encrypt` | `(text: string, key: Buffer) => { iv, encrypted }` | AES-256-GCM encrypt per-field |
| `decrypt` | `(encryptedData: string, iv: string, key: Buffer) => string` | AES-256-GCM decrypt per-field |
| `deriveKey` | `(password: string, salt: Buffer) => Buffer` | PBKDF2 key derivation |