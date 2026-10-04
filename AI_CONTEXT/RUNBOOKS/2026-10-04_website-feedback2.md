# 2026-10-04 四项网站反馈（执行中）

用户确认已上线801daf5/0.9.1可用，新增术士选择遮挡、快拖错牌、观战和全能牌背/查看排序牌堆需求。授权与范围见GOAL §13、DOMAIN §7。隔离工作树U:/CodexWork/2026-10-04/three-dragon-website-feedback2-7e64866，起点7e64866，当前2507c8d额外合入已审阅的观测帧FX测试采样；先git fetch exit0再改。候选版本0.9.3-dev，不表示已上线。

当前：首轮真实mouse桌面/390宽×0/25/180ms六组均提交实际B，没有复现拖A；术士真实合法2–6席选择都位于通用上半部面板，须改专属dock。实际基线ignored result baseline-JjBjvS，零脚本/资源/外域错误，未把未复现写成已修复。术士/输入由独占agent负责；观战service/网站准入独占agent负责；全能牌背与deckOrder由root负责。各具体工具证据见专项runbook。

首次server npmci -4055 ENOSPC；只读确认C Free0，U约90GB。改为本worktree ignored npm cache，不删除其他目录/全局配置，首次log保留。修后依赖/构建/回归未完成。

遗留（同步TODO）：四项实际验收、原回归/精确CI/独立审计/源码归档包与定向部署、公网新功能验收；快拖根因尚未复现，不能猜测修改。线上仍801/0.9.1；Suite/card/nginx/systemd/env/旧存档保持。真实玩家数据和密钥不得入库。

用户随后纠正：术士问题是场上前注牌遮挡，不是选择UI。先前通用面板几何不代表用户所报根因，暂停并撤回专属dock方向，重新取证前注实体placement/替换落点。root已撤销术士专属CardInspector隐藏，仅保留全能隐牌逻辑。

观战实际纯Node13/13和deckOrder实际纯Node10/10首次exit0：真实HTTP/WS、临时合成SQLite及重启/回执/权限/守恒/跨zone负对照；不是浏览器或公网。牌堆下次合法抽牌按deck[0]已实际验证。前端默认背、独立查看按钮/完整排序草稿源码已落，typecheck与真实browser待完成。

真实浏览器首轮：观战13/13 run-qLlSWv与全能新控件13/13 run-k0PEkc均exit0，桌面/390、无脚本/外域/横溢。后续独立模型gpt-6.1-sol high发现ActionBar选牌/本家暗注仍打印牌名P2；此前新控件13未查此文本，不能覆盖它。root最小隐藏此prompt身份、保留牌背选择和操作按钮，新增实际负对照待跑。独立审计继续，非终审通过。

同一独立审计第二项P2：ChoicePanel在狗头人等私手牌选择中始终画正面/点数。root仅对仍在全能privateHands/未公开前注中的option画背并禁止hoverinspect，公开术士revealed、场上和弃牌选项保持正面，不动UI落位或选择动作规则。此为全能遮罩补齐，真实合法私手牌choice与公开choice负对照待补，不能由初次ante13/13继承。

## 四项本机验证闭环（完整冻结CI尚待）

输入/实体前注最小修复c955171：CardNode悬停200/选中100/拖动300（仍保留order），共同前注专用小排位。真实旧82%重叠xQshRZ桌面/390六组均A5截获并提交，边缘/中心12组原本正确B，明确是命中遮挡不是controller替换动作。旧前注A18y48十布局压住本家牌阵，新LzpckY十布局无主要元素覆盖、20次实际inspect匹配。首pdWlzq窄屏新位置inspect失败保留，另xtI3VO ×按钮测试交互失败保留。最终综合wySPpw12/12 exit0，2–6席/两个视口、12组中心和82%真实快拖仅B提交、错误ACK不落/匹配B落一次、取消与原生touchCancel无提交、10合法术士confirm、错误/资源/外域0。纯layout/CardNode旧源与上线801一致。

root重建新遮罩：build含tsc exit0、buildserver exit0；controls首次扩展19/19 exit0 run-YBtPZT（此前13与两审计P2都保留，不覆盖）。原13加强ActionBar，新增2未commit实际keyboard選背和4真实引擎合法Kobold私候选/Sorcerer公开候选fixture；只合成SQLite service停后写入再真实重启/WS恢复。全能背景ChoicePanel是DOM/键盘验证，普通术士是实际pointer，不声称背景被modal覆盖选项可pointer。源输入检查一致、无脚本/外域/横溢；新文件待终审和整CI。

