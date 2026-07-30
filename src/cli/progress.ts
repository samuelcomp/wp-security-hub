import cliProgress from 'cli-progress';

export function createProgressBar(format?: string) {
  return new cliProgress.SingleBar({
    format: format || 'Progress: {bar} | {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
}

export function createMultiProgressBar() {
  return new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: '{name} | {bar} | {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
}