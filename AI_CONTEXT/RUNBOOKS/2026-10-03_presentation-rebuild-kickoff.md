# 开场白计划 · 三龙牌 · 表现层破坏性重构（阶段 0–1 起步） · 2026-10-03

## 1. 任务 & 范围
- 一句话目标：按 `AI_CONTEXT/GOAL.md` 把表现层重做成写实风 2.5D，网站为核心；本会话完成阶段 0（留痕层 + 视觉定稿）并推进阶段 1–2（新包骨架 + 牌桌场景第一版）。
- 本次碰：新建 `AI_CONTEXT/`、`CLAUDE.md`、`AGENTS.md` 顶部指针块、`docs/design/VISUAL_SPEC.md`、`docs/2026-10-03-presentation-assessment.md`；新建 `extensions/three-dragon-ante/src/presentation/**`、`src/site/**`；改 `vite.config.ts` 入口、`index.html`/`table.html`、`package.json` 字体依赖；工作区 `D:\my_code\PROJECTS.md` 加一条。
- 本次不碰：`rules/**`、`protocol.ts`、`wire.ts`、`private-channel.ts`、`controller*`、`server/**`、`src/modules/**`、`art/**`；不删旧表现层文件（阶段 6 再删）；不 push。
- 档位判定：**实质**。理由：命中"大范围重构"与"对外入口变化"（`index.html` 语义改变、manifest 相关）。用户 2026-10-03 已明确授权在本地推进；push 仍需确认。
- 复述红线：规则纯函数；投影不泄私牌；提交≠接受；卡图不改不删；不用 AI 美术；零外部请求；第三方素材下载先确认；push / 合并 / 部署先确认。

## 2. 冷启动已读
- [x] 全局通用纪律（自动加载）
- [x] 上游 `AGENTS.md`、`README.md`、`docs/EXTRACTION.md`、`docs/STATUS.md`、`stage/README.md`
- [x] 全部表现层源码与规则/协议契约（见评估报告）
- [x] 用户工作流模板 `D:\my_code\ai-workflow-project-template`

## 3. 计划步骤
1. 仓库迁入 `D:\my_code\three-dragon-ante`，建分支 `rebuild/presentation`，`npm ci`。
2. 写 `AI_CONTEXT/`（INDEX / GOAL / DOMAIN / MEMORY / AUDIT / TODO / 本 kickoff）、`CLAUDE.md`、`AGENTS.md` 指针块、`docs/design/VISUAL_SPEC.md`，归档评估报告，注册 `PROJECTS.md`。
3. 阶段 1：新建 `src/presentation/`（token、字体、React 根、`mountTableUI` 同契约、`LocalMatch`）与 `src/site/`；`index.html` 变网站入口，枭熊牌桌页改 `table.html`；`vite.config.ts` 同步。
4. 阶段 2 第一版：2.5D 平面、座位布局、区域、卡牌层、金币、手牌扇面、拖放/键盘；流程轨与等待行、行动栏、选择面板、详视；翻注与能力说明的基础序列。
5. `npm run typecheck`、`npm run build`、Playwright 截图（桌面 1440×900、手机 390×844）核对。
6. commit；更新 `MEMORY.md` §B 与 `TODO.md`；本文件补执行记录。

## 4. 验证 & 完成标准（DoD）
- `npm run typecheck` 与 `npm run build` 通过；`npm test` 仍通过（规则/控制器未动）。
- 网站首页可开一局本地对战，能完成前注 → 翻注 → 出牌 → 能力 → 结算的基本流程，桌面与手机截图留存 `.local-evidence/`。
- 新 UI 在任何截图中不出现他人手牌正面。
- 旧浏览器冒烟暂不作为本阶段判据（阶段 6 重建）。

## 5. 待用户确认（一次只问一个最关键的）
- 第三方 CC0 纹理与音效的下载（文件清单见 `AI_CONTEXT/TODO.md` 第一条）。推荐：同意下载 Poly Haven 木纹/皮革/毛毡 3 组 + Kenney Casino Audio 1 包。

## 6. 执行记录
- 2026-10-03 13:20–13:40：评估、截图、报告（会话临时目录）。
- 2026-10-03 14:00：仓库迁入 `D:\my_code\three-dragon-ante`；分支 `rebuild/presentation`；留痕层、`GOAL.md`、`docs/design/VISUAL_SPEC.md` 写入；注册 `D:\my_code\PROJECTS.md`。
- 2026-10-03 14:10–15:30：阶段 1 + 阶段 2 第一版落地（见下）。

## 7. 本次改动（阶段 1 + 阶段 2 第一版）

