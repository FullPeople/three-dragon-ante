# 2026-10-04：FX 相机测试合取失败的公开诊断

## 已确认事实与边界

冻结 runtime `d580cc2a1236b7bddbc2e2a53c0928ac78e49203` 的 exact Linux CI `37196321804`，第 27 步 `npm run test:fx3d` 失败。desktop 相机 8 点最差误差 0.009px、tier low 先通过，随后原 `assert.ok(res.airShown && res.hitIsCard)` 为 false。原日志没有两个操作数，不能将其直接称为卡牌鼠标被拦截。该失败仍保留，0.9.2 未发布、线上 0.9.1 不变；根代理负责发布与 TODO/MEMORY 状态。

本代理按根代理授权先 `git fetch origin`（exit 0），确认当前 docs-only HEAD `d10703566354fbd6b6bc47db0df47e431a8d62d1` / tracked clean，再只准备诊断工具和本 runbook。无产品、规则、协议、私牌通道、素材、服务端、旧稳定频道修改；准备期间不启动浏览器、不部署、不推送。

只读证据：原工具在 first hand visible / plane 后等待 `__tdaFx3d` 发布，再固定 600ms 取第一张手牌的 bounding rect 中心；未确认 `is-arriving` 退出，也未确认异步 `debugMarkers` 注册完成。`fx3dDebug=1` 的真实 debug producer 注册持续 effect，但其 import 位于 stage 发布 / fxReady 之后，不能把 stage 存在等同于该 producer 已完成。FX canvas 的实际 CSS 为 `pointer-events:none`；FxStage 无活动 effect 时合法隐藏画布。因此可见性和 hit 哪个失败都待真实同帧证据，不预判偶发或产品根因。

## 最小诊断准备

仅在原同一个 `page.evaluate` 快照追加公开数值/布尔和固定命中类别，原 `airShown` 与 `hitIsCard` 表达式保留。记录 stage available / effect 数量、card rect / viewport / 原中心点是否在视口与桌内、进场/悬停 flags、transform animation running/pending、FX 和 card pointer-events 标记、busy / power / reveal / choice / score / confirmation / help 布尔。`transformAnimationsIdle` 仅表示同帧没有运行或待启动的 transform animation，不声称跨两个 paint 的几何稳定。

原快照返回后、第一条原断言前立即写 `.local-evidence/fx3d-alignment/run-*/desktop-public-diagnostic.json` 或 `narrow-public-diagnostic.json`；原两个操作数同时输出至日志。JSON 无 innerText、card ID、姓名、房码、token、HTML、像素、牌局投影或 camera rows。未修改原取点、query、人数、fixture、600ms/15s 等等待期限、assert、pass/check 数量。文件写入发生在已捕获快照之后，不新增异步等待，不重新取一次 hit。

此时仅 prepare：需 nodecheck/diffcheck 和 AST 对照确认原 assert/wait/fixture/pass 表达式顺序保留，独立审计认可后等待 index 窗口提交。未来仅首次诊断 run，失败立即停止；没有同帧证据不能以反复重跑到通过代替查因。

准备验证实际完成：`node --check tools/fx3d-alignment-check.mjs`、`git diff --check` 均 exit 0。工具 SHA256 `9A2C1064DA16E332F4C2C4B040D840C19693116F92D50314E708555FF9218ED7`。RAM TypeScript AST 与 d107035 原工具逐表达式对照：assert 28→28、page.waitFor 4→4、pass 6→6、startOnline 完整函数 1→1、三次调用 3→3、原 pts/card/cr/hit 变量 4→4 均字面和顺序完全一致；其中 startOnline 的 locator.waitFor 前置亦包含在完整函数逐字对照。ignored 证明 `.local-evidence/fx-release/alignment-public-diagnostic-ast.json`。没有浏览器运行、采证结果或源码修复；准备状态不能视为诊断已证明根因。

独立只读代理 `fx_release_audit` 复核同 SHA 工具及整个 diff 通过，其 RAM AST 将 locator.waitFor 一并纳入，得到 wait 7→7 逐字保留；与上述 page.waitFor 4 的口径不同，均未改任何等待。独立审核未运行浏览器、未写源码或测试，不能用审核认可代替真实失败诊断。

## 首次本地诊断执行

工具与本 runbook 独立提交 `dcc3c4ee6ed54a230093e116ad6e1fb3bb3f35be`；根代理追加两份状态文档后统一冻结 `6d2de06b187e5339e33ba1bb0ef184b1ffecd585`。本机独占 CPU/浏览器按顺序执行，临时进程 `VITE_TDA_API=/three-dragon-api/v1`，finally 恢复进程环境，未修改 `.env` 文件。源码始末均 6d2、六产品 SHA256 和工具 SHA256 前后相同，始末 git status 空。

