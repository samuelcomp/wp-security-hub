import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:3456/api';

type Page = 'dashboard' | 'sites' | 'site-detail' | 'settings';

// ─── Theme ───
const theme = {
  bg: '#0f1117',
  surface: '#161b22',
  surface2: '#1c2333',
  border: '#30363d',
  text: '#e1e4e8',
  textMuted: '#8b949e',
  primary: '#58a6ff',
  primaryHover: '#79c0ff',
  danger: '#f85149',
  dangerHover: '#ff6b6b',
  success: '#3fb950',
  warning: '#d29922',
  critical: '#f85149',
  high: '#d29922',
  medium: '#58a6ff',
  low: '#8b949e',
  info: '#6e7681',
};

async function api(path: string, opts?: { method?: string; body?: any }): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: opts?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

// ─── Icons (inline SVG) ───
const Icons = {
  dashboard: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.75A.75.75 0 011.75 1h4.5c.414 0 .75.336.75.75v4.5c0 .414-.336.75-.75.75h-4.5A.75.75 0 011 6.25v-4.5zm1 .75v3h3v-3H2zm2 7.75A.75.75 0 014.75 9h4.5c.414 0 .75.336.75.75v4.5c0 .414-.336.75-.75.75h-4.5A.75.75 0 014 14.25v-4.5zm1 .75v3h3v-3H5zM9.75 1c.414 0 .75.336.75.75v4.5c0 .414-.336.75-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5c0-.414.336-.75.75-.75h4.5zm-.75 1.75v-1h-3v1h3zM15 4.75A.75.75 0 0114.25 5h-4.5a.75.75 0 010-1.5h4.5c.414 0 .75.336.75.75z"/></svg>,
  globe: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm-.5 14.77V11.5c0-.28-.22-.5-.5-.5H4.5c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h2c.28 0 .5.22.5.5V9h1.5c.28 0 .5.22.5.5v1.5c0 .28-.22.5-.5.5H8v2.77c-.17.01-.33.02-.5.02z"/></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.902 3.433 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.892 3.433-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.892-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 001.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 003.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z"/></svg>,
  lock: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4a4 4 0 018 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25v-5.5C2 6.784 2.784 6 3.75 6H4V4zm2.5 0v2h3V4a1.5 1.5 0 00-3 0z"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0c4.5 0 8 3.5 8 8s-3.5 8-8 8-8-3.5-8-8 3.5-8 8-8zM7 4v5h2V4H7zm0 6v2h2v-2H7z"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>,
  xmark: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>,
  play: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5-9-5.5z"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 110 1.5H8.5v4.25a.75.75 0 11-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5h-.733l-.615 9.222A1.75 1.75 0 019.826 15H6.174a1.75 1.75 0 01-1.576-1.278L3.983 4.5H3.25a.75.75 0 010-1.5H5.5V1.75C5.5.784 6.284 0 7.25 0h1.5c.966 0 1.75.784 1.75 1.75zM5.512 4.5l.614 9.205a.25.25 0 00.25.225h4.248a.25.25 0 00.25-.225L11.488 4.5H5.512z"/></svg>,
  arrowUp: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3.47 7.78a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-1.06 1.06L9 4.81v9.44a.75.75 0 01-1.5 0V4.81L4.53 7.78a.75.75 0 01-1.06 0z"/></svg>,
  history: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.643 3.143L.427 1.927A.25.25 0 000 2.104V5.75c0 .138.112.25.25.25h3.646a.25.25 0 00.177-.427L2.715 4.215a6.5 6.5 0 11-1.18 4.458.75.75 0 10-1.493.154 8.001 8.001 0 101.6-5.684zM7.75 4a.75.75 0 01.75.75v2.992l2.498 1.498a.75.75 0 01-.75 1.298l-2.747-1.647A.75.75 0 017 8.25V4.75A.75.75 0 017.75 4z"/></svg>,
};

