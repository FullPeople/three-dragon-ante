# 2026-10-05：四项网站反馈候选的 FX 阻塞与数值取证

## 已查证状态与发布边界

用户纠正的术士问题是桌面上的共同前注实体遮挡，而不是选择 UI。实体位置/层级及快拖修复在 c955171；本批观战、全能默认牌背与独立牌堆排序在 e934fbb。后续 0588/447/a91/971 仅工具与留痕调整，不改变这些产品源码。线上仍为 801daf580e9505a377dc97a544c4ad051ea029ac / 0.9.1(-dev)，本批尚未部署。

精确冻结 971a33e2b7b8b80ac378cc57d26296528b64b864 的首次 [CI 37213956287](https://github.com/FullPeople/three-dragon-ante/actions/runs/37213956287) 实际第 1–31 步通过，包括新增 input12、观战13/13、牌堆10、controls19、原全能13、原多人22、unit8/server2、browser15/server-browser4。第32步 FX 在7项后失败：candidate 最后为 medium，不等于原要求 high；后续6个检查 skipped，不称完整通过。一次下载的日志/artifact在 ignored `.local-evidence/feedback2/ci-971-*`。

原始 render-chain：baseline25真实tick/405ms/max4；candidate25真实tick/2922ms/max1/effectsAfter0，tier medium；真实驻留+四束光 workload16帧/max1/effectsAfter0，亦未达到原 frames>20。实际舞台 EMA>28ms 持续1.5s降一档，手动high只决定起始档；未记录逐帧间隔，不能精确归因或把符合设计的降档称权限/规则缺陷。保留所有原断言，不冻结 governor，不造时钟，不重跑原样 CI 凑绿。

本机原多人完整 run-XbkIzE 22/22 exit0；与本次Linux22分别成立，均不能证明历史0588的23.8s握手延迟根因已修。971冻结两网站973文件/450 Git源码/GPL包经根checker及换模型独立审阅通过，根checker1948 tar记录/1正11负，remoteVerification=false；包SHA c72c18debe5f5953e8ea08a69c5584e82bac47e318297278a62f6191d2e12a1a，sourceZIP afced4c3f56326e294d7e14df9bd1c7a5f1686aac4131e8c448022234b12e099。CI失败，因此该包及此前三个包全部 held，无上传/apply/restart。

新只读SSH inspect退出0，ignored preflight-971.json：两个三龙牌网站与三龙牌server保持旧部署，Suite保持；suite-dev/card文件与nginx/obr-workbench-relay-dev运行态相对旧before有变化，受保护配置文件未变。变更来源未知，不沿用旧baseline部署，不覆盖这些新状态；发布前须重新确认稳定且逐项保全。此轮没有其他远端写操作。

## 仅测试工具的观察增量

先git fetch origin退出0，工作树干净。仅 tools/fx3d-alignment-check.mjs 添加有界数字profile：真实 air/ground renderer 调用前后 performance.now、原 native rAF 时间戳/间隔/回调延迟、实际tier、canvas drawingbuffer尺寸/DPR/antialias和renderer.info绘制计数。每段最多256行；单轮 longtask最多64条，仅startTime/duration。无DOM文本、牌ID、投影、姓名、房间码、headers、token或密钥。

wrapper以Reflect.apply透传原this/参数/返回/异常；在原finally恢复 air/ground 方法、断开observer，既有真实effect/dispose/drain/adaptive/cleanup不变。每帧观察有少量计时与对象分配开销，不能称零扰动，renderMs仅JS侧调用耗时，不能当作GPU耗时或实体设备FPS。

机械AST核对：原28 assert、7 page/locator wait、6 pass、4 setTimeout表达式全部同序逐字保持，proof为ignored fx-timing-gates.json；原350/600/2600ms真实workload及其公共输入保持，未加等待/改变效果寿命或门槛。语法与diffcheck退出0。

首次本机正式原FX run-R548Jm 9/9 exit0：baseline25tick/983.4ms/max4；candidate25tick/1056ms/max1/high/effects0；workload38帧/max1/effects0。相机误差desktop<0.009px/narrow<0.004px、可见与卡命中均true，软件不强开仍canvas2d、错误/外域0。candidate air/ground最大调用1.6/0.3ms、最大gap50.1ms；workload最大调用272.8/73.5ms。两舞台drawingbuffer air1440×749/ground1035×633、DPR1。只证明本机观察增量可运行与原门禁通过，不代替失败Linux、完整CI、性能改善或公网。

## 遗留（同步TODO）

053eada776ddcbf65da89eba3011118651995dbf首次精确CI37216297279/job111477385559：原前31步再次通过，FX7/9仍medium≠high，后6步skipped。一次下载日志/artifact ci-053-*；真实run-qtpvCJ记录initialhigh→medium、25帧2161.1ms/max1/effects0，空场air/ground最大调用1.7/2.4ms、gap216.6ms；workload18帧，从medium降low，最大调用363.4/229.3ms。空场draw calls均0，调用短不代表GPU/合成已排除；长帧具体原因仍未知，原门槛完整保留，没有重跑此CI或部署。

为了落实用户“优先部署已修bug”，新隔离release/website-feedback-hotfix-20261005从线上801仅移植四反馈与必要权限pending已审delta，原FX及原23CI命令保持+6新专项，另做新分支全验收/审计/发布。路径U:/CodexWork/2026-10-05/three-dragon-feedback-hotfix-801，正本该分支RUNBOOKS/2026-10-05_website-feedback-hotfix.md。该范围原相机4不代替本组合9，不据其成功称附件FX已验收。组合候选0.9.3与四个包仍held。

第二次只读inspect preflight-053eada.json实际exit0：与971静态四目标/card/配置/server完全一致；obr-workbench-relay-dev PID/起始时间改变且active，来源未知。比较一度读取未完成的本地重定向JSON失败，待SSH正常完成才读完整JSON；后续把services字符串误当dict导致AttributeError，按实际systemctl固定字符串比较纠正。两辅助错误无远端写操作或产品影响，不能将失败读取当成功保全。发布仍需fresh稳定snapshot。

gpt-6.1-sol/high独立只读复核本增量通过，无必须整改项；独立机械核对28/7/6/4原表达式同序保持，真实RAF/24tick目标/三nestedadd/workload保持，正常及异常清理可恢复原方法。实际工具SHA a29a86446b4818a767979929dd8f26286f82a53fb3ed7cab2e4dcbe61dedb01c。callbackDelay包括同native timestamp到此调用之间其他主线程工作；observer未交付尾部及64条上限可漏longtask，因此“没有记录”不能排除阻塞。审计只代表工具准备，不代表Linux失败已修或最终可发布。

- 新诊断源码首次精确Linux CI，定位原2922ms与workload16的原因，保持原断言与时限。
- 通过后新冻结完整CI、发布终审/GPL包；重新读取并保全已变化的受保护线上状态，只部署双网站与必要三龙牌服务，独立after核验及公网原/新功能验收。
- 实体手机/弱设备与真实玩家体验仍未验收。所有held包不得冒称上线或沿用另一SHA的CI/审计。
