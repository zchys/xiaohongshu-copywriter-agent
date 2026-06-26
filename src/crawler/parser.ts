/**
 * 页面数据解析
 * 从小红书页面 HTML 中提取结构化数据
 */

import type { Page } from 'playwright';
import type { Note, Track } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 搜索结果页解析
// ═══════════════════════════════════════════════════

export interface SearchResultItem {
  id: string;
  title: string;
  author_name: string;
  author_id: string;
  liked: number;
  cover_url: string;
  type: 'normal' | 'video';
}

/** 解析搜索结果页的帖子列表 */
export async function parseSearchResults(page: Page): Promise<SearchResultItem[]> {
  const items: SearchResultItem[] = [];

  try {
    // 等待内容加载
    await page.waitForSelector('[class*="note-item"], .feeds-page .note-item, section.note-item', {
      timeout: 10000
    }).catch(() => {});

    // 提取所有帖子卡片
    const cards = await page.$$eval(
      'section.note-item, [class*="note-item"], a[href*="/explore/"]',
      (elements) => {
        return elements.map(el => {
          const link = el.querySelector('a[href*="/explore/"]') as HTMLAnchorElement
                       || el.closest('a[href*="/explore/"]') as HTMLAnchorElement;
          const titleEl = el.querySelector('[class*="title"], .title, span.title');
          const authorEl = el.querySelector('[class*="author"], .author, [class*="name"]');
          const likeEl = el.querySelector('[class*="like"], .like-wrapper span, [class*="count"]');
          const imgEl = el.querySelector('img') as HTMLImageElement;

          // 从链接提取 ID
          const href = link?.href || '';
          const idMatch = href.match(/\/explore\/([a-f0-9]+)/);

          return {
            id: idMatch?.[1] || '',
            title: titleEl?.textContent?.trim() || '',
            author_name: authorEl?.textContent?.trim() || '',
            author_id: '',
            liked: parseInt(likeEl?.textContent?.replace(/[^\d]/g, '') || '0'),
            cover_url: imgEl?.src || '',
            type: el.querySelector('[class*="play"], svg.play') ? 'video' as const : 'normal' as const,
          };
        });
      }
    );

    for (const card of cards) {
      if (card.id) {
        items.push(card);
      }
    }
  } catch (err) {
    console.error('解析搜索结果失败:', err);
  }

  return items;
}

// ═══════════════════════════════════════════════════
// 帖子详情页解析
// ═══════════════════════════════════════════════════

/** 解析帖子详情页 */
export async function parseNoteDetail(
  page: Page,
  noteId: string,
  track: Track,
  keyword: string
): Promise<Note | null> {
  try {
    // 等待内容加载
    await page.waitForSelector('#detail-desc, [class*="desc"], .note-text', {
      timeout: 10000
    }).catch(() => {});

    // 提取数据
    const data = await page.evaluate(() => {
      // 标题
      const titleEl = document.querySelector('#detail-title, [class*="title"], .note-title');
      const title = titleEl?.textContent?.trim() || '';

      // 正文
      const descEl = document.querySelector('#detail-desc, [class*="desc"], .note-text, .content');
      const body = descEl?.textContent?.trim() || '';

      // 标签
      const tagEls = document.querySelectorAll('[class*="tag"] a, .tag-item, a[href*="page/topics"]');
      const tags = Array.from(tagEls).map(el => el.textContent?.trim()).filter(Boolean) as string[];

      // 互动数据
      const likeEl = document.querySelector('[class*="like"] [class*="count"], .like-wrapper .count, [aria-label*="赞"]');
      const collectEl = document.querySelector('[class*="collect"] [class*="count"], .collect-wrapper .count, [aria-label*="收藏"]');
      const commentEl = document.querySelector('[class*="chat"] [class*="count"], .comment-wrapper .count, [aria-label*="评论"]');

      // 博主信息
      const authorNameEl = document.querySelector('[class*="author"] [class*="name"], .author .name, .username');
      const authorIdEl = document.querySelector('[class*="author"] a[href*="/user/profile/"]') as HTMLAnchorElement;
      const fansEl = document.querySelector('[class*="fans"], .fans-count');

      // 图片
      const imgEls = document.querySelectorAll('[class*="slide-item"] img, .carousel img, .note-image img, img[src*="xhscdn"]');
      const imageUrls = Array.from(imgEls)
        .map(el => (el as HTMLImageElement).src)
        .filter(src => src && !src.includes('avatar') && !src.includes('emoji'));

      return {
        title,
        body,
        tags,
        liked: parseInt(likeEl?.textContent?.replace(/[^\d]/g, '') || '0'),
        collected: parseInt(collectEl?.textContent?.replace(/[^\d]/g, '') || '0'),
        commented: parseInt(commentEl?.textContent?.replace(/[^\d]/g, '') || '0'),
        author_name: authorNameEl?.textContent?.trim() || '',
        author_id: authorIdEl?.href?.match(/\/user\/profile\/(.+)/)?.[1] || '',
        author_fans: parseInt(fansEl?.textContent?.replace(/[^\d]/g, '') || '0'),
        image_urls: imageUrls,
      };
    });

    // 构建 Note 对象
    const note: Note = {
      id: noteId,
      track,
      title: data.title,
      body: data.body,
      tags: data.tags,
      author_id: data.author_id,
      author_name: data.author_name,
      author_fans: data.author_fans,
      liked: data.liked,
      collected: data.collected,
      commented: data.commented,
      image_urls: data.image_urls,
      publish_time: new Date().toISOString(),
      source_keyword: keyword,
      crawled_at: new Date().toISOString(),
      processed: 0,
    };

    return note;
  } catch (err) {
    console.error(`解析帖子详情失败 (${noteId}):`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════
// 数据验证和过滤
// ═══════════════════════════════════════════════════

/** 硬性过滤：这条帖子值不值得入库 */
export function shouldKeep(note: Note): { keep: boolean; reason?: string } {
  // 视频帖跳过
  // （在搜索结果层已经过滤了，这里双重保险）

  // 正文太少
  if (note.body.length < 50) {
    return { keep: false, reason: '正文少于50字' };
  }

  // 广告/营销检测
  const adKeywords = ['下单', '链接', '私信', '优惠', '折扣', '购买', '加微信', '加V', 'wx'];
  const lowerBody = note.body.toLowerCase();
  for (const kw of adKeywords) {
    if (lowerBody.includes(kw)) {
      return { keep: false, reason: `疑似广告（含"${kw}"）` };
    }
  }

  // 搬运检测
  if (/转[自查]|侵删|来源[：:]/.test(note.body)) {
    return { keep: false, reason: '疑似搬运' };
  }

  return { keep: true };
}

/** 质量评分 */
export function calculateScore(note: Note): number {
  let score = 0;

  // 互动数据
  if (note.liked >= 1000) score += 30;
  if (note.liked >= 5000) score += 20;
  if (note.collected >= 500) score += 20;

  // 收藏/点赞比（> 0.5 说明是干货）
  if (note.liked > 0) {
    const saveRatio = note.collected / note.liked;
    if (saveRatio > 0.5) score += 15;
  }

  // 低粉爆文（最有参考价值）
  if (note.author_fans < 10000 && note.liked > 1000) {
    score += 25;
  }

  return score;
}
