/**
 * 小红书爬虫主逻辑
 * 负责搜索、翻页、采集帖子
 */

import type { Page } from 'playwright';
import { BrowserManager, randomDelay, humanScroll } from './browser.js';
import { parseSearchResults, parseNoteDetail, shouldKeep, calculateScore } from './parser.js';
import { notesDB } from '../knowledge/db.js';
import type { Note, Track } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════

interface SpiderConfig {
  track: Track;
  keywords: string[];
  maxNotes: number;         // 本次最大采集数
  maxPages: number;         // 每个关键词最多翻几页
  minScore: number;         // 最低入库分数
}

const DEFAULT_CONFIG: SpiderConfig = {
  track: 'cold_facts',
  keywords: ['冷知识'],
  maxNotes: 50,
  maxPages: 5,
  minScore: 50,
};

// ═══════════════════════════════════════════════════
// 爬虫类
// ═══════════════════════════════════════════════════

export class XhsSpider {
  private browser: BrowserManager;
  private config: SpiderConfig;
  private stats = {
    searched: 0,      // 搜索了几个关键词
    pagesScraped: 0,  // 翻了多少页
    notesFound: 0,    // 发现了多少帖子
    notesKept: 0,     // 入库了多少
    notesSkipped: 0,  // 跳过了多少
    errors: 0,        // 出错数
  };

  constructor(cookie: string, config: Partial<SpiderConfig> = {}) {
    this.browser = new BrowserManager(cookie);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 启动采集 */
  async run(): Promise<typeof this.stats> {
    console.log(`\n🕷️  开始采集 [${this.config.track}] 赛道`);
    console.log(`   关键词: ${this.config.keywords.join(', ')}`);
    console.log(`   目标: ${this.config.maxNotes} 条\n`);

    try {
      // 启动浏览器
      const page = await this.browser.launch();

      // 检查登录
      const loggedIn = await this.browser.checkLogin();
      if (!loggedIn) {
        console.log('❌ 未登录，停止采集');
        await this.browser.close();
        return this.stats;
      }

      // 逐个关键词采集
      for (const keyword of this.config.keywords) {
        if (this.stats.notesKept >= this.config.maxNotes) break;

        console.log(`\n🔍 搜索关键词: "${keyword}"`);
        await this.searchAndCollect(page, keyword);
        this.stats.searched++;

        // 关键词之间休息
        await randomDelay();
      }

    } catch (err) {
      console.error('采集过程出错:', err);
      this.stats.errors++;
    } finally {
      await this.browser.close();
    }

    this.printStats();
    return this.stats;
  }

  /** 搜索并采集 */
  private async searchAndCollect(page: Page, keyword: string): Promise<void> {
    // 跳转到搜索页
    const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes&type=51&sort=general`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await randomDelay();

    // 等待搜索结果加载
    await page.waitForSelector('[class*="note-item"], section.note-item', { timeout: 10000 }).catch(() => {});

    for (let pageNum = 0; pageNum < this.config.maxPages; pageNum++) {
      if (this.stats.notesKept >= this.config.maxNotes) break;

      console.log(`  📄 第 ${pageNum + 1} 页`);

      // 解析当前页的帖子列表
      const items = await parseSearchResults(page);
      this.stats.notesFound += items.length;
      console.log(`    找到 ${items.length} 条帖子`);

      // 逐条采集详情
      for (const item of items) {
        if (this.stats.notesKept >= this.config.maxNotes) break;
        if (!item.id || item.type === 'video') continue;

        // 跳过已采集的
        if (notesDB.exists(item.id)) {
          console.log(`    ⏭️  已存在: ${item.id}`);
          continue;
        }

        // 随机延迟
        await randomDelay();

        // 进入详情页
        try {
          const note = await this.collectNoteDetail(page, item.id, keyword);
          if (note) {
            const { keep, reason } = shouldKeep(note);
            if (keep) {
              const score = calculateScore(note);
              if (score >= this.config.minScore) {
                notesDB.insert(note);
                this.stats.notesKept++;
                console.log(`    ✅ 入库 [${score}分]: ${note.title.slice(0, 30)}...`);
              } else {
                this.stats.notesSkipped++;
                console.log(`    ⬇️  分数低 [${score}]: ${note.title.slice(0, 20)}...`);
              }
            } else {
              this.stats.notesSkipped++;
              console.log(`    ⏭️  跳过: ${reason}`);
            }
          }
        } catch (err) {
          console.error(`    ❌ 采集失败 ${item.id}:`, err);
          this.stats.errors++;
        }
      }

      // 翻页
      if (pageNum < this.config.maxPages - 1) {
        const hasNext = await this.scrollToNextPage(page);
        if (!hasNext) {
          console.log('  📄 没有更多页面了');
          break;
        }
        this.stats.pagesScraped++;
        await randomDelay();
      }
    }
  }

  /** 采集单条帖子详情 */
  private async collectNoteDetail(page: Page, noteId: string, keyword: string): Promise<Note | null> {
    const detailUrl = `https://www.xiaohongshu.com/explore/${noteId}`;

    // 新标签页打开（保持搜索页不丢失）
    const detailPage = await page.context().newPage();
    try {
      await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await randomDelay();

      // 模拟阅读
      await humanScroll(detailPage);

      const note = await parseNoteDetail(detailPage, noteId, this.config.track, keyword);
      return note;
    } finally {
      await detailPage.close();
    }
  }

  /** 滚动加载下一页 */
  private async scrollToNextPage(page: Page): Promise<boolean> {
    // 滚动到底部
    for (let i = 0; i < 5; i++) {
      await humanScroll(page, 800);
      await sleep(500);
    }

    // 检查是否有"加载更多"按钮
    const loadMore = await page.$('[class*="load-more"], .load-more, button:has-text("加载更多")');
    if (loadMore) {
      await loadMore.click();
      await randomDelay();
      return true;
    }

    // 检查是否有新的内容加载
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    await sleep(1000);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);

    return newHeight > currentHeight;
  }

  /** 打印统计 */
  private printStats(): void {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 采集统计');
    console.log('═'.repeat(50));
    console.log(`  搜索关键词: ${this.stats.searched}`);
    console.log(`  翻页数:     ${this.stats.pagesScraped}`);
    console.log(`  发现帖子:   ${this.stats.notesFound}`);
    console.log(`  入库:       ${this.stats.notesKept}`);
    console.log(`  跳过:       ${this.stats.notesSkipped}`);
    console.log(`  错误:       ${this.stats.errors}`);
    console.log('═'.repeat(50) + '\n');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
