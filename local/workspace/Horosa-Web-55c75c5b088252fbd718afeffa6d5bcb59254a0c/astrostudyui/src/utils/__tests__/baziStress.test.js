/**
 * 八字全选项压力测试：穷举新增设置取值 × 代表日期，断言不抛 + 计算结构完整。
 * 覆盖 minggongMethod/fenyeVersion/dayunPrecision/timeAlg/after23NewDay/lateZiHourUseNextDay/zodiacBoundary。
 */
import { buildLocalBaziResult } from '../baziLunarLocal';

const GANS = '甲乙丙丁戊己庚辛壬癸';
const ZHIS = '子丑寅卯辰巳午未申酉戌亥';
function isGanZhi(s){ return typeof s === 'string' && s.length === 2 && GANS.includes(s[0]) && ZHIS.includes(s[1]); }

const DATES = [
	['2026-06-22', '18:00:00'],
	['2000-01-01', '12:00:00'],
	['1988-02-29', '03:30:00'], // 闰日
	['2026-02-04', '04:00:00'], // 立春界
	['2025-12-31', '23:30:00'], // 跨年+晚子时
	['1976-07-06', '21:11:00'],
	['2024-02-10', '00:00:00'], // 农历正月初一附近·子正
];
const MINGGONG = ['shufa', 'tongxing'];
const FENYE = ['common', 'fajue'];
const PRECISION = ['precise', 'integer'];
const TIMEALG = [0, 1, 2, 3];
const AFTER23 = [0, 1];
const LATEZI = [0, 1];
const ZODIAC = ['lichun', 'lunar'];

function assertValid(bazi, label){
	const c = bazi.fourColumns;
	['year', 'month', 'day', 'time'].forEach((k)=>{
		expect(isGanZhi(c[k].ganzi)).toBe(true);
	});
	expect(isGanZhi(c.ming.ganzi)).toBe(true);
	expect(isGanZhi(c.shen.ganzi)).toBe(true);
	expect(isGanZhi(c.tai.ganzi)).toBe(true);
	// 五行力量
	expect(bazi.wuxingStat && Array.isArray(bazi.wuxingStat.scores)).toBe(true);
	const sum = bazi.wuxingStat.scores.reduce((a, s)=>a + s.percent, 0);
	expect(Math.round(sum)).toBe(100);
	expect(bazi.wuxingStat.dayMaster).toBeTruthy();
	// 分野
	expect(bazi.fenYe && bazi.fenYe.ruler && GANS.includes(bazi.fenYe.ruler.gan)).toBe(true);
	// 格局用神
	expect(bazi.gejuYongShen && bazi.gejuYongShen.geju).toBeTruthy();
	expect(bazi.gejuYongShen.yongshen).toBeTruthy();
	expect(bazi.gejuYongShen.tiaohou).toBeTruthy();
	// 神煞 4 柱皆数组
	['year', 'month', 'day', 'time'].forEach((k)=>{
		expect(Array.isArray(c[k].shenSha)).toBe(true);
	});
	// 星运/纳音长生 字符串
	['year', 'month', 'day', 'time'].forEach((k)=>{
		expect(typeof c[k].nayingPhase).toBe('string');
	});
	// 生肖
	expect(typeof bazi.nongli.shengXiaoLichun).toBe('string');
}

function run(date, time, extra){
	return buildLocalBaziResult({
		date, time, zone: '+08:00', lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0,
		gender: 1, ...extra,
	}).bazi;
}

describe('八字压测 · 单选项穷举（每取值 × 全日期）', () => {
	test('minggongMethod × fenyeVersion × precision 全组合不抛+结构完整', () => {
		let n = 0;
		DATES.forEach(([d, t])=>{
			MINGGONG.forEach((mg)=>FENYE.forEach((fy)=>PRECISION.forEach((dp)=>{
				const bazi = run(d, t, { minggongMethod: mg, fenyeVersion: fy, dayunPrecision: dp, timeAlg: 1 });
				assertValid(bazi, `${d} ${mg}/${fy}/${dp}`);
				n += 1;
			})));
		});
		expect(n).toBe(DATES.length * 2 * 2 * 2);
	});

	test('timeAlg × after23 × lateZi × zodiac 全组合不抛+结构完整', () => {
		let n = 0;
		DATES.forEach(([d, t])=>{
			TIMEALG.forEach((ta)=>AFTER23.forEach((a23)=>LATEZI.forEach((lz)=>ZODIAC.forEach((zb)=>{
				const bazi = run(d, t, { timeAlg: ta, after23NewDay: a23, lateZiHourUseNextDay: lz, zodiacBoundary: zb });
				assertValid(bazi, `${d} ta=${ta}/a23=${a23}/lz=${lz}/${zb}`);
				n += 1;
			}))));
		});
		expect(n).toBe(DATES.length * 4 * 2 * 2 * 2);
	});
});

