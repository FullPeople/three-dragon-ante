# AI_CONTEXT/GOAL.md — 三龙牌 表现层破坏性重构 · 总目标

> 设立：2026-10-03，用户拍板。本文件是本轮重构的**唯一目标正本**，任何会话开工先读。
> 当前产品方向以 §10 为准，最新反馈修复见 §11，状态见 `MEMORY.md`；§1–§8 保留表现层重做历史，§9 保留首轮上线授权。遗留见 `TODO.md`；每阶段留痕见 `RUNBOOKS/`。

## 1. 一句话目标

把三龙牌从"程序化生成的低端表现"重做成**写实风 2.5D 酒馆牌桌**：特效显著、每个流程的进展与等待一目了然；**独立运行网站为核心**，枭熊内置为次要适配；规则引擎与多人协议原样保留。

## 2. 用户决策（2026-10-03，已确认）

| # | 决策 | 含义 |
|---|---|---|
| 1 | 画风：**写实** | 真实材质（木、皮革、毛毡、黄铜、羊皮纸），真实光影，不要卡通/扁平/像素 |
| 2 | 强调**显著特效** | 发牌、翻注、能力触发、金币流转、结算、胜负都要有明确、可感知、有分量的动效与声音 |
| 3 | 强调**各流程明确进展和等待** | 任何时刻都能回答"现在是哪一步、在等谁、下一步是什么"；等待状态要可见、可信、不焦虑 |
| 4 | **美术资源不接受 AI 生成** | 只允许：人手制作、照片扫描、CC0/开源许可的真实素材、代码矢量 |
| 5 | **卡图不变** | 100 张 Wizards 扫描件 + 时光龙自定义牌原样保留；卡面以外的一切都要重做 |
| 6 | **2.5D** | 放弃 Three.js 三维渲染，改为分层 2.5D（透视倾斜的桌面平面 + 正面手牌 + 画布特效层） |
| 7 | **不要历史回放、不要 41 项练习** | 删除 history-panel / replay-lens / 教程课程体系；保留"完整对局"与简短"怎么玩" |
| 8 | **独立网站为核心，枭熊为次要适配** | `index.html` 变成网站首页与对局；枭熊牌桌页改名 `table.html`；网站先完整，枭熊后适配 |
| 9 | 在本地持续推进 | commit 自主；push 需确认 |
| 10 | **文案去 AI 腔**（2026-10-03 第二轮） | 删除口号与引导句（"在烛光下…""轮到你·把一张…""拖动…"）；提示只用名词 / 动词短语；键盘说明进帮助面板 |
| 11 | **视觉去 AI 感** | 禁止渐变、文字发光、彩色光晕、毛玻璃；材质用照片扫描，体积用 1px 内嵌倒角；判别清单见 `docs/design/ANTI_AI_FEEL.md` |
| 12 | **写实材质 + 法线浮雕** | 朝 Unreal 式木 / 石 / 皮革写照靠拢；桌面由 WebGL 片元着色器做真实法线贴图光照；UI 构件贴照片材质 |
| 13 | **素材下载已批准** | Poly Haven / ambientCG CC0 纹理、Kenney CC0 音效，逐文件登记 `docs/design/ASSETS.md` |

## 3. 范围

### 3.1 整体替换（旧文件在新实现接通后删除）

`extensions/three-dragon-ante/src/game/` 下：`ui.ts`、`react/*`（12 个）、`stage/*`（含 selftest）、`style.css`、`stage-ui.css`、`card-images.css`、`round-presentation.{ts,css}`、`power-presentation.{ts,css}`、`power-effects.ts`、`power-classes.ts`、`card-art.ts`、`audio.ts`、`onboarding/*`、`tutorial.{ts,css}`、`tutorial-selftest.mjs`、`practice-page.{ts,css}`、`interaction/drag-controller.ts`、`choice-input-selftest.mjs`、`power-ui-selftest.mjs`、`ui-stage-selftest.mjs`；入口 `index.html`、`practice.html`、`launcher.html` 的视觉；`public/icon.svg`、`public/announcement.html`。

