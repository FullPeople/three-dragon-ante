# 2026-10-04 · 8bce 热修复反向合入 FX 候选

## 范围与状态

根任务授权在 `U:/CodexWork/2026-10-04/three-dragon-integrated-refresh-c3960047` 的 `integrate/fx3d-refresh-c3960047` 分支正常合并热修复，第一父 `810e8adac8ae7984952f78d21e752e9b8d01036c`，来源 `8bce32baa596f3be0e941eb1a3f758f234032a19`，共同祖先 `4f6fc6a7263237c48afbc55c75dce4b83d0fa1d2`。动手前fetch成功、工作树干净；仅本地commit，不push/ff根/部署。

本次时间点线上仍0.9.0，8bce热修复将由根任务在精确Linux CI `37184313948` 和包审通过后独立定向发布；不是完整FX候选发布。根任务需公网验收浏览器独占，因此本轮仅安装依赖、typecheck/build/buildserver和纯单元验证。4174组件预览10/10为根任务独立预览证据，不冒称本候选完整验证。

## 处理

- 5处冲突：workflow/package/Memory/TODO/WS机械selftest。workflow保留所有旧步骤（含FX lifecycle与性能结构），接受热修复把nameplate移到build之后；package保留FX/性能scripts，去掉两边重复的同名WS脚本；selftest接受Normal FIN完整应用frame字节数guard，不降低旧32断言；Memory/TODO按时间追加两边状态，保留全部历史失败指针。
- 新 SeatName 在估计缩小后用实际 scrollWidth/clientWidth 确认，最多8次二分保留能实际容纳的下界；12px可读底线和超长名title不变，现有coinTilt及c396处理保持。
- 热修复成熟发布工具、网站动画加载阶段安全诊断、铭牌测宽证据和静态浏览器夹具原样合入；35发布guards和原browser数量/阈值保留。不混入对规则/协议/服务端/卡图/legacy的任何更改。
- 旧失败 `site-presentation/run-kDCygD`（前5项、score页面加载超时）原因仍未证实；已排除0手牌（实际before 6/5），增加安全诊断后根原13断言通过，不把失败删除或视为成功。旧Linux姓名裁剪与CI37180749694 ws次数失败证据继续留痕，来源见 `2026-10-04_bug-hotfix-deploy.md` / `2026-10-04_presentation-feedback.md`。

## 本轮实际验证

本轮严格不运行Playwright/browser。依赖审计报告仅记录，不在当前范围运行audit fix或升级依赖。

| 命令/检查 | 实际结果 |
|---|---|
| `git fetch origin` | exit0 |
| `npm ci --ignore-scripts` | exit0，42包；报告2 moderate/3 high，未改依赖 |
| `npm ci --ignore-scripts --prefix server/three-dragon` | exit0，1包；报告1 high，未改依赖 |
| `npm run build` | exit0，包括tsc --noEmit零错误；283模块、构建34.83秒；three chunk 533.19kB触发500kB提示，保持lazy，不调整阈值 |
| `npm run build:server` | exit0，产物dist-server |
| 真实产物lazy分包检查 | index/table/launcher/background四HTML不静态引用three；真实three chunk存在 |
| `node tools/site-websocket-fixture-selftest.mjs` | exit0，32机械cases+fragment/parser；旧8次1006、新8次1008及完整应用frame断言通过；新证据`.local-evidence/site-websocket-fixture/run-eNQMKL/result.json` |
| `python tools/release-three-dragon-selftest.py` | exit0，35/35；仅本地合成目录/SQLite/mock exchange；证据`U:/CodexWork/2026-10-04/three-dragon-release-selftest/run-0k8dyekd/result.json` |
| `npm run test:page-route` | exit0，12/12 |
| `npm test` | exit0，全部8入口；其中实际 presentation 20/20，controller等原断言全保留；证据`.local-evidence/regression/results.json`及各原日志 |
| protected diff/hash、git diff --check、两动画工具node --check | exit0；game `b83a8f7e3e66b56b8d09c1896d446c7961f499ee`、server `39f5d2238d578cbc3fd194b989e754e48ec77529`、旧稳定模块 `a1bf4ab975cd1095643b548138ba5b6d30409449` 与810/8bce均完全一致 |
| 所有browser/Playwright专项 | 未执行；当前 root 公网验收独占 |

## 遗留（同步TODO）

浏览器释放后完成该合并源FX9（历史阴性控制/同tick真实render）、生命周期9、权限13、真实演出13、铭牌21、飞牌10及其他完整CI与换模型独立审计。热修复线上回执与公网验收由根任务继续，本分支不提前发布c396。

## 后续：55218ea 仅工具/CI增量（按时间追加）

根任务要求把最新热修复冻结 `55218ea673d388003bffa2ac554e033f048f35c0` 合入同一隔离分支。动手前 fetch 成功，第一父候选 `b37b3571bf2ba8ba4f37db2a7fbb45cdabd32124` 干净，共同祖先8bce；使用正常双父 merge、未force/推送/ff根/部署。

