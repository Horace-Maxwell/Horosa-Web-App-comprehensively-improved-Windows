// horaryEngine.test.js —— runHorary 流派 opts 端到端 + 判读技法(月空模式/可判性/完成破坏)哨兵。
// 复用择日 fixture(buildMockResult):白羊 15°↑ 昼盘,月巨蟹 7°入相三合土星。
import { buildMockResult } from '../../election/__tests__/electionFixture';
import { buildFacts } from '../../engine/chartFacts';
import { runHorary } from '../horaryEngine';
import { analyzePerfection } from '../../engine/perfection';
import { moonReport } from '../../engine/moon';
import { radicality } from '../../engine/radicality';
import { buildHorarySnapshot } from '../horarySnapshot';
import { horaryJudgeOpts, HORARY_SCHOOL_ORDER } from '../horarySchools';

function clone(r){ return JSON.parse(JSON.stringify(r)); }
function findObj(r, id){ return r.chart.objects.find((o) => o.id === id); }

describe('runHorary 流派 opts 贯通', () => {
	test('五档全部无异常运行 + 带 school/verdict/significators', () => {
		const r = buildMockResult();
		HORARY_SCHOOL_ORDER.forEach((id) => {
			const j = runHorary(r, 'general', horaryJudgeOpts(id));
			expect(j).toBeTruthy();
			expect(j.school).toBe(id);
			expect(j.verdict).toBeTruthy();
			expect(['yes', 'no', 'even']).toContain(j.verdict.leaning);
			expect(j.significators.querentKey).toBeTruthy();  // 白羊↑ → 火星
			expect(Array.isArray(j.fixedStars)).toBe(true);
		});
	});

	test('婚姻类别:七宫为事项宫 → strict 不误套「七宫主=占星师」考量', () => {
		const r = buildMockResult();
		const j = runHorary(r, 'marriage', horaryJudgeOpts('strict'));
		expect(j.radicality.warnings.every((w) => w.key !== 'l7_afflicted')).toBe(true);
	});
});

// [Q-146/T-53] 口径改动同步:classic(1647)分支此前直读后端 isVOC 旗,而那面旗是后端按**全局**
// 空亡口径算的 —— 流派绑定 classic(或择日显式选 1647)时判读实际吃全局值。现改为与其余五口径同源,
// 按同一张相位表自算(月对表内星无入相/正合托勒密相位即空)。下面的判别向量随之从「拨旗」改成「改相位表」。
describe('月空 VOC 流派模式', () => {
	// 月有入相(fixture 恒有一条三合土星):自算口径 → 非空。旗仍拨成 true,用来证明「旗不再决定 classic」。
	function vocFixtureFacts(){
		const r = clone(buildMockResult());
		findObj(r, 'Moon').isVOC = true;   // 月巨蟹 7°,后端旗标空(与相位表相反,专为反证)
		return buildFacts(r);
	}
	// 月无任何入相/正合:自算口径 → 空。
	function vocEmptyApplyFacts(){
		const r = clone(buildMockResult());
		findObj(r, 'Moon').isVOC = false;   // 旗标不空,同样不该被 classic 采信
		r.aspects.normalAsp.Moon.Applicative = [];
		r.aspects.normalAsp.Moon.Exact = [];
		return buildFacts(r);
	}
	test('classic:按相位表自算——月有入相 → 不空(后端旗为 true 也不采信)', () => {
		const f = vocFixtureFacts();
		expect(moonReport(f, { vocMode: 'classic' }).voc).toBe(false);
	});
	test('classic:月无任何入相/正合 → 空(后端旗为 false 也不采信)', () => {
		const f = vocEmptyApplyFacts();
		expect(moonReport(f, { vocMode: 'classic' }).voc).toBe(true);
	});
	test('exempt4(中世纪):月落巨蟹(豁免座)且本为空 → 不作空亡', () => {
		const f = vocEmptyApplyFacts();
		const rep = moonReport(f, { vocMode: 'exempt4' });
		expect(rep.voc).toBe(false);
		expect(rep.findings.some((x) => x.key === 'voc_exempt')).toBe(true);
	});
	test('kenodromia(希腊化):月有对七曜入相(三合土星) → 非空', () => {
		const f = vocFixtureFacts();
		expect(moonReport(f, { vocMode: 'kenodromia' }).voc).toBe(false);
	});
	test('相位表缺失(老快照/纯 stub)时回落后端旗:不因取不到表凭空判空', () => {
		const r = clone(buildMockResult());
		findObj(r, 'Moon').isVOC = true;
		delete r.aspects;
		expect(moonReport(buildFacts(r), { vocMode: 'classic' }).voc).toBe(true);
	});
	test('opts 不传 = 字节不变(等价 classic)', () => {
		const f = vocFixtureFacts();
		expect(moonReport(f).voc).toBe(moonReport(f, { vocMode: 'classic' }).voc);
	});
});

