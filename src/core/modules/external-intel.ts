import type { AgentMemory, FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';
import type { Settings } from '../../config/settings';

export class ExternalIntel {
  constructor(private siteId: string, private scanId: string) {}

  async run(
    memory: AgentMemory,
    settings: Settings
  ): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];
    const apiKeys = settings.apiKeys;

    await Promise.allSettled([
      this.checkWpscan(memory, apiKeys, findings),
      this.checkSucuri(memory.domain || this.siteId, apiKeys, findings),
    ]);

    return findings;
  }

  private async checkWpscan(
    memory: AgentMemory,
    apiKeys: Settings['apiKeys'],
    findings: CreateFindingInput[]
  ): Promise<void> {
    if (!apiKeys.wpscan?.key) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 2,
        module: 'external-intel', severity: 'info',
        title: 'WPScan skipped (no API key)',
        description: 'Add a WPScan API key to enable vulnerability database lookup.',
        recommendation: 'Get a free API key from https://wpscan.com/',
      });
      return;
    }

    for (const plugin of memory.plugins) {
      try {
        const resp = await fetch(
          `https://wpscan.com/api/v3/plugins/${plugin.name}`,
          { headers: { Authorization: `Token token=${apiKeys.wpscan.key}` } }
        );
        if (resp.ok) {
          const data = await resp.json() as Record<string, unknown>;
          const vulns = (data[plugin.name] as { vulnerabilities?: Array<{ title: string; fixed_in?: string }> })?.vulnerabilities || [];
          for (const vuln of vulns) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 2,
              module: 'vuln-checker', severity: 'high',
              title: `Vulnerable plugin: ${plugin.name} v${plugin.version}`,
              description: vuln.title,
              sourceFile: `wp-content/plugins/${plugin.name}/`,
              recommendation: vuln.fixed_in
                ? `Update to version ${vuln.fixed_in} or later`
                : 'Remove or replace this plugin',
              fixAction: 'update-plugin',
            });
          }
        }
      } catch {
        // Skip individual API failures
      }

      if (findings.length > 50) break;
    }
  }

  private async checkSucuri(
    domain: string,
    apiKeys: Settings['apiKeys'],
    findings: CreateFindingInput[]
  ): Promise<void> {
    if (!apiKeys.sucuri?.key) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 2,
        module: 'external-intel', severity: 'info',
        title: 'Sucuri scan skipped (no API key)',
        description: 'Add a Sucuri API key for remote malware scanning.',
        recommendation: 'Get an API key from https://sitecheck.sucuri.net/',
      });
      return;
    }

    try {
      const resp = await fetch(
        `https://sitecheck.sucuri.net/api/v1/scan?url=${encodeURIComponent(domain)}`,
        { headers: { 'X-API-Key': apiKeys.sucuri.key } }
      );
      if (resp.ok) {
        const data = await resp.json() as { malware?: Array<{ type: string; payload: string }> };
        if (data.malware && data.malware.length > 0) {
          for (const m of data.malware) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 2,
              module: 'external-intel', severity: 'critical',
              title: `Sucuri detected malware: ${m.type}`,
              description: m.payload,
              recommendation: 'Investigate and remove the detected malware immediately',
            });
          }
        }
      }
    } catch {
      // Skip on API failure
    }
  }
}