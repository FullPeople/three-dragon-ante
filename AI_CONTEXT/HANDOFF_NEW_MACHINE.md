# 三龙牌 · 新机器接手启动词（2026-10-03）

> 用法：把下面「启动词」整段粘贴给新机器上的 Claude Code / Codex 作为第一条消息。压缩包 `three-dragon-ante-2026-10-03.zip` 解压后即是完整仓库（含 `.git`、构建产物 `extensions/three-dragon-ante/dist/`；不含根目录 `node_modules` 与 `.local-evidence`）。

---

## 启动词

你接手的是 D&D 桌游《三龙牌·传奇版》的网页实现 **three-dragon-ante** 的完整快照（压缩包解压即仓库，含 `.git`）。请严格按下面的顺序工作，每一步先查证再动手，用中文汇报。

### 0. 身份与现状

- 仓库 `https://github.com/FullPeople/three-dragon-ante`（GPL-3.0）。当前分支 **`rebuild/presentation`**，最新提交 `365f77c`（其前一个 `8d23298` 是第三轮审计整改）；`main` 停在拆分基线 `eb74f62`。
- 原机器 push 被 403 拒绝（凭据账号对该仓库无写权限），所以这些提交**还没到 GitHub**。你的第一件实事就是用有写权限的账号把它推上去。
- 2026-10-03 起表现层整体重做：写实风 2.5D 牌桌（DOM + CSS 3D + WebGL2 桌面材质 + 贴图粒子）。**规则引擎、协议、私牌边界、权威服务端、旧稳定频道一个字节都没改**，联机逻辑原样保留。
- 原机器会继续在同一分支上做「three.js 特效层」（新目录 `extensions/three-dragon-ante/src/presentation/fx3d/`）。你**不要碰表现层代码**；你负责环境、推送、部署与枭熊联机验证。任何改动前先 `git fetch` 看远端，绝不 force-push。

### 1. 冷启动读取顺序（不要跳）

1. `AI_CONTEXT/INDEX.md`（项目中枢：运行环境、允许/禁止、文档地图）
2. `AI_CONTEXT/GOAL.md`（总目标与阶段）
3. `AI_CONTEXT/MEMORY.md`（长期决策 + 当前状态，正本）
4. `AI_CONTEXT/TODO.md`（遗留）
5. `AI_CONTEXT/RUNBOOKS/2026-10-03_presentation-round3.md` §6（最近一次整改与验证基线）
6. 部署相关：`README.md`、`docs/THREE_DRAGON_SERVER_203.md`（服务端上线方式）、`server/three-dragon/obr-three-dragon.service`

### 2. 环境搭建与验证（全部通过才算接手成功）

Node 22.17+（`.nvmrc`）。所有命令在仓库根目录：

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix server/three-dragon
npm run build                 # 含 tsc --noEmit；产物 extensions/three-dragon-ante/dist/
npm run build:server          # 产物 dist-server/
npm test                      # 8/8（规则、私牌边界、控制器、交接、恢复、时光龙、表现层自测 15 项）
npm run test:server           # 2/2 真实本地 WebSocket + SQLite
npm run test:browser          # 20/20 生产构建冒烟：桌面 + 390px；零外部请求（Windows 用已装的 Edge，其它系统先 npx playwright install chromium）
npm run test:server-browser   # 4/4 四客户端 + 本地服务
```

预期基线：typecheck 0 错误；以上数字一个不少。少了就停下来汇报，不要改测试去凑。

### 3. 推送

```sh
git remote -v
git push -u origin rebuild/presentation
```

需要对 `FullPeople/three-dragon-ante` 有写权限的账号。推不上就报错误原文，不要改远程地址或凭据（那是用户的事）。**不要合并到 main**，是否合并由用户定。

### 4. 让枭熊（Owlbear Rodeo）可用，同时保留原有联机逻辑

事实：

- 枭熊扩展 = 构建产物整个目录按 **固定基路径 `/three-dragon-ante-dev/`** 用 HTTPS 托管（基路径由 `vite.config` 固化；入口 `manifest.json`、后台 `background.html`、启动器 `launcher.html`、牌桌页 `table.html`；`index.html` 是独立网站首页）。
- 线上旧入口 `https://obr.dnd.center/three-dragon-ante-dev/` 由 Suite 仓库另行部署，**本仓库 push 不等于上线**。
- 联机 = 枭熊页 `table.html`（`src/game/page.ts`，宿主 `legacy-page.ts` / `server-page.ts`）+ 权威游戏服务 `server/three-dragon`（ws + SQLite；生产为 systemd 服务 `obr-three-dragon`，`127.0.0.1:5013`，经 nginx 反代 `/three-dragon-api/v1/`）+ 旧稳定频道 `src/modules/threeDragonAnte`（旧 UI，原样保留以兼容进行中的旧牌局）。
- 前端在**构建时**读取 `.env.local` 的 `VITE_TDA_API`（API 地址）。给枭熊用的构建必须先设好它再 `npm run build`；本地对战不需要。

要做的事（按序，每一步动手前把方案和你的推荐发给用户确认，部署是红线）：

1. 把 `dist/` 部署到能用 HTTPS 访问、路径为 `/three-dragon-ante-dev/` 的站点（替换现有 dev 频道，或先放到新主机 / 新路径做并行验证）。
2. 服务端按 `docs/THREE_DRAGON_SERVER_203.md` 的方式部署或沿用现有服务；确认 WSS 反代可达。
3. 在枭熊里通过「扩展 → 添加 → manifest URL」装入 `https://<域名>/three-dragon-ante-dev/manifest.json`。
4. 真实房间验收：两个账号（GM + 玩家）建桌、入座、发牌、前注、翻注、出牌、能力选择、结算；紧凑弹窗模式；刷新恢复；浏览器网络面板里除自家域名与枭熊之外**零外部请求**。
5. 验收结果（通过/失败、截图路径、房间条件）写进 `AI_CONTEXT/RUNBOOKS/<日期>_owlbear-deploy.md`，并更新 `MEMORY.md` 状态段与 `TODO.md`。

### 5. 红线（碰前必须用户明确确认）

- `extensions/three-dragon-ante/src/game/rules/`（规则语义）、`protocol.ts` / `wire.ts` / `private-channel.ts`（协议与私牌边界）、`server/`、`src/modules/threeDragonAnte`、`src/game/art/`（卡面扫描件）。
- push 之外的任何远端操作、合并 main、打 tag、部署、改线上入口、发布 manifest、改 nginx / systemd / `.env`。
- 禁止：AI 生成美术；打包产物向外部域发请求；把房间转储或玩家数据写进仓库；在留痕里写任何密钥。

### 6. 工作纪律

- commit 可自主（只 `git add` 具体文件）；push 本次已授权；其余远端操作先问。
- 每次实质改动写 runbook（`AI_CONTEXT/RUNBOOKS/`），遗留双落 runbook + `TODO.md`；私有 Memory 只存指针。
- 实质改动完成后提醒用户做独立审计（换模型），开场词见 `AI_CONTEXT/AUDIT.md`。
- 卡住（复现不了 / 权限不够 / 入口缺失）就停下说明，不猜不编。

先执行 §1–§2，把每条命令的真实结果列成表发给我，再谈 §3–§4。
