/**
 * 知识采集器
 * 从百度百科、知乎等平台采集知识点
 * 不局限于小红书，直接攒素材库
 */

import { chromium } from 'playwright';
import { initDB, factsDB, closeDB } from '../knowledge/db.js';
import type { Track, Credibility } from '../knowledge/models.js';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 冷知识搜索词
const COLD_FACTS_QUERIES = [
  '有趣的冷知识 人体',
  '你不知道的动物冷知识',
  '科学冷知识 颠覆认知',
  '历史冷知识 有趣',
  '生活冷知识 实用',
  '太空冷知识 宇宙',
  '海洋冷知识 深海',
  '食物冷知识 日常',
];

// 育儿搜索词
const PARENTING_QUERIES = [
  '新生儿护理知识 百科',
  '宝宝辅食添加 时间表',
  '婴儿睡眠训练 方法',
  '宝宝发育指标 月龄',
  '科学育儿 常见问题',
  '早教方法 0-1岁',
  '婴儿常见疾病 护理',
  '母乳喂养 知识',
];

interface KnowledgeItem {
  content: string;
  source: string;
  category: string;
}

async function searchAndExtract(page: any, query: string): Promise<KnowledgeItem[]> {
  const items: KnowledgeItem[] = [];

  try {
    // 搜索百度
    await page.goto(`https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=10`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await sleep(2000);

    // 提取搜索结果摘要
    const snippets = await page.$$eval('.c-abstract, .content-right_8Zs40, .c-span-last', (els: any[]) => {
      return els.map(el => el.textContent?.trim()).filter(t => t && t.length > 30);
    });

    for (const snippet of snippets.slice(0, 3)) {
      if (snippet.length > 50) {
        items.push({
          content: snippet.slice(0, 500),
          source: 'baidu',
          category: query.split(' ')[0],
        });
      }
    }

    // 尝试打开百度百科
    const baikeLink = await page.$('a[href*="baike.baidu.com"]');
    if (baikeLink) {
      const href = await baikeLink.getAttribute('href');
      if (href) {
        try {
          await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await sleep(1500);

          const content = await page.evaluate(() => {
            const summary = document.querySelector('.lemma-summary, .para')?.textContent?.trim();
            return summary || '';
          });

          if (content.length > 50) {
            items.push({
              content: content.slice(0, 800),
              source: 'baike',
              category: query.split(' ')[0],
            });
          }
        } catch {}
      }
    }
  } catch (err) {
    console.log(`  ❌ 搜索失败: ${err}`);
  }

  return items;
}

async function main() {
  console.log('📚 知识采集器\n');
  console.log('从百度采集知识点，充实素材库\n');

  initDB();

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  // 采集冷知识
  console.log('═'.repeat(50));
  console.log('🧊 冷知识赛道');
  console.log('═'.repeat(50));

  let coldCount = 0;
  for (const query of COLD_FACTS_QUERIES) {
    console.log(`\n🔍 ${query}`);
    const items = await searchAndExtract(page, query);

    for (const item of items) {
      factsDB.insert({
        track: 'cold_facts',
        category: item.category,
        content: item.content,
        source_url: item.source,
        credibility: 'medium' as Credibility,
        credibility_note: '来自百度搜索',
        tags: [`#${item.category}`, '#冷知识'],
        used_count: 0,
        created_at: new Date().toISOString(),
      });
      coldCount++;
    }

    console.log(`  ✅ 采集 ${items.length} 条`);
    await sleep(1000);
  }

  // 采集育儿知识
  console.log('\n' + '═'.repeat(50));
  console.log('👶 育儿赛道');
  console.log('═'.repeat(50));

  let parentCount = 0;
  for (const query of PARENTING_QUERIES) {
    console.log(`\n🔍 ${query}`);
    const items = await searchAndExtract(page, query);

    for (const item of items) {
      factsDB.insert({
        track: 'parenting',
        category: item.category,
        content: item.content,
        source_url: item.source,
        credibility: 'medium' as Credibility,
        credibility_note: '来自百度搜索',
        tags: [`#${item.category}`, '#育儿'],
        age_range: '0-3岁',
        sensitivity: 'normal',
        used_count: 0,
        created_at: new Date().toISOString(),
      });
      parentCount++;
    }

    console.log(`  ✅ 采集 ${items.length} 条`);
    await sleep(1000);
  }

  await browser.close();

  console.log('\n' + '═'.repeat(50));
  console.log('📊 采集完成!');
  console.log(`   冷知识: ${coldCount} 条 (总计 ${factsDB.count('cold_facts')})`);
  console.log(`   育儿: ${parentCount} 条 (总计 ${factsDB.count('parenting')})`);
  console.log('═'.repeat(50));

  closeDB();
}

main().catch(console.error);
