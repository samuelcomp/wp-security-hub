import type { RemoteConnection } from '../connectors/types';
import type { FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';

export class DbScanner {
  constructor(private siteId: string, private scanId: string) {}

  async scan(connection: RemoteConnection): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    try {
      const activePlugins = await connection.exec(
        "php -r \"@include('wp-config.php'); @include('wp-includes/wp-db.php'); if(class_exists('wpdb')){ \\$db=new wpdb(DB_USER,DB_PASSWORD,DB_NAME,DB_HOST); \\$r=\\$db->get_var('SELECT option_value FROM ' . \\$db->prefix . 'options WHERE option_name=\\\"active_plugins\\\"'); echo \\$r; }\" 2>/dev/null"
      );

      if (activePlugins) {
        try {
          const plugins = JSON.parse(activePlugins) as string[];
          if (plugins.some(p => p.includes('base64') || p.includes('eval') || p.includes('shell'))) {
            findings.push({
              scanId: this.scanId, siteId: this.siteId, round: 3,
              module: 'db-scanner', severity: 'critical' as FindingSeverity,
              title: 'Suspicious plugin entry in database',
              description: 'The active_plugins option contains suspicious plugin paths.',
              recommendation: 'Audit wp_options table for injected plugin entries',
            });
          }
        } catch {
          // Not valid JSON, may be serialized — skip
        }
      }

      const userCount = await connection.exec(
        "php -r \"@include('wp-config.php'); @include('wp-includes/wp-db.php'); if(class_exists('wpdb')){ \\$db=new wpdb(DB_USER,DB_PASSWORD,DB_NAME,DB_HOST); \\$r=\\$db->get_var('SELECT COUNT(*) FROM ' . \\$db->prefix . 'users'); echo \\$r; }\" 2>/dev/null"
      );
      if (userCount && parseInt(userCount, 10) > 100) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'db-scanner', severity: 'medium' as FindingSeverity,
          title: `Unusually high user count: ${userCount.trim()}`,
          description: 'Large number of registered users may indicate spam accounts.',
          recommendation: 'Audit user list and remove spam accounts',
        });
      }
    } catch {
      // Database inaccessible via this method
    }

    return findings;
  }
}