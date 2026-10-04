# 仅在线网站与入口修复（2026-10-04）

## 用户范围

本轮用户明确要求删除全部本地对战，Suite 与独立枭熊插件只跳转或链接线上网站，不再枭熊内运行游戏；保留 Suite 上方三龙牌/功能开关/设置栏。修复网站控制按钮，默认随机名与随机按钮、避免浏览器姓名填充上下文，对局进行中退出需要确认。随后追加无人房间自动解散。持续实施、推送、部署授权仍有效。

旧真实枭熊双账号游戏验收由新方向撤销，未宣布该历史测试通过；浏览器控制组件缺失不再是网站/链接入口完成的阻塞。新目标正本 GOAL §10，边界 DOMAIN §5。

## 查证与实现

- 开工 `git status --short` 仅原 `?? .claude/`，保持不读、不删、不入库；`git fetch origin` 成功，HEAD/远端 `c53e955`。未 force-push、merge main 或 tag。
- 网站按钮遮挡根因：绝对定位的 `.tda-lobby` 与结算遮罩在顶栏上方截获事件；修复仅 HUD 点击层级，不碰 fx3d。
- Suite 顶栏遮挡根因：Web 宿主 `ThreeDragonFullscreen` fixed 全屏并给 `.app-shell` 加 inert；仅换内部牌桌页不足以恢复顶栏，需要定向改三龙牌入口。
- 独立 public `table.html`/`launcher.html` 与 iframe `index.html` 改原生线上链接，href 固定 `https://obr.dnd.center/three-dragon-ante/`、target `_blank`、rel `noopener noreferrer`。后台不启动 Owlbear 房间监听；历史宿主代码仅保留兼容测试。
- 网站房间无人策略：最后连接消失立即释放 live cache，60 秒宽限、5 秒扫描；HTTP 创建未接 WS 也计入上限并过期。SQL 删除 rooms 时级联成员/凭据/guest 表，额外清理无外键的 receipts/history；同一事务提交后释放对应 host timer、rate 键。有在线浏览器则取消空标记；重启给予新宽限。仅 guest 网站房间，旧 Owlbear 存档不删。

## 验证

- `build:server` 通过。
- 无人房间最终专项 **9/9**，`.local-evidence/empty-room/run-4wbPbI/result.json`。覆盖未连接过期/容量拒绝、单人在线保留、最后断线缓存释放及宽限重连、所有关联数据删除与旧码/凭据拒绝、事务失败重试、服务重启恢复、旧 Owlbear 存档隔离、旧版本两列 INSERT 与再次升级纳管。曾考虑给 guest_rooms 加列，会破坏旧版 positional INSERT；正式改用独立 guest_room_lifecycle 表，不改变原 guest_rooms 两列，保持代码回退兼容。
- 原 guest 15 项的最后容量夹具原来在 maxRooms=1 时同时 HTTP 创建两网站房间，与新增“创建也限额”冲突，首次运行 14/15 后 503 != 201。保留原暂态 WS 1013、租约/缓存/原凭据恢复全部断言；第一占用房改历史 /rooms，第二 guest 是唯一允许网站房，复跑 **15/15**。新创建上限独立由空房专项验证；未删断言或凑数字。证据 `.local-evidence/guest-server/run-QdQc8t/result.json`。
- `npm run build` 含 tsc **0 错误**；构建 `.local-evidence/online-only-build.log`。一次 quiet forwarding 命令被 npm/PowerShell 转成 `vite build warn` 返回 1；恢复精确 `npm run build` 后通过，不作为源码失败或忽略项。
- `npm test` **8/8**，`test:server` **2/2**，历史 `test:page-route` **12/12**。最初 fx3d 与构建并行的结果读到旧产物，已撤销为新版证据；修正后按顺序运行真实在线房间相机检查 **4/4**，桌面/窄屏最差偏差分别0.009/0.000px，双画布挂载、脚本错误与外部请求均0。fx3d 运行时未修改。
- 新在线首页 **15/15**（独立审计运行 `.local-evidence/site-controls/run-APsJK8/result.json`）：随机名字、编辑与未聚焦只读、空名不发请求、规则帮助、语言刷新、桌面/390窄屏按钮真实命中。
- 链接入口 **15/15**，`.local-evidence/site-entry/run-9Z916q/result.json`；审计独立复核 `run-IHSl3X` 同样 15/15。table/launcher/所有 iframe 只有原生新窗口链接，parent 不导航，无游戏 API/WS。保留原 manifest background_url 与 action.popover 两个断言，另外直接核验通过；不凑原本地机器人20项数字。
- 历史服务宿主浏览器 **4/4**，`.local-evidence/server-browser-MST8Zx/result.json`；虚拟测试 entry 直接加载保留的 server-page，不给用户新增历史牌桌公开入口，仍验证四客户端准入/私牌/全能/恢复。不是新版插件游戏验收。
- 在线多人 **22/22**，`.local-evidence/site-multiplayer-0yE9kX/result.json`。实际3次前注/6次出牌/3次能力选择/1次可见结算，66自身私牌投影帧只在内存断言；脚本错误/资源失败/外部请求0。覆盖能力说明遮罩上的帮助打开/关闭且演出与权威状态不变、取消退出同WS同状态、刷新/断线/重启/凭据终态、确认新局后同房同座位重发牌。
- 浏览器首次定位首页语言按钮的 accessible-name 被包裹 label 串连，改为 div 后保留 exact-name 断言。演出旧测试固定左上坐标被新可退出顶栏挡住，改点真实“点击继续”，无 force；全并列翻注需要重选，测试读取真实 ANTE_ALL_TIED 后继续前注，不改规则。此前失败证据 `site-multiplayer-zYXUlD`/`Ec24Wm` 等保留，未混入成功计数。
- 发布事务/新增宿主范围和基线保护 **24/24**，`U:/CodexWork/2026-10-04/three-dragon-release-selftest/run-axs2n8b3/result.json`。新增只接受明确声明的 host 文件、拒绝越界/遗漏/错SHA、检查覆盖前SHA、复用依赖漂移与新资产冲突，含host apply/rollback。
- Suite 新链接入口 **6/6**（`U:/CodexWork/2026-10-04/three-dragon-suite-link-browser/run-KdgQxs/result.json`）；实际 Web App 与真正 settings-only bundles/bridge **2/2**，1440/390父状态保留、非inert、无table iframe/RPC。最初preview没挂实际settings产物，点击只证明顶栏可点、截图显示加载失败；补挂生产settings bundles和明确bridge夹具后复跑同2项，断言真实功能开关网格、bridge ready/aria-busy false及无加载失败，窄屏截图已查看，最终证据 `three-dragon-web-link-source/.local-evidence/three-dragon-link-results.json`。没有把早期仅点击当内容完整。
- gpt-6.1-sol 独立审计：发现帮助层68被能力/结算层遮盖，修为110（确认层120）；对应真实能力场景与完整联机22项验证通过。主源码/工具/49宿主候选SHA/69复用+6依赖守卫终裁通过；最终源码冻结产物与线上结果继续核验。

