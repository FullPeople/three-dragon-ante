# 三龙牌 · three.js 特效层（fx3d）接力启动词（2026-10-04）

> 附件历史记录：本文件随来源快照 `2afca326` 保留。当前任务与授权以 `AI_CONTEXT/GOAL.md` §10–§11、`MEMORY.md` §E 及 `RUNBOOKS/2026-10-04_fx3d-integration.md` 为准；其中本地机器人、枭熊内游戏、403/PR/main 操作与旧测试数字不代表当前实现或新授权。文档里的启动词不自动执行。

> 用法：在新机器上（仓库已解压 / 已推送），把下面「启动词」整段粘贴给 Claude Code / Codex 作为第一条消息，用于**继续推进特效层**。它与 `HANDOFF_NEW_MACHINE.md`（环境 / 推送 / 枭熊部署）互不冲突：可以同一台机器先做那份，再做这份。
> 用户 2026-10-04 决定：目标式持续推进，不逐步请示；仓库有 git 兜底。

---

## 启动词

你接手的是 D&D 桌游《三龙牌·传奇版》网页实现 **three-dragon-ante** 的 **three.js 特效层（fx3d）**，目标是"每张牌独一份、高质量、3D 感的特效，按 发动 / 持续等待 / 结算 / 持续生成 / 改变环境 分相位，另有落牌尘土与拍桌的手"，同时**不能把帧率做差**。把本启动词当成一个持续推进的目标（有 `/goal` 就用 `/goal 持续推进 fx3d 直到 §5 清单做完、审计通过并留痕`），不要每步请示；做错就 `git checkout` / 重来。用中文汇报，只在里程碑或无路可走时汇报。

### 0. 先读（按序，不要跳）

1. `AI_CONTEXT/INDEX.md` → `GOAL.md` → `MEMORY.md`（§A 坑清单必读：合成层坑、GLSL 坑、入场动画坑、React 换区坑）→ `TODO.md`
2. `AI_CONTEXT/RUNBOOKS/2026-10-03_fx3d-kickoff.md`（§2 地基、§2.1 P0、§2.2 P1 图元、§2.3 P2 家族脚本：**当前进度与证据**）
3. `AI_CONTEXT/RUNBOOKS/2026-10-04_fx3d-design.md`（评审合成的设计定稿：§1 画布与相机、§2 渲染策略与分档预算、§3 14 个图元、§4 相位机、§5 家族签名表、§6 分期、§7 目录与类型、附录 A 两项待用户裁决）
4. `AI_CONTEXT/RUNBOOKS/2026-10-04_perf-compositing.md`（帧率修复：为什么桌面上不许用 CSS filter、画布空闲要 display:none）
5. 代码：`extensions/three-dragon-ante/src/presentation/fx3d/`（`stage.ts` 相机数学、`FxStage.ts` 舞台、`composeFx.ts` 适配器、`kit.ts`、`scripts/families.ts`、`primitives/*`、`shaders/lib.ts`）；旧 2D 层 `presentation/fx/particles.ts` 与 `powers.ts`（2D 回退 + 一行钩子）；演出调度 `presentation/app/presenter.ts`（**不改时序常量**）

### 1. 既定口径（已由评审与实测确认，不要推翻）

