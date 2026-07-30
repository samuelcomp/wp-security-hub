import type { AgentMemory, FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';

export class VulnChecker {
  constructor(private siteId: string, private scanId: string) {}

  check(memory: AgentMemory): CreateFindingInput[] {
    const findings: CreateFindingInput[] = [];

    if (memory.wpVersion && memory.wpVersion !== 'unknown') {
      const majorMinor = memory.wpVersion.split('.').slice(0, 2).join('.');
      const minorVer = parseInt(memory.wpVersion.split('.')[1] || '0', 10);
      if (parseFloat(majorMinor) < 6.5) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'vuln-checker', severity: 'high' as FindingSeverity,
          title: `Outdated WordPress core: ${memory.wpVersion}`,
          description: 'Running an outdated WordPress version with known vulnerabilities.',
          recommendation: 'Update WordPress to the latest version',
          fixAction: 'update-core',
        });
      }
    }

    for (const plugin of memory.plugins) {
      if (plugin.name === 'hello' || plugin.name === 'akismet' && plugin.version === '1.0') {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'vuln-checker', severity: 'low' as FindingSeverity,
          title: `Default plugin present: ${plugin.name}`,
          description: 'Default WordPress plugins should be removed if not used.',
          recommendation: 'Deactivate and delete unused default plugins',
        });
      }
    }

    return findings;
  }
}