# 2026-10-04 最新附件与特效预览（在办）

用户再次更新同名ZIP，要求按新包继续推进，并提供特效预览。该指令是当前授权；附带文档旧本地机器人/枭熊/停工历史/自动建goal不替代当前用户GOAL §10–11。

- UNC包73,900,068bytes、mtime2026-10-04 13:52:50，SHA256 3352e3bbd9a75f444295553626804868796d09eba682e5b9592758542ac18a7c。
- 固定本地副本U:/CodexWork/2026-10-04/three-dragon-updated-20261004-135250.zip，隔离安全解压到three-dragon-performance-snapshot-c3960047/three-dragon-ante；不读或解压.claude/私env/DB/evidence/hooks，Git使用最小安全config，read-tree HEAD只重建index后tracked干净。
- HEAD c39600472d4ab7858f7b43c3548ad975b5d98dbc，上一2afca326之后两提交：c3f67fc单渲染链/软件GL离屏探测/lazy three/sRGB/资源释放审计修复，c396004停工历史与总结。24文件增量；新附件自己的复审未终裁，不能以其历史测试或停止文字替代本会话实际验收/授权。
- 最新内部AI_CONTEXT按原顺序及fx3d交接/设计/perf读取核对。官方预览是TableScene的?fx3d=1&fx3dGallery=1或scripts，脚本截图工具在ignored.local-evidence未随ZIP交付；没有独立preview.html。直接启动附件index会恢复已删除的本地机器人，故正在用该快照实际FxStage/composeFx建立隔离可点击特效预览，4173在线网站保持，4174为拟预览端口，不建房/不修改规则或素材。
- git fetch origin核对d337588，之后仅本地fetch新ZIP对象到refs/tda-import/fx3d-20261004-c396。merge-tree只读预检发现10处内容冲突：MEMORY/TODO、FxStage/composeFx/kit/families、CoinStack/SeatBlock/TableScene、fxalignment工具；尚未整合或部署。需隔离合并保留当前网站/演出/权限/lifecycle改动和全部旧测例，独立审计后再freeze/CI。

遗留：特效本地网页启动+截图、两新commit隔离整合、冲突联合整改、完整CI/独立包审/定向发布与公网验收。持续性能与真实弱机/手机验证仍按TODO，不能冒称附件5→57数字复现。

## 本次后续核验：预览与隔离整合（最新状态）

前文是附件刚接收时的现场，不代表当前上线版本。实际组件画廊已运行于 `http://127.0.0.1:4174/?fx3d=1`，可选41家族；使用实际FxStage/composeFx/牌桌组件，不运行LocalMatch或连接服务。独立预览10/10，截图及结果在快照 `.local-evidence/fx-preview/`，本次根任务再次HTTPGET确认200及“特效预览”页面。它只代表本机预览，不能替代真实弱机/实体手机或线上牌局性能。

最新隔离目录 `U:/CodexWork/2026-10-04/three-dragon-integrated-refresh-c3960047`，分支 `integrate/fx3d-refresh-c3960047`，HEAD `c7b36be3dc5507d9a38edbc5fb090de7357a6cb7`，合并父815e37d1/801daf58，包含附件两新提交与已上线热修复。主工作目录仍是2c4771，不用ZIP或整合目录覆盖当前源。新候选未push、未部署；后续FX版本应与线上0.9.1区分。

- fetch origin与status核验完成，tracked干净；build含tsc及build:server exit0。
- 当前真实npm test为7/8，controller-selftest的公开旁观handCount断言收到6、预期5；此前Alice自身hand5断言通过。首次完整结果/日志保留在隔离目录 `.local-evidence/fx-integration-validation/run-KuUEel/`，不改计数或重跑凑通过。
- 仅Node认证超时正反专项5/5：`.local-evidence/website-auth-timeout/run-cI9vZW/`；该结果不能覆盖npm7/8。尚未运行此c7版本浏览器、完整CI、最终包审。
- 初步只读查证失败点是controller-selftest.entry.ts:56：前置until只等待Alice的pending/revision/hand，不等待watcher采用同revision。广播与异步解密存在接收时序差异，但旧失败没有watcher revision，不能直接冒称已确认为race；根任务授权仅ignored诊断及正反控制，不改tracked测试或生产。

遗留双落TODO：查证7/8根因并保留原断言；通过后再做实际single-rAF/冷启动桌形/context生命周期/软件GL合成性能与独立终审/冻结CI/发布。六人真实悬停拖拽长帧与实体设备体验继续单独验收，不宣称附件历史5→57已复现。网站0.9.1 bug热修复已经另包上线，记录 `2026-10-04_bug-hotfix-deploy.md`，不受该未上线FX候选状态替代。
