import type { RemoteConnection } from '../connectors/types';
import type { FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';

const CORE_FILES = [
  'wp-admin/', 'wp-includes/', 'index.php', 'wp-activate.php',
  'wp-blog-header.php', 'wp-comments-post.php', 'wp-config-sample.php',
  'wp-cron.php', 'wp-links-opml.php', 'wp-load.php', 'wp-login.php',
  'wp-mail.php', 'wp-settings.php', 'wp-signup.php', 'wp-trackback.php',
  'xmlrpc.php',
];

export class CoreIntegrity {
  constructor(private siteId: string, private scanId: string) {}

  async check(
    connection: RemoteConnection,
    wpVersion: string,
    allFiles: string[]
  ): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    try {
      const resp = await fetch(
        `https://api.wordpress.org/core/checksums/1.0/?version=${wpVersion}&locale=en_US`
      );
      if (!resp.ok) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'core-integrity', severity: 'info',
          title: 'Core integrity check skipped',
          description: `WordPress.org checksums not available for version ${wpVersion}`,
          recommendation: 'Ensure WordPress is updated to a supported version',
        });
        return findings;
      }

      const data = await resp.json() as { checksums: Record<string, string> };
      const checksums = data.checksums || {};

      for (const [file, expectedMd5] of Object.entries(checksums)) {
        try {
          const result = await connection.exec(`md5sum ${file} 2>/dev/null | cut -d' ' -f1`);
          const actualMd5 = result.trim();
          if (actualMd5 && actualMd5 !== expectedMd5) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 3,
              module: 'core-integrity', severity: 'high',
              title: `Modified core file: ${file}`,
              description: `Checksum mismatch for WordPress core file. Expected ${expectedMd5}, got ${actualMd5}.`,
              sourceFile: file,
              recommendation: `Replace ${file} with the official version from WordPress.org`,
              fixAction: 'replace-file',
            });
          }
        } catch {
          // File not found, not an issue
        }

        if (findings.length > 100) break;
      }

      for (const file of allFiles) {
        if (
          file.includes('wp-links-') ||
          file.includes('wp-mail-') ||
          (file.includes('wp-') && file.includes('.php') && !CORE_FILES.some(cf => file.includes(cf)))
        ) {
          const isExtraCore = file.match(/^\.\/(wp-[a-z-]+\.php)$/);
          if (isExtraCore && !checksums[file.replace('./', '')]) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 3,
              module: 'core-integrity', severity: 'high',
              title: `Unknown file in WordPress root: ${file}`,
              description: `Unexpected PHP file found in WordPress root directory.`,
              sourceFile: file,
              recommendation: 'Review and delete if not legitimate',
              fixAction: 'delete-file',
            });
          }
        }
        if (findings.length > 150) break;
      }
    } catch (err) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 3,
        module: 'core-integrity', severity: 'medium',
        title: 'Core integrity check failed',
        description: `Could not verify core integrity: ${(err as Error).message}`,
        recommendation: 'Check network connectivity and WordPress.org API status',
      });
    }

    return findings;
  }
}
