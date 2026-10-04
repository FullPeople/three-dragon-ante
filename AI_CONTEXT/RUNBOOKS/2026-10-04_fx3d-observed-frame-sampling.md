# 2026-10-04：FX 嵌套 wake 检查按真实帧完成采样

## 失败证据与修改边界

准备基线为 `7e6486602f32ac290e907f57349bac9264356ae7`；先 `git fetch origin`，exit 0。[该冻结源的 Linux CI 37200539392](https://github.com/FullPeople/three-dragon-ante/actions/runs/37200539392) 在第 27 步 `test:fx3d` 的原 `baseline.ticks > 20 && candidate.ticks > 20` 失败。原结果保留于 `.local-evidence/fx-release/ci-7e64866-artifacts/fx3d-alignment/run-vsOtGB/render-chain.json`：baseline 32 ticks、120 updates、max 4；candidate 19 ticks、19 updates、frames/renders 19、max 1、tier high、effectsAfter 0；原驻留与四束光 workload frames/renders 28、max 1、effectsAfter 0。

原 fixture 存活 900ms，随后总共等 1250ms。`ticks > 20` 在固定 900ms 内隐含约 22.2 ticks/s 的采样密度前置，严格要求至少 21 个样本；该 CI 的 candidate 只有 19 个，未满足此前的隐式采样速率要求。效果 900ms 后已经退场，增加后续 sleep 无法补样本。该 case 要验证的是 nested add/wake 的单 rAF 链结构，当前证据不证明生产计数错误、生产帧率根因或性能修复。

本次只修改 `tools/fx3d-alignment-check.mjs` 并新增本 runbook；未修改生产舞台、规则、协议、私牌、素材或服务源码。根代理负责状态文档和后续首次真实验证；本次准备不执行浏览器、构建、推送或部署。

## 真实采样结束与失败清理

继续使用原三个 nested add/wake 触发、真实 renderer 和原 native rAF 包装。原 `ticks` Map 与 `maxRendersPerTick` 计算保留；另加 `observedTicks` Set，仅在原 air renderer 的 `Reflect.apply` 真正返回后，把非 null 的浏览器 rAF timestamp 计入采样目标。包装安装前可能已排队的一帧可使 `logicalFrame=null`，仍留在原 Map 并记录 `outsideRafRenders`，但不能填造时间戳或算进 24 个真实帧目标。

root 和三 children 共用 `observedTicks.size < 24` 的存活条件；root 初始 pending 为 1，每个 child 实际创建时加 1，分别以真实 dispose 回调减 1。全部 fixture 自然退场后，通过 native rAF 屏障跨帧观察原 renderer 计数；若仍有旧链渲染，继续跨帧，直到一个完整 native 帧没有该 stage 的新渲染才完成 Promise。因此历史 stage 在 effects 已归零后仍排队的额外 callback 也被原 render hook 捕获并自然排空，再开始 candidate。最后退场渲染可让真实样本多于 24；不减计数、不手动调 frame/render、不模拟时钟。

`15000ms` watchdog 覆盖取样和排空，超时明确 reject 并输出真实 observedTicks/triggered/effectsPending；它只是防止测试挂起的失败期限，不是 FPS 断言。完成后才读取真实 `frameStats`，并输出 `observedTicks`、`outsideRafRenders`、`elapsedMs`。成功或失败都在 sample finally 停止 fixture、清除 watchdog、取消自身排空 rAF、恢复 renderer；外层 finally 恢复原 rAF 包装，旧舞台和两张控制画布由既有 finally 销毁。

另将 HTTP listen、内存服务创建与 browser launch 放进既有外层 try，listen 错误明确 reject；嵌套 finally 分别关闭已创建的 browser/service/HTTP server，前一个 close 失败也继续后续清理，初始化失败同样进入清理。这是测试资源清理调整，不改变生产初始化。

## 保留检查与准备验证

原 28 条 assert 的源码表达式及顺序完全保留，包括 baseline/candidate triggered=3、双方 ticks>20、历史 max>1、candidate max=1/tier high/effectsAfter=0、workload frames>20/单链/收尾、相机/命中/零错误/零外域和 lazy chunk。未降低、删除或替换原门槛。采样扩展期间若生产自适应逻辑真的把 candidate 降档，原 tier high 断言仍会真实失败；没有冻结画质或跳过降档。

原 7 个 page/locator wait、pointer 的 600ms、原真实 workload 完整 try/finally 及其中 350/600/2600ms 三个 timer、6 个 pass、完整 startOnline/三次调用、原 pts/card/cr/hit 取点、rAF 包装、两处 ticks.set 和两处 Map 最大值表达式均逐字保留。改变的是 sample 完整函数/异步 comparison callback：原 900ms 存活条件与 1250ms sleep 被真实完成 Promise/15000ms deadline 替换。setTimeout 语法调用仍 4→4，但首个表达式已改变；不能声称所有 timer、采样 callback 或完整 comparison 保持不变。

`node --check tools/fx3d-alignment-check.mjs`、`git diff --check` 均 exit 0。RAM TypeScript AST 证明及原/新源码副本位于 `.local-evidence/fx-release/alignment-observed-frame-preservation-ast.json` 与同目录 `alignment-observed-frame-{original,candidate}.mjs`；证明包含完整表达式，明确标记 timers/sample/comparison 已改变，原 28 assert、7 wait、6 pass 均逐表达式/顺序相同。首次辅助 AST 的 workload selector 误选含 workload 的外层 try，报不相同；收窄到直接执行 ambient 的原 workload try 后，完整 workload 逐字相同，未因此修改工具。

原仓库源码 SHA256：`6E4C43CFD5E8149DF982172027D7E828307D5B8A85F98656F1EFFEBF7E45E64E`。当前工具 SHA256：`DFDBE303F9E067F4C653B3E2CCA145B507C6737EAAAB0A4611D9C273DF8F0C85`。独立只读代理 `release_review_current` 已复核实际 diff、独立 RAM AST 28 assert/7 wait/6 pass 保留和资源清理结构；未运行浏览器。新机制至少 24 个真实非空时间戳、历史 max>1、新源 max1/high/收尾、实际 deadline/资源关闭仍待根代理一次真实 case 和 exact Linux CI 验证；保存的旧 baseline max4 不冒充新机制的浏览器反例结果。

## Root 后续实际验证与精确 CI（保留失败）

e290ea0本机串行build exit0（tsc0），build:server exit0，test:fx3d 9/9 exit0。实际render-chain baseline25 observed ticks/max4、candidate25/max1/frames25/renders25/effectsAfter0，高tier原门槛保持；workload33/33/max1/zeroeffects。五源文件前后SHA一致，工作树clean。证据.local-evidence/fx-release/local-observed-sampling-e290ea0。首wrapper仅因Windows日志名含冒号失误在已完成build后退出，改合法文件名后只执行未运行命令，不称产品失败。

普通push origin integrate/fx3d-refresh-c3960047 e290ea0成功，精确CI37205567270首次failure，网站隐藏权限前6check通过，真实WS cut后原host-only DOM清场<500ms时限失败；本次FX以及后续均skipped，不能继承本机9当Linux9或整CI通过。实际artifact run-pHrsRz transport close→新upgrade约7324ms，未取得实际DOM清场发生时间，暂不判断产品撤权失败还是观察阻塞。log与原result保存于.local-evidence/fx-release/ci-e290ea0-*；不重跑碰运气，不放宽断言。原gh缓存写C盘空间不足/缓存zip不完整，改直接gh api job logs并仅下载本次artifact到U，不删其他目录。

用户确认线上801可用并新增四项反馈，改在另隔离分支release/website-feedback2-20261004推进，不把本次失败冻结源部署。采样修复已cherry-pick到新候选；0.9.3新增观战/全能等须新全回归和发布审核。
