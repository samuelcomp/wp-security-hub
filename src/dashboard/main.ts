import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const port = 3456;

  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1000, minHeight: 700,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    title: 'WP Security Hub',
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${port}`);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });