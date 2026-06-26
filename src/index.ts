/**
 * 主入口
 * 提供 CLI 命令行交互
 */

import 'dotenv/config';
import { initDB, closeDB, notesDB, patternsDB, factsDB, generationsDB } from './knowledge/db.js';
import type { Track } from './knowledge/models.js';

// ═══════════════════════════════════════════════════
// CLI 命令
// ═══════════════════════════════════════════════════

const commands: Record<string, string> = {
  'crawl':     '采集小红书帖子 — npm run crawl [cold_facts|parenting]',
  'generate':  '生成文案 — npm run generate [cold_facts|parenting] [话题]',
  'db:init':   '初始化数据库',
  'db:seed':   '播种种子数据',
  'stats':     '查看数据库统计',
  'help':      '显示帮助',
};

function showHelp() {
  console.log(`
┌──────────────────────────────────────────────────────────┐
│           小红书文案智能体 · CLI                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  命令：                                                  │
`);

  for (const [cmd, desc] of Object.entries(commands)) {
    console.log(`    ${cmd.padEnd(12)} ${desc}`);
  }

  console.log(`
│                                                          │
│  赛道：                                                  │
│    cold_facts   冷知识科普                               │
│    parenting    育儿科普                                 │
│                                                          │
│  使用流程：                                              │
│    1. npm run db:init       初始化数据库                 │
│    2. npm run db:seed       播种图片风格数据             │
│    3. npm run crawl          采集帖子                    │
│    4. (等待 AI 自动提炼)                                 │
│    5. npm run generate      生成文案                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
  `);
}

function showStats() {
  initDB();

  console.log('\n📊 数据库统计\n');

  for (const track of ['cold_facts', 'parenting'] as Track[]) {
    const label = track === 'cold_facts' ? '冷知识科普' : '育儿科普';
    console.log(`  ${label}:`);
    console.log(`    帖子: ${notesDB.count(track)}`);
    console.log(`    套路: ${patternsDB.count(track)}`);
    console.log(`    知识点: ${factsDB.count(track)}`);
    console.log(`    生成记录: ${generationsDB.getRecent(track, 999).length}`);
    console.log('');
  }

  closeDB();
}

// ═══════════════════════════════════════════════════
// 入口
// ═══════════════════════════════════════════════════

const command = process.argv[2];

switch (command) {
  case 'stats':
    showStats();
    break;
  case 'help':
  case undefined:
    showHelp();
    break;
  default:
    console.log(`未知命令: ${command}`);
    showHelp();
}
