# WP Security Hub

**WordPress security audit automation with AI-powered analysis.** Scan multiple WordPress websites in parallel, detect malware, audit configurations, check vulnerabilities, and generate editable DOCX reports — all through a native desktop application.

## Features

### 🔍 Security Scan Engine
- **12 scan modules** covering every aspect of WordPress security
- **4-round investigation** process per site (Recon → External Intel → Deep Analysis → Report)
- **10+ parallel sites** scanned simultaneously
- **Resumable scans** — close the app, reopen, pick up where you left off

### 🛡️ Scan Modules
| Module | What it checks |
|---|---|
| **Reconnaissance** | WordPress version, PHP version, server software, installed plugins/themes, user accounts, file count |
| **Malware Scanner** | 12 malware signatures — backdoors, webshells, spam injectors, obfuscated code, C2 beacons |
| **Core Integrity** | Verifies all WordPress core files against official checksums |
| **Config Auditor** | wp-config.php settings, .htaccess security, debug mode, XML-RPC, directory listings |
| **User Auditor** | Default admin accounts, weak usernames, excessive admin users |
| **SSL Auditor** | Certificate expiration, issuer trust, HTTPS configuration |
| **Database Scanner** | wp_options for injected plugins, hidden user accounts, spam |
| **Vulnerability Checker** | Outdated WordPress core and plugins |
| **External Intel** | WPScan, Sucuri SiteCheck, Google Safe Browsing |
| **External Scanners** | One-click links to VirusTotal, Sucuri, WPScan, HackerTarget, WPSec |

### 🤖 AI Analysis (OpenRouter)
- **One API key** accesses all major AI models
- Suspicious files sent to AI for classification as malicious/safe/suspicious
- Model dropdown with 10 models: DeepSeek V3, V4 Pro, Flash, GPT-4o, Claude, Gemini, Llama

### 📝 Reports & Fixes
- **Editable DOCX reports** with executive summary, findings by severity, code evidence
- **Markdown reports** for vault/memory storage
- **Per-finding fix actions** — delete malware, update plugins, harden config, reset passwords
- **Read-then-write** workflow — scan is read-only, fixes require explicit approval
- **Health Score** (0-100) per site with color-coded badges

### 🔐 Security
- **AES-256-GCM encryption** for all stored credentials
- **Encrypted SQLite database** for secrets (SSH keys, passwords, API tokens)
- **Master passphrase** derivation via PBKDF2
- **Per-site folder isolation** — each site's data stored in its own folder

### 🖥️ Desktop Dashboard
- **Electron native window** with dark theme
- **Unlock screen** with master passphrase
- **Dashboard** — health score cards, one-click scan
- **Sites** — add with SSH/cPanel/WP-Admin, Browse button for folder selection
- **Site Detail** — scan history, findings with severity badges, Fix All button
- **Settings** — AI model dropdown, scan configuration

## Installation

```bash
git clone https://github.com/samuelcomp/wp-security-hub.git
cd wp-security-hub
npm install
npm run build
```

## Usage

### Desktop App (recommended)
```bash
# Terminal 1: start API server
npm run dashboard

# Terminal 2: open native window
npm run electron
```

Or one-click: double-click `start.bat`

### CLI
```bash
npm run cli init              # first-time setup
npm run cli add example.com   # register a site
npm run cli scan all          # scan all sites
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, TypeScript, Express |
| Desktop | Electron |
| Database | better-sqlite3 |
| AI | OpenRouter API (OpenAI-compatible) |
| Reports | docx (DOCX), Markdown |
| SSH | ssh2 |
| Testing | Vitest (20 tests) |

## Project Structure

```
src/
├── cli/              # CLI commands
├── config/           # Settings manager (YAML)
├── core/
│   ├── connectors/   # SSH, cPanel, WP-Admin
│   ├── engine/       # Agent runner, orchestrator
│   └── modules/      # 12 scan modules
├── dashboard/        # Electron + React UI
├── fix/              # Fix engine
├── reports/          # DOCX + Markdown generators
└── storage/          # Encrypted database + repos
```

## License

MIT
