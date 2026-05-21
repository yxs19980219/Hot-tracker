# Hot-Track — AI 热点监控与定向追踪系统

> 自动发现热点 + 定向长期追踪，让信息自己来找你。

## 项目简介

Hot-Track 是一款面向技术从业者、内容创作者和研究者的 AI 驱动热点监控工具。它通过两条数据流工作：

| 模式 | 说明 |
|------|------|
| **热点发现** | 设置关键词 → 多源抓取 → AI 筛选去假 → 候选池展示 |
| **定向追踪** | 粘贴 GitHub/RSS/官网链接 → 系统持续监控更新 → AI 分析推送 |

## 功能特性

- **关键词监控** — 添加多个监控关键词，支持独立开关
- **多源热点抓取** — 每 30 分钟自动从 Twitter/X、Bing、HackerNews、搜狗、Bilibili、微博、GitHub Trending 抓取内容
- **AI 内容分析** — 基于 DeepSeek（deepseek-v4-flash）自动评估内容真实性、与关键词的相关性（0-100分）、重要程度（low/medium/high/urgent）
- **关键词预匹配** — 文本预过滤 + AI 精筛，只保留高相关性内容
- **定向长期追踪** — 粘贴 URL 自动识别类型（GitHub / RSS / Changelog），系统定期检查更新
- **AI 追踪分析** — 对追踪项的更新内容用自定义 Prompt 进行 AI 解读，输出 action（upgrade/watch/ignore/urgent）
- **热点去重** — URL 归一化 + 来源级去重，避免同一内容重复入库
- **实时通知** — WebSocket 浏览器推送新热点和追踪更新
- **邮件通知** — 高重要级别（high/urgent）热点自动发邮件（需配置 SMTP）
- **赛博朋克 UI** — React + TailwindCSS + Framer Motion，暗色主题、动态粒子背景、全端响应式
- **前端配置 API Key** — 无需改配置文件，在 UI 设置弹窗中直接填写 DeepSeek API Key

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite + TailwindCSS v4 + Framer Motion + Socket.io-client |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite + Prisma ORM |
| AI | DeepSeek API（deepseek-v4-flash） |
| 定时任务 | node-cron |
| 实时通信 | Socket.io |
| 邮件 | Nodemailer |

## 项目结构

```
hottrack/
├── client/               # React 前端
│   ├── src/
│   │   ├── App.tsx       # 主应用
│   │   ├── components/   # UI 组件
│   │   ├── services/     # API 封装
│   │   └── utils/        # 工具函数
│   └── index.html
├── server/               # Express 后端
│   ├── src/
│   │   ├── index.ts      # 服务入口
│   │   ├── routes/       # API 路由
│   │   ├── services/     # 业务逻辑（搜索、AI、邮件、URL归一化）
│   │   ├── jobs/         # 定时任务（热点抓取、追踪检查）
│   │   └── types.ts      # 类型定义
│   └── prisma/
│       └── schema.prisma # 数据库模型

├── skills/               # Agent Skill（独立 Python 脚本）
│   └── hot-monitor/
│       ├── scripts/      # 搜索脚本（web/china/twitter/report）
│       └── references/   # 分析框架和数据源说明
└── docs/                 # 文档
    ├── FEATURES_V2.md
    ├── REQUIREMENTS.md
    ├── API_INTEGRATION.md
    └── LOCAL_SETUP.md
```

## 数据模型

- **Keyword** — 监控关键词，支持自定义追踪 Prompt
- **Hotspot** — 候选热点（多源聚合，含 AI 分析字段：isReal, relevance, importance, summary, keywordMentioned）
- **TrackedItem** — 长期追踪项
- **TrackedItemSource** — 追踪源（github_repo / rss / changelog_page），创建追踪项时自动探测绑定
- **TrackedItemUpdate** — 追踪更新记录（含 AI 解读：aiSummary, aiAction）
- **Notification** — 通知历史
- **Setting** — 系统配置（如 deepseekApiKey）
- **GithubTrending** — GitHub Trending 缓存

## 快速开始

前置要求：Node.js ≥ 18、npm ≥ 9

```bash
# 1. 安装后端依赖
cd server && npm install

# 2. 安装前端依赖
cd ../client && npm install

# 3. 初始化数据库
cd ../server
npx prisma generate
npx prisma db push

# 4. 启动服务（需两个终端）
# 终端 1：后端
cd server && npm run dev        # http://localhost:3001
# 终端 2：前端
cd client && npm run dev        # http://localhost:5173
```

首次启动后，打开前端页面，点击右上角齿轮图标，在弹窗中填入 DeepSeek API Key 即可使用。

详细步骤请参阅 [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)。

## 环境变量

```env
# 必填（也可通过前端 UI「设置」配置）
DEEPSEEK_API_KEY=sk-xxx

# 数据库（默认即可）
DATABASE_URL="file:./dev.db"

# 服务器配置（默认即可）
PORT=3001
CLIENT_URL=http://localhost:5173

# 选填：Twitter 数据源
TWITTER_API_KEY=xxx

# 选填：邮件通知（不填则不发送邮件）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=xxx@qq.com
SMTP_PASS=授权码
NOTIFY_EMAIL=receive@example.com
```

## API 路由

