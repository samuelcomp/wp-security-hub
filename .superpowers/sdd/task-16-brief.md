 Orchestrator â€” Parallel Site Management

**Files:**
- Create: `wp-security-hub/src/core/engine/orchestrator.ts`

**Interfaces:**
- Produces: `Orchestrator.scanAll()`, `Orchestrator.scanSite(siteId: string)`, event emitter for progress updates

- [ ] **Step 1: Write orchestrator.ts**

```typescript
import EventEmitter from 'events';
import type { SiteConfig, ScanResult, ScanProgress } from './types';
import type { Settings } from '../../config/settings';
import { listSites, getSite } from '../../storage/site-repo';
import { AgentRunner } from './agent-runner';
import { listScansForSite } from '../../storage/scan-repo';

interface ScanEvent {
  siteId: string;
  domain: string;
  status: 'connecting' | 'running' | 'round-start' | 'round-complete' | 'completed' | 'failed';
  round?: number;
  progress?: number;
  findingsCount?: number;
  error?: string;
}

export class Orchestrator extends EventEmitter {
  private active: Map<string, AgentRunner> = new Map();

  constructor(
    private settings: Settings,
    private vaultDir: string
  ) {
    super();
  }

  async scanSite(siteId: string): Promise<ScanResult> {
    const site = getSite(siteId);
    if (!site) throw new Error(`Site not found: ${siteId}`);

    this.emit('scan', {
      siteId, domain: site.domain, status: 'connecting',
    } satisfies ScanEvent);

    const runner = new AgentRunner(site, this.settings, this.vaultDir);
    this.active.set(siteId, runner);

    try {
      this.emit('scan', {
        siteId, domain: site.domain, status: 'running',
      } satisfies ScanEvent);

      const result = await runner.run();

      this.emit('scan', {
        siteId, domain: site.domain, status: 'completed',
        findingsCount: result.findings?.length || 0,
      } satisfies ScanEvent);

      return result;
    } catch (err) {
      this.emit('scan', {
        siteId, domain: site.domain, status: 'failed',
        error: (err as Error).message,
      } satisfies ScanEvent);

      throw err;
    } finally {
      this.active.delete(siteId);
    }
  }

  async scanAll(): Promise<Map<string, ScanResult>> {
    const sites = listSites();
    const results = new Map<string, ScanResult>();
    const maxParallel = this.settings.maxParallelScans || 10;

    const chunks: SiteConfig[][] = [];
    for (let i = 0; i < sites.length; i += maxParallel) {
      chunks.push(sites.slice(i, i + maxParallel));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(site => this.scanSite(site.id))
      );

      for (let i = 0; i < chunk.length; i++) {
        const result = chunkResults[i];
        if (result.status === 'fulfilled') {
          results.set(chunk[i].id, result.value);
        } else {
          console.error(`Failed to scan ${chunk[i].domain}:`, result.reason);
        }
      }
    }

    return results;
  }

  getScanHistory(siteId: string) {
    return listScansForSite(siteId);
  }

  getActiveScans(): string[] {
    return Array.from(this.active.keys());
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/engine/orchestrator.ts
git commit -m "feat: add parallel scan orchestrator with event-based progress"
```

---


