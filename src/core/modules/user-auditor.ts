import type { RemoteConnection } from '../connectors/types';
import type { AgentMemory, FindingSeverity } from '../engine/types';
import type { CreateFindingInput } from '../../storage/finding-repo';

export class UserAuditor {
  constructor(private siteId: string, private scanId: string) {}

  audit(memory: AgentMemory): CreateFindingInput[] {
    const findings: CreateFindingInput[] = [];

    const admins = memory.users.filter(u => u.role === 'administrator' || u.role === 'admin');
    if (admins.length > 5) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 3,
        module: 'user-auditor', severity: 'medium',
        title: `Excessive admin accounts: ${admins.length}`,
        description: 'Having too many administrator accounts increases attack surface.',
        recommendation: 'Audit admin users and remove unnecessary accounts',
      });
    }

    if (memory.users.some(u => u.login === 'admin')) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 3,
        module: 'user-auditor', severity: 'high',
        title: 'Default "admin" username detected',
        description: 'Using "admin" as a username makes brute force attacks easier.',
        recommendation: 'Create a new admin account and delete the "admin" user',
        fixAction: 'delete-user',
      });
    }

    const suspiciousLogins = ['administrator', 'test', 'demo', 'user', 'wordpress', 'wp'];
    for (const user of memory.users) {
      if (suspiciousLogins.includes(user.login.toLowerCase())) {
        findings.push({
          scanId: this.scanId, siteId: this.siteId, round: 3,
          module: 'user-auditor', severity: 'medium',
          title: `Suspicious username: ${user.login}`,
          description: 'Common or easily guessable usernames increase brute force risk.',
          recommendation: `Replace "${user.login}" with a unique username`,
        });
      }
    }

    if (memory.users.length === 0) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 3,
        module: 'user-auditor', severity: 'info',
        title: 'Could not enumerate users',
        description: 'User list could not be retrieved from this connection method.',
        recommendation: 'Check users manually via WP Admin or database',
      });
    }

    return findings;
  }
}
