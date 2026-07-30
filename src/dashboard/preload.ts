import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  unlock: (password: string, rootDir?: string) => ipcRenderer.invoke('app:unlock', password, rootDir),

  sites: {
    list: () => ipcRenderer.invoke('sites:list'),
    get: (id: string) => ipcRenderer.invoke('sites:get', id),
    create: (data: { domain: string; connection: string; credentials: Record<string, unknown> }) => ipcRenderer.invoke('sites:create', data),
    update: (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke('sites:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('sites:delete', id),
  },

  scans: {
    run: (siteId: string) => ipcRenderer.invoke('scans:run', siteId),
    list: (siteId: string) => ipcRenderer.invoke('scans:list', siteId),
    onProgress: (callback: (event: any) => void) => {
      ipcRenderer.on('scan:progress', (_event, data) => callback(data));
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('scan:progress');
    },
  },

  findings: {
    list: (scanId: string) => ipcRenderer.invoke('findings:list', scanId),
    forSite: (siteId: string) => ipcRenderer.invoke('findings:for-site', siteId),
    updateStatus: (findingId: string, status: string) => ipcRenderer.invoke('findings:update-status', findingId, status),
  },

  fixes: {
    applyAll: (siteId: string, scanId: string) => ipcRenderer.invoke('fixes:apply-all', siteId, scanId),
    history: (siteId: string) => ipcRenderer.invoke('fixes:history', siteId),
  },

  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },

  connections: {
    test: (data: { type: string; credentials: Record<string, unknown> }) => ipcRenderer.invoke('connections:test', data),
  },
});