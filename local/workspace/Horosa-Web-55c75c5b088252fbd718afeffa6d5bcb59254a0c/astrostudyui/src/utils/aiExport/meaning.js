// AI 导出 · 文本规范化与释义附加:符号替换、星义别名与相位释义、奇门 / 六壬提示、三式释义、按上下文附加。
// 由 utils/aiExport.js 门面统一对外导出。
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { buildMeaningTipByCategory, buildAspectMeaningTip } from '../../components/astro/AstroMeaningData';
import { buildQimenXiangTipObj } from '../../components/dunjia/QimenXiangDoc';
import { buildLiuRengShenTipObj, buildLiuRengHouseTipObj } from '../../components/liureng/LRShenJiangDoc';
import { SYMBOL_MAP, COMMON_REPLACERS, DOMAIN_REPLACERS } from './presets';
import { uniqueArray, safe, isAstroMeaningTechnique, isHoverMeaningTechnique, getAstroMeaningSettingByTechnique } from './settingsModel';
import {
	splitContentSections, normalizeWhitespace, likelyHasFontEncodedTokens, replaceFontEncodedTokens, beautifyForAI,
	beautifyForAIGentle,
} from './sectionFilter';
import { loadAIExportSettings } from './settingsGroups';

function applyReplacers(text, replacers){
	let out = text;
	replacers.forEach((item)=>{
		out = out.replace(item.regex, item.value);
	});
	return out;
}

