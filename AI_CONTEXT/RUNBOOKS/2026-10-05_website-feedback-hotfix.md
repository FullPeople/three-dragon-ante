# 2026-10-05：以线上基线独立发布四项网站反馈

## 范围与来源

用户确认线上0.9.1可用，继续授权修复、普通push及双网站/必要三龙牌服务部署。术士指的是场上前注牌遮挡，不是UI；本批另含选中A快拖B、观战、全能默认背与独立牌堆查看/排序。保留仅在线网站、名字唯一与无账号恢复、空房清理、插件网站链接方向，不合并main/force/tag，不改其他站点、nginx/systemd/.env、卡图、wire/私牌协议或普通游戏算法。

此前组合候选 release/website-feedback2-20261004 的四项功能与前31步CI已过，但最新053eada首次CI37216297279仍在第32步FX失败（7/9）：真实25帧2161.1ms，从high合法降medium；原workload18帧，亦未达到>20。air/ground空场绘制调用最大1.7/2.4ms，gap最大216.6ms；实际负载首次调用363.4/229.3ms。取证不证明合成/GPU的具体原因，B保留所有原断言与失败，不包装为通过，不重跑凑绿。最新附件特效继续单独验证，不进入本次优先bug热修复。

先fetch exit0，新隔离分支 release/website-feedback-hotfix-20261005，基线为当前线上冻结801daf580e9505a377dc97a544c4ad051ea029ac。只转移c955的layout/CardNode两修复、e934的观战/全能/deck已审delta，及5506116的权限pending跨连接取消修复。后者防止过期inspect在新连接自动重发，真实action重试保持；原独立Node13历史留痕随源码保存。本分支验证仍须新跑，历史通过不继承。

ignored port-reviewed-changes.py按唯一旧片段逐个应用审阅delta；与新FX共同改过的mount/TableApp只应用全能功能增量，保留线上原FX接缝。其他feature源码与053的相同文件字节复核，移植记录port-record.json。新版7个功能工具来自053已审版本，含真实ACK输入前提、实际牌落地等待和安全诊断；不删原断言/计数/期限。

线上原fx3d/fx、TableScene/presenter/scene.css、FX相机工具/原演出/飞牌工具与801逐字0diff。CI原23条run命令同序完整保留，增加6个新专项（观战Node/browser、牌堆Node、控件browser、inputbrowser、pendingNode），proof workflow-preservation.json。原相机4项继续验线上原地基；组合分支的9项仍失败，两产品范围分别记录，不能声称附件9项已过或用4替代9。版本统一0.9.3(-dev)，依赖版本不变。

## 当前验证与发布状态

此节只记录本分支的新实测，不能沿用组合候选的CI/包。五份复制runbook为历史审阅/反例出处，不是本分支通过或已上线证据。

- 以下本机表为本分支首次实测；精确源码062dd411cab245c418223a051a8a653b35d9eac2的完整CI37218363801/job111483437958实际success，原23条run及新增6条均完成。原FX4和飞牌10在末尾亦通过，不替附件FX9。
- 换模型gpt-6.1-sol/high源审和冻结/GPL包终审通过，无P1/P2；远端实际前后保全审计亦通过。新增公网验收仍待，不自宣最终交付安全。
- 已上传并定向apply两网站与必要server，真实exit0、回执status=applied。线上0.9.3(-dev)；Suite/角色卡/配置/保护服务保全，详情见后续发布节。

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

原23+新增6精确CI、冻结GPL包/审计、fresh前后/定向部署和公网12/8已完成。新增公网15及其失败闭环和最终裁决待；实体手机/弱设备与真实玩家UAT仍独立待验。组合分支的新FX性能阻塞保持，不混作本热修复已解决。

## 冻结包、发布与实际前后保护

源码062dd411cab245c418223a051a8a653b35d9eac2已普通push，无main合并/force/tag。包目录U:\CodexWork\2026-10-05\three-dragon-feedback-hotfix-release-062dd41，制备exit0，website-only、同域API，两目标各970编译文件、完整Git源码408blob/GPL。tar97110404字节，SHA256 `822de1d7651caa14ef3abea5dbaebdd0c0af629fbddd58bd986b7f7080bb8ecc`；源码ZIP `8c6b728764c827dd6ea81535f406936a5c89b223d6bb29ed5e9e0de375aabbe9`；server入口 `b16e8519210ceac218c335c8df5f82aea8a3e441965ea16e2843035f966a406a`；发布脚本与先前审过的7f606d1c相同。tar实际1943条普通文件（含manifest），1942条声明payload逐条核验；无额外/重复/软链/逃逸，源码每blob与Git核对。松散stage另有service.mjs，但打包工具明确排除，不在上传tar中。

