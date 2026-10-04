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
