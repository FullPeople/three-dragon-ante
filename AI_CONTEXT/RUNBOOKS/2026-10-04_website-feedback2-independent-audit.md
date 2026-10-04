# 2026-10-04 网站反馈第二批独立审阅（进行中）

审计模型：gpt-6.1-sol / high（root 明确以 fork none 创建独立会话，模型参数由 root 核对）。

裁决：本批四项功能的源码及新增专项证据审阅通过，两项P2已闭环；完整发布终审尚未通过，不能作为上线许可或上线证据。

## 范围与独立性

只读审阅隔离仓库 `U:/CodexWork/2026-10-04/three-dragon-website-feedback2-7e64866`、分支 `release/website-feedback2-20261004`，对照 `2507c8d` 并核对相对 `7e64866` 的差异。生产源码仍在持续修改，不是冻结提交。审阅者未运行浏览器、npm、tsc、build、测试服务、commit、push 或部署；唯一写入是本审计记录。

已读 INDEX、GOAL §13、DOMAIN、AUDIT 和 feedback2 / spectator / deck-order / input 专项记录，直接审实际规则编辑器、服务、网站会话、UI store/mount/presenter、场景和 HUD。未把开发者结论当作独立实测。

## 初审发现与源码复查

1. P2，`presentation/hud/ActionBar.tsx` 原第18–19行：全能默认牌背仍直接显示已选本家手牌、已提交本家暗注的牌名与点数。真实可达路径为：隐藏模式选择合法本家牌背；显示全部后选牌再隐藏；当前只有本家已下注时打开全能。Scope 切换会由 presenter 清 selected，因此不将“进入全能必然保留旧 selected”作为复现前提。开发方已新增 `hidePrivateLabels`，同时判断当前/展示全能投影，选牌改为通用牌背文本，暗注只保留已下注提示，保留操作按钮。源码复查已修；后续 run-YBtPZT 的真实双视口未提交手牌选择负对照及强化暗注 hiddenPrompt 已通过，见末节。

2. P2，`presentation/hud/ChoicePanel.tsx` 原第51–54行：私手牌选择仍无条件渲染正面、牌名 alt 和点数。引擎 `rules/engine.ts:314` 狗头人 `EXCHANGE_HAND_CARDS` 直接使用 `choiceCards(self.hand)`，第290、321、338行还有幼龙/预言者/索牌的手牌候选，合法选择状态可达。开发方已按当前/展示全能投影中 privateHands 与 privateCommittedAntes 建立隐藏集合，仅这部分候选用牌背、通用编号，禁止 hover 私牌详视；公开 revealed / flight / discard 不在隐藏集合中。源码复查已修；后续 run-YBtPZT 的合法狗头人私手牌与术士公共候选双视口负/正对照已通过，见末节。

## 已审权威边界

- 独立抽查 GOAL §13 “观众不占座且不得继任”：service.mjs 的观众 admission 不向 seats 添加成员、不写牌局；自动 successor 与手动 handover 均过滤持久 SPECTATOR；command 对观众除公共 history 与无状态 leave ACK 外全部拒绝。与下述实际 Node / 浏览器观战证据一致。
- 观战由持久成员角色决定，不信任客户端模式；同名跨模式拒绝发生在凭据旋转前；当前连接只用 packPublic(projectPublic)，无 selfSeatId/hand/actions 等座位私字段。已有坐席、凭据旋转、持久角色恢复、成员上限、无人房与继任语义已检查。
- deckOrder 使用精确 game revision 与当前 deck 的完整严格排列；重复、遗漏、跨区、未知、非字符串等输入不能通过，守恒由原权威 invariant 再检查。只改 deck 与必要 game revision，持久 receipt/history/state 同一 SQLite transaction，缓存只在 commit 后替换。旧 nonce 返回原回执但不重做编辑；失权后仍不能新写入。UI 排序是局部草稿，按 game/revision 重挂载，Apply 才发送事务。
- 默认显示许可只在本机 store，不进入 UIDraft；进入、失权、断线、刷新、暂停、切换局/房都会重置。私牌 Inspector 有隐藏过滤，CardLayer 不向隐藏牌提供私牌提示/详视。Ghost 的已知卡使用公开事件来源，未知手牌传输保持牌背；未发现额外必修旁路。
- 相对基线未改 play 引擎、协议/wire、卡图、旧模块或 Suite。CI 仅新增本批检查，原网站授权专项和原断言仍保留。

