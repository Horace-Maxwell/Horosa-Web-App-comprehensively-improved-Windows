// AI 导出 · 段文本过滤管线:切段、按勾选过滤、旧段名映射、禁段剥离、节气段、行星信息裁剪、空白与字体编码记号清理、美化。
// 由 utils/aiExport.js 门面统一对外导出。
import { isDocxTableSep, isTableBodyLine } from '../mdTableParse';
import {
	JIEQI_SPLIT_SETTING_KEYS, AI_EXPORT_PRESET_SECTIONS, AI_EXPORT_FORBIDDEN_SECTIONS, STANDALONE_TOKEN_MAP,
	ZODIAC_CODE_MAP, ZODIAC_STANDALONE_MAP,
} from './presets';
import {
	uniqueArray, normalizePlanetInfoSetting, isPlanetInfoTechnique, getPlanetInfoSettingByTechnique,
	normalizeSectionTitle, parseSectionTitleLine, isJieQiSplitSettingKey,
} from './settingsModel';
import { loadAIExportSettings, getAIExportDefaultOffSet, getAIExportEffectiveSectionsForTechnique } from './settingsGroups';

export function splitContentSections(content){
	const lines = `${content || ''}`.split('\n');
	const sections = [];
	let currentTitle = '';
	let currentLines = [];

	const pushCurrent = ()=>{
		if(!currentTitle && currentLines.every((line)=>!`${line || ''}`.trim())){
			currentLines = [];
			return;
		}
		sections.push({
			title: currentTitle,
			lines: currentLines.slice(0),
		});
		currentLines = [];
	};

	lines.forEach((line)=>{
		const title = parseSectionTitleLine(line);
		if(title){
			if(currentLines.length){
				pushCurrent();
			}
			currentTitle = title;
			currentLines = [line];
			return;
		}
		currentLines.push(line);
	});
	if(currentLines.length){
		pushCurrent();
	}
	return sections;
}

// 升级前缓存的快照里段名还是旧写法(段名改过字形)→ 过滤时按现名认,不被当陌生段丢掉。
const LEGACY_CONTENT_SECTION_TITLES = { 成員卦象: '成员卦象', '分盘吉位 Vimśopaka': '分盘吉位 Vaiśeṣikāṁśa' };

