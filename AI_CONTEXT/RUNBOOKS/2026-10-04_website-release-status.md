# 2026-10-04 — 网站热修复已上线，后续特效发布停止

## 当前可用入口与范围

正式网站 https://obr.dnd.center/three-dragon-ante/ 与 dev 网站 /three-dragon-ante-dev/ 当前均为0.9.1(-dev)，冻结源801daf580e9505a377dc97a544c4ad051ea029ac，2026-10-04 16:07:25（Asia/Shanghai）已实际发布。精确CI37187336604完整成功，独立源码/包/部署before-after核验通过，一般公网12/12、默认GPU隐藏权限8/8（正式CLI run-y3SPEy）真实通过。只更新两个网站与必要权威服务，Suite/枭熊维持线上网站链接，不重发其他插件；既有服务端继续承担多人连接。nginx/unit/relay/card与未选择目标内容、属性保留，回滚指针同日bug-hotfix-deploy runbook。未合并main、不force/tag。

已上线热修复包含购买提示先于翻牌补牌、本家回执保留能力/回合/结算演出、飞牌覆盖、长名及财务铭牌测宽、材质区分、隐藏fuvtt加回车及连接恢复等用户反馈；本地对战已删除，纯在线网站使用名字与房间码/邀请进入和重连，名字重复拒绝。公网检查覆盖帮助/音效/语言/新局与离局取消、私牌、刷新、WSS实际关闭恢复、自动交接、离线名字恢复及空房宽限后解散。仅隔离自建合成房间，未读生产SQL或保存玩家投影/密钥。

## 最新附件候选及真实修复

完整附件c396历史保留于独立integrate/fx3d-refresh-c3960047分支。冻结042e446曾完整CI37194506711成功并经973文件/GPL432blob审查，但真实合法待选择能力点击画质后驻留丢失run-39HGpC，独立审计裁决不通过而未部署。

c1752f75仅presenter/mount接回仍有效hold到新FX，旧owner清理与当前/显示同局choice门闩，不重播事件/音效/队列。最终冻结d580cc2a1236b7bddbc2e2a53c0928ac78e49203已正常推送独立分支。首次hold-only6/6（run-lxbozm）与完整真实生产参数14/14（run-qqkx56）通过，六产品文件前后SHA相同、错误/外域/资源失败0。真实hold rate3/life2、druid5/4、priest3/3.5分别有实际POINTS和ground非透明像素改变，双上下文loss实际2D阳性与restore真实3D阳性；第二次dual loss实际2D阳性后按生产寿命派生3500/6100/5450ms加450观察清尾全0且hidden。null为真实composition路由API控制，不冒称真正选择结算/音效或实体设备UAT。详见同日power-hold-fx-rebuild、fx3d-ambient-network-validation runbooks（当前整合工作区）。

## 新CI失败，发布停止

https://github.com/FullPeople/three-dragon-ante/actions/runs/37196321804 对应精确d580，结论failure。第27步骤npm run test:fx3d仅桌面camera0.009px阳性后失败：

    AssertionError [ERR_ASSERTION]: desktop: effects canvases never intercept pointer hits on cards
    at tools/fx3d-alignment-check.mjs:78:12
    actual: false, expected: true

真实表达式为res.airShown && res.hitIsCard；原日志未保留两个boolean或命中元素，所以不能断定canvas拦截、不能编造根因或称偶发。源码三特效canvas pointer-events:none，舞台空闲可正常隐藏；debug路径确实异步注册驻留markers，但原工具只等stage发布，未记录markers注册完成、入场稳定或命中几何。这些只是待检候选，并非已证实此次失败原语。后续flight/lifecycle/ambient历史/current/producer/performance-structure六CI步骤skipped，不能把本地专项或旧042完整CI代替本head完整CI。按用户原要求少了停下汇报，未改测试/断言/期限凑数、未盲目重跑CI、未上传/部署候选。线上继续801/0.9.1，发布终裁不通过。

冻结包仍完成本地准备作为检查点：U:/CodexWork/2026-10-04/three-dragon-fx-release-d580cc2，tar97282313字节SHA96ab78eafb20f979fb937d3f52ed05cd32eaa0daccbb0d742c3fb149aa330e7d；源码ZIP434 Git blob SHA8b295c1ac97dbcb1cc9f2cff78724dc234c8d75dc6c948085b2456c08b3e0ddb。独立checker先实际walk两目标各973再逐名称/SHA/size匹配，tar1948记录/434blob原OID、1阳性+11阴性真实通过；原checker只RAM970/972适配973/975且磁盘未改。包审核通过不等于CI或部署通过，server与部署脚本逐字同801。ignored结果independent-package-d580cc2.json明确ciAccepted/deploymentAccepted/remoteVerification均false；CI完整JSON及失败log在整合工作区.local-evidence/fx-release/。本轮SSH只读inspect exit0，服务active SHA f9627642…88c3d，所有目标快照仍与801部署后相同；未进行任何新的远端部署。

## 性能遗留与继续入口

真实完整六座软件GL四模块受控对照run-MWt1Sc（d580，5结构checks/18原始rAF样本）：FPS中位数idle43→60、hover3.36→9.42、drag3.11→22.50；p95空闲16.8ms相同、hover366.7ms相同、drag333.4→333.2ms。交互长帧仍存在，不称全面流畅，不沿用原附件5→56报告；共享fx3d=0、软件WebGL2桌面材质和合法fixture，仅部件对照，不是整版/联网/3D或实体弱机UAT。

遗留双落TODO：先仅安全诊断CI合取两boolean与真实命中/活动效果/入场状态，保留全部原断言与期限；根因证实后处理并重新完整精确CI/独立终审，再新冻结定向发布和公网验收。软件交互长帧归因与实体弱机/手机体验单列。本轮实际source/工具/包与修复边界已由gpt-6.1-sol独立审核，最终发布拒绝源自新CI失败；实质改动后仍提醒用户按AI_CONTEXT/AUDIT.md换模型独立复核。持续目标未完成，未自行暂停或标记blocked。
