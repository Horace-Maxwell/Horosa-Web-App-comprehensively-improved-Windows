# 数算新技法：邵子参评数（canping）+ 河洛理数（heluo） — v2.1.9

两项「数算」模块新技法，**全部前端本地计算**：四柱来自 `astrostudyui/src/utils/baziLunarLocal.js`（星阙自己的节气精确八字，含 v2.1.8 月柱交节修复），起数/起卦/条文查找全在前端，**不调用任何 kentang / Python / Java 后端，不重编 jar**。

## 为什么纯前端
用户两条铁律：①「千万不要用他的后端，我们有自己的八字，用我们的即可」②「尽量不要接入 kentang 有关的任何后端」。早期 canping 曾做过 Python 后端（webcanpingsrv + registry），已**全部 revert**，改为下述前端实现。heluo 从一开始就走前端。

## 接入点（两技法共用，KinAstroMain 配置驱动）
`components/kinastro/KinAstroMain.js`：
- `TECHNIQUE_CONFIG` 新增 `canping` / `heluo`，均 `moduleKey:'shusuan'`、`native:true`、`showRail:true`、`tabs:[]`。
- `renderTechniqueRail()` 内 `moduleKey==='shusuan'` 的**硬编码技法列表**追加 `{key:'canping',label:'邵子参评数'}`、`{key:'heluo',label:'河洛理数'}` —— 是在既有金色 rail 上新增入口，**不是另起一条 rail**（曾误做成第二条蓝条，已纠正）。
- `fetchPan()` 顶部：`if(this.config.native){ this.requestSeq+=1; this.setState({loading:false,pan:null}); return; }` —— native 技法不走 `postKinAstro`。
- `renderCenter()` / `renderRightPanel()` 顶部各加 `serviceKey==='canping'|'heluo'` 分支，渲染原生组件（`slot="center"` / `slot="aux"`）。
- `constructor` state 加 `canpingMethod:'ming'`、`canpingLiunian:null`（canping 中右两栏受控同步用）。
- 布局沿用既有三栏：左 `renderInputPanel`（时间）/ 中 `renderCenter`（主信息·可滑动）/ 右 `renderRightPanel`（辅助）+ 金色 rail。

CSS：`layouts/app.less` 末尾 `:global { .horosa-canping-* }`、`:global { .horosa-heluo-* }`（app.less 是 CSS Module，全局类必须包 `:global{}`，否则被哈希）。

---

