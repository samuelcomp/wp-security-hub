import { Command } from 'commander';
import { FixEngine } from '../../fix/fix-engine';
import { getSite } from '../../storage/site-repo';
import { listScansForSite } from '../../storage/scan-repo';
import { approveFindingsForSite } from '../../storage/finding-repo';
import { SshConnection } from '../../core/connectors/ssh';
import type { SshCredentials } from '../../core/engine/types';
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

    const conn = new SshConnection(siteConfig.credentials as SshCredentials);
    const engine = new FixEngine(siteConfig);
    const result = await engine.executeApproved(latest.id, conn);

    console.log(`\nFixed: ${result.fixed}, Failed: ${result.failed}`);
  });