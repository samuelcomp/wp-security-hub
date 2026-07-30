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