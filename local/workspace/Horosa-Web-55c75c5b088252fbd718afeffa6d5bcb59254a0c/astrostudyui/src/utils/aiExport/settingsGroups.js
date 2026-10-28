// AI 导出 · 设置读写与分组:load / save、技法分组、命主实况段、段分组规则、抽取器类型、默认关段、生效段、快照段过滤。
// 由 utils/aiExport.js 门面统一对外导出。
import { getStore } from '../storageutil';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { buildSubjectFacts, SUBJECT_FACTS_TITLE } from '../subjectFacts';   // 「附命主实况」(prefs.subjectFacts,缺省关)
import { getLocalChart } from '../localcharts';
import { AI_EXPORT_SETTINGS_KEY, isAstroLikeExportKey, AI_EXPORT_SECTION_MIGRATION_KEYS, AI_EXPORT_TECHNIQUES, AI_EXPORT_PRESET_SECTIONS } from './presets';
import {
	uniqueArray, isPlanetInfoTechnique, isAstroMeaningTechnique, isHoverMeaningTechnique,
	getMeaningSettingMetaByTechnique, getPlanetInfoSettingByTechnique, getAstroMeaningSettingByTechnique,
	normalizeSectionTitle, normalizeAIExportSettings, snapshotModuleKeyByContextKey, isJieQiSplitSettingKey,
	getOptionsForTechniqueKey,
} from './settingsModel';
import { filterContentByWantedSections, mapLegacySectionTitle, getForbiddenSectionSet, stripForbiddenSections, getJieQiWantedSections } from './sectionFilter';
import { resolveExportContextForPayload } from './contextResolve';
import { normalizeExportKey, isPredictiveExportKey } from './exportKeys';

export function loadAIExportSettings(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return normalizeAIExportSettings(null);
		}
		const raw = window.localStorage.getItem(AI_EXPORT_SETTINGS_KEY);
		if(!raw){
			return normalizeAIExportSettings(null);
		}
		return normalizeAIExportSettings(JSON.parse(raw));
	}catch(e){
		return normalizeAIExportSettings(null);
	}
}

export function saveAIExportSettings(settings){
	const normalized = normalizeAIExportSettings(settings);
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			safeLocalStorageSet(AI_EXPORT_SETTINGS_KEY, JSON.stringify(normalized));
		}
	}catch(e){
	}
	return normalized;
}

// [YE] 技法下拉分组:73 项扁平列表按术数域分五组(设置面 OptGroup 渲染)。
// 键归组按域硬编码;未列键自动落「其他」——新增技法漏归组不隐身、只是分组粗。
const AI_EXPORT_TECHNIQUE_GROUPS = [
	{ title: '西方占星', keys: ['astrochart', 'hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation', 'locastro', 'astrochart_like', 'relative', 'mundane', 'germany',
		'babylon',
		'horary', 'election', 'tianxing', 'otherbu', 'jieqi', 'jieqi_meta', 'jieqi_chunfen', 'jieqi_xiazhi', 'jieqi_qiufen', 'jieqi_dongzhi',
	] },
	{ title: '星运推运', keys: ['primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'distributions', 'agepoint', 'ephemeris', 'returntimeline', 'prenatalsyzygy', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials', 'planetaryages', 'prog', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns',
	] },
	{ title: '中式命理', keys: ['bazi', 'ziwei', 'guolao', 'qizhengkin', 'indiachart', 'heluo', 'canping', 'zhengchuan', 'yizhangjing', 'xianqin', 'cetian', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi', 'suzhan',
	] },
	{ title: '占卜术数', keys: ['sixyao', 'tongshefa', 'liureng', 'jinkou', 'qimen', 'qimenzeri', 'bazizeri', 'taiyizeri', 'ziweizeri', 'liurengzeri', 'sanshizeri', 'qizhengzeri', 'indiazeri', 'sanshiunited', 'taiyi', 'huangji', 'wuzhao', 'taixuan', 'guice', 'xiaoliuren', 'xiaochengtu', 'feigong', 'jingjue', 'shenyishu', 'geomancy', 'tarot', 'lingqi', 'fengshui',
		'calendar', 'huangli', 'huanglizeri', 'tongshu'] },
];

