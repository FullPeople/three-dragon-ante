# AI_CONTEXT/MEMORY.md — 三龙牌 长期记忆（可移植正本）

> 本项目「长期决策 + 当前状态」的**跨 AI 正本**。工具私有 Memory 只存指针指这里、不复制正文。
> 写路由：长期决策/坑 → §A；当前运行态/风险 → §B；未完成 → `TODO.md`；每次实质改动 → `RUNBOOKS/`。
> **保密**：禁写任何 Key/Token/密码；只写「密钥在 `.env.local`，由用户管理」。

---

## A. 长期决策 / 反复踩的坑

- **2026-10-03 · 用户对第一版的审美纠偏（必须遵守）**：① 文字不要 AI 腔——不写口号、氛围句、"轮到你·把一张手牌放到…"式引导句、"拖动或点选…"式操作说明；提示只用名词 / 动词短语。② 视觉不要高光渐变的 AI 感——不管文字、按钮还是面板，一律无渐变、无文字发光、无彩色光晕。③ 材质朝 Unreal 式真实写照（木 / 石 / 林、法线浮雕）靠拢。判别清单与规则见 `docs/design/ANTI_AI_FEEL.md`；写新 UI 前先对照它自检。
- **材质混合坑**：`background-blend-mode: multiply` 叠深色照片会黑成一团（metal_plate 菱纹板 + 黄铜色几乎不可读）；黄铜质感改用 `dark_wood` 颜色图 + 黄铜底色 `overlay`。铁片纹理保留在 `.mat-metal` 备用。
- **GLSL 静默失败坑**：`surface-gl.ts` 编译失败只 `console.warn` 后回退 CSS，截图看不出区别；诊断脚本 `.local-evidence/shots/gl-diag.mjs` 会打印 `surface: webgl WxH` 或 `css-fallback`，改着色器后必须跑一次。

- **2026-10-03 · 表现层破坏性重构定案**（用户拍板，细节在 `GOAL.md`）：写实风 2.5D；显著特效；流程进展与等待明确；不用 AI 美术；卡图不变；删历史回放与 41 项练习；独立网站为核心、枭熊为次要；规则/协议/控制器/服务端不动。
- **为什么放弃 Three.js**：旧 stage 是正交固定视角，本质 2.5D，却付出 three 独立包、SwiftShader 软件渲染测试、区域标签随座位旋转倒置、手机端另起 DOM 手牌的代价；DOM 分层 2.5D 可直接复用真实卡面 `<img>`、无障碍与测试选择器更简单。
- **为什么卡牌层用"单一层 + 按 id 保持节点"**：旧 stage 的核心正确性来自"每个卡牌 id 一个 mesh，跨投影 reconcile"，这样投影一到就能平滑飞行且不会凭空捏造对手手牌；新 DOM 实现延续同一模型（`CardLayer` 按 id 复用节点，只改 transform）。
- **旧评估里发现的具体视觉缺陷**（重做时对照检查）：状态气泡压手牌；回合横幅横穿桌面；能力说明层与详视抽屉重复显示同一张卡；能力选择面板压住牌阵；对手区中文标签倒置；手机首屏看不到牌桌；HUD 四处分散。
- **`SOURCE.json` 字节校验**：拆分建仓时为证明"与上游逐字一致"而设，重构后失去意义；保留文件做历史记录，脚本与 CI 中移除（阶段 6）。
- **零外部请求是测试断言**（`production-practice-smoke.mjs`）：外链字体/CDN 会直接让冒烟失败，所有资源必须打包。
- **上游"不使用 AI 图片"的裁决**与用户 2026-10-03 决策一致，继续有效。
- 卡图扫描件为 Wizards 版权（©2021 Wizards），README 声明不主张原创、不按 GPL 授权；分发责任在用户。

## B. 当前状态（最近为真；过时即更新）

- **候选0.9.2后续状态**：冻结042e446精确CI37194506711完整36步骤成功，真实联网2D14/强开软件3D16/默认网站3D16通过，包两目标各973文件与GPL432源blob独立核验通过；但是实际合法能力等待状态切画质run-39HGpC复现P2（新舞台available、choice保留但POINTS/alpha为0），独立终审不通过，042包只保留修复前检查点。仅presenter/mount最小交接修复与生产参数实际回归正在继续，候选未部署，线上仍801/0.9.1。见同日fx3d-release、fx3d-ambient-network-validation runbooks。

