/**
 * URL 归一化服务
 * 将各种输入 URL 转换为 canonical 形式，便于去重和追踪
 */

export interface NormalizedUrl {
  canonicalUrl: string;
  title?: string;
  type: 'github' | 'official' | 'article' | 'unknown';
}

/**
 * 归一化 URL：去掉查询参数、hash、追踪参数等
 */
export function normalizeUrl(input: string): NormalizedUrl {
  try {
    const url = new URL(input);

    // GitHub 仓库归一化
    if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
      const match = url.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
      if (match) {
        const [, owner, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, '');
        return {
          canonicalUrl: `https://github.com/${owner}/${cleanRepo}`,
          type: 'github'
        };
      }
    }

    // 去掉常见追踪参数
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    // 去掉 hash
    url.hash = '';

    const canonical = url.toString();

    return {
      canonicalUrl: canonical,
      type: detectUrlType(canonical)
    };
  } catch {
    return {
      canonicalUrl: input,
      type: 'unknown'
    };
  }
}

/**
 * 检测 URL 类型
 */
export function detectUrlType(url: string): 'github' | 'official' | 'article' | 'unknown' {
  try {
    const u = new URL(url);

    if (u.hostname === 'github.com' || u.hostname === 'www.github.com') {
      return 'github';
    }

    if (u.hostname.includes('medium.com') || u.hostname.includes('dev.to') || u.hostname.includes('techcrunch.com')) {
      return 'article';
    }

    // 产品官网通常是根域名或简单路径
    if (u.pathname === '/' || u.pathname === '') {
      return 'official';
    }

    return 'article';
  } catch {
    return 'unknown';
  }
}

/**
 * 从 GitHub URL 提取 owner/repo
 */
export function extractGitHubRepo(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null;
    const match = u.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * 从各种 GitHub URL 中提取 repo 全名（支持 releases, commits 等子页面）
 */
export function extractRepoFromAnyGithubUrl(url: string): string | null {
  return extractGitHubRepo(url);
}

/**
 * 生成内容指纹（用于去重）
 */
export function generateFingerprint(title: string, url?: string): string {
  const data = `${title.toLowerCase().trim()}|${url || ''}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
