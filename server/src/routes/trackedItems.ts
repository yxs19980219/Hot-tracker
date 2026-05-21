import { Router } from 'express';
import { prisma } from '../db.js';
import { normalizeUrl, detectUrlType, extractGitHubRepo } from '../services/urlNormalizer.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const items = await prisma.trackedItem.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        sources: true,
        _count: { select: { updates: true } }
      }
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching tracked items:', error);
    res.status(500).json({ error: 'Failed to fetch tracked items' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.trackedItem.findUnique({
      where: { id: req.params.id },
      include: {
        sources: true,
        updates: { orderBy: { createdAt: 'desc' }, take: 50 },
        keywords: { select: { id: true, text: true } }
      }
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracked item' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { url, title, note, trackingPrompt, keywordIds } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const normalized = normalizeUrl(url);
    const detectedType = detectUrlType(url);

    const existing = await prisma.trackedItem.findUnique({
      where: { canonicalUrl: normalized.canonicalUrl }
    });
    if (existing) {
      return res.status(409).json({ error: 'Already tracked', item: existing });
    }

    const item = await prisma.trackedItem.create({
      data: {
        title: title || normalized.title || url,
        canonicalUrl: normalized.canonicalUrl,
        url,
        note: note?.trim() || null,
        trackingPrompt: trackingPrompt?.trim() || null,
        ...(keywordIds?.length && {
          keywords: { connect: keywordIds.map((id: string) => ({ id })) }
        })
      },
      include: { sources: true }
    });

    await autoBindSource(item.id, detectedType, normalized);
    res.status(201).json(item);
  } catch (error: any) {
    console.error('Error creating tracked item:', error);
    res.status(500).json({ error: 'Failed to create tracked item' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, note, trackingPrompt, isActive, keywordIds } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (note !== undefined) data.note = note?.trim() || null;
    if (trackingPrompt !== undefined) data.trackingPrompt = trackingPrompt?.trim() || null;
    if (isActive !== undefined) data.isActive = isActive;
    if (keywordIds !== undefined) data.keywords = { set: keywordIds.map((id: string) => ({ id })) };

    const item = await prisma.trackedItem.update({
      where: { id: req.params.id },
      data,
      include: { sources: true, keywords: true }
    });
    res.json(item);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to update tracked item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.trackedItem.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: 'Failed to delete tracked item' });
  }
});

router.get('/:id/updates', async (req, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const updates = await prisma.trackedItemUpdate.findMany({
      where: { trackedItemId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });
    res.json(updates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const item = await prisma.trackedItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.trackedItem.update({
      where: { id: req.params.id },
      data: { isActive: !item.isActive }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle tracked item' });
  }
});

async function autoBindSource(trackedItemId: string, type: string, normalized: { canonicalUrl: string }) {
  try {
    if (type === 'github') {
      const repo = extractGitHubRepo(normalized.canonicalUrl);
      if (repo) {
        await prisma.trackedItemSource.create({
          data: {
            trackedItemId,
            type: 'github_repo',
            url: `https://api.github.com/repos/${repo}`,
            config: JSON.stringify({ repo })
          }
        });
      }
    } else {
      const base = new URL(normalized.canonicalUrl).origin;
      const rssUrl = await probeRss(base);
      if (rssUrl) {
        await prisma.trackedItemSource.create({
          data: {
            trackedItemId,
            type: 'rss',
            url: rssUrl,
            config: JSON.stringify({ autoDetected: true })
          }
        });
      } else {
        await prisma.trackedItemSource.create({
          data: {
            trackedItemId,
            type: 'changelog_page',
            url: normalized.canonicalUrl,
            config: JSON.stringify({ selector: 'article, .post, .changelog-item', autoDetected: true })
          }
        });
      }
    }
  } catch (e) {
    console.warn('Auto-bind source failed:', e);
  }
}

async function probeRss(baseUrl: string): Promise<string | null> {
  const candidates = [
    `${baseUrl}/rss.xml`,
    `${baseUrl}/feed.xml`,
    `${baseUrl}/feed`,
    `${baseUrl}/blog/rss.xml`,
    `${baseUrl}/news/rss.xml`
  ];
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && (ct.includes('xml') || ct.includes('rss'))) return candidate;
    } catch { /* ignore */ }
  }
  return null;
}

export default router;
