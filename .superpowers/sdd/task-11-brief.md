 Malware Scanner Module

**Files:**
- Create: `wp-security-hub/src/core/modules/malware-scanner.ts`
- Create: `wp-security-hub/tests/core/modules/malware-scanner.test.ts`
- Create: `wp-security-hub/tests/fixtures/malware-samples/backdoor.php`
- Create: `wp-security-hub/tests/fixtures/malware-samples/spam-injector.php`
- Create: `wp-security-hub/tests/fixtures/malware-samples/obfuscated.php`

**Interfaces:**
- Consumes: `RemoteConnection`, `CreateFindingInput` from finding-repo
- Produces: `MalwareScanner.scan(connection, siteId, scanId): Promise<CreateFindingInput[]>`

- [ ] **Step 1: Write malware sample fixtures**

`tests/fixtures/malware-samples/backdoor.php`:
```php
<?php
/* Legitimate-looking comment */
if (isset($_REQUEST['cmd'])) {
    @system($_REQUEST['cmd']);
}
?>
```

`tests/fixtures/malware-samples/spam-injector.php`:
```php
<?php
$content = base64_decode('PHNwYW4gc3R5bGU9ImRpc3BsYXk6bm9uZSI+QnV5IENoZWFwIFZpYWdyYSE8L3NwYW4+');
echo eval($content);
?>
```

`tests/fixtures/malware-samples/obfuscated.php`:
```php
<?php
$k = "gzinflate";
$d = "c3lzdGVt";
$f = $k(base64_decode("c03OJcWwCwDQf2USZQc2GxsbGxsbGxsbGxs="));
$f($d);
?>
```

- [ ] **Step 2: Write malware-scanner.ts**

```typescript
import type { RemoteConnection } from '../../connectors/types';
import type { FindingSeverity } from '../../engine/types';
import { createFinding, type CreateFindingInput } from '../../../storage/finding-repo';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MALWARE_SIGNATURES: Array<{
  name: string;
  pattern: RegExp;
  severity: FindingSeverity;
  description: string;
}> = [
  {
    name: 'eval-with-request',
    pattern: /eval\s*\(\s*\$_(?:GET|POST|REQUEST|COOKIE|SERVER)\s*\[/i,
    severity: 'critical',
    description: 'Remote code execution via eval() with user input',
  },
  {
    name: 'system-exec',
    pattern: /(?:system|exec|shell_exec|passthru|popen|proc_open)\s*\(\s*\$_(?:GET|POST|REQUEST)/i,
    severity: 'critical',
    description: 'Command execution with user-supplied input',
  },
  {
    name: 'base64-decode-eval',
    pattern: /eval\s*\(\s*(?:gzinflate|gzuncompress|str_rot13|base64_decode)\s*\(/i,
    severity: 'critical',
    description: 'Obfuscated code execution via base64/decode + eval chain',
  },
  {
    name: 'file-put-contents-from-input',
    pattern: /file_put_contents\s*\([^,]+,\s*file_get_contents\s*\(\s*['"]php:\/\/input['"]/i,
    severity: 'critical',
    description: 'Writes uploaded content to file â€” typical webshell pattern',
  },
  {
    name: 'gzinflate-obfuscation',
    pattern: /gzinflate\s*\(\s*base64_decode\s*\(/i,
    severity: 'high',
    description: 'Obfuscated code using gzinflate + base64 combination',
  },
  {
    name: 'assert-with-input',
    pattern: /assert\s*\(\s*\$_(?:GET|POST|REQUEST)/i,
    severity: 'critical',
    description: 'Code execution via assert() with user input (deprecated but common in malware)',
  },
  {
    name: 'create-function-with-input',
    pattern: /create_function\s*\(\s*[^,]+,\s*\$_(?:GET|POST|REQUEST)/i,
    severity: 'critical',
    description: 'Dynamic function creation with user input',
  },
  {
    name: 'str-rot13-obfuscation',
    pattern: /str_rot13\s*\(\s*(?:base64_decode|gzinflate)\s*\(/i,
    severity: 'medium',
    description: 'Double-obfuscation using str_rot13',
  },
  {
    name: 'curl-to-external',
    pattern: /curl_exec\s*\(\s*curl_init\s*\(\s*\$_(?:GET|POST|REQUEST)/i,
    severity: 'high',
    description: 'Sends HTTP requests to user-controlled URLs â€” typical C2 beacon',
  },
  {
    name: 'include-from-input',
    pattern: /(?:include|require)(?:_once)?\s*\$_(?:GET|POST|REQUEST)/i,
    severity: 'critical',
    description: 'File inclusion from user input â€” LFI/RFI vulnerability',
  },
  {
    name: 'wp-option-update-hook',
    pattern: /update_option\s*\(\s*['"]active_plugins['"]\s*,/i,
    severity: 'high',
    description: 'Programmatic modification of active plugins list â€” common in hidden malware plugins',
  },
  {
    name: 'wp-option-add-filter',
    pattern: /add_filter\s*\(\s*['"]the_content['"]\s*,\s*['"]base64/i,
    severity: 'high',
    description: 'Injecting base64-encoded content via WordPress content filter',
  },
];

const SUSPICIOUS_EXTENSIONS = [
  '.php5', '.phtml', '.pht', '.php7', '.phar', '.shtml',
  '.cgi', '.pl', '.py', '.asp', '.aspx', '.jsp',
];

const SUSPICIOUS_FILE_NAMES = [
  'wp-update.php', 'wp-tmp.php', 'wp-feed.php', 'wp-content.php',
  'wp-mail.php', 'wp-info.php', 'wp-vcd.php', 'wp-xmlrpc.php',
  'class-wp-widget-system.php', 'customize.php', 'site-health.php',
  'class-settings.php', 'wp-security.php', 'wp-optimize.php',
];

export class MalwareScanner {
  constructor(private siteId: string, private scanId: string) {}

  async scan(
    connection: RemoteConnection,
    files: string[]
  ): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    for (const filePath of files) {
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (SUSPICIOUS_FILE_NAMES.some(n => fileName.toLowerCase() === n)) {
        findings.push({
          scanId: this.scanId,
          siteId: this.siteId,
          round: 3,
          module: 'malware',
          severity: 'high',
          title: `Suspicious file name detected: ${fileName}`,
          description: `${fileName} is commonly used by malware.`,
          sourceFile: filePath,
          recommendation: 'Review file contents and delete if malicious',
          fixAction: 'delete-file',
        });
      }

      if (SUSPICIOUS_EXTENSIONS.includes(ext) && ext !== '.php') {
        findings.push({
          scanId: this.scanId,
          siteId: this.siteId,
          round: 3,
          module: 'malware',
          severity: 'high',
          title: `Suspicious file extension: ${ext}`,
          description: `${filePath} has an unusual extension. WordPress typically only uses .php files.`,
          sourceFile: filePath,
          recommendation: 'Review and remove if not legitimate',
          fixAction: 'delete-file',
        });
      }
    }

    return findings;
  }

  async scanContent(
    content: string,
    filePath: string,
  ): Promise<CreateFindingInput[]> {
    const findings: CreateFindingInput[] = [];

    if (content.length > 500000) {
      findings.push({
        scanId: this.scanId,
        siteId: this.siteId,
        round: 3,
        module: 'malware',
        severity: 'low',
        title: `Oversized file: ${path.basename(filePath)}`,
        description: `File is ${(content.length / 1024).toFixed(1)}KB â€” unusually large for a PHP file.`,
        sourceFile: filePath,
        recommendation: 'Review file contents for embedded data or spam payloads',
      });
    }

    for (const sig of MALWARE_SIGNATURES) {
      if (sig.pattern.test(content)) {
        const match = content.match(sig.pattern)?.[0] || '';
        findings.push({
          scanId: this.scanId,
          siteId: this.siteId,
          round: 3,
          module: 'malware',
          severity: sig.severity,
          title: `Malware signature: ${sig.name}`,
          description: sig.description,
          sourceFile: filePath,
          codeSnippet: match.length > 200 ? match.substring(0, 200) + '...' : match,
          recommendation: `Review and remove the malicious code from ${path.basename(filePath)}`,
          fixAction: 'delete-file',
        });
      }
    }

    return findings;
  }

  static getKnownSignatures(): ReadonlyArray<{ name: string; severity: FindingSeverity }> {
    return MALWARE_SIGNATURES.map(s => ({ name: s.name, severity: s.severity }));
  }
}
```

