# 待办清单 — 三龙牌

> 跨会话遗留登记处。任何未完成事项写这里（实质改动的遗留**双落**：runbook + 本文件）。
> 完成的移到底部「已完成」并注 commit。

## 待办

- [x] 第三方素材下载（用户 2026-10-03 同意）：Poly Haven dark_wood / medieval_wood / brown_leather / metal_plate，ambientCG Fabric034 / Paper006，Kenney Casino Audio；已压缩入库并登记 `docs/design/ASSETS.md`。
- [ ] **去 AI 感复查**：按 `docs/design/ANTI_AI_FEEL.md` §3 逐项过一遍全部组件（横幅扫入动画、聚光层淡入是否算"动效过多"由用户定）；卡背纹章是否还显"AI 矢量味"待用户看截图后定。
- [ ] 材质细化：毛毡色调 / 粗糙度、烛光位置与强度、桌沿倒角宽度；手机端 `pixelScale` 上限 1.4 是否够清晰。
- [x] 阶段 1–6 完成（2026-10-03）；阶段 7 独立审计进行中。
- [x] 阶段 2 收尾：六人桌、真实拖拽、减少动态、详视与选择面板位置、favicon / 图标（2026-10-03）。
- [x] 阶段 4 时序对齐：落地帧 → 说明 → 效果与金币（commit `2c2df3f`）。
- [x] `test:browser` 改测新 `index.html`；`test:server-browser` 改新选择器。
- [ ] **push 前**：用户确认后 push `rebuild/presentation`；是否合并 main 由用户定。
- [ ] 字体子集化：vendor CSS 约 500 kB 来自 fontsource 全部 unicode-range 子集声明；可改为只保留 chinese-simplified + latin 子集或自建子集。
- [ ] 枭熊真实房间验收（双账号、紧凑弹窗、全屏模态）；实体手机。
- [ ] `src/modules/threeDragonAnte`（旧稳定频道）是否删除或也切新表现层，待用户定。
- [ ] 阶段 6：从 `package.json` 与 `.github/workflows/verify.yml` 移除 `verify:source`；`docs/EXTRACTION.md` 注明 `SOURCE.json` 已成历史记录；删除旧表现层文件与 `three` / `@types/three` 依赖；重写 `tools/production-practice-smoke.mjs` 与 `tools/three-dragon-server-browser.mjs` 选择器。
- [ ] 枭熊适配（阶段 5）：`table.html` 两种模式（全屏模态 / 紧凑弹窗）、大厅、全能编辑器视觉重做；`index.ts` 中 `assetUrl("index.html")` 改 `table.html`。
- [ ] 开放问题待用户决定：独立网站是否需要在线多人（涉及鉴权，另立项）；`src/modules/threeDragonAnte` 旧频道是否删除；依赖漏洞升级另立任务。
- [ ] `README.md` 在阶段 6 后按新结构重写（当前内容描述的是拆分时的旧结构）。
- [ ] 注册到工作区 `D:\my_code\PROJECTS.md`（已在 2026-10-03 完成，若导航变动需同步）。

## 已完成（节选）

- [x] 2026-10-03 现状评估与决策（`docs/2026-10-03-presentation-assessment.md`、`AI_CONTEXT/GOAL.md`）。
