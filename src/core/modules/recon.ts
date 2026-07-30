import type { RemoteConnection } from '../connectors/types';
import type { AgentMemory, FindingSeverity } from '../engine/types';
import { createFinding, type CreateFindingInput } from '../../storage/finding-repo';
import fs from 'fs';
import path from 'path';

export class ReconModule {
  constructor(private siteId: string, private scanId: string) {}

  async run(connection: RemoteConnection, vaultDir: string): Promise<{ memory: AgentMemory; findings: CreateFindingInput[] }> {
    const findings: CreateFindingInput[] = [];
    const memory: AgentMemory = {
      siteId: this.siteId,
      domain: '',
      phpVersion: '',
      wpVersion: '',
      serverSoftware: '',
      plugins: [],
      themes: [],
      users: [],
      fileCount: 0,
      knownIssues: [],
      lastScanAt: new Date().toISOString(),
    };

    try {
      memory.wpVersion = await this.detectWordPressVersion(connection, findings);
      memory.phpVersion = await this.detectPhpVersion(connection, findings);
      memory.serverSoftware = await this.detectServerSoftware(connection);
      memory.plugins = await this.detectPlugins(connection, findings);
      memory.themes = await this.detectThemes(connection, findings);
      memory.users = await this.detectUsers(connection, findings);
      memory.fileCount = await this.countFiles(connection);
    } catch (err) {
      findings.push({
        scanId: this.scanId,
        siteId: this.siteId,
        round: 1,
        module: 'recon',
        severity: 'high' as FindingSeverity,
        title: 'Reconnaissance partially failed',
        description: `Could not complete all recon steps: ${(err as Error).message}`,
        recommendation: 'Check connection credentials and server accessibility',
      });
    }

    this.saveMemory(vaultDir, memory);

    return { memory, findings };
  }

  private async detectWordPressVersion(
    connection: RemoteConnection,
    findings: CreateFindingInput[]
  ): Promise<string> {
    try {
      const versionFile = await connection.exec('cat wp-includes/version.php 2>/dev/null | grep "wp_version" | head -1');
      if (!versionFile) return 'unknown';
      const match = versionFile.match(/wp_version\s*=\s*'([^']+)'/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async detectPhpVersion(
    connection: RemoteConnection,
    findings: CreateFindingInput[]
  ): Promise<string> {
    try {
      return await connection.exec('php -v 2>/dev/null | head -1');
    } catch {
      return 'unknown';
    }
  }

  private async detectServerSoftware(connection: RemoteConnection): Promise<string> {
    try {
      return await connection.exec('head -1 /etc/os-release 2>/dev/null || uname -a');
    } catch {
      return 'unknown';
    }
  }

  private async detectPlugins(
    connection: RemoteConnection,
    findings: CreateFindingInput[]
  ): Promise<AgentMemory['plugins']> {
    try {
      const result = await connection.exec('ls -d wp-content/plugins/*/ 2>/dev/null');
      if (!result) return [];
      const dirs = result.split('\n').filter(d => d.trim());
      const plugins: AgentMemory['plugins'] = [];

      for (const dir of dirs) {
        const name = path.basename(dir);
        const mainFile = await connection.exec(
          `head -20 wp-content/plugins/${name}/${name}.php 2>/dev/null || head -20 wp-content/plugins/${name}/index.php 2>/dev/null`
        );
        const verMatch = mainFile.match(/Version:\s*([^\n]+)/);
        plugins.push({
          name,
          version: verMatch ? verMatch[1].trim() : 'unknown',
          status: 'active',
        });
      }
      return plugins;
    } catch {
      return [];
    }
  }

  private async detectThemes(
    connection: RemoteConnection,
    findings: CreateFindingInput[]
  ): Promise<AgentMemory['themes']> {
    try {
      const result = await connection.exec('ls -d wp-content/themes/*/ 2>/dev/null');
      if (!result) return [];
      const dirs = result.split('\n').filter(d => d.trim());
      const themes: AgentMemory['themes'] = [];

      for (const dir of dirs) {
        const name = path.basename(dir);
        const styleCss = await connection.exec(
          `head -20 wp-content/themes/${name}/style.css 2>/dev/null`
        );
        const verMatch = styleCss.match(/Version:\s*([^\n]+)/);
        themes.push({
          name,
          version: verMatch ? verMatch[1].trim() : 'unknown',
          status: 'unknown',
        });
      }
      return themes;
    } catch {
      return [];
    }
  }

  private async detectUsers(
    connection: RemoteConnection,
    findings: CreateFindingInput[]
  ): Promise<AgentMemory['users']> {
    try {
      const result = await connection.exec(
        "php -r \"include('wp-config.php'); include('wp-includes/wp-db.php'); \\$wpdb = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST); \\$users = \\$wpdb->get_results('SELECT user_login, user_email FROM ' . \\$wpdb->prefix . 'users'); foreach(\\$users as \\$user) echo \\$user->user_login . PHP_EOL;\" 2>/dev/null"
      );
      if (!result) return [];
      return result.split('\n').filter(u => u.trim()).map(u => ({
        login: u.trim(),
        role: 'unknown',
      }));
    } catch {
      return [];
    }
  }

  private async countFiles(connection: RemoteConnection): Promise<number> {
    try {
      const result = await connection.exec('find . -type f 2>/dev/null | wc -l');
      return parseInt(result.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  private saveMemory(vaultDir: string, memory: AgentMemory): void {
    const siteDir = path.join(vaultDir, 'sites', this.siteId);
    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(siteDir, 'context.md'),
      `# ${memory.domain || this.siteId} - Reconnaissance\n\n` +
      `- **WordPress Version:** ${memory.wpVersion}\n` +
      `- **PHP Version:** ${memory.phpVersion}\n` +
      `- **Server:** ${memory.serverSoftware}\n` +
      `- **Files:** ${memory.fileCount}\n` +
      `- **Last Scan:** ${memory.lastScanAt}\n\n` +
      `## Plugins\n${memory.plugins.map(p => `- ${p.name} (${p.version})`).join('\n')}\n\n` +
      `## Themes\n${memory.themes.map(t => `- ${t.name} (${t.version})`).join('\n')}\n\n` +
      `## Users\n${memory.users.map(u => `- ${u.login} (${u.role})`).join('\n')}\n`
    );
  }
}