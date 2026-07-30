import { Command } from 'commander';
import * as readline from 'readline';
import fs from 'fs';
import { createSite } from '../../storage/site-repo';
import type { ConnectionType } from '../../core/engine/types';

export const addSiteCommand = new Command('add')
  .description('Register a new WordPress website')
  .argument('<domain>', 'Domain name (e.g., example.com)')
  .action(async (domain: string) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

    console.log(`\nAdding site: ${domain}\n`);
    const connType = await ask('Connection type (ssh/cpanel/wp-admin): ');

    let credentials: Record<string, unknown> = {};
    if (connType === 'ssh') {
      credentials = {
        host: await ask('SSH Host: '),
        port: parseInt(await ask('SSH Port [22]: ') || '22', 10),
        username: await ask('SSH Username: '),
        password: await ask('SSH Password (or leave blank for key): '),
      };
      if (!credentials.password) {
        const keyPath = await ask('Private key path: ');
        credentials.privateKey = fs.readFileSync(keyPath, 'utf8');
      }
    } else if (connType === 'cpanel') {
      credentials = {
        host: await ask('cPanel Host: '),
        port: parseInt(await ask('cPanel Port [2083]: ') || '2083', 10),
        username: await ask('cPanel Username: '),
        apiToken: await ask('cPanel API Token: '),
      };
    } else if (connType === 'wp-admin') {
      const url = await ask('WP Admin URL (e.g., https://example.com): ');
      credentials = {
        url,
        username: await ask('WP Admin Username: '),
        password: await ask('WP Admin Password: '),
      };
    }

    const site = createSite(domain, connType as ConnectionType, credentials as unknown as Parameters<typeof createSite>[2]);
    console.log(`\nSite registered: ${site.id}`);
    rl.close();
  });