# Runbook · 新机器接手与环境验证（2026-10-04）

本轮只执行用户交接请求 §1–§2。没有推送、合并、打 tag、部署、发布 manifest 或修改线上入口；没有修改环境文件、远程地址、凭据、表现层、测试或红线源码。

## 1. 快照与读取顺序

- 输入：`//192.168.0.49/Share/three-dragon-ante-2026-10-03.zip`，77,271,040 字节。扩展名为 zip，实际为 TAR；ZIP 读取器报 `End of Central Directory record could not be found.`。经 Python tarfile 核验 2,302 个条目、无越界路径或链接，再用系统 tar 解压；共享盘原件未修改。
- 仓库根：`D:\Desktop\三龙牌\three-dragon-ante`，包含 `.git`。
- 按序读取：`AI_CONTEXT/INDEX.md` → `GOAL.md` → `MEMORY.md` → `TODO.md` → `RUNBOOKS/2026-10-03_presentation-round3.md` §6（含 §6.4）→ `README.md` → `docs/THREE_DRAGON_SERVER_203.md` → `server/three-dragon/obr-three-dragon.service`。另外读取仓库 `AGENTS.md`、审计说明及第二轮 runbook 的规则提示例外。
- 验证分支：`rebuild/presentation`；验证 HEAD：`619ada56bbb2556e015d8775984baa416ab13692`（fx3d foundation + re-audit fix R-H1）。HEAD 没有变化。
- 本地 `main`：`eb74f625c8d2988fd2f0011d1b3d039152c2c12e`。安装前 `git fetch origin` 成功，`origin/main` 更新到 `3e1261f8e6754c6da5963dc2a9b35c1ce1a1e2cb`，仅比本地 main 多两份拆分文档变更；远端没有 `rebuild/presentation` 分支。写本记录前再次 fetch 成功，无更新。
- origin 的 fetch/push 地址均为 `https://github.com/FullPeople/three-dragon-ante.git`，未改配置。只读 fetch 通过不能证明写权限。
- 初始未提交状态仅 `?? .claude/`，它来自快照，保留原样；未读其内容。

## 2. 环境与逐条实测结果

所有安装、构建、测试命令在上述仓库根执行；没有替换脚本或删减检查。Node `v22.17.1`、npm `10.9.2`；`.nvmrc` 为 `22.17.1`。浏览器使用本机 Edge `154.0.4258.53`，三个浏览器组串行执行，无需下载 Chromium。

| 命令 | 退出码 | 真实结果 |
|---|---:|---|
| `npm ci --ignore-scripts` | 0 | added 42 packages，audited 43；报告 5 项漏洞（2 moderate、3 high） |
| `npm ci --ignore-scripts --prefix server/three-dragon` | 0 | added 1 package，audited 3；报告 1 项 high 漏洞 |
| `npm run build` | 0 | `tsc --noEmit` 0 错误；前端产物生成于 `extensions/three-dragon-ante/dist/` |
| `npm run build:server` | 0 | `dist-server/server.mjs`、`dist-server/service.mjs` 均生成 |
| `npm test` | 0 | 8/8 子脚本通过；其中 presentation-selftest 15/15 |
| `npm run test:server` | 0 | 2/2 子脚本通过 |
| `npm run test:browser` | 0 | 20/20；errors、failures、external 均为空 |
| `npm run test:server-browser` | 0 | 4/4；errors 为空；真实本地 WebSocket + SQLite，枭熊 SDK 身份/房间为夹具 |
| `npm run test:fx3d` | 0 | 4/4；桌面最大误差 0.009 px，窄屏 0.011 px；各测 8 个点；两组零脚本错误、零外部请求 |

构建报告大于 500 kB 的 chunk 提示；安装报告的漏洞保留原版本，未执行 audit fix 或升级。服务端浏览器测试另有 Node SQLite 实验功能提示，退出码仍为 0。

## 3. 文件与保护边界核对

- 安装前记录全部 363 个已跟踪文件的 SHA-256；所有测试结束后逐文件复核，变化数为 0，锁文件亦未变化。本轮唯一新增非忽略文件为此接手 runbook，未提交。
- 对拆分基线 `eb74f62`，协议三文件、服务端、旧稳定频道、卡图及除 `prompts.ts` 外的规则文件 Git diff 均为空。
- 历史例外：`rules/prompts.ts` 有 8 行中文措辞变化，12 处“下注”改为“前注”、1 处“暗置时”改为“前注时”，执行逻辑与英文未改。第二轮 runbook 开头及 §2 已明确记录例外；因此不能说整个 rules 目录字节完全不变。
- `index.ts` 的牌桌入口和 `legacy-page.ts`、`server-page.ts` 的表现层挂载也有历史变化，不能笼统声称所有宿主代码字节未变；核心协议、私牌通道、控制器和权威服务的已跟踪内容未改。

## 4. 证据与下一阶段边界

- 原始命令日志及运行前哈希：`.local-evidence/handoff-2026-10-04/`，文件 `01-npm-ci.log` 至 `09-test-fx3d.log`、`tracked-files-before.json`、`verification-summary.json`。
- 规则/控制器：`.local-evidence/regression/results.json`。
- 服务端：`.local-evidence/server/results.json`。
- 生产浏览器：`.local-evidence/browser/result.json`，含检查、截图及零外部请求结果。
- 服务端浏览器：`.local-evidence/server-browser-UVxFJr/result.json`。此证据目录含合成 SQLite 测试数据，已被忽略，不加入 Git。
- 本轮没有 `.env.local`，也没有设置 `VITE_TDA_API`；此构建用于本地验证，枭熊上线前仍须按用户确认的方案配置 API 并重新构建。
- §1–§2 指定环境验证全部通过。§3 的 push 已获用户授权，但依其要求先报告本表，再进入推送阶段；当前未 push，GitHub 写权限尚未实证。
- §4 的 HTTPS 静态部署、WSS、真实 GM/玩家双账号流程、紧凑弹窗、刷新恢复和网络面板验收尚未开展。每一步动手前仍需用户确认具体方案。既有遗留继续由 `AI_CONTEXT/TODO.md` 管理，本轮未关闭推送或真实枭熊验收待办，未更新 MEMORY 中的线上状态。
- 本轮只有环境安装、验证与纯文档记录，没有实质源码改动；不把同模型子代理的只读核验当作换模型终审。后续如有实质改动，按 `AI_CONTEXT/AUDIT.md` 提醒用户进行独立审计。
