# AI_CONTEXT/INDEX.md — 三龙牌 冷启动中枢

> `AI_CONTEXT/` = 本项目跨 AI 事实源**薄指针层**。通用纪律见全局（自动加载）。本文件是项目侧冷启动第一读。
> 第二读：`AI_CONTEXT/GOAL.md`（当前总目标见 §10：仅在线网站；本轮演出/铭牌/隐藏全能反馈见 §11；优先 bug 热修复见 §12；已上线后的术士前注/快拖/观战/全能牌堆反馈见 §13）。2026-10-04 用户已授权实现、推送、服务与定向部署，无需逐步确认；旧范围以 GOAL §10–12 和 DOMAIN §5–6 为准。新附件特效/性能交接按用户明确要求读取其 AI_CONTEXT 后核验整合。

## 1. 项目身份

- **三龙牌 Three-Dragon Ante** = D&D 桌游《三龙牌·传奇版》的在线网站：纯规则引擎 + 无账号多人 + 权威游戏服务。删除本地机器人模式；枭熊与 Suite 只提供网站跳转，不运行新牌桌。
- 2026-10-03 定调：**独立运行网站为核心，枭熊内置为次要适配**；表现层整体重写为写实风 2.5D，规则/协议/控制器/服务端不动。
- repo `https://github.com/FullPeople/three-dragon-ante`（GPL-3.0；2026-10-03 从 `FullPeople/obr-suite` dev `5476630` 拆出）。
- 线上独立网站 stable `https://obr.dnd.center/three-dragon-ante/`、dev `https://obr.dnd.center/three-dragon-ante-dev/`；**本仓库 push 不等于上线**，Suite既有链接本轮不重发。
- 主工作分支：`rebuild/presentation`；本次隔离 bug 热修复分支 `release/feedback-hotfix-20261004`。`main` 保持拆分时的基线。最新附件特效在另一隔离分支整合，不进入本次热修复；发布状态见 `RUNBOOKS/2026-10-04_bug-hotfix-deploy.md`。
- 当前线上0.9.1/0.9.1-dev，2026-10-04 16:07:25冻结源801daf580e9505a377dc97a544c4ad051ea029ac；完整CI37187336604、独立发布核验与一般公网12项通过。隐藏权限公网默认GPU8/8通过，强制软件GL超时仍待查；新附件特效未上线，实体手机未验收。当前状态以MEMORY §E、TODO与上述发布runbook为准，不能把后续留痕提交当线上源码。

## 2. 运行环境（real）

| 项 | 值 |
|---|---|
| 开发 / 运行在哪 | 本机 `D:\my_code\three-dragon-ante`（Windows 11，Git Bash / PowerShell） |
| Node | 22.17.1（`.nvmrc`） |
| 安装 | `npm ci --ignore-scripts` 与 `npm ci --ignore-scripts --prefix server/three-dragon` |
| 前端开发 | `npm run dev` → `http://127.0.0.1:5173/three-dragon-ante-dev/` |
| 构建 / 预览 | `npm run build`（含 `tsc --noEmit`）→ `extensions/three-dragon-ante/dist/`；`npm run preview` 端口 4173 |
| 服务端 | `npm run build:server` → `dist-server/`；`npm run dev:server` 监听 `127.0.0.1:5013`，数据库 `.local-data/game.sqlite` |
| 规则/控制器回归 | `npm test`（8 个入口，纯 Node）；新增 `test:guest-server` 专项 |
| 服务端回归 | `npm run test:server`（真实本地 WebSocket + SQLite） |
| 浏览器冒烟 | `npm run test:browser`、`npm run test:server-browser`（Windows 用已安装 Edge；当前新表现层选择器）；新增 `test:site-multiplayer` |
| 来源字节校验 | `npm run verify:source`（对 `SOURCE.json`；重构开始后作废，见 GOAL §4） |
| 证据目录 | `.local-evidence/`（gitignore） |
| 配置 | `.env.local`（不进 git；明文不记录）可指定 API；网站房间使用名字，无需登录。已删除本地对战与练习 |

## 3. 是否允许 AI 执行

- ✅ **只读自由**：读代码/docs、`git status/log/diff`、构建、typecheck、本地测试、本地预览与截图。
- ✅ **commit 可自主**（在 `rebuild/presentation` 分支；只 `git add` 具体文件）。
- ⚠️ **push / 合并到 main / 打 tag / 部署 / 改线上入口 / 发布 manifest** → 先经用户确认。
- ⚠️ **第三方素材下载**（纹理 / 音效 / 字体文件）→ 列出文件名、来源、许可、大小后经用户确认；npm 依赖安装不在此列。
- ⛔ **红线**（碰前必确认，详见 `DOMAIN.md`）：`rules/` 规则语义、`protocol.ts`/`wire.ts`/`private-channel.ts` 协议与私牌边界、`server/`、`src/modules/threeDragonAnte` 旧频道兼容、`art/` 卡图扫描件、依赖大版本升级。
- ⛔ **禁止**：AI 生成美术；打包产物向外部域发请求；在枭熊真实房间测试；把玩家数据或房间转储写入仓库。
- 🛑 开工前 checklist：`git status` 干净或只含本会话改动；`git branch --show-current` 为 `rebuild/presentation`；`npm run typecheck` 通过。

## 4. 文档地图

| 要什么 | 去哪 |
|---|---|
| **当前总目标、范围、阶段计划、DoD** | `AI_CONTEXT/GOAL.md` |
| 领域铁律 + 边界 + 实质档清单 | `AI_CONTEXT/DOMAIN.md` |
| 长期决策 + 当前状态（正本） | `AI_CONTEXT/MEMORY.md` |
| 审计流程 + 中立开场词 | `AI_CONTEXT/AUDIT.md` |
| 跨会话遗留 | `AI_CONTEXT/TODO.md` |
| 历次实质改动留痕 | `AI_CONTEXT/RUNBOOKS/` |
| 视觉定稿（写实 2.5D 酒馆牌桌） | `docs/design/VISUAL_SPEC.md` |
| 重构前现状评估（2026-10-03） | `docs/2026-10-03-presentation-assessment.md` |
| 拆分来源与上游约束 | `README.md`、`docs/EXTRACTION.md`、`docs/STATUS.md`、`SOURCE.json`（历史记录） |
| 历史技术文档（按标题日期阅读） | `docs/THREE_DRAGON_*.md`、`docs/HISTORICAL-README.md` |
