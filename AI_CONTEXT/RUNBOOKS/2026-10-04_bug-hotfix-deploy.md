# 2026-10-04 网站 bug 热修复发布（0.9.1）

## 用户授权、范围与基线

用户要求“把目前正确修复的部分先部署吧特别是bug”，继续沿用持续修复、push、部署授权；本轮只发布独立网站 `/three-dragon-ante/`、`/three-dragon-ante-dev/` 及必要的三龙牌权威服务。枭熊与 Suite 目前已是网站链接，链接目标未变，不重新部署这些插件。main 不合并、不 force-push、不给 tag；保留 nginx、systemd unit、relay、card、旧稳定频道、卡图、规则与协议。

发布准备前 git fetch origin 成功，远端 rebuild/presentation 为 d337588。热修复准备时两个独立网站为 0.9.0 / 0.9.0-dev，冻结源 7555f99e05a2853f495422d5b3c0f62a1a74c990；后续正式上线回执见下节，本机新版特效整合不是已上线版本。

热修复在隔离 worktree `U:/CodexWork/2026-10-04/three-dragon-feedback-hotfix-4f6fc6a`、分支 `release/feedback-hotfix-20261004` 从反馈产品检查点 4f6fc6a7263237c48afbc55c75dce4b83d0fa1d2 建立。它含买牌说明先后、本家 view/ack 演出、飞牌覆盖、铭牌与隐藏全能；追加本节实际Linux CI查证的姓名缩放后实测收敛修复。**不包含附件 2afca326 的 P2–P5 特效/性能改动或 c3960047 新修订**，不会因附件整合尚未回归而拖延这些 bug 的发布。相对线上基线，rules/protocol/wire/private-channel/art/旧稳定频道/fx3d 目录零差异，TableScene 仅飞牌层接缝。

## 验证工具与证据修正

移植当前主工作区已经独立复核的验证工具，产品逻辑仍保持 4f6fc6a：

- 铭牌和飞牌夹具改为编译真实组件后静态 HTTP 托管，保留全部原断言和超时。主工作区 Vite dev 模块曾在浏览器打开后挂起，底层原因未确定；历史失败不计通过。
- 本地联机测试代理采用 `destroySoon()` 等待已排队的 WebSocket close 字节写完；error/RST 仍立即断开。控制实验原 helper 在人为排队延迟时 8/8 得到 1006，新 helper 8/8 得到服务器的 1008；32 项涵盖正常结束、大 payload、RST、浏览器中断和资源清理。历史 Linux CI 的多一次重连不能直接声称已由该实验完整复现，必须等本轮实际 Linux CI。
- WebSocket 诊断仅保留连接号、时间和有界控制帧头/关闭码，跳过所有应用 payload；证据不写房间码、凭据、手牌或玩家投影。
- CI fetch-depth=0 供真实 git show 阴性对照；上传被明确忽略的 evidence 目录中的 JSON/PNG/log。新官网隐藏全能线上测试只创建本次自己的合成房间，不读数据库。

Windows Node 22.17.1，使用已装 Edge。所有命令在隔离仓库根目录。依赖安装两个命令均 exit 0；原 lockfile 未升级。顺序构建/回归日志与命令回执：`.local-evidence/hotfix-validation-20261004/`。本地真实计数见下表，最终冻结的完整 Linux CI 与上线证据另列，不减少断言凑数。

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

### 刷新身份失败与测试范围查证

新产品冻结8bce32baa596f3be0e941eb1a3f758f234032a19的CI37184313948铭牌/联机/fx均实际通过，但全能测试5项后在刷新isHost===true断言失败，后面的飞牌/演出未执行；仍未apply。该13项测试人为hostGraceMs=4000，真实服务默认8000；服务端代码不变。补测试连接generation和fresh-view等待、最多64条安全TCP/权威帧时间及20ms合成自身房间ownership布尔采样，原断言/20秒wait/500ms清私DOM/8秒receipt保持。诊断head b77922b011c1aa6ac473e44fb8b6862c8604a65e的CI37184908911实际再失败，`.local-evidence/ci-37184908911-artifact/website-omniscient/run-*/result.json`：旧hostTCPclose1791097797792、重连upgrade+2798ms、ownerChanged+4013ms、fresh authorityview+8594ms。**view接收时间不是auth到达时间**，不把8594ms当实际服务器认证延迟，不由本记录反推先前8bce每个失败的具体根因。

