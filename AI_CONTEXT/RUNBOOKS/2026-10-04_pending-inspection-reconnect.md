# 连接权限 pending 不跨断线重发（2026-10-04）

实现模型：gpt-6.1-sol。本次只修改 FX 整合候选，不修改已上线的 `801daf5` 热修复，不推送、不部署、不改版本。开工先 `git fetch origin`，候选基线 `19d2ebd`，起始 tracked clean。授权范围为客户端最小修复、可重复 Node 专项和本 runbook/TODO；package/CI 接线由根任务统一负责。

## 真实问题与边界

原 `ServerTableClient` 在一般断线后保留所有 pending，重新认证的首个 view 会重发旧命令。服务端 `inspect/omniscient` 分支直接设置连接的 `ctx.inspect`、发布 view 和 ACK，然后返回，不进入 durable receipts 事务。即使新连接初始 `inspect=false`，未确认的旧权限命令仍可把它重新开启。

独立只读阶段在 hotfix ignored `.local-evidence/pending-inspection-audit/result.json` 用真实 801 编译客户端、RAM 服务和回环 TCP/WS 两条控制复现：首次 inspect/omniscient send 仅在夹具适配层丢弃，真实关闭后新认证 535ms 是普通权限，538ms 自动第二次 send 后 canEdit/inspect 为 true。记录只有布尔、次数与时间，没有会话、房码、姓名、牌或 SQL。

这不是普通玩家越权：服务端仍校验当前认证房主；网站 `inspectionRequested` 在断线时重置，白名单阻止编辑器自动复开。问题是原房主服务端连接权限未经新的主动请求被旧 pending 重建，与 GOAL §11 / DOMAIN §6 的断线撤权边界不符。既有公网8项覆盖已 ACK 授权后的断线，未覆盖此未确认窗口。

## 最小修改

同一个 `clearInspectionPending()` 只取消 pending `inspect` 或 `omniscient`（包括 enable/disable）、清原生 commandTimer 并更新 pending=false。在当前活动 socket 的真实 onclose、CLOSING/CLOSED 状态手动 retry 换连接前、stop 时调用。认证等待超时和 terminal close 也经过此取消分支。stopped / 已被替换 socket 的旧回调仍忽略，保留既有生命周期所有权；不依赖旧关闭回调完成才能取消连接权限。

`action`、`edit` 等其他 pending 与 action receipt 不被这一条件清除，既有回退、首 view 重试、终态拒绝处理保持。未修改服务端、规则、协议、私投影、卡图、FX 或版本。现有 mount.update 会清 sending；网站断线权限白名单保持。

## 验证及失败留痕

- 初次 ignored Node `.local-evidence/pending-inspection-regression/run-BuDgSU/result.json` 7/9：前7控制通过，action夹具误把真实解码 SeatView.hand 的 Card 对象当作 raw wire ID；源码 types/unpackSeat 明确应取 `.id`。只修夹具输入，未改产品、断言或期限，该次不记完整通过。
- 修正后 ignored 实跑 `.local-evidence/pending-inspection-regression/run-DiRVcs/result.json` **9/9**，完整保留前次失败。
- 整理为 tracked `tools/website-pending-inspection-selftest.mjs`，路径从 import.meta.dirname 派生，临时编译及证据进入 ignored `.local-evidence/website-pending-inspection/`；没有固定盘符/会话/外部身份。原9控制、实际 WS/RAM/native timers、全部断言和期限不变。正式工具独立实跑 `.local-evidence/website-pending-inspection/run-pVPxy6/result.json` **9/9**。
- 9项包括两类型 enable/disable 丢首 send 后断线（4）、真实服务默认5000ms认证 deadline 期间有 pending inspection（1）、未认证1008和4001终态（2）、真实 ante 首 send 丢失与已 commit 后 ACK 丢失（2）。
- 五条普通恢复控制均取消旧 permission pending / commandTimer，无自动重发，无 stalled 回调；重连默认普通权限，新主动 enable 正常可用。两终态均1 connection/1 dropped command，pending/timer 清除。计时器观察使用原生 setTimeout/clearTimeout，不替换延时或手调 onclose。
- 两条 ante 控制均只有一次自动重试（总 send=2），保留同 envelope/action，真实 authority revision 只 +1，durable envelope/action receipts 各一条（合计2），pending/timer 清除；再观察750ms无第三次发送，不泄露 action/card/session 值。
- 原认证超时专项 **5/5**：`.local-evidence/website-auth-timeout/run-ANFOtz/result.json`；认证超时恢复、真实坏凭据拒绝、未知1008、4001与退避 stop 保持。`npm run typecheck` exit0；工具 node --check 和 git diff --check exit0。

上述首阶段9项验证对应客户端源 SHA256 `2b590ef626ae32907db3cc37be4159840fd5bab2a9fd83884768fb87fd2f5e72`，实际 built authority SHA256 `475dbf1ae4495debd4f9c50208dad6c58c578a5e0c900d50b23577719a25f12f`（服务端未改）。ignored控制 SHA `93648833e38903f37b64dcaf23143961c2d4e4d9d386d45e2640a5a1c71f8cc9`；首阶段tracked工具 SHA `ca4536d8b4bb684228201969b746cc92ff62d089d44047c5ceada01508d5cb1a`。

## 补充边界：关闭回调迟到与同实例重启

