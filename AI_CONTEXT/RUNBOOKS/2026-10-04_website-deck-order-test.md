# 2026-10-04 网站全能牌堆顺序：真实服务回归

## 范围

新增 `tools/website-deck-order-selftest.mjs`，复用当前 `dist-server/service.mjs` 的实际权威服务。测试通过真实 loopback HTTP 创建合成网站房间、普通玩家和观战者，再通过真实 TCP/WebSocket 认证、开启房主 inspection 和提交 `TableEdit`。

接口为 `{ kind: 'deckOrder', cardIds: string[], revision: number }`，数组必须是当前 deck 的完整严格排列，`deck[0]` 为下一张抽牌。测试没有改生产源码、已有测试断言、引擎处理、浏览器工具或 package 脚本。

## 可重跑命令

```powershell
npm run build:server
node --check tools/website-deck-order-selftest.mjs
node tools/website-deck-order-selftest.mjs
```

服务构建由本轮协调方执行；若构建指定 `TDA_SERVER_OUT`，自测沿用同一输出目录。工具不接收数据库或远端地址参数，不读取 `.env`、线上数据库或玩家资料。

规则夹具通过 rolldown 编译仓库真实 `rules/index.ts`，再调用 `createGame` 和 `applyAction` 生成合法阶段。仅在合成服务已关闭后，将引擎生成的状态放入本工具创建的临时 SQLite；服务重新打开该 SQLite 后，所有被测 edit、inspection、receipt 和抽牌都经实际 WS 命令处理。未修改能力状态、pending 或队列来模拟规则。

## 本机执行回执

2026-10-04，Windows / Node 22，首次执行：

- `node --check` 实际退出码 0。
- `node tools/website-deck-order-selftest.mjs` 实际退出码 0，10/10 组通过，约 3.9 秒。
- 本次结果：`.local-evidence/website-deck-order/run-ESiGCS/result.json`。
- 实际 service bundle SHA-256：`badfa56129fdeff082c6b1a7ac4d8742130195d4d5b8663d1a4ccbb6824326b6`。
- 本次 `rules/edits.ts` SHA-256：`27b0e803fc810f9dcd30f1178ea00ec66b723e8079937051afb0c7bb675f21b3`。
- 实际服务关闭/重启 7 次；合法引擎阶段 5 种；9 类跨牌区 ID 守卫全部覆盖。
- 合成 SQLite、WAL、SHM 已删除，`fixtureDatabaseRemoved: true`。
- Node 给出其 SQLite 实验性功能提示；没有测试异常或断言失败。

## 验证内容

| 组 | 实际验证 |
|---|---|
| 授权 | 当前房主未开启 inspection、普通玩家、持久 SPECTATOR 的 edit 均拒绝；普通玩家与观战者 inspection 也拒绝；拒绝不写状态/历史/receipt |
| 严格排列 | 当前 revision 才能提交；缺少、多余、重复、未知、非字符串、非数组、缺 revision、不合法 revision 拒绝 |
| 成功与幂等 | 已认证房主开启 inspection 后成功提交完整顺序；仅 deck 与 game revision 改变；同 nonce 返回原持久 receipt，不第二次修订；改写同 nonce payload 拒绝；旧 revision 拒绝；顺序不变不增加 game revision |
| 保存故障 | 实际 SQLite transaction 注入保存失败；全部状态与 receipt 回滚；完全相同命令/nonce 重试只提交一次 |
| 落盘恢复 | 真正关闭服务并重新打开同一临时 SQLite；全部牌区/顺序/receipt 保留；房主 inspection 已撤销，观战者仍是 PublicView；旧成功 nonce 重试仍不增加修订 |
| 隐藏前注 | 实际引擎产生仅一席已下注状态；前注 ID 不能混入 deck，成功重排保留 committed 与其他状态 |
| 德鲁伊 | 实际出牌触发德鲁伊；能力、flight、ante 与完整非 deck 状态保持，跨区编辑拒绝 |
| 术士待选 | 实际出牌触发术士并抽取三张公开待选牌；pending/revealed ID 不能混入 deck，pending 与后续队列保持 |
| 术士保留续步 | 实际术士替换与新能力产生嵌套选择；`sorcerer-ante` 队列保留的牌、discard、flight、ante、revealed 均不能混入 deck，完整队列保持 |
| 下一合法抽牌 | 实际引擎生成首位可触发金龙的状态；房主重排、落盘、停服重启后，经真实座位合法出牌；实际手牌末张等于已保存 `deck[0]`，deck 恰少第一张，最终状态等于真实引擎结果 |