- [ ] **Step 3: Write malware-scanner.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { MalwareScanner } from '../../../src/core/modules/malware-scanner';
import fs from 'fs';
import path from 'path';

const SAMPLES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'malware-samples');

describe('MalwareScanner.scanContent', () => {
  const scanner = new MalwareScanner('test-site', 'test-scan');

  it('detects backdoor with system() and $_REQUEST', () => {
    const content = fs.readFileSync(path.join(SAMPLES_DIR, 'backdoor.php'), 'utf8');
    const findings = scanner.scanContent(content, '/wp-content/plugins/evil/backdoor.php');
    const evalFinding = findings.find(f => f.title.includes('system-exec'));
    expect(evalFinding).toBeDefined();
    expect(evalFinding!.severity).toBe('critical');
  });

  it('detects spam injector with base64_decode + eval', () => {
    const content = fs.readFileSync(path.join(SAMPLES_DIR, 'spam-injector.php'), 'utf8');
    const findings = scanner.scanContent(content, '/wp-content/plugins/spam/spam.php');
    const base64Finding = findings.find(f => f.title.includes('base64-decode-eval'));
    expect(base64Finding).toBeDefined();
    expect(base64Finding!.severity).toBe('critical');
  });

  it('detects obfuscated code with gzinflate + base64_decode', () => {
    const content = fs.readFileSync(path.join(SAMPLES_DIR, 'obfuscated.php'), 'utf8');
    const findings = scanner.scanContent(content, '/wp-content/themes/theme/obfuscated.php');
    const gzFinding = findings.find(f => f.title.includes('gzinflate-obfuscation'));
    expect(gzFinding).toBeDefined();
    expect(gzFinding!.severity).toBe('high');
  });

  it('returns no findings for clean PHP code', () => {
    const cleanContent = '<?php\nfunction my_plugin_init() {\n  add_action("init", "my_plugin_init");\n}\n';
    const findings = scanner.scanContent(cleanContent, '/wp-content/plugins/clean/clean.php');
    expect(findings.length).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/core/modules/malware-scanner.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/modules/malware-scanner.ts tests/core/modules/malware-scanner.test.ts tests/fixtures/malware-samples/
git commit -m "feat: add malware scanner with signature-based detection"
```

---


