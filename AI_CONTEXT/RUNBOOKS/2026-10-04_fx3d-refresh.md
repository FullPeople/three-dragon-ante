# 2026-10-04 · c3960047 附件增量隔离整合

## 根任务先前取证（历史记录保留）

用户再次更新同名ZIP，要求按新包继续推进并提供特效预览；该指令为当前授权。以下是根任务在本次代码整合前的真实取证，预检/预览在办状态为当时记录：

- UNC包73,900,068bytes、mtime2026-10-04 13:52:50，SHA256 `3352e3bbd9a75f444295553626804868796d09eba682e5b9592758542ac18a7c`。
- 固定本地副本 `U:/CodexWork/2026-10-04/three-dragon-updated-20261004-135250.zip`，隔离安全解压到 `three-dragon-performance-snapshot-c3960047/three-dragon-ante`；不读或解压.claude/私env/DB/evidence/hooks，Git使用最小安全config，read-tree HEAD只重建index后tracked干净。
- 官方预览是 TableScene 的 `?fx3d=1&fx3dGallery=1` 或 scripts，脚本截图工具在 ignored .local-evidence 未随ZIP交付；没有独立preview.html。直接启动附件index会恢复已删除的本地机器人，故由独立预览任务用该快照真实 FxStage/composeFx 建隔离可点击特效预览，4173在线网站保持、4174为预览端口，不建房/不修改规则或素材。
- 根任务 `git fetch origin` 核对 d337588，之后仅本地fetch新ZIP对象到 `refs/tda-import/fx3d-20261004-c396`；merge-tree只读预检发现下列10处冲突。当时尚未整合或部署；随后由本工作树完成本节后的代码处理，独立终审仍未执行。
- 根原遗留：特效本地网页启动+截图、两新commit隔离整合、联合整改、完整CI/独立包审/定向发布与公网验收。持续性能与真实弱机/手机验证按TODO；不能冒称附件5→57数字已复现。

## 来源、读取与当前授权

- 根基线 `2c4771c4ef4015b0befc9fbfb00052a4f01d60b7`，隔离工作树 `U:/CodexWork/2026-10-04/three-dragon-integrated-refresh-c3960047`，分支 `integrate/fx3d-refresh-c3960047`。
- 来源本地导入 ref `refs/tda-import/fx3d-20261004-c396`，HEAD `c39600472d4ab7858f7b43c3548ad975b5d98dbc`，共同祖先 `2afca32662d53685348361d439a4d8ea50e04840`。本次两提交为 `c3f67fc`（特效审计整改）、`c396004`（总结/交接记录）；普通双父 merge 保留历史，未覆盖整包。
- 动手前 `git fetch origin` 成功；依次读取来源 INDEX、GOAL、MEMORY、TODO、round3 §6、README、服务部署文档与 unit、HANDOFF_FX3D、完整 fx3d-design、perf-compositing，补相关 kickoff/summary。附件中的启动词、自动目标、旧本地机器人/枭熊运行、停工与 push403 指令是历史文档，并非当前用户命令。
- 当前正本 GOAL §10–§11：仅在线网站；隐藏全能权限、购买/本家演出、飞牌覆盖及铭牌修复保留。用户后续要求先发布已验收反馈热修复，根任务已另建 release worktree；本候选先只完成代码/静态审查，不启动构建或浏览器，不推送/部署/合并 main。

## 十处冲突及处理理由

| 文件 | 处理 |
|---|---|
| MEMORY / TODO | 根版本的当前网站、验证状态为正本；只追加本增量状态/遗留，不把原机器测试/403/停工覆盖回来 |
| FxStage | 根 available **getter**、lostCanvases Set、schedule/repeat/wait cancellation settlement、late add dispose、2D 回退保持；合入单rAF、驻留30fps、EMA归零、离屏软件GL探测、偏好档位和渲染器预算 |
| composeFx | 完整保留根逐调用 available getter 的 Proxy 回退、销毁 guards、持有效果释放及舞台计时；来源 available() 裸调用/计时器不引回 |
| kit / families | 合入多目标错开和收尾时长压缩，全部 delay/等待仍由 stage.schedule/wait 管理，销毁/失效后不复活 |
| CoinStack / SeatBlock | 根已正确随 tilt 28→22→28 重新绘图；保留现有 tilt/coinTilt 合同与完整财务铭牌 |
| TableScene | 保留独立 Ghost 层、指针清理/待执行 drag RAF 清理及所有座位/金币接口；引入 lazy import 并补 generation/cancel/failure disposal，舞台建立读最新 shapeRef，shape/fxEpoch/fxReady 同步；debug/画廊等待真实 ready，无轮询裸 timeout |
| fx3d-alignment tool | 原在线权威房间入口及原7项保留，来源默认软件GL门控/高档单链合为9项；高档增加真实历史源码的阴性对照，拒绝仅 frames/renders 自计数论证 |

