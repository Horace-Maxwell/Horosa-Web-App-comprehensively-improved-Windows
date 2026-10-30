// AI 导出 · 段表与常量:符号替换表、设置版本与迁移并集、各技法预设段、禁段、独立记号映射。
// 由 utils/aiExport.js 门面统一对外导出。

export const SYMBOL_MAP = {
	'☉': '日',
	'☽': '月',
	'☿': '水',
	'♀': '金',
	'♂': '火',
	'♃': '木',
	'♄': '土',
	'♅': '天王',
	'♆': '海王',
	'♇': '冥王',
	'⚷': '凯龙',
	'☊': '北交',
	'☋': '南交',
	'⊗': '福点',
	'♈': '白羊',
	'♉': '金牛',
	'♊': '双子',
	'♋': '巨蟹',
	'♌': '狮子',
	'♍': '处女',
	'♎': '天秤',
	'♏': '天蝎',
	'♐': '射手',
	'♑': '摩羯',
	'♒': '水瓶',
	'♓': '双鱼',
	'☌': '0˚',
	'⚹': '60˚',
	'✶': '60˚',
	'□': '90˚',
	'△': '120˚',
	'☍': '180˚',
	'⚊': '阳爻',
	'⚋': '阴爻',
	'☰': '乾卦',
	'☱': '兑卦',
	'☲': '离卦',
	'☳': '震卦',
	'☴': '巽卦',
	'☵': '坎卦',
	'☶': '艮卦',
	'☷': '坤卦',
	'☯': '阴阳',
};

export const COMMON_REPLACERS = [
	{ regex: /\bConjunction\b/gi, value: '0˚' },
	{ regex: /\bSextile\b/gi, value: '60˚' },
	{ regex: /\bSquare\b/gi, value: '90˚' },
	{ regex: /\bTrine\b/gi, value: '120˚' },
	{ regex: /\bOpposition\b/gi, value: '180˚' },
	{ regex: /\bRetrograde\b/gi, value: '逆行' },
	{ regex: /\bDirect\b/gi, value: '顺行' },
	{ regex: /\bruler\b/gi, value: '本垣' },
	{ regex: /\bexalt\b/gi, value: '擢升' },
	{ regex: /\bterm\b/gi, value: '界' },
	{ regex: /\bface\b/gi, value: '十度' },
	{ regex: /\bfall\b/gi, value: '落陷' },
];

export const DOMAIN_REPLACERS = {
	sixyao: [
		{ regex: /老阳/g, value: '阳爻(动)' },
		{ regex: /老阴/g, value: '阴爻(动)' },
		{ regex: /少阳/g, value: '阳爻(静)' },
		{ regex: /少阴/g, value: '阴爻(静)' },
		{ regex: /初爻/g, value: '第一爻' },
		{ regex: /上爻/g, value: '第六爻' },
		{ regex: /旬空/g, value: '旬空(空亡)' },
	],
	liureng: [
		{ regex: /旬空/g, value: '旬空(空亡)' },
		{ regex: /三传/g, value: '三传(初传/中传/末传)' },
		{ regex: /贵人/g, value: '贵人(天乙贵人体系)' },
	],
	jinkou: [
		{ regex: /旬空/g, value: '旬空(空亡)' },
		{ regex: /四大空亡/g, value: '四大空亡(金空/水空)' },
		{ regex: /贵神/g, value: '贵神(天将)' },
		{ regex: /将神/g, value: '将神(月将)' },
		{ regex: /地分/g, value: '地分(取课基准)' },
	],
	qimen: [
		{ regex: /值符/g, value: '值符(主事神)' },
		{ regex: /值使/g, value: '值使(主事门)' },
		{ regex: /九星/g, value: '九星(天蓬天任天冲天辅天英天芮天柱天心天禽)' },
		{ regex: /八门/g, value: '八门(休生伤杜景死惊开)' },
		// 八神扩写与盘式解耦:转盘八神=虎玄表,飞盘九神含勾陈太常朱雀——写死单表会与飞盘盘面自相矛盾。
		{ regex: /八神/g, value: '八神(值符螣蛇太阴六合等神盘诸神,依盘式取转盘八神或飞盘九神)' },
		{ regex: /遁甲/g, value: '奇门遁甲' },
	],
};

