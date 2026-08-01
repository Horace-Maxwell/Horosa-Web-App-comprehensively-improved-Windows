// 「显示与样式」面板开关的接线锁(L2 层)。
//
// 由 2026-07-31 运行时死开关审计落成。那轮在本命盘与十二分盘逐个点了这批开关,盘面与右栏
// 都无变化 —— 但逐个追代码后确认**接线是完整的**:它们改的是空亡口径/燃烧口径/互容口径这类
// 判读参数,只在特定盘相下才产生可见差异(如月亮恰好落在两种空亡口径判定不同的位置)。
// 也就是说,运行时差分对这类开关天然给不出结论:单个星盘证明不了「有没有接线」。
//
// 所以改用静态锁:断言每个开关的 写入端 → 消费端 链路都在。真正断线的那天(有人重构掉
// dispatch、或消费面不再读这个键),这里会红 —— 而界面上你是看不出来的,那正是死开关的定义。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
// 判据必须剥注释:注释里出现键名不等于代码里消费了它(本仓踩过三次「grep 被自写注释骗」)。
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SELECTOR = stripComments(read('components/astro/ChartDisplaySelector.js'));

describe('显示与样式面板:写入端在位', () => {
	const WRITES = [
		{ label: '空亡古典义', key: 'voidClassical', handler: 'changeVoidClassical' },
		{ label: '星曜附带后天宫信息', key: 'showPlanetHouseInfo', handler: 'changeShowPlanetHouseInfo' },
		{ label: '星/宫/座/相释义', key: 'showAstroMeaning', handler: 'changeShowAstroMeaning' },
		{ label: '仅按本垣擢升计算互容接纳', key: 'showOnlyRulExaltReception', handler: 'changeOnlyRulerExaltReception' },
	];

	WRITES.forEach(({ label, key, handler }) => {
		test(`${label}:handler 存在且真的 dispatch 了 ${key}`, () => {
			expect(SELECTOR).toContain(`${handler}(`);
			const body = SELECTOR.slice(SELECTOR.indexOf(`${handler}(`));
			const scoped = body.slice(0, body.indexOf('\n\t}') + 3);
			expect(scoped).toContain('dispatch');
			expect(scoped).toContain(key);
		});
	});

	test('判读级全局(燃烧限同座 / 映点参与判读)走 setDivinationJudgeGlobal 而非 dispatch', () => {
		expect(SELECTOR).toContain('applyJudgeGlobal');
		expect(SELECTOR).toContain('setDivinationJudgeGlobal');
		expect(SELECTOR).toContain("applyJudgeGlobal('combustMitigateSameSign'");
		expect(SELECTOR).toContain("applyJudgeGlobal('antiscia'");
	});
});

describe('显示与样式面板:消费端在位', () => {
	test('空亡古典义进 requestKey(否则相等去重会把重算挡掉,开关就成了死的)', () => {
		const lab = stripComments(read('components/astro/AstroAnalysisLab.js'));
		expect(lab).toContain('voidClassical');
		// requestKey 里必须含 voidClassical:这正是「点了没反应」最隐蔽的成因——
		// 值写进去了、请求也发了,但被 key 相等的去重挡住,界面一动不动。
		expect(/chartRequestKey\([^)]*voidClassical|vc:\$\{[^}]*voidClassical/.test(lab)).toBe(true);
		expect(lab).toContain('voidClassical: !!this.props.voidClassical');
	});

	test('互容接纳口径:app state → localStorage → 速览引擎,三段都在', () => {
		// 键名在途中会换:面板与 app model 叫 showOnlyRulExaltReception,
		// 传进引擎时收敛成 opts.onlyRulExalt。只 grep 其中一个名字会得出反向结论
		// (本测试初版就因此错报了一次「断线」)。三段各按各自的名字断言。
		const app = stripComments(read('models/app.js'));
		expect(app).toContain('showOnlyRulExaltReception');
		// 写进 GlobalSetupKey 才能被下面读 localStorage 的消费面看见
		expect(app).toContain('GlobalSetupKey');

		const lab = stripComments(read('components/astro/AstroAnalysisLab.js'));
		expect(lab).toContain('showOnlyRulExaltReception');
		expect(lab).toContain('onlyRulExalt');

		const overview = stripComments(read('utils/astroPatternOverview.js'));
		expect(overview).toContain('opts.onlyRulExalt');
	});

	test('判读级全局有默认表与读取口', () => {
		const globals = stripComments(read('utils/divinationJudgeGlobals.js'));
		expect(globals).toContain('combustMitigateSameSign');
		expect(globals).toContain('antiscia');
		expect(globals).toContain('setDivinationJudgeGlobal');
	});

	test('空亡古典义同口径透传进 AI 快照(右栏与报告不能各说各话)', () => {
		const ctx = stripComments(read('utils/aiAnalysisContext.js'));
		expect(ctx).toContain('voidClassical');
	});

	test('app model 里有 voidClassical 的默认值锚(缺省=按本座义,零回归)', () => {
		const app = stripComments(read('models/app.js'));
		expect(/voidClassical\s*:\s*0/.test(app)).toBe(true);
	});
});