| 命令 | 真实结果 | 日志 |
| --- | --- | --- |
| `npm run build` | exit 0，21.267s（含 typecheck） | `.local-evidence/fx-release/local-alignment-diag-abfdb7eb/build.log` |
| `npm run build:server` | exit 0，0.820s | 同目录 `build-server.log` |
| `npm run test:fx3d` | 9/9，exit 0，27.229s | 同目录 `test-fx3d.log` |

完整调用、source/hash、973 个前端产物逐文件 hash/字节（共 41,851,338 bytes）、版本与同域 API 绑定在同目录 `invocation.json`，编译服务端文件白名单 hash 在 `server-artifacts.json`。package/产物 manifest 均 0.9.2-dev，同域 API 字面绑定包含在 `site-CWfUZF-U.js`，实际建桌/开始使用本地权威服务成功；不能只拿陈旧 dist 通过充当当前源码结果。

首次两个公开快照 `.local-evidence/fx3d-alignment/run-zQf9QK/desktop-public-diagnostic.json` 和 `narrow-public-diagnostic.json` 均为 airShown=true、hitIsCard=true、stageAvailable=true、effects=1；entering/arriving、transform running/pending、busy 与 power/reveal/choice/score/confirmation/help 全为 false。FX 两画布 pointerEventsNone=true，命中类别 card，取点位于视口及桌内；桌面/窄屏 camera 误差 0.009/0.004px，历史单链阴性为 4 renders/tick，新源为 1，原其余检查均通过。finally 浏览器、SQLite memory service 和 HTTP 服务全部关闭，无重复运行。

本地首诊断通过并未复现旧 Linux 失败，不能据此称旧因已查明或清除发布限制。新的 exact Linux CI 及其同帧诊断仍待根代理取证。只读另发现：建桌 helper 等的是 `.tda-card--hand[data-card]`，实际取点却为首个 `.tda-card--hand`；后者也包含先渲染的桌面层对手匿名牌背，前置并非取点节点的进场确认。本次快照 rect 桌面 (730.97,220.59,43.76,54.26)、窄屏 (201.57,283.70,26.00,33.82)，均在顶部桌面区域；不拿该范围差异推断旧失败，也未擅自更改原取点或断言。遗留保持：Linux 分别两个操作数和节点当时几何/活动/动画证据，取得后才决定需要修产品还是前置，仍禁止盲重跑凑过。TODO 由根代理统一记录。

## 首次 Linux 诊断：新的取样数量失败，计数尚缺

新的 exact Linux CI `37197852779` 对冻结 6d2 首次执行已加诊断的工具：desktop 与 narrow 的 PUBLIC 均 airShown=true、hitIsCard=true，原前 7 checks 通过。随后在原 `comparison.baseline.ticks > 20 && comparison.candidate.ticks > 20` 的合取断言失败；日志 `.local-evidence/fx-release/ci-6d2de06-failed.log` 已读取查证。它不同于此前桌面 pointer/可见性的合取失败；当前仍缺 baseline/candidate 各自真实计数，不能猜是哪一侧、缺多少或来源。此前本机 9/9 不作为该 Linux 失败的替代，0.9.2 继续未发布。

原 `render-chain.json` 写入位于所有 comparison assertions 之后，导致此断言失败时实际 comparison 尚未落证据。根代理授权仅把该已有 `writeFileSync` 行逐字移到原 `page.evaluate` 返回后、第一条 comparison 断言之前，并输出 baseline/candidate/workload 已有的数字计数（旧源缺失的 frameStats 保留 null，不能伪造为 0）。不新增计时或采样，不改 900ms 活动期、1250ms 等待、triggered 3、ticks >20、次数、取样顺序、assert/pass 或产品，也不增加 warmup。前述两个屏幕的安全诊断继续保留。

这次仅准备计数保全，不再重跑本机 FX9；未来新的首次 Linux 计数 probe 才能给出真实失败计数。原两次 CI 失败与启动/本地证据均保留，不把诊断覆盖缺失计数称为产品整改或通过。

准备验证：nodecheck/diffcheck exit 0，工具 SHA256 `6E4C43CFD5E8149DF982172027D7E828307D5B8A85F98656F1EFFEBF7E45E64E`。RAM AST 与 088e02e 原工具比较：28 assert、7 wait（含 locator）、4 setTimeout、6 pass、startOnline 完整函数/三调用、原四个几何变量、完整 comparison 取样函数及既有 render-chain 写入表达式均精确相同；只有写入顺序移到断言前。证明 `.local-evidence/fx-release/alignment-renderchain-preservation-ast.json`，未运行浏览器或修改产品。