独立gpt-6.1-sol纯Node真实服务控制3/3：4s宽限/5s断线后重连旧主false，默认8s/5s仍true，默认8s/9s旧主false；三例牌局hash和2席保持、重连全能关闭。正式工具 `tools/website-refresh-grace-selftest.mjs`保留所有控制断言并接CI，`.local-evidence/host-refresh-grace/run-KtRdUc/result.json`实际gap5028/5031/9018ms；不把控制实验冒称真实浏览器复现。

网站13项测试移除非生产4s override，使用真实默认8s；不改生产宽限、不扩大任何浏览器wait或500ms/8s私牌断言，且另保留4s5s必交接/default8s9s必交接的负控制。新增首客户端TCP data时间用于区分认证到达与页面帧处理。旧4s诊断本地run-gVAuZ1在刷新成功后500ms清DOM时间断言失败，保留原结果不包装通过；真实默认8s完整原13/13通过run-aR45Bs，任何未证实的延迟原因不归为字体/软件GL或“只夹具”。新精确head完整Linux CI和最终包审计仍必须另过。

## 仅网站发布与回滚

### 查证认证期限与最小客户端修复

诊断冻结e347a24a09870b492d49d10b1202965a7ef3179a的Linux CI37186698214在演出0项失败，和本地诊断`site-presentation/run-PyVfBO`均实证第二连接因`1008/authenticationRequired`关闭：Linux upgrade1791099971115→服务端close+5014ms→浏览器open/auth-send+7001ms；本地对应+5039ms/+6074ms，全部view计数0。服务端5000ms期限有效，browser发送认证已晚于服务端关闭；**具体浏览器/GL函数耗时尚无profile证据**，不归因为某个shader或软件GL底层函数。这不能反推旧552及score首次的每次关闭原因。

生产仅改ServerTableClient一条终态条件：精确的1008/authenticationRequired走已有500至8000ms退避；notAllowed、未知1008与4001仍终止，stop仍清timer。服务端认证期限、规则/协议/投影、名字、房间、私牌、pending命令id与幂等逻辑不变；新socket仍须真实认证及full view，不能凭close reason授予连接或权限。

本地原非reduced演出13/13实际通过`site-presentation/run-SCGmQg`：连接2仍在upgrade后5037ms被1008关闭，随后连接3真实upgrade/fullview恢复，全部原能力/回合/结算/买牌检查完成；说明→价牌1804/1806ms，翻面→补牌1249/1297ms，错误/外域0。这是同次超时后的真实恢复，非无故障偶然复跑。新增纯Node真实客户端/WS正反控制另验，最终精确head完整CI、打包、独立终审和公网仍为门槛。

纯Node编译真实ServerTableClient与RAM权威服务专项5/5：`website-auth-timeout/run-cKMHDH`，首auth仅在测试Socket适配层故障注入丢弃，实际原服务默认5秒deadline发出1008，第二真实认证5529ms/fullview5541ms恢复原房主与live game；此前显式inspection不复开，无command自动发送（用户显式sync一次另验）。真实坏凭据notAllowed、unknown1008、4001、stop在退避中都保持1attempt且断连；后三项为真实WS关闭控制，非真实auth5秒复现。Node证据不冒称浏览器验收。工具finally的1006是主动terminate清理，不是恢复失败。新脚本接入CI，原全部检查仍保留。追加build含tsc exit0、npm原8/8；gpt-6.1-sol独立最小条件边界审核通过，最终冻结发布仍单独核验。

