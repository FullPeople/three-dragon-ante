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
