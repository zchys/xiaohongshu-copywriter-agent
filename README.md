# 小红书文案智能体 🤖

自动采集小红书爆款帖子，AI 提炼套路和素材，一键生成完整的小红书帖子方案。

**支持赛道：** 冷知识科普 · 育儿科普

## ✨ 功能

- 🕷️ **自动采集** — Playwright 模拟真人浏览，自动抓取爆款帖子
- 🧠 **AI 提炼** — 自动提取写作套路和知识点，建立知识库
- ✍️ **智能生成** — 结合套路+素材，生成高质量文案
- 🎨 **图片提示词** — 自动生成 DALL·E 配图提示词，风格自动匹配
- 📊 **数据统计** — 可视化知识库和生成数据分析
- 🖥️ **漂亮界面** — 暗色主题，玻璃拟态，渐变配色

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
cd web && npm install && npm run build && cd ..
npx playwright install chromium
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入：
- `XHS_COOKIE` — 小红书 Cookie（从浏览器 F12 复制）
- `AI_PROVIDER` — AI 提供商（openai / anthropic / deepseek / minimax / mimo）
- 对应的 API Key

### 3. 初始化数据库

```bash
npm run db:init    # 创建数据库表
npm run db:seed    # 播种图片风格模板
```

### 4. 采集帖子

```bash
npm run crawl cold_facts    # 采集冷知识赛道
npm run crawl parenting     # 采集育儿赛道
```

### 5. 启动 Web 界面

```bash
npm start
```

打开浏览器访问 http://localhost:3456

## 🖥️ Web 界面

- **生成文案** — 输入话题，AI 自动生成完整帖子方案
- **生成历史** — 浏览过往生成，支持评分和筛选
- **数据统计** — 查看知识库分布和生成趋势图表

## 📁 项目结构

```
├── src/
│   ├── api/                   # Web API 服务器
│   │   └── server.ts          # Express 服务端
│   ├── crawler/               # 采集模块
│   │   ├── browser.ts         # Playwright 浏览器管理
│   │   ├── parser.ts          # 页面数据解析
│   │   ├── spider.ts          # 爬虫主逻辑
│   │   └── scheduler.ts       # 定时采集
│   ├── pipeline/              # 处理流水线
│   │   ├── ai-client.ts       # AI 客户端（支持5个提供商）
│   │   ├── cleaner.ts         # 数据清洗
│   │   ├── extractor.ts       # AI 提炼
│   │   └── scorer.ts          # 质量评分
│   ├── knowledge/             # 知识库
│   │   ├── db.ts              # SQLite 操作
│   │   ├── models.ts          # 类型定义
│   │   └── search.ts          # 检索逻辑
│   ├── generator/             # 文案生成
│   │   ├── agent.ts           # 生成主逻辑
│   │   └── image-prompt.ts    # 图片提示词
│   └── prompts/               # AI prompt 模板
│       ├── cold-facts.ts
│       └── parenting.ts
├── web/                       # 前端界面
│   └── src/
│       ├── pages/             # 页面组件
│       │   ├── GeneratePage   # 生成文案
│       │   ├── HistoryPage    # 生成历史
│       │   └── StatsPage      # 数据统计
│       └── components/        # 通用组件
└── data/
    └── xhs.db                 # SQLite 数据库
```

## 🔌 支持的 AI 提供商

| 提供商 | 环境变量 | 默认模型 |
|--------|----------|----------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| MiniMax | `MINIMAX_API_KEY` | MiniMax-Text-01 |
| MiMo | `MIMO_API_KEY` | mimo-v2.5-pro |

## ⚠️ 注意事项

- Cookie 需要定期更新（过期后采集会自动停止并提醒）
- 采集频率已做限制，避免被封号
- 育儿赛道的内容准确性要求高，建议人工复核
- 图片提示词使用英文，适合 DALL·E 生成
