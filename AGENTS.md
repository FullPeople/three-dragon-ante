# 三龙牌 Three-Dragon Ante · 项目入口（Codex）

> 🧭 **跨 AI 通用工作流**：通用纪律见全局 `~/.codex/AGENTS.md`（自动加载）。
> 冷启动先读 `AI_CONTEXT/INDEX.md`，再读 `AI_CONTEXT/GOAL.md`。规约与 `CLAUDE.md` 一致。
>
> 独立运行网站为核心、枭熊扩展为次要适配的三龙牌网页实现。2026-10-03 起表现层破坏性重构（分支 `rebuild/presentation`）；规则 / 协议 / 控制器 / 服务端不动。
> 最高边界：规则纯函数；投影不泄私牌；卡图不改不删；不用 AI 美术；产物零外部请求；push / 合并 / 部署前经用户确认。
>
> 下面是 2026-10-03 拆分建仓时的上游约束原文，仍然有效（其中“不修改游戏运行源码”一条已被本次重构明确推翻，见 `AI_CONTEXT/GOAL.md`）。

---

# Three-Dragon Ante

Read README.md, docs/EXTRACTION.md and docs/STATUS.md first. SOURCE.json pins the
exact source extracted from FullPeople/obr-suite. Historical documents describe
their own dates and do not override the current implementation or release receipt.

- Keep this repository independent of DND-card-web and Full Suite builds.
- Preserve rules, room/message namespaces, private database names and artwork
  attribution. Do not hot-migrate an active game or invent missing private hands.
- Rules remain pure. Transport, storage and renderers have distinct ownership.
- Public and seat projections must not contain deck order or opponents' hands.
  Omniscient information requires existing authorization and its private channel.
- Imports and actions validate before mutation; acknowledge only committed saves.
- Include no player files, account credentials, room dumps or live SQLite data.
- Test Node 22.17+ builds, privacy, controllers and service transactions. Browser
  fixtures and practice tests do not prove real Owlbear multi-account behavior.
- Windows browser tests use installed Edge; other systems use official
  Playwright Chromium. Do not require a Codex runtime or sibling repository.
- The initial extraction does not deploy or remove the existing Suite copy.
  Later publishing requires explicit user authorization for that release.
