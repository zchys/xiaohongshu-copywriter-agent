/**
 * SQLite 数据库操作
 * 使用 better-sqlite3（同步，快，轻量）
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
  Note, Pattern, Fact, Generation, ImageStyle, Track
} from './models.js';

// ═══════════════════════════════════════════════════
// 数据库连接
// ═══════════════════════════════════════════════════

const DB_PATH = process.env.DB_PATH || './data/xhs.db';

// 确保目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

// 开启 WAL 模式（更好的并发性能）
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ═══════════════════════════════════════════════════
// 建表
// ═══════════════════════════════════════════════════

export function initDB(): void {
  db.exec(`
    -- 原始采集帖子
    CREATE TABLE IF NOT EXISTS notes (
      id              TEXT PRIMARY KEY,
      track           TEXT NOT NULL CHECK(track IN ('cold_facts', 'parenting')),
      title           TEXT,
      body            TEXT,
      tags            TEXT DEFAULT '[]',
      author_id       TEXT,
      author_name     TEXT,
      author_fans     INTEGER DEFAULT 0,
      liked           INTEGER DEFAULT 0,
      collected       INTEGER DEFAULT 0,
      commented       INTEGER DEFAULT 0,
      image_urls      TEXT DEFAULT '[]',
      publish_time    TEXT,
      source_keyword  TEXT,
      raw_html        TEXT,
      crawled_at      TEXT NOT NULL,
      processed       INTEGER DEFAULT 0
    );

    -- 写作套路库
    CREATE TABLE IF NOT EXISTS patterns (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      track           TEXT NOT NULL CHECK(track IN ('cold_facts', 'parenting')),
      pattern_type    TEXT NOT NULL CHECK(pattern_type IN (
                        'title_formula', 'hook', 'structure', 'emotion', 'cta'
                      )),
      label           TEXT NOT NULL,
      description     TEXT NOT NULL,
      examples        TEXT DEFAULT '[]',
      score           REAL DEFAULT 0,
      created_at      TEXT NOT NULL
    );

    -- 知识点素材库
    CREATE TABLE IF NOT EXISTS facts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      track           TEXT NOT NULL CHECK(track IN ('cold_facts', 'parenting')),
      category        TEXT NOT NULL,
      content         TEXT NOT NULL,
      source_note_id  TEXT,
      source_url      TEXT,
      credibility     TEXT DEFAULT 'medium' CHECK(credibility IN ('high', 'medium', 'low')),
      credibility_note TEXT,
      tags            TEXT DEFAULT '[]',
      age_range       TEXT,
      sensitivity     TEXT DEFAULT 'normal' CHECK(sensitivity IN ('normal', 'caution', 'medical_advice')),
      used_count      INTEGER DEFAULT 0,
      embedding       BLOB,
      created_at      TEXT NOT NULL,
      FOREIGN KEY (source_note_id) REFERENCES notes(id)
    );

    -- 生成记录
    CREATE TABLE IF NOT EXISTS generations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      track           TEXT NOT NULL CHECK(track IN ('cold_facts', 'parenting')),
      topic           TEXT NOT NULL,
      angle           TEXT,
      emotion         TEXT,
      prompt_used     TEXT,
      patterns_used   TEXT DEFAULT '[]',
      facts_used      TEXT DEFAULT '[]',
      output          TEXT NOT NULL,
      model           TEXT,
      user_rating     INTEGER CHECK(user_rating BETWEEN 1 AND 5),
      user_note       TEXT,
      created_at      TEXT NOT NULL
    );

    -- 图片风格库
    CREATE TABLE IF NOT EXISTS image_styles (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      track           TEXT NOT NULL CHECK(track IN ('cold_facts', 'parenting')),
      content_type    TEXT NOT NULL,
      style_name      TEXT NOT NULL,
      style_desc      TEXT NOT NULL,
      prompt_template TEXT NOT NULL,
      aspect_ratio    TEXT DEFAULT '3:4',
      example_url     TEXT
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_notes_track ON notes(track);
    CREATE INDEX IF NOT EXISTS idx_notes_processed ON notes(processed);
    CREATE INDEX IF NOT EXISTS idx_notes_liked ON notes(liked DESC);
    CREATE INDEX IF NOT EXISTS idx_patterns_track ON patterns(track);
    CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type);
    CREATE INDEX IF NOT EXISTS idx_facts_track ON facts(track);
    CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
    CREATE INDEX IF NOT EXISTS idx_generations_track ON generations(track);
  `);

  console.log('✅ 数据库初始化完成');
}

// ═══════════════════════════════════════════════════
// Notes 操作
// ═══════════════════════════════════════════════════

export const notesDB = {
  insert(note: Note): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO notes
      (id, track, title, body, tags, author_id, author_name, author_fans,
       liked, collected, commented, image_urls, publish_time, source_keyword,
       raw_html, crawled_at, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      note.id, note.track, note.title, note.body,
      JSON.stringify(note.tags), note.author_id, note.author_name, note.author_fans,
      note.liked, note.collected, note.commented,
      JSON.stringify(note.image_urls), note.publish_time, note.source_keyword,
      note.raw_html || null, note.crawled_at, note.processed
    );
  },

  getById(id: string): Note | undefined {
    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    return row ? parseNote(row) : undefined;
  },

  getUnprocessed(track: Track, limit: number = 50): Note[] {
    const rows = db.prepare(`
      SELECT * FROM notes
      WHERE track = ? AND processed = 0
      ORDER BY (liked + collected * 2 + commented * 3) DESC
      LIMIT ?
    `).all(track, limit) as any[];
    return rows.map(parseNote);
  },

  getTopNotes(track: Track, limit: number = 100): Note[] {
    const rows = db.prepare(`
      SELECT * FROM notes
      WHERE track = ?
      ORDER BY (liked + collected * 2 + commented * 3) DESC
      LIMIT ?
    `).all(track, limit) as any[];
    return rows.map(parseNote);
  },

  markProcessed(id: string): void {
    db.prepare('UPDATE notes SET processed = 1 WHERE id = ?').run(id);
  },

  count(track?: Track): number {
    if (track) {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM notes WHERE track = ?').get(track) as any;
      return row.cnt;
    }
    const row = db.prepare('SELECT COUNT(*) as cnt FROM notes').get() as any;
    return row.cnt;
  },

  exists(id: string): boolean {
    const row = db.prepare('SELECT 1 FROM notes WHERE id = ?').get(id);
    return !!row;
  }
};

// ═══════════════════════════════════════════════════
// Patterns 操作
// ═══════════════════════════════════════════════════

export const patternsDB = {
  insert(pattern: Omit<Pattern, 'id'>): number {
    const stmt = db.prepare(`
      INSERT INTO patterns (track, pattern_type, label, description, examples, score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      pattern.track, pattern.pattern_type, pattern.label,
      pattern.description, JSON.stringify(pattern.examples),
      pattern.score, pattern.created_at
    );
    return result.lastInsertRowid as number;
  },

  getByType(track: Track, patternType: string): Pattern[] {
    const rows = db.prepare(`
      SELECT * FROM patterns
      WHERE track = ? AND pattern_type = ?
      ORDER BY score DESC
    `).all(track, patternType) as any[];
    return rows.map(parsePattern);
  },

  getTopPatterns(track: Track, limit: number = 10): Pattern[] {
    const rows = db.prepare(`
      SELECT * FROM patterns
      WHERE track = ?
      ORDER BY score DESC
      LIMIT ?
    `).all(track, limit) as any[];
    return rows.map(parsePattern);
  },

  count(track?: Track): number {
    if (track) {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM patterns WHERE track = ?').get(track) as any;
      return row.cnt;
    }
    const row = db.prepare('SELECT COUNT(*) as cnt FROM patterns').get() as any;
    return row.cnt;
  }
};

// ═══════════════════════════════════════════════════
// Facts 操作
// ═══════════════════════════════════════════════════

export const factsDB = {
  insert(fact: Omit<Fact, 'id'>): number {
    const stmt = db.prepare(`
      INSERT INTO facts
      (track, category, content, source_note_id, source_url, credibility,
       credibility_note, tags, age_range, sensitivity, used_count, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      fact.track, fact.category, fact.content,
      fact.source_note_id || null, fact.source_url || null,
      fact.credibility, fact.credibility_note || null,
      JSON.stringify(fact.tags), fact.age_range || null,
      fact.sensitivity || 'normal', fact.used_count,
      fact.embedding || null, fact.created_at
    );
    return result.lastInsertRowid as number;
  },

  getByCategory(track: Track, category: string, limit: number = 20): Fact[] {
    const rows = db.prepare(`
      SELECT * FROM facts
      WHERE track = ? AND category = ?
      ORDER BY used_count ASC, created_at DESC
      LIMIT ?
    `).all(track, category, limit) as any[];
    return rows.map(parseFact);
  },

  search(track: Track, keyword: string, limit: number = 10): Fact[] {
    const rows = db.prepare(`
      SELECT * FROM facts
      WHERE track = ? AND content LIKE ?
      ORDER BY credibility DESC, used_count ASC
      LIMIT ?
    `).all(track, `%${keyword}%`, limit) as any[];
    return rows.map(parseFact);
  },

  getRandom(track: Track, limit: number = 5): Fact[] {
    const rows = db.prepare(`
      SELECT * FROM facts
      WHERE track = ? AND credibility != 'low'
      ORDER BY RANDOM()
      LIMIT ?
    `).all(track, limit) as any[];
    return rows.map(parseFact);
  },

  incrementUsed(id: number): void {
    db.prepare('UPDATE facts SET used_count = used_count + 1 WHERE id = ?').run(id);
  },

  count(track?: Track): number {
    if (track) {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM facts WHERE track = ?').get(track) as any;
      return row.cnt;
    }
    const row = db.prepare('SELECT COUNT(*) as cnt FROM facts').get() as any;
    return row.cnt;
  }
};

// ═══════════════════════════════════════════════════
// Generations 操作
// ═══════════════════════════════════════════════════

export const generationsDB = {
  insert(gen: Omit<Generation, 'id'>): number {
    const stmt = db.prepare(`
      INSERT INTO generations
      (track, topic, angle, emotion, prompt_used, patterns_used,
       facts_used, output, model, user_rating, user_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      gen.track, gen.topic, gen.angle, gen.emotion,
      gen.prompt_used, JSON.stringify(gen.patterns_used),
      JSON.stringify(gen.facts_used), gen.output, gen.model,
      gen.user_rating || null, gen.user_note || null, gen.created_at
    );
    return result.lastInsertRowid as number;
  },

  getRecent(track: Track, limit: number = 20): Generation[] {
    const rows = db.prepare(`
      SELECT * FROM generations
      WHERE track = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(track, limit) as any[];
    return rows.map(parseGeneration);
  },

  rate(id: number, rating: number, note?: string): void {
    db.prepare('UPDATE generations SET user_rating = ?, user_note = ? WHERE id = ?')
      .run(rating, note || null, id);
  }
};

// ═══════════════════════════════════════════════════
// ImageStyles 操作
// ═══════════════════════════════════════════════════

export const imageStylesDB = {
  insert(style: Omit<ImageStyle, 'id'>): number {
    const stmt = db.prepare(`
      INSERT INTO image_styles
      (track, content_type, style_name, style_desc, prompt_template, aspect_ratio, example_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      style.track, style.content_type, style.style_name,
      style.style_desc, style.prompt_template, style.aspect_ratio,
      style.example_url || null
    );
    return result.lastInsertRowid as number;
  },

  getByContentType(track: Track, contentType: string): ImageStyle[] {
    const rows = db.prepare(`
      SELECT * FROM image_styles
      WHERE track = ? AND content_type = ?
    `).all(track, contentType) as any[];
    return rows.map(parseImageStyle);
  },

  getAll(track: Track): ImageStyle[] {
    const rows = db.prepare(`
      SELECT * FROM image_styles WHERE track = ?
    `).all(track) as any[];
    return rows.map(parseImageStyle);
  }
};

// ═══════════════════════════════════════════════════
// 行解析辅助函数
// ═══════════════════════════════════════════════════

function parseNote(row: any): Note {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    image_urls: JSON.parse(row.image_urls || '[]')
  };
}

function parsePattern(row: any): Pattern {
  return {
    ...row,
    examples: JSON.parse(row.examples || '[]')
  };
}

function parseFact(row: any): Fact {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]')
  };
}

function parseGeneration(row: any): Generation {
  return {
    ...row,
    patterns_used: JSON.parse(row.patterns_used || '[]'),
    facts_used: JSON.parse(row.facts_used || '[]')
  };
}

function parseImageStyle(row: any): ImageStyle {
  return row;
}

// ═══════════════════════════════════════════════════
// 关闭连接
// ═══════════════════════════════════════════════════

export function closeDB(): void {
  db.close();
}

export { db };
