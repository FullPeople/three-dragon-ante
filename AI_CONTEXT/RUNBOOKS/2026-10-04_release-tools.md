# 发布工具与回退准备（2026-10-04）

## 范围

本记录对应用户持续推进授权。新增本地打包、受限服务器发布、隔离发布事务测试工具；本次工具准备不部署、不 push，不修改游戏、服务、表现层运行源码。实际四入口发布回执仍追加到 `2026-10-04_owlbear-deploy.md`。

- `tools/release-three-dragon.mjs`：只操作本地新输出目录，冻结 git HEAD 与 Suite overlay 的 `tdaSource` 必须一致；所有已跟踪文件干净，除原 `.claude/` 外未跟踪源码须先提交。分别构建 `/three-dragon-ante-dev/` 与 `/three-dragon-ante/`，API 固定同源 `/three-dragon-api/v1`；Suite 只复制 overlay 清单中的牌桌 HTML 和 hashed assets。生成 git archive、所有发布文件 SHA/size 清单、tar 与部署脚本 SHA。`.env.example` 是已核验的无密钥 localhost 模板，精确允许归档；其他私密文件、SQLite、`.claude`、证据目录不归档。
- `tools/deploy-three-dragon-release.py`：`inspect` 为只读现场基线；`apply` 验证上传包外部 SHA、tar 全文件清单、全部路径和四目标、近切换前完整基线。`rollback` 恢复已发布代码，`recover` 恢复被打断的发布。部署动作只由主代理执行。
- `tools/release-three-dragon-selftest.py`：本地合成目录和 SQLite，包含坏包、漂移、空间不足、服务启动失败、目录交换故障、中断恢复；没有远端操作或真实玩家数据。

## 保护与恢复

每个静态目标在切换前同时准备完整候选树和独立旧目录回退树；保留所有旧 hashed assets、Suite manifests/runtime/legacy 页及源码包。新文件/新公共目录显式 0644/0755；旧文件及目录保留 mode/uid/gid，并把这些属性和内容散列纳入守卫。切换用 Linux `renameat2(RENAME_EXCHANGE)`；新 stable 目标使用原子 rename，回退时恢复“原本不存在”。服务器只替换 `/opt/obr-three-dragon/server.mjs` 并重启 `obr-three-dragon`，不修改 nginx/systemd/relay/card。

控制路径及父链拒绝 symlink/non-directory，拒绝未知 tar 路径/软硬链接/重复文件/多余文件/Suite 范围外覆盖。写入前估算解压包、两份旧树、各入口源码 zip、SQLite/WAL 私有备份和余量，按所在卷合计，至少保留 512 MiB；不足时不创建 staging 或备份。

SQLite 只在服务器 `/var/backups/three-dragon-releases/<release-id>/` 内作 root-only 私有备份，不下载，不进入源码包/仓库。所有回退保留当前数据库，避免回滚发布后的牌局动作。每目标静态回退位于 `/var/www/obr-plugins/.three-dragon-releases/<release-id>/rollback/<target>`；控制根 0700，不作为可访问资源。失败候选与原中间产物保留。

切换意图在交换/服务器替换前写入 fsync 的私有 receipt；恢复时只接受当前内容/权限与记录的 old/new 状态之一。新服务器启动失败时仍可通过 `systemctl show ActiveState` 读取 failed 状态，先恢复旧 bundle 再重启。突然中断用 `recover --release-id`；发现后续漂移则停止，保留现状和回退点，不强行覆盖。

现场 Python 是 3.9.22，散列使用流式 SHA256；本地构建 Node 22.17+，生产沿用已隔离验证的 22.13.1，在实际 bundle 上再跑 `node --check`，不升级全局运行时或改 unit。

## 验证与来源漂移

- 本地最新发布事务测试 **17/17**，证据 `U:/CodexWork/2026-10-04/three-dragon-release-selftest/run-g9s0nhd8/result.json`。其中原子交换和 uid/gid 操作是可移植 fixture mock，不能作为 Linux 所有权/原子语义验收。
- `python -m py_compile tools/deploy-three-dragon-release.py` 与 `node --check tools/release-three-dragon.mjs` 通过。实际 Linux 独立临时目录 exchange probe 见 `.local-evidence/deployment-preflight-20261004/atomic-exchange-result.json`，未切换生产目标。
- d7bb7a9 的流程验证产物（不是最终发布）位于 `U:/CodexWork/2026-10-04/three-dragon-release-prepare-d7bb7a9/`。typecheck/build/server build 通过；四目标文件数 **987 + 987 + 963 + 963 = 3900**，已由部署解包器逐项验证 SHA 和文件范围。tar 为 178840648 字节、SHA `2210fc7eae379f0da6ca7cb737daae10b2602d3cb21e91246ee9e5eeb068597c`。旧流程中间包/overlay 均保留。
- 现场 Suite dev 已从 b48783c 漂移到 **207f584347b6797c70eabaedff9825d8cdc36b88 / 1.0.243-dev**；原241整包绝不发布。隔离 Suite source 已切换对应243宿主；panel-sdk/panel-rpc 和实际父 WorkbenchPanel 桥字节相同，详见集成代理兼容证据。最终包须等主仓工具、验收工具、文档提交后绑定最终 HEAD 重建 overlay 和独立两频道。
- 换模型审计正在复审这些工具；最终结论和正式发布提交留在主 runbook。
- 换模型复审的必改项已修复并纳入 17/17。相同脚本 SHA `df9d1967762eb0179d6933227ca86329c0addba0f64e8d8950c1c34e4a9096a7` 已在现场 Python 3.9.22 执行 `inspect` 成功（只读）；本机证据 `.local-evidence/deployment-preflight-20261004/release-inspect-python39.json`。源码预裁有条件通过，唯一剩余为最终冻结 HEAD 绑定的完整产物重建与散列复核。

## 主代理执行步骤

1. git fetch 核验远端，提交审阅后的工具和文档，取得最终 HEAD。
2. 从现场243对应隔离 Suite source，设 `TDA_SOURCE_ROOT`、全新 `TDA_OVERLAY_OUT`、`VITE_TDA_API=/three-dragon-api/v1`，运行 `tools/build-three-dragon-overlay.mjs`。
3. 仓库根运行 `node tools/release-three-dragon.mjs --out <全新U目录> --overlay <上一步目录>`；确认 preparation JSON 源码/脚本 SHA 和四目标。
4. 主代理用既有严格 SSH 将脚本/包传入 `/var/tmp/three-dragon-release/`，调用 `inspect` 得到全新 JSON；以原始 UTF-8 bytes 保留，避免 PowerShell 旧版默认 UTF-16/BOM 重定向。
5. `python3 deploy-three-dragon-release.py apply --archive <绝对上传tar路径> --sha256 <preparation中的tar SHA> --baseline <绝对UTF-8基线路径> --release-id <唯一日期和提交ID>`。该操作仍要求现场基线毫无漂移，不跳过守卫。
6. 检查 HTTPS 四入口、同源 API/WSS、上线网站真实浏览器行为和受保护目标散列。任一必要项失败时用 `rollback --release-id`；突然中断用 `recover --release-id`。

## 遗留

最终 commit 绑定产物、独立审计结论、fresh baseline/各目标正式回退点、实际发布与公网验收尚待主代理执行。真实枭熊双账号验收另列，不由本地 fixture 代替。遗留应同时跟踪在 `AI_CONTEXT/TODO.md` 的三入口上线目标段。
