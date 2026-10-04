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