每次合法重排都比较整个 GameState（除 deck 与增加的 revision 外完全相同），调用真实 `checkInvariants`，并额外检查所有牌区加 excluded 等于完整 variant 卡池、货币守恒。跨牌区覆盖 `hand / excluded / committed / ante / flight / discard / pending / reserved / revealed`。

普通 Seat/Public 的真实 view/patch 流检查不含 deck 或全能字段、他人未公开手牌和暗注；观战者无 `hand / actions / selfSeatId / committedAnte / handPowerHints`。公开 variant 自选特殊牌名单和已经公开的牌 ID 按实际 `projectPublic` 处理，避免把合法公开信息误判为泄漏。

## 证据与边界

结果文件只记录安全标签、布尔、计数、代码散列、失败阶段与错误类别；不记录房间码、身份/会话、名字、token、牌 ID、视图、帧或 SQL 数据。生成的规则 bundle 仅为源码编译产物。临时数据库只含本工具通过 HTTP 创建的合成身份和引擎生成状态，退出时逐个删除 SQLite 及其伴随文件。

这是当前构建的真实本地 HTTP/WebSocket/SQLite 与纯规则引擎证据。未启动浏览器、未访问公网/真实牌局、未测试实体手机；不据此宣称 UI、线上发布或真实设备验收完成。未 stage、commit、push 或部署。

## 新全能控件浏览器专项（真实本地 13/13 通过）

新增独立 `tools/website-omniscient-controls-browser.mjs`，不修改原 `website-omniscient-selftest.mjs` 的断言、等待或期限。该专项直接托管统一构建后的 dev 网站与当前 service bundle，自己不做 build。2026-10-04 已执行 `node --check tools/website-omniscient-controls-browser.mjs`，实际退出码 0；协调方统一前端 typecheck/build 和 build:server 均实际退出码 0 后，首次默认 GPU 浏览器执行实际退出码 0、13/13 通过，23.36 秒。该结果已由本工具的 `result.json` 重新只读核对。

```powershell
npm run build
npm run build:server
node tools/website-omniscient-controls-browser.mjs --gpu default
```

`TDA_SITE_OUT` 可指定前端产物目录（默认 `extensions/three-dragon-ante/dist`），`TDA_SERVER_OUT` 可指定服务 bundle 目录。该工具按 `/three-dragon-ante-dev/` 托管本轮 dev 构建；允许显式 `--gpu software` 作独立控制，但默认用浏览器 GPU 选择，不把 390px viewport 当实体手机。

已使用同一真实浏览器分别执行 1280×900 与 390×844，每种尺寸两份独立 context，通过真实网站按钮创建合成房间、加入、开始、合法隐藏本家前注，并验证：

- `fuvtt` + Enter 才打开房主全能；所有座位手牌和当前暗注默认牌背，没有编辑器卡名与前图；桌面私牌 `is-face-down` 和 `aria-label=牌背`；旧私牌 Inspector、真实编辑器 hover 和手牌 focus/键盘均不能显示私牌详视。
- 普通玩家始终看到自己的正常手牌、无 Editor/私有全能帧；真实“显示所有手牌 / 隐藏所有手牌”按钮切换卡名和前图，纯本地显示操作不改牌局。
- 独立“查看牌堆”不暴露手牌；第一行显示“下一张”；真实 Up/Top 只改草稿，Apply 才发送唯一完整 `deckOrder/revision` WS 命令；实际 SQLite GameState 仅改 deck 和一次 revision；Reset/Close 不额外写牌局。
- 关闭全能再开、刷新再开均回到默认牌背和关闭的牌堆面板；刷新得到新的普通认证投影，保存的所有牌区保持。
- 经真实编辑器授权移动一张合成牌到公开弃牌区；退出全能后真实 pointer hover 可查看公开弃牌，重开全能仍隐藏私牌。
- 两种尺寸所有被测按钮由 Playwright 正常点击（不 force），页面/编辑器/牌堆列表都无横向溢出，记录几何数值和仅默认牌背截图。

