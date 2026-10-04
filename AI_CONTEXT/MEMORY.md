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

- **第二轮纠错（2026-10-03 晚）**：用户看过演示后九条纠错已实施；独立审计（Opus）第一轮"不通过"，三高六中已整改；复审"有条件通过"，条件已满足，**终裁通过**（runbook `RUNBOOKS/2026-10-03_presentation-round2.md` §5–§6）：等待时序重排 + 拼点 + 特殊牌阵说明层、手牌 / 指向器 / 两段落牌 + 尘土、每牌特效脚本 + 传说法阵、场地层、桌形随人数、拍桌、酒馆背景、选择面板瓦片、措辞统一"前注"。遗留：持续效果的循环音效素材。
- **第三轮纠错（2026-10-03 深夜）**：十一条已实施（runbook `RUNBOOKS/2026-10-03_presentation-round3.md`）：金币 DOM 精灵飞行 + 厚堆、奖池锚点；能力等待选择的 `powerHold`；座位朝向通用旋转 + 布局重叠检查进自测（2–6 人 × 横竖屏零重叠）；天空盒针孔重投影；炉石式三段放牌；幽灵牌转移系统（抽 / 偷 / 取前注 / 弃）；Kenney 贴图粒子渲染器替换全部几何图元；拍桌连拍 + 各座位独立。遗留：真实手掌照片素材待批、独立审计待做。
- **第四轮纠错（同夜）**：六条已实施（runbook round3 §5）：行动栏定高（排版跳动根因）；赤铜龙替换链"说明 → 替换落桌 → 新牌说明"（`applyReplacements` + `show.fromDeck`，自测 14）；竖屏对手一律左右侧边；金币飞行修复（`centerOf` 接受 0×0 锚点）+ 原作沙漏形龙金；删掉所有区域圆角矩形脉冲改为针对牌 / 手牌 / 金币堆；本地对战接入全能模式与编辑器。手掌素材：rawpixel / purepng 有人机验证，待用户挑图。
- **第三轮审计整改（同夜）**：Opus 审计 `9d071ec..5e4edda` 不通过（H1 回执后重飞、ASSETS 登记、M1 幽灵牌计数、M2 布局检查器盲点、M3 朝向、L1–L13）；全部整改见 runbook round3 §6：`transfers()` 同步 + 桌面层按 key 排序、事件优先的 `cardMoves`、检查器全量入检 + 布局修正（本家点数铭牌到牌阵右端、≥5 张收紧、竖屏本家整行）、偿债池常驻。冒烟 20/20、自测 15/15、布局 0、400 局模拟归零。复审（Opus）R-H1 关闭、**终裁通过**（runbook round3 §6.5）；新低项（three 拆包、package.json 行尾、冒烟全并列）随 fx3d 一起处理。用户 2026-10-03 授权"修复完之后推送"，但 push 403（凭据账号 `pzy197684` 无写权限），待用户处理凭据后重推。
- **帧率修复（2026-10-04）**：根因是金币滤镜合成层（见 §A 合成层坑）；修后 6 人局软件渲染 5 → 56 fps，runbook `2026-10-04_perf-compositing.md`。
- **three.js 特效层 fx3d（2026-10-03 深夜起）**：用户同意引入 three@0.186.1 做专用特效层（技术移植自 MIT 的 Elemental Sandbox，本地克隆在临时目录）。进度（runbook `RUNBOOKS/2026-10-03_fx3d-kickoff.md` §2–§2.3，设计定稿 `RUNBOOKS/2026-10-04_fx3d-design.md`）：P0 地基与门控（相机对齐 0.01 px、两张画布、档位 / 用户开关 / 减少动态 / 软件 GL 门控、上下文丢失、`data-fx` 五态、three 独立 chunk、`test:fx3d` 7 项）；P1 图元（地面法阵 / 扩散环 / 爪痕、光柱、GPU 粒子爆发、飘带、循环发射器）与 `composeFx` 适配器（sigil / ring / beam / burst / flare / dust / grab / swap / claw / ambient 走 three，金币 / 拍桌 / 震动仍 2D）；P2 家族签名脚本（41 家族，`powers.ts` 一行钩子，presenter 零改动）。P3 驻留变体（等自己 / 等对手、场地按种类、牌阵 / 传说到场形态）；P4 Shell / Collar、画质开关（顶栏，`localStorage["tda.fx"]`）、自适应降档。待做：尘土分档、飘带头部粒子、署名登记、独立审计。坑：`forceContextLoss` 后同一 canvas 拿不到新上下文，重建舞台要换 canvas 元素；帧内 add 效果不能再申请 rAF（单链）；软件 GL 探测必须用离屏画布；three 的 `new Color(hex)` 会转线性，fx3d 用 `setStyle(hex, LinearSRGBColorSpace)`。独立审计（Opus，8d23298..4d0d414）不通过 → 2 高 4 中 8 低全部整改（runbook kickoff §4），复查中。画廊：`?fx3d=1&fx3dGallery=1|scripts`。
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