// 「附命主实况」只附在「这张命盘本人」的导出上:星运推运 / 中式命理两组,西方占星只认本命盘及由它派生的盘;
// 卜卦 / 择日 / 世俗 / 节气 / 合盘 / 占卜术数等不附(那不是这位命主本人的盘,附了就把私人内容带进别的导出)
const SUBJECT_FACTS_EXPORT_WESTERN_KEYS = ['astrochart', 'hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation', 'locastro', 'astrochart_like', 'germany', 'babylon'];
const SUBJECT_FACTS_EXPORT_GROUPS = ['星运推运', '中式命理'];
const SUBJECT_FACTS_EXPORT_SKIP_KEYS = [
];
export function subjectFactsExportAllowed(exportKey){
	const k = normalizeExportKey(exportKey);
	if(!k || SUBJECT_FACTS_EXPORT_SKIP_KEYS.indexOf(k) >= 0){ return false; }
	if(SUBJECT_FACTS_EXPORT_WESTERN_KEYS.indexOf(k) >= 0){ return true; }
	return AI_EXPORT_TECHNIQUE_GROUPS.some((g)=>SUBJECT_FACTS_EXPORT_GROUPS.indexOf(g.title) >= 0 && g.keys.indexOf(k) >= 0);
}
// 当前盘(主页 fields 的 cid)在命盘库里 → 「[命主实况]」整段;不是已存命盘 / 没填 / 这个导出不附 → ''
export function buildSubjectFactsExportSection(exportKey){
	if(!subjectFactsExportAllowed(exportKey)){ return ''; }
	const st = getStore();
	const f = st && st.astro && st.astro.fields ? st.astro.fields : null;
	const cid = f && f.cid && f.cid.value ? `${f.cid.value}` : '';
	if(!cid){ return ''; }
	let rec = null;
	try{ rec = getLocalChart(cid); }catch(e){ rec = null; }
	if(!rec){ return ''; }
	const facts = buildSubjectFacts(rec);
	return facts.count && facts.text ? `[${SUBJECT_FACTS_TITLE}]\n${facts.text}` : '';
}

// 静态域定义(键 → 组标题 / 组序),不算任何选项:给只需要「键归哪个域」的消费方(挂载下拉 / @ 菜单分组)用——
// listAIExportTechniqueSettingGroups 会对每个技法算快照选项(遍历 localStorage),在按键路径上不可承受
export function listAIExportTechniqueGroupDefs(){
	return AI_EXPORT_TECHNIQUE_GROUPS.map((group)=>({ title: group.title, keys: group.keys.slice() }));
}

export function listAIExportTechniqueSettingGroups(){
	const items = listAIExportTechniqueSettings();
	const byKey = new Map(items.map((item)=>[item.key, item]));
	const used = new Set();
	const groups = AI_EXPORT_TECHNIQUE_GROUPS.map((group)=>({
		title: group.title,
		items: group.keys.map((key)=>{ used.add(key); return byKey.get(key); }).filter(Boolean),
	})).filter((group)=>group.items.length > 0);
	const rest = items.filter((item)=>!used.has(item.key));
	if(rest.length){
		groups.push({ title: '其他', items: rest });
	}
	return groups;
}

