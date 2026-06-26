/**
 * 百度采集器
 * 通过百度搜索小红书内容，安全不封号
 */

import { chromium } from 'playwright';
import { initDB, notesDB, closeDB } from '../knowledge/db.js';
import type { Note, Track } from '../knowledge/models.js';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  return sleep(2000 + Math.random() * 3000);
}

// 冷知识赛道关键词
const COLD_FACTS_QUERIES = [
  'site:xiaohongshu.com 冷知识',
  'site:xiaohongshu.com 你不知道的冷知识',
  'site:xiaohongshu.com 涨知识 科普',
  'site:xiaohongshu.com 颠覆认知 冷知识',
  'site:xiaohongshu.com 人体冷知识',
  'site:xiaohongshu.com 动物冷知识',
  'site:xiaohongshu.com 历史冷知识',
  'site:xiaohongshu.com 科学冷知识 有趣',
];

// 育儿赛道关键词
const PARENTING_QUERIES = [
  'site:xiaohongshu.com 育儿知识',
  'site:xiaohongshu.com 宝宝辅食 添加',
  'site:xiaohongshu.com 新生儿护理',
  'site:xiaohongshu.com 宝宝睡眠训练',
  'site:xiaohongshu.com 儿科医生 建议',
  'site:xiaohongshu.com 宝宝发育 月龄',
  'site:xiaohongshu.com 科学育儿',
  'site:xiaohongshu.com 早教 方法',
];

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchBaidu(page: any, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    await page.goto(`https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=20`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await sleep(2000);

    // 提取搜索结果
    const items = await page.$$eval('.result, .c-container', (els: any[]) => {
      return els.map(el => {
        const linkEl = el.querySelector('a[href*="xiaohongshu.com"]');
        const titleEl = el.querySelector('h3, .t');
        const snippetEl = el.querySelector('.c-abstract, .content-right_8Zs40');

        if (!linkEl) return null;

        return {
          title: titleEl?.textContent?.trim() || '',
          url: linkEl.href || '',
          snippet: snippetEl?.textContent?.trim() || '',
        };
      }).filter(Boolean);
    });

    results.push(...items);
  } catch (err) {
    console.log(`  ❌ 搜索失败: ${err}`);
  }

  return results;
}

async function extractNoteFromUrl(page: any, url: string): Promise<Partial<Note> | null> {
  try {
    // 提取帖子 ID
    const idMatch = url.match(/\/explore\/([a-f0-9]+)/) || url.match(/\/discovery\/item\/([a-f0-9]+)/);
    if (!idMatch) return null;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const data = await page.evaluate(() => {
      const title = document.querySelector('#detail-title, [class*="title"], .note-title')?.textContent?.trim() || '';
      const body = document.querySelector('#detail-desc, [class*="desc"], .note-text, .content')?.textContent?.trim() || '';
      const tags = Array.from(document.querySelectorAll('[class*="tag"] a, a[href*="page/topics"]')).map(el => el.textContent?.trim()).filter(Boolean);
      const liked = parseInt(document.querySelector('[class*="like"] [class*="count"], [aria-label*="赞"]')?.textContent?.replace(/[^\d]/g, '') || '0');
      const collected = parseInt(document.querySelector('[class*="collect"] [class*="count"], [aria-label*="收藏"]')?.textContent?.replace(/[^\d]/g, '') || '0');
      const commented = parseInt(document.querySelector('[class*="chat"] [class*="count"], [aria-label*="评论"]')?.textContent?.replace(/[^\d]/g, '') || '0');
      const authorName = document.querySelector('[class*="author"] [class*="name"], .username, .author-name')?.textContent?.trim() || '';

      return { title, body, tags, liked, collected, commented, authorName };
    });

    return {
      id: idMatch[1],
      ...data,
      tags: data.tags as string[],
    };
  } catch {
    return null;
  }
}

async function crawlTrack(track: Track, queries: string[]) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📚 采集赛道: ${track === 'cold_facts' ? '冷知识科普' : '育儿科普'}`);
  console.log('═'.repeat(50));

  const browser = await chromium.launch({
    headless: true,  // 无头模式，更快
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
    locale: 'zh-CN',
  });

  const page = await context.newPage();
  let collected = 0;
  const maxPerTrack = 30;

  for (const query of queries) {
    if (collected >= maxPerTrack) break;

    console.log(`\n🔍 ${query}`);

    const results = await searchBaidu(page, query);
    console.log(`  找到 ${results.length} 条结果`);

    for (const result of results) {
      if (collected >= maxPerTrack) break;
      if (!result.url.includes('xiaohongshu.com/explore/') && !result.url.includes('xiaohongshu.com/discovery/')) continue;

      // 检查是否已存在
      const idMatch = result.url.match(/\/explore\/([a-f0-9]+)/) || result.url.match(/\/discovery\/item\/([a-f0-9]+)/);
      if (idMatch && notesDB.exists(idMatch[1])) {
        console.log(`  ⏭️  已存在: ${idMatch[1]}`);
        continue;
      }

      await randomDelay();

      const noteData = await extractNoteFromUrl(page, result.url);
      if (noteData && noteData.body && noteData.body.length > 50) {
        const note: Note = {
          id: noteData.id!,
          track,
          title: noteData.title || result.title,
          body: noteData.body,
          tags: noteData.tags || [],
          author_id: '',
          author_name: noteData.authorName || '',
          author_fans: 0,
          liked: noteData.liked || 0,
          collected: noteData.collected || 0,
          commented: noteData.commented || 0,
          image_urls: [],
          publish_time: new Date().toISOString(),
          source_keyword: query,
          crawled_at: new Date().toISOString(),
          processed: 0,
        };

        notesDB.insert(note);
        collected++;
        console.log(`  ✅ [${collected}] ${note.title.slice(0, 40)}... (${note.liked}赞)`);
      }
    }
  }

  await browser.close();
  return collected;
}

async function main() {
  console.log('🕷️  百度采集器（安全模式）\n');
  console.log('通过百度搜索小红书内容，不会触发小红书反爬\n');

  initDB();

  // 采集冷知识
  const coldCount = await crawlTrack('cold_facts', COLD_FACTS_QUERIES);

  // 采集育儿
  const parentCount = await crawlTrack('parenting', PARENTING_QUERIES);

  console.log('\n' + '═'.repeat(50));
  console.log('📊 采集完成!');
  console.log(`   冷知识: ${coldCount} 条 (总计 ${notesDB.count('cold_facts')})`);
  console.log(`   育儿: ${parentCount} 条 (总计 ${notesDB.count('parenting')})`);
  console.log('═'.repeat(50));

  closeDB();
}

main().catch(console.error);