- **2026-10-04 本轮当前**：用户持续授权定向发布正确修复；已上线801daf5 / 0.9.1(-dev)，公网一般12/12、默认GPU隐藏8/8，没有重部署Suite/枭熊。附件c396候选的驻留loss/restore/null与权限pending跨连接两P2已修，原life9/历史ambient10/current合成24及真实双客户端3D控制通过，Node pending13独立全过；042完整CI通过后仍发现activehold画质P2而停止发布。保留全部失败与未知HTTPsetup根因，真实生产参数和新冻结CI/独立终审/部署待续；自造life1.2与驱动分类均不替代实际生产参数或实体弱机验收。

- **第二轮纠错（2026-10-03 晚）**：用户看过演示后九条纠错已实施；独立审计（Opus）第一轮"不通过"，三高六中已整改；复审"有条件通过"，条件已满足，**终裁通过**（runbook `RUNBOOKS/2026-10-03_presentation-round2.md` §5–§6）：等待时序重排 + 拼点 + 特殊牌阵说明层、手牌 / 指向器 / 两段落牌 + 尘土、每牌特效脚本 + 传说法阵、场地层、桌形随人数、拍桌、酒馆背景、选择面板瓦片、措辞统一"前注"。遗留：持续效果的循环音效素材。
- **第三轮纠错（2026-10-03 深夜）**：十一条已实施（runbook `RUNBOOKS/2026-10-03_presentation-round3.md`）：金币 DOM 精灵飞行 + 厚堆、奖池锚点；能力等待选择的 `powerHold`；座位朝向通用旋转 + 布局重叠检查进自测（2–6 人 × 横竖屏零重叠）；天空盒针孔重投影；炉石式三段放牌；幽灵牌转移系统（抽 / 偷 / 取前注 / 弃）；Kenney 贴图粒子渲染器替换全部几何图元；拍桌连拍 + 各座位独立。遗留：真实手掌照片素材待批、独立审计待做。
- **第四轮纠错（同夜）**：六条已实施（runbook round3 §5）：行动栏定高（排版跳动根因）；赤铜龙替换链"说明 → 替换落桌 → 新牌说明"（`applyReplacements` + `show.fromDeck`，自测 14）；竖屏对手一律左右侧边；金币飞行修复（`centerOf` 接受 0×0 锚点）+ 原作沙漏形龙金；删掉所有区域圆角矩形脉冲改为针对牌 / 手牌 / 金币堆；本地对战接入全能模式与编辑器。手掌素材：rawpixel / purepng 有人机验证，待用户挑图。
- **第三轮审计整改（同夜）**：Opus 审计 `9d071ec..5e4edda` 不通过（H1 回执后重飞、ASSETS 登记、M1 幽灵牌计数、M2 布局检查器盲点、M3 朝向、L1–L13）；全部整改见 runbook round3 §6：`transfers()` 同步 + 桌面层按 key 排序、事件优先的 `cardMoves`、检查器全量入检 + 布局修正（本家点数铭牌到牌阵右端、≥5 张收紧、竖屏本家整行）、偿债池常驻。冒烟 20/20、自测 15/15、布局 0、400 局模拟归零。复审（Opus）R-H1 关闭、**终裁通过**（runbook round3 §6.5）；新低项（three 拆包、package.json 行尾、冒烟全并列）随 fx3d 一起处理。用户 2026-10-03 授权"修复完之后推送"，但 push 403（凭据账号 `pzy197684` 无写权限），待用户处理凭据后重推。
- **附件帧率修复（2026-10-04 历史报告）**：金币滤镜合成层是原机器复现根因；其报告 6 人局软件渲染 5 → 56 fps，runbook `2026-10-04_perf-compositing.md`。ZIP 未附探针与样本；本机性能结果独立验证，不沿用此数。
- **three.js 特效层 fx3d（2026-10-03 深夜起）**：用户同意引入 three@0.186.1 做专用特效层（技术移植自 MIT 的 Elemental Sandbox，本地克隆在临时目录）。进度（runbook `RUNBOOKS/2026-10-03_fx3d-kickoff.md` §2–§2.3，设计定稿 `RUNBOOKS/2026-10-04_fx3d-design.md`）：P0 地基与门控（相机对齐 0.01 px、两张画布、档位 / 用户开关 / 减少动态 / 软件 GL 门控、上下文丢失、`data-fx` 五态、three 独立 chunk、`test:fx3d` 7 项）；P1 图元（地面法阵 / 扩散环 / 爪痕、光柱、GPU 粒子爆发、飘带、循环发射器）与 `composeFx` 适配器（sigil / ring / beam / burst / flare / dust / grab / swap / claw / ambient 走 three，金币 / 拍桌 / 震动仍 2D）；P2 家族签名脚本（41 家族，`powers.ts` 一行钩子，presenter 零改动）。P3 驻留变体（等自己 / 等对手、场地按种类、牌阵 / 传说到场形态）；P4 Shell / Collar、画质开关（顶栏，`localStorage["tda.fx"]`）、自适应降档。待做：尘土分档、飘带头部粒子、署名登记、独立审计。坑：`forceContextLoss` 后同一 canvas 拿不到新上下文，重建舞台要换 canvas 元素。画廊：`?fx3d=1&fx3dGallery=1|scripts`。
- **阶段 / 里程碑**：阶段 0–7 全部完成（评估、留痕、骨架、2.5D 场景、HUD、时序、材质与音效、枭熊页切换、删旧与测试重建、独立审计两轮 + 整改）；审计终裁"修好 N1 且多次稳定后判通过"，已满足。**push 待用户确认**。详见 `RUNBOOKS/2026-10-03_presentation-rebuild-kickoff.md` §7–§16。
- **运行态**：本机 `D:\my_code\three-dragon-ante`，分支 `rebuild/presentation`，基线 `eb74f62`（main）。未 push。线上入口未动。`index.html` = 独立网站；`table.html` = 枭熊牌桌页（已挂新表现层）；`src/modules/threeDragonAnte` 旧稳定频道仍是旧 UI。
- **验证基线（第三轮审计整改后）**：typecheck / build 通过；`npm test` 8/8（含 presentation-selftest 15 项：隐私、待确认、落地帧、时序、清场、单选切换、拼点标记、付款去重、桌形、手牌层、结算帧、全并列翻注、布局、拍桌节流 / 事件段、赤铜龙链）；`test:server` 2/2；`test:browser` 20/20（含真实拖拽 + 回执延迟 60 / 300 ms 下只进场一次、前注付款金币可见飞行）；`test:server-browser` 4/4；`layout-report` 0；全部本机 Edge。
- **风险提醒**：① 真实枭熊房间与实体手机未验证；② vendor CSS 约 500 kB（fontsource 的全部 unicode-range 子集声明），可做字体子集化；③ 依赖漏洞（Vite / ws）未升级，另立任务；④ 枭熊紧凑弹窗只按 CSS 断点适配，未在真实弹窗尺寸下截图。
- **锚点坑（2026-10-03）**：`centerOf` 把 0×0 的锚点当 null，而奖池 / 偿债池 **和每个座位** 的金币锚点都是 0×0（`.tda-coins-anchor` 宽高为 0），于是第三轮提交时所有金币飞行都静默跳过、黑龙抓奖池退化成闪光——零尺寸锚点要按位置算。
- **React 换区坑（2026-10-03）**：同 key 的卡牌节点换区（手牌→前注→弃牌堆）后在 `cardPlacements` 里的兄弟次序变了，React 会用 insertBefore 移动 DOM 节点，正在进行的 CSS 过渡被取消（看起来像重飞 / 瞬移）；桌面层 `CardLayer` 按 key 排序，遮挡交给 translateZ。
- **幽灵牌计数原则（2026-10-03）**：事件优先（CARD_TRANSFERRED 进 / 出、DISCARD_RECLAIMED、BUY_PRICE 价格牌），两帧差只补事件没解释的部分；牌库多出的减少量 = 先弃后抽，归买牌方 / 刚选择的那家；改 `cardMoves` 后用 400 局引擎模拟核对（runbook round3 §6.1 M1 行有口径）。
- **布局铁律（2026-10-03）**：改任何锚点 / 区域尺寸后必须跑 `presentation-selftest` 第 13 项（`layout-check.ts`：有向矩形 SAT 重叠 + 桌面内检查），或 `node .local-evidence/layout-report.mjs` 看明细；竖屏 1100 宽放不下 5 个标准对手块，4 人以上分两排并随缩放收紧。
- **CSS 坑（2026-10-03）**：同一特异度的后出现规则覆盖前面的修饰类（`.tda-coins-anchor--pile` 输给了后面的 `.tda-coins-anchor`），需要用父选择器提高特异度。
- **行尾坑（2026-10-03）**：仓库 .gitattributes 是 `* -text`（按字节入库，原有文件多为 CRLF）；用 Python 以 LF 写文件会把 CRLF 改成 LF、让 diff 膨胀；数回车要按字节（tr -cd 回车再 wc -c），Git Bash 的 grep -c 数回车得到的是行数。
- **手牌层坑（2026-10-03）**：立起的手牌放在桌面的 preserve-3d 上下文里必被桌面切片、且按真实深度排序会让左半扇面遮挡反向；正解是把扇面画在 `.tda-viewport` 下独立的屏幕对齐立板（`transform-style: flat`，z-index = order），换层时节点重挂（手→桌 dropIn，桌→手 arriving）。槽位一旦带 `transform` 就与桌面画布同深度，命中测试会随机落到画布，需 `translateZ(2px)`。
- **GLSL 坑（2026-10-03）**：`half` 是 GLSL ES 保留字，用作参数名会让着色器静默编译失败并回退 CSS；冒烟测试断言 `surface==="webgl"` 会抓到。
- **合成层坑（2026-10-04）**：每枚金币一个带 `drop-shadow` 滤镜的 `<img>` 层，6 人局 ≈ 220 个滤镜层，软件渲染下 5 fps、弱机明显卡；人越多越卡。规矩：桌面上**不用 CSS filter**（阴影烘进贴图或用 box-shadow），同类重复元素合成到一张画布，透明画布空闲时 `display:none`，指针事件按帧合并。探针 `.local-evidence/perf-probe.mjs`（runbook `2026-10-04_perf-compositing.md`）。
- **入场动画坑（2026-10-03）**：CardNode 的入场位姿用内联 CSS 变量覆盖，动画结束时必须把目标位姿写回；删属性会让所有卡牌掉到平面原点（React 不重写未变化的 style）。
- **在办**：见 `TODO.md`。

