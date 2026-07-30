import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  scanSite: (siteId: string) => ipcRenderer.invoke('scan-site', siteId),
  getSites: () => ipcRenderer.invoke('get-sites'),
});