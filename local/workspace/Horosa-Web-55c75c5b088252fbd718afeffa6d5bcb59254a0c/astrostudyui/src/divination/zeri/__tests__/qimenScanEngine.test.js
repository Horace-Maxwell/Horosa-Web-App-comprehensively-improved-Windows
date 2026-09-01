// [奇门择日 T2] 扫描引擎金标(全离线):
// ① 冻结基线锚 —— 与 dunjiaSnapshotTableEquiv 同参同时刻(2026-05-15 00:12 拆补阳七下·伏吟局),
//    扫描须命中且边界分钟精确;晚子时两档(after23NewDay 0/1)分别断言 midnight 截盘/跨 midnight 并盘。
// ② 至界时辰内翻局 —— 2015-12-22 冬至(拆补 10:30 阴七中 / 14:30 阳七中,dunjiaBackendParity 锚),
//    阴遁段与阳遁段必须在同一分钟精确对接(采样+折叠+二分的核心正确性证明)。
// ③ 折叠正确性/负控零命中/截断上限/AbortError/参数确改盘(school 死开关反证)。
import {
	scanQimen,
	explainQimenAt,
	computeQimenScanPan,
	buildQimenScanSeeds,
	qimenZoneOffsetMinutes,
} from '../qimenScanEngine';
import { newQimenLeaf, newQimenGroup, compileQimenTree } from '../qimenConditionTypes';

