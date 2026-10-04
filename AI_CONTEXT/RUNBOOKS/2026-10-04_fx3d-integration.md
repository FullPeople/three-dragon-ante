# 2026-10-04 附件特效与性能提交隔离整合

## 来源与读取

用户更新同名附件并指出它是此前卡顿修复，明确要求读取内部 AI_CONTEXT 后整合完善；本次包含必要 fx3d 整合与独立审计发现的生命周期修复。文档内的启动词、旧目标、命令仅作附件资料，没有执行 checkout 回退、改远程、main/PR、枭熊内游戏或恢复本地机器人的指令。

- 附件 `//192.168.0.49/Share/three-dragon-ante-2026-10-03.zip`，73,747,235 字节，mtime 2026-10-04 12:23:44，SHA-256 `50ee608dd057b2c6f8f296e5b517be6a2c214f7112d0d7b027aa3a81224a8013`。
- 附件 HEAD `2afca32662d53685348361d439a4d8ea50e04840`；共同基线 `619ada56bbb2556e015d8775984baa416ab13692`；附件独有17提交。合并第一父节点网站反馈 checkpoint `4f6fc6a7263237c48afbc55c75dce4b83d0fa1d2`。
- 隔离工作树 `U:/CodexWork/2026-10-04/three-dragon-integrated-feedback-2afca326`，分支 `integrate/fx3d-feedback-20261004`。使用已核验的本地 `refs/tda-import/fx3d-20261004` 进行 `git merge --no-commit --no-ff`；保留17原提交史。未 push、部署、合并 main 或改远程/凭据。
- ZIP 提取先校验路径防逃逸/重解析条目，跳过 `.claude`、私密 env、DB、玩家/证据与产物，没有整包覆盖 D 现场；本机根工作树的未提交反馈实现先由根任务 checkpoint，合并仅在 U 工作树完成。
- 已按顺序完整读 INDEX → GOAL → MEMORY → TODO → round3 §6 → README → server203部署文档 → systemd unit → HANDOFF_FX3D → kickoff/design/perf 相关留痕。当前任务正本是 GOAL §10–§11；附件 handoff/PR/perf 文档已加历史标记。
- ZIP 原中央目录没有 `.local-evidence/perf-probe.mjs` 或性能样本；原机器5→56fps仅保留为历史报告。本机受控性能比较由根任务独立生成，不能用此记录冒称当前机器/真实弱机已通过。

## 整合内容与冲突

附件 P0–P5、图元/41家族脚本、等待与场地、画质/自动降档、家族尘土与飘带头粒子、three 独立 chunk 和 MIT 技术署名已整合。性能提交 `cce0fe3` 把每枚金币滤镜 DOM 改为每堆一张画布与已有金币派生的烘焙贴图，去桌面/不可用牌滤镜、空闲画布隐藏、指针状态按 rAF 合并。原 `game/art/currency/dragon-gold.webp` 不改；派生贴图登记原 Wizards 权利，没有生成或下载新美术。

6 个实际冲突按以下理由解决：

| 文件 | 处理与依据 |
|---|---|
| TODO | 保留当前网站/演出在办项及403已解决事实，更新附件整合与仍待总回归/独立终审项；不复活旧403阻塞或本地玩法 |
| TableApp | 保留当前确认弹窗、可点击顶栏、website隐藏fuvtt和精确pending控制；合入画质按钮/data-fx/档位事件，拒绝附件local条件与直接新局 |
| SiteApp | 保留当前真实在线创建/加入/重连/随机昵称/退出确认实现；拒绝附件 `opponents` 本地机器人夹具 |
| package.json | 保留0.9.1-dev与4个当前新专项/原全部测试；附加独立生命周期专项由实际新工具支撑 |
| fx3d-alignment-check | 保留实际在线authority创建房间/第二合成座位，添加forced WebGL、无遮挡与data-fx及分包检查；不会改回旧首页开始按钮 |
| production-practice-smoke | 维持当前删除；附件修改只对应已移除的本地机器人入口，网站/真实动画专项覆盖当前方向 |

