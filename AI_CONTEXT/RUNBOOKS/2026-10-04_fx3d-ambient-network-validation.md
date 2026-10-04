# 2026-10-04：驻留特效丢失/恢复与联网 3D 验证

## 授权与边界

用户授权继续完成网站；根代理要求先用真实上下文丢失证明驻留缺陷，再分别修复产品和验证工具。线上热修复 `801daf5` / 0.9.1 不变，本记录的 FX 候选未发布。

本代理仅修改测试工具和本 runbook，不修改产品、原生命周期 9 项、规则/协议/私牌通道/素材/服务端/旧稳定频道。驻留产品修复和 inspect-pending 修复由其他代理负责。不得把组件夹具称为真实联网，也不得把回环网站称为公网玩家或实体设备验收。

## 首次真实反例

基线 HEAD `19d2ebd5110699c25fffb78cd9b8d44e7de5f51a`。同一工作树并行存在根代理授权的 `server-client.ts` inspect-pending 修改；此次涉及的 `composeFx.ts`、`FxStage.ts`、`particles.ts` 与 HEAD 相同。完整 source-boundary 单独保留，不能声称整个工作树 tracked clean。

ignored 脚本首次启动因 Windows ESM 的 `U:` 绝对 import 路径失败，浏览器尚未启动。证据 `.local-evidence/fx-integration-validation/run-ambient-diagnostic-d8063d94/` 保留。只修脚本为 file URL、nodecheck 通过后，以新目录执行；不覆盖或删除旧失败。

实际结果 `.local-evidence/fx3d-ambient-recovery/run-qJ6J9X/result.json`，exit 0，35.704 秒。脚本 SHA256 `96E2EB892EB0B1A341D2830205CA68CB76328909E373F9D536618BDA7121DE02`；包装日志及源边界在 `.local-evidence/fx-integration-validation/run-ambient-diagnostic-afb1249e/`。

| 真实组件场景 | 初始 air POINTS / ground 绘制 | 丢失后的既有驻留 | 恢复后的既有驻留 | 恢复后 null，等尾粒子结束后的 450ms |
| --- | --- | --- | --- | --- |
| druid | 12 / 6，均有非透明像素 | 2D 绘制 0、alpha 0 | air/ground 均隐藏且无实际绘制 | 2D 绘制 497、alpha 像素 5128、RAF 1 |
| priest | 12 / 6，均有非透明像素 | 2D 绘制 0、alpha 0 | air/ground 均隐藏且无实际绘制 | 2D 绘制 479、alpha 像素 6210、RAF 1 |
| selection hold | 14 / 7，均有非透明像素 | 2D 绘制 0、alpha 0 | air/ground 均隐藏且无实际绘制 | 2D 绘制 499、alpha 像素 6481、RAF 1 |

每场独立浏览器 context，先验证实际三维 POINTS 和 ground 非透明绘制，再真实双画布 `WEBGL_lose_context`。第二轮在丢失期间新建驻留，实际 2D 绘制和非透明像素均阳性，恢复后调用同 ID null；等待 2.5 秒超过该 spec 的最长粒子寿命 `1.2×1.3=1.56` 秒，再采样 450ms。空闲基线 RAF 0，末段仍有真实纹理绘制和 RAF 1，确认逆向清理泄漏。三场均无脚本/资源/外域错误；像素缓冲只在浏览器 RAM，证据只保留计数/布尔，无手牌/身份/房码/token。所有浏览器和静态服务已关闭。

根因：适配器丢失时释放并清空 3D 图元，未持有 AmbientSpec 以迁移或恢复；按 availability 选择的 ambient 路径在丢失时把 spec 放入 2D，而恢复后的 null 只走 3D，未清原 2D emitter。原 life9 覆盖丢失期间的新能力和恢复后新 burst，未覆盖这两种驻留路径；其既有通过不能否定本反例。

## 正式工具准备与尚待执行

`tools/fx3d-ambient-browser.mjs` 使用实际 TableApp/store/controller/composeFx、真实双 WebGL 上下文，保留原 `test:fx3d-lifecycle` 9 项不动。默认新源检查：已有驻留真实 3D → loss 后真实 2D → 单画布恢复仍 2D → 双恢复原驻留真实 3D；loss 中新驻留 → 双恢复真实 3D → null 后尾粒子结束清双路径/RAF；另验 direct stage.destroy 及晚 ambient 不创建 2D、实际有限 gallery 的 release 被取消后不复活。gallery 只用于其本身的定时生命周期，不能作为联网 3D 阳性。