## 直接读取的实际证据及限度

- `.local-evidence/website-spectator/run-F2SmAB/result.json`：completed true、13组。真实 loopback HTTP/WS、合成 SQLite；100ms/220ms 是明确加速政策夹具，不能代替生产8秒/60秒实等。
- `.local-evidence/website-deck-order/run-ESiGCS/result.json`：completed true、10组、7次真实服务重启、5种合法引擎阶段、9种跨区守卫、下一合法抽牌取已持久 deck[0]，临时数据库已删除。
- `.local-evidence/website-spectator-browser/run-qLlSWv/result.json`：completed true、桌面/390宽各6组再加错误检查；公投影帧有记录、私帧为0、脚本/外域/资源错误为0；源码 before/after 散列一致。
- `.local-evidence/website-omniscient-controls/run-k0PEkc/result.json`：completed true、13组，桌面/390宽零水平溢出与零脚本/外域错误。该运行早于本次两个P2修复，工具的 hidden() 当时未检查 actionbar 文本，也未进入私手牌 choice；不能覆盖该两项闭环。
- 直接 Get-FileHash 核对 edits.ts 当前 SHA-256 `27b0e803fc810f9dcd30f1178ea00ec66b723e8079937051afb0c7bb675f21b3`、实际 service bundle `badfa56129fdeff082c6b1a7ac4d8742130195d4d5b8663d1a4ccbb6824326b6` 与 deck 专项记录相符；service 源码 `6c2c9857a4fa1df793ab05991e33fd988b9704ec2e2b13e6ccca701c3025c07a` 与观战 browser 记录相符。
- input 的旧版 `.local-evidence/website-feedback2-input/baseline-A18y48/result.json` 直接记录术士合法结算后的共同前注覆盖 flight/deck/discard。neutralAntePose 仅调整无座位归属共同前注的位置、尺寸、紧凑排列，未改归属/规则；初审时新2–6席双视口几何及每张牌可点击仍待，后续 run-wySPpw 完成并复核，见末节。

## 尚未闭环

截至末节补审，两项P2、新布局与快拖根因专项已经闭环；旧网站全能13项完整重跑、冻结提交完整精确CI、包/源码归档及公网验收尚待。不继承历史 e290 的“6项后在500ms清场断言失败”为绿色；该历史失败此审阅会话未现场重跑。当前证据是合成本机浏览器与实际本机服务，不是公网发布、实体手机或真实玩家UAT。

## 原全能专项新增清场诊断：准备审阅

按 root 后续请求只读复核 `tools/website-omniscient-selftest.mjs` 新诊断差异。`e290` 实际解析为 `e290ea020b25c0bccdd92692fdd9db9f569c821b`；该文件从 e290 到 2507c8d 无差异。

- 实际 diff 中新增 MutationObserver 安装在断开前；只读取两个 DOM 是否存在/状态属性是否为 false，把 Date.now 回调时间保存为 startedMs / disconnectedMs / editorRemovedMs。没有读牌名、ID、图像、投影、会话或 token；window 诊断变量仅为测试页中的时间对象和 disconnect 函数。时间是 observer 回调观察到 DOM 状态的时间，不宣称浏览器内部 commit 的精确时刻。
- 原 disconnectedAt、transport.destroy()、waitForFunction 条件、编辑器/card/gold 的 count=0，以及 Date.now()-disconnectedAt<500 原断言逐字保留。新增 cleanupActor/cleanupCutMs 赋值没有移动起始计时，成功分支 evaluate/console 在原断言之后才执行；失败分支先保留原 failure，再采样诊断，最后原 if(failure) throw failure 仍保留。失败诊断读取异常只记录 observationFailed，不吞原失败。
- 只读 Node 文本比较确认94条原验证代码行（assert / wait / waitFor / pass / counter / deadline / disconnectedAt / destroy / failure throw）顺序及文本完全相同；忽略注释和新增诊断赋值。没有借此运行测试或编译浏览器。独立 `node --check tools/website-omniscient-selftest.mjs` exit0。
- 新脚本 SHA-256：`309c77559c96fae2ff8c2088b6a55cefc64a3c052c45d0ef68cc4775b70e75c8`；上述94条原验证行串 SHA-256：`80e8e16c47b2fcf468f2b2ce17b4799107ae91ccf7fe8e64189ad9d6dcd51590`。
- 最外 catch 前多一个空格仅格式差异；最终 diff 没有临时alias断言替换。

