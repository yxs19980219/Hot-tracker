import { describe, it, expect } from 'vitest';
import { analyzeTrackingUpdate } from '../services/ai.js';

describe('analyzeTrackingUpdate', () => {
  it('无 API key 时返回 fallback 结果', async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = '';

    try {
      const result = await analyzeTrackingUpdate('New feature released');
      expect(result.action).toBe('watch');
      expect(result.summary).toContain('New feature released');
    } finally {
      process.env.DEEPSEEK_API_KEY = originalKey || '';
    }
  });

  it('使用自定义 Prompt 分析更新', async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = '';

    try {
      const customPrompt = '分析这个安全更新，判断是否有 CVE 修复';
      const result = await analyzeTrackingUpdate(
        'Fixed XSS vulnerability in v2.1.0',
        customPrompt
      );
      // fallback 模式下仍然返回 watch，但函数应接受自定义 Prompt 参数
      expect(result.action).toBe('watch');
    } finally {
      process.env.DEEPSEEK_API_KEY = originalKey || '';
    }
  });
});
