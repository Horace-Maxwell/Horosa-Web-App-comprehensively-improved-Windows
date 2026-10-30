// AI 导出 · 设置模型:星曜信息 / 星义开关、段名规范化、设置规范化、格式与开关偏好、快照模块键映射、刷新请求。
// 由 utils/aiExport.js 门面统一对外导出。
import {
	AI_EXPORT_SETTINGS_VERSION, AI_EXPORT_SECTION_MIGRATION_VERSION, AI_EXPORT_PREFS_FORMAT_RESET_VERSION,
	AI_EXPORT_EMPTY_CLEAR_VERSION, AI_EXPORT_FORCED_INCLUDE_SECTIONS, AI_EXPORT_V49_UNION_VERSION,
	AI_EXPORT_V49_SECTION_UNION, AI_EXPORT_V50_UNION_VERSION, AI_EXPORT_V50_SECTION_UNION,
	AI_EXPORT_V51_UNION_VERSION, AI_EXPORT_V51_SECTION_UNION, AI_EXPORT_V52_UNION_VERSION,
	AI_EXPORT_V52_SECTION_UNION, AI_EXPORT_V53_UNION_VERSION, AI_EXPORT_V53_SECTION_UNION,
	AI_EXPORT_V54_UNION_VERSION, AI_EXPORT_V54_SECTION_UNION, AI_EXPORT_V55_UNION_VERSION,
	AI_EXPORT_V55_SECTION_UNION, AI_EXPORT_V56_UNION_VERSION, AI_EXPORT_V56_SECTION_UNION,
	AI_EXPORT_V57_UNION_VERSION, AI_EXPORT_V57_SECTION_UNION, AI_EXPORT_V58_UNION_VERSION,
	AI_EXPORT_V58_SECTION_UNION, AI_EXPORT_V59_UNION_VERSION, AI_EXPORT_V59_SECTION_UNION, AI_EXPORT_V60_UNION_VERSION, AI_EXPORT_V60_SECTION_UNION, AI_EXPORT_V45_SECTION_UNION, AI_EXPORT_FORMAT_DEFAULT, isAstroLikeExportKey,
	AI_EXPORT_SECTION_MIGRATION_KEYS, AI_EXPORT_PLANET_INFO_DEFAULT, AI_EXPORT_ASTRO_MEANING_DEFAULT,
	AI_EXPORT_PLANET_INFO_TECHNIQUES, AI_EXPORT_ASTRO_MEANING_TECHNIQUES, AI_EXPORT_HOVER_MEANING_TECHNIQUES,
	JIEQI_SPLIT_SETTING_KEYS, AI_EXPORT_PRESET_SECTIONS,
} from './presets';
import { mapLegacySectionTitle, getForbiddenSectionSet } from './sectionFilter';
import { loadAIExportSettings, getAIExportDefaultOffSet } from './settingsGroups';
import { getAstroCachedContent, getModuleCachedContent, getIndiaCachedContent } from './snapshotLookup';
import { readOriginalText } from '../scriptMode';
import { dispatchModuleSnapshotRefresh, requestModuleSnapshotRefreshSync } from '../moduleSnapshotRefresh';
import { getTechniqueAliasList } from '../techniqueSlotAliases';

function sleep(ms){
	return new Promise((resolve)=>setTimeout(resolve, ms));
}

// 读页面上的字认页签 / 段:界面切到繁体时读的是简体原文(判据都按简体写),见 utils/scriptMode.js
export function textOf(node){
	if(!node){
		return '';
	}
	return readOriginalText(node, (n)=>(n.innerText || n.textContent || '').trim());
}

export function uniqueArray(arr){
	const out = [];
	const seen = new Set();
	arr.forEach((item)=>{
		if(!item){
			return;
		}
		if(!seen.has(item)){
			seen.add(item);
			out.push(item);
		}
	});
	return out;
}

export function safe(text, fallback = ''){
	const val = text === undefined || text === null ? '' : `${text}`.trim();
	if(val){
		return val;
	}
	return `${fallback || ''}`;
}

