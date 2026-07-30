import type { WpAdminCredentials } from '../engine/types';
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