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