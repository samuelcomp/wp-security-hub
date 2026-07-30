 CLI Commands

**Files:**
- Create: `wp-security-hub/src/cli/index.ts`
- Create: `wp-security-hub/src/cli/commands/init.ts`
- Create: `wp-security-hub/src/cli/commands/add-site.ts`
- Create: `wp-security-hub/src/cli/commands/scan.ts`
- Create: `wp-security-hub/src/cli/commands/status.ts`
- Create: `wp-security-hub/src/cli/commands/fix.ts`
- Create: `wp-security-hub/src/cli/commands/dashboard.ts`
- Create: `wp-security-hub/src/cli/progress.ts`

**Interfaces:**
- Produces: CLI entry point `wp-audit` with all subcommands

- [ ] **Step 1: Write cli/index.ts**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { addSiteCommand } from './commands/add-site';
import { scanCommand } from './commands/scan';
import { statusCommand } from './commands/status';
import { fixCommand } from './commands/fix';
import { dashboardCommand } from './commands/dashboard';

const program = new Command();

program
  .name('wp-audit')
  .description('WordPress Security Audit Automation Tool')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(addSiteCommand);
program.addCommand(scanCommand);
program.addCommand(statusCommand);
program.addCommand(fixCommand);
program.addCommand(dashboardCommand);

program.parse(process.argv);
```

- [ ] **Step 2: Write cli/commands/init.ts**

```typescript
import { Command } from 'commander';
import * as readline from 'readline';
import { initDb, closeDb } from '../../storage/db';
import { setEncryptionKey } from '../../storage/site-repo';
import { resolveRootDir, saveSettings, type Settings } from '../../config/settings';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const initCommand = new Command('init')
  .description('First-time setup wizard')
  .action(async () => {
    console.log('=== WP Security Hub â€” Setup Wizard ===\n');

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

    const db = initDb(masterPassword, dbPath);
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

    // Create folder structure
    for (const dir of ['sites', 'templates']) {
      fs.mkdirSync(path.join(resolvedRoot, dir), { recursive: true });
    }

    console.log(`\nSetup complete! Hub folder: ${resolvedRoot}`);
    console.log('Run "wp-audit add <domain>" to register your first site.');
    rl.close();
  });
```

- [ ] **Step 3: Write cli/commands/add-site.ts**

```typescript
import { Command } from 'commander';
import * as readline from 'readline';
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
        const fs = eval('require')('fs');
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

    const site = createSite(domain, connType as ConnectionType, credentials as Parameters<typeof createSite>[2]);
    console.log(`\nSite registered: ${site.id}`);
    rl.close();
  });
```

- [ ] **Step 4: Write cli/commands/scan.ts**

```typescript
import { Command } from 'commander';
import { Orchestrator } from '../../core/engine/orchestrator';
import { loadSettings, resolveRootDir } from '../../config/settings';
import { openDb, closeDb } from '../../storage/db';
import { setEncryptionKey } from '../../storage/site-repo';
import { getSite, listSites } from '../../storage/site-repo';
import { listFindingsForScan } from '../../storage/finding-repo';
import { listScansForSite, getScan } from '../../storage/scan-repo';
import { DocxGenerator } from '../../reports/docx-generator';
import { MdGenerator } from '../../reports/md-generator';
import { FindingWriter } from '../../reports/finding-writer';
import path from 'path';
import crypto from 'crypto';
import * as readline from 'readline';