可移植的纯逻辑（搬进新包、不改语义）：`power-sequence.ts`（公共事件 → 能力/金币提示）、`flight-formations.ts`、`card-images.ts`（卡图 URL 表）、`text.ts`（文案表，按新 UI 裁剪）、`gesture.ts`（手势信封，协议的一部分，原样引用）。

### 3.2 保留不动

`rules/`（引擎、投影、提示文案）、`protocol.ts`、`ui-command.ts`（UI↔宿主契约）、`wire.ts`、`private-channel.ts`、`controller*.ts`、`store.ts`、`broadcast.ts`、`identity.ts`、`diagnostics.ts`、`local-view.ts`、`legacy-host.ts`、`setup.ts`、`server-*.ts`、`index.ts`（后台）、`page.ts`（路由）、`legacy-page.ts`、`stable-legacy-page.ts`（只改 import 指向新包）、`src/launcher.ts`、`activation.ts`、`locale.ts`、`viewport.ts`、`asset-base.ts`、`background.html`；`server/`；`src/modules/threeDragonAnte/`（旧稳定频道兼容，保留旧 UI 不动）；`tools/` 中规则/控制器/服务端回归。

### 3.3 新建

`extensions/three-dragon-ante/src/presentation/`（新表现层包，对外只暴露与旧 `mountTableUI` 同契约的入口）与 `src/site/`（独立网站壳）。详见 §5。

## 4. 硬约束（动手前必须知道）

1. **接缝固定**：新 UI 的输入是 `TableView`（`protocol.ts`），输出是 `TableUICommand`（`ui-command.ts`）；返回对象实现旧 `mountTableUI` 的全部方法（`update / gesture / language / restore / draft / waitingForReceipt / presentationBusy / getAnchor / suspend / resume / failed / destroy`）。宿主页面（`legacy-page.ts`、`server-page.ts`、本地对战）不感知内部实现。
2. **隐私不变量**：渲染只拿投影；普通座位视图永不渲染他人手牌正面；全能视图只在主持本机；手势广播不带手牌数据；拖放/键盘提交不等于接受，必须等匹配的回执（`actionReceipt`）才落地。`privacy-selftest.mjs` 继续在 `npm test` 中。
3. **流程时序规格（产品规则，必须延续；v1.2 第二轮纠错后）**：出牌（抽出 190 ms → 加速落下 260 ms → 尘土）→ 停 640 ms → 聚焦 420 ms（传说牌先起法阵 700 ms）→ 能力说明层（点击任意处关闭）→ 该牌独有特效脚本 → 金币 → 停 0.3 s；轮局结束：特殊牌阵说明层（点击关闭）→ 桌面拼点（数字浮现 700 ms → 打标 1000 ms）→ 计分板 → 发奖池 → 阶段标签才变；翻注四段（放置 250 ms → 翻开 360 ms → 最高牌闪 640 ms → 付款 470 ms，共 1720 ms）；能力提示 `power-ready / playable-no-power` 只用引擎给的 `handPowerHints`，UI 不自行推断。
4. **零外部请求**：字体、纹理、音效全部打包自托管；浏览器冒烟断言 `external == []`。
5. **`SOURCE.json` + `verify:source` 在重构开始后作废**：从 `package.json` 脚本与 CI 中移除 `verify:source`；`SOURCE.json` 保留为历史记录并在 `docs/EXTRACTION.md` 注明。
6. **测试重建**：旧浏览器冒烟与 9 个 `*-selftest.mjs` 绑定旧 DOM；新 UI 完成后按新选择器重写 `test:browser` / `test:server-browser`；`npm test` 与 `npm run test:server` 保持原样并必须持续通过。
7. **多画面适配**：桌面网站（首要）、手机竖屏 390 宽（首要）、枭熊全屏模态（次要）、枭熊紧凑弹窗（次要，由后台 `popover.setWidth/Height` 控制）。
8. **素材许可**：卡图为 Wizards 版权扫描件，沿用上游声明；新增素材只允许 CC0 / OFL / 自制，每个文件登记来源与许可（`docs/design/ASSETS.md`）；第三方文件下载前经用户确认。
9. **纪律**：本重构为实质档（大范围重构 + 对外入口变化）；每阶段写 runbook；完成后换模型独立审计；push 前经用户确认。

## 5. 技术方案（已定）

