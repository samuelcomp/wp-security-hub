import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initDb, openDb, closeDb } from '../storage/db';
import { setEncryptionKey, createSite, getSite, listSites, updateSite, deleteSite } from '../storage/site-repo';
import { listScansForSite } from '../storage/scan-repo';
import { listFindingsForScan, updateFindingStatus, approveFindingsForSite, listFindingsForSite } from '../storage/finding-repo';
import { createFixRecord, listFixHistoryForSite } from '../storage/fix-repo';
import { loadSettings, saveSettings, resolveRootDir } from '../config/settings';
import { Orchestrator } from '../core/engine/orchestrator';
import { DocxGenerator } from '../reports/docx-generator';
import { MdGenerator } from '../reports/md-generator';
import { FindingWriter } from '../reports/finding-writer';
import { FixEngine } from '../fix/fix-engine';
import { SshConnection } from '../core/connectors/ssh';
import { CpanelConnection } from '../core/connectors/cpanel';
import { WpAdminConnection } from '../core/connectors/wp-admin';
import type { ConnectionType } from '../core/engine/types';

let mainWindow: BrowserWindow | null = null;
let currentRootDir = '';
let orchestrator: Orchestrator | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'WP Security Hub',
    autoHideMenuBar: true,
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => { mainWindow?.show(); });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

function getKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, 'wp-security-hub-salt', 100000, 32, 'sha256');
}

// ─── Unlock ───
ipcMain.handle('app:unlock', async (_event, password: string, rootDir: string) => {
  try {
    currentRootDir = rootDir || resolveRootDir();
    const dbPath = path.join(currentRootDir, 'hub.db');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(currentRootDir, { recursive: true });
      initDb(password, dbPath);
      const key = getKey(password);
      setEncryptionKey(key);
      for (const dir of ['sites', 'templates']) {
        fs.mkdirSync(path.join(currentRootDir, dir), { recursive: true });
      }
      return { ok: true, isNew: true, rootDir: currentRootDir };
    }
    openDb(password, dbPath);
    const key = getKey(password);
    setEncryptionKey(key);
    return { ok: true, isNew: false, rootDir: currentRootDir };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
});

// ─── Sites ───
ipcMain.handle('sites:list', async () => {
  return listSites();
});

ipcMain.handle('sites:get', async (_event, id: string) => {
  return getSite(id);
});

ipcMain.handle('sites:create', async (_event, data: { domain: string; connection: string; credentials: Record<string, unknown> }) => {
  return createSite(data.domain, data.connection as ConnectionType, data.credentials as any);
});

ipcMain.handle('sites:update', async (_event, id: string, updates: Record<string, unknown>) => {
  return updateSite(id, updates);
});

ipcMain.handle('sites:delete', async (_event, id: string) => {
  return deleteSite(id);
});

// ─── Scans ───
ipcMain.handle('scans:run', async (_event, siteId: string) => {
  const settings = loadSettings(currentRootDir);
  orchestrator = new Orchestrator(settings, currentRootDir);

  orchestrator.on('scan', (event: any) => {
    mainWindow?.webContents.send('scan:progress', event);
  });

  try {
    const result = await orchestrator.scanSite(siteId);
    const site = getSite(siteId);
    if (site) {
      const findings = listFindingsForScan(result.id);
      const outputDir = path.join(currentRootDir, 'sites', siteId, 'reports');
      const docxGen = new DocxGenerator();
      await docxGen.generate(site, result, findings, outputDir);
      const mdGen = new MdGenerator();
      mdGen.generate(site, result, findings, outputDir);
      const writer = new FindingWriter();
      writer.write(findings, currentRootDir, siteId);
    }
    return { ok: true, scanId: result.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
});

ipcMain.handle('scans:list', async (_event, siteId: string) => {
  return listScansForSite(siteId);
});

// ─── Findings ───
ipcMain.handle('findings:list', async (_event, scanId: string) => {
  return listFindingsForScan(scanId);
});

ipcMain.handle('findings:for-site', async (_event, siteId: string) => {
  return listFindingsForSite(siteId);
});

ipcMain.handle('findings:update-status', async (_event, findingId: string, status: string) => {
  updateFindingStatus(findingId, status as any);
  return { ok: true };
});

// ─── Fixes ───
ipcMain.handle('fixes:apply-all', async (_event, siteId: string, scanId: string) => {
  try {
    approveFindingsForSite(siteId, scanId);
    const site = getSite(siteId);
    if (!site) return { ok: false, error: 'Site not found' };

    let conn: any;
    switch (site.connection) {
      case 'ssh': conn = new SshConnection(site.credentials as any); break;
      case 'cpanel': conn = new CpanelConnection(site.credentials as any); break;
      case 'wp-admin': conn = new WpAdminConnection(site.credentials as any); break;
    }

    const engine = new FixEngine(site);
    const result = await engine.executeApproved(scanId, conn);
    return { ok: true, fixed: result.fixed, failed: result.failed };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
});

ipcMain.handle('fixes:history', async (_event, siteId: string) => {
  return listFixHistoryForSite(siteId);
});

// ─── Settings ───
ipcMain.handle('settings:load', async () => {
  return loadSettings(currentRootDir);
});

ipcMain.handle('settings:save', async (_event, settings: any) => {
  saveSettings(currentRootDir, settings);
  return { ok: true };
});

// ─── Testing connections ───
ipcMain.handle('connections:test', async (_event, data: { type: string; credentials: Record<string, unknown> }) => {
  try {
    let conn: any;
    switch (data.type) {
      case 'ssh': conn = new SshConnection(data.credentials as any); break;
      case 'cpanel': conn = new CpanelConnection(data.credentials as any); break;
      case 'wp-admin': conn = new WpAdminConnection(data.credentials as any); break;
    }
    await conn.connect();
    await conn.disconnect();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
});