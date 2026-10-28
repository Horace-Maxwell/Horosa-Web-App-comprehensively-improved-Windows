// 八卦阳宅法计算内核（纯函数，无 DOM，可单测）。
import { normalizeDeg } from './fengshuiGeom';
import {
	GUA_8, DIR_TO_GUA, HEXAGRAM_TABLE, HEXAGRAM_TEXTS, HEXAGRAM_META,
	SECTOR_NUM_TO_GUA, GUA_TO_ROLE, GUA_TO_SEX, ROLE_TO_GUA, RANK, LUOSHU, FEATURE_RULES,
} from './baguaData';

export {
	GUA_8, DIR_TO_GUA, HEXAGRAM_TABLE, HEXAGRAM_TEXTS, HEXAGRAM_META,
	SECTOR_NUM_TO_GUA, GUA_TO_ROLE, GUA_TO_SEX, ROLE_TO_GUA, RANK, LUOSHU, FEATURE_RULES,
};

// 扇区编号 → 卦（bagua 落点判卦：getSectorForPoint 得 sector.num 后查此表）。
export function guaBySectorNum(num) {
	return SECTOR_NUM_TO_GUA[num] || null;
}

// 婚姻应期前进/后退（洛书加减 + 同性例外层）。幅度＝|洛书(位卦)−洛书(名卦)|（逢三量级）。
// 方向：
//   ① 异性：女命居男位→提前、男命居女位→延后（洛书机制）。
//      验证：火天大有(离9,乾6)=提前3；雷地豫(震3,坤2)=延后1；泽雷随(兑7,震3)=提前4。
//   ② 同性·例外：居父位(乾)/母位(坤)→延后（心态早熟、晚婚——「男人晚婚多住西北角」）。
//   ③ 同性·兄弟姐妹：居较长位(排位序更前)→提前、居较幼位→延后。
//      验证：次子(坎)居长子位(震)=提前2（26 vs 28 岁）；长子(震)居次子位(坎)=延后；三女(兑)居长女位(巽)=早嫁提前。
export function computeRankShift(benmingGua, roomGua) {
	if (!benmingGua || !roomGua || benmingGua === roomGua) return { dir: '平', years: 0, note: '名位同卦，应期无加减' };
	const lb = LUOSHU[benmingGua];
	const lr = LUOSHU[roomGua];
	const sb = GUA_TO_SEX[benmingGua];
	const sr = GUA_TO_SEX[roomGua];
	const rb = RANK[GUA_TO_ROLE[benmingGua]];
	const rr = RANK[GUA_TO_ROLE[roomGua]];
	if (lb == null || lr == null || !sb || !sr) return { dir: '平', years: 0, note: '' };
	const years = Math.abs(lr - lb);
	let dir = '平';
	let why = '';
	if (sb !== sr) {
		// 异性：洛书机制
		if (sb === 'F' && sr === 'M') { dir = '提前'; why = '女命居男位'; }
		else { dir = '延后'; why = '男命居女位'; }
	} else if (roomGua === '乾' || roomGua === '坤') {
		// 同性例外：居父母位 → 心态早熟、晚婚
		dir = '延后'; why = '居父母位（心态早熟·晚婚）';
	} else if (rb != null && rr != null && rb !== rr) {
		// 同性兄弟姐妹：居较长位提前 / 较幼位延后（rank 数越小越长）
		if (rb > rr) { dir = '提前'; why = '居较长位（升位）'; }
		else { dir = '延后'; why = '居较幼位（降位）'; }
	}
	if (dir === '平' || years === 0) return { dir: '平', years: 0, note: '应期无明显加减' };
	return { dir, years, note: `${why}，应期约${dir} ${years} 年` };
}

// 形神论：名(benming)等于位(room)→ 名位相同，主家和万事兴（即 8 纯卦）。
export function namePositionRelation(benmingGua, roomGua) {
	if (!benmingGua || !roomGua) return { same: false, text: '' };
	if (benmingGua === roomGua) return { same: true, text: '名位相同（形神合一），主家和万事兴。' };
	return { same: false, text: '名为形、位为神，名位相生相得则宅运渐和。' };
}

// 四类象格局判语：feature 落于某卦位 → 对该卦家人的影响。
export function featureJudgment(feature, gua) {
	const rule = FEATURE_RULES[feature];
	if (!rule || !gua) return null;
	const family = GUA_TO_ROLE[gua] || '';
	return { label: rule.label, tag: rule.tag, xiang: rule.xiang, family, text: rule.text(gua, family) };
}

// 8 卦各 45° 铺满 360°（北坎=0、东北艮=45、东震=90、东南巽=135、南离=180、西南坤=225、西兑=270、西北乾=315），必落一卦。
const DIR_CENTERS = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];

export function degreeToGua(angle) {
	if (angle === null || angle === undefined || Number.isNaN(angle)) return null;
	const idx = Math.floor(normalizeDeg(normalizeDeg(angle) + 22.5) / 45) % 8;
	return DIR_CENTERS[idx];
}

export function guaByDir(dir) {
	return DIR_TO_GUA[dir] || null;
}

// 成员动态定义：优先级短路（有子女 > 已婚 > 未婚按兄/姐数，取模 3 循环）。
export function resolveMemberRole(p) {
	const F = (role, gua) => ({ role, benmingGua: gua });
	if (!p) return F('长女', '巽');
	if (p.hasChildren) return p.sex === 'M' ? F('父', '乾') : F('母', '坤');
	if (p.married) return p.sex === 'M' ? F('夫', '乾') : F('妻', '坤');
	if (p.sex === 'M') {
		const n = (((p.olderBrothersUnmarried || 0) % 3) + 3) % 3;
		return [F('长子', '震'), F('次子', '坎'), F('三子', '艮')][n];
	}
	const n = (((p.olderSistersUnmarried || 0) % 3) + 3) % 3;
	return [F('长女', '巽'), F('次女', '离'), F('三女', '兑')][n];
}

// 名在上（人本命卦）× 位在下（房间方位卦）→ 64 卦。
export function composeHexagram(upperGua, lowerGua) {
	if (!upperGua || !lowerGua) return null;
	const row = HEXAGRAM_TABLE[upperGua];
	return (row && row[lowerGua]) || null;
}

const WUXING = { 乾: '金', 兑: '金', 坎: '水', 离: '火', 震: '木', 巽: '木', 艮: '土', 坤: '土' };
const SHENG = { 金: '水', 水: '木', 木: '火', 火: '土', 土: '金' }; // X 生 SHENG[X]
const KE = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };    // X 克 KE[X]

// 应期/成格：卦 pace 分档 + 八卦五行相生/比和加速、相克减缓。
export function computeTiming(hex, p) {
	const meta = hex ? HEXAGRAM_META[hex.no] : null;
	const pace = meta ? meta.pace : 'mid';
	const window = { fast: '3天~3月', mid: '3月~3年', slow: '6月~6年' }[pace] || '3月~3年';
	let accelerated = false;
	let slowed = false;
	if (p && p.benmingGua && p.roomGua) {
		const bw = WUXING[p.benmingGua];
		const rw = WUXING[p.roomGua];
		if (bw && rw) {
			if (rw === bw || SHENG[rw] === bw) accelerated = true; // 房间卦生本命 / 比和
			else if (KE[rw] === bw || KE[bw] === rw) slowed = true; // 相克
		}
	}
	return {
		pace,
		window,
		accelerated,
		slowed,
		note: accelerated ? '本命相生，应期偏快取下沿' : slowed ? '相克，应期偏缓取上沿' : '',
	};
}
