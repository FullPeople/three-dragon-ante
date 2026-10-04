# 2026-10-04 — FX候选串行浏览器验证

## 源码与边界

隔离分支 `integrate/fx3d-refresh-c3960047`，本轮起点 `02eaaa278634824dcdceb3f4800aa683c03eb8a1`；动手前 `git fetch origin` 成功。当前产品与先前c7相同，相对已上线801的整个game/server/旧稳定树差异仍为0。本轮不改产品、版本、配置、线上入口或远端，不合入后续a3文档，不push或部署。

根任务交出独占浏览器窗口后串行执行，首失败立即停，获得独立安全诊断授权后才一次复跑。所有证据在 ignored `.local-evidence/` 的新unique目录，未存生产房间/玩家数据、私牌、名字、凭据、房间码、完整wire或页面body。

## 真实结果

| 命令 | 实际结果 | 独立证据 |
| --- | --- | --- |
| `npm run test:fx3d` | exit0，9/9，25.330秒 | `fx3d-alignment/run-C2i58P/` |
| `npm run test:fx3d-lifecycle` | exit0，9/9，15.269秒 | `fx3d-lifecycle/run-2RKqzj/result.json` |
| `npm run test:site-presentation` 首轮 | exit1，8/13，102.486秒；purchase-presentation / TimeoutError | `site-presentation/run-gQmedK/result.json` |
| 同工具，仅诊断的一次复跑 | exit0，13/13，85.931秒 | `site-presentation/run-HwQqMI/result.json` |
| `npm run test:performance-structure` | 获得根任务重新交出窗口后执行；exit0，5/5，38.535秒 | `performance-compare/structure-Ywn7JH/result.json` |

每条命令的完整stdout/stderr与wrapper结果在 `.local-evidence/fx-integration-validation/run-browser-0d512784/`；诊断复跑另存 `run-purchase-diagnostic-8a998b00/`，没有覆盖首轮失败。

FX9：桌面/窄屏相机最大误差0.009/0.004px；原2c477历史舞台实际在同一浏览器rAF timestamp渲染4次，候选为1次。候选high档24帧24次render，原持久系绳+4beam负载36帧36render，结束effects0。软件GL默认2D回退与所有HTML不静态引入three的lazy gate通过。这是单链不变量实证，不是FPS提升结论。

生命周期9：真实双canvas contextloss释放图元与计时、等待settle、lateadd处置、loss中新能力实际2D贴图、单/双恢复、画质重建、六人方桌、金币28→22→28同canvas bitmap与拖拽中卸载通过；page/shader/resource/external错误均0。该9项**没有覆盖loss前既有field/selection hold的恢复**，见下方遗留，不把newburst通过用于替代驻留场景。

性能结构5：真实历史4f6fc6a的四组件对照与当前组件保持相同合法六人布局、金币、viewport/DPR和软件材质；256过滤币图→8实际绘制canvas；2D空闲隐藏与共享fx3d=0门控、合法拖拽并在桌外取消、素材与资源边界通过。此轮 `--structure-only` 没有采集任何FPS样本，也不代表实体弱机验收。

## 首次演出失败与安全诊断

首轮前8项能力、回合切换、轮次切换、结算均通过；买牌分支未完成第9项，kind为TimeoutError。两页最后均已连接、busyfalse、phaseplay；公共probe都记录purchase→price→flip→draw：提示到价格1814/1833ms，价格到翻面293/272ms，翻面到补牌1572/1342ms。说明真实序列发生过，但原stage包含多个瞬时等待/断言，不能定位失败原语，也不能断言是新产品bug或测试调度问题。

根任务明确授权仅诊断：在每个原purchase等待/断言前同步赋细分stage，失败时记录pending boolean、banner数量/可见性/rect、image数量、digits boolean与hand/ghost/flight数量；没有插入额外异步采样或修改等待。原文件行尾保持。

`node --check` / `git diff --check` 均通过。独立AST复核：原34个assert表达式、20个wait表达式、14个PASS表达式（含历史baseline分支）按序完全相同；current模式原13checks不变。证明与tool SHA256 `48644a5cb853ef5c5fd0b6cba900d7eecaaffc3ca745fc926f4fb81287aa09d5` 在wrapper目录 `presentation-diagnostic-static-proof.json`。

仅一次诊断复跑13/13，真实买牌提示到价格1834/1880ms、价格到翻面269/277ms、翻面到补牌1224/1281ms，脚本错误/外部请求0。该次没有触发细分failure，因此**原首轮超时的具体原语与原因仍未确定**。不把诊断添加称为产品修复，不把首轮8/13改写为passed，不再盲重跑。

## 遗留与验收边界

- 本轮默认software GL在线演出走2D回退；FX9的forced软件3D和生命周期夹具不能替代真实双客户端3D动作验收。
- 独立只读审计提出驻留P2：composeFx在contextloss释放并clear既有3D ambients，未保留AmbientSpec或restore重放；FieldLayer依赖未变可能不会恢复已有Druid/Priest field或selection hold。**尚待实际复现，未宣布已复现**；根任务已把真实field/hold→双contextloss→恢复（2D/3D实际纹理/Points/alpha）反例列为当前优先项，原life9不删。
- 真实联网3D后续方案应使用实际UI与权威回执，在实际air/ground原生draw中确认POINTS与非透明像素；`fx3dDebug=1`自带ground环/air柱，不能作为真实能力阳性。`fx3dGallery`亦只属图库夹具。
- 门控由`fx3d/preference.ts`规定：`?fx3d=1`强开含软件GL，但仍尊重画质；`?fx3d=0`关闭。`TDA_BROWSER`/`PLAYWRIGHT_CHANNEL`只是引擎选择，实际hardware验收启动参数需去掉SwiftShader且核对真实renderer。计划与正式工具增量待根复核后实施。
- 当前FX仍待驻留P2结论、实际联网3D、完整CI、换模型终审、版本区分与最终发布决定。与TODO双落；已上线801 / 0.9.1保持。
