/**
 * Web API 服务器
 * 为前端提供 REST API
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import {
  initDB, closeDB,
  notesDB, patternsDB, factsDB, generationsDB, imageStylesDB
} from '../knowledge/db.js';
import { generatePost, type GenerateRequest } from '../generator/agent.js';
import type { Track } from '../knowledge/models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json());

// 静态文件（前端构建产物）
app.use(express.static(path.join(__dirname, '../../web/dist')));

// ═══════════════════════════════════════════════════
// API 路由
// ═══════════════════════════════════════════════════

// --- 统计数据 ---

app.get('/api/stats', (_req, res) => {
  try {
    const stats = {
      cold_facts: {
        notes: notesDB.count('cold_facts'),
        patterns: patternsDB.count('cold_facts'),
        facts: factsDB.count('cold_facts'),
        generations: generationsDB.getRecent('cold_facts', 9999).length,
      },
      parenting: {
        notes: notesDB.count('parenting'),
        patterns: patternsDB.count('parenting'),
        facts: factsDB.count('parenting'),
        generations: generationsDB.getRecent('parenting', 9999).length,
      },
      total: {
        notes: notesDB.count(),
        patterns: patternsDB.count(),
        facts: factsDB.count(),
      }
    };
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 生成历史趋势 ---

app.get('/api/stats/trend', (req, res) => {
  try {
    const track = (req.query.track as Track) || 'cold_facts';
    const days = parseInt(req.query.days as string) || 30;

    const generations = generationsDB.getRecent(track, 9999);

    // 按日期分组
    const trend: Record<string, number> = {};
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend[key] = 0;
    }

    for (const gen of generations) {
      const date = gen.created_at?.slice(0, 10);
      if (date && trend[date] !== undefined) {
        trend[date]++;
      }
    }

    // 转换为数组
    const result = Object.entries(trend)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 知识点分类分布 ---

app.get('/api/stats/categories', (req, res) => {
  try {
    const track = (req.query.track as Track) || 'cold_facts';
    const facts = factsDB.getRandom(track, 9999);

    const categories: Record<string, number> = {};
    for (const fact of facts) {
      categories[fact.category] = (categories[fact.category] || 0) + 1;
    }

    const result = Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 生成文案 ---

app.post('/api/generate', async (req, res) => {
  try {
    const { track, topic, angle, emotion, category } = req.body;

    if (!track || !topic) {
      return res.status(400).json({ error: '请提供 track 和 topic' });
    }

    const request: GenerateRequest = {
      track: track as Track,
      topic,
      angle,
      emotion,
      category,
    };

    const post = await generatePost(request);
    res.json(post);
  } catch (err: any) {
    console.error('生成失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- 生成历史 ---

app.get('/api/generations', (req, res) => {
  try {
    const track = req.query.track as Track | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    let generations: any[];
    if (track) {
      generations = generationsDB.getRecent(track, limit);
    } else {
      const cold = generationsDB.getRecent('cold_facts', limit);
      const parent = generationsDB.getRecent('parenting', limit);
      generations = [...cold, ...parent]
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .slice(0, limit);
    }

    // 解析 output JSON
    const result = generations.map(gen => ({
      ...gen,
      output: JSON.parse(gen.output),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 评分 ---

app.post('/api/generations/:id/rate', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rating, note } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: '评分必须在 1~5 之间' });
    }

    generationsDB.rate(id, rating, note);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 套路列表 ---

app.get('/api/patterns', (req, res) => {
  try {
    const track = (req.query.track as Track) || 'cold_facts';
    const patterns = patternsDB.getTopPatterns(track, 100);
    res.json(patterns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 知识点列表 ---

app.get('/api/facts', (req, res) => {
  try {
    const track = (req.query.track as Track) || 'cold_facts';
    const category = req.query.category as string;
    const limit = parseInt(req.query.limit as string) || 50;

    let facts;
    if (category) {
      facts = factsDB.getByCategory(track, category, limit);
    } else {
      facts = factsDB.getRandom(track, limit);
    }
    res.json(facts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- SPA fallback ---

app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
});

// ═══════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════

initDB();

app.listen(PORT, () => {
  console.log(`
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   🚀 小红书文案智能体                                    │
│                                                          │
│   前端地址: http://localhost:${PORT}                       │
│   API 地址: http://localhost:${PORT}/api                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
  `);
});

// 优雅关闭
process.on('SIGINT', () => {
  closeDB();
  process.exit(0);
});
