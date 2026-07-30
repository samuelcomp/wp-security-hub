import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';

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

function storeMasterKey(key: Buffer, password: string, dbPath: string): void {
  const keyFile = dbPath + '.key';
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const wrappingKey = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
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
  storeMasterKey(key, masterPassword, dbPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function openDb(masterPassword: string, dbPath: string): Database.Database {
  if (db) return db;
  const key = loadMasterKey(masterPassword, dbPath);
  db = new Database(dbPath);
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