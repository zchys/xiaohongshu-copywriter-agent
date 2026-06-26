/**
 * 图片提示词增强
 * 根据内容自动匹配最佳图片风格
 */

import { aiGenerate } from '../pipeline/ai-client.js';
import { imageStylesDB } from '../knowledge/db.js';
import type { Track, ImagePrompt, ImageStyle } from '../knowledge/models.js';

// ═══════════════════════════════════════════════════
// 内容类型 → 图片风格映射
// ═══════════════════════════════════════════════════

const COLD_FACTS_STYLE_MAP: Record<string, string[]> = {
  '反常识': ['shock', 'comparison'],
  '数字': ['infographic', 'shock'],
  '科学': ['realistic', 'infographic'],
  '历史': ['cute_illustration', 'realistic'],
  '动物': ['cute_illustration', 'realistic'],
  '人体': ['infographic', 'realistic'],
  '生活': ['cute_illustration', 'comparison'],
  '综合': ['shock', 'cute_illustration'],
};

const PARENTING_STYLE_MAP: Record<string, string[]> = {
  '喂养': ['step_guide', 'warm_scene'],
  '睡眠': ['warm_scene', 'baby_scene'],
  '发育': ['professional', 'step_guide'],
  '疾病': ['professional', 'step_guide'],
  '早教': ['lifestyle', 'baby_scene'],
  '日常': ['warm_scene', 'lifestyle'],
  '综合': ['warm_scene', 'step_guide'],
};

// ═══════════════════════════════════════════════════
// 匹配图片风格
// ═══════════════════════════════════════════════════

/**
 * 根据内容自动匹配最佳图片风格
 */
export function matchImageStyle(
  track: Track,
  category: string,
  angle?: string
): ImageStyle | null {
  const styleMap = track === 'cold_facts'
    ? COLD_FACTS_STYLE_MAP
    : PARENTING_STYLE_MAP;

  // 优先用 angle 匹配，其次用 category
  const key = angle || category || '综合';
  const preferredTypes = styleMap[key] || styleMap['综合'];

  // 从数据库获取匹配的风格
  for (const contentType of preferredTypes) {
    const styles = imageStylesDB.getByContentType(track, contentType);
    if (styles.length > 0) {
      return styles[0]; // 返回第一个匹配的
    }
  }

  // 兜底：返回该赛道的任意风格
  const allStyles = imageStylesDB.getAll(track);
  return allStyles.length > 0 ? allStyles[0] : null;
}

// ═══════════════════════════════════════════════════
// 增强图片提示词
// ═══════════════════════════════════════════════════

/**
 * 用 AI 增强图片提示词，使其更适合 DALL·E
 */
export async function enhanceImagePrompt(
  track: Track,
  title: string,
  body: string,
  category?: string,
  angle?: string
): Promise<ImagePrompt[]> {
  // 先匹配风格模板
  const style = matchImageStyle(track, category || '综合', angle);

  // 用 AI 生成具体的图片提示词
  const prompt = `
基于以下小红书帖子，生成 2 个 DALL·E 图片提示词（英文）。

帖子标题：${title}
帖子内容摘要：${body.slice(0, 500)}
赛道：${track === 'cold_facts' ? '冷知识科普' : '育儿科普'}
${style ? `推荐风格：${style.style_name} — ${style.style_desc}` : ''}

要求：
1. 第一个是封面图提示词：要有冲击力，能吸引点击
2. 第二个是内容配图提示词：辅助理解内容
3. 用英文写，描述具体、生动
4. 不要在图中包含任何文字
5. 指定图片风格（如 digital illustration, flat design, photography 等）

输出 JSON 格式：
{
  "prompts": [
    {
      "role": "cover",
      "description": "英文提示词",
      "style": "风格描述"
    },
    {
      "role": "content",
      "description": "英文提示词",
      "style": "风格描述"
    }
  ]
}
`;

  try {
    const result = await aiGenerate(prompt, {
      system: '你是一个专业的 AI 图像生成提示词专家，擅长为小红书帖子设计吸引人的配图。',
      temperature: 0.7,
    });

    // 解析 JSON
    let cleanResult = result.trim();
    if (cleanResult.startsWith('```json')) cleanResult = cleanResult.slice(7);
    if (cleanResult.startsWith('```')) cleanResult = cleanResult.slice(3);
    if (cleanResult.endsWith('```')) cleanResult = cleanResult.slice(0, -3);

    const parsed = JSON.parse(cleanResult.trim());

    return (parsed.prompts || []).map((p: any) => ({
      role: p.role || 'content',
      description: p.description || '',
      style: p.style || 'modern',
      aspect_ratio: '3:4',
    }));
  } catch (err) {
    console.error('图片提示词生成失败，使用模板:', err);

    // 兜底：使用模板生成
    return [{
      role: 'cover',
      description: style
        ? style.prompt_template.replace('{topic}', title)
        : `A clean and attractive social media cover about ${title}, modern illustration style, 3:4 aspect ratio, no text`,
      style: style?.style_name || 'modern illustration',
      aspect_ratio: '3:4',
    }];
  }
}
