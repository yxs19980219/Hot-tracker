import { describe, it, expect } from 'vitest';
import { normalizeUrl, detectUrlType, extractGitHubRepo, generateFingerprint } from '../services/urlNormalizer.js';

describe('normalizeUrl', () => {
  it('归一化 GitHub 仓库 URL', () => {
    const result = normalizeUrl('https://github.com/owner/repo');
    expect(result.canonicalUrl).toBe('https://github.com/owner/repo');
    expect(result.type).toBe('github');
  });

  it('去掉 GitHub URL 中的 .git 后缀', () => {
    const result = normalizeUrl('https://github.com/owner/repo.git');
    expect(result.canonicalUrl).toBe('https://github.com/owner/repo');
    expect(result.type).toBe('github');
  });

  it('去掉查询参数中的追踪参数', () => {
    const result = normalizeUrl('https://example.com/article?utm_source=twitter&utm_campaign=abc');
    expect(result.canonicalUrl).toBe('https://example.com/article');
  });

  it('去掉 hash', () => {
    const result = normalizeUrl('https://example.com/page#section');
    expect(result.canonicalUrl).toBe('https://example.com/page');
  });

  it('保留其他正常查询参数', () => {
    const result = normalizeUrl('https://example.com/page?id=123');
    expect(result.canonicalUrl).toBe('https://example.com/page?id=123');
  });

  it('处理非法 URL 时返回原字符串', () => {
    const result = normalizeUrl('not-a-url');
    expect(result.canonicalUrl).toBe('not-a-url');
    expect(result.type).toBe('unknown');
  });
});

describe('detectUrlType', () => {
  it('识别 GitHub 为 github', () => {
    expect(detectUrlType('https://github.com/foo/bar')).toBe('github');
    expect(detectUrlType('https://www.github.com/foo/bar')).toBe('github');
  });

  it('识别 Medium 为 article', () => {
    expect(detectUrlType('https://medium.com/post')).toBe('article');
  });

  it('识别根域名为 official', () => {
    expect(detectUrlType('https://anthropic.com/')).toBe('official');
  });

  it('识别其他路径为 article', () => {
    expect(detectUrlType('https://example.com/blog/post')).toBe('article');
  });
});

describe('extractGitHubRepo', () => {
  it('从标准 GitHub URL 提取 repo', () => {
    expect(extractGitHubRepo('https://github.com/langchain-ai/langchain')).toBe('langchain-ai/langchain');
  });

  it('从带 .git 的 URL 提取 repo', () => {
    expect(extractGitHubRepo('https://github.com/owner/repo.git')).toBe('owner/repo');
  });

  it('非 GitHub URL 返回 null', () => {
    expect(extractGitHubRepo('https://example.com/foo')).toBeNull();
  });
});

describe('generateFingerprint', () => {
  it('相同输入产生相同指纹', () => {
    const fp1 = generateFingerprint('Hello World', 'https://example.com');
    const fp2 = generateFingerprint('Hello World', 'https://example.com');
    expect(fp1).toBe(fp2);
  });

  it('不同输入产生不同指纹', () => {
    const fp1 = generateFingerprint('Hello World', 'https://example.com');
    const fp2 = generateFingerprint('Hello World', 'https://other.com');
    expect(fp1).not.toBe(fp2);
  });
});
