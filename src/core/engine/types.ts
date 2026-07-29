import { z } from 'zod';

export type ConnectionType = 'ssh' | 'cpanel' | 'wp-admin';

export const ConnectionTypeSchema = z.enum(['ssh', 'cpanel', 'wp-admin']);

export interface SshCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface CpanelCredentials {
  host: string;
  port: number;
  username: string;
  apiToken: string;
}

export interface WpAdminCredentials {
  url: string;
  username: string;
  password: string;
}

export type SiteCredentials = SshCredentials | CpanelCredentials | WpAdminCredentials;

export interface SiteConfig {
  id: string;
  domain: string;
  connection: ConnectionType;
  credentials: SiteCredentials;
  techStack: Record<string, string>;
  healthScore: number;
  createdAt: string;
  updatedAt: string;
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingStatus = 'new' | 'reviewed' | 'approved' | 'fixed' | 'ignored';

export type RoundType = 1 | 2 | 3 | 4;

export type ScanStatus = 'running' | 'completed' | 'failed' | 'interrupted';

export type ScanModule =
  | 'recon'
  | 'external-intel'
  | 'core-integrity'
  | 'malware'
  | 'db-scanner'
  | 'vuln-checker'
  | 'config-auditor'
  | 'user-auditor'
  | 'ssl-auditor'
  | 'blacklist-check'
  | 'ai-analyzer';

export interface Finding {
  id: string;
  scanId: string;
  siteId: string;
  round: RoundType;
  module: ScanModule;
  severity: FindingSeverity;
  title: string;
  description: string;
  sourceFile: string | null;
  sourceLine: number | null;
  codeSnippet: string | null;
  virusTotalResult: Record<string, unknown> | null;
  aiAnalysis: Record<string, unknown> | null;
  recommendation: string;
  fixAction: string | null;
  status: FindingStatus;
  fixedAt: string | null;
  fixLog: string | null;
}

export interface FixAction {
  type: 'delete-file' | 'replace-file' | 'update-plugin' | 'update-theme' | 'update-core'
    | 'reset-password' | 'chmod' | 'htaccess-rule' | 'wp-config-edit' | 'delete-user'
    | 'disable-xmlrpc';
  target: string;
  payload?: string;
}

export interface FixRecord {
  id: string;
  findingId: string;
  siteId: string;
  action: string;
  beforeState: string | null;
  afterState: string | null;
  executedAt: string;
  success: boolean;
}

export interface ScanConfig {
  siteId: string;
  rounds?: RoundType[];
  parallelFiles?: number;
  aiEnabled?: boolean;
}

export interface ScanProgress {
  currentRound: RoundType;
  roundProgress: number;
  findingsCount: number;
  modulesCompleted: string[];
  modulesPending: string[];
}

export interface ScanResult {
  id: string;
  siteId: string;
  status: ScanStatus;
  roundsCompleted: RoundType[];
  startedAt: string;
  finishedAt: string | null;
  progress: ScanProgress;
  findings: Finding[];
}

export interface AgentMemory {
  siteId: string;
  domain: string;
  phpVersion: string;
  wpVersion: string;
  serverSoftware: string;
  plugins: Array<{ name: string; version: string; status: string }>;
  themes: Array<{ name: string; version: string; status: string }>;
  users: Array<{ login: string; role: string }>;
  fileCount: number;
  knownIssues: string[];
  lastScanAt: string | null;
}

export interface ReportConfig {
  siteId: string;
  outputDir: string;
  format: 'docx' | 'md';
  includeCodeSnippets: boolean;
}

export interface ExternalApiResult {
  service: 'virustotal' | 'wpscan' | 'sucuri' | 'hackertarget' | 'wpsec' | 'google-safe-browsing';
  findings: Array<{
    title: string;
    severity: FindingSeverity;
    description: string;
    recommendation: string;
  }>;
  raw: Record<string, unknown>;
}

export interface AiAnalysisResult {
  classification: 'malicious' | 'suspicious' | 'safe';
  reasoning: string;
  malwareType?: string;
  removalInstructions?: string;
}