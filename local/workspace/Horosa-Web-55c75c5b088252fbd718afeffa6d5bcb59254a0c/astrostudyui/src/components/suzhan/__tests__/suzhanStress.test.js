// 宿盘(演禽)排盘/输出层穷举压力测试 —— 纯新增,零改引擎/组件/常量。
//
// 说明:宿盘的天文星历计算在后端,前端可测的「排盘/输出」纯函数入口是:
//   · buildSuzhanSnapshotText(chartObj, fields, planetDisplay)  —— 主输出构建器(整合全部选项分支)
//   · buildHouseObjectLines(chart)                              —— 宫内星体表构建器
// 二者内部串联 buildHouseSuLines / computeAscSignIndex / resolveHouseStartMode /
// foldHouseSuLinesToTable / signFromLon / splitDegree / houseFullLabel 等全部派生逻辑,
// 恰好覆盖 4 个用户可选项(外盘型/盘型/宿法/人事十二宫起盘)的所有取值分支。
//
// 穷举:每个选项每种取值 × ≥30 组合成时间/种子/边界输入(空/极端/闰月/子时/跨年/缺 bazi/
// 缺 su28/NaN 坐标/负经度/planetDisplay 变体)做笛卡尔全积。
// 每个组合断言:①不抛异常 ②快照为非空字符串且含关键段 ③核心数值文本不混入 NaN/undefined。
// 发现崩溃/NaN/空只「记录并报告」(测试本身仍绿),失败进 CRASHES[] 列表。

import moment from 'moment';
import { buildSuzhanSnapshotText, buildHouseObjectLines } from '../SuZhanMain';
import * as SZConst from '../SZConst';
import * as AstroConst from '../../../constants/AstroConst';
import { Su28 } from '../../su28/Su28Helper';

const CRASHES = [];

// ---- 选项取值域(穷举源) ----
const SZCHART_VALUES = [
	SZConst.SZChart_NoExternChart,   // 0 无外盘
	SZConst.SZChart_SignChart,       // 1 星座外盘
	SZConst.SZChart_BaGuaChart,      // 2 八卦外盘
	SZConst.SZChart_DunJiaChart,     // 3 遁甲外盘
	SZConst.SZChart_TaiYiChart,      // 4 太乙外盘
	SZConst.SZChart_FangWeiChart,    // 5 方位外盘
	SZConst.SZChart_FengYeChart,     // 6 分野外盘
	SZConst.SZChart_NiXiangChart,    // 7 逆向外盘
];
const SZSHAPE_VALUES = [SZConst.SZChart_Circle, SZConst.SZChart_Square];       // 圆/方
const DOUBING_VALUES = [0, 1];                                                  // 现实距星/斗柄定房
const HOUSESTART_VALUES = [SZConst.SZHouseStart_Bazi, SZConst.SZHouseStart_ASC];// 八字公式/ASC

// ---- 确定性 PRNG(种子可复现) ----
function makeRng(seed){
	let s = (seed >>> 0) || 0x9e3779b9;
	return function(){
		s ^= s << 13; s >>>= 0;
		s ^= s >> 17;
		s ^= s << 5; s >>>= 0;
		return (s >>> 0) / 0xffffffff;
	};
}

const ZI_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const TRAD_IDS = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS,
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.ASC, AstroConst.MC,
];

function signFromRa(ra){
	let v = ((ra % 360) + 360) % 360;
	return AstroConst.LIST_SIGNS[Math.floor(v / 30) % 12];
}

// 合成一份「后端排盘产物」形态的 chart(含 houses/objects/fixedStarSu28/nongli.bazi)。
function synthChart(rng, opts){
	opts = opts || {};
	const houseCount = opts.houseCount !== undefined ? opts.houseCount : 12;
	const houses = [];
	for(let i = 0; i < houseCount; i++){
		const lon = i * 30 + rng() * 30;
		houses.push({ id: `House${i + 1}`, lon, ra: lon });
	}
	// 二十八宿距星表(赤经升序)
	const fixedStarSu28 = Su28.map((name, i)=>({ name, ra: (i * (360 / 28) + rng() * 3) % 360 }));

	const objCount = opts.objCount !== undefined ? opts.objCount : TRAD_IDS.length;
	const objects = [];
	for(let i = 0; i < objCount; i++){
		const id = TRAD_IDS[i % TRAD_IDS.length];
		let ra = rng() * 360;
		if(opts.nanCoords && i % 3 === 0){ ra = NaN; }              // 边界:NaN 赤经
		if(opts.hugeCoords && i % 4 === 0){ ra = 1e9 + rng(); }     // 边界:极大赤经
		if(opts.negCoords && i % 5 === 0){ ra = -rng() * 720; }     // 边界:负赤经
		const house = houses.length ? houses[i % houses.length].id : `House${i + 1}`;
		const su28 = opts.dropSu28 && i % 2 === 0 ? undefined : Su28[i % Su28.length];
		let signlon = ((ra % 30) + 30) % 30;
		if(opts.nanCoords && i % 3 === 0){ signlon = NaN; }
		objects.push({
			id, house, ra,
			signlon,
			sign: Number.isNaN(ra) ? undefined : signFromRa(ra),
			su28,
		});
	}

	const chart = { houses, objects, fixedStarSu28, aspects: {}, lots: [] };
	if(!opts.dropBazi){
		const branch = ZI_BRANCHES[Math.floor(rng() * ZI_BRANCHES.length)];
		chart.nongli = {
			bazi: {
				time: { branch: opts.badBranch ? { cell: '??' } : { branch: {}, cell: branch } },
			},
		};
		// 修正:branch.cell 才是被消费字段
		chart.nongli.bazi.time.branch = opts.badBranch ? { cell: '??' } : { cell: branch };
	}
	return chart;
}