export function filterContentByWantedSections(content, wanted){
	const sections = splitContentSections(content);
	if(sections.length === 0){
		return content;
	}
	if(!wanted || wanted.size === 0){
		return '';
	}
	const kept = sections.filter((sec)=>{
		if(!sec.title){
			return true;
		}
		const t = normalizeSectionTitle(sec.title);
		return wanted.has(t) || (LEGACY_CONTENT_SECTION_TITLES[t] !== undefined && wanted.has(LEGACY_CONTENT_SECTION_TITLES[t]));
	});
	if(kept.length === 0){
		return '';
	}
	const out = [];
	kept.forEach((sec)=>{
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function mapLegacySectionTitle(key, title){
	const normalized = normalizeSectionTitle(title);
	// v24：返照/小限/太阳弧/流年 旧[星盘信息]段拆为[本命盘配置]+[时段盘配置]，老用户存的 星盘信息 迁到 时段盘配置。
	if(key === 'profection' || key === 'solararc' || key === 'solarreturn' || key === 'lunarreturn' || key === 'givenyear'){
		if(normalized === '星盘信息'){
			return '时段盘配置';
		}
		return normalized;
	}
	if(key === 'indiachart'){
		// 「分盘吉位」实为 Vaiśeṣikāṁśa 吉位计数(不是 Viṃśopaka 20 分力,后者另有一段)→ 段名改正;老用户存的旧名迁到现名。
		if(normalized === '分盘吉位 Vimśopaka'){
			return '分盘吉位 Vaiśeṣikāṁśa';
		}
		return normalized;
	}
	if(key === 'jaynesprog'){
		// v31:首段名「赤纬推运（Jayne Declination）」对齐 builder 实产「赤纬推运（Declination）」(去 Jayne 死段);老用户存的旧段名迁移,避免被当陌生段过滤掉。
		if(normalized === '赤纬推运（Jayne Declination）'){
			return '赤纬推运（Declination）';
		}
		return normalized;
	}
	if(key === 'primarydirect'){
		// [MT parity] 旧 preset 死名(builder 从未产出「主/界限法」形态)→ 迁到真段名,
		// 老用户自定义里勾过死名的意图=选主限法设置/表格,迁移后不再被当陌生段丢内容。
		if(normalized === '主/界限法设置'){
			return '主限法设置';
		}
		if(normalized === '主/界限法表格'){
			return '主限法表格';
		}
		return normalized;
	}
	if(key === 'tongshefa'){
		if(normalized === '互潜'){
			return '潜藏';
		}
		if(normalized === '错亲'){
			return '亲和';
		}
		if(normalized === '统摄法起盘'){
			return '本卦';
		}
		return normalized;
	}
	if(key === 'qimen'){
		if(normalized === '八宫'){
			return '八宫详解';
		}
		if(normalized === '演卦'){
			return '奇门演卦';
		}
		if(normalized === '九宫'){
			return '九宫方盘';
		}
		if(normalized === '右侧栏目' || normalized === '概览'){
			return '盘面要素';
		}
		// 旧版 preset 误写「九宫与宫内星体」(奇门实际产出[旺相休囚死·月令能量])→ 老用户自定义里若残留,归一到真实段。
		if(normalized === '九宫与宫内星体'){
			return '旺相休囚死·月令能量';
		}
	}
	if(key === 'liureng'){
		if(normalized.startsWith('三传(')){
			return '三传';
		}
	}
	if(key === 'mundane'){
		// 地区盘/入宫地理分野段头随数据集动态(如「地理分野·世俗黄道分野」)→ 归一到静态[地理分野]
		// (内容侧已静态化为[地理分野];此分支额外兜住老用户自定义里残留的带数据集后缀的旧段名)。
		if(normalized.startsWith('地理分野')){
			return '地理分野';
		}
	}
	if(key === 'sanshiunited'){
		if(normalized === '状态'){
			return '概览';
		}
		if(normalized === '八宫'){
			return '八宫详解';
		}
		if(normalized === '大格'){
			return '六壬大格';
		}
		if(normalized === '小局'){
			return '六壬小局';
		}
		if(normalized === '参考'){
			return '六壬参考';
		}
		if(normalized === '六壬格局概览'){
			return '六壬概览';
		}
	}
	if(key === 'sixyao'){
		if(normalized === '起卦方式'){
			return '卦象';
		}
		if(normalized === '卦辞'){
			return '卦辞与断语';
		}
	}
	if(key === 'wuzhao'){
		if(normalized === '五兆'){
			return '揲筮';
		}
		if(normalized === '标记'){
			return '特殊标记';
		}
	}
	if(key === 'taixuan'){
		if(normalized === '全文' || normalized === '条文'){
			return '表';
		}
	}
	if(key === 'jingjue'){
		if(normalized === '起盘'){
			return '起课';
		}
	}
	if(key === 'shenyishu'){
		if(normalized === '干支' || normalized === '五行'){
			return '干支与五行';
		}
		if(normalized === '五行法则'){
			return '五行法则';
		}
	}
	if(key === 'qizhengkin'){
		if(normalized === '命宫'){
			return '命宫解读';
		}
		if(normalized === '宿度'){
			return '星曜';
		}
	}
	if(key === 'tieban'){
		if(normalized === '宫位'){
			return '十二宫';
		}
	}
	if(key === 'cetian'){
		const palaceMap = {
			命宫: '命宮',
			兄弟宫: '兄弟宮',
			夫妻宫: '夫妻宮',
			子女宫: '子女宮',
			财帛宫: '財帛宮',
			疾厄宫: '疾厄宮',
			迁移宫: '遷移宮',
			交友宫: '交友宮',
			官禄宫: '官祿宮',
			田宅宫: '田宅宮',
			福德宫: '福德宮',
			父母宫: '父母宮',
			十八飞星: '星曜属性',
		};
		if(palaceMap[normalized]){
			return palaceMap[normalized];
		}
	}
	if(key === 'fengshui' && normalized === '成員卦象'){
		// 段名繁体改简体(界面 / 快照一并);老用户自定义里勾过旧名的迁到新名,不被当陌生段丢掉。
		return '成员卦象';
	}
	return normalized;
}

export function getForbiddenSectionSet(key){
	const list = AI_EXPORT_FORBIDDEN_SECTIONS[key];
	if(!list || !list.length){
		return null;
	}
	return new Set(list.map((item)=>normalizeSectionTitle(item)).filter(Boolean));
}

export function stripForbiddenSections(content, key){
	const forbidden = getForbiddenSectionSet(key);
	if(!forbidden || !content){
		return content;
	}
	const sections = splitContentSections(content);
	if(!sections.length){
		return content;
	}
	const kept = sections.filter((sec)=>{
		if(!sec.title){
			return true;
		}
		const title = normalizeSectionTitle(sec.title);
		return !forbidden.has(title);
	});
	if(!kept.length){
		return '';
	}
	const out = [];
	kept.forEach((sec)=>{
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// 用户是否把该技法的段**显式全部取消**(空数组;区别于「未自定义」的 undefined)。
// 🔴 判据必须与 buildPayload 的兜底分开:兜底本意是「过滤链异常时别误报无文本」,
// 但空数组是用户的明确意图 —— 曾被兜底整份复活成原文,与挂载侧(返回空+sectionsCleared)
// 语义相反,直接违「取消=真取消」铁律。
export function isUserSectionsExplicitlyCleared(key, settings){
	const st = settings || loadAIExportSettings();
	if(!st || !st.sections){ return false; }
	if(key === 'jieqi' || isJieQiSplitSettingKey(key)){
		const wanted = getJieQiWantedSections(st, key);
		return !!(wanted && wanted.size === 0);
	}
	const selected = st.sections[key];
	return Array.isArray(selected) && selected.length === 0;
}

export function applyUserSectionFilter(content, key){
	const settings = loadAIExportSettings();
	const selected = settings.sections[key];
	if(!Array.isArray(selected)){
		// [YC] 默认关段豁免(导出主链):未自定义 → preset−默认关 过滤。与挂载封装
		// applyAIExportSectionFilterToSnapshot 的豁免分支同一语义——live 实抓曾咬出只改了
		// 挂载封装、漏了本主链(六爻判语库段默认漏进导出),两处必须同步,勿再漂移。
		const offSet = getAIExportDefaultOffSet(key);
		if(offSet){
			const defaults = getAIExportEffectiveSectionsForTechnique(key, settings);
			const wantedDefaults = new Set(uniqueArray(defaults || []));
			if(wantedDefaults.size){
				const trimmed = filterContentByWantedSections(stripForbiddenSections(content, key), wantedDefaults);
				if(`${trimmed || ''}`.trim()){
					return trimmed;
				}
			}
		}
		return stripForbiddenSections(content, key);
	}
	// 空数组=用户显式全清(旧尸块已在 normalize 迁移删键) → 该技法全不纳入,输出空。
	// 旧「五技法运行时强推段」已改为 normalize 的一次性 union 迁移(AI_EXPORT_FORCED_INCLUDE_SECTIONS),
	// 此处不再 push 任何段 —— 用户在设置里取消的段,导出与挂载一律真取消(所见即所得)。
	if(!selected.length){
		return '';
	}
	const picked = selected.slice(0);
	const forbidden = getForbiddenSectionSet(key);
	const normalizedPicked = picked
		.map((item)=>mapLegacySectionTitle(key, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item)));
	const wanted = new Set(uniqueArray(normalizedPicked));
	if(wanted.size === 0){
		return stripForbiddenSections(content, key);
	}
	const filtered = filterContentByWantedSections(content, wanted);
	if(!`${filtered || ''}`.trim()){
		// 用户设置与实际分段不一致时回退原文，避免导出空白。
		return stripForbiddenSections(content, key);
	}
	return stripForbiddenSections(filtered, key);
}

export function getJieQiWantedSections(settings, activeKey = 'jieqi'){
	const sections = settings && settings.sections && typeof settings.sections === 'object'
		? settings.sections
		: {};
	if(isJieQiSplitSettingKey(activeKey)){
		const defaults = AI_EXPORT_PRESET_SECTIONS[activeKey] || [];
		const picked = Object.prototype.hasOwnProperty.call(sections, activeKey)
			? (Array.isArray(sections[activeKey]) ? sections[activeKey] : [])
			: defaults;
		return new Set(picked.map((item)=>normalizeSectionTitle(item)).filter(Boolean));
	}
	const hasSplitConfig = JIEQI_SPLIT_SETTING_KEYS.some((key)=>Object.prototype.hasOwnProperty.call(sections, key));
	if(!hasSplitConfig){
		if(!Object.prototype.hasOwnProperty.call(sections, 'jieqi')){
			return null;
		}
		const legacy = Array.isArray(sections.jieqi) ? sections.jieqi : [];
		return new Set(legacy.map((item)=>normalizeSectionTitle(item)));
	}
	const wanted = new Set();
	JIEQI_SPLIT_SETTING_KEYS.forEach((key)=>{
		const defaults = AI_EXPORT_PRESET_SECTIONS[key] || [];
		const picked = Object.prototype.hasOwnProperty.call(sections, key)
			? (Array.isArray(sections[key]) ? sections[key] : [])
			: defaults;
		picked.forEach((item)=>{
			const normalized = normalizeSectionTitle(item);
			if(normalized){
				wanted.add(normalized);
			}
		});
	});
	return wanted;
}

export function applyUserSectionFilterByContext(content, key){
	if(key !== 'jieqi' && !isJieQiSplitSettingKey(key)){
		return applyUserSectionFilter(content, key);
	}
	const settings = loadAIExportSettings();
	const wanted = getJieQiWantedSections(settings, key);
	if(wanted === null){
		return content;
	}
	if(wanted.size === 0){
		return '';   // 显式全清 → 真取消(勿回吐全文,与主链 applyUserSectionFilter 同语义)
	}
	const filtered = filterContentByWantedSections(content, wanted);
	// 勾了段、但本内容(如星盘页签下只有当前一盘)一段都不含 → 真取消('')。此前回吐全文,
	// 把用户显式的「只要春分宿盘」盖成整份 → 「取消=真取消」在节气盘分键上是破的。
	return `${filtered || ''}`.trim() ? filtered : '';
}

function trimPlanetInfoBySetting(content, setting){
	const source = `${content || ''}`;
	const mode = normalizePlanetInfoSetting(setting);
	const showHouse = mode.showHouse === 1;
	const showRuler = mode.showRuler === 1;
	if(showHouse && showRuler){
		return source;
	}
	// 判「括号内容=行星后天信息」改为逐段全匹配:每段须是 后天:… / Nth / - / NR… / 主…宫 / 宫位未知 / (第)X宫 之一。
	// 此前任一段含「数字宫」「主…宫」即整括号判为行星宫位 → 三式合一奇门「日马：申（坤二宫）」「庚击刑（震三宫）」等宫位注记被误删。
	const isPlanetInfoInner = (inner)=>{
		const txt = `${inner || ''}`.trim();
		if(!txt){
			return false;
		}
		if(/^后天[:：]/.test(txt)){
			return true;
		}
		const segs = txt.split(/[；;]/).map((item)=>`${item || ''}`.trim()).filter(Boolean);
		if(!segs.length){
			return false;
		}
		return segs.every((seg)=>(
			/^\d{1,2}th$/i.test(seg)
			|| seg === '-'
			|| /^\d{1,2}R(?:\d{1,2}R)*$/i.test(seg)
			|| /^主.+宫$/.test(seg)
			|| /^(宫位未知|主宫未知)$/.test(seg)
			|| /^第?[一二三四五六七八九十]+宫$/.test(seg)
		));
	};
	const splitPlanetInfoParts = (inner)=>{
		const txt = `${inner || ''}`.replace(/^后天[:：]\s*/, '').trim();
		const segs = txt.split(/[；;]/).map((item)=>`${item || ''}`.trim()).filter(Boolean);
		let housePart = '';
		let rulerPart = '';
		segs.forEach((seg)=>{
			if(!housePart && /^(\d{1,2}th|-)$/i.test(seg)){
				housePart = seg;
				return;
			}
			if(!rulerPart && /^\d{1,2}R(?:\d{1,2}R)*$/i.test(seg)){
				rulerPart = seg.toUpperCase();
				return;
			}
			if(!rulerPart && (/^主/.test(seg) || /\b\d{1,2}R(?:\d{1,2}R)*\b/i.test(seg))){
				rulerPart = seg;
				return;
			}
			if(!housePart && /宫/.test(seg)){
				housePart = seg;
				return;
			}
			if(!housePart){
				housePart = seg;
				return;
			}
			if(!rulerPart){
				rulerPart = seg;
			}
		});
		if(!housePart){
			const houseMatch = txt.match(/\b(\d{1,2}th|-)\b/i);
			if(houseMatch && houseMatch[1]){
				housePart = houseMatch[1];
			}
		}
		if(!rulerPart){
			const rulerMatch = txt.match(/\b(\d{1,2}R(?:\d{1,2}R)*)\b/i);
			if(rulerMatch && rulerMatch[1]){
				rulerPart = rulerMatch[1].toUpperCase();
			}
		}
		return {
			housePart: `${housePart || ''}`.trim(),
			rulerPart: `${rulerPart || ''}`.trim(),
		};
	};
	const replaceBracket = (whole, left, inner, right)=>{
		if(!isPlanetInfoInner(inner)){
			return whole;
		}
		const one = splitPlanetInfoParts(inner);
		const pieces = [];
		if(showHouse && one.housePart){
			pieces.push(one.housePart);
		}
		if(showRuler && one.rulerPart){
			pieces.push(one.rulerPart);
		}
		if(!pieces.length){
			return '';
		}
		return `${left}${pieces.join('; ')}${right}`;
	};
	let out = source.replace(/([（(])([^（）()]*)([）)])/g, replaceBracket);
	return out
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/([（(])\s*([）)])/g, '')
		.replace(/\n{3,}/g, '\n\n');
}

// export:挂载链(技法层+源层)也消费「星曜后天信息」开关——此前仅导出主链吃它,
// 挂载抽屉却暴露同款勾选(显示星曜宫位/主宰宫),关了对发给 AI 的快照零效果=静默失效。
// 非 planetInfo 技法/默认全开 → 原样返回(零回归)。
export function applyPlanetInfoFilterByContext(content, key){
	if(!isPlanetInfoTechnique(key)){
		return content;
	}
	const settings = loadAIExportSettings();
	const planetInfo = getPlanetInfoSettingByTechnique(settings, key);
	return trimPlanetInfoBySetting(content, planetInfo);
}

export function normalizeWhitespace(text){
	return (text || '')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line)=>line.replace(/[\t ]+/g, ' ').replace(/[ ]+$/g, '').trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function replaceStandaloneToken(text, token, replacement){
	const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(^|[\\s,，;；:：()\\[\\]{}\\/\\\\|])${esc}(?=$|[\\s,，;；:：()\\[\\]{}\\/\\\\|])`, 'g');
	return text.replace(pattern, `$1${replacement}`);
}

export function likelyHasFontEncodedTokens(text){
	const src = `${text || ''}`;
	if(!src){
		return false;
	}
	if(/[☉☽☿♀♂♃♄♅♆♇⚷☊☋⊗♈♉♊♋♌♍♎♏♐♑♒♓☌⚹✶□△☍]/.test(src)){
		return true;
	}
	if(/(^|[\s,，;；:：()\[\]{}\\/|])([A-Za-z${}])(?=$|[\s,，;；:：()\[\]{}\\/|])/m.test(src)){
		return true;
	}
	if(/[a-l](?=\d{1,2}分)/.test(src)){
		return true;
	}
	return false;
}

export function replaceFontEncodedTokens(text){
	let out = text || '';

	// 27˚k52分 / 27°k52分 -> 27˚水瓶52分
	out = out.replace(/(^|[^A-Za-z0-9\u4E00-\u9FFF])(\d{1,2})\s*[˚°º]\s*([a-l])\s*([0-5]?\d)\s*分/gi, (m, p1, deg, code, min)=>{
		const zodiac = ZODIAC_CODE_MAP[code.toLowerCase()] || code;
		return `${p1}${deg}˚${zodiac}${min}分`;
	});
	// 16k16分 -> 16˚水瓶16分
	out = out.replace(/(^|[^A-Za-z0-9\u4E00-\u9FFF])(\d{1,2})\s*([a-l])\s*([0-5]?\d)\s*分/gi, (m, p1, deg, code, min)=>{
		const zodiac = ZODIAC_CODE_MAP[code.toLowerCase()] || code;
		return `${p1}${deg}˚${zodiac}${min}分`;
	});

	// A（日）/ 8（人龙星）/ {（信心点） 这类前缀编码，保留括号中的中文名。
	out = out.replace(/(^|[\s\-•*])([A-Za-z0-9${}])\s*[（(]\s*([^）)]+)\s*[）)]/gm, (m, p1, token, label)=>{
		const name = (label || '').trim();
		if(!name){
			const mapped = STANDALONE_TOKEN_MAP[token];
			return `${p1}${mapped || ''}`;
		}
		return `${p1}${name}`;
	});

	Object.keys(STANDALONE_TOKEN_MAP).forEach((token)=>{
		out = replaceStandaloneToken(out, token, STANDALONE_TOKEN_MAP[token]);
	});

	// 星座单字母残留（如: a , 土 , 海王）转中文星座名。
	Object.keys(ZODIAC_STANDALONE_MAP).forEach((token)=>{
		out = replaceStandaloneToken(out, token, ZODIAC_STANDALONE_MAP[token]);
	});

	// 去掉孤立的编码符号残留。
	out = out.replace(/(^|[\s,，;；:：\-•*])([{]+)(?=$|[\s,，;；:：\-•*])/g, '$1');

	return out;
}

function canonicalLine(text){
	return (text || '')
		.replace(/\s+/g, '')
		.replace(/[，,。；;:：、·'"`~!！?？\[\]\(\)（）{}<>《》【】]/g, '')
		.trim();
}

function isNoiseLine(text){
	const val = (text || '').trim();
	if(!val){
		return true;
	}
	if(val === '[图形标注文本]'){
		return true;
	}
	if(val === '打印星盘'){
		return true;
	}
	// 🔴 曾含 A-Za-z:占星四轴 AC/MC/IC/DC、逆行标 Rx 等独占一行时被当编码残留误杀;
	// 只保留真正的编码残留字符集。
	if(/^[${}|\\/]{1,2}$/.test(val)){
		return true;
	}
	if(/^\[符号U\+[0-9A-F]+\]$/.test(val)){
		return true;
	}
	return false;
}

export function beautifyForAI(text){
	const srcLines = (text || '').split('\n');
	const out = [];
	let sectionSeen = new Set();

	const pushLine = (line)=>{
		const val = line.trim();
		if(!val || isNoiseLine(val)){
			return;
		}
		if(/^\[.+\]$/.test(val)){
			if(out.length && out[out.length - 1] !== ''){
				out.push('');
			}
			out.push(val);
			out.push('');
			sectionSeen = new Set();
			return;
		}
		const clean = val.replace(/^[-*]\s*/, '').trim();
		if(!clean || isNoiseLine(clean)){
			return;
		}
		const key = canonicalLine(clean);
		if(!key || sectionSeen.has(key)){
			return;
		}
		sectionSeen.add(key);
		out.push(`- ${clean}`);
		out.push('');
	};

	for(let li = 0; li < srcLines.length; li++){
		const line = srcLines[li];
		if(!line){
			continue;
		}
		// GFM 表块直通:builder(如紫微宫位总览)开始产表后,v1 经典回退阀也不得逐行
		// bulletize 撕表(| 行加 `- ` + 插空行 = 表结构全毁)。既有内容从无 |---| 分隔行 → 本分支对
		// 历史文本零字节影响;表行合法"重复",不进 canonicalLine 去重。
		if(isTableBodyLine(line) && isDocxTableSep(srcLines[li + 1])){
			if(out.length && out[out.length - 1] !== ''){ out.push(''); }
			let tj = li;
			while(tj < srcLines.length && isTableBodyLine(srcLines[tj])){
				out.push(`${srcLines[tj]}`.trim());
				tj++;
			}
			out.push('');
			li = tj - 1;
			continue;
		}
		// 长句按常见断句符拆分，提高可读性
		const broken = line.length > 100 ? line.replace(/([。；;！？!?])/g, '$1\n') : line;
		broken.split('\n').forEach((seg)=>pushLine(seg));
	}

	while(out.length && !out[out.length - 1]){
		out.pop();
	}

	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// 温和归一器:保留 v1 的 去噪/段头整形/段内去重/空行压缩,去掉 逐行 `- ` 项目符+逐行插空行+长句强拆
// (v1 这三样使导出文本约 2 倍膨胀,纯耗 token;人读排版交给 docx/PDF 派生视图)。
// GFM 表块整块直通(表头行+分隔行前瞻):表行合法"重复",严禁进去重/改写。v1 路径原样保留(经典格式回退阀)。
export function beautifyForAIGentle(text){
	const srcLines = (text || '').split('\n');
	const out = [];
	let sectionSeen = new Set();
	for(let i = 0; i < srcLines.length; i++){
		const raw = srcLines[i] == null ? '' : `${srcLines[i]}`;
		const val = raw.trim();
		if(!val){
			if(out.length && out[out.length - 1] !== ''){ out.push(''); }
			continue;
		}
		if(isTableBodyLine(raw) && isDocxTableSep(srcLines[i + 1])){
			let j = i;
			while(j < srcLines.length && isTableBodyLine(srcLines[j])){
				out.push(`${srcLines[j]}`.trim());
				j++;
			}
			i = j - 1;
			continue;
		}
		if(isNoiseLine(val)){ continue; }
		if(/^\[.+\]$/.test(val)){
			if(out.length && out[out.length - 1] !== ''){ out.push(''); }
			out.push(val);
			sectionSeen = new Set();
			continue;
		}
		const key = canonicalLine(val);
		if(key && sectionSeen.has(key)){ continue; }
		if(key){ sectionSeen.add(key); }
		out.push(val);
	}
	while(out.length && !out[out.length - 1]){ out.pop(); }
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
