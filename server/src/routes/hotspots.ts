import { Router } from 'express';
import { prisma } from '../db.js';
import { sortHotspots } from '../utils/sortHotspots.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      source, 
      importance,
      keywordId,
      isReal,
      timeRange,
      timeFrom,
      timeTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (source) where.source = source;
    if (importance) where.importance = importance;
    if (keywordId) where.keywordId = keywordId;
    if (isReal !== undefined && isReal !== '') {
      where.isReal = isReal === 'true';
    }

    if (timeRange) {
      const now = new Date();
      let dateFrom: Date | null = null;
      switch (timeRange) {
        case '1h': dateFrom = new Date(now.getTime() - 60 * 60 * 1000); break;
        case 'today': dateFrom = new Date(now); dateFrom.setHours(0, 0, 0, 0); break;
        case '7d': dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      }
      if (dateFrom) where.createdAt = { gte: dateFrom };
    } else if (timeFrom || timeTo) {
      where.createdAt = {};
      if (timeFrom) where.createdAt.gte = new Date(timeFrom as string);
      if (timeTo) where.createdAt.lte = new Date(timeTo as string);
    }

    let orderBy: any;
    const sort = sortBy as string;
    const order = (sortOrder as string) === 'asc' ? 'asc' : 'desc';
    const needsMemorySort = sort === 'importance' || sort === 'hot';

    switch (sort) {
      case 'publishedAt': orderBy = [{ publishedAt: order }, { createdAt: 'desc' }]; break;
      case 'relevance': orderBy = { relevance: order }; break;
      case 'importance':
      case 'hot': orderBy = { createdAt: 'desc' }; break;
      default: orderBy = { createdAt: order }; break;
    }

    const [rawHotspots, total] = await Promise.all([
      prisma.hotspot.findMany({
        where, orderBy,
        ...(needsMemorySort ? {} : { skip, take: limitNum }),
        include: { keyword: { select: { id: true, text: true, category: true } } }
      }),
      prisma.hotspot.count({ where })
    ]);

    let hotspots;
    if (needsMemorySort) {
      hotspots = sortHotspots(rawHotspots, sort, order as 'asc' | 'desc').slice(skip, skip + limitNum);
    } else {
      hotspots = rawHotspots;
    }

    res.json({
      data: hotspots,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching hotspots:', error);
    res.status(500).json({ error: 'Failed to fetch hotspots' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [total, todayCount, urgent, sourceStats] = await Promise.all([
      prisma.hotspot.count(),
      prisma.hotspot.count({ where: { createdAt: { gte: today } } }),
      prisma.hotspot.count({ where: { importance: 'urgent' } }),
      prisma.hotspot.groupBy({ by: ['source'], _count: { source: true } })
    ]);
    res.json({
      total, today: todayCount, urgent,
      bySource: sourceStats.reduce((acc: Record<string, number>, item: any) => {
        acc[item.source] = item._count.source; return acc;
      }, {})
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const hotspot = await prisma.hotspot.findUnique({
      where: { id: req.params.id },
      include: { keyword: true }
    });
    if (!hotspot) return res.status(404).json({ error: 'Hotspot not found' });
    res.json(hotspot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hotspot' });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { query, sources = ['twitter', 'bing'] } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const { searchTwitter } = await import('../services/twitter.js');
    const { searchBing } = await import('../services/search.js');
    const { analyzeContent } = await import('../services/ai.js');

    const results: any[] = [];
    if (sources.includes('twitter')) {
      try { results.push(...await searchTwitter(query)); } catch (e) { console.error('Twitter search failed:', e); }
    }
    if (sources.includes('bing')) {
      try { results.push(...await searchBing(query)); } catch (e) { console.error('Bing search failed:', e); }
    }

    const analyzedResults = await Promise.all(
      results.slice(0, 10).map(async (item) => {
        try {
          const analysis = await analyzeContent(item.title + ' ' + item.content, query);
          return { ...item, analysis };
        } catch { return { ...item, analysis: null }; }
      })
    );

    res.json({ results: analyzedResults });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search hotspots' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.hotspot.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Hotspot not found' });
    res.status(500).json({ error: 'Failed to delete hotspot' });
  }
});

export default router;