const GEO = { zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const BASE_OPTIONS = {
	paiPanType: 3, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1,
	kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false,
	timeAlg: 1, school: '转盘', after23NewDay: 0, lateZiHourUseNextDay: 1,
};

function treeOf(rows){
	const children = rows.map(([type, params, joiner], i)=>{
		const leaf = newQimenLeaf(type);
		leaf.params = { ...leaf.params, ...(params || {}) };
		if(i > 0){ leaf.joiner = joiner || 'all'; }
		return leaf;
	});
	return compileQimenTree({ ...newQimenGroup('all'), children });
}
const FUYIN_QIAN = treeOf([['pattern_xiong', { names: ['伏吟'], palaces: [9] }]]);
const ALWAYS_TRUE = treeOf([['tian_gan', { values: ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'], palaces: [], matchMode: 'any' }]]);

async function run(cfg, tree, extraOptions, more){
	return scanQimen({
		cfg,
		geoParams: GEO,
		options: { ...BASE_OPTIONS, ...(extraOptions || {}) },
		tree,
		...(more || {}),
	});
}
function rowCovering(res, text){
	const offset = qimenZoneOffsetMinutes('+08:00');
	const [d, t] = text.split(' ');
	const dp = d.split('-').map(Number);
	const tp = t.split(':').map(Number);
	const ms = Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0], tp[1]) - offset * 60e3;
	return res.intervals.find((row)=>row.startMs <= ms && ms < row.endMs);
}

describe('T2① 冻结基线锚 + 晚子时两档', ()=>{
	test('after23=0(24点换日):命中行恰为 [00:00,01:00) 早子时段,局=阳遁七局下元', async ()=>{
		const res = await run({ startDate: '2026-05-15', startTime: '00:00', endDate: '2026-05-15', endTime: '02:30' }, FUYIN_QIAN);
		const row = rowCovering(res, '2026-05-15 00:12');
		expect(row).toBeTruthy();
		expect(row.juText).toBe('阳遁七局下元');
		expect(row.start).toBe('2026-05-15 00:00');
		expect(row.end).toBe('2026-05-15 01:00');
		expect(row.durationMin).toBe(60);
		// pick=起点+3 分钟内缩([十三轮] 60s→180s:跨链口径实现差兜底,EoT 简式 vs swiss 曾差 89s 穿透 60s)
		expect(row.pick).toBe('2026-05-15 00:03:00');
	}, 30000);
	test('after23=1(23点换日):子时跨 midnight 并为一行,起于前日 23:00', async ()=>{
		const res = await run(
			{ startDate: '2026-05-14', startTime: '20:00', endDate: '2026-05-15', endTime: '02:30' },
			FUYIN_QIAN,
			{ after23NewDay: 1 },
		);
		const row = rowCovering(res, '2026-05-15 00:12');
		expect(row).toBeTruthy();
		expect(row.juText).toBe('阳遁七局下元');
		expect(row.start).toBe('2026-05-14 23:00');
		expect(row.end).toBe('2026-05-15 01:00');
		expect(row.durationMin).toBe(120);
	}, 30000);
	test('负控:天盘丙@乾6宫 同窗零命中', async ()=>{
		const res = await run(
			{ startDate: '2026-05-15', startTime: '00:00', endDate: '2026-05-15', endTime: '00:59' },
			treeOf([['tian_gan', { values: ['丙'], palaces: [9] }]]),
		);
		expect(res.intervals.length).toBe(0);
		expect(res.truncated).toBe(false);
	}, 30000);
	test('explain 契约:pick 时刻判读树 pass,叶序=构建序,actual 非空', async ()=>{
		const tree = treeOf([
			['pattern_xiong', { names: ['伏吟'], palaces: [9] }],
			['tian_gan', { values: ['乙'], palaces: [9] }, 'all'],
		]);
		const out = explainQimenAt({ geoParams: GEO, options: BASE_OPTIONS, tree, t: '2026-05-15 00:12:00' });
		expect(out.tree.kind).toBe('group');
		expect(out.tree.op).toBe('all');
		expect(out.tree.pass).toBe(true);
		expect(out.tree.children.map((c)=>c.type)).toEqual(['pattern_xiong', 'tian_gan']);
		out.tree.children.forEach((c)=>{
			expect(c.pass).toBe(true);
			expect(`${c.actual}`.length).toBeGreaterThan(0);
		});
		expect(out.juText).toBe('阳遁七局下元');
	}, 30000);
});

describe('T2② 至界时辰内翻局(2015-12-22 冬至,拆补)', ()=>{
	test('阴遁段与阳遁段在同一分钟精确对接(采样+折叠+二分)', async ()=>{
		const cfg = { startDate: '2015-12-22', startTime: '09:00', endDate: '2015-12-22', endTime: '16:00' };
		const yin = await run(cfg, treeOf([['ju_info', { dun: '阴遁', juShu: [], sanYuan: [] }]]));
		const yang = await run(cfg, treeOf([['ju_info', { dun: '阳遁', juShu: [], sanYuan: [] }]]));
		expect(yin.intervals.length).toBeGreaterThan(0);
		expect(yang.intervals.length).toBeGreaterThan(0);
		const lastYin = yin.intervals[yin.intervals.length - 1];
		const firstYang = yang.intervals[0];
		// parity 锚:10:30 阴遁七局中元 / 14:30 阳遁七局中元;翻局须发生在 11:00-14:30 之间且分钟级。
		expect(lastYin.juText).toBe('阴遁七局中元');
		expect(firstYang.juText).toBe('阳遁七局中元');
		expect(lastYin.end).toBe(firstYang.start);
		expect(lastYin.endMs).toBe(firstYang.startMs);
		const boundary = lastYin.end;
		expect(boundary >= '2015-12-22 11:00').toBe(true);
		expect(boundary <= '2015-12-22 14:30').toBe(true);
		// 分钟级精化证明:边界不落在整点采样格上(冬至时刻非整点)。
		expect(boundary.slice(-2)).not.toBe('00');
	}, 60000);
});

describe('T2③ 折叠/截断/中止/参数确改盘', ()=>{
	test('折叠正确性:恒真条件一天窗按时辰分行,行内中点与端点同局', async ()=>{
		const res = await run({ startDate: '2026-05-15', startTime: '00:00', endDate: '2026-05-15', endTime: '23:59' }, ALWAYS_TRUE);
		expect(res.intervals.length).toBeGreaterThanOrEqual(11);
		res.intervals.forEach((row)=>{
			expect(row.endMs).toBeGreaterThan(row.startMs);
			const midMs = row.startMs + Math.floor((row.endMs - row.startMs) / 2 / 60e3) * 60e3;
			const offset = qimenZoneOffsetMinutes('+08:00');
			const d = new Date(midMs + offset * 60e3);
			const pad = (n)=>(n < 10 ? `0${n}` : `${n}`);
			const pan = computeQimenScanPan(
				GEO, BASE_OPTIONS, buildQimenScanSeeds(2026, 2026, '+08:00'),
				`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
				`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`,
			);
			expect(pan.juText).toBe(row.juText);
		});
		// 相邻行首尾相接(恒真条件下无缝隙)
		for(let i = 1; i < res.intervals.length; i++){
			expect(res.intervals[i].start).toBe(res.intervals[i - 1].end);
		}
	}, 60000);
	test('截断上限:maxHits 注入=3 → truncated 且恰 3 行', async ()=>{
		const res = await run(
			{ startDate: '2026-05-15', startTime: '00:00', endDate: '2026-05-15', endTime: '23:59' },
			ALWAYS_TRUE, null, { limits: { maxHits: 3 } },
		);
		expect(res.truncated).toBe(true);
		expect(res.intervals.length).toBe(3);
	}, 30000);
	test('AbortError:进度回调内置 aborted → 抛且 name=AbortError', async ()=>{
		const signal = { aborted: false };
		await expect(run(
			{ startDate: '2026-05-10', startTime: '00:00', endDate: '2026-05-16', endTime: '23:59' },
			ALWAYS_TRUE, null,
			{ signal, onProgress: ()=>{ signal.aborted = true; } },
		)).rejects.toMatchObject({ name: 'AbortError' });
	}, 30000);
	test('参数确改盘:god 勾陈 转盘零命中 / 飞盘可命中(school 开关活性反证)', async ()=>{
		const cfg = { startDate: '2026-05-15', startTime: '00:00', endDate: '2026-05-15', endTime: '23:59' };
		const gou = treeOf([['god', { values: ['勾'], palaces: [] }]]);
		const zhuan = await run(cfg, gou);
		const fei = await run(cfg, gou, { school: '飞盘' });
		expect(zhuan.intervals.length).toBe(0);
		expect(fei.intervals.length).toBeGreaterThan(0);
	}, 60000);
	test('范围守卫:结束早于起始/超 1830 天各按 code 拒绝', async ()=>{
		await expect(run({ startDate: '2026-05-15', startTime: '10:00', endDate: '2026-05-15', endTime: '09:00' }, ALWAYS_TRUE))
			.rejects.toMatchObject({ code: 'invalid_range' });
		await expect(run({ startDate: '2020-01-01', startTime: '00:00', endDate: '2026-01-01', endTime: '00:00' }, ALWAYS_TRUE))
			.rejects.toMatchObject({ code: 'span_too_large' });
	}, 30000);
});
