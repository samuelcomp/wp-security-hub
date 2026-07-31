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
    const domain = memory.domain || this.siteId;
    const cleanDomain = domain.replace(/^https?:\/\//, '');

    await Promise.allSettled([
      this.checkSucuriFree(cleanDomain, findings),
      this.checkVirusTotalFree(cleanDomain, findings),
      this.checkHackerTargetFree(cleanDomain, findings),
    ]);

    return findings;
  }

  private async checkSucuriFree(domain: string, findings: CreateFindingInput[]): Promise<void> {
    try {
      const resp = await fetch(`https://sitecheck.sucuri.net/results/${encodeURIComponent(domain)}`);
      if (!resp.ok) return;
      const html = await resp.text();

      const foundMalware = /malware/i.test(html) && /detected|found|infected/i.test(html);
      const foundBlacklist = /blacklist/i.test(html) && /listed|blocked|warning/i.test(html);
      const isClean = /not\s+infected|no\s+malware|clean/i.test(html) || /site\s+is\s+clean/i.test(html);

      if (foundMalware) {
        const malwareMatch = html.match(/malware[^<]*<\/[^>]+>([^<]{20,200})/i);
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 2,
          module: 'external-intel', severity: 'critical',
          title: 'Sucuri SiteCheck: Malware detected',
          description: malwareMatch ? malwareMatch[0].replace(/<[^>]+>/g, '').trim().substring(0, 200) : 'Sucuri reports malware on this site',
          recommendation: 'Run full malware scan and check Sucuri report for details',
        });
      }

      if (foundBlacklist) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 2,
          module: 'external-intel', severity: 'critical',
          title: 'Sucuri SiteCheck: Site blacklisted',
          description: `Domain ${domain} is listed on Sucuri blacklists`,
          recommendation: 'Remove malware and request delisting',
        });
      }

      if (isClean && !foundMalware && !foundBlacklist) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 2,
          module: 'external-intel', severity: 'info',
          title: 'Sucuri SiteCheck: Clean',
          description: 'Sucuri free scan reports no malware or blacklist issues',
          recommendation: '',
        });
      }
    } catch {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 2,
        module: 'external-intel', severity: 'info',
        title: 'Sucuri scan unavailable',
        description: 'Could not reach Sucuri for free scan. Click external scanner link on site page to check manually.',
        recommendation: '',
      });
    }
  }

  private async checkVirusTotalFree(domain: string, findings: CreateFindingInput[]): Promise<void> {
    try {
      const resp = await fetch(`https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}`);
      if (!resp.ok) return;
      const html = await resp.text();

      const detectMatch = html.match(/(\d+)\s*\/\s*(\d+)\s*security\s*vendors/i);
      if (detectMatch) {
        const detected = parseInt(detectMatch[1], 10);
        const total = parseInt(detectMatch[2], 10);
        if (detected > 0) {
          findings.push({
            scanId: this.scanId, siteId: this.siteId, round: 2,
            module: 'external-intel', severity: 'critical',
            title: `VirusTotal: ${detected}/${total} vendors flagged this domain`,
            description: `${detected} out of ${total} security vendors detected threats on ${domain}`,
            recommendation: 'Investigate immediately. Check VirusTotal report for specific detections.',
          });
        } else {
          findings.push({
            scanId: this.scanId, siteId: this.siteId, round: 2,
            module: 'external-intel', severity: 'info',
            title: `VirusTotal: Clean (0/${total} detections)`,
            description: 'No security vendors flagged this domain',
            recommendation: '',
          });
        }
      }
    } catch {
      // Viralototal may block automated requests — skip silently
    }
  }

  private async checkHackerTargetFree(domain: string, findings: CreateFindingInput[]): Promise<void> {
    try {
      const resp = await fetch(`https://hackertarget.com/wordpress-security-scan/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent('https://' + domain)}`,
      });
      if (!resp.ok) return;
      const html = await resp.text();

      if (html.includes('vulnerable') || html.includes('outdated') || html.includes('warning')) {
        const excerptMatch = html.match(/vulnerab[^<]*<\/[^>]+>([^<]{30,300})/i);
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 2,
          module: 'external-intel', severity: 'high',
          title: 'HackerTarget: Issues found',
          description: excerptMatch ? excerptMatch[0].replace(/<[^>]+>/g, '').trim().substring(0, 200) : 'HackerTarget WordPress scan found potential issues',
          recommendation: 'Check full HackerTarget report for details',
        });
      } else if (html.includes('no issues') || html.includes('clean') || html.includes('passed')) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 2,
          module: 'external-intel', severity: 'info',
          title: 'HackerTarget: No issues found',
          description: 'HackerTarget WordPress scan passed',
          recommendation: '',
        });
      }
    } catch {
      // Skip on failure
    }
  }
}
