# 2026-10-04 · WebGL 失效后的驻留恢复与取消

## 授权、来源与边界

用户当前目标是仅在线网站，并要求整合附件性能与完整特效。按 GOAL §11，对候选进行只读审计后，根任务明确授权修复真实复现的 ambient P2；本次只改 `presentation/fx3d/FxStage.ts`、`presentation/fx3d/composeFx.ts`、`presentation/scene/TableScene.tsx` 与本 runbook。动手前 `git fetch origin` 成功，exit 0；复现来源为整合分支 `19d2ebd5110699c25fffb78cd9b8d44e7de5f51a`。当前线上仍为 `801daf5`，此次没有推送或部署。

规则、协议、私牌边界、卡图、server、旧稳定频道未在本改动范围内。并行代理正在处理 server-client pending inspection 与测试工具；这些不是本提交内容。未使用真实房间、玩家数据、密钥或 AI 美术。

## 真实问题与证据

证据：`.local-evidence/fx3d-ambient-recovery/run-qJ6J9X/result.json`。该诊断使用实际六人 TableApp/composeFx 与真实双 `WEBGL_lose_context`，分别检查 druid、priest、选择 hold；只保存公开计数/布尔值，不保存像素缓冲、投影或载荷。诊断 `completed: true`、`counterexampleConfirmed: true` 表示反例确认，不是产品通过。

- 每场失效前，原生 air POINTS 与 ground alpha 均为阳性，确认实际驻留正在绘制。
- 双上下文失效后，已有驻留没有转为 2D；双恢复后已有 3D 驻留仍为零。
- 失效期间新建的驻留确实进入 2D；恢复后取消相同 id，等待 2.5 秒尾巴及额外 450ms，三场仍分别绘制 497 / 479 / 499 次，alpha 非零、RAF 为 1。
- 脚本/外域/资源错误为零；预期的 Context Lost/Restored 通知单独记录。该证据不是公网联机或实体弱机验收。

根因是逐调用路由缺少驻留所有权：onUnavailable 只释放并清空 3D Hold；恢复没有重建请求。失效期间发给 fx2d 的请求也没有进入 3D Map，恢复后的 null 又只清理 3D 路径，从而留下持续发射的 2D Map 项。

## 修复与本地 API

- composeFx 用 `requested` Map 只保存当前仍有效的公开 AmbientSpec，复制嵌套坐标/漂移/hold 数据；null 删除请求，不保留历史 tombstone。3D 图元构造仅抽出 helper，原档位、贴图、数量、形态和粒子寿命保持。
- ambient 始终进入 owned handler，替换或取消相同 id 时清理 2D/3D。context-lost 第一次通知释放 3D，并将有效请求交给 2D；重复 loss 不重复启动。完全恢复时先停止对应 2D 发射，再重新构造有效 3D 驻留。一次性的 burst/beam/sigil 与家族脚本不重播。
- `FxStage.onAvailable(callback)` 只在 lostCanvases 中最后一个真实上下文恢复、layout 完成后通知。监听使用数组快照，逐次确认 available/订阅仍有效；重复恢复事件不会再次通知，监听重入销毁后不会继续恢复。
- `onUnavailable(callback)` 的 callback 增加可选本地 reason：`context-lost | destroyed`，无参监听仍兼容。destroyed 只执行 composition 终态销毁/退订/双路清理，不能创建新 2D 驻留；此参数不属于网络协议。
- `schedule(callback, ms, onCancel?)` 公开已有内部取消回调。画廊原 800ms 开始与 2600ms 结束不变；结束和取消共用幂等 stopGallery，失效取消时先删除有限画廊请求，随后才通知不可用。未新增裸计时器、重置期限或延长画廊。
- composition destroy 先标记终态、移除两个监听、删除有效请求并释放 Hold/2D；Stage 仍负责其 effect pool、GPU 对象、计时器、两个上下文和监听的最终 dispose。销毁后的调用不能复活驻留。

`AmbientSpec.life` 是单粒子寿命，不是驻留到期时间。停止 2D emitter 后，已有粒子会按原寿命正常退场；不应把有界尾粒子误判为持续泄漏。原文件行尾保持：FxStage/TableScene 为 LF，composeFx 为 CRLF；本新增 runbook 为 CRLF。

## 当前验证

| 检查 | 真实结果 |
|---|---|
| `git fetch origin` | exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit` | exit 0，0 类型错误 |
| `git diff --check` | exit 0 |
| 实际 browser、修后 ambient/原生命周期回归 | 尚未执行；由独占浏览器测试代理验证，原反例不能算修后通过 |
| 提交、推送、部署 | 根任务已提供独占 index 窗口，仅本节四文件独立本地提交；具体提交 SHA 以 git log 为准。未推送/部署 |

## 遗留（由根任务同步 TODO）

1. 在相同实际组件/原生仪器下验证 druid、priest、selection hold：失效前阳性 → 双失效实际 2D → 仅一个恢复仍为 2D → 双恢复实际 3D → 失效期间新驻留恢复 → null 后超过最长尾粒子寿命无继续绘制/alpha/RAF。保留真实历史源码阴性对照，不降低原断言或等待。
2. 补实际有限 gallery 到期/取消不复活、重复 loss/重复 restore 只重建一次、loss 中删除/替换请求、直接 Stage.destroy 与恢复监听重入销毁后无 2D/3D 复活；原 lifecycle 9 项保持。
3. 画质完整重建期间的既有选择 hold，以及失效期间同时换竖屏后的锚点，仅为静态待验证路径，本修复未声称覆盖。FieldLayer 会因 fx 更换重发，但 presenter 既有 powerHold 的重发需要真实验证后决定，不推断为已经复现。
4. 当前源完整 CI、3D 实际联网与定向发布仍待根任务完成；真实弱机/实体手机人工体验与历史 5→57 数字保持独立。实质修复完成后，按 AUDIT.md 用其他模型做独立审计。
