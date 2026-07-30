 Database Layer â€” Connection and Encryption

**Files:**
- Create: `wp-security-hub/src/storage/db.ts`
- Create: `wp-security-hub/tests/storage/db.test.ts`

**Interfaces:**
- Consumes: none (first database module)
- Produces: `initDb(masterPassword: string, dbPath: string): Database`, `openDb(masterPassword: string, dbPath: string): Database`, `closeDb(): void`

- [ ] **Step 1: Write failing test for initDb**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, openDb, closeDb } from '../../src/storage/db';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_DB = path.join(os.tmpdir(), 'wp-audit-test.db');

describe('Database', () => {
  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('initDb creates an encrypted database file', () => {
    initDb('test-passphrase-123', TEST_DB);
    const exists = fs.existsSync(TEST_DB);
    expect(exists).toBe(true);
  });

  it('openDb succeeds with correct passphrase', () => {
    closeDb();
    const db = openDb('test-passphrase-123', TEST_DB);
    expect(db).toBeDefined();
  });

  it('openDb fails with wrong passphrase', () => {
    closeDb();
    expect(() => openDb('wrong-passphrase', TEST_DB)).toThrow();
  });
});
```

Run: `npx vitest run tests/storage/db.test.ts`
Expected: FAIL â€” `initDb is not defined`

- [ ] **Step 2: Write db.ts implementation**

```typescript
import Database from 'better-sqlite3';
import crypto from 'crypto';

let db: Database.Database | null = null;

const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;
const DIGEST = 'sha256';

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

function encrypt(text: string, key: Buffer): { iv: string; encrypted: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    encrypted: encrypted + ':' + authTag.toString('hex'),
  };
}

function decrypt(encryptedData: string, iv: string, key: Buffer): string {
  const parts = encryptedData.split(':');
  const encrypted = parts[0];
  const authTag = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function storeMasterKey(key: Buffer, dbPath: string): void {
  const keyFile = dbPath + '.key';
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(key.toString('hex'), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex'),
  ]);
  fs.writeFileSync(keyFile, payload);
}

function loadMasterKey(password: string, dbPath: string): Buffer {
  const keyFile = dbPath + '.key';
  if (!fs.existsSync(keyFile)) {
    throw new Error('Database not initialized');
  }
  const payload = fs.readFileSync(keyFile);
  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = payload.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + 16
  );
  const encrypted = payload.subarray(SALT_LENGTH + IV_LENGTH + 16);
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return Buffer.from(decrypted, 'hex');
}

export function initDb(masterPassword: string, dbPath: string): Database.Database {
  if (fs.existsSync(dbPath)) {
    throw new Error('Database already exists at ' + dbPath);
  }
  const key = crypto.randomBytes(KEY_LENGTH);
  storeMasterKey(key, dbPath);
  db = new Database(dbPath);
  db.pragma(`key = "x'${key.toString('hex')}'"`);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function openDb(masterPassword: string, dbPath: string): Database.Database {
  if (db) return db;
  const key = loadMasterKey(masterPassword, dbPath);
  db = new Database(dbPath);
  db.pragma(`key = "x'${key.toString('hex')}'"`);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not opened');
  return db;
}

export { encrypt, decrypt, deriveKey };
```

Add missing import at top:
```typescript
import fs from 'fs';
```

- [ ] **Step 3: Run test to verify passes**

```bash
npx vitest run tests/storage/db.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/storage/db.ts tests/storage/db.test.ts
git commit -m "feat: add encrypted SQLite database layer with AES-256-GCM"
```

---


