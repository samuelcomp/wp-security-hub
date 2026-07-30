import type { RemoteConnection } from '../connectors/types';
import type { AgentMemory, FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';
import type { Settings } from '../../config/settings';
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