首次浏览器证据为 `.local-evidence/website-omniscient-controls/run-k0PEkc/result.json`，两种尺寸各 6 组加公共脚本/网络组，总计 13 组；`completed: true`。`scriptErrors: 0`、`externalRequests: 0`、`fixtureDatabaseRemoved: true`。两种尺寸初始编辑器、打开牌堆、最终编辑器共 6 次几何记录中，page/editor/deck 横向溢出均为 0。

本次 service SHA-256 为 `badfa56129fdeff082c6b1a7ac4d8742130195d4d5b8663d1a4ccbb6824326b6`；网站 index SHA-256 为 `fa1c82d638fea8748f5d9ebe26e6c8d98f261b7eb803797d3d8ebe5d18ee6e22`。结果同时记录 Editor、DeckOrderPanel、TableApp、CardLayer、mount 的实际源码散列，供协调方冻结发布时比对。默认牌背截图为该证据目录内 `desktop-1280-default-backs.png`、`mobile-390-default-backs.png`；后者已只读视觉核对，牌背标签与暗注背面正常，内容按竖向滚动呈现。

结果仅保存安全标签、计数、布尔、几何、代码散列、失败阶段/类别，以及默认牌背截图。合成投影/命令只在运行内存中，SQLite 退出删除；不存 token、牌 ID、视图、SQL 或显示手牌后的截图。本专项是新增控件的独立本地浏览器证据，不能替代原全能授权 13 项；原专项仍按完整 CI 的独立结果记录。未访问公网、生产数据库或实体手机；未 commit/push/部署。

## 审计追加：ActionBar 私牌文本旁路（扩展已准备，待重建与真实浏览器重跑）

独立审计发现，此前默认牌背和 Inspector 隔离未覆盖底部 `.tda-actionbar-prompt`：本家已有暗注、隐藏手牌被选中，或“显示所有手牌 → 选择 → 隐藏所有手牌”后，ActionBar 仍可能输出私牌名称和点数。协调方在 `hud/ActionBar.tsx` 做最小生产修复；本工具仅新增回归，不修改该生产文件。

此前 `run-k0PEkc` 的 13/13 结果原样保留，它仅证明当时已测范围，不能作为此文本旁路已验证的证据。当前新增工具已加强所有 `hidden()` 检查：`.tda-actionbar-prompt` 只能是空、`牌背` 或 `你的前注` 等当前前注阶段泛称，不得出现数字点数或任一私牌名。私牌名来自两名真实普通玩家最初自己手牌 DOM 的可访问标签，仅留运行内存；已有本家前注仍由真实 Space/Enter 合法提交，不手动修改 DOM/牌局。

另为 1280px 和 390px 各增加一间独立真实合成房间，房主仍处于未下注前注阶段：

1. 隐藏全能进入默认牌背。
2. 实际“显示所有手牌”，通过真实 own-hand focus/Space 选择合法牌；先确认显示状态确实有牌名和点数，形成阳性控制。
3. 实际“隐藏所有手牌”，确认 ActionBar 仅显示 `牌背`，不含私牌名/点数，合法“前注”按钮仍存在且 enabled，GameState 完全不变。
4. 用真实 Escape 取消选择，再对隐藏合法手牌 focus/Space；仍显示泛称、保留合法“前注”按钮，GameState 不变，普通玩家手牌/私牌边界保持。

