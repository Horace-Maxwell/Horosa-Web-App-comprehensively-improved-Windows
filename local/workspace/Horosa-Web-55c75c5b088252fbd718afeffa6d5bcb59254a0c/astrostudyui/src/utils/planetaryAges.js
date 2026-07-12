import moment from 'moment';
import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明;astroAiSnapshot 不回引本文件,无环)。
// namespace import + typeof 守卫:测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),
// 缺函数时回 [] 保底 → 输出与补厚前逐字节一致,不炸挂载。
import * as astroAiSnapshot from './astroAiSnapshot';

const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
// bug 修:UI「行星年四档」表(AstroPlanetaryAges.renderYearBandTable)此前未导出;数据源与 UI 同一份。
import { PLANETARY_YEARS } from '../divination/data/hellenisticData';

// 四档表迦勒底序(土→月),与 UI AstroPlanetaryAges.YEAR_BAND_ORDER 同序(组件引本文件,不可反向 import,故本地复述)。
const YEAR_BAND_ORDER = [
	AstroConst.SATURN,
	AstroConst.JUPITER,
	AstroConst.MARS,
	AstroConst.SUN,
	AstroConst.VENUS,
	AstroConst.MERCURY,
	AstroConst.MOON,
];

// 托勒密「人生七阶」（Ages of Man）：固定年龄带，各由一颗古典行星主管（迦勒底序入年龄轴）。
export const PLANETARY_AGES = [
	{ planet: AstroConst.MOON, from: 0, to: 4 },
	{ planet: AstroConst.MERCURY, from: 4, to: 14 },
	{ planet: AstroConst.VENUS, from: 14, to: 22 },
	{ planet: AstroConst.SUN, from: 22, to: 41 },
	{ planet: AstroConst.MARS, from: 41, to: 56 },
	{ planet: AstroConst.JUPITER, from: 56, to: 68 },
	{ planet: AstroConst.SATURN, from: 68, to: Infinity },
];

function parseBirthMoment(chartObj){
	const p = (chartObj && chartObj.params) ? chartObj.params : {};
	const birth = `${p.birth || ''}`.trim();
	if(!birth){
		return null;
	}
	const m = moment(birth.replace(/\//g, '-'), ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD']);
	return m.isValid() ? m : null;
}

// 计算各年龄带 + 当前年龄；叠加该带主星的本命落座（仅展示，缺则留空）。
export function buildPlanetaryAges(chartObj, asOf){
	const birth = parseBirthMoment(chartObj);
	let curAge = null;
	if(birth){
		const now = asOf ? moment(asOf) : moment();
		curAge = now.diff(birth, 'years', true);
	}
	const chart = (chartObj && chartObj.chart) ? chartObj.chart : {};
	const objects = Array.isArray(chart.objects) ? chart.objects : [];
	const findObj = (id) => objects.find((o) => o.id === id) || null;
	const bands = PLANETARY_AGES.map((b) => {
		const active = curAge !== null && curAge >= b.from && (b.to === Infinity ? true : curAge < b.to);
		const o = findObj(b.planet);
		return {
			planet: b.planet,
			from: b.from,
			to: b.to,
			active,
			sign: o ? o.sign : null,
			signlon: (o && o.signlon !== undefined && o.signlon !== null) ? o.signlon : null,
		};
	});
	return { bands, curAge };
}

function planetTxt(id){
	if(id === undefined || id === null || id === ''){ return '-'; }
	return AstroText.AstroTxtMsg[id] || `${id}`;
}

// AI 快照（同步，读本命盘）。无数据返回 ''（挂载显示「缺失」）。
export function buildPlanetaryAgesSnapshotText(chartObj){
	if(!chartObj){ return ''; }
	const { bands, curAge } = buildPlanetaryAges(chartObj);
	if(!bands || !bands.length){ return ''; }
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[行星年龄（Ages of Man）]');
	lines.push('托勒密人生七阶：各年龄带由一颗古典行星主管，当前年龄所落之带为主运行星。');
	if(curAge !== null){
		lines.push(`当前年龄：约 ${Math.floor(curAge)} 岁`);
	}
	lines.push('');
	lines.push('| 年龄带 | 主管 | 本命落座 | 当前 |');
	lines.push('| --- | --- | --- | --- |');
	bands.forEach((b) => {
		const range = b.to === Infinity ? `${b.from}+岁` : `${b.from}-${b.to}岁`;
		const pos = b.sign ? `${planetTxt(b.sign)}${(b.signlon !== null) ? (' ' + Math.floor(b.signlon) + '°') : ''}` : '-';
		lines.push(`| ${range} | ${planetTxt(b.planet)} | ${pos} | ${b.active ? '●' : ''} |`);
	});
	// bug 修:UI「行星年四档」表(小年/中年/大年/极大年,数据源 PLANETARY_YEARS)此前整块缺;
	// 值同 UI 口径(Number.isFinite ? 原值 : '-'),序同 UI 迦勒底序(土→月),并入本段尾 ◆ 子块。
	const fmtYear = (n) => (Number.isFinite(n) ? `${n}` : '-');
	lines.push('');
	lines.push('◆ 行星年四档（小年/中年/大年/极大年）');
	lines.push('七政各有四档通用年数：小年取自辖界最短跨度，大年为各星所辖界度数之和；七政小年之和为 129，日月中年皆为 39.5。');
	YEAR_BAND_ORDER.forEach((id) => {
		const y = PLANETARY_YEARS[id] || {};
		lines.push(`${planetTxt(id)}：小年 ${fmtYear(y.least)} · 中年 ${fmtYear(y.mean)} · 大年 ${fmtYear(y.greater)} · 极大年 ${fmtYear(y.greatest)}`);
	});
	// [YB] 尾部 [当前时点]+[方法说明];定位行=当前年龄所落主政带(bands.active 已算好)。
	const extraLines = [];
	const activeBand = bands.find((b) => b.active);
	if(activeBand){
		const range = activeBand.to === Infinity ? `${activeBand.from}+岁` : `${activeBand.from}-${activeBand.to}岁`;
		extraLines.push(`当前主政：${planetTxt(activeBand.planet)}（${range}）`);
	}
	const tail = [...currentMomentLines(chartObj, extraLines), ...methodNoteLines('planetaryages')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}
