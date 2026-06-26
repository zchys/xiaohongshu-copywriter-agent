/**
 * 数据清洗
 * 对采集到的原始帖子做预处理
 */

import type { Note } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 清洗规则
// ═══════════════════════════════════════════════════

/** 清洗单条帖子，返回清洗后的版本 */
export function cleanNote(note: Note): Note {
  return {
    ...note,
    title: cleanTitle(note.title),
    body: cleanBody(note.body),
    tags: cleanTags(note.tags),
  };
}

/** 清洗标题 */
function cleanTitle(title: string): string {
  if (!title) return '';

  return title
    // 去除多余空白
    .replace(/\s+/g, ' ')
    // 去除特殊Unicode字符（emoji保留）
    .replace(/[​-‍﻿]/g, '')
    .trim();
}

/** 清洗正文 */
function cleanBody(body: string): string {
  if (!body) return '';

  return body
    // 统一换行符
    .replace(/\r\n/g, '\n')
    // 多个空行合并为一个
    .replace(/\n{3,}/g, '\n\n')
    // 去除行首行尾空白
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // 去除特殊Unicode字符
    .replace(/[​-‍﻿]/g, '')
    .trim();
}

/** 清洗标签 */
function cleanTags(tags: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];

  return tags
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0 && tag.length < 30)  // 去除过长的标签
    .map(tag => tag.startsWith('#') ? tag : `#${tag}`)  // 确保有 # 前缀
    .filter((tag, index, self) => self.indexOf(tag) === index);  // 去重
}

// ═══════════════════════════════════════════════════
// 批量清洗
// ═══════════════════════════════════════════════════

export function cleanNotes(notes: Note[]): Note[] {
  return notes.map(cleanNote).filter(note => {
    // 清洗后再次检查质量
    return note.title.length > 0 && note.body.length > 30;
  });
}
