import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../db.js';
import type { SearchResult } from '../types.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * 抓取 GitHub Trending 页面
 */
export async function fetchGithubTrending(language?: string): Promise<SearchResult[]> {
  const url = language
    ? `https://github.com/trending/${encodeURIComponent(language)}`
    : 'https://github.com/trending';

  const response = await axios.get(url, {
    headers: { 'User-Agent': getRandomUserAgent() },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);
  const results: SearchResult[] = [];

  $('article.Box-row').each((_, element) => {
    const linkEl = $(element).find('h2 a');
    const repoPath = linkEl.attr('href');
    const repoName = repoPath?.replace(/^\//, '') || '';
    const description = $(element).find('p').text().trim();
    const lang = $(element).find('[itemprop="programmingLanguage"]').text().trim();
    const starsText = $(element).find('.d-inline-block:contains("stars today")').text().trim();
    const starsTodayMatch = starsText.match(/([\d,]+)\s+stars?\s+today/i);
    const starsToday = starsTodayMatch ? parseInt(starsTodayMatch[1].replace(/,/g, '')) : 0;

    if (repoName) {
      results.push({
        title: repoName,
        content: description || `${repoName} is trending on GitHub`,
        url: `https://github.com${repoPath}`,
        source: 'github_trending',
        publishedAt: new Date()
      });
    }
  });

  return results;
}

/**
 * 将 Trending 结果缓存到数据库
 */
export async function cacheTrendingResults(results: SearchResult[]): Promise<void> {
  for (const result of results) {
    await prisma.githubTrending.upsert({
      where: { repoName: result.title },
      update: {
        description: result.content,
        fetchedAt: new Date()
      },
      create: {
        repoName: result.title,
        description: result.content,
        url: result.url,
        fetchedAt: new Date()
      }
    });
  }
}

/**
 * 获取缓存的 Trending 结果
 */
export async function getCachedTrending(): Promise<SearchResult[]> {
  const cached = await prisma.githubTrending.findMany({
    orderBy: { fetchedAt: 'desc' },
    take: 100
  });

  return cached.map(item => ({
    title: item.repoName,
    content: item.description || '',
    url: item.url,
    source: 'github_trending',
    publishedAt: item.fetchedAt
  }));
}