- **栈**：Vite 8 + TypeScript 6 + React 19（新表现层全面 React，不再"岛屿 + innerHTML"混用）；CSS 自定义属性设计 token；`@fontsource` 自托管字体；不新增渲染引擎依赖（three.js 随旧 stage 一起删除）。
- **2.5D 场景**：`<div class="table-viewport">`（`perspective`）→ `<div class="table-plane">`（`rotateX(~28deg)`，固定虚拟坐标系 1800×1100，按视口等比缩放）→ 桌面材质层 / 区域层 / **单一卡牌层**（每张可见卡一个 DOM 节点，按 id 保持身份，跨区域移动只改 transform，CSS 过渡即动画）/ 金币层；本家手牌在同一平面内用 `rotateX(-28deg)` 立起朝向镜头，实现"手牌→桌面"连续飞行。
- **特效层**：一个全屏 `<canvas>`（2D）只画有限时长的粒子/光弧/金币轨迹；WAAPI 驱动卡牌翻面、落地弹跳、横幅扫入；无空闲循环，减少动态偏好时降级为瞬移。
- **HUD**：顶部**流程轨**（轮局 N ▸ 前注 ▸ 翻注 ▸ 第 1/2/3 轮 ▸ 结算，当前步高亮、完成步打勾）+ **等待行**（"等待 余烬、翡翠下注…" 带座位头像脉冲 / "轮到你" 强调态）；底部**行动栏**（当前指令 + 确认按钮 + 工具按钮）；右侧/底部**卡牌详视**；桌上每个座位带状态绶带（等待 / 已下注 / 行动中 / 思考中）。
- **宿主**：`presentation/mount.ts` 导出 `mountTableUI`；本地对战宿主 `presentation/local/LocalMatch.ts`（机器人 + 引擎 + 回执，从 `tutorial.ts` 抽出、去掉课程）；枭熊宿主沿用 `legacy-page.ts` / `server-page.ts`。
- **入口**：`index.html` = 网站首页 + 对局（`src/site/main.ts`）；`table.html` = 枭熊牌桌页（原 `index.html`，`src/game/page.ts`）；`launcher.html`、`background.html` 保留；`practice.html` 删除。

## 6. 阶段计划与 DoD

| 阶段 | 内容 | DoD |
|---|---|---|
| 0 ✅ | 现状评估、决策、留痕层、视觉定稿 | `docs/2026-10-03-presentation-assessment.md`、`docs/design/VISUAL_SPEC.md`、本文件 |
| 1 ✅ | 新包骨架：token、字体、React 根、`mountTableUI` 同契约、网站入口、`LocalMatch` | 网站首页可开一局本地对战并渲染新牌桌骨架；`typecheck` + `build` 通过 |
| 2 ✅ | 牌桌场景：2.5D 平面、座位布局 2–6 人、区域、卡牌层、金币、牌库/弃牌/奖池/偿债池、手牌扇面、拖放与键盘 | 完整打完一局本地对战；桌面 + 手机截图 |
| 3 ✅ | HUD：流程轨、等待行、行动栏、选择面板、详视、设置、大厅（枭熊）、全能编辑器（枭熊） | 每个阶段都能回答"哪一步/等谁/下一步" |
| 4 ✅ | 特效与声音：发牌/翻注/能力/金币/结算/胜负；真实音效替换合成音 | 时序规格 §4.3 全部成立；减少动态偏好可用 |
| 5 ✅ | 网站壳与入口：首页、怎么玩、设置、启动器、公告、图标；枭熊 `table.html` 适配两种模式 | 四入口统一视觉；枭熊夹具冒烟通过 |
| 6 ✅ | 删除旧表现层与 three 依赖；移除 `verify:source`；重建浏览器冒烟；CI 绿 | `npm test`、`test:server`、新 `test:browser`、`test:server-browser` 全绿 |
| 7 ✅（push 待授权） | 独立审计（换模型）→ 修复 → 用户确认 → push | runbook §15–§16 含两轮裁决与整改（2026-10-03）；push 等用户授权 |

## 7. 素材清单与来源（需用户确认下载）

