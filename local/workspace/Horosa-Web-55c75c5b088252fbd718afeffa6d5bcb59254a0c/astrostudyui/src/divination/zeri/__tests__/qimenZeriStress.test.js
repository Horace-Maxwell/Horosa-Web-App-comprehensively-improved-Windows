// [奇门择日 压测] 全取值×全组合×全参数 找局恒等全量对拍。
// 中心不变量:scanQimen 的区间覆盖 ≡ 独立逐小时真值(直接 computeQimenScanPan+evaluateQimenTree,
// 完全绕开扫描器的折叠/递归分解/边界代码路径)——「找完结果和查找的对不上」在此必现形。
// 另对每行区间做边界四探针:start 分钟必命中、end-1 分钟必命中、start-1/end 分钟要么被邻行
// 覆盖(同刻换盘分行)要么必不命中。区间良构(排序/不重叠/分钟对齐/时长一致)逐行断言。
// 矩阵记录:每个 test = 一行【取值/组合 × 预期(恒等+特定) × 实际(绿/红)】,afterAll 打印命中摘要。
import {
	scanQimen,
	computeQimenScanPan,
	buildQimenScanSeeds,
	evaluateQimenTree,
	qimenZoneOffsetMinutes,
} from '../qimenScanEngine';
import {
	QIMEN_CONDITION_TYPES,
	newQimenLeaf,
	newQimenGroup,
	compileQimenTree,
} from '../qimenConditionTypes';
import { QIMEN_JI_PATTERN_NAMES, QIMEN_XIONG_PATTERN_NAMES } from '../../../components/dunjia/DunJiaBaGongRules';

jest.setTimeout(300000);