// [YE] 厚技法「段两级分组」纯展示层(段名/设置存储零变更):印占 40+ 段/三式 60+ 段在设置面按
// 右栏 tab 语义分组小标题渲染。matcher 按段名前缀/词典;未命中段落落「其他段」组,永不隐身。
const AI_EXPORT_SECTION_GROUP_RULES = {
	sanshiunited: [
		{ title: '太乙', test: (s)=>s.startsWith('太乙') },
		{ title: '奇门', test: (s)=>s.startsWith('奇门') },
		{ title: '六壬·断卦', test: (s)=>['大六壬', '四课', '三传', '课体结构', '三传旺衰', '空亡真假', '旬空落点', '陷空', '遁干特殊', '年命上神', '毕法（已命中）', '占断向导', '大格', '小局', '参考'].some((k)=>s.startsWith(k) || s === k) },
		{ title: '神煞·基础', test: (s)=>s.includes('神煞') || ['行年', '旬日', '旺衰', '干煞', '月煞', '支煞', '岁煞', '十二长生', '概览', '起盘信息', '紫微四化'].includes(s) },
	],
	indiachart: [
		{ title: '大运与年运', test: (s)=>s.includes('大运') || s.startsWith('Tajika') || s.includes('年运') || s.startsWith('行运') || s.startsWith('座运') },
		{ title: '力量与吉凶', test: (s)=>['Shadbala 六力', 'Ishta/Kashta 吉凶果', '宫位力（Bhava Bala）', '星曜战（Graha Yuddha）', '功能吉凶（Functional Nature）', '敌友（复合五分）', '星曜状态'].includes(s) },
		{ title: '分盘与点位', test: (s)=>s.includes('分盘') || s.includes('上升') || s.startsWith('Nāḍī') || s.includes('八分点') || s.includes('Pinda') || s.includes('卡拉卡') || s.includes('副星') },
		{ title: 'KP 与择时', test: (s)=>s.startsWith('KP') || s.includes('择时') || s.includes('Hora') || s.includes('Choghadia') },
		{ title: '格局与其他', test: (s)=>s.includes('格局') || s.includes('Yoga') || s.includes('Kartari') || s.includes('Argala') || s.includes('化解') || s.includes('主照') || s.includes('五要素') || s.includes('寿命') },
	],
};

export function getSectionGroupsForTechnique(key, options){
	const rules = AI_EXPORT_SECTION_GROUP_RULES[normalizeExportKey(key)];
	const list = Array.isArray(options) ? options : [];
	if(!rules || list.length < 16){
		return null; // 无规则/段少 → 平铺现状
	}
	const groups = rules.map((rule)=>({ title: rule.title, items: [] }));
	const rest = { title: '其他段', items: [] };
	list.forEach((section)=>{
		const hit = rules.findIndex((rule)=>rule.test(`${section}`));
		if(hit >= 0){ groups[hit].items.push(section); }
		else{ rest.items.push(section); }
	});
	const out = groups.filter((group)=>group.items.length > 0);
	if(rest.items.length){ out.push(rest); }
	return out.length > 1 ? out : null;
}

export function listAIExportTechniqueSettings(){
	const settings = loadAIExportSettings();
	return AI_EXPORT_TECHNIQUES.map((item)=>{
		const meaningMeta = getMeaningSettingMetaByTechnique(item.key);
		return {
			key: item.key,
			label: item.label,
			options: getOptionsForTechniqueKey(item.key),
			supportsPlanetInfo: isPlanetInfoTechnique(item.key),
			planetInfo: getPlanetInfoSettingByTechnique(settings, item.key),
			supportsAstroMeaning: isAstroMeaningTechnique(item.key) || isHoverMeaningTechnique(item.key),
			astroMeaning: getAstroMeaningSettingByTechnique(settings, item.key),
			astroMeaningTitle: meaningMeta.title,
			astroMeaningCheckbox: meaningMeta.checkbox,
		};
	});
}

