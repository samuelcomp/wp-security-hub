import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initDb, openDb, closeDb } from '../storage/db';
import { setEncryptionKey, createSite, getSite, listSites, updateSite, deleteSite } from '../storage/site-repo';
import { listScansForSite } from '../storage/scan-repo';
import { listFindingsForScan, updateFindingStatus, approveFindingsForSite, listFindingsForSite } from '../storage/finding-repo';
import { listFixHistoryForSite } from '../storage/fix-repo';
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

const app = express();
app.use(express.json());

let currentRootDir = resolveRootDir();
let unlocked = false;

function getKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, 'wp-security-hub-salt', 100000, 32, 'sha256');
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!unlocked) return res.status(401).json({ error: 'Locked' });
  next();
}

function withError(fn: (req: express.Request, res: express.Response) => Promise<any>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res).catch(e => {
      console.error(e);
      res.status(500).json({ error: (e as Error).message });
    });
  };
}

// Auth
app.post('/api/unlock', (req, res) => {
  const { password, rootDir } = req.body;
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
      unlocked = true;
      return res.json({ ok: true, isNew: true, rootDir: currentRootDir });
    }
    openDb(password, dbPath);
    const key = getKey(password);
    setEncryptionKey(key);
    unlocked = true;
    res.json({ ok: true, isNew: false, rootDir: currentRootDir });
  } catch (e) {
    res.json({ ok: false, error: (e as Error).message });
  }
});

// Sites
app.get('/api/sites', requireAuth, withError(async (_req, res) => {
  res.json(listSites());
}));

app.get('/api/sites/:id', requireAuth, withError(async (req, res) => {
  const site = getSite(req.params.id as string);
  if (!site) return res.status(404).json({ error: 'Not found' });
  res.json(site);
}));

app.post('/api/sites', requireAuth, withError(async (req, res) => {
  const { domain, connection, credentials } = req.body;
  const site = createSite(domain, connection as ConnectionType, credentials);
  res.json(site);
}));

app.put('/api/sites/:id', requireAuth, withError(async (req, res) => {
  const site = updateSite(req.params.id as string, req.body);
  if (!site) return res.status(404).json({ error: 'Not found' });
  res.json(site);
}));

app.delete('/api/sites/:id', requireAuth, withError(async (req, res) => {
  deleteSite(req.params.id as string);
  res.json({ ok: true });
}));

// Scans
app.post('/api/scans/:siteId', requireAuth, withError(async (req, res) => {
  const siteId = req.params.siteId as string;
  const site = getSite(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const settings = loadSettings(currentRootDir);
  const orchestrator = new Orchestrator(settings, currentRootDir);
  const result = await orchestrator.scanSite(siteId);

  const findings = listFindingsForScan(result.id);
  const outputDir = path.join(currentRootDir, 'sites', siteId, 'reports');
  const docxGen = new DocxGenerator();
  await docxGen.generate(site, result, findings, outputDir);
  const mdGen = new MdGenerator();
  mdGen.generate(site, result, findings, outputDir);
  const writer = new FindingWriter();
  writer.write(findings, currentRootDir, siteId);

  res.json({ ok: true, scanId: result.id });
}));

app.get('/api/scans/:siteId', requireAuth, withError(async (req, res) => {
  res.json(listScansForSite(req.params.siteId as string));
}));

// Findings
app.get('/api/findings/:scanId', requireAuth, withError(async (req, res) => {
  res.json(listFindingsForScan(req.params.scanId as string));
}));

app.get('/api/findings/site/:siteId', requireAuth, withError(async (req, res) => {
  res.json(listFindingsForSite(req.params.siteId as string));
}));

app.put('/api/findings/:id/status', requireAuth, withError(async (req, res) => {
  updateFindingStatus(req.params.id as string, req.body.status);
  res.json({ ok: true });
}));

// Fixes
app.post('/api/fixes/:siteId/:scanId', requireAuth, withError(async (req, res) => {
  const siteId = req.params.siteId as string;
  const scanId = req.params.scanId as string;
  approveFindingsForSite(siteId, scanId);
  const site = getSite(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  let conn: any;
  switch (site.connection) {
    case 'ssh': conn = new SshConnection(site.credentials as any); break;
    case 'cpanel': conn = new CpanelConnection(site.credentials as any); break;
    case 'wp-admin': conn = new WpAdminConnection(site.credentials as any); break;
  }

  const engine = new FixEngine(site);
  const result = await engine.executeApproved(scanId, conn);
  res.json({ ok: true, fixed: result.fixed, failed: result.failed });
}));

app.get('/api/fixes/:siteId', requireAuth, withError(async (req, res) => {
  res.json(listFixHistoryForSite(req.params.siteId as string));
}));

// Settings
app.get('/api/settings', requireAuth, withError(async (_req, res) => {
  res.json(loadSettings(currentRootDir));
}));

app.put('/api/settings', requireAuth, withError(async (req, res) => {
  saveSettings(currentRootDir, req.body);
  res.json({ ok: true });
}));

// Connection test
app.post('/api/connections/test', requireAuth, withError(async (req, res) => {
  const { type, credentials } = req.body;
  let conn: any;
  switch (type) {
    case 'ssh': conn = new SshConnection(credentials); break;
    case 'cpanel': conn = new CpanelConnection(credentials); break;
    case 'wp-admin': conn = new WpAdminConnection(credentials); break;
    default: return res.status(400).json({ error: 'Unknown type' });
  }
  await conn.connect();
  await conn.disconnect();
  res.json({ ok: true });
}));

// Serve React build assets
const rendererPath = path.join(__dirname, 'renderer');
app.use(express.static(rendererPath));
app.use((_req, res) => {
  res.sendFile(path.join(rendererPath, 'index.html'));
});

const PORT = parseInt(process.env.PORT || '0', 10);
const server = createServer(app);
server.listen(PORT, () => {
  const addr = server.address();
  const port = typeof addr === 'string' ? addr : addr?.port || 3456;
  console.log(`WP_SECURITY_HUB_PORT=${port}`);
  console.log(`\n  WP Security Hub Dashboard running at:`);
  console.log(`  \x1b[36mhttp://localhost:${port}\x1b[0m\n`);
});