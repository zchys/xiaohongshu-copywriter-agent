/**
 * AI 提炼器
 * 从原始帖子中提取套路（patterns）和知识点（facts）
 */

import { aiGenerateJSON } from './ai-client.js';
import { notesDB, patternsDB, factsDB } from '../knowledge/db.js';
import type { Note, Track, Pattern, Fact, PatternType } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 提炼 Prompt 模板
// ═══════════════════════════════════════════════════

const EXTRACT_PATTERNS_PROMPT = `
你是一个小红书内容分析专家。请分析以下小红书帖子，提炼出它的写作套路。

帖子标题：{title}
帖子正文：{body}
帖子标签：{tags}
互动数据：点赞{liked} 收藏{collected} 评论{commented}

请分析并输出以下 JSON 格式：
{
  "title_formula": "标题使用的公式类型，如：数字冲击型/反常识型/提问型/紧迫感型 等",
  "title_formula_desc": "具体描述这个标题公式是怎么用的",
  "hook": "开头钩子类型，如：提问式/反常识式/故事式/数据式 等",
  "hook_desc": "具体描述开头是怎么吸引人的",
  "structure": "正文结构类型，如：列表式/故事+知识点式/问答式/对比式 等",
  "structure_desc": "具体描述正文的组织方式",
  "emotion": "主打情绪类型，如：惊讶/好奇/共鸣/焦虑/满足 等",
  "emotion_desc": "具体描述怎么调动情绪的",
  "cta": "结尾互动引导类型，如：提问/投票/求补充/号召收藏 等",
  "cta_desc": "具体描述互动引导是怎么写的"
}
`;

const EXTRACT_FACTS_PROMPT = `
你是一个知识提取专家。请从以下小红书帖子中提取所有独立的知识点/事实。

赛道：{track}
帖子标题：{title}
帖子正文：{body}

请提取每个独立的知识点，输出以下 JSON 格式：
{
  "facts": [
    {
      "content": "知识点的完整描述",
      "category": "分类，如：人体/动物/历史/科学/生活（冷知识赛道）或 喂养/睡眠/发育/疾病/早教（育儿赛道）",
      "credibility": "可信度：high/medium/low",
      "credibility_note": "可信度判断依据",
      "tags": ["相关标签1", "相关标签2"],
      "age_range": "适用月龄范围，仅育儿赛道填写",
      "sensitivity": "敏感度：normal/caution/medical_advice，仅育儿赛道填写"
    }
  ]
}

注意：
1. 每个知识点应该是独立完整的，脱离帖子也能理解
2. 如果帖子中没有明确的知识点，返回空数组
3. 冷知识赛道：有趣的事实、反常识的发现
4. 育儿赛道：科学育儿建议、权威指南引用
`;

// ═══════════════════════════════════════════════════
// 提炼单条帖子
// ═══════════════════════════════════════════════════

interface ExtractedPatterns {
  title_formula: string;
  title_formula_desc: string;
  hook: string;
  hook_desc: string;
  structure: string;
  structure_desc: string;
  emotion: string;
  emotion_desc: string;
  cta: string;
  cta_desc: string;
}

interface ExtractedFact {
  content: string;
  category: string;
  credibility: 'high' | 'medium' | 'low';
  credibility_note: string;
  tags: string[];
  age_range?: string;
  sensitivity?: 'normal' | 'caution' | 'medical_advice';
}

/**
 * 从一条帖子中提炼套路
 */