function getExtractorKindByExportKey(key){
	const exportKey = normalizeExportKey(key);
	if(exportKey === 'astrochart' || isAstroLikeExportKey(exportKey) || exportKey === 'indiachart'){
		return 'astro';
	}
	if(exportKey === 'mundane'){
		// 世俗盘实际路由=extractContentByKey 的 horary/election/mundane/tianxing/qimenzeri
		// 统一分支 → extractSimpleModuleContent(refresh 事件+模块缓存),与 predictive 系同机制;
		// 本 kind 仅供 getAIExportAuditMatrix 分组展示,勿据此臆断存在专用抓取器。
		return 'predictive';
	}
	if(exportKey === 'germany'){
		return 'germany';
	}
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		return 'jieqi';
	}
	if(isPredictiveExportKey(exportKey)){
		return 'predictive';
	}
	if(exportKey === 'sixyao'){
		return 'sixyao';
	}
	if(exportKey === 'liureng'){
		return 'liureng';
	}
	if(exportKey === 'jinkou'){
		return 'jinkou';
	}
	if(exportKey === 'qimen'){
		return 'qimen';
	}
	if(exportKey === 'sanshiunited'){
		return 'sanshiunited';
	}
	if(exportKey === 'tongshefa'){
		return 'tongshefa';
	}
	if(exportKey === 'babylon'){
		// 巴比伦占星:页面侧 saveModuleAISnapshot('babylon') 存模块快照,导出走模块提取。
		return 'module:babylon';
	}
	if(exportKey === 'guice' || exportKey === 'xiaoliuren' || exportKey === 'xiaochengtu' || exportKey === 'feigong'
		|| exportKey === 'huangji' || exportKey === 'wuzhao' || exportKey === 'taixuan' || exportKey === 'jingjue'
		|| exportKey === 'shenyishu' || exportKey === 'geomancy' || exportKey === 'tarot' || exportKey === 'lingqi' || exportKey === 'shaozi' || exportKey === 'tieban' || exportKey === 'fendjing'
		|| exportKey === 'beiji' || exportKey === 'nanji' || exportKey === 'chunzi' || exportKey === 'xianqin'
		|| exportKey === 'cetian' || exportKey === 'qizhengkin' || exportKey === 'guolao' || exportKey === 'suzhan'
		|| exportKey === 'bazi' || exportKey === 'ziwei' || exportKey === 'horary' || exportKey === 'election'
		|| exportKey === 'tianxing' || exportKey === 'qimenzeri'
		|| exportKey === 'canping' || exportKey === 'heluo' || exportKey === 'zhengchuan'
		|| exportKey === 'yizhangjing' || exportKey === 'calendar' || exportKey === 'huangli' || exportKey === 'tongshu' || exportKey === 'huanglizeri' || exportKey === 'bazizeri' || exportKey === 'taiyizeri' || exportKey === 'ziweizeri' || exportKey === 'liurengzeri' || exportKey === 'sanshizeri' || exportKey === 'qizhengzeri' || exportKey === 'indiazeri'){
		return `module:${snapshotModuleKeyByContextKey(exportKey)}`;
	}
	if(exportKey === 'taiyi'){
		return 'taiyi';
	}
	if(exportKey === 'relative'){
		return 'relative';
	}
	if(exportKey === 'otherbu'){
		return 'otherbu';
	}
	if(exportKey === 'fengshui'){
		return 'fengshui';
	}
	if(exportKey === 'generic'){
		return 'generic';
	}
	return '';
}

function getStructuredSnapshotKeysByExportKey(key){
	const exportKey = normalizeExportKey(key);
	if(exportKey === 'astrochart' || isAstroLikeExportKey(exportKey)){
		return ['astro'];
	}
	if(exportKey === 'mundane'){
		return ['mundane'];
	}
	if(exportKey === 'indiachart'){
		return ['indiachart_current', 'indiachart'];
	}
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		return ['jieqi_current', 'jieqi'];
	}
	if(exportKey === 'sixyao'){
		return ['guazhan', 'sixyao'];
	}
	if(exportKey === 'qizhengkin'){
		return ['guolao-qizhengkin', 'qizhengkin'];
	}
	if(exportKey === 'generic'){
		return [];
	}
	if(isPredictiveExportKey(exportKey)
		|| exportKey === 'liureng'
		|| exportKey === 'jinkou'
		|| exportKey === 'qimen'
		|| exportKey === 'sanshiunited'
		|| exportKey === 'tongshefa'
		|| exportKey === 'taiyi'
		|| exportKey === 'relative'
		|| exportKey === 'germany'
		|| exportKey === 'babylon'
		|| exportKey === 'guolao'
		|| exportKey === 'suzhan'
		|| exportKey === 'bazi'
		|| exportKey === 'ziwei'
		|| exportKey === 'otherbu'
		|| exportKey === 'fengshui'
		|| exportKey === 'horary'
		|| exportKey === 'election'
		|| exportKey === 'tianxing'
		|| exportKey === 'qimenzeri'){
		return [exportKey];
	}
	const moduleKey = snapshotModuleKeyByContextKey(exportKey);
	return moduleKey ? [moduleKey] : [];
}

