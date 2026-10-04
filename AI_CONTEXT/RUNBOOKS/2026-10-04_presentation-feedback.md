# 2026-10-04 网站演出与铭牌反馈（0.9.1）

## 授权与基线

用户六项实际体验反馈见 GOAL §11。持续修复、push和定向部署授权沿用；只当前认证网站房主可以隐藏键序启用全能，普通玩家私牌隔离和旧枭熊授权继续保留，DOMAIN §6明确覆盖旧网站全禁政策。禁止AI素材/外域请求/玩家数据入库，保护rules/protocol/wire/private/art/oldstable/fx3d/其他宿主功能。

开始前 git fetch origin 通过；分支 rebuild/presentation，HEAD d7a423215b79c7dd7470ec1df210afd647fcb7ab，线上冻结7555f99/0.9.0，tracked干净、原untracked .claude/保留且未读取。未修改远程地址/凭据、不合并main或打tag。

## 查证与改动

- 提交者先收到新revision的view，随后同revision的ack导致presenter非相邻分支clear，队列被取消；观察者无自身ack而正常。修复同局同身份同投影scope重复帧只刷新权限/回执，不重播或取消，跨局/跳revision/投影scope变化仍清场。精确回执逻辑纯搬移到action-receipt helper供生产与专项同用，拒绝/不匹配回执不得提前落地。
- 原purchase banner在卡牌/金币之后。改为按公开BUY_PRICE归属逐家说明→价格牌→付款→匿名补牌；在补牌到达前不展示新增私牌。购买款从通用流中去掉，避免重复；不从前端推断规则。
- 旧GhostLayer位于桌面的层叠上下文，实测牌堆到手牌的飞行后段会被独立手牌层盖住。飞牌移到桌面/手牌之外的独立平面，复用原perspective/tilt并保持内部3D；覆盖牌堆与手牌，不拦点击。首次control假定起飞必遮挡，实际起飞可见而后段遮挡，失败n5IU35不计通过；修正control为git show d7a4232的实际GhostLayer与原容器CSS，完整路径采样验证。减少动态分支也应用公开价牌最终正面，避免跳过动画时丢翻牌信息。
- 姓名/金币/债务/手牌原单行没有内部宽度收缩，自家max-width只约束容器。改姓名与财务两行，12–18px实测压缩，完整数字保留，极长名字有完整title；160/180×44边界与layout-check同步。点数用现有CC0金属照片，金币沿用木纹，无新素材。
- 网站缺失全能源于UI仅obr、OnlineMatch拒绝、server排除guest；复用现有inspect/omniscient/edit消息，仅真实房主主动inspect可编辑。键序忽略输入/搜索/编辑文本，吞完成序列Enter防误出牌；断线/刷新/交接清私投影。独立审计指出真正网站断线保留旧全能view，已交网站接缝修复并加实际TCP断网反例；同revision投影权限scope转换需立即清场。

## 验证与独立审计（持续更新）

- 原整组npm test出现controller-selftest一次6 != 5：compiled selftest10279是watcher public手牌计数断言，前一等待只等Alice private更新，两个异步频道存在先后。源码/controller/规则未改。单独原工具完整15组通过（D:/Temp/three-dragon-controller-ElGXpk/selftest.mjs），失败日志保留.local-evidence/regression/three-dragon-controller-selftest.mjs.log。不把这次失败包装为全组成功、不改预期凑数；最终必须完整回归通过。
- 当前铭牌21/21：.local-evidence/nameplate/run-GLCMY0/result.json，桌面/390px、2–6人，数字999999/债务9999/手牌10完整，脚本/外域0；初次ResizeObserver循环已修并重测，初次结果不计最终证据。
- presentation19/19：D:/Temp/tda-presentation-6wC9D8/result.json。同revision身份/scope、全能补牌迟显均入真实引擎专项。完整npm test现8/8，test:server2/2通过；第一轮controller失败仍保留记录。
- 飞牌最新10/10：.local-evidence/flight-layer/run-x4S0Zr/result.json，桌面/窄屏前后版控制、完整飞行覆盖、投影误差0px、减少动态公开价牌正面、零外域/脚本错。
- 全能13/13：.local-evidence/website-omniscient/run-qpCVbf/result.json，真实TCP切断与socket暂停8秒超时均撤私牌与编辑DOM，晚帧不复活。独立审计另指出已在线撤权帧actions不可恒空，已交补恢复后实际合法前注验收；最终复测待收口。
- 真实网络旧版复现2/2：.local-evidence/site-presentation/baseline-IbOewA/result.json，只切旧presenter的无BUY黑龙合法引擎场景，提交者能力说明被view→ack取消，观察者保留。新源四场实际DOM/网络完整演出验收仍在完成，不把失败run当通过。
- gpt-6.1-sol中途审计有条件通过：恢复动作与reduce价牌两项P2必须收口，真实四场、完整CI及冻结包待最终独立审计。

## 用户更新附件

用户明确补充：根据新压缩包整合完善，之前所说卡顿PR即这份附件，并要求读取内部AI_CONTEXT。UNC附件73,747,235字节、mtime2026-10-04 12:23:44，HEAD 2afca32662d53685348361d439a4d8ea50e04840。隔离解压并按INDEX→GOAL→MEMORY→TODO及交接留痕核验；保护当前网站/演出修复，不整包覆盖。附件具体特效/性能整合与验证待核验后记录。

## 遗留

本轮未完成事项同步TODO：补真正网络提交者演出/买牌先后、飞牌覆盖几何、全能撤权复核，完成完整CI与换模型审计后按freshbaseline定向发布并写公网结果。当前线上仍0.9.0；不能以本地候选冒称上线。