准备裁决：此诊断源码变更通过只读审阅，未降低原500ms门槛、等待期限或计数，也未新增私牌留痕。这里没有运行原13项或浏览器，不把语法/逐行核对写为实际专项通过；历史失败和整体发布门禁仍保持。

## 全能隐藏期间 Ghost 私牌旁路排查

按 root 追加关注完整追踪 presenter cardMoves → transfers/purchase → GhostLayer，不凭组件表面有 flip 就判定泄露。全能同 scope 相邻 revision 仍可走动画队列（presenter.ts:525、537、542），不能以“全能没有动画”排除。

- 合法金龙抽牌由 engine.ts:107 的 draw 放入私手牌，不发牌 ID 公共事件；presenter.ts:169、177 的抽牌 ghost 只用公开计数，cardId 缺省、faceDown=true、无 flip。即使全能或本家接收也不会从私手牌/私牌堆补进 ghost 身份。
- 红龙/女王随机偷牌由 engine.ts:124–130 的 takeHand/randomHand 执行，CARD_TRANSFERRED 在第128行固定不给 cardIds。presenter.ts:142 因而只产生 cardId 缺省、faceDown=true、flip=false 的 ghost。选择交牌会另公开 CARD_REVEALED，但仍不把私牌塞进转移 ghost。
- 有真实 cardId 的 ghost 来源是公开 DISCARD_RECLAIMED（presenter.ts:146）、上一帧公开 ante（第156行）、公开 BUY_PRICE（第150行，engine.ts:182 先入弃牌并发价格 ID）。GhostLayer.tsx:19、33、38 必须有 cardId 才会翻面/画真实正面；价格牌的翻正是原公开流程。此类原已公开牌从弃牌/前注进入手牌的移动动画保留公共信息，落入手牌节点后由 CardLayer 默认背处理。
- 本家弃手牌 ghost 的 faceDown=false，但同样 cardId 缺省，不渲染私牌图；后续目标弃牌本来就是公开区。

裁决：当前合法 privateOwn draw/steal 通过 Ghost 暴露私牌身份的假设被实际源码排除，未新增P1/P2，不据该假设改产品。这里是源码追踪，没有运行动态浏览器，尚待整体动画回归。

## 四项功能补审：源码与新增专项闭环

直接审阅当前 `c9551715216b1ecc1692e872a045aecac8a8f8b3` 的两项输入源码修改，以及其余未提交网站/服务/全能源码。该输入提交只含 layout.ts、CardNode.tsx、新input工具和对应runbook四文件；未改 TableScene/controller/rules/协议/回执。此审阅者仍未运行浏览器或构建。

### 全能P2补验

直接读取 `.local-evidence/website-omniscient-controls/run-YBtPZT/result.json`：completed=true，passed=expectedChecks=19，全部8个case完成，默认GPU，脚本/外域错误为0，临时数据库已删除。逐一计算并核对结果的7个源码 SHA、实际 service bundle SHA 和 site index SHA，全都与当前文件相符。

新工具实际从普通座位DOM收集牌名，仅在RAM中做负对照；hiddenPrompt 只允许空文本/牌背/你的前注且禁止点数、私牌名。另建无任何前注的新实际房间，以真实Space选牌→隐藏及直接隐藏Space选择覆盖 ActionBar，保留合法Ante按钮且权威状态不变。原仅本家暗注场景也补进相同hiddenPrompt断言。

狗头人/术士两种夹具由实际createGame和合法applyAction产生，检查完整牌/币守恒；临时SQLite在权威停止时写入，实际服务重开/WS重连读取，不修改pending来冒充合法状态。狗头人私候选检查无正面img/私牌alt/真实strength、旧详视清场、显示/隐藏保留选择，以真实focus/Space/Enter提交唯一合法choose。Editor覆盖背景Choice，故这部分仅称DOM/focus/键盘旁路验证，不称可见pointer验收。术士候选确属revealed公共牌，隐藏全能期间仍正面，退出全能后普通hover/click/confirm完成真实pointer正对照。两个视口均通过，结果等于未修改引擎的真实applyAction。

### 前注实体与快拖补验