## 一、邵子参评数（canping，金锁银匙）
- 引擎 `utils/canpingLocal.js`，条文 `utils/data/canpingTiaowen.json`（按年纳音五部 水火木金土，每部 78 条，每条含 男命/女命/歲運）。
- 起数：`数 = 2000 + (顺数│逆数)×100 + 子上轮 + 纳音加数 + 五行配数`；顺数`=MOD(時支序−日支序,12)+1`、逆数`=14−顺`（时日顺冲双读）；子上轮`=日支序+時支序`；纳音加数 水火+27/土+50/木金+0；配数 水1火2木3金4土5。
- 日支取法两变体 + 开关：**明法**（月支反向 `MONTH_TO_DAY_PALACE`，默认）/**古法**（八字日支）；命宫=日支配卯逆数至生时；大运命宫顺行；流年太岁替日、大运替时。
- 组件 `components/shusuan/CanPingMain.js`：`slot='center'` 取法开关 + 本命 + 大运表 + 流年选择；`slot='aux'` 四柱/纳音/日宫支/命宫/起数表。中右经 KinAstroMain state 受控同步。
- 验证：文档算例（本命 2242/3242、大运 3038/2438、流年 2543/2943）全字符吻合；preview 实算 明法日宫支申→2639/2839、古法日宫支丑→2132/3332。

---

## 二、河洛理数（heluo）
引擎 `utils/heluoLocal.js`，条文 `utils/data/heluoTiaowen.json`（64 卦×6 爻）。三编：起命 / 起运 / 命运篇 + 爻辞查找。

### 起命（八字 → 卦）
1. **天干洛书纳甲数**：甲6 乙2 丙8 丁7 戊1 己9 庚3 辛4 壬6 癸2。
2. **地支河图数对**（一奇一偶）：亥子1/6 寅卯3/8 巳午2/7（注意火是 7奇2偶）申酉4/9（金 9奇4偶）辰戌丑未5/10。
3. **天数 = 全部奇数之和；地数 = 全部偶数之和**（每柱：天干一数 + 地支取该支的奇与偶各一，分别入天/地数）。
4. **归卦数**：天数去 25（满 25 用 5），地数去 30（满 30 用 3），结果 ≥10 时取个位、个位为 0 时取十位（如地数 40→去30→10→取十位 1→坎）。映射 1坎2坤3震4巽5中6乾7兑8艮9离；余 5「五数寄宫」按三元(民國年)+阴阳(年干奇偶)+男女定寄艮/坤/离/兑。
5. **相盪先天卦**：阳命=子寅辰午申戌年生；阳男阴女 天数在上/地数在下，阴男阳女 反之。
6. **元堂（动爻 1-6）**：阳时(子丑寅卯辰巳)数本卦阳爻、阴时(午未申酉戌亥)数阴爻；自下而上，`slots = (count≤3 ? M+M+O : M+O)`（M=同性爻位 bottom-up，O=异性爻位），元堂 = slots[生时在时序中的下标]。乾/坤纯卦按男女+节气半年特例；坎为水/水雷屯/水山蹇 三至尊卦后天换卦另有君位不易规则。
7. **后天卦** = 翻先天卦元堂那一爻。

### 起运
- **大限**：自先天卦元堂起、自下而上绕行六爻，阳爻9年/阴爻6年；先天行完接后天卦（同法）。虚岁（生即1）。
- **流年**：在某大限爻内逐年起值年卦。阳爻管9年（遇阳年首年本卦不变→再变两次应爻[1↔4 2↔5 3↔6]→第4年起自初爻往上累变；阴年首年先变本爻）；阴爻管6年（先变大运爻再顺推）。
- **爻辞查法**：以「本卦元堂(动爻)」之爻辞断该时段（先天卦元堂断前段、后天卦元堂断后段、各大限/流年卦动爻断各段）。

### 命运篇（判断层）
- **元气/反元气**：年干→天元气卦、年支→地元气卦（《河洛理数》元气总表）；卦在命卦（先后天的四个三才卦：下卦/下互/上互/上卦）出现即「有」。
- **化工/反化工**：按真实节气**准确**计算（非月支近似）。`HeLuoMain` 用 `lunar-javascript`（与 baziLunarLocal 同库，前端，无后端）取出生当下节气：中气四象限 春分~夏至=震/反巽、夏至~秋分=離/反坎、秋分~冬至=兌/反艮、冬至~春分=坎/反離；并据四立(立春夏秋冬)前 18 日土用补 坤艮/反乾兌（需命卦含之方应）。`heluoLocal.solarTermHuagong(prevJieQiName,tuyong)` 据 `getPrevJieQi()` 名映射象限 + `getJieQiTable()` 算四立距离判土用，结果作 `judge(...,hgOverride)` 传入；无节气信息时（单测）回退月支近似。
- **得势**（年干支∈命卦三才卦之纳甲）、**得时**（生月卦月含先/后天卦）、**得体**（日干纳甲卦在命卦出现）。
- **葉/不葉**：命卦藏任一元气或化工即「葉」。**阴阳二数**：天数对 25、地数对 30 之过/不足/得中。**元堂爻位**：当位（阳爻居奇位/阴爻居偶位）、有应（与应爻异性）、合理（阳月坐阳爻顺气）。

### 条文数据生成
`scripts/buildHeluoData.js`：从 Obsidian 源 `~/Documents/Obsidianl Vault ABCDE/玄哲/4.条文/河洛理数/` 5 个 md 解析合并为 `utils/data/heluoTiaowen.json`（按卦名+爻位 1-6 连接）。要点：5 文件均王弗序 64 卦，按索引对齐；爻位从「初/二/三/四/五/上」解析（File 2/3 用 named 式，六=阴爻极性≠位6；File 4 用 generic 式，六爻=位6）；特判 #47 困卦无 `###`（用 bullet）、兑为澤标题 verdict 无冒号。**只把生成的 JSON 入库**，脚本作可复现留痕。

### 组件
`components/shusuan/HeLuoMain.js`：`slot='center'` 先天/后天卦（卦象六爻图 + 元堂高亮 + 卦意 + 元堂爻辞[摘要+诗歌+简便]）+ 大限表（点选某段联动其流年逐年值年卦）；`slot='aux'` 四柱/天地数/先后天卦名+元堂/命运篇判断（元气·化工·得势·得时·得体·二数·元堂·判格）。AI 快照 `saveModuleAISnapshot('heluo', ...)`。

### 验证（`scripts/_heluoTest.mjs`，esbuild bundle 后 node 跑，38 断言全过）
- 甲子·丁卯·庚申·庚辰（阳男·辰时）→ 天数31→乾、地数34→巽 → 先天**天风姤**·元堂**上九**。
- 丁巳·丙午·壬寅·辛丑（阴男）→ 天数29→巽、地数40→坎 → 先天**水风井**。
- 大限：天风姤·元堂6 → 先天主 1-51 岁（六段），后天 风泽中孚·元堂3 → 52-99 岁。
- 流年：天风姤上九大限 甲子起阳年 → 姤/讼/困/兑为泽/泽雷随/泽火革/水火既济/地火明夷。
- 命运篇：壬子年命例（萃→师）→ 天元乾(命卦无→缺)、地元坎(后天师含→有)、化工坎(有)、判格葉。

### UI 二次细化（按用户反馈）
两技法中右栏全部改用 app 既有卡片 `.horosa-huangji-info-card`/`-info-heading`/`-info-row`，与其它页面统一；信息尽量铺在中右栏。
- **滚动修复**：`.horosa-huangji-board-host` 是 `align-items:center` 的 flex 行，内容超高时顶部被居中挤出且无法上滑；给 `.horosa-heluo-center`/`.horosa-canping-center` 加 `align-self:flex-start` 顶对齐解决。
- **河洛 逐段卦气**：大限/流年表每行加「卦气」列（该段卦所含 天元/地元/化工/反天元/反地元/反化 标签，`periodEnergies(lines,jg)`），点击任意行就地展开该 (卦,动爻) 的摘要+诗歌+简便爻辞（`openYao` state）。
- **参评 全表流年**：左栏「取法」下拉切换古法/明法（移出中栏）；中栏直接列 1–120 岁全表流年（`canpingLocal.liunianSeries`：逐虚岁取当年太岁支替日宫支、按虚岁定位的命宫顺行大运支替时支起数）。
- 政治人物：代码/文档算例改用「八字/卦/壬子年命例」等中性标注，不出现近现代政治人物（条文 JSON 内「邵康節」为本法宋代创始人，属源典正文，保留）。

### 三期细化（用户反馈 + 参考截图 董鴻煦 实现）
- **后天卦 bug 修复（关键）**：原仅翻元堂爻，漏了典籍「移外卦入内、内卦出外」一步；现 = 翻元堂爻 + 上下卦互换、元堂位随之 ±3。三至尊卦(坎為水/水雷屯/水山蹇) 九五阴令·上六阳令「变而不易」(只翻爻不互换、位不动)。算例：否上九→临六三、姤→中孚、坎為水九五阴令→师/阳令→比，全过。
- **起卦盘补全**（`heluoLocal.chartExtras` + `HeLuoMain`）：纳甲六亲世应（**复用 六爻/统摄法 `gua/GuaConst` 的 Gua64**，按六爻 value 匹配 + 天干内外卦补全成完整干支）、簡斷、數理季节相对得中(基数~危线)、值月消息卦(12辟卦)、氣運三候(节气内5日一候,lunar-javascript)、先後天八卦變化(乾變上=元堂三画卦+变上/中/下)、五命纳音居本位、正对卦(错)/反对卦(综)。覆卦/歸元/地合/人合/干支清浊 = 董鴻煦自有、非典籍，按用户「先略去」。
- **流月/流日 下钻**：`heluoLocal.liuYue/liuRi`（流月：阳月自元堂后一爻逐奇月累变、阴月变前奇月所变爻之应爻；流日：月卦元堂不动、逐爻在月卦上变，5卦各6日）；UI 点流年→流月、点流月→流日。算例全过(观→流月、既济→流日)。
- **倪海厦条文**：`buildHeluoData.js` 增解析 `0.易经/倪海厦易經.md` 人間道逐爻 → `nihaixia` 字段（64卦×6爻全覆盖，简繁卦名归一化），**移除原「简便」**（与正文重复）。
- **右栏 Tab**：canping/heluo 右栏改 XQTabs（heluo 命盘/命运篇；canping 命盘信息，单 tab 也保留切换条），与他页统一；大限去「卦气」列、流年加正对/反对列。
- **稳定化**：canping/heluo 注册进 `aiExport.js`(KINASTRO_EXPORT_CONTEXTS 原生项 + 分段字段表 + 别名集) + `aiAnalysisContext.js`(标签)。模块快照按前缀自动入 AI 分析 + 导出；preview 实测 localStorage 快照存在(canping/heluo)、runtime technique 解析正确。
- 验证：`scripts/_heluoTest.mjs` 49 断言全过。

### 四期细化（用户参考 董鴻煦 盘 + xlsx 澄清）
- **后天卦 bug（已于三期修，四期再核）**：翻元堂爻 + 移外卦入内（综之上下互换）；三至尊变而不易。
- **倪海厦来源更正**：用户澄清「易經推命資料」xlsx 表(A1:D65)才是倪海厦数据，**per-卦·先天(B)/后天(C)/流年(D) 三栏**，非 per-爻。已从 xlsx 抽出 `src/utils/data/heluoNihaixiaRaw.json`（脚本读 WeChat 容器内 xlsx，只入库抽出的 JSON），`buildHeluoData` 据王弗序填入 `mingtiao`；**删除原 人間道 per-爻 grab**。UI 按 slot 取：先天卦显 xiantian、后天卦 houtian、流年/月/日 liunian。
- **覆卦/互卦 定义更正**：覆卦=综(整体转180°,1↔6/2↔5/3↔4)；互卦=爻234为下卦、爻345为上卦。`heluoLocal.fuLines/huLines/duiGua`。
- **理数列**（`periodLiShu`）：流年/月/日(非大限)表新增「理数」列——对该段卦取 本卦(含)/互卦(藏)/覆卦(覆) 之四三才卦，标出所含 元气/化工(正為/反) 角色，如 含艮為天元、藏乾為地元、覆兌為化工、覆兌反天元（对照 董盘 遯九三 popup 全验证）。
- **流日 修复**：5 个日卦各管 6 日（块卦=月卦 flip(m+1..m+5)、元堂不变），**每块内动爻自初爻行至上爻、一日一爻 → 30 日**（对照 董盘 既济→屯/革/明夷/家人/蹇、家人→小畜…既济 全验证）。
- **交互拆分**：表格行点击=展开本爻爻辞(摘要+诗歌+倪海厦)；最右窄列 ▾ 箭头=下钻(大限→流年→流月→流日)。
- **布局**：中栏「起卦详情」置顶；右栏删「命运篇」tab、内容并入「命盘」单 tab；中盘彩色字体统一为 app 金/黄(去红)。
- **理数·命卦对体关系**（`guaRelations`）：流年/月/日卦若 == 先天/后天命卦的 正對(错)/反對(综覆)/互，标「本卦正對後天卦」等（对照 董盘 popup 顶标）；理数 chip 含/藏/覆 元气化工。
- **展开文字优化**：行点开的爻辞面板加内边距/底色，摘要/诗歌/倪海厦 标签作小徽标、正文行距加大。
- **稳定性端到端核验**：preview 实测 AI导出面板「数算」组列出 邵子参评数/河洛理数 + 分段字段(先天卦/后天卦/大限/起命/命运篇)；AI分析按 MODULE_SNAPSHOT_PREFIX + `normalizeTechniqueKey/getTechniqueAliasList`(canping/heluo 直通) + 标签收快照；localStorage 快照(canping/heluo)稳定写入。`_heluoTest.mjs` 59 断言全过。
