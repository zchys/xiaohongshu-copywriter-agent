/**
 * Playwright 浏览器管理
 * 负责浏览器启动、反检测、Cookie 注入
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

// ═══════════════════════════════════════════════════
// User-Agent 池
// ═══════════════════════════════════════════════════

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
];

// ═══════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomViewport() {
  return {
    width: 1200 + Math.floor(Math.random() * 720),   // 1200~1920
    height: 800 + Math.floor(Math.random() * 280),    // 800~1080
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 随机延迟 3~8秒（模拟真人） */
export function randomDelay(): Promise<void> {
  const min = parseInt(process.env.CRAWL_INTERVAL_MIN || '3000');
  const max = parseInt(process.env.CRAWL_INTERVAL_MAX || '8000');
  const ms = min + Math.floor(Math.random() * (max - min));
  return sleep(ms);
}

/** 模拟鼠标移动（贝塞尔曲线） */
async function humanMouseMove(page: Page, x: number, y: number): Promise<void> {
  const steps = 5 + Math.floor(Math.random() * 10);
  const startX = Math.random() * 100;
  const startY = Math.random() * 100;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // 简单的贝塞尔插值
    const cx = startX + (x - startX) * t + Math.random() * 5;
    const cy = startY + (y - startY) * t + Math.random() * 5;
    await page.mouse.move(cx, cy);
    await sleep(10 + Math.random() * 30);
  }
  await page.mouse.move(x, y);
}

/** 模拟滚动（有停顿，模拟阅读） */
export async function humanScroll(page: Page, distance?: number): Promise<void> {
  const scrollDist = distance || 300 + Math.floor(Math.random() * 500);
  const steps = 3 + Math.floor(Math.random() * 5);

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, scrollDist / steps);
    await sleep(200 + Math.random() * 500);
  }
  // 阅读停顿
  await sleep(500 + Math.random() * 1500);
}

// ═══════════════════════════════════════════════════
// 浏览器管理类
// ═══════════════════════════════════════════════════

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cookieStr: string;

  constructor(cookie: string) {
    this.cookieStr = cookie;
  }

  /** 启动浏览器 */
  async launch(): Promise<Page> {
    console.log('🚀 启动浏览器...');

    this.browser = await chromium.launch({
      headless: false,   // 有头模式更像真人
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
      ]
    });

    const viewport = randomViewport();

    this.context = await this.browser.newContext({
      userAgent: randomUA(),
      viewport,
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      // 防止 webdriver 检测
      javaScriptEnabled: true,
    });

    // 注入反检测脚本
    await this.context.addInitScript(() => {
      // 隐藏 webdriver 标记
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // 伪造 plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // 伪造 languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
      });

      // 隐藏自动化相关属性
      (window as any).chrome = { runtime: {} };

      // 覆盖 permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    });

    this.page = await this.context.newPage();

    // 注入 Cookie
    await this.injectCookies();

    console.log(`✅ 浏览器启动完成 (${viewport.width}x${viewport.height})`);
    return this.page;
  }

  /** 注入 Cookie */
  private async injectCookies(): Promise<void> {
    if (!this.context || !this.cookieStr) return;

    const cookies = this.parseCookieString(this.cookieStr);
    if (cookies.length > 0) {
      await this.context.addCookies(cookies);
      console.log(`🍪 已注入 ${cookies.length} 个 Cookie`);
    }
  }

  /** 解析 Cookie 字符串 */
  private parseCookieString(cookieStr: string): any[] {
    return cookieStr.split(';').map(pair => {
      const [name, ...rest] = pair.trim().split('=');
      return {
        name: name.trim(),
        value: rest.join('=').trim(),
        domain: '.xiaohongshu.com',
        path: '/',
      };
    }).filter(c => c.name && c.value);
  }

  /** 检查登录状态 */
  async checkLogin(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto('https://www.xiaohongshu.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      await sleep(2000);

      // 检查是否跳转到登录页
      const url = this.page.url();
      if (url.includes('login') || url.includes('passport')) {
        console.log('❌ Cookie 已过期，需要更新');
        return false;
      }

      // 检查页面是否有用户头像（已登录标志）
      const hasAvatar = await this.page.locator('.user-avatar, .avatar, [class*="avatar"]').count();
      if (hasAvatar > 0) {
        console.log('✅ 登录状态正常');
        return true;
      }

      // 再检查一下是否能访问个人主页
      console.log('⚠️ 登录状态不确定，尝试继续');
      return true;
    } catch (err) {
      console.error('检查登录状态失败:', err);
      return false;
    }
  }

  /** 获取当前页面 */
  getPage(): Page {
    if (!this.page) throw new Error('浏览器未启动，请先调用 launch()');
    return this.page;
  }

  /** 截图保存（用于调试） */
  async screenshot(name: string): Promise<void> {
    if (!this.page) return;
    const path = `./data/screenshots/${name}-${Date.now()}.png`;
    await this.page.screenshot({ path, fullPage: false });
    console.log(`📸 截图已保存: ${path}`);
  }

  /** 关闭浏览器 */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log('🔴 浏览器已关闭');
    }
  }
}