| 用途 | 建议来源 | 许可 | 备注 |
|---|---|---|---|
| 桌面木纹 / 皮革包边 / 毛毡 / 黄铜 | Poly Haven、ambientCG 的照片扫描 PBR 纹理 | CC0 | 只用 albedo + 可选 normal，压成 ≤ 2048 px webp |
| 中文显示字体 | `@fontsource/noto-serif-sc`（思源宋体） | OFL | npm 安装 |
| 拉丁/数字显示字体 | `@fontsource/cinzel` | OFL | npm 安装 |
| 正文字体 | `@fontsource/noto-sans-sc` | OFL | npm 安装 |
| 音效（发牌、翻牌、筹码、按钮、胜负） | Kenney Casino Audio / Interface Sounds | CC0 | 下载前确认 |
| 图标、绶带、装饰纹样 | 自制 SVG | 自制 | 代码矢量，允许 |
| 卡图 | 现有 `art/pack-20260910/`、`art/wheel-of-fate-v1/` | Wizards 版权 / 用户自制 | **不改不删** |

## 8. 开放问题

- 独立网站是否需要**在线多人**（非枭熊身份）？涉及登录/鉴权 → 红线，另立项。当前网站 = 本地对战（1 人 vs 机器人）。
- 枭熊全能编辑器与大厅：保留功能，视觉随新 HUD 重做；顺序排在网站之后。
- `src/modules/threeDragonAnte` 旧稳定频道：保留原样还是删除？默认保留，待用户决定。
- 依赖升级（Vite/ws 漏洞）：另立任务，不混入本轮。

## 9. 2026-10-04 持续上线目标（历史阶段，已由 §10 更新）

用户明确授权持续实施、推送和部署，无需逐步确认，目标为三项全部上线：

1. 独立三龙牌 Owlbear Rodeo 扩展。
2. 枭熊插件内部的三龙牌入口，保留进行中的旧稳定频道牌局。
3. 独立三龙牌多人网站：房间码或邀请链接加名字加入与重连；不做账号身份识别，房间内名字唯一，重名不能加入。

三项统一使用用户现有服务器 `obr.dnd.center` 的三龙牌权威服务。网站普通加入遇同名即拒绝；本浏览器凭据可恢复，无凭据仅通过明确重连恢复已离线同名座位。网站主持可管理牌桌，但不得取得他人私牌的全能视图或编辑牌局。

本节替代 §8 的“网站在线多人尚待用户决定”，并覆盖旧文档中的本次范围内 push/部署/服务端与网站接入改动须逐次询问的限制。仍保留：先 fetch 查证，不 force-push，不干扰另一机器的 `presentation/fx3d/` 工作，不生成 AI 美术，不泄私牌/密钥，不入库真实玩家数据，不全量覆盖混合 Suite 根或其他线上功能。

当前实现版本定为 `0.8.0(-dev)`；上线是否完成只按实际部署回执与验收证据判定。实质改动仍须留痕、双落遗留、独立审计；夹具与真实枭熊验收分开记录。执行记录见 `RUNBOOKS/2026-10-04_owlbear-deploy.md`。

## 10. 2026-10-04 用户调整：仅在线网站（当前任务正本）

用户明确要求完整删除本地对战，枭熊内嵌与独立插件全部改成线上网站跳转或链接，不再在枭熊内运行三龙牌。原“真实枭熊双账号游戏验收”因此退出当前完成条件；历史代码与旧玩家牌局不作热迁移。

1. 删除本地机器人宿主、首页入口与对应死分支；网站只通过权威服务进行多人对局。
2. Suite 的三龙牌入口保留上方三龙牌/功能开关/设置栏可操作，提供原生网站新窗口链接；独立插件无需 SDK 就能点击跳转。缓存旧嵌入页也提供链接。
3. 名字默认随机，并有重新随机按钮；不把游戏昵称当作浏览器个人姓名自动填充字段。已有本浏览器座位保持原名以便重连。
4. 网站帮助、音效、English、新开一局与界面体验控制可点击；进行中的离开/新局需要确认，刷新或关闭标签的进行中提示由 beforeunload 实现。
5. 网站房间最后一人断线后释放内存缓存，保留 60 秒重连宽限；每 5 秒清理超时无人房间及成员、凭据、回执、历史记录。创建后始终未连接的房间也清理，网站房间数量受 maxRooms 限制。有人在线则保持牌局。服务重启后重新给予宽限。旧枭熊持久牌局不适用新网站自动删除策略。