export const AI_EXPORT_SETTINGS_KEY = 'horosa.ai.export.settings.v1';
// v16 — P0 主限法方位+时间补全 (新增 Placidus 方位法 + Cardano/Plantiko/Wollner/SymbolicDegree/SymbolicSolarArc 时间换算)。
// v17 — 汉堡量化盘 AI 段补全 (germany 预设新增 行星图 A+B−C=D / 映点 Spiegelpunkt / 中点列表)。
// v18 — 四同步审计补全:migration keys 补齐占星/星运核心 + 卜卦/择日 19 技法(此前漏登记 → 这些技法预设新增分段
//        升级后并不并入老用户设置;astrochart 的「12分度/主宰链/寿命格局」即曾受此坑)。jieqi 系列走自有 split 迁移,不在此列。
// 升 SETTINGS_VERSION 触发用户旧 export presets 回收;升 MIGRATION_VERSION 把新段并入既有预设(union,不删用户项)。
// v19 — 占星全面扩建:世俗盘(新月/满月/日食/月食/地区盘/行星周期/世俗宫义)+ 星运三技法(三分主星/数字相位/月相推运)。
// v22 — R2 对抗自检:八字「多运限·指定时段」/ 紫微「运限」段未登记进 PRESET_SECTIONS,自定义过导出段+设了多运限的
//        用户,显式要的多运限段被 filterContentByWantedSections 静默删。补 preset 末尾两段 + 升版让旧用户迁移时 union 并入。
// v23 — 七政四余补「政余格局/相位」两段:右栏 Moira 面板已显示但此前未进快照/导出。同 v22 范式(补 preset + 升版 union)。
// v24 — 占星双盘技法补「本命盘配置/时段盘配置」段(返照/小限/太阳弧/流年/主限法盘/行星弧/Vedic/Jayne):预测快照把旧[星盘信息]
//        拆成[本命盘配置]+[时段盘配置]、主限法盘加[主限法盘配置]。自定义过导出段的老用户原会被静默删→同 v22/v23 范式
//        (补 preset + 升版 union + 星盘信息→时段盘配置 legacy map)。
// v25 — 古典占星补全:西占快照新增[古典]段(逐曜古典状态 出界/偕日相/喜乐/宗派/野逸/度数性质·阳阴/月站/远地点/单度·九分·Darijan
//        + 围攻详断 surround.besiegement)。astrochart/astrochart_like/indiachart/mundane 预设补[古典];同 v22/v23 范式
//        (补 preset + 升版 union → 自定义过导出段的老用户也并入[古典])。
// v26 — 古典格局派生分析:astrochart/astrochart_like 预设补[古典格局](护卫/优势相位/相位动态/逐题主星/偶然尊贵/
//        恒星/行星时/埃及历/巴比伦,由 analyze_chart 按需 fetch 拼入,与 AI 挂载同源)。同 v22 范式(补 preset + 升版 union)。
// v27 — 全量四镜审计补漏(in-app 实测):印占[大运Dasha](Vimshottari)、六壬[常用神煞]/[毕法（已命中）]、
//        太乙[起盘]——右栏/导出已输出但未登记 PRESET_SECTIONS → 自定义过导出段的用户被 filterContentByWantedSections
//        静默删、且在导出设置中不可勾选。同 v22-v26 范式(补 preset + 升版 union 并入,不删用户项)。
// v28 — 量化盘补[汉堡学派要素]段:汉堡功能(流派/六宫框/差值表/医学四液/赤纬)由 buildHamburgLines 拼进 germany
//        快照(仅用户介入汉堡功能时附,默认 classic 零回归),但此前未登记 germany PRESET_SECTIONS → 自定义过
//        量化盘导出段的老用户会被 filterContentByWantedSections 静默删、且导出设置里勾不到。同 v22-v27 范式
//        (补 preset 末尾段 + 升版 union 并入,不删用户项;默认未自定义用户走 applyUserSectionFilter 不过滤分支不受影响)。
// v29 — 大六壬全流派补「断卦层」9 段(年月神煞/课体结构/三传旺衰/空亡真假/旬空落点/陷空/遁干特殊/年命上神/占断向导):
//        buildLiuRengSnapshotText 条件产出(每盘几乎必出)但此前未登记 liureng PRESET_SECTIONS → 自定义过六壬导出段的
//        用户被 filterContentByWantedSections 静默删、且导出设置勾不到。liureng 已在 MIGRATION_KEYS → 同 v22-v28 范式
//        (补 preset 末尾段 + 升版 union 并入,不删用户项)。
// v30 — 三式合一(sanshiunited)对齐独立页:此前三式合一快照比独立页贫很多(奇门缺~9派生/法奇门段、太乙缺动态 pan.sections、
//        六壬缺~12 断卦段——UI 已渲染但没进快照=导出/挂载缺内容)。buildSanShiUnitedSnapshotText 改为复用三个独立
//        builder(buildDunJiaSnapshotText/buildTaiyiSnapshotText/buildLiuRengSnapshotText,单一真值源,正文照搬,只选段+改前缀)
//        补齐:太乙7段(加「太乙」前缀)/六壬断卦12段/奇门派生10段(加「奇门」前缀避与六壬「概览」碰撞)。这些段此前未登记
//        sanshiunited PRESET_SECTIONS → 自定义过三式合一导出段的用户会被 filterContentByWantedSections 静默删、且导出设置勾不到。
//        sanshiunited 已在 MIGRATION_KEYS → 同 v22-v29 范式(补 preset 末尾段 + 升版 union 并入,不删用户项)。
// v32 补:风水新增五流派导出段(辅星水法/净阴净阳/玄空大卦/形势峦头/择日选择)登记进 fengshui PRESET_SECTIONS。
//        fengshui 已在 MIGRATION_KEYS → 同 v22-v31 范式(补 preset 末尾段 + 升版 union 并入,不删用户项);
//        MIGRATION_VERSION 升至 == SETTINGS_VERSION 以覆盖曾在 v31 自定义过风水导出段的老用户(否则五新段被 filterContentByWantedSections 静默删)。
// v36 补:一掌经神煞合参层由静态 21×12 表改为按盘计算落宫(生年支/日干/月支/日柱旬定位)→导出新增「神煞合参」段。
//        yizhangjing 已在 MIGRATION_KEYS;MIGRATION_VERSION 升至 == SETTINGS_VERSION 以覆盖曾自定义过一掌经导出段(v33-35)的老用户(否则神煞合参段被静默删)。
// v41: 仅升 SETTINGS_VERSION 作「prefs.format 中间态残留重置窗口」(见 normalizeAIExportSettings)。
// v42: [YB] 星运族 21 键补厚段(起盘信息/当前时点/方法说明)入 preset → SETTINGS/MIGRATION 同升 42
//      (union 并入老用户设置,同 v22-v40 范式,不删用户项)。
// v45: [YF] 段勾选「所见即所得」两修:①空数组=显式清空(effective 返空、UI 全不勾、导出/挂载全不纳入;
//      历史「点清空存下的 []」旧语义=未自定义,v<45 一次性删键清尸=与用户所见现状一致零回归);
//      ②五技法(jinkou/liureng/qimen/sanshiunited/horary)运行时强推段改一次性 union 迁移进已自定义
//      用户的选择(UI 从此显示勾着、取消=真取消),导出链删除运行时强推——挂载/导出同语义。
// v49 补:风水新增三流派导出段(玄空六法/命理派/综合罗经)登记进 fengshui PRESET_SECTIONS 末尾。
//        🔴 不升 MIGRATION_VERSION(那会令 v45+ 存档重走全 preset union、违「取消=真取消」铁律);
//        改用键内段级一次性 union（AI_EXPORT_V49_SECTION_UNION）——这三段 v49 前根本不存在,
//        用户不可能"取消"过它们,故并入不会复活任何被取消项,语义安全。
// v52 补:风水新增「风水·大玄空」段(理气新派·单盘挨星,古籍三元大玄空一路);同 v49/v50/v51 键内段级
//        一次性 union——该段本版才诞生,用户无从取消过,并入不复活任何被取消项;🔴 不动 MIGRATION_VERSION。
// v56 补:内容完备性审计批(「页面渲染有/快照恒缺」反方向普查)新生段——紫微「身宫」等;同 v49-v55
//        键内段级一次性 union;🔴 不动 MIGRATION_VERSION。
// v57 补:西占宫主口径根治(Windows #79):「分宫制宫神星表」自 [主宰星链] 拆出成独立段(九个西占键 preset 皆紧随
//        「主宰星链」;本版才诞生的段,用户无从取消过 → 同机制键内段级一次性 union);[主宰星链] 段名不变、内容改挂
//        整宫制宫主表+判读口径行(不入 union);🔴 不动 MIGRATION_VERSION。
// 三式合一补「七政」段(六壬断卦层的七政段:独立六壬页早有、三式合一挑段单此前漏它 → 段被丢)。
//        本版才诞生的段名,用户无从取消过 → 同 v49…v57 的键内段级一次性 union;🔴 不动 MIGRATION_VERSION。
// 量化盘补「赤纬接触」段(自[汉堡学派要素]里拆出成独立段:缺省流派也进快照,与 90°中点盘右栏同一开关同一数据)。
//        本版才诞生的段名,用户无从取消过 → 同 v49…v58 的键内段级一次性 union;🔴 不动 MIGRATION_VERSION。
// v60 补:量化盘「中点坐标」「公式求解」两段(行星中点页选赤经 / 赤纬、90°中点盘右栏写了公式才进快照,不受汉堡门控)。
//        本版才诞生的段名,用户无从取消过 → 同 v49…v59 的键内段级一次性 union;🔴 不动 MIGRATION_VERSION。
export const AI_EXPORT_SETTINGS_VERSION = 60;
// 🔴 新技法不动此闸：其键老用户本无（未自定义）→ 走 preset 全量、本就含其全部段；
// union 迁移唯「已自定义过某技法而该技法新增段」者需之。误升此闸会令 v45 存档重走 union，
// 违「v45 起不再 union 强推、用户取消=真取消」之铁律（其测试锁之）。
export const AI_EXPORT_SECTION_MIGRATION_VERSION = 44;
export const AI_EXPORT_PREFS_FORMAT_RESET_VERSION = 41;
// [YF] 空数组语义切换 + 强推段迁移的版本窗口(v<45 的持久化进本窗口,见 normalizeAIExportSettings)。
export const AI_EXPORT_EMPTY_CLEAR_VERSION = 45;
// [YF] 旧「导出主链运行时强推段」清单(与删除前 applyUserSectionFilter 内硬编码逐字一致)。
// v<45 已自定义(非空)的用户 → union 进选择(=旧运行时行为显式化);v45 起用户取消这些段=真取消。
export const AI_EXPORT_FORCED_INCLUDE_SECTIONS = {
	jinkou: ['金口诀速览'],
	liureng: ['大格', '小局', '参考', '概览'],
	qimen: ['盘面要素', '奇门演卦', '八宫详解'],
	sanshiunited: ['六壬大格', '六壬小局', '六壬参考', '六壬概览', '八宫详解'],
	horary: ['月亮的故事', '相位全览'],
};
// [MT parity] v45 preset 补真段的一次性 union(同窗同逻辑):preset 补 builder 实产段的技法登记于此
// (拆段后 preset 失修类),v<45 已自定义用户不 union 会被白名单静默滤掉这批真内容段。
// 键内段级一次性 union：给「已自定义过该技法、而该技法此版新增段」的用户补上新段。
// 与 MIGRATION_VERSION 的全 preset union 不同——只并这几条**本版才诞生**的段名，
// 用户此前无从取消，故不会复活任何被取消项（v45「取消=真取消」铁律不破）。
export const AI_EXPORT_V49_UNION_VERSION = 49;
export const AI_EXPORT_V49_SECTION_UNION = {
	fengshui: ['风水·玄空六法', '风水·命理派', '风水·综合罗经'],
};
// babylon 补「微黄道」段(页面第 6 页签此前无对应导出段):同 v49 键内段级一次性 union,
// 该段本版才诞生、用户无从取消过,并入不复活任何被取消项(v45「取消=真取消」铁律不破)。
export const AI_EXPORT_V50_UNION_VERSION = 50;
export const AI_EXPORT_V50_SECTION_UNION = {
	babylon: ['微黄道'],
};
// 同 v49/v50 机制的下一窗。
export const AI_EXPORT_V51_UNION_VERSION = 51;
export const AI_EXPORT_V51_SECTION_UNION = {
};
// 同机制下一窗（风水·大玄空：理气新派单盘挨星，本版才诞生的段）。
export const AI_EXPORT_V52_UNION_VERSION = 52;
export const AI_EXPORT_V52_SECTION_UNION = {
	fengshui: ['风水·大玄空'],
};
// 同机制下一窗（风水·水龙平洋：形势新派，本版才诞生的段）。
export const AI_EXPORT_V53_UNION_VERSION = 53;
export const AI_EXPORT_V53_SECTION_UNION = {
	fengshui: ['风水·水龙平洋'],
};
// 同机制下一窗（风水·改造化煞：形煞/气煞/补偏救弊，本版才诞生的段）。
export const AI_EXPORT_V54_UNION_VERSION = 54;
export const AI_EXPORT_V54_SECTION_UNION = {
	fengshui: ['风水·改造化煞'],
};
// 同机制下一窗（风水·阳宅判断：峦头/理气/客星三方合参，本版才诞生的段）。
export const AI_EXPORT_V55_UNION_VERSION = 55;
export const AI_EXPORT_V55_SECTION_UNION = {
	fengshui: ['风水·阳宅判断'],
};
// 同机制下一窗（内容完备性审计批：「页面渲染有/快照恒缺」反方向普查的新生段）。
// 🔴 铁则：本表每段必须与同版 preset 新增段一一对应（v-window 卫生锁测试看死），绝不含既有段名。
export const AI_EXPORT_V56_UNION_VERSION = 56;
export const AI_EXPORT_V56_SECTION_UNION = {
	ziwei: ['身宫', '八字大运'],
	bazi: ['干支合冲'],
	// 世界范式盘不入 union:默认关段(∩DEFAULT_OFF 必空,否则已自定义用户被强制勾上、与未自定义用户口径倒挂);
	// 其在 preset/设置面可见,想要的用户自行勾选。
	astrochart: ['古典·派生宫转宫', '古典·气候带', '古典·显赫计分'],
	// 聚合导出子源标签(通书择日与既有内容段同名,老自定义者多半已勾,不重复入 union)。
	calendar: ['农历', '老黄历', '日子馆'],
	// 天星择日:选中时刻星盘段(本版才诞生)。
	tianxing: ['选中时刻星盘'],
	// 派生盘专属段(快照重定源随附,本版才诞生)。
	harmonic: ['调波盘'],
	draconic: ['龙盘'],
	relocation: ['重置盘'],
};
// 同机制下一窗（Windows #79 西占宫主口径：分宫制宫神星表自 [主宰星链] 拆出成独立段，本版才诞生）。
// 九个西占键各一段;∩DEFAULT_OFF=∅(卫生锁看死);[主宰星链] 段名不变,不入 union。
export const AI_EXPORT_V57_UNION_VERSION = 57;
export const AI_EXPORT_V57_SECTION_UNION = {
	astrochart: ['分宫制宫神星表'],
	astrochart_like: ['分宫制宫神星表'],
	hellenastro: ['分宫制宫神星表'],
	dwadasamsa: ['分宫制宫神星表'],
	harmonic: ['分宫制宫神星表'],
	draconic: ['分宫制宫神星表'],
	relocation: ['分宫制宫神星表'],
	locastro: ['分宫制宫神星表'],
	mundane: ['分宫制宫神星表'],
};
// 同机制的下一窗(Q-451/T-414:三式合一六壬断卦层的「七政」段)。
export const AI_EXPORT_V58_UNION_VERSION = 58;
export const AI_EXPORT_V58_SECTION_UNION = {
	sanshiunited: ['七政'],
};
// 同机制的下一窗(量化盘「赤纬接触」独立段)。
export const AI_EXPORT_V59_UNION_VERSION = 59;
export const AI_EXPORT_V59_SECTION_UNION = {
	germany: ['赤纬接触'],
};
// 同机制的下一窗(量化盘「中点坐标」「公式求解」两个独立段)。
export const AI_EXPORT_V60_UNION_VERSION = 60;
export const AI_EXPORT_V60_SECTION_UNION = {
	germany: ['中点坐标', '公式求解'],
};
// 拆段映射(单源):「自某段拆出的独立段」← 母段,随 union 窗一起登记(新段的 union 窗版本、适用的导出键 = 该窗的键)。
// 导出设置的键内段级白名单由 union 窗迁移;数据源级的逐源段白名单(segments)不走导出设置,
// 载入 / 导入时按本表一次性补新段:白名单里勾了母段、没有新段 → 紧跟母段补上(拆段前母段里本就含这块内容);
// 已迁过(记下的迁移版本 ≥ 该窗)不再补 —— 不复活用户之后取消的段。
// 🔴 合同:union 窗里凡属「自某段拆出」的段都必须登记在这里(jest aiSectionSplitMigration 看守)。
export const AI_SECTION_SPLITS = [
	{ version: AI_EXPORT_V57_UNION_VERSION, parent: '主宰星链', child: '分宫制宫神星表', keys: Object.keys(AI_EXPORT_V57_SECTION_UNION) },
	{ version: AI_EXPORT_V59_UNION_VERSION, parent: '汉堡学派要素', child: '赤纬接触', keys: Object.keys(AI_EXPORT_V59_SECTION_UNION) },
];
export const AI_SECTION_SPLIT_LATEST = AI_SECTION_SPLITS.reduce((m, x)=>Math.max(m, x.version), 0);
// 逐源段白名单的拆段迁移(纯函数):key = 导出键(本命取技法键、推运取方法键);fromVersion = 上次迁到的窗(没有 = 0)
export function migrateSplitSegments(key, segments, fromVersion){
	if(!Array.isArray(segments) || !segments.length){ return segments; }
	const from = Number(fromVersion) || 0;
	const out = segments.slice();
	AI_SECTION_SPLITS.forEach((sp)=>{
		if(sp.version <= from || sp.keys.indexOf(`${key || ''}`) < 0){ return; }
		const i = out.indexOf(sp.parent);
		if(i >= 0 && out.indexOf(sp.child) < 0){ out.splice(i + 1, 0, sp.child); }
	});
	return out;
}
export const AI_EXPORT_V45_SECTION_UNION = {
};
// 导出格式偏好:'v1'=经典(逐行项目符 beautifyForAI + 纯文本 .doc/裸文本栅格 PDF),
// 'v2'=表格化温和归一 + 真 docx + 样式化 PDF + 元数据头/图例。
// 默认 'v2'(用户拍板 2026-07-11:紫微试点验证后默认开);「AI导出设置·通用」保留 v1 经典格式回退开关
// 一个大版本(出问题一键回退,v1 路径全量保留且有测试钉死)。
export const AI_EXPORT_FORMAT_DEFAULT = 'v2';
// [YD 拆键] 星盘衍生盘 7 键族:六衍生盘(十三/十二分盘/谐波/黄道分盘/换置盘/占星地图)从
// astrochart_like 拆出独立导出键(此前六盘塌一键,段勾选永远无法分盘)。astrochart_like 保留=
// 老用户设置遗产 + AI挂载聚合键(衍生盘挂载语义仍走它,四同步豁免已登)。抽取/缓存/派生附加等
// 判断一律走本谓词,禁再散写 === 'astrochart_like'。
const ASTRO_LIKE_EXPORT_KEYS = ['astrochart_like', 'hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation', 'locastro'];
export function isAstroLikeExportKey(key){
	return ASTRO_LIKE_EXPORT_KEYS.includes(`${key || ''}`);
}
export const AI_EXPORT_SECTION_MIGRATION_KEYS = [
	// v46 补：神数正传（数算新子tab，三流派段头并集）
	'zhengchuan',
	// v18 补:占星/星运核心 + 卜卦/择日(此前漏登记)。务必与新增「有 preset 的技法」同步(aiExport.test 跨系统自检守)。
	'astrochart',
	'astrochart_like',
	'hellenastro',
	'dwadasamsa',
	'harmonic',
	'draconic',
	'relocation',
	'locastro',
	'indiachart',
	'mundane',
	'relative',
	'primarydirect',
	'primarydirchart',
	'zodialrelease',
	'firdaria',
	'distributions',
	'agepoint',
	'ephemeris',
	'returntimeline',
	'prenatalsyzygy',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'decennials',
	'horary',
	'election',
	'tianxing',
	'qimenzeri',
	'huanglizeri',
	'bazizeri',
	'taiyizeri',
	'ziweizeri',
	'liurengzeri',
	'sanshizeri',
	'qizhengzeri',
	'indiazeri',
	'bazi',
	'ziwei',
	'suzhan',
	'sixyao',
	'tongshefa',
	'liureng',
	'jinkou',
	'qimen',
	'sanshiunited',
	'taiyi',
	'guolao',
	// v39 补:节气盘主键 + 四分点子盘(春分/夏至/秋分/冬至)+ 元数据键;presets 增 3D盘段,自定义用户须并集补入。
	'jieqi',
	'jieqi_chunfen',
	'jieqi_xiazhi',
	'jieqi_qiufen',
	'jieqi_dongzhi',
	'jieqi_meta',
	'germany',
	'babylon',
	'otherbu',
	'fengshui',
	'huangji',
	'wuzhao',
	'taixuan',
	'guice',
	'xiaoliuren',
	'xiaochengtu',
	'feigong',
	'jingjue',
	'shenyishu',
	'geomancy',
	'tarot',
	'lingqi',
	'shaozi',
	'tieban',
	'fendjing',
	'beiji',
	'nanji',
	'chunzi',
	'xianqin',
	'cetian',
	'qizhengkin',
	'planetaryages',
	'prog',
	'vedicprog',
	'jaynesprog',
	'planetaryarc',
	'persiandirected',
	'yearsystem129',
	'balbillus',
	'triplicityrulers',
	'keypoints',
	'lunationphase',
	'extrareturns',
	'canping',
	'heluo',
	'zhengchuan',
	'yizhangjing',
	// v43 补:黄历(工具组首个导出键,只导出不挂载照 jieqi/fengshui 先例)。
	// v44 补:六壬[七政]/果老[虚实][本命化曜] 三段(键已在册,union 自动并入自定义)。
	'calendar',
	// 黄历二子技法(独立键新增于本版;v<44 老档无此键 → 循环体只并入已存在的非空数组,零强推)
	'huangli', 'huanglizeri', 'tongshu',
	// 天星择日(征象搜索;新技法键只加键、两把版本闸恒不动——老用户本无自定义走 preset 全量)
	'tianxing',
	// 奇门择日(找局;同 tianxing 只加键纪律)
	'qimenzeri',
	'huanglizeri',
	'bazizeri',
	'taiyizeri',
	'ziweizeri',
	'liurengzeri',
	'sanshizeri',
	'qizhengzeri',
	'indiazeri',
];
export const AI_EXPORT_PLANET_INFO_DEFAULT = {
	showHouse: 1,
	showRuler: 1,
};
export const AI_EXPORT_ASTRO_MEANING_DEFAULT = {
	enabled: 0,
};
export const AI_EXPORT_PLANET_INFO_TECHNIQUES = new Set([
	'astrochart',
	'indiachart',
	'astrochart_like',
	// 衍生盘拆键后六个独立导出键也进「星曜后天信息 / 释义」两个集合:此前只留 astrochart_like →
	// 选这六盘时弹窗不出现两组设置、存了也不生效;挂载仍走聚合键 → 同盘导出与挂载吃不同开关。无自身设置时回落聚合键设置(见 getter)。
	'hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation', 'locastro',
	'relative',
	'primarydirect',
	'primarydirchart',
	'zodialrelease',
	'firdaria',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'decennials',
	'planetaryages',
	'prog',
	'vedicprog',
	'jaynesprog',
	'planetaryarc',
	'persiandirected',
	'yearsystem129',
	'balbillus',
	'triplicityrulers',
	'keypoints',
	'lunationphase',
	'extrareturns',
	'jieqi',
	'jieqi_meta',
	'jieqi_chunfen',
	'jieqi_xiazhi',
	'jieqi_qiufen',
	'jieqi_dongzhi',
	'sanshiunited',
	'guolao',
	'germany',
]);
export const AI_EXPORT_ASTRO_MEANING_TECHNIQUES = new Set([
	...Array.from(AI_EXPORT_PLANET_INFO_TECHNIQUES),
	'otherbu',
	'qimen',
	'liureng',
]);
export const AI_EXPORT_HOVER_MEANING_TECHNIQUES = new Set([
	'qimen',
	'liureng',
	'sanshiunited',
]);
const JIEQI_SETTING_PRESETS = {
	jieqi_meta: ['节气盘参数'],
	jieqi_chunfen: ['春分星盘', '春分宿盘', '春分3D盘'],
	jieqi_xiazhi: ['夏至星盘', '夏至宿盘', '夏至3D盘'],
	jieqi_qiufen: ['秋分星盘', '秋分宿盘', '秋分3D盘'],
	jieqi_dongzhi: ['冬至星盘', '冬至宿盘', '冬至3D盘'],
};
export const JIEQI_SPLIT_SETTING_KEYS = Object.keys(JIEQI_SETTING_PRESETS);
const JIEQI_SPLIT_TECHNIQUES = [
	{ key: 'jieqi_meta', label: '节气盘-通用参数' },
	{ key: 'jieqi_chunfen', label: '节气盘-春分' },
	{ key: 'jieqi_xiazhi', label: '节气盘-夏至' },
	{ key: 'jieqi_qiufen', label: '节气盘-秋分' },
	{ key: 'jieqi_dongzhi', label: '节气盘-冬至' },
];