自动合并逐一检查：presenter 只新增等待形态公开参数，保留同revision投影/回执不取消、权限scope切换立即清场和购买说明→价牌→金币→匿名补牌；mount 保留精确回执辅助函数及私牌边界，新增渲染状态；TableScene/GhostLayer 的飞牌门户与几何保留；原所有 selftest 断言保留，并增加相机数学一项；原4个CI反馈专项保留。版本锁与网站路由/服务/授权源码未回滚。

## 独立审计整改

- 逐canvas丢失集合及 `stage.available`，任一上下文丢失清旧效果/调度、隐藏画布并同步shell/root为canvas2d；新调用实时走已有2D贴图接口；仅两张都恢复才重启3D。不以任意一张恢复就撤销另一张的lost状态。
- FxStage 自有 schedule/repeat/wait；loss/destroy取消定时任务与等待，等待收口不中断权威回执；Kit/家族/compose/画廊所有裸计时改为舞台调度，迟到add直接dispose。销毁可重复调用，旧script/图元不能复活旧舞台。
- 画质重建直接设置当前桌形，并同步依赖epoch；6人方桌裁剪不再退成圆。
- 拖拽集中cleanup，卸载/跨局/换座位/断线时移除window move/up/cancel监听、释放capture、清待帧及取消rAF；后续指针不触旧controller。
- debugMarkers 使用alive/dispose，卸载后不留永生effect。
- 所有座位/奖池/偿债池把当前tilt显式传到CoinStack并参与重绘依赖；横竖屏同金币数不再留旧补偿。金币数量与锚点不变。

## 实际本机验证

Node 22.17.1、已装 Edge +软件GL；所有执行在本工作树。测试只使用合成room/SeatView，不记录实际玩家/私牌/token/房间转储。

| 命令 | 实际结果 |
|---|---|
| `npm ci --ignore-scripts` | exit0，42包；npm报告既有5漏洞（2moderate/3high），未混入升级 |
| `npm ci --ignore-scripts --prefix server/three-dragon` | exit0，1包；npm报告既有1high，未改服务依赖 |
| `npm run typecheck` / `npm run build` | exit0，tsc0错误、Vite产物完成；three独立chunk 533.19kB有构建体积提示 |
| `npm run build:server` | exit0 |
| `npm test` | 8/8；presentation 20/20，保留原19项并增加附件相机数学 |
| `npm run test:fx3d` | 7/7；桌面最大0.009px/窄屏0.004px，实际在线构建、画布不抢命中、零外部请求与脚本错误 |
| `npm run test:site-presentation` | 13/13；真实loopback HTTP/WS提交者与观察者，四场合法引擎fixture，非reduced动画，买牌说明/翻价牌/补牌与能力/回合/轮局演出；`.local-evidence/site-presentation/run-eHrmc2` |
| `npm run test:nameplate` | 21/21，桌面/窄屏×2–6人，完整财务/姓名边界与木金属材质；`nameplate/run-WwkRlp` |
| `npm run test:flight-layer` | 10/10，旧遮挡真实反例、门户几何与低动态翻价牌；`flight-layer/run-PaEM4a` |
| `npm run test:fx3d-lifecycle` | 最终9项工具由作者和合并者复跑通过：真实双contextloss/逐张恢复/2D纹理回退/质量重建与销毁/6人方桌/同canvas金币旋屏/拖拽pending帧卸载/零错误外部请求；`fx3d-lifecycle/run-IShVz5`；合并者 `fx3d-lifecycle/run-p0vPfk` 同9/9 |
| `git diff --check` | exit0 |