---

> 维护：本文件是**蒸馏正本**，不求全（全在 RUNBOOKS + 私有记忆）。引用具体文件/字段前先核对现实（留痕会过时）。

## C. 2026-10-04 接手与 0.8.0 上线（历史）

- 快照验证 HEAD `619ada56bbb2556e015d8775984baa416ab13692`；Node 22.17.1 与已装 Edge；原 8/8、2/2、20/20、4/4、fx3d 4/4 全过，363 个已跟踪文件哈希未变。记录：`RUNBOOKS/2026-10-04_environment-handoff.md`。
- 原 403 已解除：当前有写权限账号已成功 `git push -u origin rebuild/presentation`，GitHub 分支为 `619ada5`；未合并 main。
- 用户设立并授权三项持续上线目标，详见 GOAL §9。网站多人模式不登录，使用房间码/邀请+唯一名字；重连与新加入分开。
- 接手初期 card/Suite dev 为 241，切换前已到 243；stable Suite 1.3.14。独立旧三龙牌 0.7.22-dev 已被本轮 0.8.0-dev 更新。以现场散列为准，禁止将旧 paired worktree 全量发布覆盖其他功能。
- 已核验 SSH、三龙牌服务健康与 WSS 预握手；现有 nginx 反代可沿用。服务源码相对快照多一条 stale-game leave 防护，新增 guest 接口时已保留。
- **2026-10-04 已发布**：独立网站/插件 `/three-dragon-ante/` 0.8.0、dev 0.8.0-dev，Suite stable/dev 牌桌定向更新；权威服务更新且 active，沿用原 nginx/unit/relay。部署源 `5a62b2ad87ff70cf6980b0267fc6ba525971eed0`，Suite 宿主实际 243（207f584）。当前最新 Git 提交可为后续纯文档留痕，不等于线上源码已另行重建。
- guest 15/15、网站本地完整联机 14/14、入口矩阵 12/12、Suite 桥 10/10、旧后台入口 6/6、发布事务 17/17；最终包换模型审计通过，GitHub CI 37141298225 通过。实际公网网站 9/9，3 次前注、6 次出牌、5 次能力选择、1 次可见结算，错误/资源失败/外部请求 0。独立服务器复核 3900 文件 SHA 通过，5000 白名单外旧文件与 795 角色卡文件保持；SQLite 私有备份只在服务器，未下载。
- 枭熊 manifest 已 HTTPS 发布，但安装与 GM/玩家真实房间验收仍待可操作的浏览器与两个账号，未把网站/夹具算为通过。发布与回退详见 `RUNBOOKS/2026-10-04_owlbear-deploy.md`；新发布元数据读取 `three-dragon-release.json` 和 manifest，独立 dev 历史 Suite 的 `release.json` 保留旧值，不作为本轮版本依据。
- 本机预览 `http://127.0.0.1:4173/three-dragon-ante-dev/` 已接本地 5013 服务，独立预览数据库 `.local-data/preview-20261004.sqlite`；不连接生产玩家房间。
- 浏览器连接组件目前缺少所需版本的 browser-service 文件，尚不能提供真实 GM/玩家双账号验收证据；本地 fixture 与线上网站测试不得替代它。