export const AI_EXPORT_TECHNIQUES = [
	{ key: 'astrochart', label: '星盘' },
	{ key: 'indiachart', label: '印度占星' },
	{ key: 'astrochart_like', label: '星盘衍生·通用（旧设置）' },
	{ key: 'hellenastro', label: '十三分盘' },
	{ key: 'dwadasamsa', label: '十二分盘' },
	{ key: 'harmonic', label: '调波盘' },
	{ key: 'draconic', label: '龙盘' },
	{ key: 'relocation', label: '换置盘' },
	{ key: 'locastro', label: '占星地图' },
	{ key: 'mundane', label: '世俗盘' },
	{ key: 'babylon', label: '巴比伦占星' },
	{ key: 'relative', label: '合盘' },
	{ key: 'primarydirect', label: '星运-主限法' },
	{ key: 'primarydirchart', label: '星运-主限法盘' },
	{ key: 'zodialrelease', label: '星运-黄道星释' },
	{ key: 'firdaria', label: '星运-法达星限' },
	{ key: 'distributions', label: '星运-界推运' },
	{ key: 'agepoint', label: '星运-年龄推进点' },
	{ key: 'ephemeris', label: '星运-星历' },
	{ key: 'returntimeline', label: '星运-回归轴' },
	{ key: 'prenatalsyzygy', label: '星运-产前朔望' },
	{ key: 'profection', label: '星运-小限法' },
	{ key: 'solararc', label: '星运-太阳弧' },
	{ key: 'solarreturn', label: '星运-太阳返照' },
	{ key: 'lunarreturn', label: '星运-月亮返照' },
	{ key: 'givenyear', label: '星运-流年法' },
	{ key: 'decennials', label: '星运-十年大运' },
	{ key: 'planetaryages', label: '星运-行星年龄' },
	{ key: 'prog', label: '星运-二次推运' },
	{ key: 'vedicprog', label: '星运-恒星推运' },
	{ key: 'jaynesprog', label: '星运-赤纬推运' },
	{ key: 'planetaryarc', label: '星运-行星弧' },
	{ key: 'persiandirected', label: '星运-波斯向运' },
	{ key: 'yearsystem129', label: '星运-129年系统' },
	{ key: 'balbillus', label: '星运-Balbillus' },
	{ key: 'triplicityrulers', label: '星运-三分主星' },
	{ key: 'keypoints', label: '星运-数字相位' },
	{ key: 'lunationphase', label: '星运-月相推运' },
	{ key: 'extrareturns', label: '星运-多重回归' },
	{ key: 'bazi', label: '八字' },
	{ key: 'ziwei', label: '紫微斗数' },
	{ key: 'suzhan', label: '宿占' },
	{ key: 'sixyao', label: '六爻' },
	{ key: 'tongshefa', label: '统摄法' },
	{ key: 'huangji', label: '皇极经世' },
	{ key: 'wuzhao', label: '五兆' },
	{ key: 'taixuan', label: '太玄筮法' },
	{ key: 'guice', label: '皇极轨策' },
	{ key: 'xiaoliuren', label: '小六壬' },
	{ key: 'xiaochengtu', label: '小成图' },
	{ key: 'feigong', label: '飞宫小奇门' },
	{ key: 'jingjue', label: '荆诀' },
	{ key: 'shenyishu', label: '神易数' },
	{ key: 'geomancy', label: '天文地占' },
	{ key: 'tarot', label: '塔罗' },
	{ key: 'lingqi', label: '灵棋经' },
	{ key: 'liureng', label: '六壬' },
	{ key: 'jinkou', label: '金口诀' },
	{ key: 'qimen', label: '奇门遁甲' },
	{ key: 'sanshiunited', label: '三式合一' },
	{ key: 'taiyi', label: '太乙' },
	{ key: 'guolao', label: '七政四余' },
	{ key: 'qizhengkin', label: '七政四余（七政）' },
	{ key: 'shaozi', label: '邵子神数' },
	{ key: 'tieban', label: '铁板神数' },
	{ key: 'fendjing', label: '鬼谷分定经' },
	{ key: 'beiji', label: '北极神数' },
	{ key: 'nanji', label: '南极神数' },
	{ key: 'chunzi', label: '蠢子数' },
	{ key: 'canping', label: '邵子参评数' },
	{ key: 'heluo', label: '河洛理数' },
	{ key: 'zhengchuan', label: '神数正传' },
	{ key: 'xianqin', label: '万化仙禽' },
	{ key: 'cetian', label: '策天飞星' },
	{ key: 'yizhangjing', label: '一掌经' },
	{ key: 'germany', label: '量化盘' },
	{ key: 'jieqi', label: '节气盘' },
	...JIEQI_SPLIT_TECHNIQUES,
	{ key: 'otherbu', label: '骰子' },
	{ key: 'fengshui', label: '风水' },
	{ key: 'horary', label: '卜卦盘' },
	{ key: 'election', label: '择日盘' },
	{ key: 'tianxing', label: '天星择日' },
	{ key: 'qimenzeri', label: '奇门择日' },
	{ key: 'huanglizeri', label: '黄历择日' },
	{ key: 'bazizeri', label: '八字择日' },
	{ key: 'taiyizeri', label: '太乙择日' },
	{ key: 'ziweizeri', label: '紫微择日' },
	{ key: 'liurengzeri', label: '六壬择日' },
	{ key: 'sanshizeri', label: '三式择日' },
	{ key: 'qizhengzeri', label: '七政择日' },
	{ key: 'indiazeri', label: '印度择日' },
	{ key: 'calendar', label: '黄历' },
	// 黄历二子技法独立键:calendar=页面聚合快照(四子并出),huangli/tongshu=各自模块快照单技法
	// 导出(与 jieqi 总/分并存同构);挂载「起课时间」源亦复用同一 preset 做内容勾选。
	{ key: 'huangli', label: '老黄历日课' },
	{ key: 'tongshu', label: '通书择日' },
	// generic=运行时兜底 context 键(extractGenericContent 恒无固定产出),不设用户可见设置行:
	// 曾以「其他页面」列在下拉且挂死表 ['起盘信息'],勾了永远导不出东西 → 从设置面除名(运行时兜底语义不变)。
];

