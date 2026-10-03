# AI_CONTEXT/DOMAIN.md — 三龙牌 领域铁律 + 边界

## 1. 领域铁律

- **规则纯函数**：`rules/engine.ts` 的 `createGame / applyAction / eligibleActions / projectPublic / projectSeat / projectOmniscient` 无副作用、不依赖 DOM/网络/时间；随机源可注入。表现层不得复制或改写规则判定（能力是否触发、谁领出、谁获胜）。
- **投影即真相**：UI 只读 `PublicView / SeatView / OmniscientView`；普通座位视图不含牌库顺序与他人手牌；`revealed` 列表是信息性的，不代表物理位置；`handPowerHints` 由引擎给出，UI 不自行推断。
- **提交 ≠ 接受**：拖放 / 键盘 / 点击只产生 `TableUICommand`；卡牌只有在 `actionReceipt` 与投影匹配后才在视觉上落地；重试不得更换 `action.id` 或 `revision`。
- **手势无私牌**：`HandGesture` 只带序号、悬停/选中下标、拍桌标记；永不带卡牌 id。
- **全能视图只在本机**：`OmniscientView` 永不进入 `packSeat / packPublic`；只有主持或获授权 GM 的页面可渲染它。
- **流程时序规格（v1.2）**：出牌抬起 + 加速落下（约 480 ms，落地回调只在回执被接受后触发）→ 从显示落地帧起停 1100 ms → 聚焦 420 ms（传说牌先法阵 700 ms）→ 能力说明（点击任意处关闭）→ 该牌独有特效脚本 → 金币 → 0.3 s；轮局结束：在"结算帧"（上一帧 + 公开 ScoreReport 的牌与总点数）上做特殊牌阵说明 → 桌面拼点（700 + 1000 ms）→ 计分板 → 发奖池 → 切到结算后的投影 → 结算后的金币 → 阶段变更；翻注四段（放置 250 → 翻开 360 → 拼点 700 + 打标 640 → 付款 470），全并列时用翻注帧把牌放回前注区再划掉；减少动态偏好下所有有限动画可瞬移但顺序不变。
- **卡图不变**：`art/pack-20260910/cards/*.webp`、`art/currency/*`、`art/wheel-of-fate-v1/time-dragon.png` 不改、不删、不重命名；`inventory.json` 的哈希记录保持。
- **美术来源**：禁止 AI 生成图像/音频；新增素材只允许自制、照片扫描、CC0/OFL；逐文件登记于 `docs/design/ASSETS.md`。
- **零外部请求**：打包产物不向任何外部域发请求（字体、纹理、音效、分析脚本一律自托管或不要）。

## 2. 边界 / 对外接口

| # | 接口 | 读写 | 约束 |
|---|---|---|---|
| 1 | `mountTableUI(root, deps)` ↔ 宿主页（`legacy-page.ts`、`server-page.ts`、`LocalMatch`） | UI 读 `TableView`，写 `TableUICommand` | 契约见 `protocol.ts`、`ui-command.ts`；新包必须实现旧返回对象全部方法 |
| 2 | 枭熊 SDK（`@owlbear-rodeo/sdk`） | 后台 `index.ts` 与宿主页 | 频道名 `com.fullpeople/three-dragon-ante/pack-20260910/*` 不改；弹窗尺寸由后台控制 |
| 3 | 权威服务 `server/three-dragon`（ws + SQLite） | `server-client.ts` | 协议 `server-protocol.ts` 不改 |
| 4 | 旧稳定频道 `src/modules/threeDragonAnte` | 只读兼容 | 自带旧 UI；本轮不改 |
| 5 | Vite 构建 `base=/three-dragon-ante[-dev]/`、manifest 生成 | `vite.config.ts` | 入口文件改名需同步 `index.ts` 的 `assetUrl` 与 manifest |
| 6 | 线上 `obr.dnd.center` | 不可写 | 由 Suite 部署；本仓库 push 不触发上线 |

## 3. 改这些 = 实质档（碰前确认 + 收尾必审，见 AUDIT.md）

- `rules/**`（引擎语义、投影字段、提示文案的规则含义）
- `protocol.ts`、`wire.ts`、`private-channel.ts`、`server-protocol.ts`、`gesture.ts`（协议与隐私边界）
- `controller*.ts`、`store.ts`、`index.ts`（后台控制器、持久化、弹窗生命周期）
- `server/**`
- `src/modules/threeDragonAnte/**`（旧频道兼容）
- `art/**`（卡图与素材）
- `vite.config.ts` 中入口、base、manifest 字段
- 依赖大版本升级、CI 工作流
- 本轮表现层重构整体（大范围重构）：已由用户 2026-10-03 授权在本地推进；push 仍需确认

## 4. 2026-10-04 授权范围更新

用户已授权持续实现和上线独立扩展、Suite 内三龙牌、无账号多人网站。允许为此新增服务端匿名房间接口、网站多人宿主、同源 API 构建配置和定向部署；旧 §2 的“线上不可写”及本次范围内逐次确认限制由此覆盖。规则语义、私牌投影、旧游戏协议、卡图、其他业务和另一机器的表现层工作继续保留。新接口不得放宽旧枭熊身份授权；网站 guest 模式不允许全能视图或编辑。