export async function extractPatterns(note: Note): Promise<void> {
  const prompt = EXTRACT_PATTERNS_PROMPT
    .replace('{title}', note.title)
    .replace('{body}', note.body.slice(0, 2000))  // 限制长度
    .replace('{tags}', note.tags.join(', '))
    .replace('{liked}', String(note.liked))
    .replace('{collected}', String(note.collected))
    .replace('{commented}', String(note.commented));

  try {
    const result = await aiGenerateJSON<ExtractedPatterns>(prompt, {
      system: '你是一个专业的小红书内容分析师，擅长拆解爆款帖子的写作套路。',
      temperature: 0.3,
    });

    const now = new Date().toISOString();

    // 保存每种类型的套路
    const patternTypes: { type: PatternType; label: string; desc: string }[] = [
      { type: 'title_formula', label: result.title_formula, desc: result.title_formula_desc },
      { type: 'hook', label: result.hook, desc: result.hook_desc },
      { type: 'structure', label: result.structure, desc: result.structure_desc },
      { type: 'emotion', label: result.emotion, desc: result.emotion_desc },
      { type: 'cta', label: result.cta, desc: result.cta_desc },
    ];

    for (const p of patternTypes) {
      // 检查是否已存在相同标签的套路
      const existing = patternsDB.getByType(note.track, p.type);
      const duplicate = existing.find(e => e.label === p.label);

      if (duplicate) {
        // 更新已有套路的引用
        const examples = [...duplicate.examples, note.id];
        // 去重并限制数量
        const uniqueExamples = [...new Set(examples)].slice(0, 20);
        // 这里简单处理：更新 score
        // 实际可以更复杂，比如根据互动数据加权
      } else {
        // 新套路，计算初始分数
        const score = calculatePatternScore(note);
        patternsDB.insert({
          track: note.track,
          pattern_type: p.type,
          label: p.label,
          description: p.desc,
          examples: [note.id],
          score,
          created_at: now,
        });
      }
    }

    console.log(`    📝 提炼套路: ${note.title.slice(0, 30)}...`);
  } catch (err) {
    console.error(`    ❌ 套路提炼失败: ${err}`);
  }
}

/**
 * 从一条帖子中提取知识点
 */
export async function extractFacts(note: Note): Promise<void> {
  const trackLabel = note.track === 'cold_facts' ? '冷知识科普' : '育儿科普';

  const prompt = EXTRACT_FACTS_PROMPT
    .replace('{track}', trackLabel)
    .replace('{title}', note.title)
    .replace('{body}', note.body.slice(0, 2000));

  try {
    const result = await aiGenerateJSON<{ facts: ExtractedFact[] }>(prompt, {
      system: `你是一个专业的知识提取专家，擅长从小红书帖子中提取有价值的知识点。赛道：${trackLabel}`,
      temperature: 0.2,
    });

    const now = new Date().toISOString();

    for (const fact of result.facts) {
      // 检查是否已有相同内容
      const existing = factsDB.search(note.track, fact.content.slice(0, 20), 3);
      const isDuplicate = existing.some(e =>
        e.content === fact.content ||
        similarity(e.content, fact.content) > 0.8
      );

      if (!isDuplicate) {
        factsDB.insert({
          track: note.track,
          category: fact.category,
          content: fact.content,
          source_note_id: note.id,
          credibility: fact.credibility,
          credibility_note: fact.credibility_note,
          tags: fact.tags || [],
          age_range: fact.age_range,
          sensitivity: fact.sensitivity,
          used_count: 0,
          created_at: now,
        });
      }
    }

    console.log(`    💡 提取知识点: ${result.facts.length} 个`);
  } catch (err) {
    console.error(`    ❌ 知识点提取失败: ${err}`);
  }
}

// ═══════════════════════════════════════════════════
// 批量处理
// ═══════════════════════════════════════════════════

/**
 * 处理一批未提炼的帖子
 */
export async function processBatch(track: Track, batchSize: number = 20): Promise<number> {
  const unprocessed = notesDB.getUnprocessed(track, batchSize);

  if (unprocessed.length === 0) {
    console.log(`📋 ${track} 赛道没有待处理的帖子`);
    return 0;
  }

  console.log(`\n🔄 处理 ${track} 赛道: ${unprocessed.length} 条待处理\n`);

  let processed = 0;

  for (const note of unprocessed) {
    console.log(`\n  处理: [${note.id}] ${note.title.slice(0, 40)}...`);

    // 先清洗
    const { cleanNote } = await import('./cleaner.js');
    const cleaned = cleanNote(note);

    // 提炼套路
    await extractPatterns(cleaned);

    // 提取知识点
    await extractFacts(cleaned);

    // 标记已处理
    notesDB.markProcessed(note.id);
    processed++;

    // 控制 API 调用频率
    await sleep(1000);
  }

  console.log(`\n✅ ${track} 赛道处理完成: ${processed} 条`);
  return processed;
}

// ═══════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════

function calculatePatternScore(note: Note): number {
  let score = 0;
  if (note.liked >= 1000) score += 0.3;
  if (note.liked >= 5000) score += 0.2;
  if (note.collected >= 500) score += 0.2;
  if (note.liked > 0 && note.collected / note.liked > 0.5) score += 0.2;
  if (note.author_fans < 10000 && note.liked > 1000) score += 0.1;
  return Math.min(score, 1);
}

/** 简单的文本相似度（Jaccard） */
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