新增两组与原 13 组一起执行，目标总数为 15；原 13 中的默认隐藏/暗注检查已同时加强。结果源码散列增加 `ActionBar.tsx`。本次准备只执行 `node --check tools/website-omniscient-controls-browser.mjs`，实际退出码 0；截至本节写入，新断言尚未构建或运行浏览器。需由协调方统一重建后重新跑当前工具，保留首次实际失败或通过回执。

## 审计追加：ChoicePanel 手牌候选旁路（扩展已准备，目标 19 组）

独立审计第二项指出，狗头人 `EXCHANGE_HAND_CARDS` 等能力选择中的候选本来属于当前 privateHands，ChoicePanel 仍可能显示真实前图、alt 名称、点数和私牌 Inspector。协调方只在候选属于当前全能 `privateHands/privateCommittedAntes` 且尚未显示手牌时遮蔽；术士公开揭示、牌阵和弃牌等公开候选保持正常。该生产修改由协调方负责，本工具只扩新增回归。

浏览器工具在 1280px、390px 各增加真实规则生成的狗头人与术士待选状态，共新增四组，当前预期总数 **19**（原 13 加 ActionBar 两组加 ChoicePanel 四组）。此前 13/13 与尚未独立运行的 15 组准备状态保留其各自范围，不把旧成功扩写成新旁路通过。

工具运行时用 rolldown 编译真实 `rules/index.ts` 一次，调用实际 `createGame` 和 `applyAction`，通过真实合法前注、首位出牌与能力结算产生房主的 `pending.kobold / pending.sorcerer`。检查实际引擎不变量、完整牌池和货币守恒；不手写 pending、队列或能力效果。仅在服务已真正关闭并释放缓存后，写入本工具创建的临时合成 SQLite，再创建真实服务并等待原浏览器的实际 WebSocket 重新认证，核对精确 fixture 状态。这里是明确的合法规则状态夹具，不能称为自然完整牌局或真实玩家 UAT。

每种尺寸分别验证：

- 普通模式实际 pointer hover 候选可产生 Inspector，为隐藏后的 stale Inspector 提供阳性控制。
- 全能默认隐藏狗头人私牌候选：无直属前图，纹理 alt 为空，角色图片和点数槽只能显示编号牌背，文本/title/aria 不含当前私牌名；真实 focus/Space 选择不产生私牌 Inspector，确认按钮仍 enabled。
- 显示所有手牌后候选前图、实际卡名 alt 与精确点数正常；再次隐藏后回到编号牌背，候选 selection 保持。
- 术士候选来自实际 `game.revealed`，不在 privateHands；隐藏/显示手牌都保留其前图、alt 和精确点数，避免把公开选项一起遮蔽。
- 狗头人在全能背景面板使用真实 button focus/Space/Enter 选择与确认；术士关闭 Editor 后以正常 pointer hover/click/confirm 对照。真实 choose WS 命令只提交一次，服务结果与未改引擎 `applyAction` 精确相同。

Editor 当前 z-index 85、ChoicePanel 70，产品层级保持。全能 Editor 覆盖的背景 ChoicePanel 属于 DOM/focus/键盘攻击路径验证，**不列为可见 pointer 验收**；不 force、不改 DOM/style 来伪造可达交互。公开术士的普通模式是实际 pointer 验收。

结果增加 `expectedChecks: 19`、`ChoicePanel.tsx` 代码散列、各合法夹具/确认/指针边界布尔。生成的规则 bundle 只含源码，私牌 label、投影和命令仍仅在 RAM；证据与数据库清理边界保持。此次仅准备源码并 `node --check` 实际退出码 0，尚未重建或运行当前 19 组；须等待协调方统一构建和唯一浏览器窗口后记录首次真实结果。

协调方首次实际执行当前扩展19组：root统一build含tsc exit0、buildserver exit0后，node tools/website-omniscient-controls-browser.mjs --gpu default exit0，47.24s，run-YBtPZT passed19/expected19，脚本0/外域0、临时DB清理true。两视口privateChoice/ActionBar新负对照和公开Sorcerer控制全部通过；7源hash与当前逐一一致，独立模型已另核相符并功能审阅通过。旧13/此前15准备边界保留。完整发布CI/原13/包/公网待。
