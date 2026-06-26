/**
 * 知识库检索
 * 为生成模块提供套路和素材检索
 */

import { patternsDB, factsDB, notesDB } from './db.js';
import type { Track, Pattern, Fact, PatternType } from './models.js';

// ═══════════════════════════════════════════════════
// 检索上下文（注入到 prompt 中）
// ═══════════════════════════════════════════════════

export interface RetrievalContext {
  patterns: Pattern[];           // 参考套路
  facts: Fact[];                 // 可用素材
  similarNotes: string[];        // 相似爆款的结构分析摘要
}

/**
 * 根据用户输入，检索相关的套路和素材
 */
export function retrieveContext(
  track: Track,
  topic: string,
  angle?: string,
  category?: string
): RetrievalContext {
  // 1. 检索相关套路（取 top 高分的）
  const patterns: Pattern[] = [];

  // 标题公式
  const titlePatterns = patternsDB.getByType(track, 'title_formula');
  patterns.push(...titlePatterns.slice(0, 3));

  // 开头钩子
  const hooks = patternsDB.getByType(track, 'hook');
  patterns.push(...hooks.slice(0, 2));

  // 正文结构
  const structures = patternsDB.getByType(track, 'structure');
  patterns.push(...structures.slice(0, 2));

  // 互动引导
  const ctas = patternsDB.getByType(track, 'cta');
  patterns.push(...ctas.slice(0, 2));

  // 2. 检索相关知识点
  let facts: Fact[] = [];

  if (category) {
    // 按分类检索
    facts = factsDB.getByCategory(track, category, 5);
  }

  if (facts.length < 3) {
    // 补充关键词检索
    const keywordResults = factsDB.search(track, topic, 5);
    const existingIds = new Set(facts.map(f => f.id));
    facts.push(...keywordResults.filter(f => !existingIds.has(f.id)));
  }

  if (facts.length < 3) {
    // 再补充随机高可信度素材
    const randomFacts = factsDB.getRandom(track, 3);
    const existingIds = new Set(facts.map(f => f.id));
    facts.push(...randomFacts.filter(f => !existingIds.has(f.id)));
  }

  // 限制总数
  facts = facts.slice(0, 5);

  // 3. 获取相似爆款的结构分析（如果有已提炼的笔记）
  const similarNotes = getSimilarNotesSummary(track, topic);

  return { patterns, facts, similarNotes };
}

/**
 * 获取相似爆款的结构摘要
 * 从已处理的高赞帖子中提取结构特征
 */
function getSimilarNotesSummary(track: Track, topic: string): string[] {
  const topNotes = notesDB.getTopNotes(track, 10);
  const summaries: string[] = [];

  for (const note of topNotes.slice(0, 3)) {
    const summary = analyzeNoteStructure(note.title, note.body);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

/**
 * 分析帖子结构（简单版本，后续可用 AI 增强）
 */
function analyzeNoteStructure(title: string, body: string): string | null {
  if (!title || !body) return null;

  const parts: string[] = [];

  // 分析标题特征
  if (/\d+/.test(title)) parts.push('标题含数字');
  if (/[？?！!]/.test(title)) parts.push('标题含标点强调');
  if (title.length <= 15) parts.push('标题简短有力');

  // 分析正文特征
  const paragraphs = body.split(/\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length <= 5) parts.push('段落数少，节奏快');
  if (paragraphs.length > 5) parts.push('段落多，内容详实');

  // 检查是否有 emoji
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
  if (emojiRegex.test(body)) parts.push('使用emoji增加可读性');

  // 检查开头方式
  const firstLine = paragraphs[0]?.trim() || '';
  if (/[？?]/.test(firstLine)) parts.push('提问式开头');
  if (/你知道|你猜|你以为/.test(firstLine)) parts.push('互动式开头');

  return parts.length > 0
    ? `「${title.slice(0, 20)}」→ ${parts.join('；')}`
    : null;
}

/**
 * 格式化检索上下文为 prompt 注入文本
 */
export function formatContextForPrompt(ctx: RetrievalContext): string {
  const parts: string[] = [];

  if (ctx.patterns.length > 0) {
    parts.push('【参考爆款套路】');
    for (const p of ctx.patterns) {
      parts.push(`- [${p.label}] ${p.description}`);
    }
    parts.push('');
  }

  if (ctx.facts.length > 0) {
    parts.push('【可用素材】');
    for (const f of ctx.facts) {
      const cred = f.credibility === 'high' ? '✅' : f.credibility === 'medium' ? '⚠️' : '❓';
      parts.push(`${cred} ${f.content}`);
      if (f.source_note_id) {
        parts.push(`   来源: ${f.source_note_id}`);
      }
    }
    parts.push('');
  }

  if (ctx.similarNotes.length > 0) {
    parts.push('【同类爆款结构特征】');
    for (const s of ctx.similarNotes) {
      parts.push(`- ${s}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}
