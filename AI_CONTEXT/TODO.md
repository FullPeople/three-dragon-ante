# 待办清单 — 三龙牌

> 跨会话遗留登记处。任何未完成事项写这里（实质改动的遗留**双落**：runbook + 本文件）。
> 完成的移到底部「已完成」并注 commit。

## 待办

- [ ] **第三方素材下载需用户确认**：桌面木纹 / 皮革 / 毛毡 / 黄铜纹理（Poly Haven 或 ambientCG，CC0）、音效（Kenney Casino Audio / Interface Sounds，CC0）。确认后下载、压缩为 webp/ogg、登记 `docs/design/ASSETS.md`。在此之前场景用 CSS 材质占位。（2026-10-03 立）
- [ ] 阶段 1–7 按 `GOAL.md` §6 推进；每阶段收口写 runbook，阶段 2/4/6 各做一次独立审计。（阶段 1 已完成，阶段 2 第一版已完成，2026-10-03）
- [ ] **阶段 2 收尾**：6 人桌布局截图核对；真机拖放验证（目前截图走的是点选 + 点区域）；选择面板不要盖住手牌（移到桌面中部或右侧）；手机端详视改为底部抽屉且不压手牌；favicon 与新扩展图标；减少动态偏好路径验证。
- [ ] **阶段 4 时序对齐**：GOAL §4.3 要求说明关闭后才发生卡牌效果与金币变更；当前 presenter v1 在落地时就显示新投影（含金币数字），需把"效果投影"拆成落地帧与结算帧。
- [ ] `test:browser`（`tools/production-practice-smoke.mjs`）目前仍测旧 practice.html；阶段 6 改为测新 `index.html`（选择器：`.tda-card--hand`、`[data-drop-zone]`、`.tda-spotlight`、`.tda-choice`、`#confirm-action`）。
- [ ] 阶段 6：从 `package.json` 与 `.github/workflows/verify.yml` 移除 `verify:source`；`docs/EXTRACTION.md` 注明 `SOURCE.json` 已成历史记录；删除旧表现层文件与 `three` / `@types/three` 依赖；重写 `tools/production-practice-smoke.mjs` 与 `tools/three-dragon-server-browser.mjs` 选择器。
- [ ] 枭熊适配（阶段 5）：`table.html` 两种模式（全屏模态 / 紧凑弹窗）、大厅、全能编辑器视觉重做；`index.ts` 中 `assetUrl("index.html")` 改 `table.html`。
- [ ] 开放问题待用户决定：独立网站是否需要在线多人（涉及鉴权，另立项）；`src/modules/threeDragonAnte` 旧频道是否删除；依赖漏洞升级另立任务。
- [ ] `README.md` 在阶段 6 后按新结构重写（当前内容描述的是拆分时的旧结构）。
- [ ] 注册到工作区 `D:\my_code\PROJECTS.md`（已在 2026-10-03 完成，若导航变动需同步）。

## 已完成（节选）

- [x] 2026-10-03 现状评估与决策（`docs/2026-10-03-presentation-assessment.md`、`AI_CONTEXT/GOAL.md`）。