**新建 `extensions/three-dragon-ante/src/presentation/`**（约 1 900 行）：
- `mount.ts`：`mountTableUI(root, deps)`，与旧 `game/ui.ts` 同契约（update / gesture / language / restore / draft / waitingForReceipt / presentationBusy / getAnchor / suspend / resume / failed / destroy）；回执匹配逻辑原样移植（提交 ≠ 接受）。
- `app/store.ts`（本地 UI 状态）、`app/controller.ts`（输入 → `TableUICommand`，含拖放、键盘、选择、手势节流）、`app/presenter.ts`（演出串行调度：翻注四段 → 能力聚光 → 粒子 → 金币弧线 → 横幅 / 计分板，严格有限时长）。
- `model/layout.ts`（1800×1100 / 1100×1500 平面坐标、2–6 人座位、卡牌位姿、手牌扇面）、`model/flow.ts`（流程轨步骤、座位绶带、等待行文案）、`model/cues.ts`（公共事件 → 翻注 / 能力 / 金币 / 回合提示，复用 `game/power-sequence.ts`）。
- `scene/`：`TableScene`（透视视口 + 倾斜平面 + 特效画布 + 拖动影子）、`CardLayer`（按 id 保持节点、入场来源、翻注前面朝下）、`CardNode`（CSS 变量位姿、3D 翻面）、`CardBack`（自制矢量三龙纹章卡背）、`SeatBlock`（黄铜铭牌 + 绶带 + 槽位）、`CoinStack`（真实硬币裁图堆叠）。
- `hud/`：流程轨、等待行、行动栏、选择面板、详视、阶段横幅、能力聚光层、计分板、终局面板、最小大厅。
- `fx/particles.ts`（有限时长粒子 / 金币弧线 / 涟漪 / 震动）、`fx/motion.ts`、`audio/player.ts`（静音占位，等真实 CC0 音效）。
- `theme/`：token、基底、`@fontsource` 自托管字体（Noto Serif SC / Noto Sans SC / Cinzel，OFL）。
- `local/LocalMatch.ts`：本地对战宿主（真实引擎 + 机器人 + 回执），从旧 `tutorial.ts` 抽出并去掉课程。

**新建 `src/site/`**：`main.ts`、`SiteApp.tsx`（首页 / 对局 / 怎么玩）、`rules.ts`、`site.css`。
**入口变更**：`index.html` = 独立网站；枭熊牌桌页移到 `table.html`；`vite.config.ts` 增加 `site` 入口；`src/game/index.ts` 两处 `assetUrl("index.html")` → `table.html`。
**依赖**：新增 `@fontsource/noto-serif-sc`、`@fontsource/noto-sans-sc`、`@fontsource/cinzel` 各 5.2.6（exact）。

## 8. 决策与被否方案
- 卡牌层沿用旧 stage 的"每 id 一节点 + reconcile"模型，用 DOM transform 过渡替代 three.js 动画（理由见 MEMORY §A）。
- 本家手牌与桌面同一平面、用 `rotateX(-tilt)` 立起，而不是另起 DOM 手牌层：保证手牌 → 桌面的连续飞行与唯一的拖放命中模型。
- 入场动画用内联 CSS 变量而不是 React state：避免双渲染；教训：动画结束必须写回目标位姿而不是删属性（删了 React 不会重写，卡牌掉到平面原点）。
- 演出调度 v1 在"落地时"就把新投影整体显示（含金币数字），能力说明关闭后再放粒子与金币弧线；与 GOAL §4.3"效果在说明关闭后才发生"尚有差距，记入 TODO 阶段 4 处理。

## 9. 验证结果
- `npm run typecheck` 通过；`npm run build` 通过（新增 `site` chunk 75 kB gzip 26 kB；旧 UI 与 three 仍在包内，阶段 6 删除）。
- `npm test` 7/7 通过（规则 / 控制器 / 隐私未动）。
- Playwright + Edge 跑生产构建：桌面 1440×900 与手机 390×844 各自完成 首页 → 开局 → 选牌放暗置 → 翻注 → 出牌 → 能力聚光层 → 选择面板，截图在 `.local-evidence/shots/site/`；外部请求 0、脚本错误 0。
- 未验证：枭熊宿主页（仍用旧 UI，未切换）；减少动态偏好；6 人桌布局只有模型没有截图；真实拖放只在代码路径上实现，截图用的是点选 + 点区域。

## 10. 运行态
本地分支 `rebuild/presentation`，未 push；线上入口未动。

## 11. 遗留 TODO（双落 `AI_CONTEXT/TODO.md`）
- 阶段 2 收尾：6 人桌截图核对；拖放真机验证；选择面板不要盖住手牌；手机端详视改抽屉；favicon 与新图标。
- 阶段 4：演出时序严格对齐 GOAL §4.3（说明关闭后再变更金币/卡牌效果）；真实音效；更多粒子形态。
- 阶段 5：枭熊 `table.html` 切换到新包并适配两种模式；大厅与全能编辑器视觉。
- 阶段 6：删旧表现层与 three；移除 verify:source；重建浏览器冒烟。

## 12. 是否需要独立审计
本阶段为骨架落地，建议在阶段 2 收尾（6 人桌 + 拖放 + 时序）后做第一次独立审计；中立开场词见 `AUDIT.md`。

## 13. 第二轮（同日）· 去 AI 感 + 真实材质

**触发**：用户看过第一版截图后要求：文案去 AI 腔；视觉去高光渐变；材质朝 Unreal 式写照 + 法线浮雕；并同意下载 CC0 素材。

