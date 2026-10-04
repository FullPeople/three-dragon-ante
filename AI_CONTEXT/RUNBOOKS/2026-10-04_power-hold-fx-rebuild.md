# 等待选择驻留能力接回新 FX owner（2026-10-04）

实现模型：gpt-6.1-sol。用户已授权依据真实附件表现问题继续修复，根任务本轮明确授权最小 presentation 修复；开工先 fetch（后补 fetch --prune，仅更新本地远端引用），当前产品基线 `bc1dee2e85e6fe10edcaf389a81c0aa55de0404e`。只修改 presenter/mount 两个 owner 文件及本记录，未改 TODO、其他 agent 工具、版本或发布入口；未运行浏览器、push 或部署。

## 真实反例

`.local-evidence/fx3d-producer/run-39HGpC/result.json` 在原产品 `7fb7a08` 真实 mountTableUI + engine 合法 blue pending choice 建立 show.powerHold，原参数 rate=3/life=2/size=2.4/alpha=.75/driftY=-22，初代 air/ground 有实际 draw、POINTS 与非空 alpha。点击真实质量按钮后 generation=2，choice/busy/合法 fixture 不变，新 stage available/threeMode，但 specCalls 仍1、新 stage draw/alpha 均0，失败阶段 hold-quality-render。独立审计确认该重建路径；不能部署原042冻结候选，不能把先前生命周期/手写 ambient fixture 通过替代此 producer 反例。

## 修改及保护

`app/presenter.ts` 抽取原驻留参数生成到 emitPowerHold，新增仅内部的 hold gameId、具体 FxLayer owner 与 ambient key。原能力演出建立 hold 时记录局 ID 并调用共享 helper；更新 owner 前只对旧 owner 的同 key 发 null，然后重新读取 DOM handRect/cardPoint，原数值和 public who/code/source 锚点保持。

新增 restorePowerHold 只接回 show.powerHold：presenter 未 destroyed、未 suspended、最新 view connected；最新/显示投影均为记录的同一局，两份公开 choice 的 id/seat 与 hold 相符，且 sourceCardId 或公开 active resolutionStack 仍对应 cue。失效只释放旧 owner，不改 store.show、display/flow/busy，不调用 update/pump/clear，不重放有限能力脚本、声音、banner 或事件。相同 owner/key 的重复发布去重。选择结算收尾开始就清记录并释放（在原420ms等待之前），clear/scope-change/suspend/failed/destroy沿原clear调用释放，防止旧show在收尾期间复活。

`mount.ts` 在 onFx 发布不同的非null owner 且 mount 未 destroyed 后通知 presenter。这样质量重建的初始2D层及随后lazy composed层都可接回；stage=null 时 compose返回同一2D对象，不重复启动。onFx(null)不建立效果；旧composition生命周期清理由原 TableScene/composeFx负责，本轮未修改这些文件。

规则、协议/wire/私牌、服务端、艺术及旧稳定模块未修改；只消费既有投影和DOM锚点，不生成规则状态。

## 验证与后续门槛

before SHA256：presenter `23dd51c137ece0a38e31d93af12382b43c69dfb46f3dd311d10f41df06af743b`，mount `0192b95d0209083ec8bf3a062f2a6ab742979ba187adc14463bbdf9fe1eaacd5`。

当前修改后：presenter `96613b969b1896c26c4b93e76dbfe5695446157dc4e7e2f0f9659c761bb839c8`，mount `f2aa19ce64da417470cbb790bfd9c3b0160846cd3da35b54909a206619b2178e`。最终 npm run typecheck exit0、git diff --check exit0。首轮 typecheck 的 nullable choice 提示已改为显式 choice/hold 存在判断；没有放宽 types 或非空断言来遮盖它。

仅源码/类型验证，尚未取得修复后真实浏览器 producer 结果，不能自宣最终安全。根任务/独立审计需复核 owner/choice/销毁边界，并由浏览器独占 agent 跑真实质量切换反例，保留原参数、原断言和旧失败；最终版本冻结、完整 CI、包审及发布另行决定。当前线上仍0.9.1；本修复未部署。
