# 2026-10-03 · three.js 特效层（fx3d）开场 runbook

## 0. 红线复述与档位

- 红线：规则引擎 / 协议 / 私牌边界 / 服务端 / 旧频道 / 卡面扫描件不碰；打包零外部请求；不用 AI 生成美术；新贴图只能来自 CC0（Kenney / Poly Haven / ambientCG），程序化 GLSL 不受此限；移植自 MIT 的 Elemental Sandbox 必须保留署名；push / 部署 / 合并由用户定。
- 档位：**实质**（对外可见的整层表现 + 新依赖 three.js）。流程：查证 → 方案（评审工作流）→ 小步实施 → 测试 + 真实截图 → runbook → 独立审计（换模型）。
- 用户决定（2026-10-03）：同意引入 three.js 做特效；要求每张牌独一份、分 发动 / 持续等待 / 结算 / 持续生成 / 改变环境，另含落牌尘土与拍桌的手。

## 1. 任务与范围

把现有贴图粒子层（Canvas 2D）升级为 three.js 特效层：
- 保留 DOM 卡牌 / 手牌扇面 / HUD / WebGL2 桌面材质；三者之间只多两张透明画布。
- 推进顺序：地基（相机对齐 + 两张画布 + 按需渲染）→ 通用图元工具箱 → 家族签名特效 → 单牌变体 → 传说牌定制 → 持续 / 环境效果 → 尘土与手。
- 回退：WebGL 不可用或减少动态 → 现有贴图粒子层；低档设备关掉光线步进与后期。

## 2. 地基（已完成，本 runbook 首个交付）

| 项 | 内容 | 证据 |
|---|---|---|
| 相机数学 | `fx3d/stage.ts`：把 `.tda-stage` scale → `.tda-viewport` perspective 1600 / origin 50% 30% → `.tda-plane` rotateX(tilt) 翻译成针孔相机（眼睛 (ox, −oy, d)，非对称视锥覆盖宿主）与平面组（rotateX(−tilt)，y 翻转）；含 `screenToPlane` 反解 | `.local-evidence/fx3d-align.mjs`：纯数学 vs DOM 标记，3 种视口 × 9 点（含 z≠0）最大误差 0.012 px |
| 舞台 | `fx3d/FxStage.ts`：空中画布（`.tda-fx3d-air`，z 52，盖在卡牌之上）+ 地面画布（`.tda-fx3d-ground`，在 `.tda-plane` 内 translateZ(0.5)，毛毡之上卡牌之下，正交相机直接用平面坐标）；按需渲染循环；DPR 上限按档位（high 1.5 / medium 1.25 / low 1）；SwiftShader / 减少动态 / 窄屏判 low | `tools/fx3d-alignment-check.mjs`（`npm run test:fx3d`）：真实相机 `stage.project` vs DOM，桌面 + 窄屏 8 点最大误差 0.011 px，零脚本错误、零外部请求 |
| 接线 | `TableScene` 挂两张画布并 `mountFxStage`；`TableApp` / `mount.ts` 透传 `onFx3d`；`PresenterHooks.fx3d()` 已留位（presenter 尚未使用）；`?fx3dDebug=1` 暴露 `window.__tdaFx3d` 并在锚点画调试环 / 立柱 | `.local-evidence/shots/fx3d-debug-desktop.png`：环在卡牌之下、立柱在卡牌之上，全部落在锚点 |
| 体积 | three 0.186.1 单独成包 514 kB（只随牌桌 mount 加载；background / launcher 仍只用 267 kB vendor，审计低项①已处理）；冒烟 20/20、自测 15/15 不变 | `npm run build` 输出；`dist/*.html` 的脚本引用 |

## 2.1 P0（评审一致的硬规定，2026-10-04 已落地）

