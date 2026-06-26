/**
 * 采集调度器
 * 负责定时采集、配置管理
 */

import 'dotenv/config';
import fs from 'fs';
import yaml from 'js-yaml';
import { XhsSpider } from './spider.js';
import { initDB, closeDB, notesDB } from '../knowledge/db.js';
import type { Track } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 关键词配置
// ═══════════════════════════════════════════════════

interface KeywordConfig {
  cold_facts: string[];
  parenting: string[];
}

function loadKeywords(): KeywordConfig {
  const configPath = './config/keywords.yaml';
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.load(content) as KeywordConfig;
  }

  // 默认关键词
  return {
    cold_facts: [
      '冷知识', '你不知道的事', '涨知识', '科学冷知识',
      '历史冷知识', '动物冷知识', '人体冷知识', '颠覆认知',
      '有趣冷知识', '生活冷知识'
    ],
    parenting: [
      '育儿', '新生儿护理', '辅食添加', '宝宝发育',
      '儿科医生', '宝妈必看', '睡眠训练', '早教',
      '婴儿护理', '育儿科普'
    ]
  };
}

// ═══════════════════════════════════════════════════
// 调度逻辑
// ═══════════════════════════════════════════════════

async function runCrawler(track: Track) {
  const cookie = process.env.XHS_COOKIE;
  if (!cookie) {
    console.error('❌ 请在 .env 中设置 XHS_COOKIE');
    process.exit(1);
  }

  const keywords = loadKeywords();
  const trackKeywords = keywords[track] || [];

  if (trackKeywords.length === 0) {
    console.error(`❌ 没有为 ${track} 配置关键词`);
    process.exit(1);
  }

  // 初始化数据库
  initDB();

  console.log(`\n📋 ${track} 赛道数据库状态:`);
  console.log(`   已有帖子: ${notesDB.count(track)}`);

  // 每次随机选几个关键词（避免重复采集同一组）
  const shuffled = trackKeywords.sort(() => Math.random() - 0.5);
  const selectedKeywords = shuffled.slice(0, Math.min(3, shuffled.length));

  const spider = new XhsSpider(cookie, {
    track,
    keywords: selectedKeywords,
    maxNotes: parseInt(process.env.CRAWL_BATCH_SIZE || '30'),
    maxPages: 3,
    minScore: 50,
  });

  const stats = await spider.run();

  console.log(`\n📋 采集后数据库状态:`);
  console.log(`   总帖子数: ${notesDB.count()}`);
  console.log(`   ${track}: ${notesDB.count(track)}`);

  closeDB();
}

// ═══════════════════════════════════════════════════
// 命令行入口
// ═══════════════════════════════════════════════════

const track = process.argv[2] as Track || 'cold_facts';

if (!['cold_facts', 'parenting'].includes(track)) {
  console.error('用法: npm run crawl [cold_facts|parenting]');
  process.exit(1);
}

runCrawler(track).catch(err => {
  console.error('采集器启动失败:', err);
  process.exit(1);
});
