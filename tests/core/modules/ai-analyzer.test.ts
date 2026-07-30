import { describe, it, expect } from 'vitest';
import { AiAnalyzer } from '../../../src/core/modules/ai-analyzer';
import type { Settings } from '../../../src/config/settings';

describe('AiAnalyzer', () => {
  it('returns skipped result when AI is disabled', async () => {
    const analyzer = new AiAnalyzer('test', 'scan-1');
    const settings: Settings = {
      apiKeys: {},
      maxParallelScans: 10,
      apiRateLimit: 4,
      aiEnabled: false,
      aiModel: 'test',
      defaultOutputDir: '',
    };

    const { result } = await analyzer.analyze('<?php echo "hello"; ?>', settings);
    expect(result.classification).toBe('suspicious');
    expect(result.reasoning).toContain('skipped');
  });
});