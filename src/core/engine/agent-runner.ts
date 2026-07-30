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
      const round1 = await this.runRound1(connection, scan.id, this.vaultDir);
      allFindings.push(...round1.findings);

      await this.saveProgress(scan.id, 1, round1.findings.length);

      const round2 = await this.runRound2(round1.memory, this.settings, scan.id);
      allFindings.push(...round2);

      await this.saveProgress(scan.id, 2, allFindings.length);

      const round3 = await this.runRound3(connection, round1.memory, this.settings, this.vaultDir, scan.id);
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
        const conn = new SshConnection(this.site.credentials as ConstructorParameters<typeof SshConnection>[0]);
        await conn.connect();
        return conn;
      }
      case 'cpanel': {
        const conn = new CpanelConnection(this.site.credentials as ConstructorParameters<typeof CpanelConnection>[0]);
        await conn.connect();
        return conn;
      }
      case 'wp-admin': {
        const conn = new WpAdminConnection(this.site.credentials as ConstructorParameters<typeof WpAdminConnection>[0]);
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
  ): Promise<{ memory: import('./types').AgentMemory; findings: CreateFindingInput[] }> {
    const recon = new ReconModule(this.site.id, scanId);
    const result = await recon.run(connection, vaultDir);

    for (const f of result.findings) {
      createFinding(f);
    }

    return { memory: result.memory, findings: result.findings };
  }

  private async runRound2(
    memory: import('./types').AgentMemory,
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
    memory: import('./types').AgentMemory,
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