export const AI_EXPORT_PRESET_SECTIONS = {
	// +古典接纳/征象力量:引擎已算(chart.receptions/尊贵力量)却被判词-only 快照丢弃。
	// +定盘考量/Almuten/映点对映点/行星时/尊贵明细(+满分表/点全集,仅相应流派档产段):
	// +围攻详断/月亮实测相位(后端 surround.besiegement 十六式+immediateAsp 权威源+终局)。
	// 快照「只加新段」策略,段名与 horarySnapshot 段头逐字一致。
	// +断法要点/六类问法/恒星会合/同主一星/自然象征/盗窃研判/应期修正链(官方 gap 八项清零)。
	horary: ['起卦信息', '根本性', '征象星指派', '完成分析', '月亮的故事', '相位全览', '裁决', '应期方位', '描述', '专题深化·X', '古典接纳', '征象力量', '定盘考量', 'Almuten', '映点对映点', '行星时', '尊贵明细', '偶然尊贵满分表', '阿拉伯点全集', '围攻详断', '月亮实测相位', '断法要点', '六类问法', '恒星会合', '同主一星', '自然象征', '盗窃研判', '应期修正链'],
	election: ['起盘信息', '流派口径', '总评', '红线', '分项', '尊贵强弱', '阿拉伯点', '择前考量', '用事专属', '危象日参照', '应期', '本命合参', '回归与主限', '时势合参', '建议'],   // 回归与主限(页面按需拉取物)
	// 🔒 与 src/divination/zeri/tianxingSnapshot.js 段头逐字成对(四同步)
	// 选中时刻星盘=整张盘 headerless 并入的单一父段(审计修:右栏七页签判读底盘曾零快照)。
	tianxing: ['起盘信息', '征象搜索配置', '征象条件', '命中区间', '选中时刻星盘'],
	// 古典·衍化四段=本命盘专属 opt-in(builder options.classicalDerived;派生盘/嵌套消费方不产);世界范式盘=恒定教义默认关段。
	astrochart: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '古典·派生宫转宫', '古典·气候带', '古典·显赫计分', '古典·世界范式盘', '古典格局', '埃及历', '寿命格局', '可能性'],
	// [MU] '古典':buildIndiaSnapshotText 实测不产出该段头(死复选框,勾了永远空,无害不删内容)。
	indiachart: ['星盘信息', '起盘信息', '信息', '相位', '行星', '希腊点', '古典', '可能性', '大运Dasha', '附加分盘',
		// buildJyotishSnapshotLines 无条件派生段(约 40 段,条件产出⊆语义):此前未登记→自定义过 india 导出段的用户被静默删、纳入面板勾不到。
		'Panchanga 五要素', '卡拉卡（8 Chara Karakas）', '节点主照（Rasi Drishti）', '星曜状态', '分盘吉位 Vaiśeṣikāṁśa', '八分点 SAV', 'Sodhya Pinda 凝量', 'Shadbala 六力', 'Ishta/Kashta 吉凶果', 'Vimśopaka 分盘 20 分力', 'Hora 行星时', 'Choghadia 民用择时', '择时 Panchaka/Abhijit', 'Mūla 大运', 'Sudarśana Chakra 大运', 'Naisargika 自然大运', '补充上升（Supplementary Lagnas）', 'Nāḍī · Bhrigu Bindu 福点', 'Nāḍī · D150 纳地盘', 'Āyurdāya 寿命基础', '特殊上升 Special Lagnas', 'D60 六十分盘吉凶', '分盘变体对照', '功能吉凶（Functional Nature）', '宫位力（Bhava Bala）', '星曜战（Graha Yuddha）', '扩展大运（Conditional / Chara）', 'Kartari 夹击格局', 'Sudarshana 三盘（命/日/月起）', 'KP 宫头次主星 CSL', 'KP 意义者 Significators', 'KP 六级细分 / 当令星', '敌友（复合五分）', '行运 Gochara（从月·八分点）', '化解（信息·非处方）', 'Jaimini Argala 干涉', 'Tajika Harsha Bala', 'Tajika Pancha-Vargeeya', 'Tajika Mudda 年运', '行运 Gochara（从命）', '座运·X',
		// A 类硬缺:Yoga 面板成立清单/副星本体位置(含外行星) 显示了却不入快照。
		'瑜伽格局 Yogas', '副星 Upagraha',
		// G2/G3/G4/G7/G1 新段(2026-07-21 KP 补齐;加段不升迁移版本)
		'敏感点 Sphuta', '全吉盘 SBC', '问事 Praśna',
		'Nāḍī · 行星组合(同座合)', 'Nāḍī · 星座交换', 'Nāḍī · 木星推进时间轴',
		'Jaimini 三对法寿命', 'Tripataki 宿距三旗',
		// 三旗盘(opt-in 齿轮 tripataki)逐月净分段(加段不升迁移版本;仅开启才产段)
		'Tripataki 三旗盘逐月净分',
		// 大运+行运补齐新段(加段不升迁移版本)
		'寿命判读',
		// 流派开关挂载合同补齐的页面已显段(加段不升迁移版本):从日过运 / 过运×大运联动 / 年主 / 年 Yoginī / Patyāyinī
		'行运 Gochara（从日）', '过运×大运联动', 'Tajika 年主', 'Tajika 年 Yoginī', 'Tajika Patyāyinī 年运'
	],
	astrochart_like: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '古典格局', '埃及历', '寿命格局', '可能性', '占星地图'],
	// [YD 拆键] 六衍生盘独立段表:占星地图含[占星地图]段;其余五盘无该段。改黄道框架的四盘
	// (hellenastro/dwadasamsa/harmonic/draconic)在派生分析 skip 名单(buildPayload skipClassical),
	// 其 preset 不列「古典格局」——列了=死勾选项(独立复核咬出);relocation/locastro 不 skip 故保留。
	hellenastro: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '埃及历', '寿命格局', '可能性'],
	dwadasamsa: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '埃及历', '寿命格局', '可能性'],
	harmonic: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '埃及历', '寿命格局', '可能性', '调波盘'],
	draconic: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '埃及历', '寿命格局', '可能性', '龙盘'],
	relocation: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '古典格局', '埃及历', '寿命格局', '可能性', '重置盘'],
	locastro: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '古典格局', '埃及历', '寿命格局', '可能性', '占星地图'],
	mundane: ['世俗入宫', '新月图', '满月图', '日食图', '月食图', '地区盘', '行星周期', '恒星派入境', '吠陀世运', '世运卜卦', '世俗宫义', '定局·年主/盘主', '入境骨架', '地理分野', '地区盘推运', '角化', '年之九主', '世运问判',
		// 右栏其余卡折入快照(与 render*Card 同源;按需拉取物算过才成段)
		'年盘概要', '四季入境盘', '新月图判读', '满月图判读', '日食图判读', '月食图判读', '食族 Saros', '天象占参考', '地区盘·12世俗宫', '时刻校正', '天气占星', '四轴特殊点', '会合指示星', '盘型格局', '世运恒星命中', '赤纬平行', '恒星派入境·概览', '吠陀世运·年度盘', '世运大运', 'KP 副主链', '天气与农业', '世运问判·得力明细', '木土纪元', '大年时代', 'Barbault 聚散指数', '起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '分宫制宫神星表', '古典', '埃及历', '寿命格局', '可能性'],
	// 时空中点/马克斯 独立段名(此前与组合盘/影响盘撞名,永远无法分选、导出不辨盘型)。
	relative: ['关系起盘信息', 'A对B相位', 'B对A相位', 'A对B中点相位', 'B对A中点相位', 'A对B映点', 'A对B反映点', 'B对A映点', 'B对A反映点', '比较盘-星盘A', '比较盘-星盘B', '合成图盘', '时空中点·合成图盘', '影响图盘-星盘A', '影响图盘-星盘B', '马克斯·影响图盘-星盘A', '马克斯·影响图盘-星盘B', '关系量化', '顺畅连接', '张力连接'],
	// 星运族 21 键补厚三段(起盘信息/当前时点/方法说明,builder=astroAiSnapshot 共享 helper):
	//   A 组(此前零盘境)加全三段;B/C 组生辰行并入既有 [本命盘配置](段内纯增,不撞 C 组 [起盘信息]=推运时间);
	//   D/E 组已有生辰,只补 当前时点/方法说明;primarydirchart 三项天然齐全不动。
	// [MT parity] 删「主/界限法设置/表格」两个死段头(builder 只产 [主限法设置]/[主限法表格],
	// 全仓零 producer=用户面板两个永空复选框);老用户自定义里的死名经 mapLegacySectionTitle 迁真名。
	primarydirect: ['出生时间', '星盘信息', '主限法设置', '主限法表格', '主限天球·当前动画所指', '当前时点', '方法说明'], // WP-5.5 新段:未自定义者即时生效;已自定义者按 MT v45 世界观尊重其白名单(不强推,可手动勾)
	distributions: ['起盘信息', '界推运（分配法 / Distributions）', '伙伴星期', '当前时点', '方法说明'],
	agepoint: ['起盘信息', '年龄推进点（Age Point / Huber）', '当前时点', '方法说明'],
	// 星运三页上线(段头与各 builder 逐字同源)。
	ephemeris: ['起盘信息', '星历事件（入座 · 留逆 · 朔望弦 · 食相）', '行运触发本命', '当前时点', '方法说明'],
	returntimeline: ['起盘信息', '太阳/月亮返照时间轴', '当前时点', '方法说明'],
	prenatalsyzygy: ['起盘信息', '产前朔望', '产前朔望盘·星体位置', '当前时点', '方法说明'],
	primarydirchart: ['出生时间', '星盘信息', '主限法盘设置', '本命盘配置', '主限法盘配置', '主限法盘说明'],
	zodialrelease: ['起盘信息', '星盘信息', '基于X点推运', '当前时点', '方法说明'],
	firdaria: ['出生时间', '星盘信息', '法达星限表格', '当前时点', '方法说明'],
	profection: ['本命盘配置', '起盘信息', '小限摘要', '时段盘配置', '相位', '方法说明'],   // 新段:未自定义者即时生效
	solararc: ['本命盘配置', '起盘信息', '时段盘配置', '相位', '方法说明'],
	solarreturn: ['本命盘配置', '起盘信息', '时段盘配置', '相位', '方法说明'],
	lunarreturn: ['本命盘配置', '起盘信息', '时段盘配置', '相位', '方法说明'],
	givenyear: ['本命盘配置', '起盘信息', '时段盘配置', '相位', '方法说明'],
	decennials: ['起盘信息', '星盘信息', '十年大运设置', '基于X起运', '当前时点', '方法说明'],
	planetaryages: ['起盘信息', '行星年龄（Ages of Man）', '当前时点', '方法说明'],
	prog: ['二次推运（回归黄道）', '本命盘配置', '时段盘配置 二次推运位置', '当前时点', '方法说明'],
	vedicprog: ['恒星推运（Vedic Sidereal）', '本命盘配置', '时段盘配置 二次推运位置', '当前时点', '方法说明'],
	jaynesprog: ['赤纬推运（Declination）', '本命盘配置', '时段盘 赤纬平行/反平行', '当前时点', '方法说明'],
	planetaryarc: ['行星弧（Planetary Arc）', '本命盘配置', '时段盘配置', '相位', '当前时点', '方法说明'],
	persiandirected: ['起盘信息', '波斯向运（Persian Directed）', '当前时点', '方法说明'],
	yearsystem129: ['起盘信息', '129年系统表格', '当前时点', '方法说明'],
	balbillus: ['起盘信息', 'Balbillus', '当前时点', '方法说明'],
	triplicityrulers: ['起盘信息', '三分主星推运', '当前时点', '方法说明'],
	keypoints: ['起盘信息', '数字相位推运', '当前时点', '方法说明'],
	lunationphase: ['起盘信息', '月相推运', '当前时点', '方法说明'],
	extrareturns: ['起盘信息', '多重回归', '当前时点', '方法说明'],
	bazi: ['起盘信息', '四柱与三元', '神煞（四柱与三元）', '五行力量', '格局·用神', '盲派结构', '月令司令（分野）', '干支合冲', '大运', '流年行运概略', '多运限·指定时段'],
	// [Windows #80] '运限概览' = 无条件段(全大限表 + 当前流年/小限),与八字 '大运'/'流年行运概略' 对称;
	//   '运限' 仍是条件段(挂载设置里显式选了年/月/日/时才产)。两段各自可勾。
	ziwei: ['起盘信息', '宫位总览', '身宫', '来因宫', '八字大运', '命中格局', '运限概览', '运限', '流派叠层'],
	suzhan: ['起盘信息', '宿盘宫位与二十八宿星曜'],
	// 判语库·参考诀表=默认关段(持世诀/发动诀/六神歌/爻位象/占类纲要;体量大,设置面可勾)。
	sixyao: ['起盘信息', '卦象', '六爻与动爻', '断卦结构', '断诀命中', '占类断语', '卦辞与断语', '判语库·参考诀表'], // [六爻补齐 D] 两新段:未自定义者即时生效;已自定义者按 MT v45 世界观尊重白名单(不升 MIGRATION)
	// A 类硬缺全场最薄:纳甲筮法 tab 整个计算分析层(世应/左右五行/五友/大局升降爻变)此前不入快照。
	// 爻位=默认关候选段(逐爻取纳判语 + 取舍总览;页面「爻位」页签有、此前快照无)。
	tongshefa: ['本卦', '六爻', '潜藏', '亲和', '爻位', '三十二观', '世应', '五行关系', '五友', '大局与动变'],
	huangji: ['起盘', '元会运世', '天道卦', '人事卦', '心易发微', '经典原文', '历史年表'],
	// 古法层六段纯增(断辞/君子小人/纳甲/神煞/行神/类占),既有九段序不动;加段不升迁移版本。
	wuzhao: ['起盘', '揲筮', '兆', '木乡', '火乡', '土乡', '金乡', '水乡', '特殊标记',
		'断辞', '君子小人', '纳甲', '神煞', '行神', '类占'],
	// 太玄经全文=默认关段(81 首全文体量大;当值首已在概览,设置面可勾全量)。
	taixuan: ['起盘', '玄首', '方州部家', '表', '太玄经全文'],
	guice: ['占事直断', '起卦', '演数', '四位', '卦变', '断法', '时方', '三要十应', '元会运世', '大定起数'],
	xiaoliuren: ['问事', '起课', '三传', '生克', '九神', '化解'],
	xiaochengtu: ['问事', '起卦', '佈局', '推导', '四象', '应期', '股市'],
	feigong: ['问事', '起局', '干支', '命宫', '宫位', '运气', '应期'],
	jingjue: ['起课', '卦辞', '三分', '十六卦'],
	shenyishu: ['起盘', '干支与五行', '神卦', '五行法则', '兵占', '主客判断', '神煞', '长生', '吉凶'],
	// 新增四段(纯增量,不动既有段序;加段不升迁移版本):转宫派生 / 定局落星甲乙 / 结构对照模式的边界声明。
	// 传本对齐补齐:法庭三角/有效性判断/盾面得地/元素与寻源/成败与福灵点/行星地占盘 六段纯增
	// 再增一段:定局落星·真实星历(据所问之时地起真实盘落宫;唯选该档且时地俱备时才产出)
	geomancy: ['判定', '法庭三角', '有效性判断', '解读技法', '盾面得地', '元素与寻源', '成败与福灵点',
		'转宫派生', '定局落星·甲', '定局落星·乙', '定局落星·真实星历', '行星地占盘',
		'十二宫·图形入宫', '十六图形', '图形释义', '边界声明'],
	// TP2 加「对读」段(马赛两两解读,reportText [对读] 同步;纯增量加段不升迁移版本——对已自定义用户不强推)。
	tarot: ['牌阵综览', '逐牌详解', '综合断语', '定局', '对读', '开钥', '生命牌', '组合读法'],
	// 灵棋经:七段恒出(开关只动段内文本,段集恒定 —— lingqiSnapshot.buildLingqiSnapshotText 同源)。
	lingqi: ['起盘信息', '棋势', '卦象', '繇辞', '诸家注', '课断', '断诗'],
	liureng: [
		'起盘信息',
		'十二盘式',
		'十二地盘/十二天盘/十二贵神对应',
		'四课',
		'三传',
		'行年',
		'旬日',
		'旺衰',
		'基础神煞',
		'干煞',
		'月煞',
		'支煞',
		'岁煞',
		'十二长生',
		'大格',
		'小局',
		'参考',
		'概览',
		'常用神煞',
		// 大六壬全流派补齐:断卦层派生段(年月神煞/课体结构/三传旺衰/空亡真假/旬空落点/陷空/遁干特殊/年命上神/占断向导)。
		// 这些由 buildLiuRengSnapshotText 条件产出(每盘几乎必出)但此前未登记 → 自定义过六壬导出段的用户被
		// filterContentByWantedSections 静默删、导出设置勾不到(v22/v27 同类坑)。同范式补 preset 末尾 + 升版 union 并入。
		'年月神煞',
		'课体结构',
		'三传旺衰',
		'空亡真假',
		'旬空落点',
		'陷空',
		'遁干特殊',
		'年命上神',
		'占断向导',
		'毕法（已命中）',
		// 七政:七政 tab 整层硬缺补挂(日月五星临宫/五行/度/逆/月将,GFM 表)。
		'七政',
		// 取象=doctrine 默认关段(象意库,设置面可勾)。
		'取象',
	],
	jinkou: [
		'起盘信息',
		'金口诀速览',
		'金口诀四位',
		'金口诀三盘',
		'四位神煞',
		'用神强弱',
		'发用·五动三动',
		'格局',
		'四位生克',
		'应期',
		'太岁月建',
		'地支关系',
		'相关神煞',
		// 右栏「用神/神煞/专题」页已有、快照此前全缺的五段（恒随课产出）。
		'四象所属',
		'四象五行',
		'方位神煞',
		'合占扣题与内外',
		'二遁与次客',
		// 盘式=阴盘时才产段(阳盘无此段,勾了亦空);专题段同理,左栏未选专题则不产。
		'阴盘·六亲六神旺衰',
		'专题起式',
		'贵神月将象意',
		'分类用神',
		'行年',
		'旬日',
		'旺衰',
		'基础神煞',
		'干煞',
		'月煞',
		'支煞',
		'岁煞',
		'十二长生',
		// A 类硬缺:分析 tab 数理·太玄数显示了却不在快照。
		'数理',
	],
	taiyi: [
		'起盘信息',
		'起盘',
		'太乙盘',
		'太乙诸神',
		'风游',
		'主客定算',
		'十二神',
		'八门与宿曜',
		'断法',
		'七大兵法',
		'博弈',
		'命法',
		'命宫行限',
		'十六宫标记',
	],
	qimen: ['起盘信息', '盘型', '全局速览', '盘面要素', '奇门演卦', '八宫详解', '八宫克应', '九宫方盘', '旺相休囚死·月令能量', '六害总览', '化解方案', '八门化气大阵', '用神分论', '财富七要', '事业七要', '恋爱姻缘', '孤辰寡宿',
		// 金函系日家专段(独立体系整段;未登记则自定义过段集的用户导出金函盘被静默滤空——indiachart 教训同款)
		'日家占方（古籍金函系）'],
	sanshiunited: [
		'起盘信息',
		'概览',
		'太乙',
		'奇门遁甲',   // [制度化] 挂载重算链的奇门非挑段内容顶段(段头降格并入;live 页无此段=条件段)
		'太乙十六宫',
		'神煞',
		'大六壬',
		'六壬大格',
		'六壬小局',
		'六壬参考',
		'六壬概览',
		'七政',        // 六壬断卦层的七政段(独立页早有;三式合一此前漏挑)
		'八宫详解',
		'正北坎宫',
		'东北艮宫',
		'正东震宫',
		'东南巽宫',
		'正南离宫',
		'西南坤宫',
		'正西兑宫',
		'西北乾宫',
		// v30 — 三式合一对齐独立页:复用独立 builder(单一真值源)补全此前缺的派生/断卦段。
		// 太乙(复用 buildTaiyiSnapshotText 的 pan.sections,加「太乙」前缀避叠词/碰撞):
		'太乙主客定算',
		'太乙八门与宿曜',
		'太乙断法',
		'太乙七大兵法',
		'太乙博弈',
		'太乙命法',
		'太乙命宫行限',
		// 六壬断卦层(复用 buildLiuRengSnapshotText 断卦段;大格/小局/参考/概览三式合一已自有不重出):
		'十二盘式',
		'常用神煞',
		'年月神煞',
		'课体结构',
		'三传旺衰',
		'空亡真假',
		'旬空落点',
		'陷空',
		'遁干特殊',
		'年命上神',
		'毕法（已命中）',
		'占断向导',
		// 奇门派生/法奇门段(复用 buildDunJiaSnapshotText;加「奇门」前缀避与六壬「概览」等碰撞):
		'奇门九宫方盘',
		'奇门旺相休囚死·月令能量',
		'奇门六害总览',
		'奇门化解方案',
		'奇门八门化气大阵',
		'奇门用神分论',
		'奇门财富七要',
		'奇门事业七要',
		'奇门恋爱姻缘',
		'奇门孤辰寡宿',
		// A 类硬缺:紫微四化叠加 tab(SanShiZiWeiSihua 独立计算)显示了却不入快照。
		'紫微四化',
	],
	// 补漏登:星曜庙旺段 builder 一直无条件产出却不在 preset(v22 同类坑,自定义过导出段的
	// 用户被静默删);流年流曜=本轮新段(A 类硬缺:右栏流曜 tab 显示了导不出)。
	// 虚实(硬缺:虚宫旬空/实宫四柱)+本命化曜(半缺:此前只导流年侧;含十神序/天禄至天权参考表)。
	// 三主与化曜 / 限法实算 两段随 builder 段序(大限之后、虚实之前);加段不升迁移版本。
	guolao: ['起盘信息', '七政四余宫位与二十八宿星曜', '星曜庙旺与星点动态（殿垣庙旺乐喜怒 · 顺逆留伏迟速）', '神煞', '大限', '三主与化曜', '限法实算', '虚实', '本命化曜', '流年流曜', '政余格局', '相位'],
	qizhengkin: ['起盘', '四柱', '星曜', '十二宫', '神煞', '年限', '流时', '择日', '张果断语', '命宫解读', '今制宿度', '古制宿度'],
	shaozi: ['起盘', '四柱', '四位起数', '河洛纳音', '完整结构', '64钥匙', '元会运世', '条文'],
	tieban: ['起盘', '四柱', '算盘定部', '条文', '计算摘要', '命身刻分', '神数号码', '十二宫', '十二宫条文', '紫微安星', '条文库', '大运', '六亲佐证', '框架·流派刻制', '框架·考刻六亲', '框架·八卦滚', '框架·批断顺序', '框架·借用子系统'],
	fendjing: ['起盘', '四柱', '两头钳', '命格', '判断', '六段断语'],
	beiji: ['起盘', '年时', '条文索引', '完整条文', '条文检索', '家亲', '财官性情', '大运'],
	nanji: ['起盘', '四柱', '宫部条文', '条文查询', '大运', '密码', '星图推演'],
	chunzi: ['起盘', '四柱', '代码来源', '结构解析', '候选条文', '代码查询', '批量代码查询', '关键词检索', '多标签检索', '宿名检索', '时辰检索'],
	xianqin: ['起盘', '三宫', '三星·元辰', '大限', '流年小限', '神煞·待校', '衍生星', '十二宫', '吞啖合战', '情性与格局', '二十八宿禽', '十二宫顺序', '三元起宿', '合宿表', '科名月宿', '四季得时', '情性赋全表', '二十八宿正像', '吞啖合战规则', '贵贱赋摘要', '演法·流派', '演法·起禽', '演法·择日', '演法·占卜', '演法·投胎'],
	cetian: ['起盘', '农历与命身', '四化', '飞星', '格局', '命宮', '兄弟宮', '夫妻宮', '子女宮', '財帛宮', '疾厄宮', '遷移宮', '交友宮', '官祿宮', '田宅宮', '福德宮', '父母宮', '男女宮', '奴僕宮', '妻妾宮', '相貌宮', '衣鉢宮', '徒弟宮', '本師宮', '小師宮', '人刀宮', '僧道宮', '遊行宮', '師號宮', '相品宮', '运限', '童限', '凶限提示', '会照', '流年飞星', '流年七煞', '十七飞星', '神煞·岁前', '神煞·岁后', '神煞·年干', '神煞·月煞', '三日宫', '廿八宿分野', '十干变曜', '杂曜', '断诀', '星曜别名', '阴阳宫', '星解与运限歌', '星曜属性', '正曜副曜', '宫干四化表', '飞化规则', '古法格局规则', '三合组'],
	germany: ['起盘信息', '宫位宫头', '行星', '中点', 'TNP星体', '中点相位', '90°中点盘', '行星图', '映点', '中点列表', '六宫框落宫', '赤纬接触', '校时预览', '中点坐标', '公式求解', '汉堡学派要素', '组合盘', '戴维森盘', '虚星参考'],   // 六宫框全表 / 赤纬接触 / 校时预览 / 公式求解
	babylon: ['起盘信息', '七曜按宫', '分至天狼星', '位三法', '行星神性', '数理星历', '吉日历', '年历预测', '微黄道'],   // 三页签候选段(默认关);微黄道保持居末(v50 union 迁移锚)
	jieqi: ['节气盘参数', '二十四节气', '春分星盘', '春分宿盘', '春分3D盘', '夏至星盘', '夏至宿盘', '夏至3D盘', '秋分星盘', '秋分宿盘', '秋分3D盘', '冬至星盘', '冬至宿盘', '冬至3D盘'],
	...JIEQI_SETTING_PRESETS,
	otherbu: ['起盘信息', '骰子结果', '骰子盘宫位与星体', '天象盘宫位与星体', '骰子盘相位', '天象盘相位'],   // 两盘相位段
	fengshui: ['起盘信息', '标记判定', '冲突清单', '未定位标注', '破局危害', '龙虎灶台', '移动盘', '吉凶评分', '缓解建议', '使用要点', '建议汇总', '纳气建议', '八卦定位', '成员卦象', '四类象格局', '应期成格', '改运建议', '风水·纳气盘', '风水·八卦阳宅', '风水·八宅大游年', '风水·玄空飞星', '风水·三合水法', '风水·金锁玉关', '风水·乾坤国宝', '风水·紫白飞星', '风水·辅星水法', '风水·净阴净阳', '风水·玄空大卦', '风水·形势峦头', '风水·择日选择',
		'风水·玄空六法', '风水·命理派', '风水·综合罗经', '风水·大玄空', '风水·水龙平洋', '风水·改造化煞', '风水·阳宅判断',
	],
	canping: ['起盘', '本命', '大运·歲運', '流年·歲運'],
	zhengchuan: ['起盘信息', '起数', '本命条文', '流年总纲', '流年条文', '五基础数据', '装卦', '断本命', '策数', '死月', '死月扫描',
		'十二宫与六亲宫', '六亲属相', '妻室姓氏', '玄机卦动爻', '八刻分命', '条文秘数查询', '性情项查询', '古籍未载之格'],
	heluo: ['起命', '先天卦·元堂爻辞', '后天卦·元堂爻辞', '命运篇', '起卦详情', '大限·岁运', '流年·岁运', '断验'],   // 起卦详情 随 builder 段序
	yizhangjing: ['起盘信息', '四柱四宫断语', '命宫与人事十二宫', '四世与权重', '人事十二宫寓意', '格局判定', '九品定格', '年上运程', '位置速断', '各柱逢星速断', '六道分布', '主星象义与星性', '重犯', '交互格', '职业适性', '大限', '童限', '小限与流年十二神', '流月流日流时', '流年总论', '叠断', '神煞合参', '诗文', '逐日值星', '时辰细断', '四柱文献'],
	// 黄历:段名与 NongLiMain.buildNongliSnapshotText 的 [X] 段头一一对应(v43;refresh-event 实时快照)。
	// huangli/tongshu:段名与 huangliSnapshot/tongshuSnapshot 的 [X] 段头一一对应;
	// 同时供导出(module:calendar-huangli/-tongshu 提取)与挂载内容勾选(此前 schema=null → 面板空白)。
	// 年度吉日榜=默认关候选段(开过面板才产;体量大且非当日事实)。
	huangli: ['起盘信息', '今日宜忌', '值神值宿', '彭祖百忌', '吉神凶煞', '冲煞·胎神·方位', '时辰吉凶', '物候·六曜·数九三伏', '流年年神方位', '年度吉日榜', '方法说明'],
	// 本月逐日表=默认关候选段(董公建除月表 / 天元乌兔逐日值星;体量大且非所选日事实)。
	tongshu: ['通书择日', '本月逐日表', '方法说明'],
	// 前三段=聚合导出的子源标签(【农历】【老黄历】【日子馆】,E-6):非内容段,是来源分界——自定义段的
	// 用户不勾则标签行被删、同名段无法分辨来源;【通书择日】标签与既有内容段同名,共用后者登记(不重复列)。
	calendar: ['农历', '老黄历', '日子馆', '起盘信息', '当月月历', '选中日详情', '今日宜忌', '值神值宿', '彭祖百忌', '吉神凶煞', '冲煞·胎神·方位', '时辰吉凶', '物候·六曜·数九三伏', '流年年神方位', '通书择日', '本月逐日表', '日子馆·个性化择日', '当事人八字', '个性化吉日榜', '所选吉日·完整日课', '年度吉日榜', '方法说明'],   // 所选吉日完整日课=默认关候选段;个性化吉日榜=动态计数段头折叠名
};
// 奇门择日 = 奇门 17 段全量(单一真值源:qimen 段表改动自动跟随) + 择日三段。
// 🔒 三个追加段头与 src/divination/zeri/qimenZeriSnapshot.js 逐字成对(四同步)。
AI_EXPORT_PRESET_SECTIONS.qimenzeri = [...AI_EXPORT_PRESET_SECTIONS.qimen, '择日搜索配置', '择日条件', '命中时辰'];
// 黄历择日 = 黄历日课快照段(选中日) + 择吉三段(段头与 huangliZeriSnapshot builder 🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.huanglizeri = [...(AI_EXPORT_PRESET_SECTIONS.huangli || []), '择吉搜索配置', '择吉条件', '命中日段'];
// 八字择日 = 八字快照段(bazi 段表单源自动跟随) + 择时三段(段头与 baziZeriSnapshot builder 🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.bazizeri = [...(AI_EXPORT_PRESET_SECTIONS.bazi || []), '择时搜索配置', '择时条件', '命中时段'];
// 太乙择日 = 太乙快照段(taiyi 段表单源自动跟随) + 择时三段(段头与 taiyiZeriSnapshot builder 🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.taiyizeri = [...(AI_EXPORT_PRESET_SECTIONS.taiyi || []), '择时搜索配置', '择时条件', '命中时段'];
// 紫微择日 = 紫微快照段(ziwei 段表单源自动跟随) + 择时三段(段头与 ziweiZeriSnapshot builder 🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.ziweizeri = [...(AI_EXPORT_PRESET_SECTIONS.ziwei || []), '择时搜索配置', '择时条件', '命中时段'];
// 六壬择日 = 六壬快照段(liureng 段表单源自动跟随) + 择时三段(段头与 liurengZeriSnapshot builder 🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.liurengzeri = [...(AI_EXPORT_PRESET_SECTIONS.liureng || []), '择时搜索配置', '择时条件', '命中时段'];
// 三式择日 = 三式合一快照段(sanshiunited 段表单源自动跟随) + 择时三段(段头与 sanshiZeriSnapshot builder 🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.sanshizeri = [...(AI_EXPORT_PRESET_SECTIONS.sanshiunited || []), '择时搜索配置', '择时条件', '命中时段'];
// 七政择日 = 七政快照段(guolao 段表单源自动跟随) + 择时三段(段头与 qizhengZeriSnapshot builder 🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.qizhengzeri = [...(AI_EXPORT_PRESET_SECTIONS.guolao || []), '择时搜索配置', '择时条件', '命中时段'];
// 印度择日 = 择时三段自足(印度页 A 类星盘系无 module 快照槽,盘全文见主印度页——builder 段头🔒逐字成对)。
AI_EXPORT_PRESET_SECTIONS.indiazeri = ['择时搜索配置', '择时条件', '命中时段'];