## D. 2026-10-04 用户调整为仅在线网站（已上线基线）

- 正本 GOAL §10；用户撤销枭熊内游戏方向，网站只在线多人，插件/Suite 只提供网站新窗口链接并保留父顶栏。原真实枭熊游戏验收不是新版完成条件，历史未验证状态不包装为通过。
- 删除 LocalMatch、本地首页和 local hostKind；修复大厅透明层/演出遮罩对顶栏与帮助的截获，随机昵称+随机按钮、未聚焦只读和自动填充关闭，进行中退出/新局确认及 beforeunload。
- 网站 guest 房间空缓存立即释放、60 秒宽限、5 秒扫描删除全关联记录；创建数量受 maxRooms 限制，在线 peer 保留，启动重给宽限；用独立 lifecycle 表保持原 guest_rooms 两列，便于代码回退。旧 Owlbear 存档不清除。
- **已上线 0.9.0 / 0.9.0-dev**：冻结源 `7555f99e05a2853f495422d5b3c0f62a1a74c990`，GitHub CI `37166008634` 全通过，gpt-6.1-sol 独立审计最终包通过。后续纯文档提交不改变该线上冻结源；主分支未合并，未 force-push。
- 公网网站实际验收 **12/12**：独立桌面/390px 浏览器通过真实 HTTPS/WSS 完成3次前注、6次出牌、4次能力选择、1次可见结算，按钮/确认/重名拒绝/刷新/断线/房主交接通过，脚本错误/失败资源/外部请求0；全部离开后等待66秒，原码重连返回 roomMissing。合成自建房，无真实玩家数据或枭熊身份，68投影帧仅在内存断言。
- 独立远端复核1991发布文件、6971白名单外旧文件及原属性、4入口元数据和精确源码归档全部通过；角色卡/nginx/unit/relay及保护服务未变。发布 `20261004-7555f99-online-only`，每目标回退点与 SQLite 私有备份保留在服务器；从未下载数据库或备份。证据与回退命令见 `RUNBOOKS/2026-10-04_online-only.md`。
- 本地预览 `http://127.0.0.1:4173/three-dragon-ante-dev/` 已恢复，使用 `.local-data/preview-online-only-20261004.sqlite` 合成存档；旧 C 段预览和枭熊验收阻塞是历史状态。

