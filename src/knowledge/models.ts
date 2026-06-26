/**
 * 数据模型定义
 * 所有表结构的 TypeScript 类型
 */

// ═══════════════════════════════════════════════════
// 赛道枚举
// ═══════════════════════════════════════════════════

export type Track = 'cold_facts' | 'parenting';

// ═══════════════════════════════════════════════════
// 表1: notes — 原始采集帖子
// ═══════════════════════════════════════════════════

export interface Note {
  id: string;                    // 小红书帖子ID
  track: Track;                  // 赛道
  title: string;                 // 标题
  body: string;                  // 正文
  tags: string[];                // 话题标签
  author_id: string;             // 博主ID
  author_name: string;           // 博主昵称
  author_fans: number;           // 粉丝数
  liked: number;                 // 点赞数
  collected: number;             // 收藏数
  commented: number;             // 评论数
  image_urls: string[];          // 图片链接
  publish_time: string;          // 发布时间
  source_keyword: string;        // 采集时用的关键词
  raw_html?: string;             // 原始HTML备份
  crawled_at: string;            // 采集时间
  processed: number;             // 是否已提炼 0/1
}

// ═══════════════════════════════════════════════════
// 表2: patterns — 写作套路库
// ═══════════════════════════════════════════════════

export type PatternType =
  | 'title_formula'   // 标题公式
  | 'hook'            // 开头钩子
  | 'structure'       // 正文结构
  | 'emotion'         // 情绪手法
  | 'cta';            // 互动引导

export interface Pattern {
  id: number;
  track: Track;
  pattern_type: PatternType;
  label: string;                 // 简短标签
  description: string;           // 详细描述
  examples: string[];            // 原帖ID列表
  score: number;                 // 效果评分 0~1
  created_at: string;
}

// ═══════════════════════════════════════════════════
// 表3: facts — 知识点素材库
// ═══════════════════════════════════════════════════

export type Credibility = 'high' | 'medium' | 'low';
export type Sensitivity = 'normal' | 'caution' | 'medical_advice';

export interface Fact {
  id: number;
  track: Track;
  category: string;              // 分类
  content: string;               // 知识点内容
  source_note_id?: string;       // 来源帖子ID
  source_url?: string;           // 原始来源链接
  credibility: Credibility;      // 可信度
  credibility_note?: string;     // 可信度说明
  tags: string[];                // 关联标签
  age_range?: string;            // 适用月龄（育儿专用）
  sensitivity?: Sensitivity;     // 敏感度（育儿专用）
  used_count: number;            // 被使用次数
  embedding?: Buffer;            // 向量（可选）
  created_at: string;
}

// ═══════════════════════════════════════════════════
// 表4: generations — 生成记录
// ═══════════════════════════════════════════════════

export interface Generation {
  id: number;
  track: Track;
  topic: string;                 // 用户输入的话题
  angle: string;                 // 角度
  emotion: string;               // 情绪
  prompt_used: string;           // 完整prompt
  patterns_used: number[];       // 使用了哪些套路ID
  facts_used: number[];          // 使用了哪些知识点ID
  output: string;                // 完整输出 JSON
  model: string;                 // 用的哪个模型
  user_rating?: number;          // 用户评分 1~5
  user_note?: string;            // 用户备注
  created_at: string;
}

// ═══════════════════════════════════════════════════
// 表5: image_styles — 图片风格库
// ═══════════════════════════════════════════════════

export interface ImageStyle {
  id: number;
  track: Track;
  content_type: string;          // 适用内容类型
  style_name: string;            // 风格名称
  style_desc: string;            // 风格描述
  prompt_template: string;       // DALL·E prompt 模板
  aspect_ratio: string;          // 推荐比例
  example_url?: string;          // 示例图链接
}

// ═══════════════════════════════════════════════════
// 生成输出结构
// ═══════════════════════════════════════════════════

export interface ImagePrompt {
  role: 'cover' | 'content' | 'ending';
  description: string;           // DALL·E 提示词
  style: string;                 // 风格
  aspect_ratio: string;          // 比例
}

export interface GeneratedPost {
  title: string;
  body: string;
  tags: string[];
  cover_text: string;
  hook_line: string;
  cta: string;
  image_prompts: ImagePrompt[];
  content_type: 'single' | 'multi' | 'long';
  estimated_length: 'short' | 'medium' | 'long';
}
