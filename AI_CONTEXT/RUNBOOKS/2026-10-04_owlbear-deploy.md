# Runbook · 三龙牌三入口上线（2026-10-04）

## 授权与目标

用户 2026-10-04 明确授权持续推进、不再逐步询问，三项交付：独立 Owlbear 扩展、Suite 内三龙牌、独立多人网站；统一使用用户现有服务器。网站房间码/邀请链接+名字入房和重连，无账号身份识别，房间内名字唯一。规则引擎与私牌边界继续保留，另一机器的表现层/fx3d 工作不触碰。

## 已核验与已执行

- §1–§2 快照全部验证通过，见同日 environment-handoff runbook。
- `git fetch origin` 后 `git push -u origin rebuild/presentation` 成功；远端创建分支，验证 HEAD `619ada5`。GitHub 当前账号拥有 repo 写权限。未修改 remote/credential、未 force-push、未合并 main。
- 本地预览 `http://127.0.0.1:4173/three-dragon-ante-dev/` 维持运行；当前预览来自原验证产物。
- SSH 指定既有部署 key，以 BatchMode + StrictHostKeyChecking 连接成功；不记录私钥内容。
- 现场线上基线：card 1.0.241、Suite dev 1.0.241-dev（Suite source b48783c）、stable Suite 1.3.14（639c8217）、旧独立三龙牌 0.7.22-dev。旧文档版本不用于覆盖线上。
- `obr-three-dragon` active、127.0.0.1:5013；local/public health 200；public WSS TLS/升级握手 101 且 Accept 校验通过。现有反代沿用，不需为同源 API 修改 nginx 或 systemd 配置。
- Suite 工作台三龙牌 iframe 依赖 panel-sdk/panel-rpc 桥，直接换独立 table.html 会丢失宿主桥。集成从现场对应 source 独立工作树构建，只定向覆盖三龙牌 panel 与其资源；不发布旧 paired worktree 的全量 Suite。
- 生产对应 Suite 服务源码比快照多 stale-game leave 防护；新增 guest API 时已保留，main.mjs 除行尾外一致。
- 已写 guest 服务与网站宿主；服务端 build 通过，专项测试、浏览器测试、桥接集成与审计仍在进行。

## 新接口与实现边界

- `POST /guest/rooms {name}` 创建房间并入座；`POST /guest/rooms/:code/sessions {name,reconnectToken?,reconnect?:true}` 加入/重连。
- 普通加入同名始终拒绝；显式重连先用缓存 token，没有 token 仅恢复离线同名座位；短期发行租约防尚未 WS 连接的并发抢名。token 轮换，单名字单活动操控连接。
- guest 主持仅管理牌桌，禁止 inspect/omniscient/edit；旧 `/rooms`/grants 与枭熊身份边界不放宽。
- 新 SDK 无依赖的 server-endpoint 模块供网站和旧客户端共用；默认同源 `/three-dragon-api/v1`，所有资源自托管。
- stable Suite 直接弹窗路径增加已有稳定局路由，沿用稳定旧协议，避免热迁移。
- 版本 `0.8.0(-dev)`；新增 guest/server 与 website/browser CI gates。规则语义、卡图、私牌编码未改。

## 证据与遗留

- 只读线上散列/受保护服务基线：`.local-evidence/deployment-preflight-20261004/server-baseline.json`；WSS：`wss-preauth.json`。
- 原构建与测试：`.local-evidence/handoff-2026-10-04/`。
- 原始预览服务保持。新的具体测试结果、源 commit、产物散列、每目标回退点、切换与线上验收在完成后追加本记录。
- 真实枭熊双账号暂缺：浏览器 runtime 请求的服务组件版本文件不存在。未读取浏览器账号凭据，不用 fixture 冒充真实房间。
- 遗留双落 `TODO.md` 的 2026-10-04 目标段；未关闭真实枭熊和独立审计。

## 上线候选验证与审计整改