## E. 2026-10-04 演出热修复已上线，附件与公网专项仍在办

- GOAL §11：买牌说明先翻价牌/补牌；飞牌覆盖手牌；同revision回执不能取消本家能力/切换/结算；长名与完整财务两行压缩；点数用已有金属材质区分木牌；网站房主用不可见fuvtt+Enter主动打开全能，默认普通私牌投影。断线/超时/房主交接必须立即清旧私投影，普通玩家无权限。
- 0.9.1候选在本地，线上仍D段0.9.0；换模型审计和完整演出/回归未终裁，不能称已发布。最新证据/失败/遗留统一见 `RUNBOOKS/2026-10-04_presentation-feedback.md` 和 TODO。
- 用户更新UNC同名压缩包并说明这是此前卡顿PR，要求读取内部AI_CONTEXT；新HEAD2afca326、mtime12:23:44。隔离核验特效/性能提交后整合，不能用包覆盖本机在线新逻辑。该指令授权必要fx3d整合，规则/协议/卡图/旧稳定频道保持。
- 附件已按内部上下文完成隔离整合并ff-only：893e6c4，双父4f6fc6a/2afca326，17历史保留；丢上下文双画布门控/2D回退、舞台定时生命周期、方桌重建、拖拽卸载、debug与金币倾角审计问题已修。root独立亲跑生命周期9/9，软件GL6人四模块对照结构5/5；帧率与最终CI/发布仍待收口，不套用附件历史5→56。

