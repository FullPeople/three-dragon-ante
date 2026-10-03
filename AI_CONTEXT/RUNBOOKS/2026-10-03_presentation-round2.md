# Runbook · 表现层第二轮纠错（2026-10-03）

> 用户看过本地演示后给出九条纠错。本轮**实质档**（大范围表现层改动 + 新素材）。
> 红线复述：规则引擎 / 协议 / 控制器 / 服务端不动（例外见 §2 第 8 条：`rules/prompts.ts` 只改中文措辞，不改逻辑）；卡图不动；不用 AI 生成美术；公共投影永不含私牌；提交 ≠ 接受；bundle 零外部请求；新素材只从用户已批准的 CC0 来源（Poly Haven / ambientCG / Kenney）下载并登记；push 需用户确认。

## 1. 九条纠错 → 查证结论

| # | 用户纠错 | 代码里查到的现状（证据） | 裁决 |
|---|---|---|---|
| 1 | 有些流程没进等待：末轮最后一张出完立刻弹结算；能力弹窗在出牌瞬间就弹；特殊牌阵没有等待与解释 | `presenter.ts`：末牌 + `GAMBIT_SCORED` 在同一帧，路径 `display → SETTLE(520) → score: SETTLE(520) → 计分板`，桌面上没有"拼点"环节；能力：落地帧后 `SETTLE+BEAT = 820 ms` 即开说明层，机器人出的牌从**牌库中心**飞入（`CardLayer` enterFrom 默认 deck），不是从它的手牌；`SPECIAL_FLIGHT` 只有 1.8 s 横幅，金币弧与计分板付款**各飞一次**（重复） | 成立。重做：落地 → 尘土 → 停 → 拼点 / 说明 → 效果 → 停；特殊牌阵加说明层；付款去重 |
| 2 | 手牌互相遮挡裁剪；悬浮要更快；拖动改为抬起 + 弧线指向（杀戮尖塔）；放置要有力量感 + 3D 尘土 | `scene.css`：手牌 `rotateZ(rot)` 后再 `rotateX(stand)`，各张平面不平行，在 `preserve-3d` 里**相交被 GPU 切片**；悬浮走 480 ms 飞行过渡；拖动是跟随鼠标的放大影子（`.tda-drag-ghost`）；桌面 1440×900 截图里扇面底部被行动栏裁掉 | 成立。变换顺序改为 `rotateX → rotateZ`；手牌过渡 150 ms；指向器 + 两段式落牌 + 尘土；fitPlane 预留 |
| 3 | 能力特效要一牌一样、有 3D 感、全内容 | `particles.ts` 只有五族粒子爆发 + 涟漪；所有能力共用 | 成立。新建 `fx/powers.ts`：图元（光束 / 环 / 法阵 / 手 / 交换 / 冲击）+ 每个 family 一段脚本 |
| 4 | 能力弹窗"继续"改为点击任意处 | `Overlays.tsx` 已支持点击遮罩关闭，但仍有按钮 | 成立。去按钮，改提示行 |
| 5 | 各区总点数时刻显示；金币裁图错乱、错位 | 总点数只在牌阵槽右上角 24 px；`CoinStack`：141×148 的圆币照片被 `32×22 + border-radius:50% + cover` 裁成椭圆，又在已倾斜的平面里二次压扁；金币锚点在暗置与牌阵之间，叠在牌阵第一张上 | 成立。点数铭牌常显；金币用整圆 + `translateZ` 叠层；锚点移出牌区 |
| 6 | 继承原本人数决定圆桌 / 方桌 | 原 `stage/layout.ts`（eb74f62）：`players >= 4 ? "square" : "round"`；6 人边分布 左2 上1 右2；现实现只有一种圆角矩形 | 成立。着色器加 `uShape`；座位锚点按桌形 |
| 7 | 拍桌逻辑未做；背景要酒馆天空盒 | `controller.knock()` 只发手势，本地模式无任何表现；背景是木板纹理 | 成立。震动 + 手掌剪影 + 涟漪 + 音效 + 机器人提速；背景用 Poly Haven CC0 室内 HDRI 的 tonemapped JPG |
| 8 | 选择弹窗卡片与文字选项尺寸失衡；选中后不能点另一项切换；无必要的选择应直接触发；统一前注 / 下注 / 暗置 | `ChoicePanel.tsx`：`disabled = !isSelected && selected.size >= max`，`max=1` 时其余全部禁用 → 不能切换；文字选项是按钮、卡牌选项是 92 px 竖图；"最低前注牌并列"的选择由**规则引擎**生成（LE p.17 青铜龙：并列由玩家选），引擎是红线 | 前两项成立并修；第三项**不改引擎**（并列的牌是不同的龙，颜色 / 能力不同，规则上确为真实选择），改为面板明确标注"并列 · 任选"并让取牌动画逐张可见；措辞统一为"前注"（印刷牌文已用"前注"） |
| 9 | 传说龙更大特效 + 法阵；场地 / 持续效果改变环境 + 持续音效；拼点要明确动画 | 传说牌与普通牌同一套爆发；`game.effects`（druid / priest / merchant / monarch / dracolich / warlord）与 `seat.archmage` 公开但无任何持续表现；翻注只有冠冕粒子，轮局结算无桌面拼点 | 成立。法阵图元；`FieldLayer` 读公开 `effects`；拼点：数字浮现 → 最高亮 / 并列划掉 |

