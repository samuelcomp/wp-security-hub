import { Command } from 'commander';
import * as readline from 'readline';
import { initDb } from '../../storage/db';
import { setEncryptionKey } from '../../storage/site-repo';
import { resolveRootDir, saveSettings, type Settings } from '../../config/settings';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const initCommand = new Command('init')
  .description('First-time setup wizard')
  .action(async () => {
    console.log('=== WP Security Hub — Setup Wizard ===\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

    const rootDir = await ask('Synced folder location [~/wp-security-hub]: ');
    const resolvedRoot = resolveRootDir(rootDir || undefined);

    const masterPassword = await ask('Master passphrase (keep this safe!): ');

    const dbPath = path.join(resolvedRoot, 'hub.db');
    if (fs.existsSync(dbPath)) {
      console.log('Database already exists. Use existing passphrase to unlock.');
      rl.close();
      return;
    }

    initDb(masterPassword, dbPath);
    const key = crypto.pbkdf2Sync(masterPassword, 'wp-security-hub-salt', 100000, 32, 'sha256');
    setEncryptionKey(key);

    console.log('\nDatabase initialized and encrypted.\n');

    const orKey = await ask('OpenRouter API key (optional): ');
    const vtKey = await ask('VirusTotal API key (optional): ');
    const wpsKey = await ask('WPScan API key (optional): ');

    const settings: Settings = {
      apiKeys: {
        openrouter: orKey ? { key: orKey, model: 'deepseek/deepseek-chat' } : undefined,
        virustotal: vtKey ? { key: vtKey } : undefined,
        wpscan: wpsKey ? { key: wpsKey } : undefined,
      },
      maxParallelScans: 10,
      apiRateLimit: 4,
      aiEnabled: !!orKey,
      aiModel: 'deepseek/deepseek-chat',
      defaultOutputDir: path.join(resolvedRoot, 'sites'),
    };

    saveSettings(resolvedRoot, settings);

    for (const dir of ['sites', 'templates']) {
      fs.mkdirSync(path.join(resolvedRoot, dir), { recursive: true });
    }

    console.log(`\nSetup complete! Hub folder: ${resolvedRoot}`);
    console.log('Run "wp-audit add <domain>" to register your first site.');
    rl.close();
  });