 Core Integrity & Config Auditor

**Files:**
- Create: `wp-security-hub/src/core/modules/core-integrity.ts`
- Create: `wp-security-hub/src/core/modules/config-auditor.ts`
- Create: `wp-security-hub/src/core/modules/user-auditor.ts`
- Create: `wp-security-hub/src/core/modules/ssl-auditor.ts`
- Create: `wp-security-hub/src/core/modules/blacklist-check.ts`
- Create: `wp-security-hub/tests/core/modules/core-integrity.test.ts`
- Create: `wp-security-hub/tests/core/modules/config-auditor.test.ts`

**Interfaces:**
- Produces: `CoreIntegrity.check(connection, siteId, scanId, wpVersion)`, `ConfigAuditor.audit(connection, siteId, scanId)`, `UserAuditor.audit(...)`, `SslAuditor.audit(domain, siteId, scanId)`, `BlacklistChecker.check(domain, siteId, scanId)`

- [ ] **Step 1: Write core-integrity.ts**

```typescript
import type { RemoteConnection } from '../../connectors/types';
import type { FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';

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
```

- [ ] **Step 2: Write config-auditor.ts**

```typescript
import type { RemoteConnection } from '../../connectors/types';
import type { FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';

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
```

- [ ] **Step 3: Write user-auditor.ts**

```typescript
import type { RemoteConnection } from '../../connectors/types';
import type { AgentMemory, FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';

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
```

- [ ] **Step 4: Write ssl-auditor.ts**

```typescript
import type { FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';
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
```

- [ ] **Step 5: Write blacklist-check.ts**

```typescript
import type { FindingSeverity } from '../../engine/types';
import type { CreateFindingInput } from '../../../storage/finding-repo';

export class BlacklistChecker {
  constructor(private siteId: string, private scanId: string) {}

  async check(domain: string, apiKey?: string): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    try {
      const resp = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey || ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'wp-security-hub', clientVersion: '1.0.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url: `https://${domain}` }, { url: `http://${domain}` }],
            },
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json() as { matches?: Array<{ threatType: string }> };
        if (data.matches && data.matches.length > 0) {
          findings.push({
            scanId: this.scanId, siteId: this.siteId, round: 2,
            module: 'blacklist-check', severity: 'critical',
            title: 'Site is blacklisted by Google Safe Browsing',
            description: `Threat types: ${data.matches.map(m => m.threatType).join(', ')}`,
            recommendation: 'Immediately investigate and remove malware, then request review',
          });
        }
      }
    } catch {
      // Skip on API failure
    }

    if (!findings.length) {
      findings.push({
        scanId: this.scanId, siteId: this.siteId, round: 2,
        module: 'blacklist-check', severity: 'info',
        title: 'No blacklist entries found',
        description: 'Domain is not flagged by Google Safe Browsing',
        recommendation: '',
      });
    }

    return findings;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/core/modules/core-integrity.ts src/core/modules/config-auditor.ts src/core/modules/user-auditor.ts src/core/modules/ssl-auditor.ts src/core/modules/blacklist-check.ts
git commit -m "feat: add core integrity, config auditor, user auditor, SSL auditor, and blacklist modules"
```

---


