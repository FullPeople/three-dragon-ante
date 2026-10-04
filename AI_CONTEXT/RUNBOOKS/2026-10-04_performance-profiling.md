# 2026-10-04：首次有界 hover/drag profiling

执行/分析模型：gpt-6.1-sol。只在根代理明确交付的唯一 CPU/浏览器窗口执行一次；没有性能产品修复、原 benchmark 修改、重跑、部署或提交。本记录是下一次受控定位的依据，不表示卡顿问题完成。

## 来源与采集边界

先 `git fetch --prune origin`，exit 0；开始和结束 HEAD 均 `1117450e884a6bd9e47f805ca08fb6ab382c68e3`，产品与已审 runtime d580 相同。运行前 tracked clean。根代理审过 ignored wrapper/hook 后，执行唯一 `node .local-evidence/performance-profiling/profile-benchmark.mjs --run`，exit 0。原工具正常 finally 逐一 await 两 context 和 HTTP server close，再 await browser.close；Node 正常结束，未追加浏览器运行。

| 对象 | SHA256 / 证据 |
| --- | --- |
| 原 tools/performance-compare-browser.mjs | `58a9b5cbf2c177012408eda8a47e306af295815a69a43c39a66c908703b68273` |
| ignored profile-benchmark.mjs | `49d8e15cf7455cdf1a407da00216677ba5c81e59995a297e5284e899a7fe1ec8` |
| ignored profile-hooks.mjs | `966ef1decf3e8cad9539b6390623916fae95668827be42d161d51746e8cc8fbb` |
| 本次实际生成 benchmark.instrumented.mjs | `0ac7246e93247edbbd294b2753948206ef18c7c927ae67d951c9ceb00614b69d` |
| 来源/插点证明/8 产品 hash | `.local-evidence/performance-profiling/run-nDHg9Z/preparation.json` |
| 有界诊断 | 同目录 `profiling-summary.json` |
| 本次原 benchmark 输出 | `.local-evidence/performance-compare/run-RUi1DO/result.json` |

生成模块 hash 与 prepare-HW0m4X 不同，仅因实际 ignored 输出目录重新生成；不能用旧 prepare hash 冒充执行文件。反向移除声明的插点和 import/root 重定位可逐字还原原工具；37 assert、15 mouse 调用、11 waits、原 18 样本计划 AST 保持。两 variant、六合法席位/十二 flight/八 own hand、固定金额、1440×900/DPR1、软件 GL flags、原输入/等待/阈值保持；共同 `?fx3d=0`，Three.js FX 关闭而 WebGL2 桌面材质仍真实启用。

仅 candidate trial1 的 hover 和 drag 打开 CDP Profiler/Tracing。原完整 18 样本仍执行，5/5 checks，errors/external 均 0；两诊断 capture 完成，candidate mark 和 renderer-main 均确认，无 deadline、截断或 reduction cap。Profiler、Tracing、透明计数及 marker 都有开销，本次 FPS 不能替代此前未插桩 run-MWt1Sc，更不能用于用户设备性能验收或证明改善。原输出中本次 candidate hover#1 4.96 FPS / p95 450ms，drag#1 35.5 FPS / p95 50.1ms，均仅是插桩时的上下文。

原生计数与 page-target CPU profile 只针对 candidate。Tracing 是 browser-wide，原全局 aggregates 同时包含两 fixture 和浏览器进程；只有 candidate 独有 `tda-profile:profile-start` mark 的 pid/tid 在 RAM 定位，并由 CrRendererMain 元数据确认后，才输出独立 candidateRendererAggregates。GPU/raster/compositor 一直保持全局口径，不归因于 candidate。PID/TID、URL、原始 trace/profile、event args、DOM、截图和输入参数均未落盘；仅固定事件/相位/角色枚举、数字与受限 function enum/line/column 持久化。角色未确认会将诊断标为未完成。

## 真实事件与相位

下表只看已确认的 candidate renderer-main；时间是事件持续量，事件可能嵌套，不能相加成总 CPU 时间。相位按事件开始时刻归类，不裁剪跨边界持续量；Paint count 是事件条数，不能称为对应数量的唯一 DOM 节点。

| candidate 事件 | hover 首 500ms：count / dur / max ms | hover 后段：count / dur / max ms | drag 首 500ms：count / dur / max ms | drag 后段：count / dur / max ms |
| --- | --- | --- | --- | --- |
| FunctionCall | 28 / 0.952 / 0.371 | 120 / 41.478 / 25.122 | 23 / 10.472 / 4.560 | 250 / 78.885 / 5.922 |
| UpdateLayoutTree | 5 / 2.463 / 0.872 | 5 / 4.082 / 1.604 | 3 / 0.293 / 0.112 | 12 / 1.506 / 0.237 |
| Layout | 3 / 21.639 / 10.100 | 5 / 13.356 / 4.154 | 2 / 0.091 / 0.059 | 12 / 0.589 / 0.113 |
| Paint | 246 / 28.272 / 5.797 | 490 / 58.255 / 7.402 | 4 / 1.202 / 0.639 | 22 / 3.936 / 0.448 |
| FireAnimationFrame | 4 / 0.207 / 0.067 | 6 / 0.810 / 0.624 | 3 / 10.106 / 5.662 | 82 / 76.335 / 7.735 |