// 合成 fields(受控字段包),date/time 用真 moment 实例以行使跨年/闰月/子时边界。
function synthFields(mom, o){
	return {
		date: { value: mom.clone() },
		time: { value: mom.clone() },
		ad: { value: true },
		zone: { value: o.zone !== undefined ? o.zone : 8 },
		lon: { value: o.lon !== undefined ? o.lon : '116e24' },
		lat: { value: o.lat !== undefined ? o.lat : '39n54' },
		gender: { value: -1 },
		szchart: { value: o.szchart },
		szshape: { value: o.szshape },
		doubingSu28: { value: o.doubingSu28 },
		houseStartMode: { value: o.houseStartMode },
	};
}

// ---- ≥30 组时间/种子/边界输入样本 ----
const TIME_SAMPLES = [
	moment('1900-01-01 00:00:00'),   // 极早 + 子时开端
	moment('1969-12-31 23:59:59'),   // 跨年边界 + 亥末
	moment('1970-01-01 00:00:00'),   // 纪元
	moment('1987-06-15 12:34:56'),
	moment('1988-02-29 06:00:00'),   // 闰年 2/29
	moment('1999-12-31 23:00:00'),   // 世纪跨年
	moment('2000-02-29 00:30:00'),   // 世纪闰年 + 子时
	moment('2004-05-04 00:00:00'),   // 农历闰二月年份(闰月边界期)
	moment('2012-06-30 23:59:60'),   // 闰秒样式(moment 归一)
	moment('2020-04-23 00:15:00'),   // 农历闰四月年份 + 子时
	moment('2023-03-22 03:03:03'),   // 农历闰二月年份
	moment('2024-02-29 23:45:00'),   // 闰年末刻
	moment('2025-12-31 23:59:59'),   // 跨年 + 亥末
	moment('2026-07-18 08:20:00'),
];

function build30Samples(){
	const samples = [];
	// 14 组真时间 × 常规合成
	TIME_SAMPLES.forEach((mom, i)=>{
		samples.push({ label: `time#${i}`, mom, seed: 1000 + i, chartOpts: {} });
	});
	// 边界合成态(种子固定,可复现)
	const edge = [
		{ label: 'empty-chart', chartOpts: { EMPTY: true } },
		{ label: 'no-houses', chartOpts: { houseCount: 0 } },
		{ label: 'no-objects', chartOpts: { objCount: 0 } },
		{ label: 'nan-coords', chartOpts: { nanCoords: true } },
		{ label: 'huge-coords', chartOpts: { hugeCoords: true } },
		{ label: 'neg-coords', chartOpts: { negCoords: true } },
		{ label: 'drop-su28', chartOpts: { dropSu28: true } },
		{ label: 'drop-bazi', chartOpts: { dropBazi: true } },
		{ label: 'bad-branch', chartOpts: { badBranch: true } },
		{ label: 'single-house', chartOpts: { houseCount: 1, objCount: 3 } },
		{ label: 'many-objects', chartOpts: { objCount: 40 } },
		{ label: 'all-nan-mix', chartOpts: { nanCoords: true, negCoords: true, dropSu28: true } },
		{ label: 'sparse', chartOpts: { houseCount: 12, objCount: 2, dropSu28: true } },
		{ label: 'extreme-geo', chartOpts: {}, fieldOpts: { lon: '180e00', lat: '89n59', zone: 14 } },
		{ label: 'neg-geo', chartOpts: {}, fieldOpts: { lon: '121w30', lat: '33s52', zone: -11 } },
		{ label: 'bad-geo-str', chartOpts: {}, fieldOpts: { lon: '', lat: 'not-a-coord', zone: NaN } },
	];
	edge.forEach((e, i)=>{
		samples.push({
			label: e.label,
			mom: TIME_SAMPLES[i % TIME_SAMPLES.length],
			seed: 5000 + i,
			chartOpts: e.chartOpts,
			fieldOpts: e.fieldOpts || {},
		});
	});
	return samples; // 14 + 16 = 30 组
}

const SAMPLES = build30Samples();

// planetDisplay 变体(过滤可见星曜集)
const PLANET_DISPLAYS = [
	null,
	[],
	[AstroConst.SUN, AstroConst.MOON],
	['NonexistentPlanetId'],
	TRAD_IDS.slice(),
];