export function normalizePlanetInfoSetting(raw){
	const val = raw && typeof raw === 'object' ? raw : {};
	return {
		showHouse: val.showHouse === 1 || val.showHouse === true ? 1 : 0,
		showRuler: val.showRuler === 1 || val.showRuler === true ? 1 : 0,
	};
}

export function isPlanetInfoTechnique(key){
	return AI_EXPORT_PLANET_INFO_TECHNIQUES.has(`${key || ''}`);
}

function normalizeAstroMeaningSetting(raw){
	const val = raw && typeof raw === 'object' ? raw : {};
	return {
		enabled: val.enabled === 1 || val.enabled === true ? 1 : 0,
	};
}

export function isAstroMeaningTechnique(key){
	return AI_EXPORT_ASTRO_MEANING_TECHNIQUES.has(`${key || ''}`);
}

export function isHoverMeaningTechnique(key){
	return AI_EXPORT_HOVER_MEANING_TECHNIQUES.has(`${key || ''}`);
}

export function getMeaningSettingMetaByTechnique(key){
	if(isHoverMeaningTechnique(key)){
		return {
			title: '悬浮注释（仅AI导出）：',
			checkbox: '在对应分段输出六壬/遁甲/占星悬浮注释',
		};
	}
	if(isAstroMeaningTechnique(key)){
		return {
			title: '占星注释（仅AI导出）：',
			checkbox: '在对应分段输出星/宫/座/相/希腊点释义',
		};
	}
	return {
		title: '',
		checkbox: '',
	};
}

export function getPlanetInfoSettingByTechnique(settings, key){
	if(!isPlanetInfoTechnique(key)){
		return {
			showHouse: 0,
			showRuler: 0,
		};
	}
	const pi = settings && settings.planetInfo && typeof settings.planetInfo === 'object' ? settings.planetInfo : null;
	// 六衍生键无自身设置时回落聚合键 astrochart_like(挂载侧仍按聚合键读)→ 同盘导出与挂载同开关。
	const source = pi ? (pi[key] || ((isAstroLikeExportKey(key) && key !== 'astrochart_like') ? pi.astrochart_like : null)) : null;
	if(!source){
		return {
			...AI_EXPORT_PLANET_INFO_DEFAULT,
		};
	}
	return normalizePlanetInfoSetting(source);
}

export function getAstroMeaningSettingByTechnique(settings, key){
	if(!isAstroMeaningTechnique(key) && !isHoverMeaningTechnique(key)){
		return {
			enabled: 0,
		};
	}
	const am = settings && settings.astroMeaning && typeof settings.astroMeaning === 'object' ? settings.astroMeaning : null;
	// 同上:六衍生键无自身设置时回落聚合键。
	const source = am ? (am[key] || ((isAstroLikeExportKey(key) && key !== 'astrochart_like') ? am.astrochart_like : null)) : null;
	if(!source){
		return {
			...AI_EXPORT_ASTRO_MEANING_DEFAULT,
		};
	}
	return normalizeAstroMeaningSetting(source);
}

// 导出供段同构闸复用同一折叠规则(座运·X / 专题深化·X / 基于X点推运),免测试另抄一份归一逻辑。
export function normalizeSectionTitle(title){
	const t = `${title || ''}`.trim();
	if(!t){
		return '';
	}
	if(/^基于.+推运$/.test(t)){
		return '基于X点推运';
	}
	if(/^基于.+起运$/.test(t)){
		return '基于X起运';
	}
	// 印占 Rasi Dasha 座运·X(11 变体,IndiaChart.js out[`座运·${name}`])折叠成单占位,
	// 与 preset 的「座运·X」两侧归一 → 一个纳入开关控 11 段(同 基于X点推运 范式)。
	if(/^座运·.+$/.test(t)){
		return '座运·X';
	}
	// 西洋卜卦 horary 专题深化·X(诉讼/买房/怀孕 3 变体,horarySnapshot.js 段头 `[专题深化·${topic.title}]`)
	// 折叠成单占位,与 preset 的「专题深化·X」两侧归一 → 一个纳入开关控 3 类专题(同 座运·X 范式)。
	if(/^专题深化·.+$/.test(t)){
		return '专题深化·X';
	}
	// 日子馆吉日榜段头带动态计数 `[个性化吉日榜 Top N／全年候选 M]`(riziSnapshot.js):折叠成静态名并登记
	// calendar 段表,否则对「黄历」做任何自定义勾选后整张榜单被段过滤丢掉(只剩事项/年份/八字/方法说明)。
	if(/^个性化吉日榜(\s|／|$).*$/.test(t)){
		return '个性化吉日榜';
	}
	return t;
}