- 附件17条特效/合成层提交已在隔离分支整合到 0.9.1 候选：保留在线网站、隐藏全能、购买与同revision演出及原测例；补逐canvas上下文丢失回退/舞台自有调度销毁/画质重建方桌/卸载拖拽/金币横竖屏重绘。当前未部署，完整回归与独立终审由根任务续办；源与本机测试见 `RUNBOOKS/2026-10-04_fx3d-integration.md`。

- 再次更新附件c3960047（两新commit），正隔离核验整合与独立特效画廊预览；旧本地机器人不恢复，线上仍0.9.0。正本见RUNBOOKS/2026-10-04_fx3d-refresh.md。

- `c3960047` 两提交已在独立整合分支完成代码冲突处理，保留双画布生命周期及在线反馈；引入惰性加载的代次保护/最新桌形、单rAF与软件GL离屏门控。仅静态检查完成，构建、FX9及完整回归/独立终审未执行；用户要求先上线已验收反馈热修复，该特效候选随后单独验收。线上版本仍以根任务发布回执为准。

- 后续更新：已将独立热修复冻结源 `8bce32baa596f3be0e941eb1a3f758f234032a19` 正常反向合入特效整合分支，包含 SeatName 缩后真实宽度/有界二分修复、成熟静态夹具与35发布保护；当前仅本地构建/纯单元回归，未跑浏览器。该热修复 Linux CI `37184313948` 在根任务核验中，线上仍0.9.0，热修复将独立发布；完整 FX 候选未发布，旧失败证据不覆盖。见 `RUNBOOKS/2026-10-04_hotfix-backmerge.md`。
- 根任务单独提供的实际组件41家族预览 `http://127.0.0.1:4174/?fx3d=1` 已报告10/10、脚本/资源/外域错误0；不连接服务/创建牌局，不作为本候选单rAF、冷启动桌形、生命周期或真实弱机通过证据。

- 反向合入8bce后的本候选实际轻回归：根/服务npmci、typecheck（0错）/build/buildserver、npm8（presentation20）、WS机械32、发布保护35、router12及四HTML lazy分包检查全部通过。未运行任何browser/Playwright，最新FX/生命周期/铭牌等仍须独立验收，不冒称热修复本机或Linux结果为该合并源通过。

- 后续仅工具增量55218ea正常合入隔离候选：真实默认8s刷新与短/超期宽限Node三控制、代次/fresh-view和有界公开时序、CI重排/新script；生产源码相对b37零变化。仅静态检查亲跑，未运行浏览器；旧失败仍保留，最新热修复线上状态只认根任务回执。完整FX候选未发布，见hotfix-backmerge runbook后续段。