`--baseline-ambient` 经 Vite transform 加载上述真实历史提交的 composeFx/FxStage/TableScene 三文件，要求原缺陷确实存在，作为旧源阴性对照。未硬编码一个坏算法，未更改产品或原 life9。prepare 时只有 nodecheck，尚未执行正式历史/新源工具。

`tools/site-presentation-browser.mjs` 新增 `--gpu default|software`（默认原 software）和 `--fx3d`（只有明确开关才加 `fx3d=1`）；无 gallery/debug/手动 cast。默认软件模式原 13 项保留，并加真实 2D 阴性对照；显式 3D 模式原 13 项保留并增加两个客户端实际可见 3D 与说明只出现/关闭一次的 3 项。原静态 AST 34 个 assert、20 个 wait、14 个 pass（含 baseline 分支）全部顺序不变；新增 9 个静态 assert、1 个仅显式 3D 模式且在提交前的 readiness wait、3 个分支 pass。该 readiness 不改变演出期间的原等待或期限。

原 `fxDraws` 默认仍计实际 2D drawImage；显式 3D 观察模式扩为同时计严格匹配 air/ground FX 画布的原生 WebGL draw。`tools/site-presentation-render-probe.mjs` 保持原生调用 this/args/return，只在实际能力说明关闭后的动作窗口采样，并在下一回合 banner 出现前停止；每层最多 12 次非 POINTS 和 12 次 POINTS 的 RAM 前后像素读回，保留实际绘制计数、非透明像素变化、GPU known/software 布尔。空 FX 画布、桌面材质 GL 和 idle 背景不能满足断言。读回开销不构成 FPS 或性能证据；不能凭 GPU CLI 宣称实际硬件。

nodecheck 和 diffcheck 已通过；ignored AST 对照 `.local-evidence/fx-integration-validation/render-tool-boundary.json` 保留。产品修复冻结后，需独占串行执行原 life9、历史 ambient 控制、新源 ambient 控制、软件默认 2D、软件强开 3D；首个失败停下留存，不盲重跑。此段为准备状态，不是通过记录。TODO 由根代理统一更新，避免并行覆盖。

## 冻结后的实际串行结果（逐项追加）

修复由另一代理提交 `e8cf0e5dd2ff5f09d3a09e054b876d6cf606078e`。验证包装目录 `.local-evidence/fx-integration-validation/run-ambient-network-6b63f355/` 逐次记录 HEAD、工作树增量、工具/实际产品文件前后 SHA256。测试期间另一个授权客户端提交成为 `5506116`；下面涉及的 3 个 FX 产品文件始终与 e8 相同。

| 命令 | 实际结果 | 独立证据 | 边界 |
| --- | --- | --- | --- |
| `node tools/fx3d-lifecycle-browser.mjs` | 9/9，exit 0，19.525s | `.local-evidence/fx3d-lifecycle/run-kc7s9t/result.json` | 原 9 项原封不动；原工具 SHA256 `1C0D21820FFADEA00014A58A3099D8C286F0B34D76CEBFB0830EA384E6EBCFEF` |
| `node tools/fx3d-ambient-browser.mjs --baseline-ambient` | 10/10，exit 0，45.813s | `.local-evidence/fx3d-ambient-recovery/baseline-mebAIj/result.json` | 真实历史三文件复现三场原缺陷；不是当前产品通过 |
| `node tools/fx3d-ambient-browser.mjs` | 24/24，exit 0，58.402s | `.local-evidence/fx3d-ambient-recovery/run-FJFaJI/result.json` | 三类实际驻留完整 loss/single restore/full restore/null 尾清理；direct destroy 和有限 gallery 均过 |
| `node tools/site-presentation-browser.mjs --gpu software` | 14/14，exit 0，65.857s | `.local-evidence/site-presentation/run-o1ibiR/result.json` | 原 13 项 + 实际 2D 阳性/FX 原生 GL 零绘制阴性对照 |
| `node tools/site-presentation-browser.mjs --gpu software --fx3d` | 16/16，exit 0，109.064s | `.local-evidence/site-presentation/run-9ApAvm/result.json` | 原 13 项 + 双客户端实际 3D 非空绘制 + 说明各仅开关一次；软件 GPU 明确强开 |
| `node tools/site-presentation-browser.mjs --gpu default` | 16/16，exit 0，54.160s | `.local-evidence/site-presentation/run-b66MlY/result.json` | 正常网站默认路由，未加强开 query，renderer reported hardware；不是实体设备验收 |

