# 三龙牌（FullPeople/three-dragon-ante）表现层重构 · 现状分析与评估

日期：2026-10-03 · 对象提交：`eb74f62`（main，共 3 个提交，2026-10-03 从 obr-suite dev `5476630` 拆出）· 版本 `0.7.21-dev` · 许可 GPL-3.0
证据：本机 `npm ci` + `npm run build` 通过；用仓库自带 Playwright/Edge 对生产构建截了 17 张图（桌面 1440×900、手机 390×844、枭熊弹窗 300×180）。

---

## 1. 仓库全貌

| 区域 | 内容 | 行数 / 规模 | 重构关系 |
|---|---|---|---|
| `extensions/three-dragon-ante/src/game/` | 前端全部：UI、三维牌桌、规则引擎、控制器、协议 | 约 9 980 行 TS/TSX/CSS | 表现层在这里 |
| `  ├ rules/` | 纯规则引擎、投影、提示文案 | 1 034 行 | **保留不动** |
| `  ├ controller*/protocol/wire/private-channel/store/server-*` | 枭熊房间控制器、私牌通道、服务端客户端 | 约 2 000 行 | **保留不动** |
| `  ├ ui.ts + react/ + stage/ + *.css + audio + power-* + round-presentation + onboarding + tutorial` | 表现层 | 约 5 500 行 | **全部重写对象** |
| `  └ art/` | 100 张卡面 webp 扫描 + 2 张硬币裁图 + 时光龙 PNG | 12 MB | 素材去留待定 |
| `server/three-dragon/` | ws + SQLite 权威服务 | 211 行 | 保留不动 |
| `src/modules/threeDragonAnte/` | 早期稳定频道兼容版（自带一套旧 ui.ts/style.css） | 2 056 行 | 待定（见 §5） |
| `tools/` + `*-selftest.mjs` | 回归、浏览器冒烟、来源字节校验 | 约 1 900 行 | 大部分要重做 |

技术栈：Vite 8 · TypeScript 6 · React 19（仅做"岛屿"）· Three.js 0.186 · Owlbear Rodeo SDK 3.1。
四个入口：`index.html`（枭熊内牌桌）、`practice.html`（无账号网页练习）、`launcher.html`（枭熊 300×180 弹窗）、`background.html`（后台控制器）。

---

## 2. 表现层现状：哪些是"程序化生成的低端内容"

你的判断成立，而且比想象的更彻底。除卡面扫描和两张硬币裁图外，**所有视觉与听觉资源都是代码在运行时现画现合成的**：

| 类别 | 现状 | 文件 |
|---|---|---|
| 桌面材质 | 木纹 = 512² 像素级伪随机噪声 + 正弦；毛毡 = 256² 灰噪声棋盘格 | `stage/textures.ts` |
| 桌子几何 | LatheGeometry 旋转轮廓 + 圆环修边 + 圆柱底座；方桌用 Extrude | `stage/index.ts` L93-123 |
| 卡背 | 一条手写 SVG path 画的"龙"，Canvas 重绘贴图 | `card-art.ts` |
| 区域标签 | 大字半透明"牌阵 / 暗置区 / 弃牌堆"水印贴在毛毡上，**随座位旋转，对手区的字是倒的** | `stage/textures.ts` zoneLabelTexture |
| 徽章/数字 | Canvas 画圆 + Georgia 字 | badgeTexture |
| 座位聚光 | 圆锥 + 自定义 shader | beamShaft |
| 能力特效 | RingGeometry 三角/方/五边形"法阵" + 径向渐变烟雾 sprite | makePowerBurst |
| 拍桌 | 用 2D Shape 挤出的"手掌"网格 | handShape |
| 硬币 | 照片裁图贴在挤出轮廓上 | `stage/currency.ts` |
| 全部音效 | WebAudio 振荡器 + 白噪声合成，17 种 | `audio.ts` |
| 引导插图 | 内联 SVG 基元拼的"牌桌示意图" | `onboarding/art.ts` |
| 扩展图标 | 3 个矩形 + 1 条 path | `public/icon.svg` |
| 页面背景 | CSS repeating-linear-gradient 画的"木板" | `style.css` |
| 配色/字体 | 全部硬编码 hex，无 token；字体 system-ui / Georgia / 微软雅黑，无自带字体 | 各 css |
| 练习落地页 / 启动器 / 公告页 | 纯文本 + 一两个按钮 | `practice.html` 等 |

