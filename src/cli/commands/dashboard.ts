import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';

export const dashboardCommand = new Command('dashboard')
  .description('Launch the web dashboard')
  .action(() => {
    const serverPath = path.join(__dirname, '..', '..', 'dashboard', 'server.js');
    const proc = spawn('node', [serverPath], { stdio: 'inherit', cwd: path.join(__dirname, '..', '..', '..') });
    proc.on('close', () => process.exit());
  });