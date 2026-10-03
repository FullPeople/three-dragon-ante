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
| 体积 | vendor chunk 782 kB（three 0.186.1 含在内，tree-shaken）；冒烟 20/20、自测 15/15 不变 | `npm run build` 输出 |

## 3. 下一步（设计评审工作流 `fx3d-understand-design` 的产出落地后填写）

- §4 设计定稿（画布 / 渲染策略 / 图元工具箱 / 脚本相位机 / 家族签名表 / 分期）
- §5 各期实施记录与证据
- §6 独立审计

## 4. DoD

- 每期：typecheck 0、`npm test` / `test:server` / `test:browser` / `test:server-browser` / `test:fx3d` 全绿；真实截图与（必要时）录屏；bundle 增量记录；减少动态与 WebGL 丢失回退可演示。
- 终局：全部卡牌都有独一份的发动 / 结算特效，持续与环境类有驻留态与自然消散；用户在本地浏览器验收；独立审计通过。