- 新匿名服务专项完整 15/15：`.local-evidence/guest-server/run-Ulsuwz/result.json`。真实本地 HTTP/WS/SQLite，覆盖并发 NFKC 重名、租约、六席/私牌、保存回滚/幂等、凭据轮换、重启、离线/主动主持继任、旧 Owlbear 共存、stale leave、1011 暂时保存失败与 1013 容量恢复。
- 新网站最终完整 14/14：`.local-evidence/site-multiplayer-UJe91Q/result.json`。同源生产构建、真实桌面/390px浏览器、临时 SQLite/TCP/WS，3 次前注、6 次出牌、2 次能力选择、1 次可见权威结算；错误、资源失败、外部请求均 0。含刷新/强断/服务重启/主持继任/旧凭据/离线名字恢复/同token重复窗口/1008拒绝终态。
- 旧规则/控制器 8/8 与原服务测试 2/2 在新实现后通过；typecheck 0。入口共存矩阵 12/12，证据 `.local-evidence/page-route/run-9Eh5dg/result.json`。
- 换模型审计已启动（gpt-6.1-sol，仅只读）；不将开发结论当成独立审计。发现并修复：过期缓存凭据显式重连的单次名字 fallback、1008无效认证终态、4001替换窗口不再自动抢回、TimeoutError映射、Suite active stable局优先且独立入口保持 valid server 优先、初次暂时存储/容量失败用可重试关闭码并不泄漏活跃房间缓存。专项证据已覆盖，等待冻结源复审结论。
- 初次桥夹具 7/7，真实 WorkbenchPanel/panel-sdk/panel-rpc + 本地服务；最终 source 冻结后须同源重建并重验扩展后的桥矩阵。
- F 盘空间不足引起首轮 overlay 写资产失败；本轮失败产物未删除，已移到 U 的专属失败目录保存。当前大产物与隔离集成源改放 U。自动审批拒绝过清理动作，理由“blocked by policy”；未继续尝试删除其他内容。

这些均不是双账号真实枭熊房间验收，真实验收仍待浏览器连接组件恢复。线上发布尚未执行，原服务/静态入口未切换。

## 冻结源复审与缓存入口兼容

- 运行时冻结源 `cbcbb1aff268d214a72eee78e3496734a2589f24`，gpt-6.1-sol 独立复审通过；审计声明限定源码与本地证据，不证明部署或真实枭熊。
- Suite 最终 overlay 使用冻结 TDA 源和现场对应 b48783c 宿主，dev/stable 各 963 文件散列通过；实际 WorkbenchPanel → panel-sdk → panel-rpc → 本地 WS/SQLite 桥 10/10，包含 compact、私牌、全能边界、刷新与稳定旧局优先。证据 `U:/CodexWork/2026-10-04/three-dragon-suite-bridge-final-cbcbb1a/run-cHglFv/result.json`；产物 `U:/CodexWork/2026-10-04/three-dragon-suite-overlay-final-cbcbb1a/`。仅夹具身份，未冒充真实账号。
- 查证旧生产独立扩展源 dfc4f4d 的后台仍打开 `index.html?instance=<UUID>&mode=full/compact`。新网站 index 只在嵌入 iframe 且具备该签名时同源跳到 table，完整保留查询与 hash；普通网站/邀请仍保持原入口。补丁独立审计无必改，生产构建入口专项 6/6：`.local-evidence/site-entry/run-BWBitj/result.json`，牌桌目标被拦截，仅证明跳转。
- 本地预览已接本地权威服务，`TDA_ORIGIN=http://127.0.0.1:4173`，独立数据库 `.local-data/preview-20261004.sqlite`；代理 health 200。没有写 `.env` 文件或连接生产房间。
- 最新 typecheck/build 通过，原服务再次 2/2；原浏览器与 fx3d 冻结回归正在完成。缓存补丁冻结后重新生成 source archive，Suite 牌桌输出不包含 site 入口，仍须核对新清单来源。