const MIN = 60e3;
const HOUR = 3600e3;
const ZONE = '+08:00';
const OFFSET = qimenZoneOffsetMinutes(ZONE);
const GEO = { zone: ZONE, lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const BASE_OPTIONS = {
	paiPanType: 3, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1,
	kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false,
	timeAlg: 1, school: '转盘', after23NewDay: 0, lateZiHourUseNextDay: 1,
};
// 36 小时窗(覆盖跨午夜+18 个时辰,兼顾穷举耗时)
const WIN36 = { startDate: '2026-05-14', startTime: '00:00', endDate: '2026-05-15', endTime: '11:59' };

const pad2 = (n)=>(n < 10 ? `0${n}` : `${n}`);
function wallMs(dateStr, timeStr){
	const [y, m, d] = dateStr.split('-').map(Number);
	const [hh, mm] = timeStr.split(':').map(Number);
	const dt = new Date(0);
	dt.setUTCFullYear(y, m - 1, d);
	dt.setUTCHours(hh, mm, 0, 0);
	return dt.getTime() - OFFSET * MIN;
}
function msWall(ms){
	const d = new Date(ms + OFFSET * MIN);
	return {
		date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
		time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00`,
	};
}

// 盘缓存:同 options 集内逐小时真值只排一次盘(穷举 185+ 取值共享)。
const seedsCache = new Map();
function seedsFor(cfg){
	const y0 = Number(cfg.startDate.slice(0, 4));
	const y1 = Number(cfg.endDate.slice(0, 4));
	const key = `${y0}|${y1}`;
	if(!seedsCache.has(key)){
		seedsCache.set(key, buildQimenScanSeeds(y0, y1, ZONE));
	}
	return seedsCache.get(key);
}
const panCache = new Map();
function panAt(ms, options, cfg){
	const w = msWall(ms);
	const key = `${w.date} ${w.time}|${JSON.stringify(options)}`;
	if(!panCache.has(key)){
		panCache.set(key, computeQimenScanPan(GEO, options, seedsFor(cfg), w.date, w.time));
	}
	return panCache.get(key);
}
function passAt(ms, compiled, options, cfg){
	return !!evaluateQimenTree(compiled, panAt(ms, options, cfg), null, false).pass;
}
function covered(intervals, ms){
	return intervals.some((r)=>r.startMs <= ms && ms < r.endMs);
}

function leafOf(type, params, extra){
	const leaf = newQimenLeaf(type);
	leaf.params = { ...leaf.params, ...(params || {}) };
	return { ...leaf, ...(extra || {}) };
}
function rootOf(children){
	return { ...newQimenGroup('all'), children };
}

const MATRIX = [];

// 核心校验器:找局 + 独立真值恒等 + 区间良构 + 边界四探针。
async function scanAndSweep(id, uiRoot, optionsOverride, cfgOverride){
	const options = { ...BASE_OPTIONS, ...(optionsOverride || {}) };
	const cfg = cfgOverride || WIN36;
	const compiled = compileQimenTree(uiRoot);
	const res = await scanQimen({ cfg, geoParams: GEO, options, tree: compiled });
	const t0 = wallMs(cfg.startDate, cfg.startTime);
	const t1 = wallMs(cfg.endDate, cfg.endTime);
	// 良构:排序/不重叠/界内/分钟对齐/时长自洽
	let prevEnd = -Infinity;
	res.intervals.forEach((r)=>{
		expect(r.endMs).toBeGreaterThan(r.startMs);
		expect(r.startMs).toBeGreaterThanOrEqual(prevEnd);
		expect(r.startMs).toBeGreaterThanOrEqual(t0);
		expect(r.endMs).toBeLessThanOrEqual(t1);
		expect((r.startMs - t0) % MIN).toBe(0);
		expect((r.endMs - t0) % MIN).toBe(0);
		expect(r.durationMin).toBe(Math.round((r.endMs - r.startMs) / MIN));
		prevEnd = r.endMs;
	});
	// 恒等:逐小时真值 vs 区间覆盖。窗口为半开 [t0,t1):恰落 t1 的端点瞬间不属窗口
	// (行 endMs 截断于 t1,covered 恒 false),故真值只扫 ms < t1,防栅栏柱假红。
	const mismatches = [];
	for(let ms = t0; ms < t1; ms += HOUR){
		const pass = passAt(ms, compiled, options, cfg);
		const cov = covered(res.intervals, ms);
		if(pass !== cov){
			mismatches.push(`${msWall(ms).date} ${msWall(ms).time} 真值=${pass} 覆盖=${cov}`);
		}
	}
	// 边界四探针(逐行):端点内必真;端点外要么邻行覆盖(换盘分行)要么必假
	res.intervals.forEach((r)=>{
		if(!passAt(r.startMs, compiled, options, cfg)){
			mismatches.push(`行起点非真 ${r.start}`);
		}
		if(!passAt(Math.max(r.startMs, r.endMs - MIN), compiled, options, cfg)){
			mismatches.push(`行终点前一分钟非真 ${r.end}`);
		}
		const before = r.startMs - MIN;
		if(before >= t0 && !covered(res.intervals, before) && passAt(before, compiled, options, cfg)){
			mismatches.push(`行起点外一分钟漏收 ${r.start}`);
		}
		const after = r.endMs;
		if(after < t1 && !covered(res.intervals, after) && passAt(after, compiled, options, cfg)){
			mismatches.push(`行终点外一分钟漏收 ${r.end}`);
		}
	});
	MATRIX.push({ id, hits: res.intervals.length, truncated: res.truncated });
	expect({ id, mismatches }).toEqual({ id, mismatches: [] });
	return res;
}

afterAll(()=>{
	const byPrefix = {};
	let zero = 0;
	MATRIX.forEach((row)=>{
		const prefix = row.id.split('·')[0];
		byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
		if(row.hits === 0){ zero += 1; }
	});
	// 摘要供交付报告引用(逐行明细=各 test 名+绿红)
	// eslint-disable-next-line no-console
	console.log(`[压测矩阵] 共 ${MATRIX.length} 行恒等校验;零命中 ${zero} 行(0 命中亦须真值全假,已恒等);分组:${JSON.stringify(byPrefix)}`);
});

// ── S1:13 类条件·全取值穷举 ──
describe('S1 全取值穷举(每值:找局↔独立真值恒等)', ()=>{
	const NINE_GAN = ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
	const DOORS = ['休', '生', '伤', '杜', '景', '死', '惊', '开'];
	const STARS = ['蓬', '任', '冲', '辅', '英', '芮', '柱', '心', '禽'];
	const GODS8 = ['符', '蛇', '阴', '合', '虎', '玄', '地', '天'];
	const GODS_FEI = ['勾', '雀', '常'];
	const FLAGS = ['kongWang', 'yima', 'jiXing', 'ruMu', 'menPo'];
	const RELS = ['sheng', 'beisheng', 'po', 'shouzhi', 'bihe'];
	const JU_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
	const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const TEN_GAN = ['甲', ...NINE_GAN];

	test.each(QIMEN_JI_PATTERN_NAMES)('吉格·%s', async (n)=>{
		await scanAndSweep(`吉格·${n}`, rootOf([leafOf('pattern_ji', { names: [n], palaces: [] })]));
	});
	test.each(QIMEN_XIONG_PATTERN_NAMES)('凶格·%s', async (n)=>{
		await scanAndSweep(`凶格·${n}`, rootOf([leafOf('pattern_xiong', { names: [n], palaces: [] })]));
	});
	test.each(NINE_GAN)('天盘干·%s', async (g)=>{
		await scanAndSweep(`天盘干·${g}`, rootOf([leafOf('tian_gan', { values: [g], palaces: [3] })]));
	});
	test.each(NINE_GAN)('地盘干·%s', async (g)=>{
		await scanAndSweep(`地盘干·${g}`, rootOf([leafOf('di_gan', { values: [g], palaces: [7] })]));
	});
	test.each(DOORS)('八门·%s', async (d)=>{
		await scanAndSweep(`八门·${d}`, rootOf([leafOf('door', { values: [d], palaces: [8] })]));
	});
	test.each(STARS)('九星·%s', async (s)=>{
		await scanAndSweep(`九星·${s}`, rootOf([leafOf('star', { values: [s], palaces: [2] })]));
	});
	test.each(GODS8)('八神·%s(转盘)', async (g)=>{
		await scanAndSweep(`八神·${g}`, rootOf([leafOf('god', { values: [g], palaces: [9] })]));
	});
	test.each(GODS_FEI)('九神·%s(飞盘)', async (g)=>{
		const res = await scanAndSweep(`九神飞·${g}`, rootOf([leafOf('god', { values: [g], palaces: [] })]), { school: '飞盘' });
		expect(res.intervals.length).toBeGreaterThan(0);
	});
	test.each(GODS_FEI)('九神·%s(转盘恒零命中)', async (g)=>{
		const res = await scanAndSweep(`九神转·${g}`, rootOf([leafOf('god', { values: [g], palaces: [] })]));
		expect(res.intervals.length).toBe(0);
	});
	test.each(FLAGS)('宫位标记·%s', async (f)=>{
		await scanAndSweep(`标记·${f}`, rootOf([leafOf('palace_flag', { values: [f], palaces: [] })]));
	});
	test.each(RELS)('门宫生克·%s', async (r)=>{
		await scanAndSweep(`生克·${r}`, rootOf([leafOf('men_gong_relation', { values: [r], palaces: [] })]));
	});
	test.each(STARS)('值符星·%s', async (s)=>{
		await scanAndSweep(`值符星·${s}`, rootOf([leafOf('zhifu', { stars: [s], palaces: [] })]));
	});
	test.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('值符落宫·grid%s', async (p)=>{
		await scanAndSweep(`值符宫·${p}`, rootOf([leafOf('zhifu', { stars: [], palaces: [p] })]));
	});
	test.each(DOORS)('值使门·%s', async (d)=>{
		await scanAndSweep(`值使门·${d}`, rootOf([leafOf('zhishi', { doors: [d], palaces: [] })]));
	});
	test.each(['阳遁', '阴遁'])('局象遁·%s', async (v)=>{
		await scanAndSweep(`局遁·${v}`, rootOf([leafOf('ju_info', { dun: v, juShu: [], sanYuan: [] })]));
	});
	test.each(JU_NUMS)('局象局数·%s', async (n)=>{
		await scanAndSweep(`局数·${n}`, rootOf([leafOf('ju_info', { dun: '', juShu: [n], sanYuan: [] })]));
	});
	test.each(['上元', '中元', '下元'])('局象三元·%s', async (v)=>{
		await scanAndSweep(`三元·${v}`, rootOf([leafOf('ju_info', { dun: '', juShu: [], sanYuan: [v] })]));
	});
	test.each(ZHIS)('时支·%s', async (z)=>{
		await scanAndSweep(`时支·${z}`, rootOf([leafOf('pillar_ganzhi', { pillar: 'time', gans: [], zhis: [z] })]));
	});
	test.each(TEN_GAN)('时干·%s', async (g)=>{
		await scanAndSweep(`时干·${g}`, rootOf([leafOf('pillar_ganzhi', { pillar: 'time', gans: [g], zhis: [] })]));
	});
	test.each(['year', 'month', 'day'])('柱支·%s(申/未/辰)', async (p)=>{
		const zhi = p === 'year' ? '午' : (p === 'month' ? '巳' : '寅');
		await scanAndSweep(`柱·${p}`, rootOf([leafOf('pillar_ganzhi', { pillar: p, gans: [], zhis: [zhi] })]));
	});
});

// ── S2a:组合矩阵(连接门/取反/嵌套/矛盾/重言) ──
describe('S2a 组合矩阵', ()=>{
	const A = ()=>leafOf('pattern_ji', { names: ['青龙回首'], palaces: [] });
	const B = ()=>leafOf('door', { values: ['开'], palaces: [8] });
	const C = ()=>leafOf('palace_flag', { values: ['kongWang'], palaces: [2] });
	const D = ()=>leafOf('tian_gan', { values: ['乙'], palaces: [9] });

	test('A 且 B', async ()=>{
		await scanAndSweep('组合·A且B', rootOf([A(), leafOf('door', { values: ['开'], palaces: [8] }, { joiner: 'all' })]));
	});
	test('A 或 B', async ()=>{
		await scanAndSweep('组合·A或B', rootOf([A(), { ...B(), joiner: 'any' }]));
	});
	test('A 异或 B', async ()=>{
		await scanAndSweep('组合·A异或B', rootOf([A(), { ...B(), joiner: 'xor' }]));
	});
	test('非A(叶级取反)', async ()=>{
		await scanAndSweep('组合·非A', rootOf([{ ...A(), negate: true }]));
	});
	test('矛盾:A 且 非A → 恒零命中', async ()=>{
		const res = await scanAndSweep('组合·A且非A', rootOf([A(), { ...A(), negate: true, joiner: 'all' }]));
		expect(res.intervals.length).toBe(0);
	});
	test('重言:A 或 非A → 铺满全窗且无缝', async ()=>{
		const res = await scanAndSweep('组合·A或非A', rootOf([A(), { ...A(), negate: true, joiner: 'any' }]));
		const t0 = wallMs(WIN36.startDate, WIN36.startTime);
		const t1 = wallMs(WIN36.endDate, WIN36.endTime);
		expect(res.intervals[0].startMs).toBe(t0);
		expect(res.intervals[res.intervals.length - 1].endMs).toBe(t1);
		for(let i = 1; i < res.intervals.length; i++){
			expect(res.intervals[i].startMs).toBe(res.intervals[i - 1].endMs);
		}
	});
	test('重言:天盘干全选 → 铺满(逐时辰换盘分行)', async ()=>{
		const res = await scanAndSweep('组合·九干全选', rootOf([leafOf('tian_gan', { values: ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'], palaces: [] })]));
		expect(res.intervals.length).toBeGreaterThanOrEqual(17);
	});
	test('嵌套:(A或B) 且 (C或D)', async ()=>{
		const g1 = { ...newQimenGroup('all'), children: [A(), { ...B(), joiner: 'any' }] };
		const g2 = { ...newQimenGroup('all'), children: [C(), { ...D(), joiner: 'any' }], joiner: 'all' };
		await scanAndSweep('组合·嵌套两组', rootOf([g1, g2]));
	});
	test('三层嵌套:A 且 (B 或 (C 且 D))', async ()=>{
		const inner = { ...newQimenGroup('all'), children: [C(), { ...D(), joiner: 'all' }], joiner: 'any' };
		const mid = { ...newQimenGroup('all'), children: [B(), inner], joiner: 'all' };
		await scanAndSweep('组合·三层嵌套', rootOf([A(), mid]));
	});
	test('组级取反:非(B 或 C)', async ()=>{
		const g = { ...newQimenGroup('all'), children: [B(), { ...C(), joiner: 'any' }], negate: true };
		await scanAndSweep('组合·组取反', rootOf([g]));
	});
	test('三元异或链:A xor B xor C', async ()=>{
		await scanAndSweep('组合·三元异或', rootOf([A(), { ...B(), joiner: 'xor' }, { ...C(), joiner: 'xor' }]));
	});
	test('matchMode all(值集跨宫):乙+丙 全部在场', async ()=>{
		await scanAndSweep('组合·全部在场', rootOf([leafOf('tian_gan', { values: ['乙', '丙'], palaces: [], matchMode: 'all' })]));
	});
	test('matchMode all(格局):伏吟+门迫 全部在场', async ()=>{
		await scanAndSweep('组合·格局全在场', rootOf([leafOf('pattern_xiong', { names: ['伏吟', '门迫'], palaces: [], matchMode: 'all' })]));
	});
	test('死角:开门@中五宫(转盘) → 恒零命中且恒等', async ()=>{
		const res = await scanAndSweep('组合·中宫开门', rootOf([leafOf('door', { values: ['开'], palaces: [5] })]));
		expect(res.intervals.length).toBe(0);
	});
	test('纲要组合:值符落乾 且 值使开门', async ()=>{
		await scanAndSweep('组合·符使', rootOf([
			leafOf('zhifu', { stars: [], palaces: [9] }),
			{ ...leafOf('zhishi', { doors: ['开'], palaces: [] }), joiner: 'all' },
		]));
	});
	test('跨至点窗:阴遁段+阳遁段各自恒等且拼接无缝(2015 冬至)', async ()=>{
		const cfg = { startDate: '2015-12-21', startTime: '20:00', endDate: '2015-12-22', endTime: '20:00' };
		const resYin = await scanAndSweep('至点·阴遁', rootOf([leafOf('ju_info', { dun: '阴遁', juShu: [], sanYuan: [] })]), null, cfg);
		const resYang = await scanAndSweep('至点·阳遁', rootOf([leafOf('ju_info', { dun: '阳遁', juShu: [], sanYuan: [] })]), null, cfg);
		expect(resYin.intervals.length).toBeGreaterThan(0);
		expect(resYang.intervals.length).toBeGreaterThan(0);
		const yinEnd = resYin.intervals[resYin.intervals.length - 1].end;
		const yangStart = resYang.intervals[0].start;
		expect(yinEnd).toBe(yangStart);
	});
});

// ── S2b:盘面参数矩阵(每变体:探针条件恒等) ──
describe('S2b 盘面参数矩阵', ()=>{
	const PROBE = ()=>rootOf([leafOf('door', { values: ['开'], palaces: [] })]);
	const VARIANTS = [
		['年家奇门', { paiPanType: 0 }],
		['月家奇门', { paiPanType: 1 }],
		['日家奇门', { paiPanType: 2 }],
		['时家奇门', { paiPanType: 3 }],
		['飞盘', { school: '飞盘' }],
		['混合', { school: '混合' }],
		['置闰', { qijuMethod: 'zhirun' }],
		['茅山', { qijuMethod: 'maoshan' }],
		['无闰', { qijuMethod: 'wurun' }],
		['报数168', { qijuMethod: 'shuzi', shuziReportNumber: '168' }],
		['置闰8天', { qijuMethod: 'zhirun', zhirunLeapDays: 8 }],
		['时空', { kongMode: 'time' }],
		['时马', { yimaMode: 'time' }],
		['移星3', { shiftPalace: 3 }],
		['真太阳时', { timeAlg: 0 }],
		['23点换日', { after23NewDay: 1 }],
		['晚子当日干', { lateZiHourUseNextDay: 0 }],
		['值使法1', { zhiShiType: 1 }],
		['值使法2', { zhiShiType: 2 }],
		['月家年支', { paiPanType: 1, yueJiaQiJuType: 1 }],
	];
	test.each(VARIANTS)('参数·%s 恒等', async (label, ov)=>{
		await scanAndSweep(`参数·${label}`, PROBE(), ov);
	});
	// 活性探针必须限定宫位:开门/空亡「任意宫」在任何盘面恒存在=重言,两盘式区间自然相同(探针自弱假红)。
	test('参数活性:转盘 vs 飞盘 结果集必不同(开门@坎)', async ()=>{
		const scoped = ()=>rootOf([leafOf('door', { values: ['开'], palaces: [8] })]);
		const a = await scanAndSweep('活性·转盘', scoped());
		const b = await scanAndSweep('活性·飞盘', scoped(), { school: '飞盘' });
		expect(JSON.stringify(a.intervals)).not.toBe(JSON.stringify(b.intervals));
	});
	test('参数活性:日空 vs 时空 结果集必不同(空亡@离)', async ()=>{
		const scoped = ()=>rootOf([leafOf('palace_flag', { values: ['kongWang'], palaces: [2] })]);
		const a = await scanAndSweep('活性·日空', scoped());
		const b = await scanAndSweep('活性·时空', scoped(), { kongMode: 'time' });
		expect(JSON.stringify(a.intervals)).not.toBe(JSON.stringify(b.intervals));
	});
	test('参数活性:时家 vs 日家 行数量级不同(日家整日并行)', async ()=>{
		const a = await scanAndSweep('活性·时家', rootOf([leafOf('tian_gan', { values: ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'], palaces: [] })]));
		const b = await scanAndSweep('活性·日家', rootOf([leafOf('tian_gan', { values: ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'], palaces: [] })]), { paiPanType: 2 });
		expect(b.intervals.length).toBeLessThan(a.intervals.length);
	});
});

// ── S2c:边界/非法输入 ──
describe('S2c 边界与非法输入', ()=>{
	test('1 小时窗:恒真恰一行 [00:00,00:59]', async ()=>{
		const cfg = { startDate: '2026-05-14', startTime: '00:00', endDate: '2026-05-14', endTime: '00:59' };
		const res = await scanAndSweep('边界·1小时窗', rootOf([leafOf('tian_gan', { values: ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'], palaces: [] })]), null, cfg);
		expect(res.intervals.length).toBe(1);
		expect(res.intervals[0].start).toBe('2026-05-14 00:00');
		expect(res.intervals[0].end).toBe('2026-05-14 00:59');
	});
	test('跨午夜窗恒等(20:00→次日04:00)', async ()=>{
		const cfg = { startDate: '2026-05-14', startTime: '20:00', endDate: '2026-05-15', endTime: '04:00' };
		await scanAndSweep('边界·跨午夜', rootOf([leafOf('door', { values: ['开'], palaces: [] })]), null, cfg);
	});
	test('起=止 → invalid_range', async ()=>{
		const cfg = { startDate: '2026-05-14', startTime: '10:00', endDate: '2026-05-14', endTime: '10:00' };
		await expect(scanQimen({ cfg, geoParams: GEO, options: BASE_OPTIONS, tree: compileQimenTree(rootOf([leafOf('door', { values: ['开'] })])) }))
			.rejects.toMatchObject({ code: 'invalid_range' });
	});
	test('缺日期 → invalid_range', async ()=>{
		const cfg = { startDate: '', startTime: '10:00', endDate: '2026-05-14', endTime: '11:00' };
		await expect(scanQimen({ cfg, geoParams: GEO, options: BASE_OPTIONS, tree: compileQimenTree(rootOf([leafOf('door', { values: ['开'] })])) }))
			.rejects.toMatchObject({ code: 'invalid_range' });
	});
	test('空树/空取值/未知类型 → 编译期拦截', ()=>{
		expect(()=>compileQimenTree(rootOf([]))).toThrow('条件列表为空');
		expect(()=>compileQimenTree(rootOf([leafOf('tian_gan', { values: [] })]))).toThrow('天盘干');
		expect(()=>compileQimenTree(rootOf([{ kind: 'leaf', type: 'nope', params: {} }]))).toThrow('未知条件类型');
		expect(()=>compileQimenTree(rootOf([leafOf('zhifu', { stars: [], palaces: [] })]))).toThrow('值符');
		expect(()=>compileQimenTree(rootOf([leafOf('ju_info', { dun: '', juShu: [], sanYuan: [] })]))).toThrow('局象');
		expect(()=>compileQimenTree(rootOf([leafOf('pillar_ganzhi', { pillar: 'time', gans: [], zhis: [] })]))).toThrow('四柱');
	});
	test('无经纬(真太阳时档) → 不炸且恒等(退直接时间口径)', async ()=>{
		const bareGeo = { zone: ZONE, ad: 1, gender: 1 };
		const options = { ...BASE_OPTIONS, timeAlg: 0 };
		const compiled = compileQimenTree(rootOf([leafOf('door', { values: ['开'], palaces: [] })]));
		const cfg = { startDate: '2026-05-14', startTime: '00:00', endDate: '2026-05-14', endTime: '06:00' };
		const res = await scanQimen({ cfg, geoParams: bareGeo, options, tree: compiled });
		expect(Array.isArray(res.intervals)).toBe(true);
	});
});
