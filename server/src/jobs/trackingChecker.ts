import { Server } from 'socket.io';
import { prisma } from '../db.js';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { analyzeTrackingUpdate } from '../services/ai.js';

const rssParser = new Parser();

// 检查所有活跃追踪项的更新
export async function runTrackingCheck(io: Server): Promise<void> {
  console.log('\n🔄 Starting tracking check...');
  const startTime = Date.now();

  try {
    const items = await prisma.trackedItem.findMany({
      where: { isActive: true },
      include: { sources: true, keywords: true }
    });

    let totalUpdates = 0;
    for (const item of items) {
      try {
        const itemUpdates = await checkTrackedItem(item);
        totalUpdates += itemUpdates;
      } catch (e) {
        console.error(`  ❌ Error checking item ${item.id}:`, e);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Tracking check completed in ${elapsed}ms. ${totalUpdates} new updates found.\n`);

    // 推送新更新通知
    if (totalUpdates > 0) {
      const recentUpdates = await prisma.trackedItemUpdate.findMany({
        where: { isNotified: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { trackedItem: true }
      });

      for (const update of recentUpdates) {
        io.emit('tracking:update', {
          id: update.id,
          trackedItemId: update.trackedItemId,
          title: update.title,
          summary: update.aiSummary,
          action: update.aiAction,
          itemTitle: update.trackedItem.title,
          createdAt: update.createdAt
        });
        await prisma.trackedItemUpdate.update({
          where: { id: update.id },
          data: { isNotified: true }
        });
      }
    }
  } catch (error) {
    console.error('Tracking check failed:', error);
  }
}

async function checkTrackedItem(item: any): Promise<number> {
  let updateCount = 0;
  const now = new Date();

  for (const source of item.sources) {
    if (!source.isActive) continue;

    try {
      let newUpdates: { title: string; content: string; url: string; type: string }[] = [];

      switch (source.type) {
        case 'github_repo':
          newUpdates = await checkGitHubRepo(source);
          break;
        case 'rss':
          newUpdates = await checkRssFeed(source);
          break;
        case 'changelog_page':
          newUpdates = await checkChangelogPage(source);
          break;
        case 'twitter_account':
          newUpdates = await checkTwitterAccount(source);
          break;
      }

      if (newUpdates.length > 0) {
        // 保存更新记录
        for (const update of newUpdates) {
          // 用 AI 分析
          let aiResult: { summary?: string; action?: string } = {};
          try {
            aiResult = await analyzeTrackingUpdate(
              update.title + '\n' + update.content,
              item.trackingPrompt || item.keywords?.[0]?.trackingPrompt
            );
          } catch (e) {
            console.warn('AI analysis failed for tracking update:', e);
          }

          await prisma.trackedItemUpdate.create({
            data: {
              trackedItemId: item.id,
              updateType: update.type,
              title: update.title,
              content: update.content,
              aiSummary: aiResult.summary || null,
              aiAction: aiResult.action || null,
              sourceUrl: update.url
            }
          });
          updateCount++;
        }

        // 更新 source 状态
        await prisma.trackedItemSource.update({
          where: { id: source.id },
          data: { lastCheckedAt: now, lastUpdateAt: now }
        });
      } else {
        await prisma.trackedItemSource.update({
          where: { id: source.id },
          data: { lastCheckedAt: now }
        });
      }
    } catch (e) {
      console.error(`  ❌ Error checking source ${source.id} (${source.type}):`, e);
    }
  }

  if (updateCount > 0) {
    await prisma.trackedItem.update({
      where: { id: item.id },
      data: { lastCheckedAt: now, lastUpdateAt: now }
    });
  } else {
    await prisma.trackedItem.update({
      where: { id: item.id },
      data: { lastCheckedAt: now }
    });
  }

  return updateCount;
}

// ======== GitHub 检查 ========

async function checkGitHubRepo(source: any): Promise<any[]> {
  const config = source.config ? JSON.parse(source.config) : {};
  const repo = config.repo;
  if (!repo) return [];

  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await fetch(apiUrl, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'hot-track' },
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) return [];

  const release = await res.json();
  const publishedAt = new Date(release.published_at);

  // 如果是新 release
  if (!source.lastCheckedAt || publishedAt > source.lastCheckedAt) {
    // 检查是否已经记录过这个 release
    const existing = await prisma.trackedItemUpdate.findFirst({
      where: {
        trackedItemId: source.trackedItemId,
        sourceUrl: release.html_url
      }
    });
    if (existing) return [];

    return [{
      title: `Release: ${release.tag_name}`,
      content: release.body || release.name || 'No release notes',
      url: release.html_url,
      type: 'release'
    }];
  }

  return [];
}

// ======== RSS 检查 ========

async function checkRssFeed(source: any): Promise<any[]> {
  const feed = await rssParser.parseURL(source.url);
  const updates: any[] = [];

  for (const item of feed.items) {
    const pubDate = item.pubDate ? new Date(item.pubDate) : null;
    if (!pubDate) continue;
    if (source.lastCheckedAt && pubDate <= source.lastCheckedAt) continue;

    // 检查是否已记录
    const existing = await prisma.trackedItemUpdate.findFirst({
      where: {
        trackedItemId: source.trackedItemId,
        sourceUrl: item.link || ''
      }
    });
    if (existing) continue;

    updates.push({
      title: item.title || 'Untitled',
      content: item.contentSnippet || item.content || '',
      url: item.link || source.url,
      type: 'changelog'
    });
  }

  return updates;
}

// ======== Changelog 页面检查 ========

async function checkChangelogPage(source: any): Promise<any[]> {
  const config = source.config ? JSON.parse(source.config) : {};
  const selector = config.selector || 'article, .post, .changelog-item, .release-note';

  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) return [];

  const html = await res.text();
  const hash = await hashString(html);

  if (source.lastContentHash === hash) return [];

  // 更新 hash
  await prisma.trackedItemSource.update({
    where: { id: source.id },
    data: { lastContentHash: hash }
  });

  // 如果是首次检查，不生成更新（避免历史内容洪水）
  if (!source.lastCheckedAt) {
    return [];
  }

  const $ = cheerio.load(html);
  const entries = $(selector);
  const updates: any[] = [];

  entries.each((_, el) => {
    const title = $(el).find('h2, h3, .title').first().text().trim();
    const content = $(el).text().trim().slice(0, 500);
    const dateText = $(el).find('time, .date, .published').first().attr('datetime') || '';

    if (title) {
      updates.push({
        title,
        content,
        url: source.url,
        type: 'changelog'
      });
    }
  });

  return updates.slice(0, 3); // 限制数量
}

// ======== Twitter 账号检查 ========

async function checkTwitterAccount(source: any): Promise<any[]> {
  // Twitter 检查复用现有的 searchTwitter 服务
  // 由于需要 Twitter API key，这里先留空，后续接入
  // 可以通过搜索 from:account 来获取最新推文
  const config = source.config ? JSON.parse(source.config) : {};
  const account = config.account;
  if (!account) return [];

  // TODO: 接入 Twitter 搜索服务
  return [];
}

// ======== 工具函数 ========

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
