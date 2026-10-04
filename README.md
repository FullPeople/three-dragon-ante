# 三龙牌 · Three-Dragon Ante

D&D 桌游《三龙牌·传奇版》的在线网站：通过房间码或邀请链接和名字进行多人对局，无需账号。**独立 Owlbear Rodeo 插件**及 **Suite 三龙牌入口**只提供线上网站链接，不在枭熊内运行游戏。本地机器人模式已删除。规则引擎是纯函数；公共投影永不含牌库顺序与他人手牌。

2026-10-03 起表现层整体重做（分支 `rebuild/presentation`）：写实风 2.5D 牌桌，照片扫描材质（CC0）与 WebGL 法线贴图光照，无渐变、无发光的 HUD；去掉了历史回放与练习课程。决策与阶段记录见 `AI_CONTEXT/GOAL.md`，视觉规格见 `docs/design/VISUAL_SPEC.md` 与 `docs/design/ANTI_AI_FEEL.md`。

## 安装与本地运行

Node.js 22.17+（`.nvmrc`）。所有命令在仓库根目录执行。

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

打开 <http://127.0.0.1:5173/three-dragon-ante-dev/>。开发预览需要先启动下述服务：首页默认随机名字，也可重新随机或编辑，然后创建房间，或通过房间码/邀请链接加入；同一房间的名字唯一，普通加入不能占用已有名字。

在线刷新可恢复当前座位。换浏览器或清除缓存后，用原房间码和名字选择“重连”；没有旧凭据时，仅可恢复已经离线的座位。名字不是账号身份，请在熟悉的玩家间分享房间邀请。主持离开或断线后自动交接，牌局保留。

进行中退出对局或新开一局会先确认，取消保持当前牌局。最后一人断线后立即释放服务内存缓存，保留 60 秒重连宽限；每 5 秒扫描到期空房，删除房间及成员、凭据、历史和回执。新建却始终未连接的房间也会过期，网站房间数量受服务上限控制。还有玩家在线时不解散，旧 Owlbear 存档不适用该新网站策略。

构建输出在 `extensions/three-dragon-ante/dist/`；`npm run preview` 预览生产构建（端口 4173）。

## 目录

| 路径 | 内容 |
|---|---|
| `extensions/three-dragon-ante/src/presentation/` | 新表现层：`mount.ts`（`mountTableUI` 契约）、`app/`（状态、输入、演出调度）、`scene/`（2.5D 牌桌、卡牌层、WebGL 桌面）、`hud/`（流程轨、等待行、行动栏、选择、详视、横幅、聚光、计分板、大厅）、`fx/`、`audio/`、`theme/`、`assets/`（CC0 纹理与音效） |
| `extensions/three-dragon-ante/src/site/` | 独立网站壳（`index.html` 入口） |
| `extensions/three-dragon-ante/src/game/` | 规则引擎 `rules/`、协议、私牌通道、控制器；历史枭熊宿主保留兼容测试，公开 table.html 仅链接网站 |
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

生产构建使用 `VITE_TDA_API=/three-dragon-api/v1`，或在构建前配置 `.env.local`。网站需要 HTTPS/WSS 地址与正确的 `TDA_ORIGIN`；部署说明见 `docs/THREE_DRAGON_SERVER_203.md`。默认构建基路径 `/three-dragon-ante-dev/`；设置 `THREE_DRAGON_CHANNEL=stable` 构建 `/three-dragon-ante/`。整个产物目录必须在对应基路径发布。`index.html` 是网站；`launcher.html`、`table.html` 及嵌入的 `index.html` 只显示原生新窗口链接，背景页不启动游戏宿主。

## 线上入口（2026-10-04）

- 网站：<https://obr.dnd.center/three-dragon-ante/>，房间码/邀请加名字多人和重连。
- 独立枭熊扩展：在“扩展 → 添加”中填写 <https://obr.dnd.center/three-dragon-ante/manifest.json>；dev 频道为 <https://obr.dnd.center/three-dragon-ante-dev/manifest.json>。
- Suite 三龙牌入口打开网站新窗口，保留原顶栏、功能开关和设置可操作；不在 Suite 内创建新牌局。

2026-10-04 16:07:25（Asia/Shanghai）已上线 **0.9.1 / 0.9.1-dev**，网站 <https://obr.dnd.center/three-dragon-ante/>。线上冻结源为 `801daf580e9505a377dc97a544c4ad051ea029ac`，[完整 CI](https://github.com/FullPeople/three-dragon-ante/actions/runs/37187336604)、独立源码/包/部署前后核验和一般公网12项验收通过。本次只更新两个网站与必要游戏服务，保留 Suite/枭熊网站链接及其他线上内容；后续纯留痕提交不改变该冻结源。精确版本与GPL源码 ZIP 路径读取 `manifest.json` 与 `three-dragon-release.json`。当前验证、SSH等待异常、回滚指针见 `AI_CONTEXT/RUNBOOKS/2026-10-04_bug-hotfix-deploy.md`；0.9.0和0.8.0历史回执分别保留在同日 `online-only` / `owlbear-deploy` runbook。

网站房主隐藏全能的公网专项前5/8项通过，刷新撤权与后续专项仍待完整复核，失败证据保留；一般公网12项不能替代此项。实体手机/弱设备未验收，最新附件特效仍在独立本机预览，未随本次上线。

## 验证

```sh
npm test                 # 规则、私牌边界、控制器、主持交接、旧牌桌恢复、时光龙
npm run test:server      # 真实本地 WebSocket + SQLite
npm run test:browser     # 在线首页：随机名/编辑/帮助/语言/窄屏；无本地对战
npm run test:server-browser   # 保留历史枭熊宿主的四客户端兼容回归，不是新公开入口
npm run test:fx3d         # 特效层相机与 CSS 牌桌对齐
npm run test:guest-server # 唯一名字、重连、事务、持久化、私牌和旧协议共存
npm run test:empty-room  # 空房过期/数量限制/全记录清理/重连/重启/回退兼容
npm run test:site-multiplayer # 网站完整一轮、顶部按钮/确认、刷新/断线/重启、凭据终态
npm run test:page-route  # 历史宿主路由纯函数兼容回归
node tools/site-entry-browser.mjs # 所有插件/iframe入口只有原生网站链接
```

先完成两份依赖安装与前端 / 服务端构建。Windows 默认用已安装的 Edge；其他系统先执行 `npx playwright install chromium`。证据写入 `.local-evidence/`（gitignore）。枭熊身份边界是夹具，不等同真实账号房间验收。

## 素材与许可

代码 GPL-3.0。卡面扫描件版权归 Wizards，沿用原公开源码的声明。纹理（Poly Haven、ambientCG）与音效（Kenney）均为 CC0，逐文件登记在 `docs/design/ASSETS.md`；不使用 AI 生成素材。字体 Noto Serif SC / Noto Sans SC / Cinzel（OFL）随包自托管，产物不向外部域发请求。

`SOURCE.json` 是 2026-10-03 从 `FullPeople/obr-suite` 拆分时的来源记录（见 `docs/EXTRACTION.md`），重构后不再作为校验依据。
