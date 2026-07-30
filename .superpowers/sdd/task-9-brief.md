 cPanel and WP-Admin Connectors

**Files:**
- Create: `wp-security-hub/src/core/connectors/cpanel.ts`
- Create: `wp-security-hub/src/core/connectors/wp-admin.ts`

**Interfaces:**
- Consumes: `CpanelCredentials`, `WpAdminCredentials` from `types.ts`, `RemoteConnection` from `connectors/types.ts`
- Produces: `CpanelConnection`, `WpAdminConnection`

- [ ] **Step 1: Write cpanel.ts**

```typescript
import type { CpanelCredentials } from '../../engine/types';
import type { RemoteConnection, RemoteFile } from './types';
import fs from 'fs';
import path from 'path';

export class CpanelConnection implements RemoteConnection {
  private credentials: CpanelCredentials;
  private connected: boolean = false;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(credentials: CpanelCredentials) {
    this.credentials = credentials;
    this.baseUrl = `https://${credentials.host}:${credentials.port}`;
    this.headers = {
      Authorization: `cpanel ${credentials.username}:${credentials.apiToken}`,
    };
  }

  async connect(): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/cpsess/execute/Variables/get_user_information`, {
      headers: this.headers,
    });
    if (!resp.ok) throw new Error(`cPanel connection failed: ${resp.status}`);
    this.connected = true;
  }

  async exec(command: string): Promise<string> {
    throw new Error('cPanel connector does not support raw command execution. Use File Manager API or WP-CLI via cPanel API.');
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const resp = await fetch(
      `${this.baseUrl}/cpsess/execute/Fileman/get_file_content?dir=${encodeURIComponent(path.dirname(remotePath))}&file=${encodeURIComponent(path.basename(remotePath))}`,
      { headers: this.headers }
    );
    if (!resp.ok) throw new Error(`cPanel download failed: ${resp.status}`);
    const data = await resp.json() as { data?: { content?: string } };
    if (data.data?.content) {
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(localPath, data.data.content, 'utf8');
    }
  }

  async listFiles(remoteDir: string): Promise<RemoteFile[]> {
    const resp = await fetch(
      `${this.baseUrl}/cpsess/execute/Fileman/list_files?dir=${encodeURIComponent(remoteDir)}`,
      { headers: this.headers }
    );
    if (!resp.ok) throw new Error(`cPanel list_files failed: ${resp.status}`);
    const data = await resp.json() as { data?: Array<{ file: string; size: number; type: string; perms: string; mtime: number }> };
    return (data.data || []).map(f => ({
      path: path.posix.join(remoteDir, f.file),
      size: f.size,
      permissions: f.perms || '0644',
      modifiedAt: new Date(f.mtime * 1000).toISOString(),
      isDirectory: f.type === 'dir',
    }));
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}
```

- [ ] **Step 2: Write wp-admin.ts**

```typescript
import type { WpAdminCredentials } from '../../engine/types';
import type { RemoteConnection, RemoteFile } from './types';

export class WpAdminConnection implements RemoteConnection {
  private credentials: WpAdminCredentials;
  private connected: boolean = false;
  private nonce: string = '';
  private cookies: string = '';

  constructor(credentials: WpAdminCredentials) {
    this.credentials = credentials;
  }

  async connect(): Promise<void> {
    const loginUrl = `${this.credentials.url}/wp-login.php`;
    const params = new URLSearchParams({
      log: this.credentials.username,
      pwd: this.credentials.password,
      'wp-submit': 'Log In',
      redirect_to: `${this.credentials.url}/wp-admin/`,
      testcookie: '1',
    });

    const resp = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'manual',
    });

    const setCookie = resp.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('WP-Admin login failed: no session cookie returned');
    }
    this.cookies = setCookie;
    this.connected = true;
  }

  async exec(command: string): Promise<string> {
    const [endpoint, ...args] = command.split(' ');
    const wpApi = `${this.credentials.url}/wp-json/wp/v2/${endpoint}`;
    const resp = await fetch(wpApi, {
      headers: { Cookie: this.cookies },
    });
    if (!resp.ok) throw new Error(`WP API call failed: ${resp.status}`);
    return await resp.text();
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    throw new Error('WP-Admin connector cannot download arbitrary files. Use SSH or cPanel for file access.');
  }

  async listFiles(remoteDir: string): Promise<RemoteFile[]> {
    throw new Error('WP-Admin connector cannot list files. Use SSH or cPanel for file system access.');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getCookies(): string {
    return this.cookies;
  }

  getBaseUrl(): string {
    return this.credentials.url;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/connectors/cpanel.ts src/core/connectors/wp-admin.ts
git commit -m "feat: add cPanel and WP-Admin connectors"
```

---


