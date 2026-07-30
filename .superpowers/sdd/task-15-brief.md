 Agent Runner â€” Full 4-Round Orchestration

**Files:**
- Create: `wp-security-hub/src/core/engine/agent-runner.ts`
- Create: `wp-security-hub/src/core/modules/vuln-checker.ts`
- Create: `wp-security-hub/src/core/modules/db-scanner.ts`
- Create: `wp-security-hub/src/core/modules/deep-investigation.ts`
- Create: `wp-security-hub/tests/core/engine/agent-runner.test.ts`

**Interfaces:**
- Consumes: `SiteConfig`, `ScanResult`, `ScanProgress`, `Settings`, all modules
- Produces: `AgentRunner.run(site, settings, vaultDir): Promise<ScanResult>`

- [ ] **Step 1: Write placeholder vuln-checker.ts and db-scanner.ts**

`src/core/modules/vuln-checker.ts`:
```typescript
import type { AgentMemory, FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';

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
          module: 'vuln-checker', severity: 'high',
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
          module: 'vuln-checker', severity: 'low',
          title: `Default plugin present: ${plugin.name}`,
          description: 'Default WordPress plugins should be removed if not used.',
          recommendation: 'Deactivate and delete unused default plugins',
        });
      }
    }

    return findings;
  }
}
```

`src/core/modules/db-scanner.ts`:
```typescript
import type { RemoteConnection } from '../../connectors/types';
import type { FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';

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
              module: 'db-scanner', severity: 'critical',
              title: 'Suspicious plugin entry in database',
              description: 'The active_plugins option contains suspicious plugin paths.',
              recommendation: 'Audit wp_options table for injected plugin entries',
            });
          }
        } catch {
          // Not valid JSON, may be serialized â€” skip
        }
      }

      const userCount = await connection.exec(
        "php -r \"@include('wp-config.php'); @include('wp-includes/wp-db.php'); if(class_exists('wpdb')){ \\$db=new wpdb(DB_USER,DB_PASSWORD,DB_NAME,DB_HOST); \\$r=\\$db->get_var('SELECT COUNT(*) FROM ' . \\$db->prefix . 'users'); echo \\$r; }\" 2>/dev/null"
      );
      if (userCount && parseInt(userCount, 10) > 100) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'db-scanner', severity: 'medium',
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
```

- [ ] **Step 2: Write deep-investigation.ts (Round 3 orchestrator)**

```typescript
import type { RemoteConnection } from '../../connectors/types';
import type { AgentMemory, FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';
import type { Settings } from '../../../config/settings';
import { CoreIntegrity } from './core-integrity';
import { MalwareScanner } from './malware-scanner';
import { ConfigAuditor } from './config-auditor';
import { UserAuditor } from './user-auditor';
import { SslAuditor } from './ssl-auditor';
import { VulnChecker } from './vuln-checker';
import { DbScanner } from './db-scanner';
import { AiAnalyzer } from './ai-analyzer';

export class DeepInvestigation {
  constructor(private siteId: string, private scanId: string) {}

  async run(
    connection: RemoteConnection,
    memory: AgentMemory,
    settings: Settings,
    vaultDir: string,
  ): Promise<CreateFindingInput[]> {
    const allFindings: CreateFindingInput[] = [];

    const coreIntegrity = new CoreIntegrity(this.siteId, this.scanId);
    const allFiles: string[] = [];
    try {
      const filesOutput = await connection.exec('find . -type f 2>/dev/null');
      allFiles.push(...filesOutput.split('\n').filter(f => f.trim()));
    } catch {
      // Skip file listing
    }

    const integrityFindings = await coreIntegrity.check(connection, memory.wpVersion, allFiles);
    allFindings.push(...integrityFindings);

    const configAuditor = new ConfigAuditor(this.siteId, this.scanId);
    allFindings.push(...(await configAuditor.audit(connection)));

    const userAuditor = new UserAuditor(this.siteId, this.scanId);
    allFindings.push(...userAuditor.audit(memory));

    const sslAuditor = new SslAuditor(this.siteId, this.scanId);
    const domain = memory.domain || this.siteId;
    allFindings.push(...(await sslAuditor.audit(domain)));

    const vulnChecker = new VulnChecker(this.siteId, this.scanId);
    allFindings.push(...vulnChecker.check(memory));

    const dbScanner = new DbScanner(this.siteId, this.scanId);
    allFindings.push(...(await dbScanner.scan(connection)));

    const malwareScanner = new MalwareScanner(this.siteId, this.scanId);
    const malwareFindings = await malwareScanner.scan(connection, allFiles);
    allFindings.push(...malwareFindings);

    return allFindings;
  }
}
```

- [ ] **Step 3: Write agent-runner.ts (main 4-round orchestrator)**