三次已完成工具均无脚本/着色器/资源/外域错误。对照始末工作树 FX 文件的 SHA256 相同：composeFx `F8E908FCC2F0C5616A30C55576CB5E73D382A28C30B40E04D77314C9C14892BB`、FxStage `86903835F03BFCBF7B2F9F227F5F62B2FEF9DFEE6E3FCF04FB34EF1FBC283ACD`、TableScene `5FD944B8076E92AABF740AF9472E4ADEF748BE541EB662ED8D7DC8978626E107`。新源 24 项实际在 `5506116` 执行，3 场尾清理均为 2D draw 0、alpha 0、显示 false、RAF 0；原缺陷三布尔均 false。修复后的持续 3D/2D 在迁移时可以同时短暂存在尾粒子，这是有界退场；不要求取消当帧立刻清空合法尾粒子。旧失效/启动失败证据仍全部保留。

双客户端工具提交 `34f609e0d81a89b5567ce44efd31c2868cfd053c` 后，软件 2D 与强开 3D 两次均在该 source 执行；正常 GPU 模式在只含文档/公开验收工具合并的 `d32aef83843727380bc6f1fb008396cdfdc55785` 执行。三次涉及 FX 的产品 SHA256 均与上表修复一致，原 13 项未减项、未放宽断言或期限。软件强开时提交者实际 POINTS 3、POINTS 改变非透明像素 648、ground draw 2/改变像素 10103；观察者对应为 6/197、2/10074。正常 GPU 模式两客户端实际 POINTS 为 348/347，均有原生绘制前后非透明像素变化；GPU known=true、software=false。说明 opens/closes 各为 1，提交者 view→ack 未重播或取消能力，回合/轮局结算/购买原断言均过。这里的读回是可见绘制验收，不能作为 FPS 证据。

## 实际生产 producer 追加与质量切换新反例

独立审计指出，上述 ambient24 使用真实 composeFx 路由但 rate 24/life 1.2 的合成 AmbientSpec，未覆盖 FieldLayer 的实际德鲁伊 life 4、牧师 life 3.5 或 presenter hold life 2。不得据此称生产参数全部通过。用户目标中的完整真实演出继续，根代理授权新增专门工具，原 24/9/13 项保留不替换。

`tools/fx3d-producer-browser.mjs` 使用实际 `mountTableUI`，从规则引擎合法开局动作搜索产生真实 pending choice / druid / priest 场景，并检查 before/after invariants。测试 Vite observer 只包装真实 FieldLayer/presenter 的第二个 ambient 参数、记录公开特效参数后返回同一个对象；不手调 show.powerHold、不复制生产 spec、不修改产品。实际 native air/ground 绘制与 RAM 像素变化验证驻留，生成牌局和投影只在 RAM；JSON 仅数值/布尔，不保存私牌、名字、身份、房码、token 或图像。

首次仅执行 `node tools/fx3d-producer-browser.mjs --hold-only`：source `7fb7a08b2f479b962c1c797c7fd653b93d47df6d`，exit 1，39.008s。证据 `.local-evidence/fx3d-producer/run-39HGpC/result.json`；包装日志/完整边界 `.local-evidence/fx-integration-validation/run-ambient-network-6b63f355/producer-hold-first-result.json`。工具 SHA256 `1EAFB641AE3FDAABD397D1DC625B07E2E56D0050324CC2E5D44E1EE3908CCEC0`。第一条实际 producer 驻留阳性通过，随后的 `hold-quality-render` 发生 AssertionError，立即停止，没有继续德鲁伊/牧师、context loss 或尾清理。

合法 blue 能力产生 pending choice，通过实际 surface 更新与实际说明关闭后捕获的 presenter 参数为 rate 3、life 2、size 2.4、alpha 0.75、drift (0,-22)，holdSelf=true 且存在真实 origin。有限能力尾结束后，generation 1 实际 air draw 30、POINTS 20，POINTS 改变非透明像素 1667；ground draw 20、改变非透明像素 27007，stage 可用、choice 仍在、busy=false。

