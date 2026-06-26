# 大学导航员 (University Navigator)

[![CI](https://github.com/HuiByte/university-navigator/actions/workflows/ci.yml/badge.svg)](https://github.com/HuiByte/university-navigator/actions/workflows/ci.yml)

智能规划你的大学之路——从目标设定到路线图生成，让每一步都清晰可见。

大学导航员是一个基于 AI 的大学规划助手，帮助学生根据自身专业、年级和目标，自动生成个性化的成长规划、可视化路线图、每日任务清单，并提供打卡追踪与 AI 答疑功能。

## 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js (App Router) | 16.x |
| UI 库 | React + TypeScript | 18.x / 6.x |
| 样式 | Tailwind CSS + shadcn/ui | 4.x |
| 图表 | Recharts | 3.x |
| 动画 | Framer Motion | 12.x |
| 数据库 | PostgreSQL | 8.0+ |
| ORM | Prisma | 7.x |
| 认证 | Auth.js v5 (GitHub OAuth) | 5.0-beta |
| AI 能力 | Vercel AI SDK (OpenAI 兼容) | 6.x |
| 表单校验 | Zod + React Hook Form | 4.x / 7.x |

## 核心功能

- **AI 规划生成**：根据专业、年级、学历、目标、优劣势等信息，由大模型生成个性化大学规划方案
- **可视化路线图**：将规划拆解为分阶段成长路径，直观展示每个阶段的关键节点
- **每日任务管理**：基于规划自动生成每日待办任务，支持优先级、预计时长、完成状态管理
- **打卡与进度追踪**：记录每日打卡，维护连续打卡天数，提供 AI 周期性进度总结
- **AI 对话助手**：侧边栏抽屉式 AI 聊天，流式响应，支持上下文对话
- **GitHub 登录**：基于 Auth.js v5 的 OAuth 认证，JWT 会话策略适配 Edge Runtime
- **速率限制**：基于内存的轻量级限流器，保护 AI 接口免受滥用

## 本地运行

### 前置要求

- Node.js 18.17+
- PostgreSQL 8.0+（本地安装或使用 Docker）
- 一个 OpenAI 兼容的 API Key（支持 DeepSeek、通义千问、OpenAI 等）
- GitHub OAuth App（用于登录认证）

### 1. 克隆并安装依赖

```bash
git clone <repository-url>
cd university-navigator
npm install
```

### 2. 配置 PostgreSQL 数据库

本地安装 PostgreSQL 后，创建数据库：

```sql
CREATE DATABASE university_navigator;
```

或使用 Docker 快速启动：

```bash
docker run --name un-pg \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=university_navigator \
  -p 5432:5432 \
  -d postgres:16
```

### 3. 配置环境变量

复制示例文件并填写实际值：

```bash
cp .env.example .env
```

编辑 `.env`，填入以下配置：

```env
# 数据库连接（格式：postgresql://用户名:密码@主机:端口/数据库名?schema=public）
DATABASE_URL="postgresql://postgres:password@localhost:5432/university_navigator?schema=public"

# AI 模型配置（以 DeepSeek 为例）
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL="https://api.deepseek.com/v1"
OPENAI_MODEL="deepseek-chat"

# GitHub OAuth（Settings -> Developer settings -> OAuth Apps）
# Callback URL: http://localhost:3000/api/auth/callback/github
AUTH_GITHUB_ID="your-github-oauth-app-id"
AUTH_GITHUB_SECRET="your-github-oauth-app-secret"

# Auth.js 加密密钥（生成命令：openssl rand -base64 32）
AUTH_SECRET="your-random-secret-key"

# Upstash Redis（本地可选 / 生产必填）
# 本地不配置时自动降级为内存限流（仅单实例）
# ⚠️ 生产环境（NODE_ENV=production）未配置时，首次限流调用会硬阻断并抛错
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

> **生产环境必填提示**：`UPSTASH_REDIS_REST_URL` 与 `UPSTASH_REDIS_REST_TOKEN` 在本地开发为可选（降级为内存限流），但在生产环境为**必填项**。`src/lib/rate-limit.ts` 中的 `assertProductionConfig()` 会在 `NODE_ENV=production` 且未配置 Upstash 时，于首次限流调用抛出错误以阻断请求。详见下方[「本地开发 vs 生产部署」](#本地开发-vs-生产部署)。

### 4. 执行 Prisma 迁移

生成 Prisma Client 并创建数据库表结构：

```bash
# 执行迁移（首次运行）
npm run db:migrate

# 或仅同步 schema 到数据库（开发阶段快速迭代）
npm run db:push

# 生成 Prisma Client
npm run db:generate
```

可使用 Prisma Studio 可视化查看数据：

```bash
npm run db:studio
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可使用。

## 项目目录结构

```
university-navigator/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义（User、Plan、Roadmap、DailyTask 等）
│   └── migrations/            # Prisma 迁移文件
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API 路由
│   │   │   ├── auth/          # Auth.js v5 认证端点
│   │   │   ├── chat/          # AI 对话（流式响应）
│   │   │   ├── generate-plan/ # AI 规划生成
│   │   │   ├── generate-roadmap/ # 路线图生成
│   │   │   ├── tasks/         # 每日任务 CRUD
│   │   │   ├── check-in/      # 打卡记录
│   │   │   └── progress/      # 进度查询与 AI 总结
│   │   ├── plan/              # 规划页
│   │   ├── roadmap/           # 路线图页
│   │   ├── tasks/             # 任务页
│   │   ├── progress/          # 进度页
│   │   ├── layout.tsx         # 根布局（侧边栏 + Session Provider）
│   │   └── page.tsx           # 首页
│   ├── components/
│   │   ├── layout/            # 布局组件（侧边栏）
│   │   ├── ui/                # shadcn/ui 基础组件
│   │   ├── AIChatDrawer.tsx   # AI 对话抽屉
│   │   ├── AuthButtons.tsx    # 登录/登出按钮
│   │   └── SessionProvider.tsx
│   ├── lib/
│   │   ├── env.ts             # 环境变量校验（Zod）
│   │   ├── prisma.ts          # Prisma Client 单例
│   │   ├── auth-utils.ts      # 认证工具（获取登录用户 ID）
│   │   ├── api-response.ts    # 统一 API 响应封装
│   │   ├── api-client.ts      # 前端 API 请求封装
│   │   ├── ai-schemas.ts      # AI 输入校验 Schema
│   │   ├── rate-limit.ts      # 内存速率限制器
│   │   └── utils.ts           # 通用工具函数
│   ├── auth.config.ts         # Auth.js 基础配置（Edge Runtime 安全）
│   ├── auth.ts                # Auth.js 完整配置（含 PrismaAdapter）
│   └── middleware.ts          # 路由守卫（未登录重定向）
├── .env.example               # 环境变量示例
├── next.config.mjs            # Next.js 配置
├── prisma.config.ts           # Prisma 配置
├── eslint.config.mjs          # ESLint 配置
└── package.json
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run db:migrate` | 执行 Prisma 迁移 |
| `npm run db:push` | 同步 schema 到数据库 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:studio` | 打开 Prisma Studio |

## 本地开发 vs 生产部署

本项目在「限流」与「环境变量校验」上对本地与生产环境做了差异化处理，部署前请务必了解：

| 维度 | 本地开发 | 生产部署（Vercel） |
|------|---------|-------------------|
| **速率限制** | 内存限流（`globalThis` Map），单实例有效，无需额外依赖 | Upstash Redis 分布式限流，支持多 Serverless 实例 |
| **Upstash Redis** | 可选，未配置时自动降级并打印告警 | **必填**，`rate-limit.ts` 的 `assertProductionConfig()` 会在首次限流调用时硬阻断 |
| **环境变量校验** | `src/lib/env.ts` 用 Zod 校验；Upstash 为 `optional`，缺失可正常启动 | 同样经 Zod 校验；但生产环境必须额外满足 Upstash 双变量同时存在，否则首个 AI/限流接口即报错 |
| **Auth.js 信任主机** | 需设置 `AUTH_TRUST_HOST=true` | Vercel 自动识别，无需设置 |
| **数据库** | 本地 PostgreSQL / Docker | Vercel Postgres 或外部托管 PostgreSQL，连接串写入 `DATABASE_URL` |
| **构建产物** | `npm run build` 本地编译 | Vercel 自动构建，CI（GitHub Actions）已覆盖 lint/test/build 三阶段 |

**部署前自查：**

1. 在 Vercel 项目设置中配置全部环境变量（见下方 Checklist）。
2. 确认 `UPSTASH_REDIS_REST_URL` 为合法 URL（Zod 用 `z.string().url()` 校验）且 `UPSTASH_REDIS_REST_TOKEN` 非空。
3. GitHub OAuth App 的 Authorization callback URL 需改为生产域名：`https://<your-domain>/api/auth/callback/github`。
4. `AUTH_SECRET` 使用 `openssl rand -base64 32` 重新生成，勿复用本地开发密钥。

## License

ISC