**研究**：网上"AI slop / AI 味"判别文章 7 篇 + 游戏 UI 材质参考 + SVG/WebGL 法线光照资料，提炼为 `docs/design/ANTI_AI_FEEL.md`（信号清单、本项目自检、12 条规则、材质做法）。

**素材**（全部 CC0，登记 `docs/design/ASSETS.md`，原始 zip 与哈希留在 `.local-evidence/downloads/`）：Poly Haven `dark_wood`（桌面）、`medieval_wood`（地板）、`brown_leather`（包边 / 卡背 / 皮革条）、`metal_plate`（备用）；ambientCG `Fabric034`（毛毡，灰底着色器染绿）、`Paper006`（纸面板）；Kenney Casino Audio 10 条。Pillow 压成 webp（表面材质 1024px，UI 材质 768px），AO 图弃用；贴图合计 2.5 MB。

**代码**：
- `scene/surface-gl.ts` + `scene/TableSurface.tsx`：WebGL2 片元着色器，圆角矩形 SDF 划分橡木沿 / 皮革压边 / 毛毡，三组颜色 + 法线 + 粗糙度贴图，一盏定向光 + 一盏暖色点光，sRGB ↔ 线性，接触阴影与暗角；只在尺寸 / 贴图变化时画一帧。无 WebGL 回退 CSS 照片材质。
- `theme/materials.css`：照片材质变量与 `.mat-*`；`base.css` / `scene.css` / `hud.css` / `site.css` 全部重写为无渐变、无发光、1px 倒角；黄铜 = `dark_wood` + 黄铜底色 `overlay`。
- `i18n.ts`：全部提示改为短语；删 `siteTagline` / `dragHint` / `continueHint`；聚光层改"继续"按钮；键盘说明移入新的帮助面板（顶栏"帮助"）。
- `CardBack.tsx`：皮革照片 + 平涂两色纹章。`audio/player.ts`：接真实音效；`presenter.ts` 在出牌 / 抽牌落地时发物理音。
- `ChoicePanel` 在聚光层 / 计分板打开时隐藏。

**验证**：typecheck / build 通过；`gl-diag.mjs` 报 `surface: webgl 1144x699`（修掉一处 GLSL 参数类型错误后）；桌面 + 手机走查全程通过，外部请求 0、错误 0；截图 `.local-evidence/shots/site/`。

**遗留**：见 `TODO.md`（去 AI 感逐项复查、材质细化、6 人桌、拖放真机、时序对齐）。

## 14. 第三轮（同日）· 阶段 2 收尾、阶段 4 时序、阶段 5 枭熊、阶段 6 删旧

- **阶段 2 收尾**：`.local-evidence/shots/six-and-drag.mjs` 核对六人桌（桌面 / 手机）、真实指针拖拽（影子跟随、落入暗置、回执清空 pending）、减少动态偏好流程；全部通过。
- **阶段 4 时序**（commit `2c2df3f`）：presenter 先显示"落地帧"（上一帧 + 刚打出的牌进牌阵），说明关闭后才应用完整投影；`goldHold` 把金币数字冻结到弧线落地；翻注与计分板同样冻结。
- **阶段 5**：`legacy-page.ts` / `server-page.ts` 改挂新包（去掉教程 / 引导覆盖层，加 `onLanguage`）；大厅补齐主持设置（初始金币 / 手牌、规则、牌组、十张特殊牌选择、踢人、移交、重试）；全能编辑器移植为 `hud/Editor.tsx`；顶栏加全能 / 展开缩小 / 返回地图；`launcher.html`、`announcement.html`、`icon.svg` 重做；挂载根镜像 `data-pending-action / data-omniscient / data-busy / data-mode` 供宿主与测试读取。
- **阶段 6**：删除旧表现层 49 个文件（`ui.ts`、`react/`、`stage/`、合成音、程序化纹理、教程、引导、练习页、旧 selftest、`verify-source.mjs`、`THREE-LICENSE.txt`）；移除 `three` / `@types/three` 依赖、`verify:source` 脚本与 CI 步骤、`practice` 入口；`tools/production-practice-smoke.mjs` 重写为独立网站冒烟；`tools/three-dragon-server-browser.mjs` 改为新选择器并增加 `/assets/` 静态路由与 npm 包 CSS 解析；`README.md` 重写，`docs/STATUS.md` / `docs/EXTRACTION.md` 更新。
- **坑**：React 19 的 `root.unmount()` 可能推迟到当前提交之后，宿主销毁时再 `replaceChildren()` 会让它稍后 `removeChild` 报 NotFoundError；`mount.ts` 的 `destroy()` 不再手动清空容器。
- **验证**：`npm run typecheck`、`npm run build`、`npm test` 7/7、`npm run build:server`、`npm run test:server` 2/2、`npm run test:browser` 10/10（桌面 + 手机，surface webgl，零外部请求、零错误）、`npm run test:server-browser` 4/4（四客户端 + 本地 ws/sqlite，GM 全能边界、刷新恢复）。
- **未验证**：真实枭熊房间与实体手机；`src/modules/threeDragonAnte` 旧频道页面未切换（保留旧 UI）。