// 补全:phaseType(长生派别)/godKeyPos(神煞主位)/cangVersion(藏干版本) 三档此前 baziStress 未扫。
// 这三档是 buildLocalBaziResult 的 build-time 参数(死选项接线),与已扫的 minggong/fenye/precision 互相独立。
// 注:「断命流派 school」(综合/扶抑/格局/调候/病药/盲派/纳音古法)是 UI 显示选择器(BaZi.js 消费),
//     非 build-time 参数;computeGejuYongShen 一次性产全派对照(gejuYongShen.schools),故此处断言该多派数组齐全即覆盖。
const PHASE_TYPE = [0, 1, 2];           // 0 火土同 / 1 水土同 / 2 阳顺阴逆
const GOD_KEY_POS = ['年', '日', '年日']; // 神煞主位
const CANG_VERSION = ['common', 'fenye'];
// 含土日元(戊/己)出生 → phaseType=1 才真改 diShi(否则三档全同=死)。
const DATES_WITH_EARTH = [
	['2026-06-22', '18:00:00'], // 验当代
	['1998-09-15', '10:00:00'], // 戊/己 概率高
	['2025-12-31', '23:30:00'], // 跨年+晚子时
	['1988-02-29', '03:30:00'], // 闰日
];

describe('八字压测 · 新增 build-time 选项(phaseType/godKeyPos/cangVersion 此前未扫)', () => {
	const SCHOOL_NAMES = new Set(['扶抑派', '格局派', '调候派', '病药派', '通关派']);
	test('phaseType × godKeyPos × cangVersion 全 18 组合 × 全日期:不抛 + 结构完整 + 多派用神对照齐', () => {
		let n = 0;
		DATES_WITH_EARTH.forEach(([d, t])=>{
			PHASE_TYPE.forEach((pt)=>GOD_KEY_POS.forEach((gk)=>CANG_VERSION.forEach((cv)=>{
				const bazi = run(d, t, { phaseType: pt, godKeyPos: gk, cangVersion: cv, timeAlg: 1 });
				assertValid(bazi, `${d} pt=${pt}/gk=${gk}/cv=${cv}`);
				// cangVersion 标注落到 wuxingStat。
				expect(typeof bazi.wuxingStat.cangVersion).toBe('string');
				// 断命流派多派对照数组(school 选择器的真值源)齐全:至少含 2 派,每派结构完整。
				const schools = bazi.gejuYongShen.schools;
				expect(Array.isArray(schools) && schools.length >= 2).toBe(true);
				schools.forEach((s)=>{
					expect(SCHOOL_NAMES.has(s.school)).toBe(true);
					expect(Array.isArray(s.xi)).toBe(true);
				});
				n += 1;
			})));
		});
		expect(n).toBe(DATES_WITH_EARTH.length * PHASE_TYPE.length * GOD_KEY_POS.length * CANG_VERSION.length);
	});

	test('phaseType=1(水土同)对土日元真改四柱「星运」diShi(ganziPhase),非死选项', () => {
		// 已实测确认为戊/己日元的盘(2024-03 系列):phaseType 0→1 应改 diShi(土寄水,申长生顺行)。
		// 注:diShi=日元十二长生,存于 fourColumns[k].ganziPhase(非 nayingPhase=纳音长生)。
		const EARTH_DM = [
			['2024-03-05', '戊'], ['2024-03-06', '己'], ['2024-03-15', '戊'], ['2024-03-16', '己'],
		];
		let verified = 0;
		EARTH_DM.forEach(([d, expectGan])=>{
			const b0 = run(d, '12:00:00', { phaseType: 0 });
			const dayGan = (b0.fourColumns.day.ganzi || b0.fourColumns.day.ganZhi || '').charAt(0);
			expect(dayGan).toBe(expectGan); // 钉死日元(若历法变动会暴露)
			const b1 = run(d, '12:00:00', { phaseType: 1 });
			const dishi0 = ['year', 'month', 'day', 'time'].map((k)=>b0.fourColumns[k].ganziPhase).join('|');
			const dishi1 = ['year', 'month', 'day', 'time'].map((k)=>b1.fourColumns[k].ganziPhase).join('|');
			// 土日元:水土同应改变至少一柱 diShi(死选项真激活)。
			expect(dishi1).not.toBe(dishi0);
			// [B 三档接活] 档2=阳顺阴逆:戊(阳干)档0/档2 同值(不分阴阳与阳干顺行同式=幂等);
			// 己(阴干)档0(随戊寅起顺)≠档2(酉起逆)——旧断言「2==0 恒等」锚的是半截实现,已按权威表更新。
			const b2 = run(d, '12:00:00', { phaseType: 2 });
			const dishi2 = ['year', 'month', 'day', 'time'].map((k)=>b2.fourColumns[k].ganziPhase).join('|');
			if(expectGan === '戊'){ expect(dishi2).toBe(dishi0); }
			else { expect(dishi2).not.toBe(dishi0); }
			verified += 1;
		});
		expect(verified).toBe(EARTH_DM.length);
	});

	test('phaseType 三档对非土日元:阳干日主三档恒等;阴干日主 档0==档1 且 ≠档2(不分阴阳 vs 阴逆)', () => {
		const b0 = run('2026-06-22', '18:00:00', { phaseType: 0 });
		const dayGan = (b0.fourColumns.day.ganzi || b0.fourColumns.day.ganZhi || '').charAt(0);
		expect(dayGan !== '戊' && dayGan !== '己').toBe(true);   // 非土日元样本
		const dishiOf = (pt)=>{ const b = run('2026-06-22', '18:00:00', { phaseType: pt }); return ['year', 'month', 'day', 'time'].map((k)=>b.fourColumns[k].ganziPhase).join('|'); };
		const d0 = dishiOf(0), d1 = dishiOf(1), d2 = dishiOf(2);
		expect(d1).toBe(d0);   // 非土干:档0/档1 同式(不分阴阳,寄宫只动土)
		const yang = ['甲', '丙', '庚', '壬'].indexOf(dayGan) >= 0;
		if(yang){ expect(d2).toBe(d0); }   // 阳干:三档恒等(幂等)
		else { expect(d2).not.toBe(d0); }  // 阴干:不分阴阳≠阴逆
	});

	test('边界:非法/越界选项值 → 回退默认不抛', () => {
		const bad = [
			{ phaseType: 99 }, { phaseType: '___x___' }, { phaseType: null },
			{ godKeyPos: '乱' }, { godKeyPos: undefined },
			{ cangVersion: 'nope' }, { cangVersion: 123 },
		];
		bad.forEach((extra)=>{
			expect(()=>run('2026-06-22', '18:00:00', extra)).not.toThrow();
			const bazi = run('2026-06-22', '18:00:00', extra);
			assertValid(bazi, JSON.stringify(extra));
		});
	});
});