export function parseSectionTitleLine(line){
	const txt = `${line || ''}`.trim();
	if(!txt){
		return '';
	}
	let m = txt.match(/^\[(.+)\]$/);
	if(!m || !m[1]){
		m = txt.match(/^【(.+)】$/);
	}
	if(m && m[1]){
		return normalizeSectionTitle(m[1]);
	}
	return '';
}

export function extractSectionTitles(content){
	const lines = `${content || ''}`.split('\n');
	const titles = [];
	lines.forEach((line)=>{
		const normalized = parseSectionTitleLine(line);
		if(normalized){
			titles.push(normalized);
		}
	});
	return uniqueArray(titles);
}

// 全局导出偏好(非 per-technique):format=v1/v2;attachScreenshot=PDF/Word 附当前页面截图
// (用户拍板:默认开);legend=[图例]段(注册表为空时天然无输出)。未知值一律回默认(前向兼容)。
export function normalizeAIExportPrefs(prefs){
	const src = prefs && typeof prefs === 'object' ? prefs : {};
	return {
		format: src.format === 'v2' ? 'v2' : (src.format === 'v1' ? 'v1' : AI_EXPORT_FORMAT_DEFAULT),
		attachScreenshot: src.attachScreenshot !== false,
		legend: src.legend === true,   // 缺省关:此前缺省开但表空(零输出);首批填表后若仍缺省开会改变缺省导出字节与模型载荷 ⇒ 翻关,设置面勾选后才拼装
		subjectFacts: src.subjectFacts === true,   // 附「命主实况」(当前命盘本人填写的):缺省关 = 导出字节不变;不是 preset 段,不吃段勾选
	};
}