export const scanCommand = new Command('scan')
  .description('Run security audit on one or all sites')
  .argument('[site]', 'Site slug or "all" for all sites')
  .option('--rounds <numbers>', 'Specific rounds to run (e.g., 1,2)')
  .action(async (site: string | undefined, options: { rounds?: string }) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

    const rootDir = resolveRootDir();
    const masterPassword = await ask('Master passphrase: ');

    openDb(masterPassword, path.join(rootDir, 'hub.db'));
    const key = crypto.pbkdf2Sync(masterPassword, 'wp-security-hub-salt', 100000, 32, 'sha256');
    setEncryptionKey(key);

    const settings = loadSettings(rootDir);
    const orchestrator = new Orchestrator(settings, rootDir);

    orchestrator.on('scan', (event: { siteId: string; domain: string; status: string }) => {
      console.log(`[${event.domain}] ${event.status}`);
    });

    if (!site || site === 'all') {
      console.log('Scanning all sites...\n');
      await orchestrator.scanAll();
    } else {
      const siteConfig = getSite(site) || listSites().find(s => s.domain === site);
      if (!siteConfig) {
        console.error(`Site not found: ${site}`);
        rl.close();
        closeDb();
        return;
      }
      console.log(`Scanning ${siteConfig.domain}...\n`);
      await orchestrator.scanSite(siteConfig.id);

      // Generate report
      const scans = listScansForSite(siteConfig.id);
      const latest = scans[0];
      if (latest) {
        const findings = listFindingsForScan(latest.id);
        const outputDir = path.join(rootDir, 'sites', siteConfig.id, 'reports');

        const docxGen = new DocxGenerator();
        await docxGen.generate(siteConfig, latest, findings, outputDir);

        const mdGen = new MdGenerator();
        mdGen.generate(siteConfig, latest, findings, outputDir);

        const writer = new FindingWriter();
        writer.write(findings, rootDir, siteConfig.id);

        console.log(`\nReport saved to: ${outputDir}`);
        console.log(`Findings: ${findings.length}`);
      }
    }

    closeDb();
    rl.close();
  });
```

- [ ] **Step 5: Write remaining CLI commands**

`src/cli/commands/status.ts`:
```typescript
import { Command } from 'commander';
import { listSites, getSite } from '../../storage/site-repo';
import { listScansForSite } from '../../storage/scan-repo';

export const statusCommand = new Command('status')
  .description('Show scan status for sites')
  .argument('[site]', 'Site slug (optional)')
  .action((site?: string) => {
    if (site) {
      const s = getSite(site);
      if (!s) { console.log('Site not found'); return; }
      console.log(`\n${s.domain} (${s.id})`);
      console.log(`Health Score: ${s.healthScore}/100`);
      const scans = listScansForSite(s.id);
      if (scans.length > 0) {
        console.log(`Latest scan: ${scans[0].status} (${scans[0].startedAt})`);
      } else {
        console.log('No scans yet');
      }
    } else {
      const sites = listSites();
      if (sites.length === 0) { console.log('No sites registered'); return; }
      console.log('\nSites:');
      for (const s of sites) {
        console.log(`  ${s.domain.padEnd(30)} Score: ${s.healthScore}/100  Connection: ${s.connection}`);
      }
    }
  });
```

`src/cli/commands/fix.ts`:
```typescript
import { Command } from 'commander';
import { FixEngine } from '../../fix/fix-engine';
import { getSite } from '../../storage/site-repo';
import { listScansForSite } from '../../storage/scan-repo';
import { approveFindingsForSite } from '../../storage/finding-repo';
import { SshConnection } from '../../core/connectors/ssh';
import * as readline from 'readline';

export const fixCommand = new Command('fix')
  .description('Approve and apply fixes for a site')
  .argument('<site>', 'Site slug')
  .action(async (site: string) => {
    const siteConfig = getSite(site);
    if (!siteConfig) { console.log('Site not found'); return; }

    const scans = listScansForSite(site);
    const latest = scans.find(s => s.status === 'completed');
    if (!latest) { console.log('No completed scans found'); return; }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const confirm = await new Promise<string>(r => rl.question('Apply all approved fixes? (yes/no): ', r));
    rl.close();

    if (confirm.toLowerCase() !== 'yes') { console.log('Aborted.'); return; }

    approveFindingsForSite(site, latest.id);

    const conn = new SshConnection(siteConfig.credentials as Parameters<typeof SshConnection.prototype.constructor>[0]);
    const engine = new FixEngine(siteConfig);
    const result = await engine.executeApproved(latest.id, conn);

    console.log(`\nFixed: ${result.fixed}, Failed: ${result.failed}`);
  });
```

`src/cli/commands/dashboard.ts`:
```typescript
import { Command } from 'commander';

export const dashboardCommand = new Command('dashboard')
  .description('Launch the desktop dashboard')
  .action(() => {
    console.log('Dashboard launching...');
  });
```

- [ ] **Step 6: Commit**

```bash
git add src/cli/
git commit -m "feat: add CLI entry point and all subcommands"
```

---


