 Final Integration â€” Build, Package & Electron Dashboard Stub

**Files:**
- Create: `wp-security-hub/src/dashboard/main.ts`
- Create: `wp-security-hub/src/dashboard/preload.ts`
- Create: `wp-security-hub/src/dashboard/renderer/index.html`
- Create: `wp-security-hub/src/dashboard/renderer/main.tsx`
- Create: `wp-security-hub/src/dashboard/renderer/App.tsx`
- Create: `wp-security-hub/electron-builder.yml`

**Interfaces:**
- Produces: installable Electron application

- [ ] **Step 1: Write electron-builder.yml**

```yaml
appId: com.wp-security-hub.app
productName: WP Security Hub
directories:
  output: release
  buildResources: build
files:
  - dist/**/*
  - node_modules/**/*
  - package.json
win:
  target: nsis
  icon: build/icon.ico
mac:
  target: dmg
linux:
  target: AppImage
```

- [ ] **Step 2: Write Electron main.ts**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'WP Security Hub',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('scan-site', async (_event, siteId: string) => {
  return { status: 'ok' };
});

ipcMain.handle('get-sites', async () => {
  return [];
});
```

- [ ] **Step 3: Write preload.ts**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  scanSite: (siteId: string) => ipcRenderer.invoke('scan-site', siteId),
  getSites: () => ipcRenderer.invoke('get-sites'),
});
```

- [ ] **Step 4: Write renderer files**

`src/dashboard/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WP Security Hub</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

`src/dashboard/renderer/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

`src/dashboard/renderer/App.tsx`:
```tsx
import React, { useState } from 'react';

function App() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>WP Security Hub</h1>
      <p>Dashboard ready. Connect to the CLI backend to manage sites and view reports.</p>
    </div>
  );
}

export default App;
```

- [ ] **Step 5: Update package.json scripts**

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "node dist/cli/index.js",
    "dashboard:dev": "vite src/dashboard/renderer",
    "electron:dev": "electron dist/dashboard/main.js"
  }
}
```

- [ ] **Step 6: Final compile and test**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: All TypeScript compiles, all existing tests pass

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add Electron dashboard and final integration"
```

---

*End of implementation plan.*
