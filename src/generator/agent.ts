/**
 * 文案生成主逻辑
 * 接收用户输入，生成完整的帖子方案
 */

import 'dotenv/config';
import { aiGenerateJSON } from '../pipeline/ai-client.js';
import { retrieveContext, formatContextForPrompt } from '../knowledge/search.js';
import { generationsDB, imageStylesDB, factsDB, initDB, closeDB } from '../knowledge/db.js';
import { COLD_FACTS_SYSTEM_PROMPT } from '../prompts/cold-facts.js';
import { PARENTING_SYSTEM_PROMPT } from '../prompts/parenting.js';
import type { Track, GeneratedPost, ImagePrompt } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 生成请求
// ═══════════════════════════════════════════════════

export interface GenerateRequest {
  track: Track;                // 赛道
  topic: string;               // 话题（如"人体冷知识""6个月辅食"）
  angle?: string;              // 角度（如"反常识""实用技巧"）
  emotion?: string;            // 情绪（如"惊讶""共鸣"）
  category?: string;           // 知识点分类（如"人体""喂养"）
  count?: number;              // 生成几条（默认1）
}

// ═══════════════════════════════════════════════════
// 用户 Prompt 模板
// ═══════════════════════════════════════════════════

const USER_PROMPT_TEMPLATE = `
请根据以下要求生成一条小红书帖子：

【赛道】{track}
【话题】{topic}
{angle_section}
{emotion_section}

{context}

请严格按以下 JSON 格式输出：
{
  "title": "标题（20字以内）",
  "body": "正文内容，用\\n分段，300~500字",
  "tags": ["#标签1", "#标签2", "#标签3"],
  "cover_text": "封面上的大字（5~8个字，吸引眼球）",
  "hook_line": "第一句话（用来吸引用户停留）",
  "cta": "结尾互动引导语",
  "image_prompts": [
    {
      "role": "cover",
      "description": "封面图的详细DALL·E提示词（英文，50-100词，包含主体、风格、光影、色调、构图、氛围）",
      "style": "图片风格（如：写实摄影/3D渲染/扁平插画/可爱卡通/科学图解）",
      "aspect_ratio": "3:4"
    },
    {
      "role": "content",
      "description": "内容配图1的详细DALL·E提示词（英文，50-100词，与封面图风格不同）",
      "style": "图片风格",
      "aspect_ratio": "3:4"
    },
    {
      "role": "content",
      "description": "内容配图2的详细DALL·E提示词（英文，50-100词，又一种不同的视角或风格）",
      "style": "图片风格",
      "aspect_ratio": "3:4"
    },
    {
      "role": "content",
      "description": "内容配图3的详细DALL·E提示词（英文，50-100词，可以是细节放大/对比图/流程图）",
      "style": "图片风格",
      "aspect_ratio": "3:4"
    },
    {
      "role": "ending",
      "description": "尾图的DALL·E提示词（英文，风格与整体统一，可用于总结或品牌）",
      "style": "图片风格",
      "aspect_ratio": "3:4"
    }
  ],
  "content_type": "multi",
  "estimated_length": "medium"
}

【重要提醒】
- image_prompts 数组必须包含 4~5 个提示词
- 每个提示词必须是详细的英文描述（50-100个单词）
- 每张图的风格要不同，不要全是同一种风格
- 提示词要包含：主体、风格、光影、色调、构图、氛围
- 所有图都不包含文字（no text）

【图文对应要求 - 最重要！】
每张图的内容必须直接对应正文中的具体知识点或场景！
- 封面图：要能一眼看出这篇帖子讲什么
- 内容图1：对应正文第一个知识点的视觉化
- 内容图2：对应正文第二个知识点的视觉化
- 内容图3：对应正文某个关键场景或对比
- 尾图：呼应整体主题的总结性画面

不要生成与正文内容无关的通用图片！
`;

// ═══════════════════════════════════════════════════
// 生成函数
// ═══════════════════════════════════════════════════

/**
 * 生成一条完整的小红书帖子方案
 */
export async function generatePost(request: GenerateRequest): Promise<GeneratedPost> {
  const {
    track,
    topic,
    angle = '综合',
    emotion = '自然',
    category,
    count = 1,
  } = request;

  // 1. 获取赛道对应的 system prompt
  const systemPrompt = track === 'cold_facts'
    ? COLD_FACTS_SYSTEM_PROMPT
    : PARENTING_SYSTEM_PROMPT;

  // 2. 从知识库检索相关套路和素材
  const context = retrieveContext(track, topic, angle, category);
  const contextText = formatContextForPrompt(context);

  // 3. 获取推荐的图片风格
  const imageStyles = imageStylesDB.getAll(track);
  const styleHint = imageStyles.length > 0
    ? `\n【推荐图片风格】\n${imageStyles.map(s => `- ${s.style_name}: ${s.style_desc}`).join('\n')}`
    : '';

  // 4. 组装用户 prompt
  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{track}', track === 'cold_facts' ? '冷知识科普' : '育儿科普')
    .replace('{topic}', topic)
    .replace('{angle_section}', angle ? `【角度】${angle}` : '')
    .replace('{emotion_section}', emotion ? `【情绪基调】${emotion}` : '')
    .replace('{context}', contextText + styleHint);

  // 5. 调用 AI 生成
  const result = await aiGenerateJSON<GeneratedPost>(userPrompt, {
    system: systemPrompt,
    temperature: 0.8,
    jsonMode: true,
  });

  // 6. 后处理
  const post = postProcess(result, track);

  // 7. 记录生成结果
  const genId = generationsDB.insert({
    track,
    topic,
    angle,
    emotion,
    prompt_used: userPrompt,
    patterns_used: context.patterns.map(p => p.id),
    facts_used: context.facts.map(f => f.id),
    output: JSON.stringify(post),
    model: process.env.AI_MODEL || 'gpt-4o',
    created_at: new Date().toISOString(),
  });

  // 8. 更新知识点使用次数
  for (const fact of context.facts) {
    factsDB.incrementUsed(fact.id);
  }

  console.log(`\n✅ 生成完成 (#${genId})`);
  console.log(`   标题: ${post.title}`);
  console.log(`   标签: ${post.tags.join(' ')}`);
  console.log(`   图片: ${post.image_prompts.length} 个提示词`);

  return post;
}