## 发布准备与最新现场基线

- `d7bb7a96dd8095dfc01d72d6f0a17e2f9a8858b3` 已成功推至原分支；GitHub Actions `37139887599` 全部通过（构建、原回归、新 guest/website、入口矩阵、fx3d）。本机原浏览器 20/20、服务浏览器 4/4、fx3d 4/4 最新重跑也通过，日志 `16-browser-release.log` 至 `18-fx3d-release.log`。
- 临近发布只读刷新发现其他发布已将 card/Suite dev 更新到 243；实际 Suite source `207f584347b6797c70eabaedff9825d8cdc36b88`、Web source `fbccf5725e93e605b016858d3f45d35bddb27f08`。稳定 Suite 与三龙牌服务散列未变。禁止覆盖旧 241 整站；最终 overlay 从 243 宿主读版本，按最新整树基线定向合并。
- 243 比较证据 `U:/CodexWork/2026-10-04/three-dragon-suite-source/.local-evidence/host243-compatibility.json`：24 个桥/旧局/服务相关 blob 相同，实际 WorkbenchPanel 也相同；新增 Owner/access 权限检查排除 panelRpc，因此沿用此前 10/10 真实桥夹具证据，明确这是相同桥源码兼容结论。
- 新增本地发布打包工具与远端受控脚本：仅四目标与三龙牌 bundle，强制包 SHA、逐文件清单、路径与 symlink 防护，源 archive 用冻结 Git 跟踪文件；仅允许无密钥 `.env.example` 模板，不包含 `.claude`、真实存档或私有环境。每目标完整新备份、切换意图回执、old/new 散列恢复，保存 mode/uid/gid；SQLite 备份仅远端私有目录，rollback/recover 从不覆写当前数据库。nginx/unit/relay/card 为保护基线。
- 发布事务夹具最终 16/16：`U:/CodexWork/2026-10-04/three-dragon-release-selftest/run-70qcvgsz/result.json`，本地合成树/SQLite，不宣称 Linux 原子交换和真实权限已验收。正式包需工具提交后绑定最终 HEAD；d7 流程验证包保留，不用作正式发布。
- 线上运行时为 Node 22.13.1，本机 Node 22.17.1 完成构建。保留共享 Node，候选服务在生产机器临时目录的 port-zero/合成 SQLite 隔离运行时检查 4/4，证据 `.local-evidence/deployment-preflight-20261004/runtime-smoke-result.json`；未重启或访问生产房间数据库。部署后的真实网站 WSS 仍须完整验证。
- 新增显式运行的 `tools/three-dragon-live-website.mjs --origin ...`，只创建自己的 QA 名字房间，经真实浏览器 UI 验收跨频道入房、私牌、完整一轮、刷新/物理 WS 重建、主持继任和新浏览器离线名字恢复。本地预览 9/9：`.local-evidence/live-website/run-WLRLaH/result.json`。日志失败信息已按独立审计改成固定类别/计数，避免 AssertionError 或 URL 把手牌/凭据/房间标识写出；不留 raw frame 或截图。
- 真实枭熊浏览器连接再次重试仍缺少所需版本的控制服务文件，未读取账号 profile/cookie，不以网站或夹具结论替代真实 GM/玩家验收。
- 发布工具独立审计必改已修：失败服务状态仍可 inspect 并恢复旧 bundle；最终发布事务 17/17，证据 `U:/CodexWork/2026-10-04/three-dragon-release-selftest/run-g9s0nhd8/result.json`。现场 Python 3.9.22 的脚本只读 inspect 成功，脚本 SHA `df9d1967762eb0179d6933227ca86329c0addba0f64e8d8950c1c34e4a9096a7` 与本机一致；基线证据 `.local-evidence/deployment-preflight-20261004/release-inspect-python39.json`。Linux 原子交换独立临时目录 probe 通过，未切换生产目标。最终产物新 HEAD 绑定仍须在正式打包中验证。