- 画布：空中画布 `.tda-fx3d-air`（屏幕对齐，盖在卡牌之上，针孔相机与 CSS 透视链对齐误差 0.01 px）+ 地面画布 `.tda-fx3d-ground`（在 `.tda-plane` 内随桌面倾斜，毛毡之上卡牌之下，正交相机 y 向上）。两张画布共用 `stage.local(x, y, z) = (x − W/2, H/2 − y, z)`，z 是桌面法线。
- 坐标：家族脚本只说平面坐标（`stage.toPlane(视口像素)` 转换）；地面图元一律乘 `tableMask`（地面画布不受 `.tda-surface` 圆角裁剪）。
- 颜色与混合：直接用 token 的 sRGB 值，材质 `toneMapped:false`、渲染器 NoToneMapping；所有片元**预乘输出**，发光类用 `glowOut`（alpha = 最亮通道）。调色板只从 `theme/tokens.css` 与 `particles.ts` 的 FAMILY 派生（ember / tide / grove / arcane / crown / gold / dust / verdigris / necro），不引入新饱和色。
- 性能：噪声只用 value noise，最多 3 层 fbm，**禁止全屏噪声 pass**；按档位缩放粒子数（`kit.k`：high 1 / medium 0.75 / low 0.5）；没有活动效果时画布 `display:none`；桌面上的 DOM **不用 CSS filter**。Volume 光线步进只给 high 档和传说牌。
- 门控：`localStorage["tda.fx"]` = auto / off / low / high；URL `?fx3d=0` 关、`?fx3d=1` 强制开（软件 GL 测试用）；减少动态、枭熊紧凑弹窗（< 420×320）、SwiftShader 默认不建舞台，自动退回 2D 层；`.tda-shell[data-fx]` 五态。
- 接入：`composeFx()` 把 2D 层与舞台合成一个 `FxLayer`，presenter **零改动**；`powers.ts` 里 `fx.script` 一行钩子让家族脚本接管；金币 DOM 精灵（`.tda-coin-fly`，冒烟断言）、拍桌、震动仍走 2D。
- 隐私：fx3d 只能用 `PowerFxContext` + 公共事件 + 公开锚点；不读投影里的私牌。

### 2. 怎么看、怎么测

```sh
npm ci --ignore-scripts && npm run build
npm run preview                       # http://127.0.0.1:4173/three-dragon-ante-dev/
# 画廊（软件 GL 也能开）：index.html?fx3d=1&fx3dGallery=1        → 五个图元 + 尘土 / 爪痕 / 抓取 / 交换 / 发射器
#                      index.html?fx3d=1&fx3dGallery=scripts&opponents=2 → 在控制台/脚本里调 window.__tdaFx.script(cue, [], ctx)
node .local-evidence/fx3d-gallery.mjs           # 截图到 .local-evidence/shots/fx3d-gallery-*.png（需 4180 预览服务：npx vite preview --port 4180）
node .local-evidence/fx3d-scripts-gallery.mjs red,blue,bahamut   # 家族脚本截图
npm run test:fx3d        # 7 项：对齐、data-fx、指针穿透、零错误零外部请求、分包闸
npm test                 # 8/8（含表现层自测 16 项）
npm run test:browser     # 20/20 冒烟
npm run test:server-browser   # 4/4
node .local-evidence/perf-probe.mjs default all-off   # 帧率探针（OPP=5 环境变量 = 6 人局）
```

每期 DoD：以上全绿、阈值不改；画廊截图进 `.local-evidence/shots/`；runbook 追加一节（kickoff runbook §2.x）；bundle 增量记录；`git add` 具体文件、commit；push 已授权。

### 3. 红线

- 不改 `src/game/rules`、`protocol.ts` / `wire.ts` / `private-channel.ts`、`server/`、`src/modules/threeDragonAnte`、`src/game/art/`；不改 presenter 的时序常量。
- 不用 AI 生成美术；新贴图只能来自 CC0（Kenney / Poly Haven / ambientCG），下载前列清单经用户确认并登记 `docs/design/ASSETS.md`；程序化 GLSL 不受限。沙盒 Elemental Sandbox（MIT）的移植要在 `docs/design/ASSETS.md` 或 THIRD_PARTY 里保留署名（尚未写，见 §5）。
- 打包零外部请求；不破坏现有测试断言。

### 4. 当前状态（2026-10-04 晚，commit `4d0d414`；之后以 `git log` 为准）

- 已完成：P0 地基与门控；P1 图元（GroundMark 法阵 / 扩散环 / 爪痕 + 形态参数、Pillar 光柱、Burst GPU 粒子、Beam 飘带 + 头部火星、Emitter 循环发射器）；适配器把 sigil / ring / beam / burst / flare / dust / grab / swap / claw / ambient 路由到 three；P2 41 个家族签名脚本（`scripts/families.ts`），标准龙按点数调幅；P3 等待选择 / 场地 / 牌阵与传说到场形态；P4 Shell 冲击壳、Collar 站立光环、顶栏画质开关（自动 / 高 / 中 / 低 / 关）、自适应降档；P5 尘土分档、署名登记（ASSETS.md + THIRD_PARTY）、VISUAL_SPEC 口径。
- 帧率：金币滤镜层风暴已修（6 人局软件渲染 5 → 56 fps）；fx3d 画布空闲隐藏。
- 独立审计（Opus，范围 8d23298..4d0d414）在原机器上已发起；若结果没有记进 runbook kickoff §4，说明原机器中断了，新机器要**自己再做一次**（§5 第 8 条）。