## 2. 方案与顺序（小步，每步 typecheck + 自测 + 冒烟）

- **A1** 措辞统一（i18n + `rules/prompts.ts` 中文措辞，仅文字）、说明层去按钮、选择面板瓦片化 + `max=1` 可切换 + 并列提示。
- **A2** 手牌：变换顺序、悬浮 150 ms、扇面不被裁、金币整圆叠层与锚点、总点数铭牌常显。
- **A3** 指向器拖动（贝塞尔箭头）+ 两段式落牌（抽出旋转 → 加速落下）+ 落地尘土 + 机器人出牌从其手牌飞出。
- **A4** 演出时序：落地后停更久；翻注与轮局结算的桌面拼点；特殊牌阵说明层；付款去重；末牌 → 拼点 → 计分板。
- **B1** 桌形：2–3 人圆桌、4+ 方桌；侧边座位旋转 ±90°，顶边 0°（可读性）；CSS 兜底同步。
- **B2** 拍桌表现 + 机器人响应；酒馆背景（下载 + 压缩 + 登记）。
- **C1** 能力特效库：图元 + 每族脚本 + 传说法阵。
- **C2** 场地层：持续效果的环境变化与自然消失；持续音效需新循环素材（见 §4 遗留）。
- **C3** 测试：自测补拼点时序与 `toggleOption` 切换；冒烟选择器；截图证据。
- **D** 留痕（本文 + MEMORY + TODO + VISUAL_SPEC）→ 独立审计（换模型）。

## 3. DoD

- 九条每条有对应改动与证据（截图或自测断言）；`npm test` / `test:server` / `test:browser` ×3 / `test:server-browser` 全绿；bundle 零外部请求；新素材登记 `docs/design/ASSETS.md`。

## 4. 实施记录