- 后续801daf5热修复正常合入隔离FX候选：唯一产品增量为精确1008/authenticationRequired的 pre-auth 超时按原backoff重连，拒绝凭据/4001/未知1008终态保持；新增5个真实客户端/WS正反控制及公开诊断。整个game树更新为29e4478并与801一致，规则/协议字段/私牌/art/server/legacy不变，FX与在线反馈不变。本轮仅语法/typecheck0错，未运行浏览器；FX版本尚未改，后续应与热修复0.9.1区分。最新发布状态仍只认根回执。

<!-- 合入801线上留痕；前面的候选阶段记录保留，不覆盖线上事实。 -->
- **已上线0.9.1/0.9.1-dev（2026-10-04 16:07:25，Asia/Shanghai）**：冻结源 `801daf580e9505a377dc97a544c4ad051ea029ac`，精确head CI37187336604完整成功，生产/最终包与真实before/after独立核验通过。反馈产品以4f6fc6a为基线，包含铭牌实际测量收敛及1008/authenticationRequired精确自动重连；真实notAllowed、未知1008和4001仍终态，服务端期限不变。只更新两个网站与必要server，未重新部署Suite/枭熊、未合并main。D段0.9.0是上一线上基线，后续纯文档提交不改变801daf5线上源码。
- 实际双网站各970构建文件+源码ZIP/发布JSON全部SHA匹配，511白名单外旧文件及目录属性保留；Suite-dev4797、Suite2112、card869和nginx/unit/relay/保护服务内容及属性不变。server SHA `f962764212aa4334639b6fa991706aecd5ec3ac2cb6782fd6a2389895dc88c3d`，active且原0644/root:root保持。事务 `20261004-801daf5-bug-hotfix` 的远端receipt applied；原SSH本地等待只终止PID16244、exit-1/stdout1字节，不能写applyexit0，transport原因未知。证据及回滚指针正本 `RUNBOOKS/2026-10-04_bug-hotfix-deploy.md`。
- 一般公网12/12 `live-website/run-LbkWkp`：2次前注/6次出牌/4次选择/2次可见结算，刷新/断线/交接/空房等通过，脚本/失败资源/外域0。隐藏权限公网专项run-gLOLN8前5/8真实通过，刷新撤权阶段超时；另保留UalXWO/L7sRyY/4RlOqV失败与npm参数提前退出，最新dc4yGB合法8码加入收到201头后仍12秒aborted/响应体未完成，具体原因未证实。权限全8项尚待验，不能用本地13项或一般12项替代；实体手机与弱设备未验收。
- UNC同名附件再次更新，最新HEAD c39600472d4ab7858f7b43c3548ad975b5d98dbc、mtime13:52:50、ZIP SHA3352e3bbd9a75f444295553626804868796d09eba682e5b9592758542ac18a7c。内部AI_CONTEXT已顺序读取，文档中的历史停止/旧本地机器人方向不覆盖当前用户授权。最新特效整合在隔离分支，不能整包覆盖网站逻辑或混入本次bug发布。
- 后续默认GPU参数控制真实公网全能8/8（JE9SZo），原刷新/WSclose清场重连与普通玩家拒绝均执行、错误/外域0，独立复核通过；renderer只记录类别，不独立确认物理GPU。强制SwiftShader的历史超时仍待查，正式tool显式--gpu default模式待释放browser后执行，生产仍801；详见热修复runbook后续段。
- 最新FX隔离候选c7b36be3已含hotfix801，build/tsc及build:server通过，npm test 7/8（controller旁观handCount6 !== 5）停止完整回归，原失败run-KuUEel保留、根因待查；未push/未部署。该候选失败不替代线上801完整CI成功证据，见主工作区fx3d-refresh runbook与TODO。
- 最新实际组件的41家族特效预览 `http://127.0.0.1:4174/?fx3d=1`，预览验证10/10、零脚本/资源/外域错误；预览不连接服务或创建牌局。相机/生命周期/实际单rAF与冷启动桌形回归、弱设备/实体手机仍须完成，见热修复runbook遗留。

- 正式公网CLI `--gpu default` 也真实8/8（run-y3SPEy），原检查/等待保持、错误/外域0，GPU仅reported-hardware分类；此前新CLI未验状态是历史。强制软件GL超时仍待查，生产801未重新构建；正本见热修复runbook末节。