function replaceKnownSymbols(text, domain){
	let output = text || '';
	if(likelyHasFontEncodedTokens(output)){
		output = replaceFontEncodedTokens(output);
	}
	Object.keys(SYMBOL_MAP).forEach((key)=>{
		output = output.split(key).join(` ${SYMBOL_MAP[key]} `);
	});

	output = applyReplacers(output, COMMON_REPLACERS);
	if(domain && DOMAIN_REPLACERS[domain]){
		output = applyReplacers(output, DOMAIN_REPLACERS[domain]);
	}

	output = output.replace(/[\u4DC0-\u4DFF]/g, (ch)=>{
		const idx = ch.charCodeAt(0) - 0x4DC0 + 1;
		return ` 六十四卦#${idx} `;
	});

	// 私有区字符多为字体残留，不输出乱码标记，直接清理。
	output = output.replace(/[\uE000-\uF8FF]/g, ' ');

	output = output
		.replace(/[°º]/g, '˚')
		.replace(/[−﹣]/g, '-')
		.replace(/([0-9]+)\s*[′']/g, '$1分')
		.replace(/([0-9]+)\s*[″"]/g, '$1秒')
		.replace(/℞/g, '逆行')
		.replace(/\uFFFD/g, '[异常字符]')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.replace(/\u200B/g, '')
		.replace(/\u00A0/g, ' ')
		.replace(/[ ]{2,}/g, ' ');
	if(domain !== 'sanshiunited'){
		output = output
			.replace(/([+-]?\d+(?:\.\d+)?)\s*度\s*R\b/g, '$1度 逆行')
			.replace(/(\d{1,2}\s*˚\s*(?:[^\s，,；;]{0,6})\s*\d{1,2}\s*分)\s*R\b/g, '$1 逆行');
	}

	return output;
}

export function normalizeText(text, domain, format){
	let output = replaceKnownSymbols(text, domain);
	output = output.replace(/\r\n/g, '\n');
	output = output
		.split('\n')
			.map((line)=>line.replace(/[ \t]+$/g, ''))
			.join('\n');
	output = output.replace(/\n{3,}/g, '\n\n');
	if(domain === 'predictive_raw'
		|| domain === 'tongshefa'
		|| domain === 'liureng'
		|| domain === 'qimen'
		|| domain === 'sanshiunited'
		|| domain === 'kentang_raw'){
		return output.trim();
	}
	if(output.length > 120000){
		return normalizeWhitespace(output);
	}
	// 温和归一(无 bulletize/表直通);v1 = 经典 beautify(回退阀,字节不变)。
	output = format === 'v2' ? beautifyForAIGentle(output) : beautifyForAI(output);
	return output.trim();
}

const ASTRO_MEANING_PLANET_IDS = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER,
	AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO, AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE,
];
const ASTRO_MEANING_LOT_IDS = [
	AstroConst.PARS_FORTUNA, AstroConst.PARS_SPIRIT, AstroConst.PARS_VENUS, AstroConst.PARS_MERCURY, AstroConst.PARS_MARS,
	AstroConst.PARS_JUPITER, AstroConst.PARS_SATURN, AstroConst.PARS_FATHER, AstroConst.PARS_MOTHER, AstroConst.PARS_BROTHERS,
	AstroConst.PARS_WEDDING_MALE, AstroConst.PARS_WEDDING_FEMALE, AstroConst.PARS_SONS, AstroConst.PARS_DISEASES,
	AstroConst.PARS_LIFE, AstroConst.PARS_RADIX,
];

export function escapeRegExp(text){
	return `${text || ''}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function astroMeaningDisplayName(id){
	return AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || `${id || ''}`;
}

function buildAliasMap(entries){
	const aliasMap = new Map();
	entries.forEach((entry)=>{
		const id = entry.id;
		(entry.aliases || []).forEach((alias)=>{
			const a = `${alias || ''}`.trim();
			if(!a){
				return;
			}
			if(!aliasMap.has(a)){
				aliasMap.set(a, []);
			}
			const arr = aliasMap.get(a);
			if(!arr.includes(id)){
				arr.push(id);
			}
		});
	});
	return aliasMap;
}

const EXTRA_LOT_ALIASES = {
	[AstroConst.PARS_FORTUNA]: ['福点', '幸运点', 'Part of Fortune', 'Lot of Fortune'],
	[AstroConst.PARS_SPIRIT]: ['精神点', 'Lot of Spirit'],
	[AstroConst.PARS_VENUS]: ['爱情点', 'Lot of Eros'],
	[AstroConst.PARS_MERCURY]: ['必要点', 'Lot of Necessity'],
	[AstroConst.PARS_MARS]: ['勇气点', 'Lot of Courage'],
	[AstroConst.PARS_JUPITER]: ['胜利点', 'Lot of Victory'],
	[AstroConst.PARS_SATURN]: ['复仇点', 'Lot of Nemesis'],
	[AstroConst.PARS_FATHER]: ['父亲点', 'Lot of The Father'],
	[AstroConst.PARS_MOTHER]: ['母亲点', 'Lot of The Mother'],
	[AstroConst.PARS_BROTHERS]: ['手足点', 'Lot of Siblings'],
	[AstroConst.PARS_WEDDING_MALE]: ['婚姻点', 'Lot of Marriage'],
	[AstroConst.PARS_WEDDING_FEMALE]: ['婚姻点', 'Lot of Marriage'],
	[AstroConst.PARS_SONS]: ['孩童点', 'Lot of Children'],
	[AstroConst.PARS_DISEASES]: ['疾病点', 'Lot of Illness'],
	[AstroConst.PARS_LIFE]: ['旺点', 'Lot of Exaltation'],
	[AstroConst.PARS_RADIX]: ['基础点', 'Lot of Foundation'],
};

const PLANET_ALIAS_MAP = buildAliasMap(ASTRO_MEANING_PLANET_IDS.map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

const LOT_ALIAS_MAP = buildAliasMap(ASTRO_MEANING_LOT_IDS.map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		...(EXTRA_LOT_ALIASES[id] || []),
		`${id}`,
	]),
})));

const SIGN_ALIAS_MAP = buildAliasMap((AstroConst.LIST_SIGNS || []).map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

const HOUSE_ALIAS_MAP = buildAliasMap((AstroConst.LIST_HOUSES || []).map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsg[id],
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

function lineContainsAlias(line, alias, options = {}){
	const txt = `${line || ''}`;
	if(!txt || !alias){
		return false;
	}
	if(alias.length === 1){
		const escaped = escapeRegExp(alias);
		const pattern = new RegExp(`(^|[\\s,，;；:：()（）\\[\\]{}\\/\\\\|\\-])(${escaped})(?=$|[\\s,，;；:：()（）\\[\\]{}\\/\\\\|\\-])`, 'g');
		const weakPlanetAlias = options.category === 'planet'
			&& ['日', '月', '水', '金', '火', '木', '土'].includes(alias);
		let matched = pattern.exec(txt);
		while(matched){
			const prefix = matched[1] || '';
			const start = (matched.index || 0) + prefix.length;
			const tail = txt.slice(start + alias.length).replace(/^\s+/, '');
			// 避免把“五行界”的“木/火/土/金/水”误判为行星简称。
			if(weakPlanetAlias && /^界/.test(tail)){
				matched = pattern.exec(txt);
				continue;
			}
			return true;
		}
		return false;
	}
	return txt.includes(alias);
}

function detectIdsByAliasMap(lines, aliasMap, options = {}){
	const out = new Set();
	const src = Array.isArray(lines) ? lines : [];
	if(!src.length){
		return out;
	}
	aliasMap.forEach((ids, alias)=>{
		for(let i=0; i<src.length; i++){
			if(lineContainsAlias(src[i], alias, options)){
				ids.forEach((id)=>out.add(id));
				break;
			}
		}
	});
	return out;
}

function detectAspectDegreesFromLines(lines){
	const found = new Set();
	(lines || []).forEach((line)=>{
		const txt = `${line || ''}`;
		if(!txt){
			return;
		}
		const regex = /(^|[^\d])(0|30|45|60|90|120|135|150|180)\s*˚/g;
		let matched = regex.exec(txt);
		while(matched){
			const deg = parseInt(matched[2], 10);
			if(!Number.isNaN(deg)){
				found.add(deg);
			}
			matched = regex.exec(txt);
		}
	});
	return found;
}

function buildMeaningLinesForIds(category, ids, title){
	const lines = [];
	const arr = Array.from(ids || []);
	if(!arr.length){
		return lines;
	}
	lines.push(`【${title}】`);
	arr.forEach((id)=>{
		const tip = buildMeaningTipByCategory(category, id);
		if(!tip){
			return;
		}
		lines.push(`### ${astroMeaningDisplayName(id)}`);
		if(tip.title){
			lines.push(`${tip.title}`);
		}
		(tip.tips || []).forEach((one)=>{
			lines.push(`${one}`);
		});
		lines.push('');
	});
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function buildMeaningLinesForAspects(degrees){
	const lines = [];
	const arr = Array.from(degrees || []).sort((a, b)=>a - b);
	if(!arr.length){
		return lines;
	}
	lines.push('【相位释义】');
	arr.forEach((deg)=>{
		const tip = buildAspectMeaningTip(deg, null, null);
		if(!tip){
			return;
		}
		lines.push(`### ${deg}˚`);
		if(tip.title){
			lines.push(`${tip.title}`);
		}
		(tip.tips || []).forEach((one)=>{
			lines.push(`${one}`);
		});
		lines.push('');
	});
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function joinSectionBlocks(sections){
	if(!Array.isArray(sections) || sections.length === 0){
		return '';
	}
	const out = [];
	sections.forEach((sec)=>{
		if(!sec || !Array.isArray(sec.lines) || !sec.lines.length){
			return;
		}
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function getSectionMeaningMode(title){
	const t = `${title || ''}`;
	if(!t || t.includes('释义')){
		return {
			skip: true,
			explicit: false,
			forceAllPlanets: false,
			forceAllLots: false,
		};
	}
	const explicit = t.includes('行星')
		|| t.includes('希腊点')
		|| t.includes('相位')
		|| t.includes('宫位')
		|| t.includes('星与虚点')
		|| t === '信息'
		|| t === '星盘信息'
		|| t === '可能性'
		|| t.includes('推运');
	return {
		skip: false,
		explicit,
		forceAllPlanets: t.includes('行星'),
		forceAllLots: t.includes('希腊点'),
	};
}

function appendAstroMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || sections.length === 0){
		return content;
	}

	const outSections = [];
	const seen = {
		planets: new Set(),
		lots: new Set(),
		signs: new Set(),
		houses: new Set(),
		aspects: new Set(),
	};
	sections.forEach((sec)=>{
		outSections.push(sec);
		const mode = getSectionMeaningMode(sec && sec.title);
		if(mode.skip){
			return;
		}
		const lines = (sec.lines || []).slice(1);
		let planets = detectIdsByAliasMap(lines, PLANET_ALIAS_MAP, { category: 'planet' });
		let lots = detectIdsByAliasMap(lines, LOT_ALIAS_MAP, { category: 'lot' });
		const signs = detectIdsByAliasMap(lines, SIGN_ALIAS_MAP, { category: 'sign' });
		const houses = detectIdsByAliasMap(lines, HOUSE_ALIAS_MAP, { category: 'house' });
		const aspects = detectAspectDegreesFromLines(lines);

		if(mode.forceAllPlanets && planets.size === 0){
			planets = new Set(ASTRO_MEANING_PLANET_IDS);
		}
		if(mode.forceAllLots && lots.size === 0){
			lots = new Set(ASTRO_MEANING_LOT_IDS);
		}
		const hasDetected = planets.size > 0
			|| lots.size > 0
			|| signs.size > 0
			|| houses.size > 0
			|| aspects.size > 0;
		if(!mode.explicit && !hasDetected){
			return;
		}

		const uniquePlanets = new Set(Array.from(planets).filter((id)=>!seen.planets.has(id)));
		const uniqueLots = new Set(Array.from(lots).filter((id)=>!seen.lots.has(id)));
		const uniqueSigns = new Set(Array.from(signs).filter((id)=>!seen.signs.has(id)));
		const uniqueHouses = new Set(Array.from(houses).filter((id)=>!seen.houses.has(id)));
		const uniqueAspects = new Set(Array.from(aspects).filter((deg)=>!seen.aspects.has(deg)));

		const meaningLines = []
			.concat(buildMeaningLinesForIds('planet', uniquePlanets, '星释义'))
			.concat(buildMeaningLinesForIds('lot', uniqueLots, '希腊点释义'))
			.concat(buildMeaningLinesForIds('sign', uniqueSigns, '星座释义'))
			.concat(buildMeaningLinesForIds('house', uniqueHouses, '宫位释义'))
			.concat(buildMeaningLinesForAspects(uniqueAspects));

		if(!meaningLines.length){
			return;
		}
		uniquePlanets.forEach((id)=>seen.planets.add(id));
		uniqueLots.forEach((id)=>seen.lots.add(id));
		uniqueSigns.forEach((id)=>seen.signs.add(id));
		uniqueHouses.forEach((id)=>seen.houses.add(id));
		uniqueAspects.forEach((deg)=>seen.aspects.add(deg));
		outSections.push({
			title: `${sec.title}释义`,
			lines: [
				`[${sec.title}释义]`,
				...meaningLines,
			],
		});
	});

	const appended = joinSectionBlocks(outSections);
	return appended || content;
}

const LIURENG_BRANCH_ORDER = '子丑寅卯辰巳午未申酉戌亥'.split('');
const QIMEN_STEM_ORDER = '甲乙丙丁戊己庚辛壬癸'.split('');
const QIMEN_DOOR_ORDER = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
const QIMEN_STAR_ORDER = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天禽', '天柱', '天心'];
const QIMEN_GOD_ORDER = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];

const QIMEN_DOOR_MAP = {
	休: '休门',
	生: '生门',
	伤: '伤门',
	杜: '杜门',
	景: '景门',
	死: '死门',
	惊: '惊门',
	開: '开门',
	开: '开门',
	休门: '休门',
	生门: '生门',
	伤门: '伤门',
	杜门: '杜门',
	景门: '景门',
	死门: '死门',
	惊门: '惊门',
	开门: '开门',
};
const QIMEN_STAR_MAP = {
	蓬: '天蓬',
	任: '天任',
	冲: '天冲',
	沖: '天冲',
	辅: '天辅',
	輔: '天辅',
	英: '天英',
	芮: '天芮',
	禽: '天禽',
	柱: '天柱',
	心: '天心',
	天蓬: '天蓬',
	天任: '天任',
	天冲: '天冲',
	天輔: '天辅',
	天辅: '天辅',
	天英: '天英',
	天芮: '天芮',
	天禽: '天禽',
	天柱: '天柱',
	天心: '天心',
};
const QIMEN_GOD_MAP = {
	符: '值符',
	值符: '值符',
	蛇: '螣蛇',
	腾蛇: '螣蛇',
	螣蛇: '螣蛇',
	阴: '太阴',
	太陰: '太阴',
	太阴: '太阴',
	合: '六合',
	六合: '六合',
	虎: '白虎',
	白虎: '白虎',
	玄: '玄武',
	玄武: '玄武',
	地: '九地',
	九地: '九地',
	天: '九天',
	九天: '九天',
};

function sortByOrderSet(values, order){
	const arr = Array.from(values || []);
	if(!arr.length){
		return arr;
	}
	const idxMap = new Map();
	(order || []).forEach((txt, idx)=>idxMap.set(txt, idx));
	return arr.sort((a, b)=>{
		const ai = idxMap.has(a) ? idxMap.get(a) : 999;
		const bi = idxMap.has(b) ? idxMap.get(b) : 999;
		if(ai !== bi){
			return ai - bi;
		}
		return `${a}`.localeCompare(`${b}`);
	});
}

function normalizeQimenStem(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	const match = txt.match(/[甲乙丙丁戊己庚辛壬癸]/);
	return match ? match[0] : '';
}

function normalizeQimenDoor(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	const key = txt.replace(/門/g, '门');
	return QIMEN_DOOR_MAP[key] || QIMEN_DOOR_MAP[key.substring(0, 1)] || '';
}

function normalizeQimenStar(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	return QIMEN_STAR_MAP[txt] || QIMEN_STAR_MAP[txt.substring(0, 1)] || '';
}

function normalizeQimenGod(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	return QIMEN_GOD_MAP[txt] || QIMEN_GOD_MAP[txt.substring(0, 1)] || '';
}

function collectQimenTokensFromSectionLines(lines){
	const stems = new Set();
	const doors = new Set();
	const stars = new Set();
	const gods = new Set();
	const src = Array.isArray(lines) ? lines : [];

	const addByList = (list, type)=>{
		(list || []).forEach((one)=>{
			const txt = `${one || ''}`.trim();
			if(!txt){
				return;
			}
			if(type === 'stem'){
				const v = normalizeQimenStem(txt);
				if(v){
					stems.add(v);
				}
				return;
			}
			if(type === 'door'){
				const v = normalizeQimenDoor(txt);
				if(v){
					doors.add(v);
				}
				return;
			}
			if(type === 'star'){
				const v = normalizeQimenStar(txt);
				if(v){
					stars.add(v);
				}
				return;
			}
			if(type === 'god'){
				const v = normalizeQimenGod(txt);
				if(v){
					gods.add(v);
				}
			}
		});
	};

	src.forEach((line)=>{
		const txt = `${line || ''}`.trim();
		if(!txt){
			return;
		}
		const detailMatch = txt.match(/天盘干[：:]\s*([甲乙丙丁戊己庚辛壬癸]).*?八神[：:]\s*([^\s；;，,]+).*?九星[：:]\s*([^\s；;，,]+).*?地盘干[：:]\s*([甲乙丙丁戊己庚辛壬癸])/);
		if(detailMatch){
			addByList([detailMatch[1], detailMatch[4]], 'stem');
			addByList([detailMatch[2]], 'god');
			addByList([detailMatch[3]], 'star');
		}
		const lineMap = [
			{ prefix: '地盘', type: 'stem' },
			{ prefix: '天盘', type: 'stem' },
			{ prefix: '人盘', type: 'door' },
			{ prefix: '神盘', type: 'god' },
		];
		lineMap.forEach((item)=>{
			const m = txt.match(new RegExp(`^${item.prefix}\\s*[：:]\\s*(.+)$`));
			if(!m || !m[1]){
				return;
			}
			const list = `${m[1]}`.split(/[\s、,，;；/]+/).filter(Boolean);
			addByList(list, item.type);
		});
		if(!txt.includes('宫')){
			return;
		}
		const m = txt.match(/^[^：:]+[：:]\s*(.+)$/);
		if(!m || !m[1]){
			return;
		}
		const list = `${m[1]}`.split(/[\s、,，;；/]+/).filter(Boolean);
		if(list.length >= 5){
			addByList([list[0], list[4]], 'stem');
			addByList([list[1]], 'god');
			addByList([list[2]], 'door');
			addByList([list[3]], 'star');
			return;
		}
		addByList(list, 'stem');
		addByList(list, 'god');
		addByList(list, 'door');
		addByList(list, 'star');
	});

	return {
		stems,
		doors,
		stars,
		gods,
	};
}

function buildQimenTipLines(type, key){
	const tipObj = buildQimenXiangTipObj(type, key);
	if(!tipObj){
		return [];
	}
	const lines = [];
	lines.push(`### ${safe(tipObj.title, key)}`);
	const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
	blocks.forEach((block)=>{
		if(!block){
			return;
		}
		if(block.type === 'blank'){
			lines.push('');
			return;
		}
		if(block.type === 'divider'){
			lines.push('==');
			return;
		}
		if(block.type === 'subTitle'){
			lines.push(`### ${safe(block.text, '')}`);
			return;
		}
		const plain = safe(block.text, '').replace(/<[^>]+>/g, '');
		lines.push(plain);
	});
	lines.push('');
	return lines;
}

function buildQimenMeaningLinesByTokens(tokens){
	const lines = [];
	const stems = sortByOrderSet(tokens && tokens.stems, QIMEN_STEM_ORDER);
	const doors = sortByOrderSet(tokens && tokens.doors, QIMEN_DOOR_ORDER);
	const stars = sortByOrderSet(tokens && tokens.stars, QIMEN_STAR_ORDER);
	const gods = sortByOrderSet(tokens && tokens.gods, QIMEN_GOD_ORDER);

	if(stems.length){
		lines.push('【十天干释义】');
		stems.forEach((one)=>{
			lines.push(...buildQimenTipLines('stem', one));
		});
	}
	if(doors.length){
		lines.push('【八门释义】');
		doors.forEach((one)=>{
			lines.push(...buildQimenTipLines('door', one));
		});
	}
	if(stars.length){
		lines.push('【九星释义】');
		stars.forEach((one)=>{
			lines.push(...buildQimenTipLines('star', one));
		});
	}
	if(gods.length){
		lines.push('【八神释义】');
		gods.forEach((one)=>{
			lines.push(...buildQimenTipLines('god', one));
		});
	}
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function normalizeLiurengBranch(raw){
	const match = `${raw || ''}`.match(/[子丑寅卯辰巳午未申酉戌亥]/);
	return match ? match[0] : '';
}

function normalizeLiurengJiang(raw){
	const txt = `${raw || ''}`
		.replace(/（[^）]*）/g, '')
		.replace(/\([^)]*\)/g, '')
		.replace(/^贵神/, '')
		.replace(/^神将/, '')
		.trim();
	return txt;
}

function collectLiurengEntriesFromSectionLines(lines){
	const entries = [];
	const src = Array.isArray(lines) ? lines : [];
	let currentBranch = '';
	src.forEach((line)=>{
		const txt = `${line || ''}`.trim();
		if(!txt){
			return;
		}
		const branchMark = txt.match(/「([子丑寅卯辰巳午未申酉戌亥])\s*[-－]/);
		if(branchMark && branchMark[1]){
			currentBranch = branchMark[1];
		}
		const m = txt.match(/地盘\s*([子丑寅卯辰巳午未申酉戌亥]).*?天盘\s*([子丑寅卯辰巳午未申酉戌亥]).*?贵神[:：]?\s*([^\s；;，,]+)/);
		if(m && m[1] && m[2] && m[3]){
			entries.push({
				di: m[1],
				tian: m[2],
				jiang: normalizeLiurengJiang(m[3]),
			});
			return;
		}
		const s = txt.match(/六壬[:：].*?天盘[:：]\s*([子丑寅卯辰巳午未申酉戌亥]).*?神将[:：]\s*([^\s；;，,]+)/);
		if(s && s[1] && s[2] && currentBranch){
			entries.push({
				di: currentBranch,
				tian: s[1],
				jiang: normalizeLiurengJiang(s[2]),
			});
		}
	});
	const uniq = [];
	const seen = new Set();
	entries.forEach((one)=>{
		if(!one || !one.di || !one.tian || !one.jiang){
			return;
		}
		const key = `${one.di}|${one.tian}|${one.jiang}`;
		if(seen.has(key)){
			return;
		}
		seen.add(key);
		uniq.push(one);
	});
	return uniq;
}

function buildLiurengTipLines(tipObj){
	if(!tipObj){
		return [];
	}
	const lines = [];
	lines.push(`### ${safe(tipObj.title, '')}`);
	(tipObj.tips || []).forEach((one)=>{
		lines.push(`${one}`);
	});
	lines.push('');
	return lines;
}

function buildLiurengMeaningLinesByEntries(entries){
	const lines = [];
	const branchSet = new Set();
	(entries || []).forEach((one)=>{
		if(one && one.tian){
			branchSet.add(one.tian);
		}
	});
	const branches = sortByOrderSet(branchSet, LIURENG_BRANCH_ORDER);
	if(branches.length){
		lines.push('【十二神释义】');
		branches.forEach((branch)=>{
			lines.push(...buildLiurengTipLines(buildLiuRengShenTipObj(branch)));
		});
	}
	const houseTips = [];
	const seenHouse = new Set();
	(entries || []).forEach((one)=>{
		if(!one){
			return;
		}
		const key = `${one.di}|${one.tian}|${one.jiang}`;
		if(seenHouse.has(key)){
			return;
		}
		seenHouse.add(key);
		const tip = buildLiuRengHouseTipObj(one.jiang, one.tian, one.di);
		if(tip){
			houseTips.push(tip);
		}
	});
	if(houseTips.length){
		lines.push('【天将释义】');
		houseTips.forEach((tip)=>{
			lines.push(...buildLiurengTipLines(tip));
		});
	}
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function appendQimenMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const relevantTitles = new Set(['盘型', '盘面要素', '九宫方盘', '八宫详解']);
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		if(!relevantTitles.has(title)){
			return;
		}
		const tokens = collectQimenTokensFromSectionLines((sec.lines || []).slice(1));
		const meaningLines = buildQimenMeaningLinesByTokens(tokens);
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function appendLiurengMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		if(title !== '十二地盘/十二天盘/十二贵神对应' && title !== '大六壬'){
			return;
		}
		const entries = collectLiurengEntriesFromSectionLines((sec.lines || []).slice(1));
		const meaningLines = buildLiurengMeaningLinesByEntries(entries);
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function appendSanShiUnitedMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		const isPalaceSection = title.includes('宫');
		const isLiuRengRefSection = title.indexOf('六壬') === 0;
		if(!isPalaceSection && title !== '大六壬' && !isLiuRengRefSection){
			return;
		}
		const lines = (sec.lines || []).slice(1);
		const qimenTokens = collectQimenTokensFromSectionLines(lines);
		const liurengEntries = collectLiurengEntriesFromSectionLines(lines);
		const planets = detectIdsByAliasMap(lines, PLANET_ALIAS_MAP);
		const lots = detectIdsByAliasMap(lines, LOT_ALIAS_MAP);
		const signs = detectIdsByAliasMap(lines, SIGN_ALIAS_MAP);
		const houses = detectIdsByAliasMap(lines, HOUSE_ALIAS_MAP);
		const aspects = detectAspectDegreesFromLines(lines);

		const meaningLines = []
			.concat(buildQimenMeaningLinesByTokens(qimenTokens))
			.concat(buildLiurengMeaningLinesByEntries(liurengEntries))
			.concat(buildMeaningLinesForIds('planet', planets, '星释义'))
			.concat(buildMeaningLinesForIds('lot', lots, '希腊点释义'))
			.concat(buildMeaningLinesForIds('sign', signs, '星座释义'))
			.concat(buildMeaningLinesForIds('house', houses, '宫位释义'))
			.concat(buildMeaningLinesForAspects(aspects));
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

export function applyAstroMeaningFilterByContext(content, key){
	const support = isAstroMeaningTechnique(key) || isHoverMeaningTechnique(key);
	if(!support){
		return content;
	}
	const settings = loadAIExportSettings();
	const mode = getAstroMeaningSettingByTechnique(settings, key);
	if(mode.enabled !== 1){
		return content;
	}
	if(key === 'qimen'){
		return appendQimenMeaningSections(content);
	}
	if(key === 'liureng'){
		return appendLiurengMeaningSections(content);
	}
	if(key === 'sanshiunited'){
		return appendSanShiUnitedMeaningSections(content);
	}
	return appendAstroMeaningSections(content);
}