### 关键词
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/keywords` | 列表（含热点计数） |
| GET | `/api/keywords/:id` | 详情（含最近 20 条热点） |
| POST | `/api/keywords` | 创建 |
| PUT | `/api/keywords/:id` | 更新 |
| DELETE | `/api/keywords/:id` | 删除 |
| PATCH | `/api/keywords/:id/toggle` | 开关状态 |

### 热点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/hotspots` | 列表（分页、过滤、排序） |
| GET | `/api/hotspots/stats` | 统计 |
| GET | `/api/hotspots/:id` | 详情 |
| POST | `/api/hotspots/search` | 手动搜索（Twitter + Bing + AI 分析） |
| DELETE | `/api/hotspots/:id` | 删除 |

### 追踪项
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tracked-items` | 列表 |
| GET | `/api/tracked-items/:id` | 详情（含 sources、updates、keywords） |
| POST | `/api/tracked-items` | 创建（自动探测并绑定追踪源） |
| PUT | `/api/tracked-items/:id` | 更新 |
| DELETE | `/api/tracked-items/:id` | 删除 |
| GET | `/api/tracked-items/:id/updates` | 更新记录 |
| PATCH | `/api/tracked-items/:id/toggle` | 开关状态 |

### 设置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 所有设置（API Key 脱敏） |
| PUT | `/api/settings` | 批量更新 |
| GET | `/api/settings/check-ai` | AI 服务连通性检查 |
| GET | `/api/settings/:key` | 单个设置 |
| PUT | `/api/settings/:key` | 更新单个设置 |

### 通知
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notifications` | 列表（含 unreadCount、分页） |
| PATCH | `/api/notifications/:id/read` | 标记已读 |
| PATCH | `/api/notifications/read-all` | 全部已读 |
| DELETE | `/api/notifications/:id` | 删除 |
| DELETE | `/api/notifications` | 清空全部 |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/check-hotspots` | 手动触发热点检查 |
| POST | `/api/check-tracking` | 手动触发追踪检查 |
| GET | `/api/health` | 健康检查 |

### WebSocket 事件
- `hotspot:new` — 新热点发现
- `notification` — 通知消息
- `tracking:update` — 追踪项更新

## 数据源

| 来源 | 说明 |
|------|------|
| Twitter/X | 关键词搜索 |
| Bing | 网页搜索 |
| HackerNews | 技术社区 |
| 搜狗 | 中文搜索 |
| Bilibili | 视频搜索 + 账号检测 |
| 微博 | 热搜 |
| GitHub Trending | 热门仓库 |

## 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 热点抓取 | 每 30 分钟 | 多源搜索 + AI 筛选 |
| 定向追踪检查 | 每 2 小时 | 检查 GitHub / RSS / Changelog 更新 |

## Agent Skill（独立脚本）

`skills/hot-monitor/` 是一个符合开放标准的 Agent Skill，包含一组独立的 Python 搜索脚本和 AI 分析指南。它**无需启动前后端、无需数据库**，可直接被 Claude Code、GitHub Copilot、Cursor 等 AI 编程 Agent 调用。

### Skill 内容

| 文件 | 说明 |
|------|------|
| `SKILL.md` | Skill 定义（name/description/instructions），Agent 按需加载 |
| `scripts/search_web.py` | 国际源搜索：Bing、Google、DuckDuckGo、HackerNews |
| `scripts/search_china.py` | 中文源搜索：搜狗、Bilibili、微博热搜 |
| `scripts/search_twitter.py` | Twitter/X 搜索（需 `TWITTER_API_KEY`） |
| `scripts/generate_report.py` | 从 stdin 读取 JSON，输出 Markdown 热点报告 |
| `references/analysis-guide.md` | AI 分析框架（真实性、相关性、重要程度评分标准） |
| `references/search-sources.md` | 各数据源详细规格（接口、频率限制、解析策略） |

### 安装方式

根据你使用的 AI Agent，把 `skills/hot-monitor/` 复制到对应目录：

**Claude Code**
```bash
mkdir -p ~/.claude/skills
cp -r skills/hot-monitor ~/.claude/skills/
```

**GitHub Copilot**
```bash
mkdir -p .github/skills
cp -r skills/hot-monitor .github/skills/
```

**Cursor**
```bash
mkdir -p .cursor/skills
cp -r skills/hot-monitor .cursor/skills/
```

安装完成后，Agent 会在你提问"最近AI有什么热点""帮我关注XX动态""生成热点报告"等时，自动加载该 Skill 并执行搜索脚本。

### 手动使用脚本

```bash
cd skills/hot-monitor
pip install -r scripts/requirements.txt

# 国际源搜索
python scripts/search_web.py "AI programming" --sources bing,hackernews

# 中文源搜索
python scripts/search_china.py "AI编程" --sources sogou,bilibili,weibo

# Twitter 搜索（需配置 TWITTER_API_KEY）
python scripts/search_twitter.py "AI programming"

# 生成报告（管道方式）
python scripts/search_web.py "AI" | python scripts/generate_report.py
```

所有脚本输出标准 JSON 到 stdout，可直接被 AI Agent 读取并分析。
## 开发脚本

**后端**
```bash
npm run dev          # 开发模式（tsx watch）
npm run build        # 构建
npm run db:push      # 同步数据库 Schema
npm run db:studio    # Prisma Studio 可视化
npm test             # 运行测试
```

**前端**
```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run preview      # 预览生产构建
```

## 开源协议

MIT
