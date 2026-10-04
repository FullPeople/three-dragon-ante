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
