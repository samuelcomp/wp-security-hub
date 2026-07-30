# Task 17 Report — Report Generators (DOCX + Markdown)

## Files Created

| File | Description |
|------|-------------|
| `src/reports/docx-generator.ts` | DOCX report generator using `docx` npm package |
| `src/reports/md-generator.ts` | Markdown report generator |
| `src/reports/finding-writer.ts` | Individual finding writer to vault/memory files |

## Details

### `docx-generator.ts`
- Exports `DocxGenerator` class with `generate(site, scan, findings, outputDir)` method
- Produces a `.docx` file with title page, executive summary, and findings grouped by severity
- Each finding includes title, status, module, description, recommendation, optional code snippet (monospace, shaded), and optional fix action
- Uses `docx` package (v9.x, already in dependencies)

### `md-generator.ts`
- Exports `MdGenerator` class with `generate(site, scan, findings, outputDir)` method
- Produces a `.md` file with the same structure: executive summary, severity-grouped findings
- Each finding includes title, status, module, file, description, recommendation, fix, and code snippet
- Output filename: `audit-{siteId}-{date}.md`

### `finding-writer.ts`
- Exports `FindingWriter` class with `write(findings, vaultDir, siteId)` method
- Writes each finding as a separate markdown file to `{vaultDir}/sites/{siteId}/findings/`
- File naming: `{findingId}-{sanitized-title}.md`
- Includes AI analysis as JSON block if present

## TypeScript Check
- `npx tsc --noEmit` passes with no errors in `src/reports/`. Pre-existing errors in `src/core/modules/` and `src/storage/` are unrelated.