只读线上preflight inspect真实exit0，snapshot .local-evidence/feedback2/preflight-current.json，authority active/原SHA f9627642，Suite/card/nginx/unit/relay仅记录保护；未上传/应用任何新包。此不是实际发布前fresh baseline，真正apply前必须重新核。普通/公网新功能验收与原13/全部回归/精确CI/独立终审/冻结GPL包/定向发布仍待，线上801/0.9.1保持。

原website-omniscient13专项补安全DOM清场observer准备：不修改任何94条原assert/wait/pass/deadline/destroy/failure行，500ms原断言逐字保持；仅断言后/catch后读Date.now/null/存在状态，采到的是observer回调观察时刻而非内核精确commit。独立模型只读认可，首次新实际13/精确CI尚待。诊断用于保留e290原6后500ms失败，不放宽阈值重跑碰运气。

原Node完整：npm test 8/8 exit0 49.144s（含controller/handover/legacy/stable/time-dragon原检查），npm run test:server 2/2 exit0 10.5s；证据.local-evidence/feedback2/original-node。此前构建/新专项与原Node均真实通过，但原browser15/server-browser4/FX9/全能原13及完整Linux新冻结仍待首次运行。

换模型gpt-6.1-sol/high独立功能审阅完成，逐一核7控件源SHA+serverbundle/siteindex、6输入源beforeaftercurrent以及旧六A/new12B，两P2实证闭环，未剩必修P1/P2。几何措辞限实际遮挡采样0：部分3席strength矩形交叠且深度铭牌在前，不说全场矩形绝不重叠；coins透明canvas不能仅以hittest断言，结合无交叠和两6席截图。原全能13/精确完整CI/GPL包/公网等发布终审仍待。见独立audit runbook。


## e934fbb 首次 Linux CI 与真实入场等待

精确 head e934fbb52923b26849f536fdd373a2fd1df749bb 已正常推送，但首次完整 CI 37208665316 / job111455144981 实际失败：新增 input 专项仅合法夹具1项后，在第一个desktop2席共同前注遮挡断言停止；其后全部原回归跳过，不称完整通过。观战Node13/13、牌堆Node10/10、观战browser13/13、全能控件19/19以及前置构建/原权限与宽限 Node 专项实际通过。完整原日志与一次下载的artifact保留在 ignored .local-evidence/feedback2/ci-e934-*。

原始 run-6mMI09 显示 neutral目标CSS变量511或589/490/z3或4，但两张neutral及多张flight/hand的computed transform均仍是deck起点720/520/30，固定850ms时尚未完成入场。测量对象必须为最终排位：保留原850ms，额外等待真实CardNode阶段结束、真实CSS transform transition结束并核DOMMatrix平移与目标变量吻合，默认超时不改；所有原遮挡/实际click/12快拖/ACK/cancel/10choice断言保持。新增settlements仅记录额外观察耗时，不修改浏览器动画或生产源码。首次修后本机run-jJvjoH综合12/12 exit0，十布局/20次inspect/12快拖及六source beforeafter匹配；旧排位负对照及独立只读审阅继续，不靠盲目重跑CI。

e934冻结网站包本地独立校验实际exit0：1948 tar记录、450 Git源码blob、1正/11个变异拒绝控制均通过；remoteVerification false，不是线上核验。稳定/开发各973文件，source ZIP SHA05c42011ad8a728d1fcbf40bdcb709a53ad64feeb7cb95c1241b2a0bba1dfc55，tar SHA2ea15156f8b4d2fdceabd0dd21109a0bd863adbdc2a4ea515480a3a65ee2aa9d。因完整CI失败，此包保持冻结不上传/部署，新source须另冻新包。

遗留（同步TODO）：确认真实等待不弱化门禁的旧基线负对照/独立审阅，原全能13诊断首次执行，新精确完整CI及新冻结包发布终审；以上完成后再 fresh baseline、定向两个网站与必要authority、独立after和公网新功能验收。线上仍801/0.9.1，Suite/card/nginx/unit/env/旧稳定未部署。

