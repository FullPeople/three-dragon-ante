# 2026-10-03 独立仓库拆分

源仓库：https://github.com/FullPeople/obr-suite

源分支：dev；完整 SHA：`54766302f88e2bd35a179f5f45124133dd9c81af`。
源独立三龙牌版本：`0.7.21-dev`。

仅从该提交的 Git 归档提取已经跟踪的文件，没有复制用户混合工作树、node_modules、构建产物、账号信息、牌局数据库或私有测试证据。
新仓库采用独立初始提交；完整原提交历史仍可通过来源 SHA 在 Suite 仓库查阅。

## 保留内容

- `extensions/three-dragon-ante/`：独立扩展、练习、三维渲染、规则、素材、历史 pack 兼容实现。
- `server/three-dragon/`：权威游戏服务、独立 ws 依赖锁和 systemd 配置示例。
- `src/modules/threeDragonAnte/`：早期稳定频道的完整兼容模块与规则，不修改存档名字或频道。
- `src/request-timeout.ts`、`src/state.ts`、`src/asset-base.ts`、`src/utils/viewportAnchor.ts`：上述代码实际引用的少量上游工具。
- `tools/`：三龙牌控制器、私牌边界、主持交接、旧牌桌恢复、时光龙与本地服务回归。
- 现有公开牌面、版权声明、许可证及三龙牌历史技术文档。

`src/state.ts` 虽保留 Suite 类型与设置声明，独立牌桌只复用语言等必要入口；未带入角色卡、地图、骰子或其它插件实现。
旧稳定模块的 index 在本仓库保留是为了兼容代码与回归可读，不注册额外后台写入端。

## 拆分适配

新增根目录 package、配置、README、AGENTS、来源记录和 CI。
保留原生产构建 base、manifest、四个页面入口、版本和 bundle 分组。
测试浏览器从仓库自身依赖加载；Windows Edge 与官方 Chromium 均可选择。
测试证据、服务构建与本地数据库改用本仓库或临时目录，解除对 D:/Temp、Codex 专用安装和相邻 web 仓库的依赖。

SOURCE.json 的 adaptedFiles 明确列出修改过的构建/测试/说明文件；其余提取文件可通过 `npm run verify:source` 逐文件核对。
游戏运行源码、服务运行源码、规则和素材未为拆分改写。

## 维护和发布边界

建仓库不等于发布。原线上安装链接、后台与 Suite 源码均保留。
未来可以在本仓库单独维护三龙牌；Suite 仍是原有复制源码，不能假设本仓库的下一次提交已经同步进去。
需要配套更新时应显式选择三龙牌提交、同步兼容代码并分别验证；不要整体覆盖稳定/新版 Suite。

历史文档按标题日期阅读，其中手动交接、纯浏览器存档及旧入口描述可能已被之后的服务器与恢复修复取代。
当前开发方法以根 README 为准，发布事实以各目标的实际回执为准。
