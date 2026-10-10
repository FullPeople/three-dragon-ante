# 三龙牌域名迁移与邀请文案

用户已授权将网站从 `obr.dnd.center/three-dragon-ante-dev/` 迁到 `dnd.center`，删除旧网站并更新新旧独立插件入口。用户随后指定短路径为 `3-dragon`。

- 正式网站：`https://dnd.center/3-dragon/`。
- 正式插件安装地址：`https://dnd.center/3-dragon/manifest.json`。
- 邀请文案：`xxx邀请你来一把三龙牌！（当前人数）（链接）`。名字取点击复制的玩家名字，人数取服务端最新牌桌座位数，观众不计入。
- 无剪贴板权限时，输入框选中完整邀请文案供手动复制；不显示“已复制”。
- 使用现有 `062dd411cab2` 线上功能基线，只更新入口、邀请文案与构建版本，保留规则、协议、素材、服务与 SQLite。
- `npm run build:website` 生成 `/3-dragon/` 资源路径；常规扩展构建保留原安装路径，以兼容已安装的插件。
- 新域名的 API 和 WebSocket 转发到同一个服务。Nginx 仅将来自 `https://dnd.center` 的 Origin 映射为服务现有允许的 Origin；其他 Origin 原样交由服务校验，无须重启服务。
- 原网址根入口、`index.html`、`table.html`、`practice.html` 保留查询参数并跳转到新网站；旧目录只保留清单、图标、空后台和指向新网站的启动页。旧网站资源移出公开目录，完整回滚副本保存在服务器私有目录。
- Suite 新旧版只修改三龙牌入口。旧版历史牌局恢复入口继续保留。

线上发布先建立独立回滚副本并开放新网站，完成真实 HTTPS/WSS 双浏览器和复制邀请检查后，再移除旧网站资源。最终检查结果及回滚位置记录在服务器 `/root/codex-release-receipts/3-dragon-domain-20261008.json`。自动浏览器检查不代替真实枭熊账号、原玩家设备或实体手机验收。
