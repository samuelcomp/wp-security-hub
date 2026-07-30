import type { FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';
import tls from 'tls';

export class SslAuditor {
  constructor(private siteId: string, private scanId: string) {}

  async audit(domain: string): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = tls.connect({
          host: domain,
          port: 443,
          servername: domain,
          rejectUnauthorized: false,
        }, () => {
          const cert = socket.getPeerCertificate(true);
          const cipher = socket.getCipher();

          if (!cert || Object.keys(cert).length === 0) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 3,
              module: 'ssl-auditor', severity: 'high',
              title: 'No valid SSL certificate',
              description: 'The site does not have a valid SSL/TLS certificate.',
              recommendation: 'Install a valid SSL certificate (free via Let\'s Encrypt)',
            });
          }

          const now = Date.now();
          const validTo = new Date(cert.valid_to).getTime();
          const daysLeft = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
          if (daysLeft < 30 && daysLeft > 0) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 3,
              module: 'ssl-auditor', severity: 'medium',
              title: `SSL certificate expires in ${daysLeft} days`,
              description: `Certificate valid until ${cert.valid_to}.`,
              recommendation: 'Renew the SSL certificate before expiration',
            });
          }

          if (cert.issuer?.O === 'Internet Widgits Pty Ltd' || !cert.issuer?.O) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 3,
              module: 'ssl-auditor', severity: 'low',
              title: 'Self-signed or untrusted certificate issuer',
              description: 'The SSL certificate is not issued by a trusted CA.',
              recommendation: 'Obtain a certificate from a trusted Certificate Authority',
            });
          }

          socket.end();
          resolve();
        });

        socket.on('error', () => {
          findings.push({
            scanId: this.scanId, siteId: this.siteId, round: 3,
            module: 'ssl-auditor', severity: 'critical',
            title: 'HTTPS connection failed',
            description: `Could not establish TLS connection to ${domain}.`,
            recommendation: 'Configure SSL/TLS on the web server',
          });
          resolve();
        });

        socket.setTimeout(10000, () => {
          socket.destroy();
          resolve();
        });
      });
    } catch {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 3,
        module: 'ssl-auditor', severity: 'info',
        title: 'SSL audit skipped',
        description: 'Could not complete SSL/TLS verification.',
        recommendation: 'Check HTTPS manually',
      });
    }

    return findings;
  }
}