describe('八字压测 · 本地引擎单次耗时(命系性能守护)', () => {
	test('buildLocalBaziResult 单次均值 <500ms、最大 <1000ms(>1s 红线)', () => {
		const samples = [];
		// 10 次代表性调用取均值(本地引擎含 lunar 全管线,是命系最重之一)。
		const cases = [
			{}, { timeAlg: 0 }, { timeAlg: 3 }, { phaseType: 1 }, { cangVersion: 'fenye' },
			{ minggongMethod: 'shufa' }, { fenyeVersion: 'fajue' }, { dayunPrecision: 'integer' },
			{ after23NewDay: 0, lateZiHourUseNextDay: 1 }, { zodiacBoundary: 'lunar' },
		];
		cases.forEach((extra)=>{
			const t0 = Date.now();
			run('1990-06-15', '14:20:00', extra);
			samples.push(Date.now() - t0);
		});
		const avg = samples.reduce((a, b)=>a + b, 0) / samples.length;
		const max = Math.max(...samples);
		// eslint-disable-next-line no-console
		console.log(`[perf] bazi.buildLocalBaziResult: n=${samples.length} avg=${avg.toFixed(1)}ms max=${max}ms`);
		if(max > 1000){
			// eslint-disable-next-line no-console
			console.warn(`[perf][SLOW] bazi 单次最大 ${max}ms 超 1000ms 红线`);
		}
		expect(avg).toBeLessThan(500);
		expect(max).toBeLessThan(1000);
	});
});