直接读取 `.local-evidence/website-feedback2-input/run-wySPpw/result.json`：baseline=false、diagnose=false，12组、failure缺省、script/external/resource错误均0；6项sourceBefore/sourceAfter完全一致，且全部与当前文件SHA相符，builtOverrides为空。直接读取旧baseline-xQshRZ，6组82%重叠区确实pointerdown=5且唯一提交A5；新run-wySPpw中心/82%×0/25/180ms×两个视口12组全pointerdown=4、唯一提交B4。修复是CardNode遮挡次序drag300/hover200/selected100，控制器未把收到的B改成A；旧路径实际是DOM先命中A。新工具正式断言提交未落地、错nonce仍pending且未落地、匹配ACK后仅B在ante落地一次；暂停/断线/销毁活跃拖动与原生touchCancel→pointercancel都不提交。

10组合法术士结算共同前注的几何测量仍有两张真实实体，revealed=0、术士已离开flight；targets涵盖所有hand/归属ante/flight/姓名与点数plate/牌堆/stakes/hole/金币canvas实际bounds。新记录没有coin/hand/flight/pile的几何交叠；部分3席点数plate的轴对齐bbox有少量交叠且hit=0，所以准确表述为“零共同前注在目标前方的遮挡采样”，不宣称零几何交叠。点数plate源码为translateZ(26px)，共同前注仅z=3/4。金币canvas有pointer-events:none，不能单独靠elementsFromPoint证明绘制无遮挡；这里还核对无金币bounds交叠并直接查看两张6席桌面/390宽合成截图，确认小正面实体仍保留、位于空白处且没压住币/牌阵/牌堆。

工具几何期间只为诊断暂时隐藏choice/inspector/spotlight，随后每组重新启用原样式，两张共同前注均普通click并断言精确对应Inspector，Escape关闭；共20次实际点击，未force。10次原术士选项与确认保持合法替换。竖屏首候选pdWlzq的Inspector遮挡失败仍在证据中，最终(850,1080)没有沿用失败布局。旧原卡未被隐藏来凑几何；横屏scale0.5、竖屏scale0.55，两张真实卡正面可见且可点。

本次审阅的工具 SHA-256：input `20af06a6f8c9fd472a1c7e86792d32543c3e7a598248263c7c7116e29ea3ef1d`；全能controls `baf9079deb9475a5e3909a57c622d07a9afa4e0c85c89c803c5aa1f4590553fe`。输入生产源码SHA：CardNode `bb72a1dddec8335a69371fc6a1147f277de96523b438aa4c582d250fa202434d`；layout `7d1de59711769ca61133958eceb21de2deb6fc78b7466bbf6d380ae02db4bd53`。

本批功能裁决：通过源码与新增专项证据审阅，未发现未闭环P1/P2。维持前述观战/deck权威审查及Ghost公共信息界限；完整发布仍须原13、冻结提交完整CI、冻结包/源码审计与公网验收，不能把19/19或12组当作整体发布通过，也不能当实体手机或真实玩家UAT。
# 23时工具诊断只读复查附记

后续a91→输入前提增量（审计模型仍gpt-6.1-sol）只读通过：原86个assert/9pass/36等待逐字同序，只加1个默认期限真实DOM guard解除等待；按钮涵盖client view.pending/sending/actionpending，没有采用raw wire pending或重试键/绕过guard。ZBviEp负对照真实匹配ACK延迟与输入时禁用布尔支持受控机制；gNhsHZ只有单桌面7/expected6，按有限范围解释。嵌套ACK数组共享引用不能当事件当时快照，按primitive时间/布尔解读；原LinuxACK根因未证。根正式tracked run-2WnSKd完整19/19另有真实产物（没有ACK注入），新精确CI/全部后续原门禁和最终发布审阅仍待。

审计模型：gpt-6.1-sol。对4473030后的controls诊断工具增量独立只读复核：原86个assert表达式、9个pass调用、36个await wait/waitFor/Function逐字同序，19expected/viewport/循环/期限/cleanup/exitCode保持；组合行只拆分插固定step。不保存DOM文本/私牌ID/token/投影；事件环48条passive固定分类，失败后contexts关闭前采样并原样rethrow。每actor采样2秒，双actor串行约4秒；成功路径少量DOM查询有观察成本，不能叫零扰动。裁决：该诊断工具增量通过；不代表447 Linux失败已定位或完整发布终审通过。根本机新增工具19/19已读，不替Linux。

补读冻结网站本机完整对局run-CX0XIT实物14项、127.0.0.1、deployedServer false、2前注/6出牌/3选择/1结算与两个真实air POINTS/ground draw计数；只证明本机真实对局/绘制/恢复/继任/空房，不替公网/Linux/FPS。线上801、发布held事实不变。
