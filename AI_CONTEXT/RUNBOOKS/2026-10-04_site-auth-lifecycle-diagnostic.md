# 2026-10-04 网站过期会话首次连接时序诊断（仅准备）

## 用户范围与当前边界

用户授权持续推进并要求真实查证、不得修改测试凑数。本轮只补候选完整 CI 的公共可观察性，不修改生产、规则、协议、服务端、测试断言、等待期限或操作流程，不运行浏览器、SSH、部署或推送。线上仍为已发布的 801daf5 / 0.9.1，完整 0.9.2 特效候选未发布。

先 git fetch origin 成功；开始时本地 1117450，origin/rebuild/presentation 为 3875a52，仅状态文档前进，联机工具相同。准备期间根任务纯文档提交 9eac834，本轮不合并或覆盖他人文件。

## 已取得的失败证据

精确 CI 37199170133 / 1117450 在 tools/site-multiplayer-browser.mjs 原第336行等待中文过期会话提示30秒超时，原完整联机检查此前17项通过。安全提取证据位于 .local-evidence/fx-release/ci-1117450-safe-multiplayer-diagnostic.json。未把随后采证时的过期状态认作原等待已通过，未执行或冒称后续飞牌、特效与其他步骤通过。

- owner connection11 的 upgrade 在68924ms，73925ms收到1008关闭帧，相差5001ms；原公共帧诊断未记到该连接的客户端应用数据帧。
- 浏览器对应 open 在98229ms，距 upgrade 为29305ms；close 在98631ms，wasClean=true，但旧reason白名单将实际原因归为other。1008帧、5秒间隔和无应用数据帧不能独自替代精确原因枚举，仍需新诊断确认。
- connection12 的 upgrade99140ms、首个客户端应用数据帧99143ms、1008关闭99144ms；浏览器close99146ms明确notAllowed。仅保留opcode、bytes、时间及公共关闭码，不解析或保存认证帧内容。
- 失败后的 owner 为中文expired提示且connected=false；该末态不能证明提示在原30秒窗口内出现。脚本错误、外域请求和失败资源均0。

已有证据区分服务端帧时序与浏览器回调时序，但不足以判定页面后台调度、主线程繁忙、加载、焦点或其他机制的具体因果，不猜成产品缺陷或偶发问题。

## 最小可观察性改动

仅 tools/site-multiplayer-browser.mjs：已知关闭原因白名单加入authenticationRequired。沿原native WebSocket create/open/close接线记录公共document.visibilityState、hasFocus、document.readyState、socket.readyState、时间及状态枚举；socketId是每document从1计数的匿名序号，不是玩家、房间或服务连接ID。

新增固定页面事件为init、visibilitychange、readystatechange、DOMContentLoaded、focus、blur、pageshow、pagehide。socket/page记录各最多32条，原close记录16条、TCP记录160条及原采证3秒上限保持，溢出另记数字drop计数。记录在导航/刷新时随document重置；不是跨页面完整生命周期档案，未新增MutationObserver、rAF、定时器、等待、foreground或warmup。

状态只输出none/connected/replaced/expired/failed/reconnecting/other，文本仅在内存映射为枚举；不写URL、姓名、房码、凭据、牌面、投影、HTML或像素。原expired等待前仅同步Node日志输出既有检查数、WS尝试数、TCP记录数与drop数及时间，原TCP代理/首帧追踪逐字保持。

## 准备校核与遗留

node --check与git diff --check均exit0。RAM TypeScript AST对照原1117450：assert调用81→81、wait/waitFor调用42→42、pass调用19→19、setTimeout4→4、rAF0→0，逐个表达式完全相同；这里是静态源码调用数，不替代实际完整22项运行计数。移除明确新增的诊断节点、输出字段和白名单枚举后，原完整源码（统一行尾）及AST精确复原；原upgrade代理和首次帧诊断块也完全相同。

首次准备证据 .local-evidence/fx-release/site-auth-lifecycle-prepare-T7g91t/ 保留；最终证据 .local-evidence/fx-release/site-auth-lifecycle-final-dx6BLm/ast-preservation.json 和tool.diff，含原/新SHA256、源码HEAD、限定计数与恢复证明。最终工具SHA256为3932a286a5429ad2bfee0b4dd903482079039152ee9ddb98a5daeef8e9b9bc45；相对首准备稿仅注释精确说明匿名socket序号，RAM复原首稿哈希完全匹配，最终AST也完全相同。未执行浏览器或联机测试。

遗留：待根任务与换模型独立只读审核；未stage/commit，未启动浏览器、测试服务或新CI。本轮不得把准备或AST校核当成22/22通过。下一首次有新诊断的精确Linux运行才可对齐原等待起点、首次socket回调与公共页面态，并据证据决定后续；原失败继续保留。TODO/MEMORY由根任务统一更新。
