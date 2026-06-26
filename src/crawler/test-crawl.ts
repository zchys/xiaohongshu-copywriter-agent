/**
 * 测试爬虫 - 不需要登录，先试试能抓到什么
 */

import { chromium } from 'playwright';
import { initDB, notesDB, closeDB } from '../knowledge/db.js';
import type { Note, Track } from '../knowledge/models.js';

const TRACK: Track = 'cold_facts';
const KEYWORDS = ['冷知识', '涨知识', '科学冷知识'];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  return sleep(3000 + Math.random() * 5000);
}

async function testCrawl() {
  console.log('🕷️  启动测试爬虫...\n');

  initDB();

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
    locale: 'zh-CN',
  });

  // 反检测
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  let collected = 0;

  for (const keyword of KEYWORDS) {
    if (collected >= 20) break;

    console.log(`\n🔍 搜索: "${keyword}"`);

    try {
      await page.goto(`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      await sleep(3000);

      // 等待内容加载
      await page.waitForSelector('section.note-item, [class*="note-item"], a[href*="/explore/"]', { timeout: 10000 }).catch(() => {});

      // 获取帖子链接
      const links = await page.$$eval('a[href*="/explore/"]', (els) => {
        return els.map(el => {
          const href = (el as HTMLAnchorElement).href;
          const match = href.match(/\/explore\/([a-f0-9]+)/);
          return match ? match[1] : null;
        }).filter(Boolean);
      });

      const uniqueLinks = [...new Set(links)].slice(0, 5);
      console.log(`  找到 ${uniqueLinks.length} 条帖子`);

      for (const noteId of uniqueLinks) {
        if (collected >= 20) break;
        if (!noteId || notesDB.exists(noteId)) continue;

        await randomDelay();

        try {
          const notePage = await context.newPage();
          await notePage.goto(`https://www.xiaohongshu.com/explore/${noteId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          });

          await sleep(2000);

          // 提取数据
          const data = await notePage.evaluate(() => {
            const title = document.querySelector('#detail-title, [class*="title"]')?.textContent?.trim() || '';
            const body = document.querySelector('#detail-desc, [class*="desc"], .note-text')?.textContent?.trim() || '';
            const tags = Array.from(document.querySelectorAll('[class*="tag"] a, a[href*="page/topics"]')).map(el => el.textContent?.trim()).filter(Boolean) as string[];
            const liked = parseInt(document.querySelector('[class*="like"] [class*="count"]')?.textContent?.replace(/[^\d]/g, '') || '0');
            const collected = parseInt(document.querySelector('[class*="collect"] [class*="count"]')?.textContent?.replace(/[^\d]/g, '') || '0');
            const commented = parseInt(document.querySelector('[class*="chat"] [class*="count"]')?.textContent?.replace(/[^\d]/g, '') || '0');
            const authorName = document.querySelector('[class*="author"] [class*="name"], .username')?.textContent?.trim() || '';

            return { title, body, tags, liked, collected, commented, authorName };
          });

          if (data.body.length > 50) {
            const note: Note = {
              id: noteId,
              track: TRACK,
              title: data.title,
              body: data.body,
              tags: data.tags,
              author_id: '',
              author_name: data.authorName,
              author_fans: 0,
              liked: data.liked,
              collected: data.collected,
              commented: data.commented,
              image_urls: [],
              publish_time: new Date().toISOString(),
              source_keyword: keyword,
              crawled_at: new Date().toISOString(),
              processed: 0,
            };

            notesDB.insert(note);
            collected++;
            console.log(`  ✅ [${collected}] ${data.title.slice(0, 40)}... (${data.liked}赞)`);
          } else {
            console.log(`  ⏭️  跳过: 内容太短`);
          }

          await notePage.close();
        } catch (err) {
          console.log(`  ❌ 采集失败: ${noteId}`);
        }
      }
    } catch (err) {
      console.log(`  ❌ 搜索失败: ${err}`);
    }
  }

  await browser.close();

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 采集完成: ${collected} 条帖子`);
  console.log(`   数据库总数: ${notesDB.count(TRACK)}`);
  console.log('═'.repeat(50));

  closeDB();
}

testCrawl().catch(console.error);