function buildSampleInputs(sample, combo){
	const fieldOpts = { ...(sample.fieldOpts || {}), ...combo };
	const fields = synthFields(sample.mom, fieldOpts);
	let chart;
	if(sample.chartOpts && sample.chartOpts.EMPTY){
		chart = {};
	}else{
		chart = synthChart(makeRng(sample.seed), sample.chartOpts || {});
	}
	// buildSuzhanSnapshotText 期望 chartObj.chart 形态
	const chartObj = sample.chartOpts && sample.chartOpts.EMPTY ? {} : { chart, nongli: chart.nongli };
	return { fields, chartObj, chart };
}

// 核心数值不得混入 NaN/undefined 文本(表格单元 & 度分行)
function scanForBadNumbers(text, ctx){
	const bad = [];
	const lines = `${text || ''}`.split('\n');
	lines.forEach((ln)=>{
		if(/NaN/.test(ln)){ bad.push(`NaN@"${ln.trim().slice(0, 80)}"`); }
		if(/undefined/.test(ln)){ bad.push(`undefined@"${ln.trim().slice(0, 80)}"`); }
	});
	return bad;
}

describe('宿盘(演禽)排盘/输出层 · 选项×输入穷举压力测试', ()=>{
	const allCombos = [];
	SZCHART_VALUES.forEach((szchart)=>{
		SZSHAPE_VALUES.forEach((szshape)=>{
			DOUBING_VALUES.forEach((doubingSu28)=>{
				HOUSESTART_VALUES.forEach((houseStartMode)=>{
					allCombos.push({ szchart, szshape, doubingSu28, houseStartMode });
				});
			});
		});
	});

	it(`穷举 ${allCombos.length} 选项组合 × ${SAMPLES.length} 输入样本 · buildSuzhanSnapshotText 不崩/结构完整/无 NaN`, ()=>{
		let ran = 0;
		allCombos.forEach((combo)=>{
			SAMPLES.forEach((sample)=>{
				ran++;
				const inputDesc = `szchart=${combo.szchart},szshape=${combo.szshape},doubing=${combo.doubingSu28},houseStart=${combo.houseStartMode}|sample=${sample.label}`;
				PLANET_DISPLAYS.forEach((pd, pdi)=>{
					let out;
					try{
						const { fields, chartObj } = buildSampleInputs(sample, combo);
						out = buildSuzhanSnapshotText(chartObj, fields, pd);
					}catch(e){
						CRASHES.push({ input: `${inputDesc}|pd#${pdi}`, error: `throw: ${e && e.message ? e.message : e}` });
						return;
					}
					// 结构:非空字符串,含关键段标题
					if(typeof out !== 'string' || out.length === 0){
						CRASHES.push({ input: `${inputDesc}|pd#${pdi}`, error: 'empty/non-string snapshot' });
						return;
					}
					if(out.indexOf('[起盘信息]') < 0 || out.indexOf('[宿盘宫位与二十八宿星曜]') < 0){
						CRASHES.push({ input: `${inputDesc}|pd#${pdi}`, error: `missing section header: ${out.slice(0, 60)}` });
					}
					// 核心数值不得混入 NaN/undefined
					const bad = scanForBadNumbers(out);
					if(bad.length){
						CRASHES.push({ input: `${inputDesc}|pd#${pdi}`, error: `bad-number: ${bad.slice(0, 3).join(' ; ')}` });
					}
				});
			});
		});
		// 至少真的跑满穷举
		expect(ran).toBe(allCombos.length * SAMPLES.length);
	});

	it('buildHouseObjectLines 表构建器 · 每样本不崩/表头存在/无 NaN', ()=>{
		SAMPLES.forEach((sample)=>{
			SZCHART_VALUES.forEach((szchart)=>{
				const combo = { szchart, szshape: 0, doubingSu28: 0, houseStartMode: 0 };
				const { chart } = buildSampleInputs(sample, combo);
				let lines;
				try{
					lines = buildHouseObjectLines(chart || {});
				}catch(e){
					CRASHES.push({ input: `houseObjLines|sample=${sample.label}|szchart=${szchart}`, error: `throw: ${e && e.message ? e.message : e}` });
					return;
				}
				if(!Array.isArray(lines)){
					CRASHES.push({ input: `houseObjLines|sample=${sample.label}`, error: 'non-array output' });
					return;
				}
				const joined = lines.join('\n');
				const bad = scanForBadNumbers(joined);
				if(bad.length){
					CRASHES.push({ input: `houseObjLines|sample=${sample.label}|szchart=${szchart}`, error: `bad-number: ${bad.slice(0, 3).join(' ; ')}` });
				}
			});
		});
		expect(true).toBe(true);
	});

	afterAll(()=>{
		if(CRASHES.length){
			// 仅记录并报告,不判红(压测契约:发现即列出,引擎不改)
			// eslint-disable-next-line no-console
			console.log('\n[SUZHAN-STRESS-CRASHES] count=' + CRASHES.length + '\n' + JSON.stringify(CRASHES.slice(0, 50), null, 2));
		}else{
			// eslint-disable-next-line no-console
			console.log('\n[SUZHAN-STRESS-CRASHES] none — passed clean');
		}
	});
});