- 相对8bce仅5文件：workflow、package、bug-hotfix runbook、website-omniscient工具、新Node host-refresh-grace工具；生产src/server/legacy没有变更。相对本候选也无生产源码变化，现有c396/姓名/生命周期保护保持。
- 唯一冲突package：保留性能/Fx所有scripts，新增 `test:host-refresh-grace`，不恢复重复WS脚本键。CI把全能测试移至铭牌后并新增真实生产宽限3控制，原FX/lifecycle/perf/其它步骤不删。
- 接受来源工具的真实默认8000ms宽限、代次/fresh-view等待及有界64条公开时序；保留全部13断言及原20秒wait、500ms清私DOM、8秒receipt。新增Node控制覆盖4s/5s旧主失权、默认8s/5s保持、默认8s/9s失权和牌局/席位不变；不改变产品宽限。
- 保留来源的8bce CI37184313948刷新失败、b779 CI37184908911失败及本地gVAuZ1清DOM失败边界；来源报告aR45Bs默认13通过和KtRdUc Node3通过是根任务对应源证据，不称本候选亲跑。认证到达与view接收时间继续区分，不由延迟猜字体/GL原因。
- 本轮实际仅两个工具 `node --check`、package JSON与脚本合同校验、`git diff --check` 和生产/保护路径0diff；未重新build或跑测试。前节b37构建/纯回归通过仍是其历史证据，不冒称552增量完成浏览器验收。
- 当前热修复发布状态以根任务回执为准，完整FX候选未发布；根公网热修复完成前浏览器仍独占。本增量不作为热修复的阻塞依赖。

## 后续：801daf5 认证超时的最小生产修复（按时间追加）

根任务明确授权将最新热修复冻结 `801daf580e9505a377dc97a544c4ad051ea029ac` 正常合入隔离FX候选。第一父 `815e37d1cedf70019e8d4db425856d17b66395a1`，共同祖先55218ea；fetch成功、起始工作树干净，未push/ff根/部署或启动浏览器。

- 来源相对552为7文件：唯一产品变化是 `src/game/server-client.ts` 的 pre-auth `1008` 判定，只有 reason **精确**等于 `authenticationRequired` 的服务认证截止超时使用既有自动backoff；4001、notAllowed和未知1008仍原终态，stop仍取消backoff。不改服务5000ms截止、8000ms房主宽限、规则或协议字段。
- 2处冲突workflow/TODO：保留全部FX/lifecycle/performance与旧专项，接受演出测试前移、新Node5控制，去掉重复演出step；TODO按时间保留失败与合入进度。package自动合入新script，当前版本仍0.9.1-dev，未擅自改版本。
- 新5控制采用实际编译客户端/真实loopback WS/合成RAM服务，首个auth的故障注入不送达，用不变的真实5秒服务截止触发1008；同时保留有效重连、真实无效凭据、未知1008、4001、stop-during-backoff正反例。此工具仅语法查证，未在本候选执行；根对应源运行结果按bug-hotfix-deploy记录，不冒称本轮亲跑。
- site-presentation诊断仅有界事件/公开头部元数据、auth-send布尔与allowlist close/status；原13测例、30秒等待和时序/私牌断言保留，native write/send调用透传。根Windows曾在同次真实1008后恢复并完成原13项，是根热修复证据，不替代该FX源浏览器回归。
- 整个game树现在预期为 `29e44782845b76df380ff9565fa825bc7e60e23d`，相对801完全一致；相对第一父仅server-client这一个文件。规则/protocol/wire/private-channel/art/legacy/server都无变更：server仍 `39f5d2238d578cbc3fd194b989e754e48ec77529`，legacy仍 `a1bf4ab975cd1095643b548138ba5b6d30409449`。presentation/site相对第一父0diff，最新c396/namefitter/flight/演出/lifecycle保护保持。
- 本轮实际验证：两新增/变更工具 `node --check`、`npm run typecheck`（tsc --noEmit零错误）、package script/CI去重合同及 `git diff --check` 通过；未build、未执行Node5或其它单元、未跑任何Playwright/browser。旧552/e347及更早失败证据原样保留。
- 去重临时检查首次命令多一个引号而SyntaxError（未执行检查、未改源码），修正命令后实际exit0；不将此命令错误误归产品或藏作首次通过。
- 后续FX应与独立热修复0.9.1区分版本，暂建议0.9.2-dev作为候选；真正改版本/构建发布元数据由根任务在FX完整回归与审计完成后决定。版本遗留同步TODO，完整FX仍未发布，公网热修复继续由根任务独占。


## 合入701线上留痕与正式公网工具（2026-10-04 后续）

根任务先fetch后合入701bc29804d093305e3353df607e5861b162f910，保留e8cf0e5/5506116/34f609e/01e5a23全部候选产品和测试。MEMORY/TODO两处文档冲突保留双方历史并补当前状态；README/GOAL/INDEX、801部署runbook和正式公网工具正常合入。本次不修改生产源码、版本、原断言、线上入口或服务器。新版公网工具真实default8/8在hotfix隔离仓库run-y3SPEy完成，不冒称FX候选已公网验收；所有当前候选验证见ambient/network/pending runbooks。尚待完整精确CI、生产参数/3D联网、版本区分、独立终审与定向发布，双落TODO。
