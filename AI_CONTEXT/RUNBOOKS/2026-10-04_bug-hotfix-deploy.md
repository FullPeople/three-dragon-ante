# 2026-10-04 网站 bug 热修复发布（0.9.1）

## 用户授权、范围与基线

用户要求“把目前正确修复的部分先部署吧特别是bug”，继续沿用持续修复、push、部署授权；本轮只发布独立网站 `/three-dragon-ante/`、`/three-dragon-ante-dev/` 及必要的三龙牌权威服务。枭熊与 Suite 目前已是网站链接，链接目标未变，不重新部署这些插件。main 不合并、不 force-push、不给 tag；保留 nginx、systemd unit、relay、card、旧稳定频道、卡图、规则与协议。

发布准备前 git fetch origin 成功，远端 rebuild/presentation 为 d337588。当前线上两个独立网站为 0.9.0 / 0.9.0-dev，冻结源 7555f99e05a2853f495422d5b3c0f62a1a74c990；本机新版特效整合不是已上线版本。

热修复在隔离 worktree `U:/CodexWork/2026-10-04/three-dragon-feedback-hotfix-4f6fc6a`、分支 `release/feedback-hotfix-20261004` 从反馈产品检查点 4f6fc6a7263237c48afbc55c75dce4b83d0fa1d2 建立。它含买牌说明先后、本家 view/ack 演出、飞牌覆盖、铭牌与隐藏全能；追加本节实际Linux CI查证的姓名缩放后实测收敛修复。**不包含附件 2afca326 的 P2–P5 特效/性能改动或 c3960047 新修订**，不会因附件整合尚未回归而拖延这些 bug 的发布。相对线上基线，rules/protocol/wire/private-channel/art/旧稳定频道/fx3d 目录零差异，TableScene 仅飞牌层接缝。

## 验证工具与证据修正

移植当前主工作区已经独立复核的验证工具，产品逻辑仍保持 4f6fc6a：

- 铭牌和飞牌夹具改为编译真实组件后静态 HTTP 托管，保留全部原断言和超时。主工作区 Vite dev 模块曾在浏览器打开后挂起，底层原因未确定；历史失败不计通过。
- 本地联机测试代理采用 `destroySoon()` 等待已排队的 WebSocket close 字节写完；error/RST 仍立即断开。控制实验原 helper 在人为排队延迟时 8/8 得到 1006，新 helper 8/8 得到服务器的 1008；32 项涵盖正常结束、大 payload、RST、浏览器中断和资源清理。历史 Linux CI 的多一次重连不能直接声称已由该实验完整复现，必须等本轮实际 Linux CI。
- WebSocket 诊断仅保留连接号、时间和有界控制帧头/关闭码，跳过所有应用 payload；证据不写房间码、凭据、手牌或玩家投影。
- CI fetch-depth=0 供真实 git show 阴性对照；上传被明确忽略的 evidence 目录中的 JSON/PNG/log。新官网隐藏全能线上测试只创建本次自己的合成房间，不读数据库。

Windows Node 22.17.1，使用已装 Edge。所有命令在隔离仓库根目录。依赖安装两个命令均 exit 0；原 lockfile 未升级。顺序构建/回归日志与命令回执：`.local-evidence/hotfix-validation-20261004/`。最终真实计数待追加，不减少断言凑数。

### 本地命令真实结果

| 命令 | 结果 |
|---|---|
| npm ci --ignore-scripts | exit 0 |
| npm ci --ignore-scripts --prefix server/three-dragon | exit 0 |
| npm run build | exit 0，含 tsc --noEmit 0 错误 |
| npm run build:server | exit 0 |
| npm test / npm run test:server | 8/8、2/2 |
| test:guest-server / test:empty-room / test:page-route | 15/15、9/9、12/12 |
| test:browser / node tools/site-entry-browser.mjs / test:server-browser | 15/15、16/16、4/4 |
| test:site-websocket-fixture / test:site-multiplayer | 32/32、22/22 |
| test:fx3d / test:website-omniscient | 4/4、13/13 |
| test:nameplate / test:flight-layer | 21/21、10/10 |
| test:site-presentation | 首次5项后加载超时失败；补诊断后的原13/13通过 |
| python tools/release-three-dragon-selftest.py | 35/35（原24全部保留） |
| git diff --check / node --check | exit 0 |

该版本网站按钮测试15项是删除本地机器人后当前范围，历史接手20项已在环境接手runbook记录，不能混用。当前热修复FX只含线上已有地基，因此相机4项；新的P2–P5生命周期/性能测试不适用本次未包含的产品，不冒称已验收完整特效。

本轮关键证据：联机 `.local-evidence/site-multiplayer-Uln7bE`，全能 `website-omniscient/run-IASsgn`，铭牌 `nameplate/run-nCXrFI`，飞牌 `flight-layer/run-iNxcvt`。独立审计补充要求正常FIN亦验证应用frame完整字节，新增`messageBytes===bytes`加强断言后重新32/32，`site-websocket-fixture/run-CAIami`。发布夹具35/35在 `U:/CodexWork/2026-10-04/three-dragon-release-selftest/run-gehvuxfo/result.json`，原子交换/owner为跨平台mock，仍需真实Linux部署复核。

