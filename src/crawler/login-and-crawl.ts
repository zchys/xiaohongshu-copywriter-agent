/**
 * 登录并采集
 * 1. 启动浏览器，等你手动登录
 * 2. 保存 Cookie
 * 3. 自动采集数据
 */

import { chromium, type BrowserContext } from 'playwright';
import fs from 'fs';
import { initDB, notesDB, closeDB } from '../knowledge/db.js';
import type { Note, Track } from '../knowledge/models.js';

const COOKIE_FILE = './data/cookies.json';
const TRACK: Track = 'cold_facts';
const KEYWORDS = ['冷知识', '涨知识', '科学冷知识', '人体冷知识', '动物冷知识'];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  return sleep(3000 + Math.random() * 5000);
}

/** 保存 Cookie */
async function saveCookies(context: BrowserContext) {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
  console.log(`\n🍪 Cookie 已保存到 ${COOKIE_FILE}`);
}

/** 加载 Cookie */
async function loadCookies(context: BrowserContext): Promise<boolean> {
  if (fs.existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
    await context.addCookies(cookies);
    console.log('🍪 已加载保存的 Cookie');
    return true;
  }
  return false;
}

/** 检查是否已登录 */
async function checkLogin(page: any): Promise<boolean> {
  try {
    await page.goto('https://www.xiaohongshu.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);
    const url = page.url();
    if (url.includes('login') || url.includes('passport')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🕷️  小红书采集器\n');

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

  // 尝试加载已保存的 Cookie
  await loadCookies(context);

  // 检查是否已登录
  let loggedIn = await checkLogin(page);

  if (!loggedIn) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 请在浏览器中手动登录小红书');
    console.log('   登录完成后，按 Enter 继续...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await page.goto('https://www.xiaohongshu.com', { waitUntil: 'domcontentloaded' });

    // 等待用户登录
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

    // 保存 Cookie
    await saveCookies(context);
    loggedIn = true;
    console.log('✅ 登录成功！开始采集...\n');
  } else {
    console.log('✅ 已有登录状态，直接开始采集\n');
  }

  // 开始采集
  let collected = 0;
  const maxNotes = 30;

  for (const keyword of KEYWORDS) {
    if (collected >= maxNotes) break;

    console.log(`\n🔍 搜索: "${keyword}"`);

    try {
      await page.goto(`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes&type=51`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      await sleep(3000);

      // 等待内容加载
      await page.waitForSelector('section.note-item, [class*="note-item"], a[href*="/explore/"]', { timeout: 10000 }).catch(() => {});

      // 滚动加载更多
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 500);
        await sleep(1000);
      }

      // 获取帖子链接
      const links = await page.$$eval('a[href*="/explore/"]', (els) => {
        return els.map(el => {
          const href = (el as HTMLAnchorElement).href;
          const match = href.match(/\/explore\/([a-f0-9]+)/);
          return match ? match[1] : null;
        }).filter(Boolean);
      });

      const uniqueLinks = [...new Set(links)].slice(0, 8);
      console.log(`  找到 ${uniqueLinks.length} 条帖子`);

      for (const noteId of uniqueLinks) {
        if (collected >= maxNotes) break;
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
            console.log(`  ✅ [${collected}/${maxNotes}] ${data.title.slice(0, 40)}... (${data.liked}赞 ${data.collected}藏)`);
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
  console.log(`📊 采集完成!`);
  console.log(`   本次采集: ${collected} 条`);
  console.log(`   数据库总数: ${notesDB.count(TRACK)}`);
  console.log('═'.repeat(50));

  closeDB();

  // 重启 Web 服务
  console.log('\n🚀 重启 Web 服务...');
  process.exit(0);
}

main().catch(console.error);
