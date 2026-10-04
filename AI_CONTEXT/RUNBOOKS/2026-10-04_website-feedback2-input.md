# 2026-10-04 术士选择位置与快速切牌拖动反馈

## 范围与基线

本轮用户实际反馈：术士触发后放置在场上的前注实体挡住视野；先选 A 再快速拖 B，偶发拖走或打出 A。用户随后明确纠正前者是场上前注牌，不是选择 UI。隔离目录 `U:/CodexWork/2026-10-04/three-dragon-website-feedback2-7e64866`，起点 `7e64866`；当前线上仍 `801daf580e9505a377dc97a544c4ad051ea029ac / 0.9.1`。本记录只涵盖这两项表现层查证与修复，不修改规则、协议、服务端、卡图、旧模块，也不代表上传或部署。

## 源码查证

- `revealed` 公开牌当前没有独立 `cardPlacements` 节点；术士的三张选项来自通用 `ChoicePanel`，该面板原样式 `left:50%; top:14%; width:min(820px,...)`。选择卡片悬停还会打开右侧 `CardInspector`。需要真实 DOM 几何查明哪一层遮挡，不能把桌心遮挡预先归因于不存在的揭示卡节点。
- 拖动闭包保存 `pointerdown` 的 `cardId`，松手调用 `controller.drop(cardId,zone)`；点击区域另走 `placeSelected()`。`CardNode` 的悬停、选中、拖动均使用同一 `raised=100`，后排选中卡可能继续盖住前排悬停卡。这些是待验证路径，尚不能作为已证实根因。

## 专项工具

新增 `tools/website-feedback2-input-browser.mjs`：原 `mountTableUI`、原控制器与合法纯引擎动作；两个视口（1440×900、390×844）；术士两至六座；普通浏览器 mouse 输入及真实控制器提交。

`--prepare` 只寻找合法 seed 并静态构建，不启动浏览器；`--baseline --diagnose` 仅用 `git show 7e64866` 对照目标表现文件，记录真实指针命中、控制器路径和数字手牌位置；正式模式检验拖 B 只提交 B、错 nonce 不接受、匹配 ACK 清 pending、暂停/断线/销毁后的拖动不提交，以及术士选项和确认按钮实际命中。产物只在 ignored `.local-evidence/website-feedback2-input/`，不保存牌局快照或私牌 JSON。记录六目标文件构建前后 SHA 与替换源码 SHA，避免把并行任务的 HEAD 留痕当成旧版表现代码。

首轮 `baseline-JjBjvS` 完整退出且零脚本/外域/资源失败。6 组暴露边缘拖动均真实 down B4 → drop B4 → 唯一 ante B4，没有误拖 A；10 组选择控件可点。该选择 UI 几何不是用户实际前注问题的证据。曾静态尝试的术士选择 dock 已全部撤回，ChoicePanel 与选择相关 CSS 恢复原样，保留并行根任务的 editor CSS。

## 修正方向后的实体反例

- `.local-evidence/website-feedback2-input/baseline-A18y48/result.json`：原 `7e64866` 布局、合法术士替换及新能力结算完成，2–6 座 × 1440/390 共 10 组；每组 revealed 为 0，术士已不在牌阵，其余两张已合法进入无座位归属的共同前注。仅诊断时隐藏选择 UI/详视/能力覆盖层，未改生产 UI。
- 两张实际 neutral ante 均盖住本家 flight 的上部，每张与 flight 的交叠区域 25/25 真实 `elementsFromPoint` 采样显示 neutral 在前；同时覆盖 deck/discard。桌面实体约 77×129，覆盖 flight 约 51px；390 实体约 48×87，覆盖 flight 约 42px。完全合成的截图保存在同一 ignored 目录，未保存玩家牌局或私牌 JSON。
- 横屏旧位置 `(900,650)`、竖屏旧位置 `(550,960)`、scale 0.9，是共同前注实际压住近端牌阵和中央牌堆的已复现路径。最终最小修改仅 `model/layout.ts`：横屏共同前注 `(550,490)` / scale 0.5；竖屏 `(850,1080)` / scale 0.55，更多公开牌时限定排位宽度并保留可点击边缘。不改变牌的归属、区域、身份、能力替换或结算顺序。
- 竖屏首候选 `(550,450)` 在 `run-pdWlzq` 的两座公共牌点击匹配失败：实体 y296–338，悬停打开现有顶部 inspector copy 后挡回自己。该失败完整保留，未使用 force 点击或放宽断言。最终改至近端牌阵右侧的空白处，避开中央 stakes/hole 同列。
- `run-LzpckY` 新实体专项完整通过：2–6 座、两视口共 10 组、20 次每张公共牌的真实 click → 正确 inspector。所有座位手牌、带归属前注、牌阵、姓名/点数铭牌、牌库、弃牌堆、奖池、偿债池、金币区域均纳入交叠与实际穿透检查，没有 neutral 遮挡采样。截图完全合成，仍未验实体手机。

## 拖动查证进展

`baseline-59nr0l` 的进入 B4 暴露边缘 → B4 卡面中心 → 拖出，六组仍全部正确 B4，不称复现。10 张扇面相邻中心约相差 94 而卡宽约 140，中心点不处于相邻重叠区。

`baseline-xQshRZ` 新 B 右侧 82% 重叠区普通鼠标路径真实 6/6 复现：A5 已选 → hover B4 可见边缘 → 快速移入 B4 的重叠部分 → hover 转为 A5 → pointerdown A5 → drop A5 → 唯一提交 ante A5。实际错误发生在 DOM 命中层；控制器收到的始终是 A，不能说控制器把已收到的 B 偷换成 A。该运行 before/after 六源 SHA 全一致；其后的根任务 Omni 私选遮罩更改不回写该证据。

修复仅 `CardNode` 的手牌遮挡优先级：drag 300、hover 200、selected 100，维持同类内原手牌 order，当前鼠标所指牌盖住此前已选牌。未改 TableScene、控制器、规则、协议或回执机制。

## 最终综合验收

`.local-evidence/website-feedback2-input/run-wySPpw/result.json`，`node tools/website-feedback2-input-browser.mjs --drag-center` 完整 12 个分组通过并自然退出。10 组共同前注实体位置/真实点击详视；中心与 82% × 0/25/180ms × 两视口共 12 组快速切牌，全都实际 down B4、唯一提交 B4；提交和错 nonce 时未落地，匹配 ACK 后仅 B 在 ante 落地一次。两视口 suspension/disconnect/destroy 共 6 次活跃拖动不提交；两次 Chrome 原生 touchCancel 实际 pointercancel 不提交；10 次原术士 choose/confirm 保持合法替换。零脚本错、外域请求、失败资源，六源 before/after SHA 全一致。

最初 `baseline-xtI3VO` 的公共 inspector × 关闭控件被 card pointerleave 卸载导致 30s timeout 原样保留；工具改用产品已有的普通 Escape 关闭，实体点击与匹配 inspector 检查保持，不把该旧公共预览关闭问题包装成本次产品修复。

现场只改两项运行源码（layout、CardNode），每阶段工具/runbook 合计四文件；`git diff 801daf580..7e64866 -- model/layout.ts scene/CardNode.tsx` 为空，已核验本次两项旧表现代码也对应当前线上 0.9.1 代码。全仓构建/原回归、独立审计、精确 CI 与冻结发布由根任务继续，不以此本地合成专项冒称完成。

新工具为自身进程和浏览器使用 ignored U 目录的 TEMP/TMP，不改系统设置、不删除 C 缓存。Node 语法检查通过，构建与浏览器按根任务独占窗口顺序执行。