```typescript
import type { SiteConfig, ScanResult, ScanProgress, RoundType, FindingSeverity } from './types';
import type { Settings } from '../../config/settings';
import type { CreateFindingInput } from '../../storage/finding-repo';
import { createScan, updateScanProgress, updateScanStatus } from '../../storage/scan-repo';
import { createFinding } from '../../storage/finding-repo';
import { updateHealthScore } from '../../storage/site-repo';
import { ReconModule } from '../modules/recon';
import { ExternalIntel } from '../modules/external-intel';
import { DeepInvestigation } from '../modules/deep-investigation';
import { SshConnection } from '../connectors/ssh';
import { CpanelConnection } from '../connectors/cpanel';
import { WpAdminConnection } from '../connectors/wp-admin';
import type { RemoteConnection } from '../connectors/types';
import fs from 'fs';
import path from 'path';

export class AgentRunner {
  constructor(
    private site: SiteConfig,
    private settings: Settings,
    private vaultDir: string
  ) {}

  async run(): Promise<ScanResult> {
    const scan = createScan(this.site.id);
    let connection: RemoteConnection | null = null;

    try {
      connection = await this.connect();
    } catch (err) {
      updateScanStatus(scan.id, 'failed', []);
      throw new Error(`Connection failed for ${this.site.domain}: ${(err as Error).message}`);
    }

    const allFindings: CreateFindingInput[] = [];

    try {
      const round1 = await this.runRound1(connection, scan.id, vaultDir);
      allFindings.push(...round1.findings);

      await this.saveProgress(scan.id, 1, round1.findings.length);

      const round2 = await this.runRound2(round1.memory, settings, scan.id);
      allFindings.push(...round2);

      await this.saveProgress(scan.id, 2, allFindings.length);

      const round3 = await this.runRound3(connection, round1.memory, settings, vaultDir, scan.id);
      allFindings.push(...round3);

      await this.saveProgress(scan.id, 3, allFindings.length);

      const healthScore = this.calculateHealthScore(allFindings);
      updateHealthScore(this.site.id, healthScore);

      await this.saveProgress(scan.id, 4, allFindings.length);
      updateScanStatus(scan.id, 'completed', [1, 2, 3, 4]);

      return { ...scan, status: 'completed', roundsCompleted: [1, 2, 3, 4], findings: [] };
    } catch (err) {
      updateScanStatus(scan.id, 'failed', []);
      throw err;
    } finally {
      await connection?.disconnect();
    }
  }

  private async connect(): Promise<RemoteConnection> {
    switch (this.site.connection) {
      case 'ssh': {
        const conn = new SshConnection(this.site.credentials as Parameters<typeof SshConnection.prototype.constructor>[0]);
        await conn.connect();
        return conn;
      }
      case 'cpanel': {
        const conn = new CpanelConnection(this.site.credentials as Parameters<typeof CpanelConnection.prototype.constructor>[0]);
        await conn.connect();
        return conn;
      }
      case 'wp-admin': {
        const conn = new WpAdminConnection(this.site.credentials as Parameters<typeof WpAdminConnection.prototype.constructor>[0]);
        await conn.connect();
        return conn;
      }
      default:
        throw new Error(`Unknown connection type: ${this.site.connection}`);
    }
  }

  private async runRound1(
    connection: RemoteConnection,
    scanId: string,
    vaultDir: string
  ): Promise<{ memory: import('../../engine/types').AgentMemory; findings: CreateFindingInput[] }> {
    const recon = new ReconModule(this.site.id, scanId);
    const result = await recon.run(connection, vaultDir);

    for (const f of result.findings) {
      createFinding(f);
    }

    return { memory: result.memory, findings: result.findings };
  }

  private async runRound2(
    memory: import('../../engine/types').AgentMemory,
    settings: Settings,
    scanId: string
  ): Promise<CreateFindingInput[]> {
    const intel = new ExternalIntel(this.site.id, scanId);
    const findings = await intel.run(memory, settings);

    for (const f of findings) {
      createFinding(f);
    }

    return findings;
  }

  private async runRound3(
    connection: RemoteConnection,
    memory: import('../../engine/types').AgentMemory,
    settings: Settings,
    vaultDir: string,
    scanId: string
  ): Promise<CreateFindingInput[]> {
    const investigation = new DeepInvestigation(this.site.id, scanId);
    const findings = await investigation.run(connection, memory, settings, vaultDir);

    for (const f of findings) {
      createFinding(f);
    }

    return findings;
  }

  private async saveProgress(scanId: string, round: RoundType, count: number): Promise<void> {
    updateScanProgress(scanId, {
      currentRound: (round + 1) as RoundType,
      roundProgress: 100,
      findingsCount: count,
      modulesCompleted: [],
      modulesPending: [],
    });
  }

  private calculateHealthScore(findings: CreateFindingInput[]): number {
    if (findings.length === 0) return 100;

    const weights = { critical: -25, high: -15, medium: -8, low: -3, info: 0 };
    let score = 100;

    for (const f of findings) {
      const weight = weights[f.severity as keyof typeof weights] || 0;
      score += weight;
    }

    return Math.max(0, Math.min(100, score));
  }
}
```

- [ ] **Step 4: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/core/modules/vuln-checker.ts src/core/modules/db-scanner.ts src/core/modules/deep-investigation.ts src/core/engine/agent-runner.ts
git commit -m "feat: add agent runner with 4-round scan orchestration"
```

---