| 步 | 改动 | 文件 | 证据 |
|---|---|---|---|
| A1 | 措辞统一"前注"（印刷牌文本来就是"前注"）；说明层去按钮改"点击继续"；选择面板瓦片化（卡牌 / 文字同尺寸）、单选可直接切换、并列标注"并列 · 任选" | `i18n.ts`、`rules/prompts.ts`（仅中文措辞）、`game/text.ts`、`site/rules.ts`、`Overlays.tsx`、`ChoicePanel.tsx`、`hud.css` | 自测 5；截图 `round2/10-choice-tiles.png` |
| A2 | 手牌变换顺序 `rotateX → rotateZ`（平行平面不再切片）、z 间距 3、悬浮 150 ms；扇面上移 + fitPlane 预留 1.34；金币整圆 `translateZ` 叠层、锚点贴铭牌；总点数黄铜铭牌常显 | `scene.css`、`layout.ts`、`CoinStack.tsx`、`SeatBlock.tsx` | 截图 `site/desktop-07-played.png` |
| A3 | 指向器拖动（贝塞尔 chevron 箭头，手牌抬起不跟随）；两段式落牌 `is-lifting 190 ms → is-dropping 260 ms` + 落地尘土 / 轻震 / 声音；对手出牌从其手牌位置落下 | `TableScene.tsx`、`CardNode.tsx`、`CardLayer.tsx`、`particles.ts`（dust） | `six-and-drag.mjs` 断言 `.tda-pointer`；截图 `round2/05a-pointer-drag.png` |
| A4 | 时序：SETTLE 640 → 聚焦 420（传说牌先法阵）→ 说明 → 每牌脚本 → 金币；轮局结束：特殊牌阵说明层 → 桌面拼点（700 + 1000 ms）→ 计分板；翻注拼点（领出 / 并列划掉）；付款去重（结算只由计分板飞，牌阵奖励跟自己的说明层）；金币数字逐笔入账 | `presenter.ts`、`cues.ts`、`store.ts`、`Overlays.tsx`（FormationSpotlight） | 自测 4、6、7 |
| B1 | 桌形：`tableShape(players)` 2–3 圆（椭圆 SDF）/ 4+ 圆角方；方桌边分布 左1上1右1 / 左1上2右1 / 左2上1右2；侧边座位 ±90°，顶边正向 | `layout.ts`、`surface-gl.ts`（`uShape`，GLSL 保留字 `half` 坑）、`TableSurface.tsx`、`SeatBlock.tsx` | 自测 8；截图 `round2/01-six-square-table.png` |
| B2 | 拍桌：节流 1.5 s、震动 + 手掌剪影 + 涟漪 + 尘土 + 音效，本地机器人 320 ms 内出手；酒馆背景（Poly Haven `cowboy_town_saloon` CC0 裁图，登记 ASSETS.md） | `controller.ts`、`mount.ts`、`TableScene.tsx`、`LocalMatch.ts`、`materials.css`、`scene.css` | 截图 `round2/02-knock.png` |
| C1 | 特效库图元：beam / ring / sigil / grab / swap / pulse / claw / flare / slap / dust / ambient；每个 family 一段脚本（偷奖池的手、索要光束 + 威压、交换轨迹、爪痕、法阵…）；传说牌落地法阵 | `particles.ts`、`powers.ts` | 截图 `round2/06b-power-fx.png` |
| C2 | 场地层：公开 `effects` + `archmage` → 桌面色调、座位法阵环与标签、低密度环境粒子；出现 / 消失 800 ms 渐变 | `FieldLayer.tsx`、`scene.css` | 出现则抓 `round2/09-field-effect.png` |
| C3 | 测试：自测 9 项；冒烟改点击任意处关闭、节点直接 click；拖拽证据改断言指向器 | `presentation-selftest.mjs`、`production-practice-smoke.mjs`、`six-and-drag.mjs` | 全绿 |

**未做 / 待定**：持续效果的**持续音效**需要循环素材（Kenney 现有包无环境循环），待用户批准来源后加；§1 第 8 条"无必要的选择"不改引擎。

## 5. 独立审计（Claude Opus 5.5，只读）第一轮：不通过 → 整改

审计用自建测试页（真实 `mountTableUI` + 可控回执延迟）与 400 局引擎模拟复现了三条高严重度问题。整改如下（commit 见 git log "Audit fixes"）：