describe('可判性 radicality 流派阈值', () => {
	function ascEarlyFacts(){
		const r = clone(buildMockResult());
		const asc = findObj(r, 'Asc'); asc.signlon = 1.0; asc.lon = 1.0;
		// houseMap 一宫头也调早,保证 meta.ascDegree 反映
		r.houseMap.House1.lon = 1.0;
		return buildFacts(r);
	}
	test('classical(warn, 阈值3):命度过早 → 出 asc_early 警告', () => {
		const f = ascEarlyFacts();
		const rad = radicality(f, horaryJudgeOpts('classical'));
		expect(rad.warnings.some((w) => w.key === 'asc_early')).toBe(true);
	});
	test('modern(ignore, 阈值0):不以命度早晚拒判 → 无 asc_early', () => {
		const f = ascEarlyFacts();
		const rad = radicality(f, horaryJudgeOpts('modern'));
		expect(rad.warnings.some((w) => w.key === 'asc_early')).toBe(false);
	});
	test('opts 不传 = 择日既有行为(阈值3,含 asc_early)', () => {
		const f = ascEarlyFacts();
		expect(radicality(f).warnings.some((w) => w.key === 'asc_early')).toBe(true);
	});
});

describe('阿拉伯点 福点昼夜反转', () => {
	test('日盘:反转档与不反转档福点相同(反转仅夜盘生效)', () => {
		const r = buildMockResult();  // isDiurnal:true
		const jC = runHorary(r, 'wealth', horaryJudgeOpts('classical'));
		const jS = runHorary(r, 'wealth', horaryJudgeOpts('strict'));
		expect(jC.lots.fortune.lon).toBeCloseTo(117.1, 1);        // asc+moon-sun
		expect(jS.lots.fortune.lon).toBeCloseTo(jC.lots.fortune.lon, 1);
		expect(jC.lots.reversalApplied).toBe(false);
	});
	test('夜盘:不反转档恒日式；反转档翻公式 → 福点不同座', () => {
		const r = clone(buildMockResult()); r.chart.isDiurnal = false;
		const jC = runHorary(r, 'wealth', horaryJudgeOpts('classical'));  // 不反转 → 117.1(巨蟹)
		const jS = runHorary(r, 'wealth', horaryJudgeOpts('strict'));      // 反转 → asc+sun-moon=272.9(摩羯)
		expect(jC.lots.fortune.lon).toBeCloseTo(117.1, 1);
		expect(jS.lots.fortune.lon).toBeCloseTo(272.9, 1);
		expect(jS.lots.reversalApplied).toBe(true);
		expect(jC.lots.fortune.sign).not.toBe(jS.lots.fortune.sign);
	});
});

describe('完成/破坏 perfection', () => {
	test('月三合土星入相 → 直接完成(application)', () => {
		const f = buildFacts(buildMockResult());
		const perf = analyzePerfection(f, 'moon', 'saturn', { quesitedHouse: 10 });
		expect(perf.perfects).toBe(true);
		expect(perf.method).toBe('application');
	});
	test('lenient(现代)淡化机械截断 → 仍取主完成法', () => {
		const f = buildFacts(buildMockResult());
		const perf = analyzePerfection(f, 'moon', 'saturn', { quesitedHouse: 10, perfectionStrict: 'lenient' });
		expect(perf.perfects).toBe(true);
	});
});

describe('主题深化 topicModule', () => {
	const r = buildMockResult();
	test('诉讼:1宫本方 vs 7宫对方对照', () => {
		const j = runHorary(r, 'lawsuit', horaryJudgeOpts('classical'));
		expect(j.topic).toBeTruthy();
		expect(j.topic.title).toContain('诉讼');
		expect(j.topic.lines.length).toBeGreaterThan(0);
	});
	test('买房:四角(1买方/4标的/7卖方/10成交)', () => {
		const j = runHorary(r, 'property', horaryJudgeOpts('classical'));
		expect(j.topic.title).toContain('买房');
		expect(j.topic.lines.some((l) => l.text.includes('标的'))).toBe(true);
	});
	test('怀孕:5宫子嗣 + 吉星', () => {
		const j = runHorary(r, 'pregnancy', horaryJudgeOpts('classical'));
		expect(j.topic.title).toContain('怀孕');
	});
	test('综合类别无专题深化', () => {
		const j = runHorary(r, 'general', horaryJudgeOpts('classical'));
		expect(j.topic).toBeNull();
	});
});

describe('AI 快照 buildHorarySnapshot 流派同步', () => {
	test('快照含判读流派名 + 阿拉伯点', () => {
		const j = runHorary(buildMockResult(), 'wealth', horaryJudgeOpts('medieval'));
		const snap = buildHorarySnapshot(j);
		expect(snap).toContain('判读流派：中世纪');
		expect(snap).toContain('阿拉伯点');
	});
	test('不同流派 → 快照不同(挂载/导出按所选流派)', () => {
		const jc = runHorary(buildMockResult(), 'wealth', horaryJudgeOpts('classical'));
		const jm = runHorary(buildMockResult(), 'wealth', horaryJudgeOpts('modern'));
		expect(buildHorarySnapshot(jc)).not.toBe(buildHorarySnapshot(jm));
	});
});