**不是程序化的**：100 张卡面是 ©2021 Wizards 的实体牌扫描（README 明确声明不主张原创、不按 GPL 授权）；时光龙是用户自绘蜡笔风自定义牌；硬币是用户提供的参考图裁切。

### 截图里直接看到的问题（生产构建，Edge）

- 桌面 1440×900：左下角状态气泡群压在手牌扇面上，第一张牌被遮一半。
- 回合横幅"新的一轮 · 轮到 余烬"是大字直接横穿桌面，叠在弃牌堆标签上。
- 能力说明全屏层打开时，右侧卡牌预览抽屉仍然显示，**同一张卡画了两遍**。
- 能力选择面板悬浮在牌桌正中，压住自己的牌阵和手牌。
- 对手座位的"牌阵/暗置区"文字倒置或侧躺。
- 手机 390 宽：首屏是教程文字，牌桌在第二屏以下，游戏不是第一视觉。
- HUD 碎片化：顶部药丸、左下气泡、右侧抽屉、右下"拍桌催促"四处分散，没有统一的信息层级。

---

## 3. 架构边界：重构能碰什么、不能碰什么

这个仓库的分层做得相当严格，这是重构最大的利好：

- **唯一接缝**：`mountTableUI(root, deps)`（`ui.ts`）。枭熊页 `legacy-page.ts`、服务器页 `server-page.ts`、练习教程 `tutorial.ts` 都只调用它。输入是 `TableView`（`protocol.ts`），输出是 `TableUICommand`（`ui-command.ts`）。新表现层只要实现同样的 `{update, gesture, language, restore, draft, suspend, resume, failed, destroy, getAnchor, waitingForReceipt, presentationBusy}` 接口即可整体替换。
- **渲染器接缝**：`StageModel / StageHandle`（`stage/types.ts`）。渲染器只拿投影，不拿私有状态，没有输入监听。
- **必须延续的不变量**（`AGENTS.md` + `privacy-selftest`）：公共/座位投影不含牌库顺序和他人手牌；全能视图只在主持本机；手势广播不带手牌数据；动作先验证后变更，只有收到回执才算落地。任何新渲染器都要守住这些。
- **值得保留为"规格"而不是代码的产品规则**：出牌落地 → 停 0.3s → 全屏能力说明 → 玩家关闭 → 结算动画 → 再停 0.3s → 阶段标签才变（`ui.ts` pumpPresentation 状态机）；翻注 1 720ms 四段时序；能力提示状态 power-ready / playable-no-power 由引擎给出，UI 不自行推断。
- **现有 React 只是"岛屿 + portal"挂在一个 innerHTML 模板上**（`react/shell.tsx`），命令式与声明式混用。彻底重写应二选一，不要再叠一层。

---

## 4. 硬约束与风险（动手前必须知道）

1. **`npm run verify:source` 会让 CI 直接红**：`SOURCE.json` 固定了 247 个文件的 SHA-256，`tools/verify-source.mjs` 逐字比对上游。改任何一个"未适配"文件都会失败。重构第一步必须决定：删掉这套校验，或把它重新基线化。
2. **测试几乎全部依赖现有 DOM 选择器**：`#hand [data-card]`、`#table-stage`、`.tda-tutorial`、`#omniscient-toggle`、`#deck-choice`、按钮文案"创建牌桌 / 加入牌桌 / 开始游戏 / 开始完整练习"等。`test:browser`、`test:server-browser` 和 9 个 `*-selftest.mjs`（含 stage 78 项像素检查）都会随重写失效，需要按新 UI 重建。
3. **禁止外部请求**：`production-practice-smoke.mjs` 断言 `external == []`。想用 Google Fonts 等外链字体会直接失败，字体必须自托管打包。
4. **枭熊运行环境是 iframe**：紧凑模式是后台用 `popover.setWidth/setHeight` 控制的小弹窗，完整模式是 `modal.open({fullScreen:true})`。新设计必须同时适配：小弹窗、全屏模态、独立网页、390 宽手机。
5. **卡面版权**：扫描件是 Wizards 的印刷物。继续分发、加工、重绘都是你的决定；仓库文档和 `stage/README.md` 还明确写了"不使用 AI 图片"，这是上游的既定裁决，改变它要你拍板。
6. **三维方案本身的性价比**：正交相机固定视角，本质是 2.5D；代价是 three.js 独立 chunk、SwiftShader 软件渲染测试、标签随座位旋转、手机端另起一套 DOM 手牌。换成 2D/2.5D 分层插画方案能同时解决画质和复杂度。
7. **线上入口不随 push 更新**：`obr.dnd.center/three-dragon-ante-dev/` 由 Suite 部署，推回 GitHub 不等于上线；`docs/EXTRACTION.md` 也明确"建仓库不等于发布"。
8. **依赖有已知漏洞**：根项目 5 项、服务端 ws 1 项高危，`docs/STATUS.md` 记录为上游遗留。重构时顺手升级也要单独验证。
9. **全局纪律**：这是"实质档"改动（对外接口 + 大范围重构）；`commit` 可自主，`push` 需你确认；实质改动完成后需独立审计。

