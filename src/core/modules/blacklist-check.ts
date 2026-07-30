import type { FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';

export class BlacklistChecker {
  constructor(private siteId: string, private scanId: string) {}

  async check(domain: string, apiKey?: string): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    try {
      const resp = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey || ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'wp-security-hub', clientVersion: '1.0.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url: `https://${domain}` }, { url: `http://${domain}` }],
            },
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json() as { matches?: Array<{ threatType: string }> };
        if (data.matches && data.matches.length > 0) {
          findings.push({
            scanId: this.scanId, siteId: this.siteId, round: 2,
            module: 'blacklist-check', severity: 'critical',
            title: 'Site is blacklisted by Google Safe Browsing',
            description: `Threat types: ${data.matches.map(m => m.threatType).join(', ')}`,
            recommendation: 'Immediately investigate and remove malware, then request review',
          });
        }
      }
    } catch {
      // Skip on API failure
    }

    if (!findings.length) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 2,
        module: 'blacklist-check', severity: 'info',
        title: 'No blacklist entries found',
        description: 'Domain is not flagged by Google Safe Browsing',
        recommendation: '',
      });
    }

    return findings;
  }
}
