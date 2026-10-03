# 三龙牌 · Three-Dragon Ante

D&D 桌游《三龙牌·传奇版》的网页实现：**独立网站**支持本地机器人和无需账号的在线多人；**独立 Owlbear Rodeo 扩展**及 **Suite 内牌桌**共用权威游戏服务。规则引擎是纯函数；公共投影永不含牌库顺序与他人手牌。

2026-10-03 起表现层整体重做（分支 `rebuild/presentation`）：写实风 2.5D 牌桌，照片扫描材质（CC0）与 WebGL 法线贴图光照，无渐变、无发光的 HUD；去掉了历史回放与练习课程。决策与阶段记录见 `AI_CONTEXT/GOAL.md`，视觉规格见 `docs/design/VISUAL_SPEC.md` 与 `docs/design/ANTI_AI_FEEL.md`。

## 安装与本地运行

Node.js 22.17+（`.nvmrc`）。所有命令在仓库根目录执行。

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

打开 <http://127.0.0.1:5173/three-dragon-ante-dev/>。首页选择对手数量后开始本地机器人对战，刷新会重新开始。在线多人需要先启动下述服务：输入名字创建房间，或通过房间码/邀请链接加入；同一房间的名字唯一，普通加入不能占用已有名字。

在线刷新可恢复当前座位。换浏览器或清除缓存后，用原房间码和名字选择“重连”；没有旧凭据时，仅可恢复已经离线的座位。名字不是账号身份，请在熟悉的玩家间分享房间邀请。主持离开或断线后自动交接，牌局保留。

构建输出在 `extensions/three-dragon-ante/dist/`；`npm run preview` 预览生产构建（端口 4173）。

## 目录

| 路径 | 内容 |
|---|---|
| `extensions/three-dragon-ante/src/presentation/` | 新表现层：`mount.ts`（`mountTableUI` 契约）、`app/`（状态、输入、演出调度）、`scene/`（2.5D 牌桌、卡牌层、WebGL 桌面）、`hud/`（流程轨、等待行、行动栏、选择、详视、横幅、聚光、计分板、大厅、全能编辑器）、`fx/`、`audio/`、`theme/`、`assets/`（CC0 纹理与音效）、`local/LocalMatch.ts`（本地机器人宿主） |
| `extensions/three-dragon-ante/src/site/` | 独立网站壳（`index.html` 入口） |
| `extensions/three-dragon-ante/src/game/` | 规则引擎 `rules/`、协议、私牌通道、控制器、枭熊页面（`table.html` 入口）、后台 |
| `extensions/three-dragon-ante/src/game/art/` | 卡面扫描件（©2021 Wizards，沿用原公开源码，不主张原创） |
| `server/three-dragon/` | 权威游戏服务（ws + SQLite） |
| `src/modules/threeDragonAnte/` | 早期稳定频道的兼容源码（旧 UI，原样保留） |
| `tools/` | 规则 / 控制器 / 服务端回归与浏览器冒烟 |
| `AI_CONTEXT/`、`docs/` | 目标、规格、留痕、历史文档 |

## 多人游戏服务

```sh
npm ci --ignore-scripts --prefix server/three-dragon
npm run build:server
npm run dev:server
```

本地服务监听 `127.0.0.1:5013`，存档在 `.local-data/game.sqlite`（gitignore）。前端默认使用同源 `/three-dragon-api/v1`，Vite 开发/预览代理到本地服务。使用 4173 预览时，启动服务前设置 `TDA_ORIGIN=http://127.0.0.1:4173`；默认开发端口为 5173。

生产构建使用 `VITE_TDA_API=/three-dragon-api/v1`，或在构建前配置 `.env.local`。真实枭熊扩展需要 HTTPS/WSS 地址与正确的 `TDA_ORIGIN`；部署说明见 `docs/THREE_DRAGON_SERVER_203.md`。默认构建基路径 `/three-dragon-ante-dev/`；设置 `THREE_DRAGON_CHANNEL=stable` 构建 `/three-dragon-ante/`。整个产物目录必须在对应基路径发布，入口为 `manifest.json`、`background.html`、`launcher.html`、`table.html` 和网站 `index.html`。

## 线上入口（2026-10-04）

- 网站：<https://obr.dnd.center/three-dragon-ante/>，支持本地机器人、房间码/邀请加名字多人和重连。
- 独立枭熊扩展：在“扩展 → 添加”中填写 <https://obr.dnd.center/three-dragon-ante/manifest.json>；dev 频道为 <https://obr.dnd.center/three-dragon-ante-dev/manifest.json>。
- Suite 内牌桌沿用已安装的 Suite 入口。进行中的稳定旧局保持原频道协议，新局使用权威服务。

当前发布为 0.8.0 / 0.8.0-dev。版本及精确源提交读取 `manifest.json` 与 `three-dragon-release.json`；后者提供对应冻结源码 ZIP 路径。公网网站联机已验证，真实枭熊安装与 GM/玩家双账号验收仍待完成；完整回执见 `AI_CONTEXT/RUNBOOKS/2026-10-04_owlbear-deploy.md`。

## 验证

```sh
npm test                 # 规则、私牌边界、控制器、主持交接、旧牌桌恢复、时光龙
npm run test:server      # 真实本地 WebSocket + SQLite
npm run test:browser     # 独立网站生产构建：开局、暗置、翻注、出牌；零外部请求
npm run test:server-browser   # 四个浏览器客户端 + 本地服务：创建、准入、入座、发牌、全能边界、刷新恢复
npm run test:fx3d         # 特效层相机与 CSS 牌桌对齐
npm run test:guest-server # 唯一名字、重连、事务、持久化、私牌和旧协议共存
npm run test:site-multiplayer # 网站完整一轮、刷新/断线/重启、凭据终态
npm run test:page-route  # Suite 旧局与新权威入口共存
node tools/site-entry-browser.mjs # 缓存旧后台 index.html 入口兼容
```

先完成两份依赖安装与前端 / 服务端构建。Windows 默认用已安装的 Edge；其他系统先执行 `npx playwright install chromium`。证据写入 `.local-evidence/`（gitignore）。枭熊身份边界是夹具，不等同真实账号房间验收。

## 素材与许可

代码 GPL-3.0。卡面扫描件版权归 Wizards，沿用原公开源码的声明。纹理（Poly Haven、ambientCG）与音效（Kenney）均为 CC0，逐文件登记在 `docs/design/ASSETS.md`；不使用 AI 生成素材。字体 Noto Serif SC / Noto Sans SC / Cinzel（OFL）随包自托管，产物不向外部域发请求。

`SOURCE.json` 是 2026-10-03 从 `FullPeople/obr-suite` 拆分时的来源记录（见 `docs/EXTRACTION.md`），重构后不再作为校验依据。