整个 hover capture：Paint 981 / 200.784ms / max23.467ms，其中 measurement-complete 后还有245 / 114.257ms；Layout9 / 35.182ms / max10.1ms，EventDispatch66 / 61.228ms / max25.429ms。整个 drag：Paint35 / 7.134ms / max0.639ms，Layout21 / 4.785ms / max1.93ms，FunctionCall445 / 149.589ms / max14.901ms。hover 的绘制事件增加在后段仍存在，不能归为仅初始上传或首次布局。

两 capture 原生 counter 起止完全相同：surface texImage2D=18、surface drawArrays=13、coin drawImage=256，增量全部 0。因此本次长间隔并未伴随新的被计数桌面纹理上传、桌面 drawArrays 或 CoinStack 画布重烘焙调用；这不能排除已存在 canvas/卡图的合成、软件 GL 工作或原生计数未覆盖的操作。

hover 浏览器 marker：armed623.497ms、first-sample-raf631.896ms、complete2646.549ms；测量 rAF 间隔含133.4、433.3、450、416.7、400ms，长间隔不是只在开头。Node mouse.move 往返有220.99、393.58、448.03、407.10、457.52ms；浏览器 pointermove 仅8条（含测量前后），原测量内6条，说明真实输入是等待式 CDP 往返，不能当固定频率/相同数量工作负载。时间共现不足以判定 Playwright、renderer 或软件合成谁导致谁。

drag marker：armed1050.903ms、first-sample-raf1380.894ms、complete3379.048ms，armed→首回调约330ms；第一个测量 rAF 间隔450ms，后段多为16.7/33.3/50ms。相应初始 mouse.move 往返431.45、351.89、603.97ms；本次只能定位初始输入/首帧边界存在长等待，不能把这直接命名为 controller 的长事务。

## CPU 栈与全局限制

hover page-target profile 时长3291.072ms：idle stack2787.316ms，program444.722ms，GC20.837ms；剩余已记录 JS 栈单组最大6.399ms。drag 时长4213.876ms：idle3355.318ms，program735.560ms，GC48.821ms；JS 栈单组最大13.344ms。采样 idle/program 是 profiler 分类，不能据此计算实际硬件 CPU 利用率，也不证明所有原生等待都已观测。

具体已保留但无法唯一映射到原 TS 源的 minified 栈：hover `compiled-bundle` line9/column71 6.399ms（1 sample），line103/column6785 6.221ms（1 sample）；drag `compiled-bundle` line8/column10671 13.344ms（2 samples），line9/column7995 6.200ms（2 samples）。line/column 为 CDP 原始零起始值，function 均落入 other-function 白名单桶；未持久化 URL/函数文本、未开 sourcemap，不能把它们冒称 TableScene/controller 的已证实热函数。

browser-wide RasterTask：hover742条 / 107.351ms / max29.497ms，首500ms186 / 10.290ms，后段371 / 78.732ms；drag32条 / 2.913ms / max0.577ms。全局 compositor DrawFrame hover13、drag24，duration0属于计数事件，不能解释为零合成耗时。此次固定事件白名单未收集到 GPUTask/GPU.ProcessCommands/UploadImage 的记录；不是 GPU 无工作的证据，不可将全局 RasterTask 归成 candidate 或具体卡牌成本。

## 阶段结论与下一步边界

已经排除的窄假设：本次长帧由新增被计数的桌面纹理上传、桌面重绘或 CoinStack 重烘焙直接触发。尚未证实：renderer JS/controller 长事务、具体卡牌/inspect CSS 节点、GPU 等待、软件 GL 阻塞、Playwright 输入成本或后台 control fixture 贡献。candidate hover 有明显绘制事件增多，但其单次最大耗时与400ms级 rAF/输入间隔不等价，证据不足以直接修 CSS/React。

下一次需根代理单独授权的隔离对照：先保留原 source/fixture/输入/断言及期限，只改变 GPU backend flags 并真实记录 renderer 分类，检验软件 backend 与间隔的关系；不能以 default flags 自动宣称物理硬件 GPU。若继续定位 Paint，应在 RAM 将节点/layer 归入固定公开角色并输出有界 count/面积/时间，补完当前缺失的绘制归属；每次只改一个变量。不盲重跑原18样本，不删断言或阈值，不把当前平均 FPS 当完成。

根代理统一处理 TODO/MEMORY 和发布门槛。本代理仅新增本 runbook，未 stage/commit；ignored wrapper、hook 和原 benchmark 的执行前后 SHA 均相同，8 产品 hash 均与 preparation.json 一致。