---

## 5. 需要你补充的决定（按影响大小排序）

1. **目标画风与参考**："高端"具体指什么？手绘插画 / 厚涂写实 / 像素 / 版画风？有没有参考作品（例如 Gwent、Inscryption、Balatro、实体三龙牌的质感）？没有这一条，任何重做都只是换一种程序化。
2. **美术资源从哪来**：是否接受 AI 生成图（上游明确拒绝过）；是否有画师或预算；桌面、卡背、硬币、图标、引导插图、音效各自的来源。这决定工期和能做到的上限。
3. **卡面怎么处理**：保留 Wizards 扫描件、重绘、还是只做新边框/新排版？牵涉版权与分发。
4. **3D 还是 2D/2.5D**：我的建议是 **放弃 Three.js，改为分层 2.5D 插画牌桌**（DOM/CSS 或 PixiJS）。理由见 §4 第 6 条。你若坚持 3D，需要真正的模型和 PBR 贴图资产，工作量另算。
5. **平台优先级**：枭熊小弹窗、枭熊全屏、独立网页练习、手机，哪个是第一画面？目前四者平均用力，结果都平庸。
6. **功能面取舍**：全能编辑器、历史面板、回放镜头、等待队列、41 项练习、2 页引导、键盘操作、减少动态偏好、中英双语。"破坏性"允许砍掉哪些？建议先列保留清单。
7. **技术栈**：保留 Vite + TS；UI 层是全面转 React，还是换 Svelte/Solid，还是继续原生 TS？建议全面 React + 设计 token + 自托管字体，和现有岛屿方向一致。
8. **旧兼容模块**：`src/modules/threeDragonAnte` 自带一套旧 UI，只服务历史牌桌。一并重写、保持原样、还是直接删除并放弃旧频道？
9. **测试与 CI**：是否接受"先删 verify-source 和旧 selftest，重建一套按新 UI 的冒烟 + 规则回归"？规则/服务端回归（`npm test`、`npm run test:server`）不受影响，建议原样保留。
10. **发布与版本**：推到 `main` 还是开分支走 PR？版本号跳到 0.8 还是 1.0？manifest 名称、图标、公告页是否同步换？

---

## 6. 建议的推进方式（供拍板，不是已执行）

| 阶段 | 内容 | 交付 |
|---|---|---|
| 0 | 视觉定稿：风格参考、配色/字体 token、素材清单、平台优先级 | 设计说明 + 素材需求表 |
| 1 | 新建 `presentation/` 包骨架，实现 `mountTableUI` 同名接口；接入 token、自托管字体、静态素材管线 | 空壳能跑练习页 |
| 2 | 牌桌主场景（2.5D）：桌面、座位、牌阵、暗置区、牌库弃牌、奖池、硬币 | 桌面 + 手机两种布局 |
| 3 | HUD 与面板：状态、回合、选择、预览、设置、编辑器 | 统一信息层级 |
| 4 | 动效与音效：发牌、翻注、能力、结算、回合切换；替换合成音 | 时序与现有规格一致 |
| 5 | 教程、引导、练习落地页、启动器、公告页、图标 | 四个入口统一视觉 |
| 6 | 测试重建：删/重基线 SOURCE.json，重写浏览器冒烟与多人 UI 测试，CI 绿 | runbook + 证据 |
| 7 | 独立审计（换模型）→ 你确认 → push | 发布回执 |

工作量判断：表现层约 5 500 行要整体替换，加上素材与测试重建，是跨多个会话的多日工作，不是一次会话能完成的。

---

## 7. 本次会话的范围声明

只做了只读分析：克隆仓库、安装依赖、生产构建、截图。没有改动任何仓库文件，没有 commit，没有 push。本地克隆位于会话工作区的 `tda/`，截图在 `tda/.local-evidence/shots/`（该目录被 .gitignore 忽略）。
