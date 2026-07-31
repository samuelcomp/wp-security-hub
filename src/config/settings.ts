import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export interface ApiKeys {
  openrouter: { key: string; model: string };
}

export interface Settings {
  apiKeys: Partial<ApiKeys>;
  maxParallelScans: number;
  apiRateLimit: number;
  aiEnabled: boolean;
  aiModel: string;
  defaultOutputDir: string;
}

const DEFAULT_SETTINGS: Settings = {
  apiKeys: {},
  maxParallelScans: 10,
  apiRateLimit: 4,
  aiEnabled: true,
  aiModel: 'deepseek/deepseek-chat',
  defaultOutputDir: '',
};

export function loadSettings(rootDir: string): Settings {
  const settingsPath = path.join(rootDir, 'settings.yaml');
  if (!fs.existsSync(settingsPath)) {
    return { ...DEFAULT_SETTINGS };
  }
  const raw = fs.readFileSync(settingsPath, 'utf8');
  const parsed = yaml.parse(raw) || {};
  return {
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed.apiKeys },
    maxParallelScans: parsed.maxParallelScans ?? DEFAULT_SETTINGS.maxParallelScans,
    apiRateLimit: parsed.apiRateLimit ?? DEFAULT_SETTINGS.apiRateLimit,
    aiEnabled: parsed.aiEnabled ?? DEFAULT_SETTINGS.aiEnabled,
    aiModel: parsed.aiModel ?? DEFAULT_SETTINGS.aiModel,
    defaultOutputDir: parsed.defaultOutputDir ?? DEFAULT_SETTINGS.defaultOutputDir,
  };
}

export function saveSettings(rootDir: string, settings: Settings): void {
  const settingsPath = path.join(rootDir, 'settings.yaml');
  const content = yaml.stringify(settings);
  fs.writeFileSync(settingsPath, content, 'utf8');
}

export function resolveRootDir(customPath?: string): string {
  if (customPath) return customPath;
  const homeDir = process.env.WP_AUDIT_HOME || path.join(require('os').homedir(), 'wp-security-hub');
  if (!fs.existsSync(homeDir)) {
    fs.mkdirSync(homeDir, { recursive: true });
  }
  return homeDir;
}