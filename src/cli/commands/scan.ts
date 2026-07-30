import { Command } from 'commander';
import { Orchestrator } from '../../core/engine/orchestrator';
import { loadSettings, resolveRootDir } from '../../config/settings';
import { openDb, closeDb } from '../../storage/db';
import { setEncryptionKey } from '../../storage/site-repo';
import { getSite, listSites } from '../../storage/site-repo';
import { listFindingsForScan } from '../../storage/finding-repo';
import { listScansForSite } from '../../storage/scan-repo';
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