// ─── Common Components ───
const btn = (color: string, variant: 'primary' | 'danger' | 'ghost' = 'primary') => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  color: '#fff',
  background: variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : 'transparent',
  ':hover': { background: variant === 'primary' ? theme.primaryHover : variant === 'danger' ? theme.dangerHover : theme.surface2 },
});

const inputStyle: React.CSSProperties = {
  background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6,
  padding: '8px 12px', color: theme.text, fontSize: 13, outline: 'none', width: '100%',
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: theme.textMuted, marginBottom: 4, display: 'block' };

function Card({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 20, ...s }}>{children}</div>;
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: color + '20', color, fontWeight: 500 }}>{text}</span>;
}

// ─── Unlock Screen ───
function UnlockScreen({ onUnlock }: { onUnlock: (password: string, rootDir: string) => void }) {
  const [password, setPassword] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true); setError('');
    const res = await api('/unlock', { method: 'POST', body: { password, rootDir } });
    setLoading(false);
    if (res.ok) onUnlock(password, res.rootDir);
    else setError(res.error || 'Wrong passphrase');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: theme.bg }}>
      <Card style={{ width: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 32, color: theme.primary, marginBottom: 12 }}>{Icons.shield}</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>WP Security Hub</h1>
        <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 24 }}>Enter your master passphrase to unlock</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
          <div>
            <label style={labelStyle}>Master Passphrase</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter passphrase" onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Hub Folder (leave empty for default ~/wp-security-hub)</label>
            <input style={inputStyle} type="text" value={rootDir} onChange={e => setRootDir(e.target.value)}
              placeholder="C:\Users\MEGAUPLOAD\wp-security-hub" />
          </div>
          {error && <p style={{ fontSize: 12, color: theme.danger }}>{error}</p>}
          <button style={{ ...btn(theme.primary), justifyContent: 'center', padding: '10px 14px', opacity: loading ? 0.6 : 1 }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Sidebar ───
function Sidebar({ page, setPage, onLogout }: { page: Page; setPage: (p: Page) => void; onLogout: () => void }) {
  const items: { key: Page; label: string; icon: JSX.Element }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
    { key: 'sites', label: 'Sites', icon: Icons.globe },
    { key: 'settings', label: 'Settings', icon: Icons.gear },
  ];
  return (
    <div style={{ width: 220, background: theme.surface, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '20px 16px', borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.primary }}>
          {Icons.shield}
          <span style={{ fontSize: 15, fontWeight: 600 }}>WP Security Hub</span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {items.map(item => (
          <button key={item.key} onClick={() => setPage(item.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px',
              border: 'none', background: page === item.key ? theme.surface2 : 'transparent',
              color: page === item.key ? theme.primary : theme.textMuted, cursor: 'pointer', fontSize: 13, textAlign: 'left',
            }}>
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: 12, borderTop: `1px solid ${theme.border}` }}>
        <button onClick={onLogout} style={{ ...btn(theme.textMuted, 'ghost'), width: '100%', justifyContent: 'center', fontSize: 12 }}>
          {Icons.lock} Lock
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───
function DashboardPage({ sites, onRunScan }: { sites: any[]; onRunScan: (id: string) => void }) {
  const [scanning, setScanning] = useState<string | null>(null);

  const handleScan = async (id: string) => {
    setScanning(id);
    await onRunScan(id);
    setScanning(null);
  };

  const sevCount = (s: any) => {
    const c = s.healthScore;
    if (c >= 80) return { label: 'Good', color: theme.success };
    if (c >= 50) return { label: 'Fair', color: theme.warning };
    return { label: 'Critical', color: theme.danger };
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Dashboard</h2>
      {sites.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: theme.textMuted, marginBottom: 12 }}>No sites registered yet</p>
          <button style={{ ...btn(theme.primary) }} onClick={() => api('/sites', { method: 'POST', body: {} })}>Add Your First Site</button>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {sites.map(site => {
            const status = sevCount(site);
            return (
              <Card key={site.id} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{site.domain}</h3>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>{site.connection} · {site.id}</span>
                  </div>
                  <Badge text={status.label} color={status.color} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: status.color }}>{site.healthScore}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>Health Score</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btn(theme.primary), fontSize: 12 }}
                    onClick={() => handleScan(site.id)} disabled={scanning === site.id}>
                    {Icons.play} {scanning === site.id ? 'Scanning...' : 'Scan'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sites Page ───
function SitesPage({ sites, onRefresh, onSelectSite }: { sites: any[]; onRefresh: () => void; onSelectSite: (id: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [domain, setDomain] = useState('');
  const [connType, setConnType] = useState('ssh');
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    await api('/sites', { method: 'POST', body: { domain, connection: connType, credentials: creds } });
    setShowAdd(false); setDomain(''); setCreds({});
    onRefresh();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await api('/sites/' + id, { method: 'DELETE' });
    onRefresh();
  };

  const credFields = () => {
    if (connType === 'ssh') return ['host', 'port', 'username', 'password', 'privateKey'];
    if (connType === 'cpanel') return ['host', 'port', 'username', 'apiToken'];
    return ['url', 'username', 'password'];
  };

  const testConnection = async () => {
    const res = await api('/connections/test', { method: 'POST', body: { type: connType, credentials: { ...creds, port: parseInt(creds.port || connType === 'cpanel' ? '2083' : '22') } } });
    alert(res.ok ? 'Connection successful!' : `Connection failed: ${res.error}`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Sites</h2>
        <button style={{ ...btn(theme.primary) }} onClick={() => setShowAdd(!showAdd)}>{Icons.plus} Add Site</button>
      </div>

      {showAdd && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Add New Site</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Domain</label>
              <input style={inputStyle} value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.com" />
            </div>
            <div>
              <label style={labelStyle}>Connection Type</label>
              <select style={inputStyle} value={connType} onChange={e => setConnType(e.target.value)}>
                <option value="ssh">SSH</option>
                <option value="cpanel">cPanel API</option>
                <option value="wp-admin">WP Admin</option>
              </select>
            </div>
            {credFields().map(f => (
              <div key={f}>
                <label style={labelStyle}>{f}</label>
                <input style={inputStyle} type={f.includes('password') || f.includes('key') ? 'password' : 'text'}
                  value={creds[f] || ''} onChange={e => setCreds({ ...creds, [f]: e.target.value })}
                  placeholder={f === 'port' ? (connType === 'cpanel' ? '2083' : '22') : f} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btn(theme.primary) }} onClick={handleAdd} disabled={adding}>
              {adding ? 'Adding...' : 'Save Site'}
            </button>
            <button style={{ ...btn(theme.textMuted, 'ghost') }} onClick={testConnection}>Test Connection</button>
            <button style={{ ...btn(theme.textMuted, 'ghost') }} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </Card>
      )}

      {sites.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: theme.textMuted }}>Click "Add Site" to get started</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sites.map(site => (
            <Card key={site.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer', color: theme.primary }}
                  onClick={() => onSelectSite(site.id)}>{site.domain}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  {site.connection} · Score: {site.healthScore} · {site.id}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge text={site.connection} color={theme.primary} />
                <button style={{ ...btn(theme.textMuted, 'ghost') }} onClick={() => handleDelete(site.id)}>{Icons.trash}</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Site Detail Page ───
function SiteDetailPage({ siteId, onBack }: { siteId: string; onBack: () => void }) {
  const [site, setSite] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [scanProgress, setScanProgress] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await api('/sites/' + siteId);
    setSite(s);
    const sc = await api('/scans/' + siteId);
    setScans(sc);
    if (sc.length > 0) {
      setSelectedScan(sc[0].id);
      const f = await api('/findings/' + sc[0].id);
      setFindings(f);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const runScan = async () => {
    setScanning(true);
    setScanProgress({ siteId, domain: site?.domain, status: 'connecting' });
    const res = await api('/scans/' + siteId, { method: 'POST' });
    setScanning(false);
    if (res.ok) setScanProgress({ siteId, domain: site?.domain, status: 'completed' });
    else setScanProgress(null);
    load();
  };

  const handleFix = async () => {
    if (!selectedScan) return;
    setFixing(true);
    const res = await api('/fixes/' + siteId + '/' + selectedScan, { method: 'POST' });
    setFixing(false);
    if (res.ok) {
      alert(`Fixed: ${res.fixed}, Failed: ${res.failed}`);
      load();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const selectScan = async (id: string) => {
    setSelectedScan(id);
    const f = await api('/findings/' + id);
    setFindings(f);
  };

  if (!site) return <div style={{ padding: 24 }}>Loading...</div>;

  const sevColor = (s: string) => ({ critical: theme.critical, high: theme.high, medium: theme.medium, low: theme.low, info: theme.info }[s] || theme.textMuted);

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <button style={{ ...btn(theme.textMuted, 'ghost'), marginBottom: 16, fontSize: 12 }} onClick={onBack}>
        {Icons.arrowUp} Back to Sites
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{site.domain}</h2>
          <p style={{ fontSize: 13, color: theme.textMuted }}>Health Score: {site.healthScore}/100 · {site.connection}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...btn(theme.primary) }} onClick={runScan} disabled={scanning}>
            {Icons.play} {scanning ? 'Scanning...' : 'Run Scan'}
          </button>
          <button style={{ ...btn(theme.success, 'primary') }} onClick={handleFix} disabled={fixing || findings.filter(f => f.status === 'new').length === 0}>
            {fixing ? 'Fixing...' : `Fix All (${findings.filter(f => f.status === 'new').length})`}
          </button>
        </div>
      </div>

      {scanProgress && (
        <Card style={{ marginBottom: 16, background: theme.surface2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ color: theme.primary, fontSize: 13 }}>Scanning...</span>
            <Badge text={scanProgress.status} color={theme.primary} />
          </div>
          <div style={{ height: 6, background: theme.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: scanProgress.status === 'completed' ? '100%' : '60%', background: theme.primary, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Scan History</h3>
          {scans.length === 0 ? (
            <p style={{ fontSize: 12, color: theme.textMuted }}>No scans yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scans.slice(0, 10).map(s => (
                <div key={s.id} style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: selectedScan === s.id ? theme.surface2 : 'transparent', fontSize: 12 }}
                  onClick={() => selectScan(s.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{new Date(s.startedAt).toLocaleDateString()}</span>
                    <Badge text={s.status} color={s.status === 'completed' ? theme.success : s.status === 'running' ? theme.warning : theme.danger} />
                  </div>
                  <div style={{ color: theme.textMuted, marginTop: 2 }}>{new Date(s.startedAt).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Findings ({findings.length})</h3>
            {findings.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {['critical', 'high', 'medium', 'low'].map(s => {
                  const count = findings.filter(f => f.severity === s).length;
                  return count > 0 ? <Badge key={s} text={`${s} ${count}`} color={sevColor(s)} /> : null;
                })}
              </div>
            )}
          </div>
          {findings.length === 0 ? (
            <p style={{ fontSize: 12, color: theme.textMuted }}>No findings in this scan</p>
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {findings.map(f => (
                <div key={f.id} style={{ padding: '10px 0', borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge text={f.severity} color={sevColor(f.severity)} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{f.title}</span>
                    </div>
                    <Badge text={f.status} color={f.status === 'fixed' ? theme.success : f.status === 'approved' ? theme.warning : theme.textMuted} />
                  </div>
                  <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{f.description}</p>
                  {f.sourceFile && <p style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'monospace', marginTop: 2 }}>{f.sourceFile}</p>}
                  {f.recommendation && <p style={{ fontSize: 12, color: theme.warning, marginTop: 4 }}>→ {f.recommendation}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Settings Page ───
function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api('/settings').then(setSettings); }, []);

  const handleSave = async () => {
    setSaving(true);
    await api('/settings', { method: 'PUT', body: settings });
    setSaving(false);
    alert('Settings saved');
  };

  if (!settings) return <div style={{ padding: 24 }}>Loading...</div>;

  const update = (path: string, value: any) => {
    const parts = path.split('.');
    const copy = { ...settings };
    if (parts.length === 1) copy[parts[0]] = value;
    else if (parts.length === 2) { if (!copy[parts[0]]) copy[parts[0]] = {}; copy[parts[0]][parts[1]] = value; }
    else if (parts.length === 3) { if (!copy[parts[0]]) copy[parts[0]] = {}; if (!copy[parts[0]][parts[1]]) copy[parts[0]][parts[1]] = {}; copy[parts[0]][parts[1]][parts[2]] = value; }
    setSettings(copy);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Settings</h2>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>API Keys</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>OpenRouter API Key</label>
            <input style={inputStyle} type="password" value={settings.apiKeys?.openrouter?.key || ''}
              onChange={e => update('apiKeys.openrouter.key', e.target.value)} placeholder="sk-or-..." />
          </div>
          <div>
            <label style={labelStyle}>OpenRouter Model</label>
            <input style={inputStyle} value={settings.apiKeys?.openrouter?.model || 'deepseek/deepseek-chat'}
              onChange={e => update('apiKeys.openrouter.model', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>VirusTotal API Key</label>
            <input style={inputStyle} type="password" value={settings.apiKeys?.virustotal?.key || ''}
              onChange={e => update('apiKeys.virustotal.key', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>WPScan API Key</label>
            <input style={inputStyle} type="password" value={settings.apiKeys?.wpscan?.key || ''}
              onChange={e => update('apiKeys.wpscan.key', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Scan Configuration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Max Parallel Scans</label>
            <input style={inputStyle} type="number" value={settings.maxParallelScans}
              onChange={e => update('maxParallelScans', parseInt(e.target.value) || 10)} />
          </div>
          <div>
            <label style={labelStyle}>API Rate Limit (req/sec)</label>
            <input style={inputStyle} type="number" value={settings.apiRateLimit}
              onChange={e => update('apiRateLimit', parseInt(e.target.value) || 4)} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" id="aiEnabled" checked={settings.aiEnabled}
            onChange={e => update('aiEnabled', e.target.checked)} />
          <label htmlFor="aiEnabled" style={{ fontSize: 13 }}>Enable AI Analysis (OpenRouter)</label>
        </div>
      </Card>

      <button style={{ ...btn(theme.primary), padding: '8px 24px' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── App ───
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const refreshSites = useCallback(async () => {
    const s = await api('/sites');
    setSites(s || []);
  }, []);

  useEffect(() => {
    if (unlocked) refreshSites();
  }, [unlocked, refreshSites]);

  const handleUnlock = () => { setUnlocked(true); };
  const handleLogout = () => { setUnlocked(false); };

  const handleRunScan = async (siteId: string) => {
    setSelectedSite(siteId);
    setPage('site-detail');
  };

  if (!unlocked) return <UnlockScreen onUnlock={handleUnlock} />;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar page={page} setPage={(p) => { setPage(p); if (p !== 'site-detail') setSelectedSite(null); }} onLogout={handleLogout} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {page === 'dashboard' && <DashboardPage sites={sites} onRunScan={handleRunScan} />}
        {page === 'sites' && <SitesPage sites={sites} onRefresh={refreshSites} onSelectSite={(id) => { setSelectedSite(id); setPage('site-detail'); }} />}
        {page === 'site-detail' && selectedSite && <SiteDetailPage siteId={selectedSite} onBack={() => setPage('sites')} />}
        {page === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
}