真实点击 `#fx-quality` 后 stage generation 变为 2，stageAvailable=true、threeMode=true、choice=true、busy=false，specCalls 仍为 1、nullCalls 0。排除旧帧后，新阶段 air/ground 实际绘制、POINTS、alpha 全部为 0；不是用空画布或 stats 充当阳性。根因是画质重建销毁旧 composition 的 owned specs，而 presenter 只在能力事件时生成 hold，没有在新 FX 发布时重新生成已有 powerHold。该缺陷不能被此前完整 CI 或原 ambient24 通过掩盖。

此轮 FieldLayer、presenter、composeFx、FxStage、TableScene 五个产品文件前后 SHA256 相同，脚本/console/外域/资源错误均 0，浏览器/静态服务 finally 已关闭。当前只准备工具与此留痕，不预修生产、不部署。遗留：修复 active hold 画质重建后的 producer 接线、独立审计、新冻结针对性验证与完整 CI；实际德鲁伊/牧师生产参数与真实最大粒子寿命尾清理仍未执行。TODO 由根代理统一双落，避免并行覆盖。

根代理复核新 producer 工具发现，restore 回 3D 后直接 null、只断言 2D 为零缺少同段 2D 阳性前置。仅加强此新工具：在实际恢复 3D 阳性之后，再次真实双上下文 loss，确认两原生 context.isContextLost、stage 不可用，以及实际 2D draw/alpha/visible 均阳性，再调用 null 和原 life×1.3+900ms 尾等待、原 450ms 观察。原质量切换反例、checks、原断言和期限保持。该 null 明确调用真实 composition API，是路由清理控制，未验真实 presenter choice 解除路径；不会以它冒称能力选择实际提交或联机行为。此增强目前仅 nodecheck/diffcheck，未运行浏览器，旧失败使用的工具 SHA 与证据保持独立。

增强后的 source boundary 在原五产品文件之外加入第六个 `mount.ts` 的前后 SHA256，覆盖实际 FX 发布接线；首次失败仍如实只有当时五文件的记录，不追补不存在的当时 hash。

## 画质驻留修复后的首次生产参数验证

画质 owner 接线修复由另一代理提交 `c1752f75`，统一冻结 `d580cc2a1236b7bddbc2e2a53c0928ac78e49203`。根代理授权独占浏览器与 CPU，先只验证 hold；通过后首次执行三类完整生产 producer 套件。没有盲重跑旧失败，也没有修改工具、原期限或产品。

| 命令 | 实际结果 | 证据 | 目的 |
| --- | --- | --- | --- |
| `node tools/fx3d-producer-browser.mjs --hold-only` | 6/6，exit 0，40.261s | `.local-evidence/fx3d-producer/run-lxbozm/result.json` | 修复首场：真实用户画质按钮、新阶段驻留、双上下文 loss/restore，以及实际 2D 阳性后的 tail 清理 |
| `node tools/fx3d-producer-browser.mjs` | 14/14，exit 0，95.002s | `.local-evidence/fx3d-producer/run-qqkx56/result.json` | 首次完整 hold/druid/priest 生产参数；包含 hold 重复是完整套验证的必要范围 |

两次工具 SHA256 均为 `B45AEB5E1E680C6B9F693846BD61C707E87FA927C46C217C28C4BDF418D7E71C`，source 始终 d580，六个产品文件前后 hash 相同。实际 presenter SHA256 `96613B969B1896C26C4B93E76DBFE5695446157DC4E7E2F0F9659C761BB839C8`、mount `F2AA19CE64DA417470CBB790BFD9C3B0160846CD3DA35B54909A206619B2178E`；其余四文件与前述 hash 相同。脚本/console/外域/资源错误均为 0，finally 浏览器/静态服务全部关闭，包装日志源边界在 `.local-evidence/fx-integration-validation/run-ambient-network-6b63f355/producer-hold-fixed-d580-result.json` 和 `producer-full-fixed-d580-result.json`。

