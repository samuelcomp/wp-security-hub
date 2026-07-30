 Report Generator (DOCX + Markdown)

**Files:**
- Create: `wp-security-hub/src/reports/docx-generator.ts`
- Create: `wp-security-hub/src/reports/md-generator.ts`
- Create: `wp-security-hub/src/reports/finding-writer.ts`

**Interfaces:**
- Produces: `DocxGenerator.generate(site, scan, findings, outputDir)`, `MdGenerator.generate(...)`, `FindingWriter.write(...)`

- [ ] **Step 1: Write docx-generator.ts**

```typescript
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ShadingType,
} from 'docx';
import fs from 'fs';
import path from 'path';
import type { SiteConfig, Finding, ScanResult } from '../core/engine/types';

export class DocxGenerator {
  async generate(
    site: SiteConfig,
    scan: ScanResult,
    findings: Finding[],
    outputDir: string
  ): Promise<string> {
    const sections = [];

    sections.push({
      children: [
        new Paragraph({
          text: 'WordPress Security Audit Report',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: '', spacing: { after: 200 } }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Website: ', bold: true }),
            new TextRun(site.domain),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Report Date: ', bold: true }),
            new TextRun(new Date(scan.startedAt).toLocaleDateString()),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Health Score: ', bold: true }),
            new TextRun(`${site.healthScore}/100`),
          ],
        }),
        new Paragraph({ text: '', spacing: { after: 200 } }),
      ],
    });

    sections.push({
      children: [
        new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          text: `This report contains ${findings.length} security findings for ${site.domain}. ` +
            `${findings.filter(f => f.severity === 'critical').length} critical, ` +
            `${findings.filter(f => f.severity === 'high').length} high, ` +
            `${findings.filter(f => f.severity === 'medium').length} medium, ` +
            `${findings.filter(f => f.severity === 'low').length} low severity issues were identified.`,
          spacing: { after: 200 },
        }),
      ],
    });

    if (findings.length > 0) {
      sections.push({
        children: [
          new Paragraph({ text: 'Findings', heading: HeadingLevel.HEADING_1 }),
          ...this.buildFindingsTable(findings),
        ],
      });
    }

    const doc = new Document({ sections });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `audit-${site.id}-${new Date().toISOString().split('T')[0]}.docx`;
    const filePath = path.join(outputDir, fileName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  private buildFindingsTable(findings: Finding[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    const bySeverity = { critical: [], high: [], medium: [], low: [], info: [] };
    for (const f of findings) {
      bySeverity[f.severity].push(f);
    }

    for (const [severity, items] of Object.entries(bySeverity)) {
      if (items.length === 0) continue;
      paragraphs.push(
        new Paragraph({
          text: `${severity.toUpperCase()} (${items.length})`,
          heading: HeadingLevel.HEADING_2,
        })
      );

      for (const item of items) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: item.title, bold: true, size: 24 }),
            ],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Status: ', bold: true }),
              new TextRun(item.status),
              new TextRun({ text: '  |  Module: ', bold: true }),
              new TextRun(item.module),
            ],
          }),
          new Paragraph({ text: item.description, spacing: { after: 100 } }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Recommendation: ', bold: true }),
              new TextRun(item.recommendation),
            ],
          }),
        );

        if (item.codeSnippet) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: item.codeSnippet,
                  font: 'Courier New',
                  size: 18,
                  shading: { type: ShadingType.SOLID, color: 'F0F0F0' },
                }),
              ],
              spacing: { before: 100, after: 100 },
            })
          );
        }

        if (item.fixAction) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Fix Action: ', bold: true }),
                new TextRun(item.fixAction),
              ],
              spacing: { after: 100 },
            })
          );
        }

        paragraphs.push(new Paragraph({ text: '---', spacing: { after: 100 } }));
      }
    }

    return paragraphs;
  }
}
```

- [ ] **Step 2: Write md-generator.ts**

```typescript
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
    let md = `# ${site.domain} â€” Security Audit Report\n\n`;
    md += `**Date:** ${new Date(scan.startedAt).toLocaleDateString()}  \n`;
    md += `**Health Score:** ${site.healthScore}/100  \n`;
    md += `**Scan ID:** ${scan.id}\n\n`;

    md += `## Executive Summary\n\n`;
    md += `${findings.length} findings: `;
    md += `${findings.filter(f => f.severity === 'critical').length} critical, `;
    md += `${findings.filter(f => f.severity === 'high').length} high, `;
    md += `${findings.filter(f => f.severity === 'medium').length} medium, `;
    md += `${findings.filter(f => f.severity === 'low').length} low.\n\n`;

    const bySeverity = { critical: [], high: [], medium: [], low: [], info: [] };
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
```

- [ ] **Step 3: Write finding-writer.ts**

```typescript
import fs from 'fs';
import path from 'path';
import type { Finding } from '../core/engine/types';

export class FindingWriter {
  write(findings: Finding[], vaultDir: string, siteId: string): void {
    const findingsDir = path.join(vaultDir, 'sites', siteId, 'findings');
    if (!fs.existsSync(findingsDir)) {
      fs.mkdirSync(findingsDir, { recursive: true });
    }

    for (const finding of findings) {
      let md = `# ${finding.id}: ${finding.title}\n\n`;
      md += `- **Severity:** ${finding.severity}\n`;
      md += `- **Module:** ${finding.module}\n`;
      md += `- **Status:** ${finding.status}\n`;
      if (finding.sourceFile) md += `- **File:** \`${finding.sourceFile}\`\n`;
      md += `\n## Description\n\n${finding.description}\n\n`;
      md += `## Recommendation\n\n${finding.recommendation}\n\n`;
      if (finding.codeSnippet) {
        md += `## Evidence\n\n\`\`\`php\n${finding.codeSnippet}\n\`\`\`\n\n`;
      }
      if (finding.fixAction) {
        md += `## Fix Action\n\n\`${finding.fixAction}\`\n\n`;
      }
      if (finding.aiAnalysis) {
        md += `## AI Analysis\n\n\`\`\`json\n${JSON.stringify(finding.aiAnalysis, null, 2)}\n\`\`\`\n\n`;
      }

      fs.writeFileSync(
        path.join(findingsDir, `${finding.id}-${finding.title.replace(/[^a-z0-9-]/gi, '-').toLowerCase().substring(0, 50)}.md`),
        md,
        'utf8'
      );
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/reports/docx-generator.ts src/reports/md-generator.ts src/reports/finding-writer.ts
git commit -m "feat: add DOCX and Markdown report generators"
```

---


