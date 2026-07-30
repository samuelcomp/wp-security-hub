import fs from 'fs';
import path from 'path';
import type { SiteConfig, Finding, ScanResult } from '../core/engine/types';

export class MdGenerator {
  generate(
    site: SiteConfig,
    scan: ScanResult,
    findings: Finding[],
    outputDir: string
  ): string {
    let md = `# ${site.domain} — Security Audit Report\n\n`;
    md += `**Date:** ${new Date(scan.startedAt).toLocaleDateString()}  \n`;
    md += `**Health Score:** ${site.healthScore}/100  \n`;
    md += `**Scan ID:** ${scan.id}\n\n`;

    md += `## Executive Summary\n\n`;
    md += `${findings.length} findings: `;
    md += `${findings.filter(f => f.severity === 'critical').length} critical, `;
    md += `${findings.filter(f => f.severity === 'high').length} high, `;
    md += `${findings.filter(f => f.severity === 'medium').length} medium, `;
    md += `${findings.filter(f => f.severity === 'low').length} low.\n\n`;

    const bySeverity: Record<string, Finding[]> = { critical: [], high: [], medium: [], low: [], info: [] };
    for (const f of findings) {
      bySeverity[f.severity].push(f);
    }

    for (const [severity, items] of Object.entries(bySeverity)) {
      if (items.length === 0) continue;
      md += `## ${severity.toUpperCase()} (${items.length})\n\n`;

      for (const item of items) {
        md += `### ${item.title}\n\n`;
        md += `- **Status:** ${item.status}\n`;
        md += `- **Module:** ${item.module}\n`;
        if (item.sourceFile) md += `- **File:** \`${item.sourceFile}\`\n`;
        md += `\n${item.description}\n\n`;
        md += `**Recommendation:** ${item.recommendation}\n\n`;
        if (item.fixAction) md += `**Fix:** \`${item.fixAction}\`\n\n`;
        if (item.codeSnippet) md += `\`\`\`php\n${item.codeSnippet}\n\`\`\`\n\n`;
        md += `---\n\n`;
      }
    }

    const filePath = path.join(outputDir, `audit-${site.id}-${new Date().toISOString().split('T')[0]}.md`);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(filePath, md, 'utf8');

    return filePath;
  }
}