### 55218ea 两次 Linux 演出连接失败

冻结55218ea673d388003bffa2ac554e033f048f35c0的CI37185442912两次完整attempt均失败，除最后site-presentation外全部原检查通过。attempt1 run-WxGoJy与attempt2 run-XhRZFl均0项：第一合成浏览器ready/play且1游戏view，第二page.goto已返回，但在等网站connected UI超时，尚未进入手牌等待；第二游戏帧计数0、一次WebSocket close、初始lobby，无脚本/外域错误。不能称导航超时、不能由0游戏帧计数断言全部view为0；旧工具未记录close码与认证发送时刻，认证超时/拒绝的原因未证实。两次失败分别保存在`.local-evidence/ci-37185442912-artifact/`与`ci-37185442912-attempt2-artifact/`，没有把失败或未执行的13项算通过。

该包tar SHA f944b8c3493aa9bb90338619d069bd85a0e6550e8fe944a5b1f3502d161526ee仅上传暂存，**未apply、不得部署**。两次换模型包核验通过不能替代CI门槛。下一步仅补有界公开WS/TCP认证/close/view诊断，把原13项演出检查提前执行以更早取得失败证据；不改生产认证定时器、默认宽限、规则/私牌或等待/断言阈值，不继续无诊断盲重跑。取得完整成功的新冻结head后须重新打源码包和核验部署前基线。

发布准备新增显式 `--website-only`，和 `--overlay` 互斥。manifest 必须声明 `scope=website-only`，只可选择两个独立网站目标且 `hostOverlay=null`；缺 scope 的历史包/回执仍按原四目标处理，不能用省略字段绕过目标限制。

上线前仍捕获四目标及保护文件完整 fresh baseline；仅为两个独立网站备份、暂存、切换和验证。未选择的 Suite stable/dev 在切换前后、回滚和中断恢复时核验完整树 SHA、mode、uid、gid；漂移即停止，不能覆盖他人部署。服务 bundle 需要更新以实现当前网站房主主动启用全能的授权；沿用原同域 API、WSS、端口、unit 与 nginx，不改 .env。

回滚只恢复两个网站和服务 bundle，保留 live SQLite。SQLite 备份只在服务器 root 私有目录，绝不下载或入库。最终包必须绑定冻结提交、GPL 对应源码归档和文件 SHA，完整 CI、换模型只读审计、fresh baseline 和公网验收分别留证。

## 801daf5 正式上线回执（2026-10-04）