export function normalizeAIExportSettings(settings){
	const sourceVersion = settings && typeof settings === 'object'
		? parseInt(`${settings.version || 0}`, 10) || 0
		: 0;
	const normalized = {
		version: AI_EXPORT_SETTINGS_VERSION,
		sections: {},
		planetInfo: {},
		astroMeaning: {},
		prefs: normalizeAIExportPrefs(settings && settings.prefs),
	};
	// prefs.format='v1' 且来源版本 <41 = 未发布中间态构建的持久化残留
	// (prefs 字段 v40 期间短暂默认过 'v1',任何设置保存都会把它显式落盘;翻默认后残留值
	//  合法压过 v2——用户实测「复制没差别」正是此坑)。一次性重置回默认;v41 起用户在
	// 设置面显式选 v1 会以 version=41 落盘,不再进本窗口,永久尊重。
	if(sourceVersion < AI_EXPORT_PREFS_FORMAT_RESET_VERSION && normalized.prefs.format === 'v1'){
		normalized.prefs = { ...normalized.prefs, format: AI_EXPORT_FORMAT_DEFAULT };
	}
	if(!settings || typeof settings !== 'object'){
		return normalized;
	}
	const sections = settings.sections && typeof settings.sections === 'object' ? settings.sections : {};
	Object.keys(sections).forEach((key)=>{
		const arr = Array.isArray(sections[key]) ? sections[key] : [];
		// 旧段名一并迁到现名(顶栏「AI 导出设置」与各技法设置同走这里;如风水「成員卦象」→「成员卦象」),
		// 否则设置面里勾着的是旧名、对不上现在的段,看着勾了实际被滤掉。
		const cleaned = uniqueArray(arr.map((item)=>mapLegacySectionTitle(key, item)).filter(Boolean));
		// 旧版「清空」存下的空数组在旧语义=未自定义(effective/导出/挂载全按默认走),
		// 一次性删键恢复未自定义 → 与老用户所见现状逐字一致(零回归);v45 起空数组=显式全清,原样保留。
		if(!cleaned.length && sourceVersion < AI_EXPORT_EMPTY_CLEAR_VERSION){
			return;
		}
		normalized.sections[key] = cleaned;
	});
	// v<45 已自定义(非空)的五技法:把旧导出主链运行时强推清单 union 进用户选择
	// (行为=旧导出输出不变,但 UI 从此显示勾着、用户取消=真取消);运行时强推已从 applyUserSectionFilter 删除。
	// [MT parity] 同窗附带:v45 preset 补真段的技法同样 union——不并入则自定义用户的
	// 白名单静默滤掉这批 builder 实产内容段。
	if(sourceVersion < AI_EXPORT_EMPTY_CLEAR_VERSION){
		[AI_EXPORT_FORCED_INCLUDE_SECTIONS, AI_EXPORT_V45_SECTION_UNION].forEach((table)=>{
			Object.keys(table).forEach((key)=>{
				const existing = normalized.sections[key];
				if(!Array.isArray(existing) || !existing.length){
					return;
				}
				normalized.sections[key] = uniqueArray([
					...existing,
					...table[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
				]);
			});
		});
	}
	// 本版新增段的键内 union（窗口独立于 v45，故 v45+ 存档也能补到新段而不重走全量 union）。
	if(sourceVersion < AI_EXPORT_V49_UNION_VERSION){
		Object.keys(AI_EXPORT_V49_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V49_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同 v49 机制的下一窗(babylon 微黄道)。
	if(sourceVersion < AI_EXPORT_V50_UNION_VERSION){
		Object.keys(AI_EXPORT_V50_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V50_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同 v49/v50 机制的下一窗。
	if(sourceVersion < AI_EXPORT_V51_UNION_VERSION){
		Object.keys(AI_EXPORT_V51_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V51_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(内容完备性审计批新生段)。
	if(sourceVersion < AI_EXPORT_V56_UNION_VERSION){
		Object.keys(AI_EXPORT_V56_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V56_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(Windows #79:分宫制宫神星表自主宰星链拆出的独立段,九个西占键)。
	if(sourceVersion < AI_EXPORT_V57_UNION_VERSION){
		Object.keys(AI_EXPORT_V57_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V57_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(Q-451:三式合一六壬断卦层的「七政」段)。
	if(sourceVersion < AI_EXPORT_V58_UNION_VERSION){
		Object.keys(AI_EXPORT_V58_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V58_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(量化盘「赤纬接触」独立段)。
	if(sourceVersion < AI_EXPORT_V59_UNION_VERSION){
		Object.keys(AI_EXPORT_V59_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V59_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(量化盘「中点坐标」「公式求解」两个独立段)。
	if(sourceVersion < AI_EXPORT_V60_UNION_VERSION){
		Object.keys(AI_EXPORT_V60_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V60_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(风水·阳宅判断:峦头/理气/客星三方合参)。
	if(sourceVersion < AI_EXPORT_V55_UNION_VERSION){
		Object.keys(AI_EXPORT_V55_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V55_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(风水·改造化煞:形煞/气煞/补偏救弊)。
	if(sourceVersion < AI_EXPORT_V54_UNION_VERSION){
		Object.keys(AI_EXPORT_V54_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V54_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(风水·水龙平洋:形势新派)。
	if(sourceVersion < AI_EXPORT_V53_UNION_VERSION){
		Object.keys(AI_EXPORT_V53_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V53_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	// 同机制的下一窗(风水·大玄空:理气新派单盘挨星)。
	if(sourceVersion < AI_EXPORT_V52_UNION_VERSION){
		Object.keys(AI_EXPORT_V52_SECTION_UNION).forEach((key)=>{
			const existing = normalized.sections[key];
			if(!Array.isArray(existing) || !existing.length){
				return;
			}
			normalized.sections[key] = uniqueArray([
				...existing,
				...AI_EXPORT_V52_SECTION_UNION[key].map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
		});
	}
	if(sourceVersion < AI_EXPORT_SECTION_MIGRATION_VERSION){
		AI_EXPORT_SECTION_MIGRATION_KEYS.forEach((key)=>{
			if(!Object.prototype.hasOwnProperty.call(sections, key)){
				return;
			}
			const preset = Array.isArray(AI_EXPORT_PRESET_SECTIONS[key]) ? AI_EXPORT_PRESET_SECTIONS[key] : [];
			// [YC] union 排除默认关段:否则升级把 doctrine 段硬并进已自定义用户的选择=变相默认开。
			const offSet = getAIExportDefaultOffSet(key);
			const merged = uniqueArray([
				...(normalized.sections[key] || []),
				...preset
					.map((item)=>normalizeSectionTitle(item))
					.filter(Boolean)
					.filter((item)=>!offSet || !offSet.has(item)),
			]);
			normalized.sections[key] = merged;
		});
	}
	const planetInfo = settings.planetInfo && typeof settings.planetInfo === 'object' ? settings.planetInfo : {};
	Object.keys(planetInfo).forEach((key)=>{
		if(!isPlanetInfoTechnique(key)){
			return;
		}
		normalized.planetInfo[key] = normalizePlanetInfoSetting(planetInfo[key]);
	});
	const astroMeaning = settings.astroMeaning && typeof settings.astroMeaning === 'object' ? settings.astroMeaning : {};
	Object.keys(astroMeaning).forEach((key)=>{
		if(!isAstroMeaningTechnique(key) && !isHoverMeaningTechnique(key)){
			return;
		}
		normalized.astroMeaning[key] = normalizeAstroMeaningSetting(astroMeaning[key]);
	});
	return normalized;
}

// 偏好读取口(设置面/导出链共用;normalize 已填默认,这里再兜一层防手改 localStorage 脏值)。
export function getAIExportFormatPreference(settings = loadAIExportSettings()){
	const prefs = settings && settings.prefs;
	return prefs && prefs.format === 'v2' ? 'v2' : (prefs && prefs.format === 'v1' ? 'v1' : AI_EXPORT_FORMAT_DEFAULT);
}

export function isAIExportScreenshotEnabled(settings = loadAIExportSettings()){
	const prefs = settings && settings.prefs;
	return !(prefs && prefs.attachScreenshot === false);
}

export function isAIExportLegendEnabled(settings = loadAIExportSettings()){
	const prefs = settings && settings.prefs;
	return !!(prefs && prefs.legend === true);
}

export function isAIExportSubjectFactsEnabled(settings = loadAIExportSettings()){
	const prefs = settings && settings.prefs;
	return !!(prefs && prefs.subjectFacts === true);
}


export function snapshotModuleKeyByContextKey(key){
	if(key === 'sixyao'){
		return 'guazhan';
	}
	const map = {
		huangli: 'calendar-huangli',
		huanglizeri: 'huanglizeri',
		bazizeri: 'bazizeri',
		taiyizeri: 'taiyizeri',
		ziweizeri: 'ziweizeri',
		liurengzeri: 'liurengzeri',
		sanshizeri: 'sanshizeri',
		qizhengzeri: 'qizhengzeri',
		indiazeri: 'indiazeri',
		tongshu: 'calendar-tongshu',
		wuzhao: 'wuzhao',
		taixuan: 'taixuan',
		guice: 'guice', xiaoliuren: 'xiaoliuren', xiaochengtu: 'xiaochengtu', feigong: 'feigong',
		jingjue: 'jingjue',
		shenyishu: 'shenyishu',
		geomancy: 'geomancy',
		tarot: 'tarot',
		lingqi: 'lingqi',
		shaozi: 'kinastro-shaozi',
		tieban: 'kinastro-tieban',
		fendjing: 'kinastro-fendjing',
		beiji: 'kinastro-beiji',
		nanji: 'kinastro-nanji',
		chunzi: 'kinastro-chunzi',
		xianqin: 'kinastro-xianqin',
		cetian: 'kinastro-cetian',
		qizhengkin: 'guolao-qizhengkin',
	};
	if(map[key]){
		return map[key];
	}
	return key;
}

// 与 snapshotModuleKeyByContextKey 成对的反查:快照模块名 → AI导出设置键(段勾选的键)。
// 供源上下文(case/chart 的 ctx.module)套「纳入内容」过滤时归一——六爻 module='guazhan' 而设置键='sixyao',
// 不归一则该技法设置在源层永远打不中。命盘源 module='astrochart' 与设置键同名走兜底原样。
export function exportSettingKeyForSnapshotModule(moduleName){
	const name = `${moduleName || ''}`;
	if(name === 'guazhan'){
		return 'sixyao';
	}
	if(name.startsWith('kinastro-')){
		return name.slice('kinastro-'.length);
	}
	if(name === 'guolao-qizhengkin'){
		return 'qizhengkin';
	}
	// 黄历子源模块 → 各自设置键(曾原样返回,与设置键对不上 → 源层段过滤永远打不中)。
	if(name === 'calendar-huangli'){
		return 'huangli';
	}
	if(name === 'calendar-tongshu'){
		return 'tongshu';
	}
	return name;
}

export function isJieQiSplitSettingKey(key){
	return JIEQI_SPLIT_SETTING_KEYS.includes(key);
}

function getJieQiCachedContent(){
	const current = getModuleCachedContent('jieqi_current');
	const whole = getModuleCachedContent('jieqi');
	return [current, whole].filter(Boolean).join('\n\n');
}

// 派发 / 同步刷新的单一来源在 moduleSnapshotRefresh(存案、对话挂载、导出三条路共用);此处沿用原导出名。
export { requestModuleSnapshotRefreshSync };

export async function requestModuleSnapshotRefresh(moduleName){
	if(!moduleName || typeof window === 'undefined'){
		return '';
	}
	const before = `${getModuleCachedContent(moduleName) || ''}`.trim();
	// 按别名表逐个槽请页面重存(与挂载侧 refreshModuleSnapshotSlots 同一张表):此前只刷本名,
	// 读却按整张别名表读 —— 别名槽里的旧盘可能被当成此刻的盘
	getTechniqueAliasList(moduleName).forEach((slot)=>{ if(slot !== moduleName){ try{ dispatchModuleSnapshotRefresh(slot); }catch(e){ /* 页面应答异常 → 按槽里已有的 */ } } });
	const detail = dispatchModuleSnapshotRefresh(moduleName);
	if(!detail){
		return '';
	}
	// 某些模块会在事件回调里触发异步重算后才写快照；轮询一小段时间。
	const stepMs = 120;
	const maxWaitMs = 1800;
	let waited = 0;
	while(waited <= maxWaitMs){
		const direct = typeof detail.snapshotText === 'string'
			? `${detail.snapshotText}`.trim()
			: '';
		if(direct){
			return direct;
		}
		const cached = `${getModuleCachedContent(moduleName) || ''}`.trim();
		if(cached && (cached !== before || waited >= 480)){
			return cached;
		}
		// 等待下一个轮询周期
		// eslint-disable-next-line no-await-in-loop
		await sleep(stepMs);
		waited += stepMs;
	}
	const direct = typeof detail.snapshotText === 'string'
		? `${detail.snapshotText}`.trim()
		: '';
	if(direct){
		return direct;
	}
	const cached = `${getModuleCachedContent(moduleName) || ''}`.trim();
	return cached || before || '';
}

function getCachedContentForTechnique(key){
	if(key === 'astrochart' || isAstroLikeExportKey(key)){
		return getAstroCachedContent();
	}
	if(key === 'indiachart'){
		return getIndiaCachedContent('');
	}
	if(key === 'jieqi' || isJieQiSplitSettingKey(key)){
		return getJieQiCachedContent();
	}
	if(key === 'generic'){
		return '';
	}
	const moduleKey = snapshotModuleKeyByContextKey(key);
	return getModuleCachedContent(moduleKey);
}

// export:挂载设置的段全集与本导出抽屉必须同源 —— 勿另造平行清单。
export function getOptionsForTechniqueKey(key){
	const preset = AI_EXPORT_PRESET_SECTIONS[key] || [];
	const forbidden = getForbiddenSectionSet(key);
	const cachedTitles = extractSectionTitles(getCachedContentForTechnique(key))
		.map((item)=>mapLegacySectionTitle(key, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item)));
	if(isJieQiSplitSettingKey(key)){
		const wanted = new Set(preset.map((item)=>normalizeSectionTitle(item)));
		const filtered = cachedTitles.filter((item)=>wanted.has(normalizeSectionTitle(item)));
		return uniqueArray([...preset, ...filtered]);
	}
	return uniqueArray([...preset, ...cachedTitles].filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item))));
}
