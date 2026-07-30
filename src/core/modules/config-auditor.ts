import type { RemoteConnection } from '../connectors/types';
import type { FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';

export class ConfigAuditor {
  constructor(private siteId: string, private scanId: string) {}

  async audit(connection: RemoteConnection): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    try {
      const wpConfig = await connection.exec('cat wp-config.php 2>/dev/null');
      if (!wpConfig) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'config-auditor', severity: 'high',
          title: 'wp-config.php not found or not readable',
          description: 'Could not read wp-config.php for security audit.',
          recommendation: 'Ensure wp-config.php exists and has correct permissions',
        });
        return findings;
      }

      if (wpConfig.includes("define('WP_DEBUG', true)")) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'config-auditor', severity: 'medium',
          title: 'WP_DEBUG is enabled',
          description: 'Debug mode exposes internal paths and errors to visitors.',
          recommendation: 'Set WP_DEBUG to false in production',
          fixAction: 'wp-config-edit',
        });
      }

      if (wpConfig.includes("define('DISALLOW_FILE_EDIT'") && !wpConfig.includes("define('DISALLOW_FILE_EDIT', true)")) {
        // OK - explicitly set to true
      } else if (!wpConfig.includes("DISALLOW_FILE_EDIT")) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'config-auditor', severity: 'medium',
          title: 'Theme/plugin file editing is enabled',
          description: 'Administrators can edit theme and plugin files from the dashboard.',
          recommendation: "Add define('DISALLOW_FILE_EDIT', true) to wp-config.php",
          fixAction: 'wp-config-edit',
        });
      }

      const salts = ['AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY',
        'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT'];
      for (const salt of salts) {
        if (wpConfig.includes(`'put your unique phrase here'`)) {
          findings.push({
            scanId: this.scanId, siteId: this.siteId, round: 3,
            module: 'config-auditor', severity: 'high',
            title: 'Default WordPress salts detected',
            description: 'Security keys and salts use default values, weakening session security.',
            recommendation: 'Generate new salts from https://api.wordpress.org/secret-key/1.1/salt/',
            fixAction: 'wp-config-edit',
          });
          break;
        }
      }

      if (wpConfig.includes("define('DB_USER'") && wpConfig.match(/DB_PASSWORD.*'[^']+'/)?.[0]?.includes("'root'")) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'config-auditor', severity: 'high',
          title: 'Database may be using root or weak credentials',
          description: 'Database credentials should use a dedicated user with minimal privileges.',
          recommendation: 'Create a dedicated database user with limited privileges',
        });
      }
    } catch (err) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 3,
        module: 'config-auditor', severity: 'medium',
        title: 'Config audit partially failed',
        description: `Error: ${(err as Error).message}`,
        recommendation: 'Check file permissions and credentials',
      });
    }

    try {
      const htaccess = await connection.exec('cat .htaccess 2>/dev/null');
      if (htaccess) {
        if (!htaccess.includes('Options -Indexes')) {
          findings.push({
            scanId: this.scanId, siteId: this.siteId, round: 3,
            module: 'config-auditor', severity: 'low',
            title: 'Directory listing is enabled',
            description: 'Visitors can browse directory contents.',
            recommendation: 'Add "Options -Indexes" to .htaccess',
            fixAction: 'htaccess-rule',
          });
        }
      }
    } catch {
      // .htaccess may not exist, skip
    }

    try {
      const xmlrpcResp = await connection.exec(
        'curl -s -o /dev/null -w "%{http_code}" http://localhost/xmlrpc.php 2>/dev/null'
      );
      if (xmlrpcResp.trim() !== '405' && xmlrpcResp.trim() !== '403') {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'config-auditor', severity: 'medium',
          title: 'XML-RPC is accessible',
          description: 'XML-RPC can be used for brute force attacks and DDoS amplification.',
          recommendation: 'Disable XML-RPC if not needed (most sites do not need it)',
          fixAction: 'disable-xmlrpc',
        });
      }
    } catch {
      // Skip XML-RPC check on error
    }

    return findings;
  }
}
