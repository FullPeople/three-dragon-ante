# 2026-10-04 — 控制器专项按同一投影版本断言

## 范围与来源

- 隔离工作树：`U:/CodexWork/2026-10-04/three-dragon-integrated-refresh-c3960047`，分支 `integrate/fx3d-refresh-c3960047`，本轮基线 `c7b36be3dc5507d9a38edbc5fb090de7357a6cb7`。
- 根任务确认线上热修复 `801daf5` / 0.9.1 已发布；本 FX 候选未发布。本文的本机验证不能替代线上验收或 FX 浏览器验收。
- 动手前两次 `git fetch origin` 均成功；本轮初始 tracked 状态干净。
- 本轮只改控制器测试的接收同步条件与留痕，不改产品、规则、协议、服务、旧稳定频道、素材、版本或超时。未 push、未部署、未启动浏览器。

## 首次真实结果保留

Node `22.17.1`，完整首轮结果保存在 ignored `.local-evidence/fx-integration-validation/run-KuUEel/result.json`，各命令全文日志在同目录。此前 b37 成功 unit 日志另存该目录的 `previous-unit-evidence/`，没有拿旧结果替代当前结果。

| 命令 | 首轮结果 |
| --- | --- |
| `npm run build` | exit 0；含 `tsc --noEmit`，0 错误 |
| `npm run build:server` | exit 0 |
| `npm test` | exit 1，7/8；controller 专项 `6 !== 5`，其余七项通过 |
| `npm run test:website-auth-timeout` | exit 0，5/5，真实 Node/回环 WS，不是浏览器 |

controller 失败定位：生成入口 `D:/Temp/three-dragon-controller-Kvx8Zv/selftest.mjs:10279` 对应原 `tools/three-dragon-controller-selftest.entry.ts:56`，检查的是 **旁观者公开 `handCount`**。前一行提交者自己的 `hand.length === 5` 已通过；不存在这次失败证明“提交者额外摸牌”的证据。

原第53行只等待提交者的回执、手牌和 revision；第56行直接读取旁观者，未等旁观者采用同一 revision。`ControllerRoom.deliver` 使用 `queueMicrotask`，实际控制器 `receive` 异步执行原生解密；`send`/`broadcastViews` 等待发送，并不等待各接收者采用投影。第一次 ante 从三人桌手牌移出一张，尚未到全员翻注。当前 controller / fixture / rules 与 801 完全相同，本专项不执行 `ServerTableClient`。

首次失败没有记录旁观者 revision，因此**不能把原始失败的原因宣布为已确定的自然时序竞态**。以上源码只证明原测试缺少接收版本同步条件。

## 独立诊断与控制

未改 tracked 源码时，在 ignored 目录复制完整实际 controller entry，所有原断言保留。原生 controller / rules / WebCrypto 不变，只在诊断副本给旁观者 `PrivateLink.receive` 加受控 gate，或在实际解密出的合成公开投影中注入错误数量；无私牌、密钥、房间码、玩家数据或 wire 内容写入日志。

可复查的诊断源码：`.local-evidence/fx-integration-validation/controller-projection-diagnostic.mjs`；本次生成入口、三份日志与 `result.json` 在 `controller-projection-diagnostic-DOvp7n/`。

| 控制 | 实际结果 | 边界 |
| --- | --- | --- |
| 自然接收，新增 exact-revision 同步后继续原断言 | exit 0，原15组全部通过；采点双方 revision 1 / count 5 | 本次没有自然重现原始失败 |
| 延迟实际收件旁观者的解密入口，再释放 | 提交者 revision 1 / count 5；旁观者 revision 0 / count 6；旧断言真实失败。释放后 revision 1 / count 5，原15组全部通过 | 12次受控收件 gate；这是显式故障注入，不是原始自然失败录像 |
| 同 revision 的公开 count 故障注入 | exact-revision 等待完成，revision 1 / count 6；原 `expect 5` 真实 exit 1 | 等待没有按数量放行，也没有掩盖同版本数量错误 |

三个控制均符合预期（3/3）；旁观者私有字段存在性记录均为 false。错误数量控制的 exit 1 是预期阴性结果，不能列作产品成功。

## 最小修复

根任务依据受控证据明确授权：仅在原公开 count 断言前，使用现有 `until` 默认期限，等待旁观者的 `game.id` 与本次提交者一致且 revision **恰好为** `initialRevision + 1`。随后继续原 `handCount === 5` 断言。

没有等待 `handCount` 达到5，没有改成 `revision >=`，没有增加 timeout，没有减少任何断言或计数。丢失私有 ACK、重复动作只执行一次、持久化失败、私牌投影及其余原15组断言完整保留。

修复后仅运行一次 `npm test`，实际 exit 0，**8/8**，原控制器15组与 presentation20均通过；用时47.416秒。完整结果与八份日志在 ignored `.local-evidence/fx-integration-validation/run-post-sync-a54ae246/`，该次记录测试入口散列，随后只恢复原 CRLF 行尾并另记最终散列。首轮7/8与三个控制独立保留，没有用后续成功覆盖历史失败。

## 遗留与最少后续范围

- 本 FX 候选的浏览器窗口仍由根任务独占。本轮没有执行 Playwright。
- 建议窗口释放后先运行 `test:fx3d` 原9项、`test:fx3d-lifecycle` 原9项与 `test:site-presentation` 原13项，覆盖新 lazy / 单 rAF / 软件门控、双 context 丢失恢复和真实回执演出。未变化的矩阵不因本次测试同步修复盲目重复。
- 默认软件 GL 的在线演出验证走2D回退，不能据此称真实3D双客户端演出已验收；需要该结论时另做短的强制3D双客户端效果验收。
- 完整 FX 候选仍待当前源码的浏览器验证、完整 CI、换模型独立终审与发布决定，且版本应与已上线0.9.1区分。以上遗留同步写入 TODO。