本次版本 `0.9.0(-dev)`。沿用持续实现、推送、服务端与定向部署授权；卡图/纯规则/协议/私牌边界/其他线上功能和 fx3d 工作继续保护。完成以网站实际交互、链接可用、Suite 顶栏保留、空房事务测试及线上发布证据判定；留痕见 `RUNBOOKS/2026-10-04_online-only.md`。

## 11. 2026-10-04 网站演出与铭牌反馈

用户实际体验反馈追加：买牌提示先出现，再翻价格牌与补牌；牌堆飞牌在其他牌上方；本家能力、回合切换、轮局结算不能被同版本回执取消；姓名与金币压缩在铭牌内；金币木牌与点数牌材质区分；网站通过不可见键序 `fuvtt` + Enter 打开全能。

版本 `0.9.1(-dev)`，继续沿用持续修复/推送/定向部署授权，保持仅在线网站与插件链接方向。全能复用既有私有投影/编辑契约，仅已认证当前网站房主可主动启用；普通玩家键序不授予权限，刷新/断线/房主交接撤销，名称与文本输入不触发，不把 Enter 当出牌。该明确需求覆盖 §10 之前的“所有网站guest永远禁用全能”政策，不改规则、协议字段、私牌公共投影、卡图、旧枭熊授权、其他宿主功能。

用户随后更新同名压缩包并明确它是此前卡顿修复，要求读取内部AI_CONTEXT后整合完善；允许必要的fx3d/性能整合及其生命周期整改。新HEAD2afca326的17条历史已隔离并入893e6c4，保持上述网站反馈与仅在线方向。原手掌照片/可选Volume、Wisps不因此自动扩为本次目标；真实弱机与实体手机人工体验仍独立验收。

完成以真实浏览器提交者/观察者和实际HTTP/WS时序、飞牌遮挡与几何、长名数字边界、全能正反授权/撤权、完整回归与独立审计及线上证据为准。留痕 `RUNBOOKS/2026-10-04_presentation-feedback.md`。

## 12. 2026-10-04 优先发布已正确修复的 bug

用户要求先部署正确的 bug 修复。此次只更新两个独立网站 stable/dev 和隐藏全能授权所需的三龙牌服务 bundle；枭熊/Suite 既有网站跳转保持，不重新发布其他插件。沿用同域 API、WSS、nginx 与 systemd，不改 .env。发布以 4f6fc6a 的反馈产品为基线，未完成回归的附件 2afca326/c3960047 特效另行整合、预览与审计，不能混入本次发布。两目标完整备份/属性保护/回滚、冻结源码对应 GPL 归档、完整 Linux CI 和独立审计、公网实际验收是上线门槛。执行与遗留见 `RUNBOOKS/2026-10-04_bug-hotfix-deploy.md`。

2026-10-04 16:07:25（Asia/Shanghai），0.9.1/0.9.1-dev已按本范围正式上线，冻结 `801daf580e9505a377dc97a544c4ad051ea029ac`。完整精确head CI37187336604、源码/包独立审核、真实部署前后全文件SHA及属性保护核验、一般公网12项通过；Suite/card/nginx/unit/relay保持。原SSH本机等待异常退出不能冒称applyexit0，成功由远端applied receipt与独立after确认。后续文档/诊断不改变线上冻结源。

隐藏权限公网8项尚未完整完成：run-gLOLN8前5项通过，刷新撤权阶段超时；新dc4yGB合法8码加入在201响应头后仍到12秒aborted，响应体读取/解析未按期限完成，原因待查证，不放宽原断言/期限、不包装通过。该专项、实体手机/弱设备与c3960047完整特效的后续构建、回归、独立审计继续作为遗留推进，新特效未随本次上线。

后续默认GPU控制的真实公网隐藏权限8/8已完成，原所有assert与期限保持，刷新/WSclose清场重连均通过；强制SwiftShader历史超时仍须查证，不能从单次成功宣布根因。正式工具的显式GPU模式与新FX的软件GL门控/lazy资源另验，不改变已上线801冻结源。