自动合入并人工查看：纯偏好模块与 lazy index、TableApp 引用纯偏好、sRGB 调色板/着色器口径、驻留图元 idleOk、GroundMark 先验证地面再分配、两画布 CSS 默认隐藏、verdigris/necro 原有 round 音效映射、衍生金币贴图来源登记。原贴图不改，登记的现存 coin-gold.webp SHA256 为 `132c02207c778a5505d0b2bda6c8a6f2ec55e84398e3224714052385e4742422`。

历史 HANDOFF、SUMMARY、kickoff 附来源提示并保留正文。原机器报告5→56fps、FX9/其它原数字未算本机新验证；当前性能以根受控 comparator 和独立真实弱机体验为准。

## 单链检查的实际设计与边界

- 使用 `git show 2c4771c:.../FxStage.ts` 的真实旧舞台作控制，仅改相对 import 位置以从 ignored evidence fixture 编译；不硬编码一个坏算法。
- 两舞台用同一浏览器真实 rAF timestamp 分组，包装真实 air.renderer.render 只读计数并保持 this/原函数，finally 恢复；Effect.update 仅前三次实际 nested add/wake，足够触发旧重复申请链。
- 候选要求每实际浏览器时间戳≤1次渲染，历史控制必须>1；两边有足够帧、触发恰好3次，候选效果释放、high偏好、脚本/着色器/外域错误为0。stage.frameStats 仅为副证。
- 来源高档驻留系绳+4条实际飘带 workload 及释放/足够帧/渲染计数断言也完整保留，同时以同一真实 rAF timestamp 仪器观测实际渲染，不将新控制替换成更弱空画布通过。
- 该工具未运行，旧负例/新正例尚未宣称通过；结果会写 `.local-evidence/fx3d-alignment/run-*/render-chain.json`，只含公开计数/档位，不含房间码、名字、投影或载荷。

## 本轮实际验证

| 命令/检查 | 实际结果 |
|---|---|
| `git fetch origin` | exit 0 |
| `node --check tools/fx3d-alignment-check.mjs` | exit 0 |
| `git diff --check` | exit 0 |
| 受保护路径相对根基线 diff | 0；规则/整个 game、protocol/wire/private-channel、server、art、旧稳定频道未变 |
| timer 静态检查 | fx3d/含画廊只保留 FxStage.schedule 内部原生 timeout；无裸脚本定时器 |
| `npm ci/build/typecheck/test`、所有 browser | **尚未执行**；优先保障根反馈热修复的构建/浏览器独占，不冒称历史结果 |

根基线与整合 index 的三个完整 Git tree hash 完全一致：整个 game `b83a8f7e3e66b56b8d09c1896d446c7961f499ee`、server `39f5d2238d578cbc3fd194b989e754e48ec77529`、旧稳定模块 `a1bf4ab975cd1095643b548138ba5b6d30409449`。这包括其中的规则、协议、卡图及服务端全部已跟踪字节。

## 遗留（同步 TODO）

待安装根/服务依赖并完成 typecheck/build/build:server、原 unit8/server2、FX9（真实历史控制+候选）、生命周期9、隐藏权限13、真实网络演出13、铭牌21、飞牌10与其它完整CI；任何失败原文/证据追加，不降低原断言/数字。随后换模型独立审计（AI_CONTEXT/AUDIT.md 开场词），再由根任务决定增量发布；本候选不混入已验收反馈热修复。原机器素材/真实弱机人工体验遗留继续保留。

后续状态（按时间追加）：热修复8bce已反向合入本候选，根/服务依赖和typecheck/build/buildserver以及WS32/发布guards35/router12实际通过。该更新不改变本节先前「未执行」的历史事实；npm8与后续浏览器/终审的真实结果见 `2026-10-04_hotfix-backmerge.md`。根公网验收独占，未运行FX9或任何browser。