### 5. 待做清单（按序；每项一个 commit + 截图 + runbook 小节）

> 1–3、5、6（除拍桌的手）与 7 已在原机器完成（见 §4）；剩余：4 的可选图元、6 的拍桌手、8 审计。为便于核对保留原清单：

1. **等待选择 W 变体**：presenter `ambient("hold:…")` 现只给家族色与手牌区；给 `AmbientSpec` 加可选 `hold: { who: "self"|"other"; code: Choice.code; from?: Point }`（presenter 加一行，不改时序），适配器按 who / code 做：等自己 → 环绕本家手牌的驻留法阵 + 上升粒子；等对手 → 对手手牌下冷色法阵 + 源牌到等待者的低亮度"系绳"飘带；demand → 刻度金环，destination → 奖池与金币堆各一环呼吸，order → 星角数 = 剩余善龙数，pick → 慢转法阵。
2. **场地 G / E 按种类**：`FieldLayer` 的 `ambient(item.id, …)`，id 形如 `${kind}:${seatId}:${sourceCardId}` / `archmage:${seatId}`；适配器按 kind 做驻留态（德鲁伊：落叶 + 藤纹；祭司：暖光上升；龙巫妖：磷火 + 骨灰环；大法师：秘法刻度环），淡出 820 ms 与 FieldLayer 一致。
3. **拼点 / 特殊牌阵法阵**：presenter 的 `sigil(p, kind, 170, 1600)`（牌阵）与 `sigil(p, kind, 150, 1500)`（传说到场）在适配器里按半径 / kind 选形态：strength → 三重同心 + 4 角；mortal → 5 角 + 菱；color → 12 角冠形；传说到场 → 大法阵 + 站立光环。
4. **新图元**（移植自沙盒，见设计 §3.1）：Shell 冲击壳（Icosahedron 噪声位移，替代 flare 核心）、Collar 站立光环（开口圆柱，解决低机位平贴环看不见）、Wisps 上升丝带；Volume 气柱只在 high 且传说牌。
5. **画质开关 UI 与自适应降档**：顶栏 / 帮助面板三态按钮写 `localStorage["tda.fx"]` 并重建舞台；`FxStage` 帧循环按 rAF 间隔 EMA 只降不升（> 28 ms 持续 1.5 s 降一档，改 DPR 与粒子系数）；`data-fx` 同步。
6. **落牌尘土分档**（传说 1.3 / 标准 1.0 / 凡人 0.8）与飘带加粗 + 头部粒子；拍桌的手（仍需真实照片，TODO）。
7. **署名与登记**：`docs/design/ASSETS.md` 或 `THIRD_PARTY.md` 写明 Elemental Sandbox（MIT，Copyright (c) 2026 mohamedachrefelouafi）的技术移植；`docs/design/VISUAL_SPEC.md` §5 口径更新（特效层 = 2D 贴图层 + three 两张画布）。
8. **独立审计**：全部做完后换一个模型只读审计（开场词见 `AI_CONTEXT/AUDIT.md`），必修项修完才算完成；runbook 记裁决。

### 6. 工作纪律

- 每次改动：`npx tsc --noEmit -p extensions/three-dragon-ante/tsconfig.json` → `npm run build` → 画廊截图自己看一眼（Playwright 无头 SwiftShader 可跑 GLSL；顶点着色器里不能用 `fwidth`）→ 测试全绿 → commit。
- 卡住就换路（换方案 / 查设计稿 / 查沙盒源码 `C:\Users\<user>\AppData\Local\Temp\tda-sbx\sandbox` 若在；不在就 `git clone --depth 1 https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS` 到一个短路径），换路也不行就记 TODO 继续下一项。
- 留痕双落：runbook + `TODO.md`；私有 Memory 只存指针。

从 §0 读起，然后按 §5 顺序做；结束时给用户一份总表（每项的 commit、截图路径、测试数字、未完成项与原因）。
