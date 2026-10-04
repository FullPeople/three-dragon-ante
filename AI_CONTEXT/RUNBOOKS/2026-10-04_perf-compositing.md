# 2026-10-04 · 帧率修复（合成层开销）

## 0. 现象与档位

- 用户反馈（2026-10-04）：普通家用电脑上打包构建帧率明显低、拖拽卡；补充：单机（机器人）卡、双人联机不卡，人越多越卡。
- 档位：普通（表现层内部优化，不改规则 / 协议 / 服务端）。

## 1. 查证（根因）

无头 Chromium（SwiftShader 软件渲染，只看相对值）跑 `.local-evidence/perf-probe.mjs`：空闲 / 悬停（每 16 ms 一次 pointerenter）/ 拖拽（每 16 ms 一次 pointermove）各 2 s，统计 rAF 间隔；按模式注入 CSS 关掉某一层：

| 6 人局，修复前 | idle | hover | drag |
|---|---|---|---|
| 默认 | 5 fps | 5 | 5 |
| 只关金币 `filter: drop-shadow` | 23 | 27 | 23 |
| 全关（金币滤镜 + 两张特效画布 + 2D 画布 + 桌面 filter + 动画） | 51 | 55 | 56 |

根因：**每枚金币是一个带三层 `drop-shadow` 滤镜的 `<img>` 合成层**（每堆最多 32 枚，6 人局 7 堆 ≈ 220 个滤镜层，每帧合成都要重新过滤），座位越多越多——与"人越多越卡、双人不卡"吻合。次要：`.tda-surface` 的 `filter: drop-shadow`（1800×1100 的层）、三张常驻全屏透明画布（2D 特效 DPR 2、three.js 空中 + 地面）、不可打出手牌的 `filter: saturate() brightness()`、指针事件每次都整树重渲染。

本机真实 GPU（Intel Arc 核显，dpr 1.5）3 人局修复前就是 60 fps，所以问题只在弱机上可见；用软件渲染放大后能稳定复现。

## 2. 修复

| 项 | 改法 | 文件 |
|---|---|---|
| 金币堆 | 每堆画在**一张** 2D 画布上；厚度（两层深色边缘）与软投影**烘焙进贴图** `assets/coin-gold.webp`（由 `art/currency/dragon-gold.webp` 用 PIL 生成，源文件不动）；叠高 translateZ(3.2/层) 等价换成平面内上移 3.2·tan(tilt)（倾角读 `--tilt`） | `scene/CoinStack.tsx`、`scene.css` |
| 飞行金币 | 同一张烘焙贴图，去掉 filter | `fx/particles.ts`、`scene.css` |
| 桌面投影 | `filter: drop-shadow` → `box-shadow`（随 border-radius） | `scene.css` |
| 空闲画布 | 2D 特效画布、DOM 金币精灵层、three.js 空中 / 地面画布：没有东西在画时 `display:none`，有效果再显示；2D 画布 DPR 上限 2 → 1.5 | `fx/particles.ts`、`fx3d/FxStage.ts` |
| 手牌压暗 | `filter` → `::after` 叠色层 | `scene.css` |
| 拖拽 | 指针事件按帧合并（每帧最多一次状态更新） | `scene/TableScene.tsx` |
| 测试夹具 | 本地主机 `?opponents=1..5` 预选对手数 | `site/SiteApp.tsx` |

## 3. 验证

| 6 人局，修复后 | idle | hover | drag |
|---|---|---|---|
| 默认 | 56 fps | 55 | 54 |
| 全关 | 59 | 58 | 56 |

- 修复前 → 后：5 → 56 fps（软件渲染、6 人局）。
- `npm run test:browser` 20/20、`test:fx3d` 4/4、自测 15/15、`npm test` 8/8、`test:server-browser` 4/4。
- 截图 `.local-evidence/shots/perf-coins-6p.png` / `perf-coins-zoom.png`：金币堆外观与原来一致（沙漏形龙金、小角度抖动、分列）。
- 空闲时 `.tda-fx` / `.tda-fx-dom` / `.tda-fx3d-air` / `.tda-fx3d-ground` 均为 `display:none`（截图脚本核对）。

## 4. 遗留

- 探针脚本在 `.local-evidence/`（依赖 4180 预览服务），可移进 `tools/` 并自带静态服务。
- 弱机的"画质"用户开关与自动降档随 fx3d 设计一起做（FxStage 已有 tier）。
- 真实弱机复测由用户完成。
