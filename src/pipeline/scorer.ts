/**
 * 质量评分
 * 对帖子和知识点做质量评估
 */

import type { Note, Fact } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 帖子质量评分
// ═══════════════════════════════════════════════════

export function scoreNote(note: Note): number {
  let score = 0;

  // 互动数据权重
  if (note.liked >= 100) score += 10;
  if (note.liked >= 500) score += 15;
  if (note.liked >= 1000) score += 20;
  if (note.liked >= 5000) score += 10;
  if (note.liked >= 10000) score += 10;

  // 收藏权重（干货指标）
  if (note.collected >= 100) score += 10;
  if (note.collected >= 500) score += 15;

  // 收藏/点赞比
  if (note.liked > 0) {
    const ratio = note.collected / note.liked;
    if (ratio > 0.3) score += 5;
    if (ratio > 0.5) score += 10;
    if (ratio > 1.0) score += 5;  // 收藏超过点赞，极度干货
  }

  // 低粉爆文加分（更有参考价值）
  if (note.author_fans < 5000 && note.liked > 1000) score += 20;
  else if (note.author_fans < 10000 && note.liked > 1000) score += 10;

  // 内容长度（太短不好，太长也不好）
  const bodyLen = note.body.length;
  if (bodyLen >= 100 && bodyLen <= 800) score += 10;
  if (bodyLen > 800 && bodyLen <= 1500) score += 5;

  // 标签数量
  if (note.tags.length >= 3 && note.tags.length <= 8) score += 5;

  return Math.min(score, 100);
}

// ═══════════════════════════════════════════════════
// 知识点质量评分
// ═══════════════════════════════════════════════════

export function scoreFact(fact: Fact): number {
  let score = 0;

  // 可信度
  switch (fact.credibility) {
    case 'high': score += 40; break;
    case 'medium': score += 20; break;
    case 'low': score += 5; break;
  }

  // 内容长度（太短可能信息不足）
  if (fact.content.length > 30) score += 10;
  if (fact.content.length > 80) score += 10;

  // 有来源
  if (fact.source_url) score += 15;
  if (fact.source_note_id) score += 5;

  // 有标签
  if (fact.tags.length > 0) score += 10;

  // 育儿赛道额外加分
  if (fact.track === 'parenting') {
    if (fact.sensitivity === 'normal') score += 10;
    if (fact.age_range) score += 10;
  }

  return Math.min(score, 100);
}