真实等待修正经原模型之外的gpt-6.1-sol/high只读复核：27条原断言/计数/失败行、原等待参数和快拖时序不变。旧排位baseline-wPMWsF在真实settled后仍严格遮挡失败exit1（预期负对照）：computed等于目标845/955/650/z3/4，flight等覆盖采样25/17/25/18；六源一致。这不是依靠不落地的异常帧保留失败。原website-omniscient首次新source实际13/13 exit0 run-hANAPe，500ms逐字原门禁通过；cleanup observer：cut9375→断线观察9381→editor移除观察9382→Node观察9419（绝对Date.now前缀179112432，约7/44ms，仅回调时刻）。错误/外域0，原e290六项后Linux失败保留且根因未查明，不能用本机13替代新Linux全门禁。


## 0588ab8 精确 CI 首次多人门禁失败，发布继续 held

精确CI37209674413 / job111458106186实际：新增input12/12、观战13/13、全能控件19/19、原全能13/13（原500ms也通过）、铭牌21/21、双客户端演出软件14/14与3D16/16、原npm8/8与server2/2、browser15/15与serverbrowser4/4及前置所有Node/入口/发布保护等均通过；原 site-multiplayer 17项后 line364 的 wsAttempts 单次断言5!==4失败。FX9及全部后续FX/lifecycle/ambient/producer/structure没有运行，不冒称完整成功。日志、一次下载artifact在.local-evidence/feedback2/ci-0588-*。

原失败KumP9B安全记录：owner stale refresh初WScreate88930/代理upgrade88934；5秒后93934服务发1008（无auth）；浏览器直到112724才open，113128收到clean authenticationRequired；依原500ms backoff重试113631→113635open→113637auth→113640notAllowed clean失效终态。最终拒绝正确，但多一次开口违背原计数。不要调计数/放宽期限/去改5000ms权威认证期限。浏览器收到握手晚、事件调度晚或GL阻塞的具体原因尚无证据。

仅原工具新增安全元数据准备：HTTP101写入后corked/aggregate bytes、CDP handshake101 native持续时间、原JSopen时序、PerformanceObserver数字longtask与桌面GL调用时段，不保留payload/header/URL/token/player数据；不更改原assert/重试计数/等待参数。第一轮本机 --reconnect-only（部分路径）w1qGD5实际13/13 exit0，未复现Linux延迟，本机初stale handshake36ms；不是原全22或新Linux成功。当时GL元数据增量未运行，后续首次实测见本节末段；仍需精确原Linux环境首次诊断，不盲重跑以绿掩盖问题。换模型只读确认TableSurface初始无game也可同步编译/纹理上传，但未证根因，且reducedMotion测试不启three舞台，不能归因three.js。

新公网验收工具仅ignored .local-evidence/feedback2/public-feedback2.mjs，SHA3e9c5da723014231681179d4c5f31af9a970fdcda1156b61203f28455de1a56a。两个冻结真实构建+loopback authority的新功能本机预验15/15 NVK9Dw：稳定1280/开发390、lobby/latewatch/refresh/exit/reconnect无私字段、全部手牌/暗注默认背、显隐无write、独立牌堆/精确单次排序revision/其他投影zone不变、刷新顺序持久且显隐撤销、三个overflow0、脚本/资源/外域0。不是公网，无生产SQL/现存房数据。保留该工具准备失败：缺少名字focus导致Snmacd/jDy3yI（以及Python默认GBK修改失败后的原样f4lTaH），旧alias再次加入符合nameTaken导致zTcF8w，误把压缩wire字符串当Card.id导致iGrGr2/CmUXA9；都只修验收工具，没有据此改产品或网络codec。

0588新冻结包独立根checker和换模型额外逐项校验1948 tar文件/450 git源码blob/GPL均通过，1正11负仅合成快照且remote false；源0588ab852019e88dbb389f1cebb80c0212d54ef5，tar51621fafed9e029ac611933597d87bfaf0da5d356cc5e56f27df58b1e3a067b1、sourceZIP63a7880d082139592f0419891feeefac6d6344575f7ea833bd34758cb941040b、authoritybundleb16e8519210ceac218c335c8df5f82aea8a3e441965ea16e2843035f966a406a。但精确CI失败所以继续冻结不部署。

遗留（同步TODO）：原多人口径的精确Linux握手/JS/GL安全取证与根因修复，原计数/期限不改；精确完整CI和全后续FX门禁、最终新source/GPL归档、fresh before/部署/after独立保全与新老公网验收。两个e934/0588包都held，线上801/0.9.1保持。