| 项 | 内容 | 证据 |
|---|---|---|
| 地面相机手性 | 正交相机改 y 向上（−W/2, W/2, H/2, −H/2），与空中画布共用 `local(x,y,z)=(x−W/2, H/2−y, z)`；默认 FrontSide 网格不再被剔除（调试环去掉 DoubleSide 仍可见） | commit `2e8557e`，截图 `.local-evidence/shots/fx3d-debug-ground-yup.png` |
| 门控 | 用户三态开关 `localStorage["tda.fx"]`（auto / off / low / high）与 URL `?fx3d=0/1`；减少动态、枭熊紧凑弹窗（< 420×320）、软件 GL（SwiftShader）默认不建舞台，`?fx3d=1` 强制开（测试用）；root `.tda-shell` 的 `data-fx` 五态 three-high / three-medium / three-low / canvas2d / none | `FxStage.ts`、`TableApp.tsx`、`test:fx3d` 断言 |
| 上下文 | `webglcontextlost` 停循环、`restored` 重布局；destroy 时 `forceContextLoss()`（每页上限约 16 个上下文） | `FxStage.ts` |
| 测试 | `test:fx3d` 7 项：对齐 + data-fx + 画布可见时指针仍落在卡牌上 + 零错误零外部请求 + 分包闸（launcher / background 不引用 three chunk）；自测第 16 项：相机纯数学（中心、往返、视锥、离地方向） | `tools/fx3d-alignment-check.mjs`、`presentation-selftest.mjs` |
| 分包 | three 单独 chunk（见上表体积行） | `vite.config.ts` |

## 2.2 P1 第一批图元与接入（2026-10-04）

评审裁决（两位评审一致，详见工作流 `fx3d-understand-design` 的 judges 输出）：以 integration 稿的接入层为骨架（`composeFx` 适配器、presenter 零改动、`FxLayer` 不变），嫁接 fidelity 稿的正确性（y 向上地面相机、统一 `local()`、预乘输出 + 发光 alpha=最亮通道、无色调映射）与 mobile 稿的治理（桌形 SDF 裁剪、噪声像素预算、用户三态开关、自适应降档）。合成稿因额度中断尚未产出，先按一致项推进。

| 文件 | 内容 |
|---|---|
| `fx3d/shaders/lib.ts` | 共用 GLSL：hash / value noise / fbm3、SDF（圆、环、圆角矩形、椭圆、桌形、线段）、抗锯齿填充 / 描边、包络、桌形裁剪 `tableMask`、预乘输出 `solidOut` / `glowOut` |
| `fx3d/palette.ts` | 家族色来自 tokens（ember / tide / grove / arcane / crown / gold / dust），派生亮色与深色；不引入新饱和色 |
| `fx3d/textures.ts` | Kenney 软贴图 → three 纹理（sRGB，mipmap） |
| `primitives/GroundMark.ts` | 地面法阵（外环 / 内环 / 12 刻度 / 8 个按 seed 变体的符文，符文环旋转、内环反向、噪声呼吸；可驻留 `release()`）与单环扩散（mode 1）；乘桌形裁剪 |
| `primitives/Pillar.ts` | 竖直光柱：两张十字立面（欧拉 ZYX：先立起再偏航），底亮顶淡，噪声条纹上流 |
| `primitives/Burst.ts` | GPU 粒子爆发：Points + 顶点着色器解析运动（阻尼 + 重力，z 为桌面法线），按贴图分组每种一次 draw call |
| `primitives/Beam.ts` | 光束飘带：顶点着色器沿抬升贝塞尔摆放的带子，头亮尾淡、宽度收窄 |
| `fx3d/composeFx.ts` | 适配器：有舞台时 sigil（法阵 + 光柱 + 上升粒子）/ ring / beam（飘带 + 命中爆发）/ burst / flare 走 three，其余仍走 2D；按档位缩放粒子数 |
| `FxStage` | `tableUniforms()`（毛毡半尺寸、桌形）、`setShape()`、`pointScale()`、NoToneMapping、effect 异常改为 console.error 并移除 |
| `TableScene` | 一个 effect 里挂 2D 层 + 舞台并合成；`?fx3dGallery=1` 画廊（开局 0.8 s 后在固定锚点放五个图元） |

证据：`.local-evidence/shots/fx3d-gallery-1.png`（法阵 + 紫色光柱、金色爆发 + 光柱、绿色扩散环、红色粒子、蓝色飘带头）、`fx3d-gallery-2.png`（0.5 s 后法阵驻留）。测试：冒烟 20/20、`test:fx3d` 7/7、`npm test` 8/8（自测 16 项）。

## 2.3 P2 家族签名脚本（2026-10-04）

设计定稿：`RUNBOOKS/2026-10-04_fx3d-design.md`（合成稿）。本期落地其中的脚本模型第一版与 §5 的家族签名：