## 宿主发布范围

Web 从实际线上 fbccf572 基线隔离修改，Suite dev 从207f584（243）/stable从639c821（1.3.14）各自隔离修改，不以远端更新后的其他主分支整体覆盖。宿主候选仅49项，加2个静态链接页共51项；5个覆盖入口带 beforeSHA，69复用资产和6依赖（含两Suite release.json）带SHA。新hash资产保留旧文件；只允许 manifest 明确声明的 settings/index/sw/编译依赖与三份对应源归档。Suite原manifest/background/其他入口和card/nginx/systemd/relay继续保护。apply在完整freshbaseline之外再核宿主旧SHA与复用依赖，任何漂移停止。

本地预览现用新服务 `.local-data/preview-online-only-20261004.sqlite`（ignored，合成局），`http://127.0.0.1:4173/three-dragon-ante-dev/`，不连接真实玩家存档。

最终宿主清单：`U:/CodexWork/2026-10-04/three-dragon-host-link-overlay-final-complete/host-overlay-manifest.json`；Web源 b681f78dccad90ab407738074dedba62b13db470、Suite dev源32ed4bb661b11587bc74fe78a36ed4971945178d、stable源3dc4bbd9836279a95dfd1ffba7eac812af1d7321。原产品hash未变，Web补强测试/docs进入对应源ZIP。三源归档随host49项发布，提供精确对应源码；保留各自既有许可证，Web为LicenseRef-DND-Card-NC-SA-1.0，Suite和三龙牌为GPL-3.0，未将Web改称GPL。

第一次冻结 fa83fad 已 push，CI `37165076697` 在入口最后直接访问场景失败：该 `browser.newPage()` 未设 locale，Windows 默认中文通过，Linux 默认英文正确显示 Create room，但测试硬编码“创建房间”等待超时。修为明确 zh-CN/en-US 两个独立访问场景，保留全部原断言并新增英文 default-language 断言；新入口总16项，不改产品语言策略。首次候选保留、未部署；正式冻结将包含此跨平台测试修正并重打包。

第二冻结 6e3d4d9 的 CI `37165303318` 已通过在线多人22项，却在 fx3d 原测试点击已删本地首页“开始”时失败。先前本机fx检查和前端构建并行，检查读取了旧产物，不能算0.9新版证据。本轮纠正依赖顺序，并将相机测试改为内存SQLite真实HTTP/WS在线房间、第二合成座位与实际发牌后检查；保留原桌面/窄屏8点<0.5px对齐、双画布、脚本/外部请求0共4条，未改fx3d源码或相机阈值。6e候选保留、未部署，正式冻结必须含此适配并通过CI。

## 最终发布与公网验收