上述9项通过的工具 SHA-256 `7e45073e930c9cecd27431beafa1c3bd237e3bbefc1d0ebb1e5acbcb615483e0`。根任务review后进一步只加强fixture：每次queueScript重置scriptSettled=false，质量重建等待其真实重新settle，防止沿用上一场true；该最后微改由根任务独立复跑，不冒称前述9项已经覆盖它。金币读回专项只在fixture的金币canvas固定 willReadFrequently（CPU读回），验证同canvas/32枚/倾角28→22→28的像素先变再精确复原；这是几何验证，不是性能证据。旧失败记录保留：多算浏览器先存pointerup监听导致总数断言失败，已改拖前baseline+3/卸载回baseline；GPU→CPU读回切换影响严格hash，固定测试backend后仍维持精确回原hash断言。强化拖拽同任务先排1个产品RAF，卸载后0帧/旧controller0访问。

游戏规则/协议/private-channel/服务端/旧稳定频道/卡图相对第一父节点 **0文件diff**。构建产物、依赖、fixture与证据均不提交。

## 遗留与完成边界

待根任务完整回归/CI、受控软件GL 6人性能比较、换模型独立终审、冻结源与定向发布/公网实际验收。尚未证明用户真实弱机或实体手机表现，附件原5→56不能替代。可选Wisps/Volume、手掌照片与持续音效保留为后续事项，双落TODO；未为了完成这些擅自生成美术。附件整合不等于线上已发布。实质修改完成后应按 AUDIT.md 用另模型独立审计。

## 相对网站checkpoint的具体文件范围

- `AI_CONTEXT/HANDOFF_FX3D.md`
- `AI_CONTEXT/HANDOFF_NEW_MACHINE.md`
- `AI_CONTEXT/MEMORY.md`
- `AI_CONTEXT/PR_rebuild-presentation.md`
- `AI_CONTEXT/RUNBOOKS/2026-10-03_fx3d-kickoff.md`
- `AI_CONTEXT/RUNBOOKS/2026-10-03_presentation-round3.md`
- `AI_CONTEXT/RUNBOOKS/2026-10-04_fx3d-design.md`
- `AI_CONTEXT/RUNBOOKS/2026-10-04_fx3d-integration.md`
- `AI_CONTEXT/RUNBOOKS/2026-10-04_perf-compositing.md`
- `AI_CONTEXT/TODO.md`
- `docs/design/ASSETS.md`
- `docs/design/THIRD_PARTY-elemental-sandbox.md`
- `docs/design/VISUAL_SPEC.md`
- `extensions/three-dragon-ante/src/presentation/app/TableApp.tsx`
- `extensions/three-dragon-ante/src/presentation/app/presenter.ts`
- `extensions/three-dragon-ante/src/presentation/assets/coin-gold.webp`
- `extensions/three-dragon-ante/src/presentation/fx/particles.ts`
- `extensions/three-dragon-ante/src/presentation/fx/powers.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/FxStage.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/composeFx.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/debug.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/kit.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/palette.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/primitives/Beam.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/primitives/Burst.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/primitives/Collar.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/primitives/Emitter.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/primitives/GroundMark.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/primitives/Pillar.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/primitives/Shell.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/scripts/families.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/scripts/types.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/shaders/lib.ts`
- `extensions/three-dragon-ante/src/presentation/fx3d/textures.ts`
- `extensions/three-dragon-ante/src/presentation/hud/hud.css`
- `extensions/three-dragon-ante/src/presentation/i18n.ts`
- `extensions/three-dragon-ante/src/presentation/mount.ts`
- `extensions/three-dragon-ante/src/presentation/presentation-selftest.mjs`
- `extensions/three-dragon-ante/src/presentation/scene/CoinStack.tsx`
- `extensions/three-dragon-ante/src/presentation/scene/FieldLayer.tsx`
- `extensions/three-dragon-ante/src/presentation/scene/SeatBlock.tsx`
- `extensions/three-dragon-ante/src/presentation/scene/TableScene.tsx`
- `extensions/three-dragon-ante/src/presentation/scene/scene.css`
- `extensions/three-dragon-ante/src/presentation/theme/tokens.css`
- `extensions/three-dragon-ante/vite.config.ts`
- `package.json`
- `tools/fx3d-alignment-check.mjs`
- `tools/fx3d-lifecycle-browser.mjs`