独立checker从B只恢复本产品编译数量973→970、最终含ZIP/marker数量975→972，全部hash/源/属性/保护逻辑不变。首次漏恢复975，synthetic whitelist自测exit1，保留失败；补正确算术后首次完整检查exit0，1942记录/408blob、正例1/拒绝负漂移11通过。不是修改产品或门禁凑绿。实际部署后同checker传入本次before/after，remoteVerification=true/exit0，未将fixture当部署。

发布前fresh只读快照，其他relay PID相对旧取证变化、外部来源未证；fresh draft→正式before两次确认相同，不覆盖其他人的变化。scp上传仅tar与审核过脚本，远端checksum匹配。release-id `20261005-062dd41-website-feedback`，apply真实exit0、status applied，创建UTC2026-10-04T17:16:07.190979+00:00（中国10-05 01:16）。flock/私有SQLite备份/两次baseline检查/原子交换及health保持。回执`/var/backups/three-dragon-releases/20261005-062dd41-website-feedback/receipt.json`；静态回退`/var/www/obr-plugins/.three-dragon-releases/20261005-062dd41-website-feedback/rollback/`。密钥/数据库/玩家数据未下载或入库。

before SHA `ac79f7b40e3dea1449dc2785876ee8dcc01ec8811b8d3d3f4dc8c408455adb60`；after SHA `8123f8c3f0f0c298349a3447b7b49b0235295c238dcf1de5c68b8b8581534657`。实际远端逐项通过：两站各970编译SHA+1源码ZIP+1marker；保留缓存旧文件与属性dev486/stable31，目录属性各2；Suite-dev4952文件/47目录、Suite2112文件/17目录、card941文件、5个保护配置文件及2个保护服务状态全部同before。三龙牌server b16 SHA、0644/root/root/active；nginx PID543237/relay PID595452及其active monotonic均保全。不改nginx/systemd/.env，不重新发布其他插件。

证据均ignored `.local-evidence/feedback-hotfix/`：ci-062-job.log/ci-062-artifacts、package-independent.json、deployment-independent.json、before.json/after.json、release-prepare/remote-upload-verify/apply.log。gpt-6.1-sol/high独立实物复核源码/包/远端前后通过，无P1/P2，最终公网另验。

## 本机冻结与公网终验（进行中）

本机冻结新增15 helper首轮run-3Sv4AH在5PASS后editor等待失败，保留。只给一次fuvtt输入补真实既有按钮/忙状态ready前提，不重试按键、不改产品/原断言/期限；原33个assert/equal/pass/deadline语句保持。门槛条件与tracked controls在当前true/false dataset下等价，语法不是逐字相同。补前提后首次run-9sS8AD完整15/15 exit0、两视口、资源/脚本/外域[]，这仅为local-release，不作公网。helper SHA89e22fe50f7b2e0aef6c1f341324de62e2ef570bf228ae0e3457955630dfd2e0。

原公网工具真实12/12 exit0 run-tEhWap：stable1280/dev390通过HTTPS/WSS真实自建验收房，两前注/六出牌/三能力选择/一次可见权威结算，刷新、断线恢复、自动房主继任与离线名字恢复，所有人离开66秒房间解散；脚本/资源/外域/横溢出0。此原工具使用SwiftShader/reduced-motion，不作新FX性能证据，不作真实玩家/枭熊身份/实体手机UAT。证据`.local-evidence/live-website/run-tEhWap/result.json`，日志public-original-12.log。

公网权限8/8真实exit0 run-syrpWm/default GPU：自建房普通玩家私牌边界、隐藏入口正反授权、关闭/刷新/真实WS close撤权与普通操作恢复通过，脚本/外域[]。reported-hardware仅浏览器自报分类，不称物理GPU/FPS。ignored helper从已审B工具只调整import/root定位；证据`.local-evidence/website-omniscient-live/run-syrpWm/result.json`、public-permission-8.log。换模型独立实际复核这12/8证据成立。

