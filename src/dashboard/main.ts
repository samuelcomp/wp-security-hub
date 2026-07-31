import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fork } from 'child_process';

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

let mainWindow: BrowserWindow | null = null;
let serverProcess: any = null;

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: '3456' },
      stdio: 'pipe',
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('WP_SECURITY_HUB_PORT')) {
        resolve();
      }
    });

    serverProcess.on('error', reject);
    setTimeout(() => reject(new Error('Server start timeout')), 15000);
  });
}

async function createWindow() {
  console.log('Starting API server...');
  await startServer();
  console.log('Server ready, opening window...');

  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1000, minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: 'WP Security Hub',
    autoHideMenuBar: true,
    show: false,
  });

  const htmlPath = path.join(__dirname, 'renderer', 'index.html');
  await mainWindow.loadFile(htmlPath);

  let shown = false;
  mainWindow.webContents.on('did-finish-load', () => {
    if (!shown) { shown = true; mainWindow?.show(); }
  });
  setTimeout(() => { if (!shown && mainWindow) { shown = true; mainWindow.show(); } }, 5000);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Obsidian Vault or Hub Folder',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (!mainWindow) createWindow(); });