GL数值元数据增量首次本机 --reconnect-only nZCYIL实际13/13 exit0，错误/资源/外域0，语法/diffcheck0；原124条assert/wait/pass/timeout行按0588机械核逐行完全一致。此为工具安全运行预验，不能替代原完整22或精确Linux根因证据，接下来仅正常推送新增诊断的head跑原全部Linux门禁。

换模型只读复核本轮诊断与公网工具准备通过：较宽筛选127条原门禁/计时行逐字未变，authority source无改。socket.write调用后corked/总bytes本身不证明flush或收到，追加真实write callback数值记录（回调也只证明stream写完成，不是客户端收到）；CDP本机13正常、GL确有数值样本但没有Linux23.8s根因证明。公网工具用冻结两前端与repo当前loopback service，不冒称包内entry现场运行或公网。

### 4473030 首次 Linux CI 与失败诊断（23 时续轮）

精确源码4473030c205b4909497beacd9e5126a5c228c50c正常push后，首次CI37211445407/job111463290381失败。依赖、build/typecheck/server、观战Node/牌堆Node/host-grace/auth/pending及观战browser通过；第15步新增全能controls只有1/19，在desktop-1280-default-backs等待约30秒后OtherError。第16–38步全部skipped，包含原多人握手诊断、所有FX门禁；不能称握手根因已经取证。本轮只一次下载artifact，留存ignored ci-4473-job.log与ci-4473-artifacts，result.json显示脚本/外域0、临时SQLite清理完成。这里的组合标签不能证明具体哪一个等待超时，不能据此修改产品或归因GPU/隐私。

只在controls测试工具补细分步骤，以及在context关闭前采集有界白名单失败信息：数字源码行列、TimeoutError名称、DOM数量/布尔与48条focus/pointer/允许键事件。不保存异常message、DOM文字、私牌ID、连接URL、会话、projection、command或SQL。失败时每个actor采样最多2秒；原成功路径断言、19 checks与原等待期限保持，不加成功路径重试或放宽标准。首次本机运行、门禁机械比对和换模型只读审阅结果随后记录；线上仍801/0.9.1，e934/0588包仍held。

增量实际验证：node --check与diffcheck exit0；新工具首次本机run-ECJdqJ完整19/19 exit0，脚本/外域0、fixtureDatabaseRemoved true，不能替Linux失败定位。根AST抽取原150条assert/equal/wait/pass/delay/setTimeout/waitFor/Function调用逐字同序（仅排除新失败采样函数），proof在ignored controls-diagnostic-gates.json；工具SHA4842405439c845c96890f30cce7c08a362c009c8d8eb3be6d0e05d8886372ce4。gpt-6.1-sol换模型独立只读复核86个assert、9个pass、36个await等待逐字同序，原19与全部视口/期限/cleanup/exit保持、未发现私数据输出或门禁弱化。观察器成功路径有小量固定DOM查询开销，不能声称零扰动；失败采样host/peer串行各2秒，总上界约4秒。后续只正常push这个有新诊断的冻结head进行首次完整CI，不重跑447原样CI、不改产品或放宽原门禁。

### 冻结网站真实默认GPU完整对局预验

ignored fx-website-acceptance.mjs基于原公网12项工具保留全部原验收、期限与66秒空房宽限，新增实际默认GPU双舞台及原生绘制两个正向检查。首次run-PwWhzM在8项后新增draw计数失败：observer错误使用drawArrays第二参数first作为count，保留失败；核对已安装lib.dom签名后只更正observer的count下标（drawArrays第三参数/drawElements第二参数），没有更改产品或降低正向条件。

更正observer后实际run-CX0XIT完整14/14 exit0，使用0588冻结稳定/开发前端与仓库当前loopback authority、实际UI自建合成房间。两人2次前注、6次出牌、3次能力选择、1次可见权威结算；air POINTS4125/4016与ground draws1132/1109，舞台three-high/three-medium；刷新、运输断线恢复、自动房主继任、名字恢复与最后所有浏览器离开66秒后的房间解散通过。脚本、资源失败、外域均0。这是本机完整对局及真实绘制证据，不是公网、Linux全门禁、物理GPU或FPS证明。公网版本未更新。

遗留同步TODO：先定位447新增controls实际超时步骤；0588原多人23.8秒延迟原因仍未知，保留原次数/期限；精确完整CI/后续FX、最终发布终审与新冻结GPL包、fresh before/定向部署/after保全及新老公网验收仍待。