根任务独立复核提出：CLOSING 时 `command({type:'retry'})` 立即换 socket，旧 onclose 因 socket identity 不符被忽略；stop/start 同实例也使旧关闭回调失效。只改 onclose 的首阶段补丁不足以取消这两种权限 pending。

真实控制先复现，再扩最小 helper，未 mock onclose：

- `website-pending-inspection/run-zFBHDQ`：首次 grant send 丢弃后真实 socket.close 令 readyState=CLOSING，立即调用真实 retry；141ms 新认证普通，144ms 旧权限第二次 send 令 canEdit/inspect=true。安全断言失败0/1，确认为遗漏路径。
- `run-6MRSNa`：同一真实client stop/start，109ms 新认证普通，112ms 旧权限重发开启；安全断言失败0/1。更早 `run-vcdleu` 仅在新夹具的计时器观察点失败（stop同步清timer，await后已0），不作权限复现证据。该新控制改为捕获切换前原生timer已存在、切换后检查取消；原9控制的断言与期限不变。
- 扩helper后 `run-hYAg46` 9/11：原9全过，manual新控制仍用了旧“await后timer=1”的夹具观察点假设，失败留存；仅修新控制的同步切换观察点，同样不改变原9期望。
- 最终正式工具 `website-pending-inspection/run-Y5WOQf/result.json` **13/13**、exit0。原9全部保留；加上述两个权限边界和相同两个换连接入口下的真实 ante 保留控制。两权限新入口都是1次被丢旧 send、无自动重发、pending/timer清除、默认普通权限、新主动enable可用。四条action控制（含commit后ACK丢失）均同envelope/action、仅一次重试、authority revision仅+1、两条durable receipt。
- 最终再跑 typecheck exit0、原认证超时5/5（`.local-evidence/website-auth-timeout/run-EUmkGE/result.json`），未跑浏览器。当前网站 stop 仅destroy且不重用；server-page也建立新client，同实例重启是公开客户端API控制，不能冒称当前UI实测可达。网站retry入口存在但这个CLOSING窄窗口也未作浏览器验收。

最终客户端源 SHA `a12891aafc6eb817382322c8cffb98718bdabb762b8180f58833c6d94a6401f4`；正式13项工具 SHA `617b5a54b84b58196137d47df5bc1167ed2ed069dc0afa78927ee53a45c64336`。工具可用 `--case <公开控制标签>` 只跑指定控制，默认运行完整13项；限定运行结果不当完整通过。

## 遗留与验证范围

### 独立复跑第10项失败（不得以先前13通过覆盖）

独立审计运行原冻结工具/客户端相同hash，完整 `run-LGF1Af` 前9通过而第10失败；限定 `run-wEZEPT` 同第10失败，旧JSON只记合并Error和3条initial/pending/dropped-command事件，没有新view，不能据此归因权限重新开启。独立审计额外RAM定位 `run-5nn2mB` 确认为 `TypeError`，访问尚为null的 `freshViewAfterClose.pending`（原工具119行）。manual retry同步建立第二socket并清pending，但缓存view.connected仍true；旧socket close到达、新认证view尚未到达时原等待可能提前放行。这是夹具新连接观察缺口，尚无生产权限复活证据；若newview先于旧close，按close采点同样不可靠。

新增工具诊断只记录枚举failureStep、白名单error constructor名称和HTTP异常cause.code、最多32条公开事件中的socket attempt/open/close code及失败boolean/count/readyState；不记录message/stack/rawpayload/session/name/room/token/card/SQL。诊断限定 `run-qNVWqx` 第10恰通过1/1，不能当完整13或稳定修复证明。

根任务批准仅fixture generation同步修正：真实第二socket收到完整view并执行原callback/apply完成后采第一次pending/canEdit/inspect布尔，原普通恢复等待只增加该采点已经到达、仍12秒；其余权限/action/timer断言和期限保留，不依赖旧socket close与新view的到达次序。产品client SHA仍a12891aa，authority仍475dbf1a未变。

修正后完整 `run-eiqneN` **12/13**：第10/11权限入口与第12action入口均过，第13在setup-admission报TypeError，connectionCount=0、events为空，没有运行该客户端控制。无法从该次旧诊断确定HTTP异常根因，不能称事务行为失败或归因undici端口复用。只为区分准备原语新增create/join步骤和安全cause.code白名单；限定第13 `run-54w6A3` 1/1通过，不把限定通过合并为完整13。

随后换模型独立审计使用当前正式工具真实完整运行 `.local-evidence/website-pending-inspection/run-n6hs2e/result.json` **13/13**、exit0，第10–13全部通过；其静态复核原权限/action/timer assert及12秒期限保持。该次工具SHA `6d01bb0aa7d783f35f3bb7f52e73d49ce28e5b59cb259510b877671eeea164d1`，客户端与authority仍a12891aa/475dbf1a。新完整通过不撤销前两次TypeError与本次12/13准备失败，HTTP准备异常具体根因仍未知；不声称首次通过、UI或公网验收。未修改Agent、HTTP连接头、产品或等待期限，未push/部署。

Node证据是合成房间、真实协议与提交事务的控制，不是浏览器 UI 或公网验收。本次未运行浏览器，未改 package/CI/build版本，未推送或部署。根任务需接入这个专项的 CI（build:server 后），独立复核本次实际实现，再把最终候选的完整 CI / 浏览器 / 冻结包 / 发布决定分别留证。线上仍为 801；不得把候选修复或 Node13 项包装为线上已整改。