首次 hold-only 真实 quality 后 generation 2、specCalls 3/nullCalls 2，对应临时 2D 和随后 3D 的 owner 迁移；choice 仍 true、busy false。新阶段实际 POINTS 20、POINTS 改变非透明像素 2987、ground draw 20/改变非透明像素 27020，确认首轮缺陷已修复，而非只看 stage stats。工具没有再次关闭说明，quality 后仍已释放 busy；此工具不把持续 spec 重发次数当作公开能力事件重播计数。旧实际失败 `run-39HGpC` 保留。

完整套捕获的实际 producer 参数与第二次 dual loss 的真实 2D 阳性、清理结果如下。参数由真实 producer 返回同一 spec 观察取得，不抄常数；生产尾期限为 `ceil(life×1.3×1000)+900`，再按原 450ms 观察。

| producer | rate / life / size / alpha | drift | tail 前实际 2D draw / alpha / visible | tail 等待 ms | 尾后 draw / alpha / visible |
| --- | --- | --- | --- | --- | --- |
| actual presenter hold | 3 / 2 / 2.4 / 0.75 | 0,-22 | 162 / 1261 / true | 3500 | 0 / 0 / false |
| actual FieldLayer druid | 5 / 4 / 3.2 / 0.6 | -14,26 | 455 / 5816 / true | 6100 | 0 / 0 / false |
| actual FieldLayer priest | 3 / 3.5 / 2.2 / 0.55 | 0,-18 | 286 / 1910 / true | 5450 | 0 / 0 / false |

三类均从引擎合法 fixture 的实际 producer 先取得非空 POINTS/ground 改变像素，再验证 loss 转 2D、full restore 恢复实际 3D。该清理 null 仍是实际 composition API 路由控制，不是选择提交结束路径，不冒称联网或公网人类验收。此前未执行的生产参数和真实寿命 tail 范围现已实际完成；整体部署与新冻结 CI 状态由根代理记录。

## 当前软件渲染组件性能对照（首次完整 18 样本）

根代理另行授权在上述全部成功后、同一 d580 冻结 source 首次执行 `npm run test:performance-compare`，填此前登记的原始性能验证，不再重复已通过的 structure-only。exit 0，5/5 结构/采样检查，114.463s；工具 SHA256 `58A9B5CBF2C177012408EDA8A47E306AF295815A69A43C39A66C908703B68273` 前后不变，源码未改、无 FPS 通过阈值。

完整原始 18 个 sample 与逐帧 intervals 在 `.local-evidence/performance-compare/run-MWt1Sc/result.json`，JSON SHA256 `1151822C1B84294F570607A476A6B2F45A26757FAE3F277949C2812EB19B2B2A`；调用/日志 `.local-evidence/fx-integration-validation/performance-full-d580-81d2470e/`。真实历史 control 为 `4f6fc6a7263237c48afbc55c75dce4b83d0fa1d2` 的 CoinStack、scene.css、particles、TableScene 四模块替换，其余均当前代码。两 variant 使用同一合法六座 fixture hash `f8705d19fc9d58c783c919ca54491900fee651bf2574cc680c3d62b633bdcecc`、12 张牌阵、8 张可操作手牌、8 金币堆；原图元 256 个 filtered coin image 与新 8 个已绘制 canvas 差异属于待比较组件变化。共享 `fx3d=0` 生产 gate，WebGL2 桌面材质仍开、SwiftShader 实际 renderer 相同。每模式 3 次交错，每次原 2000ms rAF 窗口；没有截图/特效 readback 插入采样窗口。

| 模式 | control / candidate median FPS | 比值 | control / candidate median p95 ms |
| --- | --- | --- | --- |
| idle | 43.00 / 60.00 | 1.40× | 16.8 / 16.8 |
| hover | 3.36 / 9.42 | 2.80× | 366.7 / 366.7 |
| drag | 3.11 / 22.50 | 7.23× | 333.4 / 333.2 |

原始 intervals 数与每样本 frame 数逐项相符，18 项完备；真实 pointerMoveEvents 与 drag 无命令提交控制完整。错误/外域 0、finally 浏览器/服务关闭、git status 干净。结果显示受控组件改善，同时软件交互长帧仍明显，不能宣称整体流畅、移植附件旧报告 5→56 为当前数据、整版基准、3D FX 性能或实体弱机 UAT。该限制须保持在后续留痕/用户汇报中；不为更漂亮数字重复采样。
