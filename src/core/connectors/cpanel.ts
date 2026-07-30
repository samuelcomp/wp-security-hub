import type { CpanelCredentials } from '../engine/types';
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