最终冻结源 `801daf580e9505a377dc97a544c4ad051ea029ac`。精确 head 的 [GitHub CI 37187336604](https://github.com/FullPeople/three-dragon-ante/actions/runs/37187336604) completed/success，verify 全部 30 个步骤成功，含原演出13、网站联机22、全能13、铭牌21、飞牌10、认证超时正反5、刷新宽限3、发布守卫35等完整原检查；没有跳过、减少或放宽失败断言。独立代理实读 GitHub 状态、最小生产增量与专项证据后裁定可执行仅网站事务。CI metadata/log 位于 `.local-evidence/hotfix-deploy/ci-801daf5.json`、`ci-801daf5.log`。

| 冻结产物 | 真实值 |
|---|---|
| 包目录 | `U:/CodexWork/2026-10-04/three-dragon-bug-hotfix-release-801daf5/` |
| tar SHA256 / 大小 | `30473af86457478c1b8f89811895ee23816f98999f66a51ed391892d7d21a823` / 97023876 bytes |
| GPL 源码 ZIP | `three-dragon-source-801daf580e95.zip`，395 个完整 Git 源文件 |
| 源码 ZIP SHA256 | `ad433d38d059edacbba92fd260509a80b49484b4e3f4a2d5fc0b84665d8bd361` |
| 冻结部署脚本 SHA256 | `7f606d1cdec8191d76ee9a16ae3c18385447c248a9e652ed072efe5b1744829d` |
| 服务 bundle SHA256 | `f962764212aa4334639b6fa991706aecd5ec3ac2cb6782fd6a2389895dc88c3d` |

真实 release-preparation exit0。独立本地检查器核验1942个 tar载荷条目（另有 manifest）、395个源码 ZIP Git blob及GPL文本全部匹配；合成检查器正例1和拒绝漂移反例11全部通过。证据 `.local-evidence/hotfix-deploy/checker-801daf5-package.json`；静态目标只包含两个网站，未带 Suite overlay、新附件特效或私有数据。

服务器事务 `20261004-801daf5-bug-hotfix` 于 **2026-10-04 16:07:25（Asia/Shanghai）** 完成，远端安全 receipt 的 finishedUTC 为 `2026-10-04T08:07:25.472396+00:00`，status=applied、scope=website-only，两目标 switched=true、serverInstalled=true。证据 `.local-evidence/hotfix-deploy/server-receipt-summary-801daf5.json`。这是实际远端回执及部署后核验结果，不是从本地 SSH 退出推定成功。

原 apply SSH 本机等待进程一直未回传完整结果，stdout `.local-evidence/hotfix-deploy/apply-801daf5.json` 仅1字节，stderr保留；确认远端 apply 已无运行进程后，仅终止本机等待 PID16244，**本地等待会话 exit -1，不能写作 apply exit0**。未重复 apply；该 SSH transport 未正常返回的具体原因未知。实际成功由独立读取的远端 applied receipt、fresh after 和逐文件校验交叉确认。

独立代理使用真实 `.local-evidence/hotfix-deploy/fresh-baseline-801daf5.json` 与 `after-801daf5.json`，检查器 exit0、completed=true、remoteVerification=true：

- stable/dev 每个目标970个构建文件、1份对应源码 ZIP、1份生成的发布 JSON SHA全部匹配，共1944个目标文件。dev总树1452→1455，stable997→1000；白名单外dev483、stable28个旧文件的 SHA/mode/uid/gid及各2个既有目录属性不变，未增加目录。
- 未选择的 Suite-dev4797文件/47目录、Suite stable2112文件/17目录整树内容与属性全等；card869文件、nginx/unit/relay等5个保护文件及2个保护服务状态不变。
- 三龙牌服务实际为表中 `f9627642...`，active=true，原0644、uid/gid=0保留；原服务SHA `acf4a5191bddae59cfae52f4cc185b01fb719caf52a6f9a600011853b3d8e56e`仅由本轮必要bundle替换。沿用原端口、API/WSS、unit/nginx与配置；不覆盖live SQLite。

完整证据 `.local-evidence/hotfix-deploy/checker-801daf5-deployed.json`，before JSON SHA `fe805fcb231b279b338569b542f902244d7e5caa14f3e17f77ee31edc0dece05`，after SHA `63b30086de5e564a4c3275420d60d2ecc59fc0eb9b6b99f6c088df141779919f`。公网独立读取的 stable/dev manifest 和 release JSON均HTTP200，版本分别0.9.1/0.9.1-dev、source均801daf5、API均同源 `/three-dragon-api/v1`，见 `public-metadata-801daf5.json`。

### 公网一般流程12项与隐藏权限专项分开记录

实际公网一般流程 **12/12**，证据 `.local-evidence/live-website/run-LbkWkp/result.json` 和 `.local-evidence/hotfix-deploy/live-website-801daf5.log`：桌面与390px两个独立浏览器在本次自建合成房间，经真实HTTPS/WSS完成2次前注、6次出牌、4次能力选择、2次可见结算；帮助/音效/语言、退出/新局二次确认、重名拒绝、刷新恢复、断线重连、自动房主交接、旧名字离线恢复与最后离开后的空房到期解散通过。脚本错误、失败资源、外部请求均0，59个私有投影帧仅在内存断言，未保存牌局、手牌、房码、名字或凭据。390px是浏览器窄屏，不是实体手机验收。

网站房主隐藏全能的公网专项**尚未完整通过8项**，不能用本地13/13或一般流程12/12代替。Windows首个 npm调用丢失 `--origin` 参数，程序在启动断言提前退出，日志 `website-omniscient-live-801daf5.log`，不计通过。改为 direct Node 后的历史失败均保留在 `.local-evidence/website-omniscient-live/`：run-UalXWO加入等待超时0项；run-L7sRyY加入等待超时0项，player仍首页/有错误/无WS，只有response采集为空不能断言没发POST；run-4RlOqV创建阶段0项，错误requestTimeout，未执行加入。

后续真实 run-gLOLN8 **前5/8通过**：手填房间码创建/加入、实际私手发牌、房主fuvtt+Enter打开全能、普通玩家键序不发权限命令且不泄露私投影、关闭全能恢复合法本家手控。然后在 public-refresh-revocation 超时，两个浏览器均connected=true，无脚本/外域错误；旧诊断没有细分是关闭状态还是房主按钮等待，不猜具体原因。这5项真实结果有效，不能因后续失败改称全0项或8/8。

新增有界请求/关闭码/owner布尔诊断后 run-dc4yGB 再次在 join-own-room-connected 失败0项：手填房码长度8且格式合法，加入request后2316ms观察到HTTP201响应头，约11974ms出现aborted/requestTimeout，没有WS。JSON响应体读取/解析未在原12秒期限内完成；目前未证实服务器流、网络或浏览器调度的具体原因，不能把它归为本地房间码校验失败。单次health GET HTTP200/204ms也不能反推每个超时原因。新增诊断只写安全enum、长度、时间和布尔，原8项断言/等待与生产不变；不继续没有因果证据的盲重跑。最新日志 `website-omniscient-live-request-801daf5.log`、`website-omniscient-live-refresh-801daf5.log`，完整失败JSON保留。遗留双落TODO：定位公网刷新撤权和响应体期限失败，完成全8项真实验收。

### 本轮回滚指针

- 网站完整回退目录：`/var/www/obr-plugins/.three-dragon-releases/20261004-801daf5-bug-hotfix/rollback/`，只含此次选择的两个网站。
- 服务器私有 receipt：`/var/backups/three-dragon-releases/20261004-801daf5-bug-hotfix/receipt.json`；原服务bundle为同目录 `server.mjs.previous`。SQLite私有备份只在服务器，不下载、入库或在代码回滚时恢复。
- 若需回退，先核对当前receipt及未选择Suite无漂移，再使用本轮冻结 `deploy-three-dragon-release.py` 的 `rollback --release-id 20261004-801daf5-bug-hotfix`。它仅恢复双网站与服务bundle，保留发布后live SQLite写入；Suite漂移会拒绝，而不是覆盖他人版本。本次未执行回滚。

实际服务器冻结脚本的回滚命令（本次未执行）：

```sh
python3 /var/tmp/three-dragon-release/deploy-bug-hotfix-801daf5.py rollback --release-id 20261004-801daf5-bug-hotfix
```

诊断工具增量另经gpt-6.1-sol只读复核通过：原8个检查标签、12条assert及21条wait语句均保留，仅增加房码合法和填值一致两条assert；有界16/16/8/32事件记录只含安全枚举、时间、状态、长度和布尔，真实response/frame只在内存处理。node检查和diff检查exit0，工具SHA `b37d8f0804aa6cccf5b27f5403e9ea7b8509070ce50a6107b83a1ac828c329cc`。它不改变801生产包，不把公网8项包装为通过。

## 当前状态与遗留

**已上线0.9.1/0.9.1-dev，冻结801daf5；一般公网12/12、CI及独立发布核验通过，后续默认GPU隐藏权限公网8/8通过，强制软件GL超时仍待查。** 后续纯留痕/测试诊断提交不改变该线上冻结源。本次没有重新部署Suite/枭熊，没有合并main、force-push或打tag。附件c3960047的完整特效整合/单rAF阴性对照/冷启动桌形、实体手机与弱设备测试仍双落TODO，不属于这次bug热修复发布。

特效预览独立运行于 `http://127.0.0.1:4174/?fx3d=1`，使用最新 c3960047 的实际 FxStage/41 家族组件，不创建牌局、连接服务或使用本地机器人宿主。预览 10/10，截图、零失败资源/外部请求记录在隔离快照 `.local-evidence/fx-preview/`；这是本机特效预览，不能算生产牌局性能验收。

## 后续公网控制：默认 GPU 完整8项通过

生产仍冻结801daf5，未重新构建或部署。根任务在ignored副本仅去掉强制SwiftShader的两个launch flags，保留同Edge、同origin、同locale/reduce、同域拦截、原8检查/14现有assert与21wait，另采集有界GPU后端类别。实际控制源码 `.local-evidence/public-hidden-hardware-control/control.mjs` SHA `1c651e27a97ef5d7cad9b243d2afa036eae9009bc47ed1bdd05f20ae25fea7da`；result/control位于 `run-JE9SZo/`，日志 `.local-evidence/hotfix-deploy/public-hidden-hardware-control.log`。

本次实际 **8/8**、exit0：原房间码加入、私手发牌、host主动键序、普通玩家拒绝、关闭恢复、刷新保留主持且inspection关闭、真实WSclose清全部编辑DOM后重连、零私牌泄露/脚本/外域错误全部执行。该结果是已上线产品真实HTTP/WSS控制，不是本地fixture，也没有跳过曾失败的刷新项。默认GPU控制中renderer观测被分类为hardware，但分类器仅排除SwiftShader/llvmpipe/software，尚不足以确认物理适配器；不写“物理硬件已验收”或将单次成功当作软件渲染超时根因。

强制SwiftShader下的历史JSON读取12秒超时与刷新失败继续保留，具体原因未确诊。正式工具新增显式 `--gpu default|software`，默认仍software，软件flags不变；默认模式只移除两个强制flags，真实getContext结果仅保存software/reported-hardware/unknown枚举，不落盘renderer文本，不新增GL context。Node/diff检查exit0，原断言与deadline保持；正式新CLI尚待浏览器窗口释放后验收，不把ignored控制当作新CLI已运行。新FX默认软件GL/减少动态门控与lazy资源的效果仍待候选专项/完整CI/实际发布验证。

遗留双落TODO：完成正式CLI默认模式验证；查证强制软件GL超时，勿扩大deadline凑数；完整FX回归/独立终审/精确CI与发布继续推进。普通默认GPU公网全8已完成，旧“前5/8待验”是更早阶段记录。

### 正式 CLI 默认模式实际完成

随后正式tracked工具 `tools/website-omniscient-live.mjs` SHA `3d24256e05057dea39e322437b766130a84d938e18232a179c1257d5f5e17f90` 亦实际执行：`node tools/website-omniscient-live.mjs --origin https://obr.dnd.center --gpu default`，exit0、原 **8/8** 全通过。证据 `.local-evidence/website-omniscient-live/run-y3SPEy/result.json`，完整日志 `.local-evidence/hotfix-deploy/public-hidden-default-cli-34ac8de.log`。两浏览器均观测3个reported-hardware类别，原刷新保留主持/inspection关闭、真实socket关闭清DOM再恢复、普通玩家无privileged命令或泄露均实际完成；脚本/外域0。类别仅代表驱动报告，仍不宣称物理设备/手机验收。

该选项此前的独立只读审核通过（gpt-6.1-sol）：8检查/14原assert/21wait逐项保持，非法模式在launch前拒绝，原software分支4flags保持，default只去两个SwiftShader flags，不新建GL上下文、不落renderer/凭据/房码/name/payload。正式CLI尚未执行的遗留现已完成；强制SwiftShader历史超时与新FX的软件门控回归、实体设备体验仍待，不改变801线上源。
