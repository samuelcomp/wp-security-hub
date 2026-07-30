#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { addSiteCommand } from './commands/add-site';
import { scanCommand } from './commands/scan';
import { statusCommand } from './commands/status';
import { fixCommand } from './commands/fix';
import { dashboardCommand } from './commands/dashboard';

const program = new Command();

program
  .name('wp-audit')
  .description('WordPress Security Audit Automation Tool')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(addSiteCommand);
program.addCommand(scanCommand);
program.addCommand(statusCommand);
program.addCommand(fixCommand);
program.addCommand(dashboardCommand);

program.parse(process.argv);