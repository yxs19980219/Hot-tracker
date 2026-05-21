import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// 获取所有设置
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc: Record<string, string>, item: { key: string; value: string }) => {
      let value = item.value;
      // 脱敏 API Key
      if (item.key === 'deepseekApiKey' && value.length > 12) {
        value = value.slice(0, 6) + '****' + value.slice(-4);
      }
      acc[item.key] = value;
      return acc;
    }, {} as Record<string, string>);

    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// 更新设置
router.put('/', async (req, res) => {
  try {
    const settings = req.body;

    if (typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }

    const updates = Object.entries(settings).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    );

    await Promise.all(updates);

    // 同步 API Key 到运行时环境
    if (settings.deepseekApiKey !== undefined) {
      if (settings.deepseekApiKey) {
        process.env.DEEPSEEK_API_KEY = String(settings.deepseekApiKey);
      } else {
        delete process.env.DEEPSEEK_API_KEY;
      }
    }

    res.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 检查 AI 服务可用性
router.get('/check-ai', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.json({ configured: false, ok: false, message: '未配置 DeepSeek API Key' });
    }
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (response.ok) {
      res.json({ configured: true, ok: true, message: 'AI 服务连接正常' });
    } else {
      res.json({ configured: true, ok: false, message: `AI 服务异常: ${response.status}` });
    }
  } catch (error) {
    res.json({ configured: !!process.env.DEEPSEEK_API_KEY, ok: false, message: '网络错误，无法连接 DeepSeek' });
  }
});

// 获取单个设置
router.get('/:key', async (req, res) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: req.params.key }
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// 更新单个设置
router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const setting = await prisma.setting.upsert({
      where: { key: req.params.key },
      update: { value: String(value) },
      create: { key: req.params.key, value: String(value) }
    });

    // 同步 API Key 到运行时环境
    if (req.params.key === 'deepseekApiKey') {
      if (value) {
        process.env.DEEPSEEK_API_KEY = String(value);
      } else {
        delete process.env.DEEPSEEK_API_KEY;
      }
    }

    res.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});


export default router;
