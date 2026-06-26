/**
 * 种子数据：图片风格模板
 * 运行: npm run db:seed
 */

import 'dotenv/config';
import { initDB, imageStylesDB, closeDB } from './db.js';

initDB();

// ═══════════════════════════════════════════════════
// 冷知识赛道图片风格
// ═══════════════════════════════════════════════════

const coldFactsStyles = [
  {
    track: 'cold_facts' as const,
    content_type: 'shock',
    style_name: '冲击感封面',
    style_desc: '用强烈的视觉反差吸引点击，适合反常识类内容',
    prompt_template: 'A visually striking and surprising image about {topic}, bold composition, vibrant contrasting colors, minimalist style, clean background, suitable for social media cover, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'cold_facts' as const,
    content_type: 'infographic',
    style_name: '信息图解',
    style_desc: '用图表和数据可视化展示知识点，适合数据类内容',
    prompt_template: 'A clean and modern infographic illustration about {topic}, flat design style, soft pastel colors, icons and simple charts, professional layout, suitable for educational content, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'cold_facts' as const,
    content_type: 'comparison',
    style_name: '对比图',
    style_desc: '用before/after或对比展示差异，适合比较类内容',
    prompt_template: 'A split-screen comparison image about {topic}, left side showing {before} and right side showing {after}, clean design, contrasting colors, visual storytelling, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'cold_facts' as const,
    content_type: 'cute_illustration',
    style_name: '可爱插画',
    style_desc: '用萌系插画降低知识门槛，适合轻松科普',
    prompt_template: 'A cute kawaii illustration about {topic}, soft pastel colors, rounded shapes, adorable characters, whimsical style, suitable for social media, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'cold_facts' as const,
    content_type: 'realistic',
    style_name: '写实风格',
    style_desc: '用真实感图片增加可信度，适合科学类内容',
    prompt_template: 'A photorealistic high-quality image about {topic}, natural lighting, sharp details, professional photography style, suitable for educational content, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  }
];

// ═══════════════════════════════════════════════════
// 育儿赛道图片风格
// ═══════════════════════════════════════════════════

const parentingStyles = [
  {
    track: 'parenting' as const,
    content_type: 'warm_scene',
    style_name: '温馨场景',
    style_desc: '温馨的育儿场景，传递安全感和信任感',
    prompt_template: 'A warm and cozy scene of {topic}, soft natural lighting, warm color palette, gentle atmosphere, parent and baby interaction, professional photography style, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'parenting' as const,
    content_type: 'step_guide',
    style_name: '步骤图解',
    style_desc: '清晰的步骤展示，适合教程类内容',
    prompt_template: 'A clear step-by-step illustration guide about {topic}, clean flat design, numbered steps, soft colors, easy to understand visual layout, professional educational style, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'parenting' as const,
    content_type: 'baby_scene',
    style_name: '宝宝场景',
    style_desc: '可爱的宝宝场景，增加亲切感',
    prompt_template: 'An adorable baby scene about {topic}, soft pastel colors, cute baby expressions, safe and nurturing environment, professional baby photography style, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'parenting' as const,
    content_type: 'professional',
    style_name: '专业科普',
    style_desc: '专业的医学/育儿科普风格，增加权威感',
    prompt_template: 'A professional medical illustration about {topic}, clean clinical style, soft blue and white color scheme, clear anatomical accuracy, suitable for health education, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  },
  {
    track: 'parenting' as const,
    content_type: 'lifestyle',
    style_name: '生活方式',
    style_desc: '现代家庭生活方式展示，贴近真实生活',
    prompt_template: 'A modern lifestyle image about {topic}, bright and airy feel, contemporary home setting, natural family moments, Instagram-worthy composition, 3:4 aspect ratio, no text',
    aspect_ratio: '3:4'
  }
];

// ═══════════════════════════════════════════════════
// 插入数据
// ═══════════════════════════════════════════════════

console.log('🌱 播种图片风格数据...');

for (const style of coldFactsStyles) {
  imageStylesDB.insert(style);
}
console.log(`  ✅ 冷知识赛道: ${coldFactsStyles.length} 个风格`);

for (const style of parentingStyles) {
  imageStylesDB.insert(style);
}
console.log(`  ✅ 育儿赛道: ${parentingStyles.length} 个风格`);

closeDB();
console.log('🎉 种子数据播种完成！');