// ═══════════════════════════════════════════════════
// 后处理
// ═══════════════════════════════════════════════════

function postProcess(post: GeneratedPost, track: Track): GeneratedPost {
  // 确保标签格式正确
  post.tags = post.tags.map(tag => {
    tag = tag.trim();
    return tag.startsWith('#') ? tag : `#${tag}`;
  });

  // 确保至少有赛道标签
  if (track === 'cold_facts') {
    if (!post.tags.some(t => t.includes('冷知识'))) post.tags.unshift('#冷知识');
    if (!post.tags.some(t => t.includes('涨知识'))) post.tags.push('#涨知识');
  } else {
    if (!post.tags.some(t => t.includes('育儿'))) post.tags.unshift('#育儿');
    if (!post.tags.some(t => t.includes('育儿知识'))) post.tags.push('#育儿知识');
  }

  // 去重
  post.tags = [...new Set(post.tags)].slice(0, 8);

  // 确保图片提示词存在且足够多
  if (!post.image_prompts || post.image_prompts.length < 3) {
    // 如果图片提示词太少，补充默认的
    const defaultPrompts: ImagePrompt[] = [
      {
        role: 'cover',
        description: `A visually striking and eye-catching cover image about ${post.title}, modern digital art style, vibrant colors, dramatic lighting, professional composition, 3:4 aspect ratio, no text`,
        style: 'digital art',
        aspect_ratio: '3:4'
      },
      {
        role: 'content',
        description: `An informative illustration explaining ${post.title}, clean flat design, soft pastel colors, educational infographic style, clear visual hierarchy, 3:4 aspect ratio, no text`,
        style: 'flat design',
        aspect_ratio: '3:4'
      },
      {
        role: 'content',
        description: `A detailed close-up view related to ${post.title}, macro photography style, sharp focus, beautiful bokeh background, natural lighting, 3:4 aspect ratio, no text`,
        style: 'macro photography',
        aspect_ratio: '3:4'
      },
      {
        role: 'content',
        description: `A creative comparison or before-after style image about ${post.title}, split composition, contrasting colors, modern graphic design, 3:4 aspect ratio, no text`,
        style: 'graphic design',
        aspect_ratio: '3:4'
      },
      {
        role: 'ending',
        description: `A warm and inviting closing image for ${post.title}, soft gradients, gentle colors, minimalist design, call-to-action visual feel, 3:4 aspect ratio, no text`,
        style: 'minimalist',
        aspect_ratio: '3:4'
      }
    ];

    // 保留已有的，补充缺少的
    const existing = post.image_prompts || [];
    const existingRoles = existing.map(p => p.role);
    const needToAdd = defaultPrompts.filter(p => !existingRoles.includes(p.role));
    post.image_prompts = [...existing, ...needToAdd].slice(0, 5);
  }

  // 确保 aspect_ratio 正确，并增强描述
  post.image_prompts = post.image_prompts.map(p => ({
    ...p,
    aspect_ratio: '3:4',
    // 确保描述足够详细
    description: p.description.length < 30
      ? `${p.description}, high quality, detailed, professional, 3:4 aspect ratio, no text`
      : p.description
  }));

  return post;
}

// ═══════════════════════════════════════════════════
// 命令行入口
// ═══════════════════════════════════════════════════

async function main() {
  initDB();

  const track = (process.argv[2] || 'cold_facts') as Track;
  const topic = process.argv[3] || '人体冷知识';

  if (!['cold_facts', 'parenting'].includes(track)) {
    console.error('用法: npm run generate [cold_facts|parenting] [话题]');
    process.exit(1);
  }

  console.log(`\n🎯 生成小红书帖子`);
  console.log(`   赛道: ${track === 'cold_facts' ? '冷知识科普' : '育儿科普'}`);
  console.log(`   话题: ${topic}\n`);

  const post = await generatePost({ track, topic });

  console.log('\n' + '═'.repeat(50));
  console.log('📝 生成结果');
  console.log('═'.repeat(50));
  console.log(`\n📌 标题: ${post.title}`);
  console.log(`\n📄 正文:\n${post.body}`);
  console.log(`\n🏷️  标签: ${post.tags.join(' ')}`);
  console.log(`\n🖼️  封面文字: ${post.cover_text}`);
  console.log(`\n🪝 开头钩子: ${post.hook_line}`);
  console.log(`\n💬 互动引导: ${post.cta}`);
  console.log(`\n🎨 图片提示词:`);
  for (const p of post.image_prompts) {
    console.log(`   [${p.role}] ${p.description}`);
    console.log(`   风格: ${p.style} | 比例: ${p.aspect_ratio}`);
  }
  console.log('\n' + '═'.repeat(50));

  closeDB();
}

// 直接运行时执行（被 import 时不执行）
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}
