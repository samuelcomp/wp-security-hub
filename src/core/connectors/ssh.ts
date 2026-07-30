import { Client, ConnectConfig } from 'ssh2';
import fs from 'fs';
import path from 'path';
import type { SshCredentials } from '../engine/types';
import type { RemoteConnection, RemoteFile } from './types';

export class SshConnection implements RemoteConnection {
  private client: Client;
  private connected: boolean = false;
  private credentials: SshCredentials;
  private tempDir: string;

  constructor(credentials: SshCredentials) {
    this.client = new Client();
    this.credentials = credentials;
    this.tempDir = path.join(require('os').tmpdir(), 'wp-audit-' + credentials.host.replace(/\./g, '-'));
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const config: ConnectConfig = {
        host: this.credentials.host,
        port: this.credentials.port,
        username: this.credentials.username,
        readyTimeout: 30000,
      };

      if (this.credentials.privateKey) {
        config.privateKey = this.credentials.privateKey;
        if (this.credentials.passphrase) {
          config.passphrase = this.credentials.passphrase;
        }
      } else if (this.credentials.password) {
        config.password = this.credentials.password;
      }

      this.client.on('ready', () => {
        this.connected = true;
        resolve();
      });

      this.client.on('error', (err) => {
        reject(err);
      });

      this.client.connect(config);
    });
  }

  async exec(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let output = '';
        let errOutput = '';
        stream.on('data', (data: Buffer) => { output += data.toString(); });
        stream.stderr.on('data', (data: Buffer) => { errOutput += data.toString(); });
        stream.on('close', (code: number) => {
          if (code !== 0 && errOutput) {
            reject(new Error(`SSH command failed (${code}): ${errOutput.trim()}`));
          } else {
            resolve(output.trim());
          }
        });
      });
    });
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        const localDir = path.dirname(localPath);
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        sftp.fastGet(remotePath, localPath, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  }

  async listFiles(remoteDir: string): Promise<RemoteFile[]> {
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.readdir(remoteDir, (err2, list) => {
          if (err2) return reject(err2);
          const files: RemoteFile[] = list.map((item: {
            filename: string;
            attrs: { size: number; mode: number; mtime: number };
            longname: string;
          }) => ({
            path: path.posix.join(remoteDir, item.filename),
            size: item.attrs.size,
            permissions: item.attrs.mode.toString(8),
            modifiedAt: new Date(item.attrs.mtime * 1000).toISOString(),
            isDirectory: item.longname.startsWith('d'),
          }));
          resolve(files);
        });
      });
    });
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.fastPut(localPath, remotePath, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  getTempDir(): string {
    return this.tempDir;
  }

  async disconnect(): Promise<void> {
    this.client.end();
    this.connected = false;
  }
}