网络演出首次 `site-presentation/run-kDCygD` 在score-website-load超时，5项已通过；第二页面是lobby，零脚本/外域错。直接用本次生成的原规则模块复算原score fixture：seed1、双方6/5张手牌，状态合法，排除无手牌假说。仅添加有界加载步骤/关闭时间/权威帧计数诊断，无产品、断言、阈值变化；完整复测 `site-presentation/run-tZq0H9` 原13项全过：两页说明→价牌1807/1810ms，价牌→翻面280/285ms，翻面→补牌1257/1263ms。首次超时具体原因仍未证实，保留失败JSON/log，未将该失败冒称通过或归因于网络/软件GL。最终Linux CI和实际公网另验。

gpt-6.1-sol最初只读产品与发布工具增量审计通过：当时产品相对4f6fc6a零增量、静态组件原断言保留、双网站目标/未选Suite保护/历史receipt兼容与不回退DB成立。并发Suite漂移时自动恢复亦拒绝并保留preparing/partial switched receipt，不能写作“已自动回滚”。

### Linux铭牌失败及产品整改

首次冻结70e7aced4c385f7ee4c5b846ef45e12b5b00a647正常push隔离release分支，真实双渠道构建包tar SHA `ef8b1a6cca0d3921858076411f0c10b8b8e089e61a6569805f6384a5df82a789`、源码ZIP393文件与git archive完全一致、tar1943条目全部SHA通过独立审计。仅上传服务器暂存目录，**没有apply**：精确head CI37183650315在nameplate原“正常长名字不能裁切”断言失败，run-qN7U2f/failure.json原工具测量在assert后所以为空；该冻结包不得部署。

诊断提交d7fdc89760b4b8c71869a5a0215884734fa7fea3只把公开测量移到assert前并在CI较早运行原nameplate，保留全部原测试。CI37184050832实际再次复现：desktop2 Chinese font14.75/clipped=true、English15.0652/clipped=true、金币仍完整且所有资源/脚本/外域失败0；证据 `.local-evidence/ci-37184050832-artifact/nameplate/`。确认按原比例计算的候选字号缩小后仍不满足实际scrollWidth<=clientWidth；不猜“字体没加载”或声称证明某底层1px机制。

生产只改SeatName：保留原比例候选、字号12–18和生命周期；缩放后测实际宽度，若仍溢出则在能容纳的12px下界与候选之间做最多8次二分，每次读取实际宽度并保持一个已实测能容纳的lower，最终采用该lower；12px仍不够的极长名继续省略但保留完整DOM/title。无CSS布局、资金数字、材质、计时器或其他产品改动。tool只补实际内外client/scroll宽度、CSS小数宽度和字体状态，原21严格断言不放宽。Windows实际21/21，`nameplate/run-qnHo1c`；最终新head Linux CI/新包/复审须再单独通过。

该整改本地再跑build含typecheck exit0、npm test8/8；日志build-measured-fit/rules-measured-fit。gpt-6.1-sol独立复核通过：已实测可容纳的lower保证退出采用合格尺寸、不依赖严格线性；RO观测固定高度/宽度outer不会因inner字号缩小而自循环；字体ready/observer/listener/alive清理保持。最终冻结包与精确新head完整Linux CI仍为发布门槛。

## 仅网站发布与回滚

发布准备新增显式 `--website-only`，和 `--overlay` 互斥。manifest 必须声明 `scope=website-only`，只可选择两个独立网站目标且 `hostOverlay=null`；缺 scope 的历史包/回执仍按原四目标处理，不能用省略字段绕过目标限制。

上线前仍捕获四目标及保护文件完整 fresh baseline；仅为两个独立网站备份、暂存、切换和验证。未选择的 Suite stable/dev 在切换前后、回滚和中断恢复时核验完整树 SHA、mode、uid、gid；漂移即停止，不能覆盖他人部署。服务 bundle 需要更新以实现当前网站房主主动启用全能的授权；沿用原同域 API、WSS、端口、unit 与 nginx，不改 .env。

回滚只恢复两个网站和服务 bundle，保留 live SQLite。SQLite 备份只在服务器 root 私有目录，绝不下载或入库。最终包必须绑定冻结提交、GPL 对应源码归档和文件 SHA，完整 CI、换模型只读审计、fresh baseline 和公网验收分别留证。

## 当前状态与遗留

本节发布准备时线上仍为 0.9.0；**尚未 apply**。完整回归、最终冻结包审计、CI 和实际公网验收完成后追加真实回执。遗留同步 TODO：附件 c3960047 的完整特效整合/单 rAF 阴性对照/冷启动桌形、实体手机与弱设备测试；它们不属于这次 bug 热修复发布。

特效预览独立运行于 `http://127.0.0.1:4174/?fx3d=1`，使用最新 c3960047 的实际 FxStage/41 家族组件，不创建牌局、连接服务或使用本地机器人宿主。预览 10/10，截图、零失败资源/外部请求记录在隔离快照 `.local-evidence/fx-preview/`；这是本机特效预览，不能算生产牌局性能验收。
