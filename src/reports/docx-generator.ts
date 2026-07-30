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

    const bySeverity: Record<string, Finding[]> = { critical: [], high: [], medium: [], low: [], info: [] };
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