| 文件 | 内容 |
|---|---|
| `fx3d/kit.ts` | 工具箱：mark / ring / claw / pillar / burst / beam / emitter / strike（飘带到站爆发）/ volley（多目标错开齐射），按档位缩放粒子数 |
| `fx3d/scripts/types.ts` | `ScriptCtx`（只含公共信息：cue、公共事件、平面坐标锚点、家族色、点数调幅、目标 / 其他座位）与 `FamilyScript.cast` |
| `fx3d/scripts/families.ts` | 41 个家族各一段编排（焰 / 潮 / 林 / 铜绿 / 秘 / 冠 / 骨 七组）：法阵形态（星角 / 肋 / 钩 / 刻度 / 菱 / 尖锐）+ 光柱 + 扩散环 + 爪痕 + 飘带 + 爆发；标准龙按点数调幅（半径 ×(0.85+0.3k)、粒子 ×(0.8+0.4k)、肋 4+4k） |
| `GroundMark` | 新增形态 uniform（uPoints / uRibs / uHooks / uTicks / uRhombus / uSharp），n 角星用极坐标三角波 |
| `FxKind` | 增加 `verdigris`（铜 / 青铜 / 黄铜）与 `necro`（龙巫妖）；tokens / 说明层 / 场地 CSS 同步；2D 层也有对应贴图色 |
| `composeFx.script()` | 把 `PowerFxContext` 的视口像素锚点换成平面坐标，查家族脚本（缺省 `defaultScript`），异常只记日志 |
| `powers.ts` | 一行钩子：`fx.script` 存在且返回 true → 跳过 2D 编排（presenter 零改动） |

证据：`.local-evidence/fx3d-scripts-gallery.mjs`（`?fx3dGallery=scripts`，页面内用 DOM 锚点造上下文，依次跑 red / blue / green / copper / gold / prophet / bahamut / dracolich，脚本时长 0.9–1.7 s，零错误）→ `shots/fx3d-script-*.png`。测试：冒烟 20/20、`test:fx3d` 7/7、`npm test` 8/8、`test:server-browser` 4/4。

未做（下一期）：等待选择的 W 变体（等自己 / 等对手、按选择类型）、场地 G / E 按种类的驻留态、拼点 / 特殊牌阵的三种法阵变体、沙盒的 Shell / Collar / Wisps / Volume 图元、画质开关 UI 与自适应降档。

## 2.4 P3 驻留态：等待选择 / 场地 / 牌阵与传说到场形态（2026-10-04）

| 项 | 做法 |
|---|---|
| `AmbientSpec` | 可选 `hold: { who, code, from }`（presenter 多传一行，不改时序）与 `field: kind`（FieldLayer 多传一项） |
| 等待选择 W | 等自己：本家手牌下驻留法阵（按选择码：索要 → 24 刻度环；去向 → 奖池再加一枚金环；顺序 → 5 角；挑牌 → 6 角 + 菱）+ 3 倍密度上升粒子；等对手：对手手牌下法阵 + 源牌到等待者每 1.4 s 一条低亮度系绳飘带 |
| 场地 G / E | 德鲁伊：160 高处落叶 + 三叶藤纹；祭司：暖光上升 + 四角印；龙巫妖：骨色磷火自上落 + 骨色钩印（FieldLayer 的 2D 色也改 necro）；大法师：秘法 30 刻度环；君主 / 商人 / 战争领主：各自小印 + 粒子；全局效果印记半径 240 在桌心，驻留法阵统一调暗 0.6 |
| 牌阵 / 传说到场 | 适配器按半径与色选形态：牌阵 170 → strength 4 角尖 + 菱 / mortal 5 角 + 菱 / color 12 角冠；传说到场 150 → 7 角 + 14 肋 + 28 刻度 + 钩 |
| Emitter | 新增 `z0` 起始高度 |

证据：`shots/fx3d-gallery-2/3.png`（德鲁伊藤纹、对手手牌索要环 + 系绳）。测试：冒烟 20/20、`test:fx3d` 7/7、`npm test` 8/8、`test:server-browser` 4/4。

## 3. 下一步（设计评审工作流 `fx3d-understand-design` 的产出落地后填写）

- §4 设计定稿（画布 / 渲染策略 / 图元工具箱 / 脚本相位机 / 家族签名表 / 分期）
- §5 各期实施记录与证据
- §6 独立审计

## 4. DoD

- 每期：typecheck 0、`npm test` / `test:server` / `test:browser` / `test:server-browser` / `test:fx3d` 全绿；真实截图与（必要时）录屏；bundle 增量记录；减少动态与 WebGL 丢失回退可演示。
- 终局：全部卡牌都有独一份的发动 / 结算特效，持续与环境类有驻留态与自然消散；用户在本地浏览器验收；独立审计通过。
