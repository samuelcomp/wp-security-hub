export interface RemoteConnection {
  connect(): Promise<void>;
  exec(command: string): Promise<string>;
  downloadFile(remotePath: string, localPath: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface RemoteFile {
  path: string;
  size: number;
  permissions: string;
  modifiedAt: string;
  isDirectory: boolean;
}