// 测试预言机:内容完备性审计矩阵(aiExportContentAudit*.test 消费;零生产消费方)
export function getAIExportAuditMatrixForTests(){
	return AI_EXPORT_TECHNIQUES.map((item)=>({
		key: item.key,
		label: item.label,
		presetSections: (AI_EXPORT_PRESET_SECTIONS[item.key] || []).slice(0),
		options: getOptionsForTechniqueKey(item.key),
		extractionKind: getExtractorKindByExportKey(item.key),
		snapshotModuleKey: snapshotModuleKeyByContextKey(item.key),
		structuredSnapshotKeys: getStructuredSnapshotKeysByExportKey(item.key),
		migrationEnabled: AI_EXPORT_SECTION_MIGRATION_KEYS.includes(item.key),
		supportsPlanetInfo: isPlanetInfoTechnique(item.key),
		supportsAstroMeaning: isAstroMeaningTechnique(item.key) || isHoverMeaningTechnique(item.key),
		isJieQiSplit: isJieQiSplitSettingKey(item.key),
	}));
}

// [YC] 默认关段注册表:判语库/象意/古籍全文等 doctrine 型段——体量大且非逐盘事实,登记进 preset
// (设置面可勾、勾了=显式自定义永久尊重),但「用户未自定义时」默认不纳入导出/挂载。
// 这是「未自定义=全量 preset」铁律的唯一受控豁免面;migration union 也排除这些段(见 normalize),
// 否则升级会把它们硬并进已自定义用户的选择=变相默认开。段名须与 builder 段头/PRESET 逐字一致。
// qimen/qimenzeri 默认关段同源一份(奇门择日 preset=奇门段全量拼接,默认关档也必须跟随;
// 曾各写一份手抄双份无锁)。派生锁测试看死。
const QIMEN_DEFAULT_OFF = ['八宫克应'];
const AI_EXPORT_DEFAULT_OFF_SECTIONS = {
	sixyao: ['判语库·参考诀表'],
	taixuan: ['太玄经全文'],
	huangji: ['经典原文', '历史年表'],
	geomancy: ['图形释义'],
	yizhangjing: ['诗文', '四柱文献', '逐日值星', '时辰细断', '叠断'],
	qimen: QIMEN_DEFAULT_OFF,
	qimenzeri: QIMEN_DEFAULT_OFF,
	liureng: ['取象'],
	// 爻位判语体量大且逐爻成文,按裁决作默认关候选段(设置面可勾)。
	tongshefa: ['爻位'],
	// 世界范式盘=恒定教义(逐盘不变),默认不占导出篇幅;设置面可勾。
	astrochart: ['古典·世界范式盘'],
	// 日子馆所选吉日的完整老黄历日课(体量大、且老黄历页另有自己的日课段),默认关、设置面可勾。
	// 年度吉日榜同理(全年 Top 榜,非当日事实)。
	calendar: ['所选吉日·完整日课', '年度吉日榜', '本月逐日表'],
	huangli: ['年度吉日榜'],
	// 通书本月逐日表同理(整月逐日,非所选日事实)。
	tongshu: ['本月逐日表'],
	// 巴比伦三页签(数理星历推演表/吉日历体系/年历预测周期表)体量大且多为体系教义,按裁决作默认关候选段(设置面可勾)。
	babylon: ['数理星历', '吉日历', '年历预测'],
};

export function getAIExportDefaultOffSet(key){
	const list = AI_EXPORT_DEFAULT_OFF_SECTIONS[normalizeExportKey(key)];
	if(!Array.isArray(list) || !list.length){
		return null;
	}
	return new Set(list.map((item)=>normalizeSectionTitle(item)));
}