新增公网首轮run-Lk5pwO实际exit1/2PASS：stable-desktop-concealed-ante，equal line15；该stage唯一equal为peer.view.game与peerBefore比较。helper等host前注确认、未等peer revision到齐，有取早基线机制，但原数据没有revision/ACK时间线，不能定因。resources含request-failed一项，也未查明，保留原失败。追加仅安全字段/revision和network type/error枚举诊断后run-5xgzPa真实exit1/5PASS，deck真实一次写入与全默认牌背已经通过，但revocation shortcut waitForFunction line43超时；实物host无newGame按钮、peer有，说明当前ownership已转移，尚未有生命周期时间线，不猜连接原因。该轮resources/errors/external[]。仅ignored helper有界诊断，未改等待/断言/产品，继续取证，不能报新增15或最终验收通过。

### 后续辅助验收失败与收束

run-FyuAJ7公网追加安全数字/布尔生命周期，实际exit1/5PASS，同revocation等待失败；peer在65804ms成为host，新host浏览器66047ms DOM加载/66194ms新socket，原host返回isHost=false。此轮没有reload-start，不能精确报刷新耗时或慢原因。resources只有host create阶段image/.webp/net::ERR_ABORTED，非HTTP错误；具体取消源仍未证，保留。诊断最多256事件，不含名字、URL、牌值、token或projection。

仅ignored helper增加`--native-network`受控模式：不启用route、使用正常缓存，但HTTP/WS外域观察和external[]原断言全部保留。已安装Playwright官方types 4467/10390行明确routing禁用HTTP cache；这是运行环境事实，不能单凭它证明原慢原因。run-ZIT8i0真实exit1：两个网站1280/390的14功能项全部PASS、两case completed=true、几何3项均0，整体completed=false。host两次reload-start→loaded7704/6903ms，本轮房主保持/手牌默认背/牌堆排列持久化与观战恢复均实际通过；末尾resources[]失败，2项watch .webp/net::ERR_ABORTED。未记录context-close-start，只支持窗口关闭取消资源的假设，不能把旧失败改为通过，也不称原cache-disabled场景已修。

下一次仅ignored helper恢复必要比较/生命周期前提：① host ante接受后等peer/watch到同revision再取peerBefore，原no-write比较仍在inspection前采基线；② 主页与各context关闭前按原默认期限等networkidle，不清空/过滤resources或ERR_ABORTED；③ 保留正常缓存与全部网络观察。源SHA `2c494762b301549405a3e5c389ef68ccbf17e4ef5d3e1067fcce089ea853d401`。换模型gpt-6.1-sol/high只读审核这些前提通过、无P1/P2/断言弱化，不能替实际运行验收。

run-HBvzNc真实公网/native exit1/6PASS：stable前6功能项（含真实刷新默认背与牌堆持久化）通过，watch-reconnect时显式重连显示requestTimeout、未连入；resources为watch image/.webp和fetch两次ERR_ABORTED，错误脚本/外域[]。这次是真实超时，原因未证，不事后筛掉/放宽期限/自动重试凑绿，也没有达到新增15。未修改产品/重新部署或真实玩家状态。

用户询问为何部署后处理了一天，已明确区分已上线0.9.3与辅助验收未通过，并停止重复全套browser。最新只读响应：公网health200 0.149067s、网站200 0.133440s；三龙牌active/MainPID596001/NRestarts0/ActiveEnterTimestampMonotonic9905733711334，loopback health200 0.000776s。仅证明此刻服务健康，不能倒推上次requestTimeout没有发生或根因已修。不回滚已经独立验证的发布，不捏造终验通过。

阶段交付：源码062/0.9.3实际已上线，CI29/包/远端保全与公网12/8成立；新增正常缓存两视口14功能实测成立但15整体尚未通过，所有失败保留。后续有新因果证据或真实用户复现再做定向修复，不连续跑相同全套测试。附件FX9/Linux性能仍未解决/未部署，实体手机和真实玩家UAT仍独立待。上述遗留同步TODO。

最终阶段独立裁决（gpt-6.1-sol/high，只读实物复核）：**有条件通过**。062/0.9.3已实际上线，可以交付当前发布状态；精确29CI/GPL包/部署保护与公网12/8成立。ZIT14功能过但整体资源失败、HB6后观战重连超时均未闭环，不能称新增15/最终全验通过；所有失败保留，附件FX9仍held。本轮收束留痕交付，不追加重型复验。
