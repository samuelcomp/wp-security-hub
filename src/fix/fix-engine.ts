import type { Finding, FixAction, FixRecord } from '../core/engine/types';
import type { RemoteConnection } from '../core/connectors/types';
import { listFindingsForScan, markFindingFixed } from '../storage/finding-repo';
import { createFixRecord } from '../storage/fix-repo';
import type { SiteConfig } from '../core/engine/types';

export class FixEngine {
  constructor(private site: SiteConfig) {}

  async executeApproved(
    scanId: string,
    connection: RemoteConnection
  ): Promise<{ fixed: number; failed: number; records: FixRecord[] }> {
    await connection.connect();

    const findings = listFindingsForScan(scanId).filter(f => f.status === 'approved');
    const records: FixRecord[] = [];
    let fixed = 0;
    let failed = 0;

    for (const finding of findings) {
      if (!finding.fixAction) continue;

      try {
        const before = await this.snapshot(finding, connection);
        await this.executeFix(finding, connection);
        const after = await this.snapshot(finding, connection);

        markFindingFixed(finding.id, JSON.stringify({ before, after }));
        records.push(createFixRecord(
          finding.id, this.site.id, finding.fixAction,
          before, after, true
        ));
        fixed++;
      } catch (err) {
        records.push(createFixRecord(
          finding.id, this.site.id, finding.fixAction,
          null, null, false
        ));
        failed++;
        console.error(`Fix failed for ${finding.id}:`, (err as Error).message);
      }
    }

    await connection.disconnect();
    return { fixed, failed, records };
  }

  private async snapshot(finding: Finding, conn: RemoteConnection): Promise<string | null> {
    if (!finding.sourceFile) return null;
    try {
      return await conn.exec(`cat ${finding.sourceFile} 2>/dev/null`);
    } catch {
      return null;
    }
  }

  private async executeFix(finding: Finding, conn: RemoteConnection): Promise<void> {
    if (!finding.fixAction || !finding.sourceFile) return;

    switch (finding.fixAction) {
      case 'delete-file':
        await conn.exec(`rm -f "${finding.sourceFile}"`);
        break;
      case 'replace-file':
        await conn.exec(`rm -f "${finding.sourceFile}"`);
        break;
      case 'update-plugin':
        await conn.exec(`wp plugin update ${finding.sourceFile.split('/').pop()} --allow-root 2>/dev/null || true`);
        break;
      case 'update-core':
        await conn.exec('wp core update --allow-root 2>/dev/null || true');
        break;
      case 'delete-user':
        const username = finding.description?.match(/"(admin)"/)?.[1] || finding.title.match(/"([^"]+)"/)?.[1];
        if (username) {
          await conn.exec(`wp user delete "${username}" --allow-root --reassign=1 2>/dev/null || true`);
        }
        break;
      case 'disable-xmlrpc':
        await conn.exec('echo "# XML-RPC disabled by WP Security Hub" >> .htaccess');
        await conn.exec('echo "<Files xmlrpc.php>" >> .htaccess');
        await conn.exec('echo "Order Deny,Allow" >> .htaccess');
        await conn.exec('echo "Deny from all" >> .htaccess');
        await conn.exec('echo "</Files>" >> .htaccess');
        break;
      case 'chmod':
        await conn.exec(`chmod 400 "${finding.sourceFile}"`);
        break;
      case 'htaccess-rule':
        await conn.exec('echo "Options -Indexes" >> .htaccess');
        break;
      case 'wp-config-edit':
        if (finding.title.includes('WP_DEBUG')) {
          await conn.exec(
            "sed -i \"s/define('WP_DEBUG', true)/define('WP_DEBUG', false)/\" wp-config.php"
          );
        }
        if (finding.title.includes('DISALLOW_FILE_EDIT')) {
          await conn.exec(
            'echo "define(\'DISALLOW_FILE_EDIT\', true);" >> wp-config.php'
          );
        }
        break;
      default:
        console.log(`Unknown fix action: ${finding.fixAction}`);
    }
  }
}