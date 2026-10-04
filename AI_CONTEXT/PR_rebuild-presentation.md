# PR 草稿：rebuild/presentation → main

> 附件历史记录：本文件随来源快照 `2afca326` 保留。当前任务与授权以 `AI_CONTEXT/GOAL.md` §10–§11、`MEMORY.md` §E 及 `RUNBOOKS/2026-10-04_fx3d-integration.md` 为准；其中本地机器人、枭熊内游戏、403/PR/main 操作与旧测试数字不代表当前实现或新授权。文档里的启动词不自动执行。

> 用法：有写权限（或 fork）后，推送分支并用下面的标题与正文开 PR。`gh pr create --base main --head rebuild/presentation --title "<标题>" --body-file AI_CONTEXT/PR_rebuild-presentation.md` 也可（正文从「## 正文」起）。

## 标题

表现层重做：写实风 2.5D 牌桌、特效与时序、帧率修复；规则 / 协议 / 服务端不变

## 正文

### 做了什么

- **表现层整体重写**（`extensions/three-dragon-ante/src/presentation/`）：DOM + CSS 3D 的 2.5D 酒馆牌桌，照片扫描材质（CC0）与 WebGL2 法线贴图桌面，手牌扇面独立立板，炉石式三段落牌 + 尘土，幽灵牌转移（抽 / 偷 / 取前注 / 弃 / 买牌价格牌），金币精灵飞行与厚堆，拼点 / 结算 / 特殊牌阵的说明层与等待时序，每张牌的能力特效脚本（Kenney 贴图粒子），场地持续效果，拍桌。
- **独立网站为核心**（`index.html`，本地对战 + 机器人），枭熊牌桌页 `table.html` 适配两种模式；全能编辑器与大厅随新 HUD 重做。
- **three.js 特效层地基**（`presentation/fx3d/`）：相机与 CSS 透视链对齐误差 0.01 px；空中 / 地面两张画布；three 单独分包只随牌桌加载。
- **帧率修复**：金币堆改单画布 + 烘焙阴影贴图，去掉桌面 filter，空闲隐藏特效画布，拖拽按帧合并——6 人局软件渲染 5 → 56 fps。
- **不变**：`src/game/rules`、`protocol.ts` / `wire.ts` / `private-channel.ts`、`server/`、`src/modules/threeDragonAnte`、`src/game/art/`（`git diff --stat main -- <这些路径>` 为空，除 `rules/prompts.ts` 与 `game/text.ts` 的中文措辞统一"前注"）。

### 验证

- `npm run typecheck` 0；`npm test` 8/8（含表现层自测 15 项）；`npm run test:server` 2/2；`npm run test:browser` 20/20（桌面 + 390px，零外部请求，回执延迟 60 / 300 ms）；`npm run test:server-browser` 4/4；`npm run test:fx3d` 4/4；布局重叠检查 0（2–6 人 × 横竖屏 × 3/4/5 张）。
- 独立审计（Claude Opus，只读、冻结副本）三轮，终裁通过（`AI_CONTEXT/RUNBOOKS/2026-10-03_presentation-round3.md` §6）。

### 素材与许可

纹理 Poly Haven / ambientCG、音效与粒子贴图 Kenney，全部 CC0，逐文件登记在 `docs/design/ASSETS.md`；无 AI 生成素材；卡面扫描件未改。

### 留痕

`AI_CONTEXT/`（GOAL / MEMORY / TODO / RUNBOOKS）与 `docs/design/VISUAL_SPEC.md`。

### 提交列表

- b9cc2d0 Add AI_CONTEXT, rebuild goal, visual spec and 2026-10-03 assessment
- 1c10a8b Add the new 2.5D presentation package and standalone site entry
- 8484468 Replace glossy styling and AI-sounding copy with photo materials and terse labels
- 2c2df3f Hold effects until the power explanation closes; freeze gold until coins land
- 58b622c Switch the Owlbear pages to the new presentation and remove the old layer
- 4e460df Size the mounted table root to the viewport; record phases 2-6 in AI_CONTEXT
- dcd3c53 Address the independent audit: generation guards, pending hold, flow frame, timing
- 2659ad4 Record the independent audit findings and their fixes in the runbook
- 9c5b8e0 Fit the flow rail on narrow screens
- 7709af7 Audit round 2: stable smoke assertion, held-card predicate, gesture timer cleanup
- 9cf32d0 GOAL: mark phases 1-7 done; push awaits authorization
- da444d1 Presentation round 2: waits, showdown, per-power effects, square table, knock, tavern
- aafe9a4 Audit fixes: hand layer, settlement frame, receipt-aware landing, gold order
- 25a6402 Re-audit conditions: unique reveal keys, CRLF restored, hover on top
- 9c20fbb Runbook: record the final audit verdict (pass) for round 2
- 9d071ec Presentation round 3: coins, power hold, seat rotation, layout check, sprites, ghosts
- 5e4edda Presentation round 4: action bar height, copper chain, side seats on phones, coin flights, targeted effects, local omniscient
- 8d23298 Presentation: round-3 audit fixes
- 365f77c AI_CONTEXT: record that the push was refused (403, credential account lacks write access)
- e06ccd5 Add new-machine handoff prompt; add three.js (effects layer, user-approved)
- 619ada5 fx3d foundation + re-audit fix R-H1
- 1cbe4ea Handoff prompt: goal-driven, pre-authorized push/deploy, no step-by-step confirmation (user 2026-10-04)
- 42835d5 Audit closing items: three.js in its own chunk, package.json CRLF, smoke re-antes after an all-tied reveal
- 04c2274 fx3d kickoff runbook: chunk split note
- 6c9dcf9 TODO: where the fx3d design-review workflow output lives (session cut by usage limit)
- cce0fe3 Perf: kill the filtered-layer storm (6p software render 5 -> 56 fps)
