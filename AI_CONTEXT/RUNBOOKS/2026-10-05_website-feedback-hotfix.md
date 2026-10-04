# 2026-10-05：以线上基线独立发布四项网站反馈

## 范围与来源

用户确认线上0.9.1可用，继续授权修复、普通push及双网站/必要三龙牌服务部署。术士指的是场上前注牌遮挡，不是UI；本批另含选中A快拖B、观战、全能默认背与独立牌堆查看/排序。保留仅在线网站、名字唯一与无账号恢复、空房清理、插件网站链接方向，不合并main/force/tag，不改其他站点、nginx/systemd/.env、卡图、wire/私牌协议或普通游戏算法。

此前组合候选 release/website-feedback2-20261004 的四项功能与前31步CI已过，但最新053eada首次CI37216297279仍在第32步FX失败（7/9）：真实25帧2161.1ms，从high合法降medium；原workload18帧，亦未达到>20。air/ground空场绘制调用最大1.7/2.4ms，gap最大216.6ms；实际负载首次调用363.4/229.3ms。取证不证明合成/GPU的具体原因，B保留所有原断言与失败，不包装为通过，不重跑凑绿。最新附件特效继续单独验证，不进入本次优先bug热修复。

先fetch exit0，新隔离分支 release/website-feedback-hotfix-20261005，基线为当前线上冻结801daf580e9505a377dc97a544c4ad051ea029ac。只转移c955的layout/CardNode两修复、e934的观战/全能/deck已审delta，及5506116的权限pending跨连接取消修复。后者防止过期inspect在新连接自动重发，真实action重试保持；原独立Node13历史留痕随源码保存。本分支验证仍须新跑，历史通过不继承。

ignored port-reviewed-changes.py按唯一旧片段逐个应用审阅delta；与新FX共同改过的mount/TableApp只应用全能功能增量，保留线上原FX接缝。其他feature源码与053的相同文件字节复核，移植记录port-record.json。新版7个功能工具来自053已审版本，含真实ACK输入前提、实际牌落地等待和安全诊断；不删原断言/计数/期限。

线上原fx3d/fx、TableScene/presenter/scene.css、FX相机工具/原演出/飞牌工具与801逐字0diff。CI原23条run命令同序完整保留，增加6个新专项（观战Node/browser、牌堆Node、控件browser、inputbrowser、pendingNode），proof workflow-preservation.json。原相机4项继续验线上原地基；组合分支的9项仍失败，两产品范围分别记录，不能声称附件9项已过或用4替代9。版本统一0.9.3(-dev)，依赖版本不变。

## 当前验证与发布状态

此节只记录本分支的新实测，不能沿用组合候选的CI/包。五份复制runbook为历史审阅/反例出处，不是本分支通过或已上线证据。

- 环境、构建、本机四项专项与原回归执行中。
- 完整精确CI、换模型源码/发布终审、冻结GPL包与独立校验待完成。
- 当前未上传、apply、restart或部署。线上仍801/0.9.1；其他站点相对旧before有变化，发布前fresh只读快照并逐项保全，禁止覆盖。

首次本分支实测（所有退出码0，Windows已安装Edge，单一重型窗口串行）：

| 命令 | 真实结果 |
| --- | --- |
| npm ci --ignore-scripts | 成功；原依赖版本保持，U盘现有cache/TEMP |
| npm ci --ignore-scripts --prefix server/three-dragon | 成功 |
| npm run build | tsc0错误，Vite产物成功 |
| npm run build:server | 成功，dist-server |
| npm test | 原8/8入口 |
| npm run test:server | 原2/2入口 |
| npm run test:website-spectator | 13/13，run-hyJc0C |
| npm run test:website-deck-order | 10/10，run-MUPhX3 |
| npm run test:website-pending-inspection | 13/13，run-Q2BNga |
| npm run test:website-input-feedback | 12组快拖/ACK/取消，10组合法2–6席术士和20点击，run-cCAb89 |
| npm run test:website-spectator-browser | 13/13，run-TiitaX |
| npm run test:website-omniscient-controls | 19/19，run-dPm1fu |
| npm run test:fx3d | 线上原地基相机4/4；不是组合候选9/9 |

新source机械比对：22个功能/工具与053已审源码逐字相同；桥接TableApp/mount/hud.css/README仅移植功能delta、保留旧FX。独立gpt-6.1-sol/high只读源审有条件通过、无需整改P1/P2：另核120保护文件与801同字节，原23run保留/加6、原断言和500ms门槛保留；旧presenter私牌ghost无公开ID，ACK不取消演出与撤权立即清场保持。条件为本分支完整精确CI、冻结/GPL包终审和fresh前后/公网，源审及本机专项不替最终部署验收。

## 遗留（同步TODO）

完整原23+新增6门禁、新冻结与GPL/终审、fresh稳定before、双网站+必要server定向部署、独立after与公网原12/权限8/新增15验收。实体手机/弱设备与真实玩家UAT仍独立待验。组合分支的新FX性能阻塞保持，不混作本热修复已解决。
