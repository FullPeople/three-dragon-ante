# 三龙牌 · Three-Dragon Ante

三龙牌的独立源码仓库：包含网页练习、Owlbear Rodeo 独立扩展、三维牌桌、纯规则引擎、权威游戏服务，以及读取历史牌桌所需的兼容源码。

本仓库由 `FullPeople/obr-suite` 的 `dev` 分支拆出，固定来源提交为
[`54766302f88e2bd35a179f5f45124133dd9c81af`](https://github.com/FullPeople/obr-suite/commit/54766302f88e2bd35a179f5f45124133dd9c81af)。
三龙牌前端版本保留 `0.7.21-dev`，本次建仓库没有部署或改变线上牌局。

## 安装与本地体验

使用 **Node.js 22.17+**，推荐 `.nvmrc` 中的 22.17.1。所有命令从本仓库根目录执行，不需要 Suite 或 DND-card-web 的相邻工作树。

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

打开 <http://127.0.0.1:5173/three-dragon-ante-dev/practice.html>。
练习模式无需账号、房间或游戏服务器；它不会读写线上牌局，刷新会重新开始。

构建输出为 `extensions/three-dragon-ante/dist/`。`npm run preview` 可以预览实际生产构建，端口为 4173。

已有线上入口：

- [独立插件安装地址](https://obr.dnd.center/three-dragon-ante-dev/manifest.json)
- [网页练习](https://obr.dnd.center/three-dragon-ante-dev/practice.html)

## 多人游戏服务

```sh
npm ci --ignore-scripts --prefix server/three-dragon
npm run build:server
npm run dev:server
```

本地服务监听 `127.0.0.1:5013`，测试存档位于被 Git 忽略的 `.local-data/game.sqlite`。
把 `.env.example` 复制为 `.env.local`，再启动前端，即可让前端请求本地代理 API。
真实枭熊扩展需要可访问的 HTTPS/WSS 地址与正确的 `TDA_ORIGIN`；本地网页练习不等于独立账号登录或多人服务。

服务使用现有规则引擎、WebSocket 和 SQLite WAL。提交成功才确认动作；重复动作不会重复执行。
身份准入由枭熊真实连接确认，GM 权限有租约；私牌只发送给对应玩家或获得授权的私有查看者。
生产部署配置示例保留于 `server/three-dragon/obr-three-dragon.service`，本次不安装或运行生产服务。

## 最近保留的修复

- 旧大厅主持与旧座位均离线时，经过宽限时间允许当前 GM 接管；在线老座位保持优先级。
- 多窗口、多候选人竞争、重连和权限变化时再次核对主持资格。
- Suite 历史牌桌兼容入口与独立插件各用对应频道，避免两个写入端争用历史牌桌。
- 旧版本地消息处理使用当前连接身份，拒绝旧连接与销毁后迟到的结果。
- 进行中的历史牌局缺少私有存档时显示恢复提示，保留记录，不清桌、不编造手牌。
- 新服务器牌局保留断线主持自动交接、状态与私牌持久化、动作幂等和恢复逻辑。

`extensions/three-dragon-ante/src/game/` 为当前实现；`src/modules/threeDragonAnte/` 为早期稳定频道兼容源码。
后者仍使用原来的房间键、IndexedDB 名称和规则，不能把旧进行中牌局当作空大厅重新创建。
独立扩展不会自动接管 Suite 的历史频道。拆出源码也不会自动让 Suite 改用本仓库。

## 验证

```sh
npm run verify:source
npm test
npm run test:server
npm run test:browser
npm run test:server-browser
```

先完成两份依赖安装、前端和服务端构建。Windows 默认使用已安装的 Edge；其他系统先执行
`npx playwright install chromium`，使用官方 Playwright Chromium。
可设置 `PLAYWRIGHT_CHANNEL` 或 `TDA_BROWSER` 指定浏览器。

`npm test` 包含私牌泄露与故意变异检查、控制器、主持交接、两代旧牌桌恢复、连接身份和时光龙回归。
服务测试使用真实本地 WebSocket、SQLite 与事务失败注入。
浏览器测试覆盖生产构建练习入口及本地多人 UI；枭熊身份边界是夹具，不等同真实账号房间验收。
本机证据保留于 `.local-evidence/` 或系统临时目录，不上传玩家数据。

更多历史渲染与教程测试保留在源码目录的 `*-selftest.mjs` 中，没有全部纳入本次拆分验收。
实际通过项和限制见 [docs/STATUS.md](docs/STATUS.md)。

## 来源与许可

保留原仓库的 GPL-3.0 许可证与作者信息。Three.js 的 MIT 许可保留于前端 `public/THREE-LICENSE.txt`。
牌面扫描、原印刷版权说明和参考素材沿用原公开源码，不宣称其为本项目原创或由 GPL 授权；二次发布素材应遵守各自权利要求。

[SOURCE.json](SOURCE.json) 记录拆分来源与文件 SHA-256；[docs/EXTRACTION.md](docs/EXTRACTION.md) 解释目录与维护边界。
上游历史提交继续保留在原仓库，本仓库首个提交是注明精确来源的独立快照。
