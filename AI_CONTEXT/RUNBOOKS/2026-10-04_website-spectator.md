# 网站观战能力（2026-10-04）

用户新反馈明确要求观战，根任务授权必要网站/服务修改。实现工作区 `U:/CodexWork/2026-10-04/three-dragon-website-feedback2-7e64866`，分支 `release/website-feedback2-20261004`，开工 HEAD `7e6486602f32ac290e907f57349bac9264356ae7`；先 git fetch origin --prune exit0。根任务随后合入采样工具准备提交，观战没有修改该工具、规则/编辑器/牌库排序/拖牌文件，也没有 browser、stage、commit、push 或远端操作。线上仍801/0.9.1；本地新功能不等于发布完成。

## 实现与权威边界

`server/three-dragon/service.mjs` 接受网站 admission 的 `spectating:true`，创建持久 `members.role=SPECTATOR`，使用既有 TEXT 字段，不迁移数据库 schema。观众只取得 member/credential，不进入六席列表，不改变游戏或座位。因此大厅、进行中和六席满桌均可观战；64 members、maxRooms、maxSockets、名字唯一与HTTP领取租约仍保留。

服务端用持久角色判定能力。观众不提供 seat，沿原 `packPublic(projectPublic(...))`；原 WS role hint 仍 PLAYER，full-view identity 增加权威 `spectating` 布尔。角色不会因客户端 admission 标签改变。所有观众 command 除公开 history 与无状态写入的 leave ACK 均 `notAllowed`；join/action/edit/inspect/omniscient/handover/kick/start/newGame 都被拒绝。自动继承和手动 handover 排除观众；在线观众继续计入房内有人，不触发无人回收。

已有同名普通成员的 watch 请求、已有 watcher 的 player 请求都 `nameTaken`，拒绝发生在任何凭据旋转或座位写入之前，防止以观战顶掉真实座位。缓存重连携带原 mode 和 token；明确离线重连没有 mode 时由已有持久角色推导，仍受 online/claim 规则限制。重连旋转该成员的凭据并替换该成员自己的连接，不扩座位或能力。服务重启从原角色与凭据恢复。

`site/online-session.ts` admission 增加兼容旧记录的 optional spectating，缓存仍只存会话 capability，未保存牌局或私牌。`SiteApp.tsx` 新增共用名字/房码的观战按钮与身份标签。`OnlineMatch.ts` 在真实 identity 到达后校正缓存模式，只有权威 spectator 模式才进入本地 UI hint；再次阻止观众特权命令，隐私仍由服务器投影决定。`hud/Lobby.tsx` 隐藏观众入座按钮，普通成员离座后重新加入保持。观众返回首页关闭当前客户端，既有玩家离座/退出语义未扩展；观战不以正在参与对局触发 beforeunload。

## 已完成检查

首次 server npm ci --ignore-scripts 遇 C: Free=0，exit -4055/ENOSPC；原日志保留 `.local-evidence/spectator-prepare/server-npm-ci.log`。只读盘点 U: 有约90GB余量，没有删除文件、全局改npm配置或升级依赖。安装恢复命令在已运行时使用本次隔离 U:/CodexWork/2026-10-04/spectator-npm-cache-feedback2 及工作区 ignored TMP/TEMP，exit0，记录 `server-npm-ci-u-cache.log`；之后命令局部 npm_config_cache 使用根任务指定的本工作区 `.local-evidence/npm-cache`。

- node --check service/new spectator tool 均exit0。
- npm run build:server exit0；`.local-evidence/spectator-prepare/build-server.log`。
- 首次 `node tools/website-spectator-selftest.mjs` exit0，13/13；`.local-evidence/website-spectator/run-F2SmAB/result.json`，完整日志 `.local-evidence/spectator-prepare/first-selftest.log`。

专项调用真实当前服务 bundle + HTTP/WebSocket/SQLite，自建合成房间；没有复制规则或服务算法，没有公网或浏览器。检查覆盖：持久无座角色、满六席进行中观战、PublicView与cap、九类伪造命令拒绝且state不变、名字/mode保护、缓存旋转/旧token拒绝、无缓存离线恢复、64members与现有成员重连、maxSockets/maxRooms、服务重启、观众独存房与不继承、真实坐席继承且game不变、最后观众离线后回收。无人宽限220ms与房主宽限100ms是明确加速策略夹具；生产默认60000ms/8000ms未改，不冒称已等待生产60秒或8秒。所有本地资源在 finally 关闭。

上述运行后仅在条件加括号提高阅读性，并让 stalled 的网站 UI 更新保留同一个 spectator hint；服务逻辑无变化。前端typecheck/build、根任务独立源码复核与真实浏览器观战仍待统一窗口，不能把13项纯Node当作前端/公网或设备验收。后续root统一接package/CI脚本、版本、完整精确CI、新包终审与部署。本代理之前独立审计身份不替代自己新实现的最终独立审核。

## 新真实网站验收工具（仅准备）

根任务进一步授权准备新增 `tools/website-spectator-browser.mjs`；node --check 和 git diff --check 均exit0，SHA256 `5493A9A837FC6A264A61BA413A2CEFA4081CB82071B212D9737AFCFE03EEE239`。没有运行浏览器或构建。工具须先由根任务构建当前网站与服务，再在唯一浏览器窗口执行；它不改变原测试工具、断言、前置或CI。

桌面与390×844窄屏各通过真实网站创建host与player、实际观战按钮加入大厅（无Join/Start、不占座）再退出；开局后另一个新名字真实late-watch。检查实际无手牌card ID/正面DOM、无编辑器/全能按钮/出牌按钮，RAM监听所有该页面WS投影的private key并只保存计数。双方真实键盘前注并等待权威revision，公开前注在observer DOM可见；随后真实刷新、立即返回首页（没有对局退出确认且玩家游戏不变）、缓存重连、清除此合成浏览器的capability缓存后明确离线重连，均维持持久observer mode和普通PublicView。只检查该自建内存服务，源码前后hash、错误/外域/资源失败计数留存，不保存投影、房码、身份、token或截图。

准备源码最多可生成13个实际PASS，但当前运行计数为0；尚未取得这份工具真实前端结果，不以Node13/13或静态准备代替。默认真实服务60秒无人/8秒房主策略在该browser fixture沿用，工具不会等待或冒称这些期限的人类验收。