export function getAIExportEffectiveSectionsForTechnique(key, settings = loadAIExportSettings()){
	const exportKey = normalizeExportKey(key);
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		const wanted = getJieQiWantedSections(settings, exportKey);
		return wanted ? Array.from(wanted) : [];
	}
	const source = settings && settings.sections && typeof settings.sections === 'object'
		? settings.sections
		: {};
	// 显式自定义的判据=键存在且为数组(含空数组=显式全清,返回空;与 getJieQiWantedSections 同语义)。
	// 旧「空数组当未自定义」正是「清空按钮点完复选框纹丝不动」的病根:存了 [] 又被解释回 preset 全勾。
	const hasCustom = Object.prototype.hasOwnProperty.call(source, exportKey) && Array.isArray(source[exportKey]);
	const selected = hasCustom ? source[exportKey] : [];
	const preset = Array.isArray(AI_EXPORT_PRESET_SECTIONS[exportKey]) ? AI_EXPORT_PRESET_SECTIONS[exportKey] : [];
	// [YC] 未自定义 → preset 剔除默认关段;显式自定义 → 完全尊重用户所选(含勾了默认关段/全清)。
	const offSet = getAIExportDefaultOffSet(exportKey);
	const picked = hasCustom
		? selected
		: (offSet ? preset.filter((item)=>!offSet.has(normalizeSectionTitle(item))) : preset);
	const forbidden = getForbiddenSectionSet(exportKey);
	return uniqueArray(picked
		.map((item)=>mapLegacySectionTitle(exportKey, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item))));
}

// 把「按技法选段」过滤套到任意快照文本上（供 AI 挂载复用导出段设置，达成四同步）。
// 安全铁律：仅当用户对该技法**显式自定义了段**时才过滤；未自定义 → 原样返回（默认即现状、零回归）；
// 过滤后为空则回退原文，避免挂载空白。
export function applyAIExportSectionFilterToSnapshot(key, content, settings = loadAIExportSettings()){
	const text = `${content == null ? '' : content}`;
	if(!text.trim()){
		return content;
	}
	const exportKey = normalizeExportKey(key);
	// 与导出主链同序:先剥禁段(AI_EXPORT_FORBIDDEN_SECTIONS,如『右侧栏目』纯 UI 回显噪音)。
	// 此前挂载封装不剥 → 未自定义用户的挂载内容带着导出侧恒剥的禁段,两链字节分叉;
	// 各回退兜底一并回 base(剥后文)而非原文,与主链 stripForbidden 后回退同口径。
	const base = stripForbiddenSections(text, exportKey);
	const sectionsCfg = settings && settings.sections && typeof settings.sections === 'object' ? settings.sections : {};
	if(!Array.isArray(sectionsCfg[exportKey])){
		// [YC] 「未自定义→原样返回」铁律的唯一受控豁免:该技法登记了默认关段 → 按 preset−默认关
		// 过滤(把 doctrine 大段挡在默认导出/挂载之外);过滤空回退剥后文的兜底沿用下方同款。
		const offSet = getAIExportDefaultOffSet(exportKey);
		if(!offSet){
			return base;
		}
		const defaults = getAIExportEffectiveSectionsForTechnique(key, settings);
		const wantedDefaults = new Set(uniqueArray(defaults || []));
		if(wantedDefaults.size === 0){
			return base;
		}
		const trimmed = filterContentByWantedSections(base, wantedDefaults);
		return `${trimmed || ''}`.trim() ? trimmed : base;
	}
	// 空数组=显式全清 → 全不纳入(挂载卡与发送内容一并置空;与导出主链同语义)。
	if(sectionsCfg[exportKey].length === 0){
		return '';
	}
	const picked = getAIExportEffectiveSectionsForTechnique(key, settings);
	const wanted = new Set(uniqueArray(picked || []));
	if(wanted.size === 0){
		// 用户显式选了段但全部落在 forbidden 集 → 真取消(勿回吐全文);
		// 「未自定义」在上方 sectionsCfg 分支已先行返回,不会走到这里。
		return '';
	}
	const filtered = filterContentByWantedSections(base, wanted);
	if(!`${filtered || ''}`.trim()){
		// 节气盘整键/分键:盘页签下的内容只含当前一盘,用户显式勾的段本内容没有 →
		// 真取消('')而非回吐全文(否则「只要夏至星盘」被盖成「春分整份」,取消=真取消在节气盘上是破的);
		// 其他技法段名与内容同源、失配只会是命名漂移,保留「回退剥后文」兜底避免挂载空白。
		return (exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)) ? '' : base;
	}
	return filtered;
}

export function resolveAIExportContextForTests(context){
	const normalized = resolveExportContextForPayload(context);
	return {
		key: normalized.key,
		displayName: normalized.displayName,
	};
}