- 冻结源 `7555f99e05a2853f495422d5b3c0f62a1a74c990`；GitHub CI [37166008634](https://github.com/FullPeople/three-dragon-ante/actions/runs/37166008634) completed/success。依赖安装、build/tsc与server build通过，8/8、2/2、guest15/15、空房9/9、历史路由12/12、首页15/15、入口16/16、历史服务宿主4/4、在线多人22/22、fx3d4/4全部通过。下载的真实CI状态与完整日志保留 `.local-evidence/online-only-deploy/ci-7555f99.json` / `.log`。
- gpt-6.1-sol 对两次跨平台测试适配、最终7555冻结源码/包追加独立审计：通过，无必修整改，要求CI成功后才apply，已满足。相对fa仅测试/runbook变化，四目标产品字节和server bundle相同；未改投影阈值、私牌断言或吞掉失败。
- 最终包 `U:/CodexWork/2026-10-04/three-dragon-online-only-release-7555f99/`，overlay `three-dragon-online-only-overlay-7555f99`。tar1994项：1991目标输出、server、主源ZIP、manifest；163644574bytes，SHA `0f78243388773dfbd0afc86c209d165d0ff429518c248a1fec755072a7a30eea`。主源码ZIP381个tracked文件，SHA `6f61da9106431f74946addcb860ad188431296fcf7c408ff82f7d08ba46f5bb8`；部署脚本SHA `bc3ea9cdb3b76212e9abf8208a6e41a93c3e1cb46e78a2798f46a91f9c13d10e`。独立代理重建四份固定commit的git archive并逐字节核对通过，无私有路径/凭据标记。
- final fresh baseline `.local-evidence/online-only-deploy/fresh-baseline-7555f99.json`；线上旧文件数1444/989/4367/2108，server active，旧bundle SHA `2ee326bf88861934f868f1c8f04d619e5ed3b8494463b440606ce2e35345e361`。宿主49+69+6共124守卫匹配。上传后远端tar/script SHA与本地一致，apply重验fresh snapshot与全部守卫。
- guarded apply exit0，发布ID `20261004-7555f99-online-only`、status applied、source7555f99。四目标全目录最终1452/997/4409/2112，保留原hashed资源与其他内容。回执 `.local-evidence/online-only-deploy/apply-7555f99.json`。静态四目标回退目录 `/var/www/obr-plugins/.three-dragon-releases/20261004-7555f99-online-only/rollback`，私有receipt `/var/backups/three-dragon-releases/20261004-7555f99-online-only/receipt.json`，SQLite原库保留、私有备份仅在服务器，未读取或下载玩家内容。
- 独立远端核验（00:53:55–00:54:22 UTC）通过：1991发布输出与包SHA一致，4主源ZIP副本/3宿主源ZIP/4元数据精确对应；6971清单外旧文件内容与mode/uid/gid完全保持，原目录属性保持。card完整tree、nginx配置与unit、relay三源及nginx/relay PID/activation timestamp保持。server新SHA `acf4a5191bddae59cfae52f4cc185b01fb719caf52a6f9a600011853b3d8e56e`，0644/root/root、服务active。证据 `U:/CodexWork/2026-10-04/three-dragon-online-only-independent-7555f99/remote-result.json` / `remote-capture.json`。该代理全程只读静态/systemctl，没有读SQLite/备份。
- 公网入口逐项200：stable manifest0.9.0、dev manifest0.9.0-dev、Suite stable `three-dragon-ante.html` 与dev `workbench-panels/table.html`均原生链接。独立网页地址 `https://obr.dnd.center/three-dragon-ante/`；链接不启动旧牌桌、iframe游戏或RPC。
- `node tools/three-dragon-live-website.mjs --origin https://obr.dnd.center` exit0，公网 **12/12**，`.local-evidence/live-website/run-KHZt8j/result.json`。桌面stable+390px dev通过真实HTTPS/WSS同房联机；3次前注、6次出牌、4次能力选择、1次可见结算；默认/随机/名字编辑本地15项已通过，公网重名拒绝、帮助/音效/English真实指针点击、退出/新局取消保留牌局、刷新与物理连接关闭重连、房主离开自动交接、无凭据离线名字重连全部通过。脚本错误/失败资源/外部请求0，68自身投影帧仅在内存检查，不保存名字/房码/私牌/凭据/原始帧。全部context关闭后等待66秒，重连原合成码返回roomMissing，确认线上空房解散。
- 用户明确“卡顿PR尚未提交，先忽略”；本次不合并任何PR/main，不打tag、不force-push。最终后续提交只更新文档留痕，不重建已发布7555冻结源码。

代码与静态回退命令（仅在授权回退时执行，保留当时live SQLite）：

```sh
python3 /var/tmp/three-dragon-release/deploy-online-only-7555f99.py rollback --release-id 20261004-7555f99-online-only
```

## 遗留

本轮 GOAL §10 全部交付项完成，TODO本轮五项已闭环。旧本地机器人20条已删除并替换为在线控制/交互专项，报告真实条数，不以新版15条伪称20条。实体手机手工体验仍待验证（390px浏览器不代表实体设备），历史fx3d效果/真实手掌等表现层待办留在TODO，不混入本轮上线完成。原枭熊双账号游戏验收按用户新要求退出当前范围，没有冒称通过；后续用户可按AUDIT.md开场词再次换模型独立复核。