| # | 发现 | 整改 | 证据 |
|---|---|---|---|
| 高-1 | 回执 ≤ 190 ms 到达时牌永久卡在抬起位置（effect 清理掉定时器后阶段不复位） | `CardNode` 重写为纯状态机：阶段 enter → drop / fly / arrive，定时器只在卸载时清理；手→桌是**换层重挂**（dropIn），没有"离开手牌"的跨渲染判定 | 冒烟新增真实拖拽 + `?receiptDelay=60/300`，断言落在前注区且无残留阶段类 |
| 高-2 | 末牌与结算同帧：投影里牌阵已清空，拼点在空桌上显示"点数 0" | `settlementFrame()`：上一帧 + 公开 `ScoreReport.rows[].cards` 与总点数合成结算帧，整段演出（落牌、能力、特殊牌阵、拼点、计分板）都在它上面做，发完奖池才 `display(view)`；铭牌在拼点时显示 `tally.value` | 自测 10（真实引擎打到结算帧，断言拼点时每家牌都在、流程帧未前进） |
| 高-3 | 手牌仍被桌面切片；左半扇面遮挡反向 | 扇面改画在 `.tda-viewport` 下独立的屏幕对齐立板（`transform-style: flat`，z-index = order），不进桌面 3D 上下文；手牌缩放 1.0、枢轴 1000 | 截图 `site/desktop-07-played.png`、`desktop-03-hover.png`；自测 9 |
| 中-1 | 结算帧里特殊牌阵说明没有牌 | `formationCues` 在牌阵已空时从 ScoreReport 行取牌并判断组合 | 自测 7 |
| 中-2 | 结算后的金币（偿债、君王、终局取偿债池）先于计分板飞；铭牌可能显示负数 | `goldAfterScore` 单独一组，在发奖池之后播；`bookFlow` 座位金币下限 0 | 自测 10 断言 `gold` 不含 PAID_HOLE / TOOK_HOLE |
| 中-3 | 尘土与声音先于回执 | 落地回调只在 `pending` 变为 false 且区域不是手牌后触发；被拒回手不播 | 冒烟慢回执用例 |
| 中-4 | 冒烟改成节点 click 削弱覆盖 | 恢复坐标点击（手牌立板最后一张在最上层；槽位点上段）；真实拖拽 + 慢回执用例进 `test:browser` | 18/18 ×3 |
| 中-5 | 自测覆盖不足 | 新增手牌层、结算帧演出、全并列翻注、拍桌节流、事件段切分（共 13 项） | `npm test` |
| 中-6 | 全并列翻注无拼点 | `revealFrame()` 按 ANTE_REVEALED 座位次序把牌放回前注区再演翻开与划掉 | 自测 11 |
| 低-1 | 6 人同侧两席重叠 | 锚点拉开到 y 270 / 700 | 待截图复核 |
| 低-2 | 抽牌进手牌只有 150 ms | 进入手牌层用 `arriving`（480 ms 从下方升起） | — |
| 低-3 | 翻注时对手前注背换 id 又落一次 | 识别 `ante:seat` 背已存在 → 原地出现 | — |
| 低-4 | 场地层淡出定时器被清掉 | 每项独立定时器 Map，回场取消淡出 | — |
| 低-5 | 自己出牌后停顿不足；连锁能力无聚焦 | SETTLE 1100 ms 从显示起算盖住落牌；每个能力都先聚焦 | 自测 4 |
| 低-6 | 脚本取整帧事件；源牌不在桌上无特效 | `powerSegment()` 切本能力事件段；结算帧保证源牌在桌上 | 自测 12 |
| 低-7 | 换行符 / 文档 | 核对：`prompts.ts`、`text.ts`、`rules.ts` 在 HEAD~1 与 HEAD 的 blob 都是 CRLF（CR 计数 101 / 50 / 31 相同），不存在换行符改动；MEMORY、DOMAIN 时序已更新 | `git show HEAD~1:… \| grep -c $''` |
| 低-8 | 并列提示误标；场地环未随座位旋转 | 只对 LOWEST_ANTE_CARD / STRENGTH_FLIGHT_ANTE / KEEP_ONE_ANTE_CARD 标注；场地环 `rotate(seat.rot)` | — |
| 槽位命中 | （整改中发现）槽位带 `transform` 后与桌面画布同深度，手机端命中测试落到画布 | 槽位 `translateZ(2px)` | 冒烟 narrow 用例 |

**复审**：整改提交后回同一审计会话复审，裁决见 §6。
