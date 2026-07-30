 Project Scaffold

**Files:**
- Create: `wp-security-hub/package.json`
- Create: `wp-security-hub/tsconfig.json`
- Create: `wp-security-hub/vitest.config.ts`
- Create: `wp-security-hub/.gitignore`

**Interfaces:**
- Produces: project root with dependencies (commander, better-sqlite3, sqlcipher, ssh2, openai, zod, yaml, docx, marked, ora, cli-progress, node-cron, vitest)

- [ ] **Step 1: Create project directory and initialize package.json**

```bash
New-Item -ItemType Directory -Force -Path "C:\Users\MEGAUPLOAD\wp-security-hub"
Set-Location -LiteralPath "C:\Users\MEGAUPLOAD\wp-security-hub"
npm init -y
```

Run: `npm init -y`
Expected: `package.json` created with default values

- [ ] **Step 2: Write package.json with all dependencies**

```json
{
  "name": "wp-security-hub",
  "version": "1.0.0",
  "description": "WordPress security audit automation with AI-powered research agents",
  "main": "dist/cli/index.js",
  "bin": {
    "wp-audit": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "node dist/cli/index.js"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "better-sqlite3": "^11.6.0",
    "sqlcipher": "npm:@journeyapps/sqlcipher",
    "ssh2": "^1.16.0",
    "openai": "^4.73.0",
    "zod": "^3.23.8",
    "yaml": "^2.6.0",
    "docx": "^9.0.0",
    "marked": "^14.1.0",
    "ora": "^8.1.1",
    "cli-progress": "^3.12.0",
    "node-cron": "^3.0.3",
    "chalk": "^5.3.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/ssh2": "^1.15.1",
    "@types/node": "^22.7.0",
    "@types/uuid": "^10.0.0",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "electron": "^32.0.0",
    "electron-builder": "^25.1.0"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
```

- [ ] **Step 5: Write .gitignore**

```
node_modules/
dist/
*.db
*.db-journal
*.db-wal
settings.yaml
.env
```

- [ ] **Step 6: Install dependencies and verify build**

```bash
cd wp-security-hub
npm install
npx tsc --noEmit
```

Expected: TypeScript compiles with no errors (no source files yet, so no output)

- [ ] **Step 7: Commit**

```bash
git init
git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: initialize wp-security-hub project scaffold"
```

---