// 自检用:返回所有「有 preset 段表」的技法 key。配合测试断言 preset key ⊆ AI_EXPORT_TECHNIQUES,
// 堵住「有 preset 却没登记进 AI_EXPORT_TECHNIQUES → 在导出设置下拉隐身 + 不被 getAIExportAuditMatrix 自检」的回归
// (canping 参评数 / heluo 河洛理数 此前正是踩了此坑)。
export function getAIExportPresetKeys(){
	return Object.keys(AI_EXPORT_PRESET_SECTIONS);
}

export const AI_EXPORT_FORBIDDEN_SECTIONS = {
	liureng: ['右侧栏目'],
	qimen: ['右侧栏目'],
	sanshiunited: ['右侧栏目'],
};

// ywastr* 字体把术语编码到单字符里，复制后只剩字母，需要反解码。
export const STANDALONE_TOKEN_MAP = {
	A: '日',
	B: '月',
	C: '水',
	D: '金',
	E: '火',
	F: '木',
	G: '土',
	H: '天王',
	I: '海王',
	J: '冥王',
	K: '北交',
	L: '南交',
	o: '灵点',
	p: '福点',
	q: '弱点',
	r: '爱点',
	s: '勇点',
	t: '赢点',
	u: '罪点',
	v: '暗月',
	w: '紫气',
	y: '凯龙',
	z: '月亮朔望点',
	$: '月亮平均近地点',
	Y: '月亮平均远地点',
	'{': '',
	'0': '上升',
	'1': '天顶',
	'2': '天底',
	'3': '下降',
	'4': '谷神星',
	'5': '智神星',
	'6': '婚神星',
	'7': '灶神星',
	'8': '人龙星',
	// 相位
	M: '0˚',
	N: '30˚',
	O: '45˚',
	P: '60˚',
	R: '90˚',
	S: '120˚',
	T: '135˚',
	V: '150˚',
	W: '180˚',
	Z: '逆行',
};

export const ZODIAC_CODE_MAP = {
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
};

export const ZODIAC_STANDALONE_MAP = {
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
};
