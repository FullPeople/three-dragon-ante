# 待办清单 — 三龙牌

> 跨会话遗留登记处。任何未完成事项写这里（实质改动的遗留**双落**：runbook + 本文件）。
> 完成的移到底部「已完成」并注 commit。

## 待办

- [x] 第三方素材下载（用户 2026-10-03 同意）：Poly Haven dark_wood / medieval_wood / brown_leather / metal_plate，ambientCG Fabric034 / Paper006，Kenney Casino Audio；已压缩入库并登记 `docs/design/ASSETS.md`。
- [ ] 持续效果（德鲁伊 / 祭司 / 龙巫妖…）的**持续音效**：需要 CC0 环境循环素材（Kenney 现有包没有），来源待用户批准；`FieldLayer` 已留位置。
- [x] 第二轮纠错后的独立审计（换模型）：第一轮"不通过"已整改，复审"有条件通过"，条件（全并列翻注重复 key、runbook 低-7 更正）已满足（runbook round2 §5–§6）。
- [ ] **手掌素材**：拍桌 / 偷奖池需要真实照片手掌剪影。rawpixel 公共领域库（CC0 标注）与 purepng 都有人机验证，AI 不绕过；需用户在浏览器里挑图或自行提供照片，再由 AI 抠图、登记。未到位前用掌印闪光 + 焦痕替代。
- [x] 第三轮纠错后的独立审计（换模型 Opus）：不通过（H1 / ASSETS / M1 / M2 / M3 / L1–L13）→ 全部整改（runbook round3 §6）→ 复审已发起，结论待记。
- [x] 6 人方桌：加赛出现第 4 张牌阵时，上侧座位第 4 张会压下侧座位前注约 23 平面单位（左右对称）；可按牌阵张数收紧步进。
- [ ] 把审计用的"落地声必须在回执之后 / 被拒不播"浏览器测试页，以及 400 局幽灵牌引擎模拟（`sim3.mjs`，口径见 runbook round3 §6.1 M1）移进 tools/ 并接入测试（现只在 scratchpad）。
- [ ] **去 AI 感复查**：按 `docs/design/ANTI_AI_FEEL.md` §3 逐项过一遍全部组件（横幅扫入动画、聚光层淡入是否算"动效过多"由用户定）；卡背纹章是否还显"AI 矢量味"待用户看截图后定。
- [ ] 材质细化：毛毡色调 / 粗糙度、烛光位置与强度、桌沿倒角宽度；手机端 `pixelScale` 上限 1.4 是否够清晰。
- [x] 阶段 1–7 完成（2026-10-03）：独立审计两轮，必修项 N1 已修并连跑 5 次稳定，审计口径下判通过。
- [x] 阶段 2 收尾：六人桌、真实拖拽、减少动态、详视与选择面板位置、favicon / 图标（2026-10-03）。
- [x] 阶段 4 时序对齐：落地帧 → 说明 → 效果与金币（commit `2c2df3f`）。
- [x] `test:browser` 改测新 `index.html`；`test:server-browser` 改新选择器。
- [x] **原 push 被拒已解除（2026-10-04）**：有写权限账号已将 `619ada5` 推至 `origin/rebuild/presentation`，未合并 main。历史原因：用户 2026-10-03 授权"修复完之后推送"，但 `git push -u origin rebuild/presentation` 返回 403——Git Credential Manager 里的 GitHub 账号 `pzy197684` 对 `FullPeople/three-dragon-ante` 无写权限（本机未装 gh）。需用户：给该账号写权限 / 在凭据管理器换成有权限的账号 / 或改推到自己的 fork；之后重跑 push。是否合并 main 由用户定。
- [ ] **three.js 特效层 fx3d（用户 2026-10-03 批准）**：地基已交付（runbook `2026-10-03_fx3d-kickoff.md` §2）；待办：设计定稿 → 图元工具箱 → 家族签名 → 单牌变体 → 传说牌定制 → 持续 / 环境 → 尘土与手；MIT 署名文件待随首个移植图元一起加入 `docs/design/ASSETS.md` 与 THIRD_PARTY 说明。
- [ ] 字体子集化：vendor CSS 约 500 kB 来自 fontsource 全部 unicode-range 子集声明；可改为只保留 chinese-simplified + latin 子集或自建子集。
- [ ] 枭熊真实房间验收（双账号、紧凑弹窗、全屏模态）；实体手机。
- [ ] `src/modules/threeDragonAnte`（旧稳定频道）是否删除或也切新表现层，待用户定。
- [x] 阶段 6：从 `package.json` 与 `.github/workflows/verify.yml` 移除 `verify:source`；`docs/EXTRACTION.md` 注明 `SOURCE.json` 已成历史记录；删除旧表现层文件与 `three` / `@types/three` 依赖；重写 `tools/production-practice-smoke.mjs` 与 `tools/three-dragon-server-browser.mjs` 选择器。
- [x] 枭熊适配（阶段 5，2026-10-03 完成）：`table.html` 两种模式（全屏模态 / 紧凑弹窗）、大厅、全能编辑器视觉重做；`index.ts` 中 `assetUrl("index.html")` 改 `table.html`。
- [ ] 开放问题待用户决定：独立网站是否需要在线多人（涉及鉴权，另立项）；`src/modules/threeDragonAnte` 旧频道是否删除；依赖漏洞升级另立任务。
- [x] `README.md` 按新结构重写（2026-10-03）。
- [x] 注册到工作区 `D:\my_code\PROJECTS.md`（2026-10-03）。
- [x] 审计低项：手机端流程轨横向截断（缩字号，commit `9c5b8e0`）。
- [x] 审计低项 N2：被立刻替换的牌（铜龙类）`landingFrame` 返回 null → 第四轮已修（用公开的牌 id 自造落地条目，自测 14）。
- [ ] 审计低项：翻注四段 1720 ms 只靠代码确认，没有自动化断言。
- [ ] 审计低项 L5：本家交出牌时，幽灵从扇面中心以牌背飞出，被交出的那张在落地前仍留在扇面；应从该牌真实位置起飞并立即隐藏原牌。
- [ ] 审计 M3：姓名铭牌 / 绶带是否也随座位 θ 整转（现只有点数铭牌与组合标签整转，姓名牌保持可读），待用户定。
- [ ] 洗牌帧（DECK_RESHUFFLED）抽牌幽灵只能按手牌差计，同帧既抽又弃会少飞一张（400 局中 1 帧）；多家同帧买牌时"先弃后抽"归属可能判错（复审按座位核对 8 帧 / 400 局）。
- [ ] 复审低项：竖屏 6 人 3 张牌阵时点数铭牌与组合标签叠 15 平面单位（检查器显式放行）；可把组合标签沿 dir 再挪。

## 已完成（节选）

- [x] 2026-10-03 现状评估与决策（`docs/2026-10-03-presentation-assessment.md`、`AI_CONTEXT/GOAL.md`）。

## 2026-10-04 持续上线目标

- [ ] guest 服务：房间码/唯一名字、并发抢名、重连凭据/离线恢复、私牌、持久化、旧 Owlbear 兼容，专项测试与独立审计。
- [ ] 独立多人网站：创建/入房/邀请/重连，与原本地机器人对战同时可用；真实浏览器双页完整流程与断线恢复。
- [ ] 独立三龙牌扩展 HTTPS 发布；Suite dev 与旧稳定入口定向集成；保留旧频道进行中的牌局及其他 241 功能。
- [ ] 权威服务更新与远端回退点；沿用当前 nginx/WSS，部署后独立核验静态入口、实际文件散列和服务健康。
- [ ] 真实枭熊 GM + 玩家房间、紧凑弹窗/全屏与网络请求验收。浏览器控制组件缺失所需版本，待可用后完成，夹具不算验收。
- [ ] 新功能完成后按 `AUDIT.md` 做换模型独立审计；无对应工具时保持只读审计证据与未验证范围，不自宣最终安全。
