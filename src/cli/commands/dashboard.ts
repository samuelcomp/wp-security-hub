import { Command } from 'commander';

export const dashboardCommand = new Command('dashboard')
  .description('Launch the desktop dashboard')
  .action(() => {
    console.log('Dashboard launching...');
  });