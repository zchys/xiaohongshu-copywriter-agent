/**
 * AI 生成知识库
 * 直接用 AI 生成知识点和写作套路，不用爬虫
 */

import 'dotenv/config';
import { initDB, factsDB, patternsDB, closeDB } from '../knowledge/db.js';
import { aiGenerateJSON } from './ai-client.js';
import type { Track, Credibility, PatternType } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 知识点生成 Prompt
// ═══════════════════════════════════════════════════

const GENERATE_FACTS_PROMPT = `
请生成 {count} 个{track}领域的知识点，用于小红书文案创作。

要求：
1. 每个知识点要有趣、有料、能引发好奇
2. 内容要准确，不要编造
3. 适合小红书传播（能让人想点赞收藏）
4. 用通俗易懂的语言
5. tags 不要加 # 号

严格按以下 JSON 格式输出，不要包含任何其他文字：
{{"facts": [{{"content": "知识点内容", "category": "分类", "tags": ["标签1", "标签2"]}}]}}
`;

// ═══════════════════════════════════════════════════
// 套路生成 Prompt
// ═══════════════════════════════════════════════════

const GENERATE_PATTERNS_PROMPT = `
请为{track}赛道的小红书帖子生成 {count} 个写作套路。

包括以下类型：
- title_formula: 标题公式（如"数字+反常识型"）
- hook: 开头钩子（如"提问式开头"）
- structure: 正文结构（如"列表式科普"）
- emotion: 情绪手法（如"制造惊讶感"）
- cta: 互动引导（如"提问式结尾"）

输出 JSON 格式：
{
  "patterns": [
    {
      "type": "title_formula/hook/structure/emotion/cta",
      "label": "套路名称（简短）",
      "description": "详细描述这个套路怎么用",
      "examples": ["示例1", "示例2"]
    }
  ]
}
`;

// ═══════════════════════════════════════════════════
// 生成函数
// ═══════════════════════════════════════════════════

async function generateFacts(track: Track, count: number = 20) {
  const trackLabel = track === 'cold_facts' ? '冷知识科普' : '育儿科普';
  const prompt = GENERATE_FACTS_PROMPT
    .replace('{count}', String(count))
    .replace('{track}', trackLabel);

  console.log(`\n💡 生成 ${trackLabel} 知识点...`);

  const result = await aiGenerateJSON<{ facts: any[] }>(prompt, {
    system: `你是一个知识渊博的${trackLabel}专家，擅长用有趣的方式讲解知识。`,
    temperature: 0.8,
    maxTokens: 8192,
  });

  let generated = 0;
  const now = new Date().toISOString();

  for (const fact of result.facts) {
    factsDB.insert({
      track,
      category: fact.category || '综合',
      content: fact.content,
      credibility: 'medium' as Credibility,
      credibility_note: 'AI 生成',
      tags: fact.tags || [],
      used_count: 0,
      created_at: now,
    });
    generated++;
  }

  console.log(`  ✅ 生成 ${generated} 个知识点`);
  return generated;
}

async function generatePatterns(track: Track, count: number = 15) {
  const trackLabel = track === 'cold_facts' ? '冷知识科普' : '育儿科普';
  const prompt = GENERATE_PATTERNS_PROMPT
    .replace('{count}', String(count))
    .replace('{track}', trackLabel);

  console.log(`\n🎯 生成 ${trackLabel} 写作套路...`);

  const result = await aiGenerateJSON<{ patterns: any[] }>(prompt, {
    system: `你是一个小红书运营专家，精通${trackLabel}赛道的爆款内容创作。`,
    temperature: 0.7,
    maxTokens: 8192,
  });

  let generated = 0;
  const now = new Date().toISOString();

  for (const pattern of result.patterns) {
    patternsDB.insert({
      track,
      pattern_type: pattern.type as PatternType,
      label: pattern.label,
      description: pattern.description,
      examples: pattern.examples || [],
      score: 0.7,
      created_at: now,
    });
    generated++;
  }

  console.log(`  ✅ 生成 ${generated} 个写作套路`);
  return generated;
}

// ═══════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════

async function main() {
  console.log('🤖 AI 知识库生成器\n');
  console.log('直接用 AI 生成知识点和写作套路，不用爬虫\n');

  initDB();

  console.log('═'.repeat(50));
  console.log('🧊 冷知识赛道');
  console.log('═'.repeat(50));

  await generateFacts('cold_facts', 20);
  await generatePatterns('cold_facts', 15);

  console.log('\n' + '═'.repeat(50));
  console.log('👶 育儿赛道');
  console.log('═'.repeat(50));

  await generateFacts('parenting', 20);
  await generatePatterns('parenting', 15);

  console.log('\n' + '═'.repeat(50));
  console.log('📊 生成完成!');
  console.log(`   冷知识: ${factsDB.count('cold_facts')} 知识点, ${patternsDB.count('cold_facts')} 套路`);
  console.log(`   育儿: ${factsDB.count('parenting')} 知识点, ${patternsDB.count('parenting')} 套路`);
  console.log('═'.repeat(50));

  closeDB();
}

main().catch(console.error);
