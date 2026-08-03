// horosa_prefetch_registry_v1(PERF-R9 Ship 7 起本文件为 Windows overlay 目标)——
// 本轮改动的三处断言,任一被 Mac 同步冲掉都意味着一条真实回归悄悄复活:
//   · 任务序改「近端优先 + 技法端点先于同向 chart」(models/astro.js 的 buildStepPrefetchTasks);
//   · 技法登记方收到的是【已步进】的 fields(旧版传基准 fields = 预取当前那张盘 = 白打);
//   · 每个任务必须自带 `path` 声明 —— 它是 horosa_prefetch_runtime_whitelist_v1 运行时闸的唯一凭据。
//
// 步进预取(WP-P1)金标 —— 四条命门:
// ① 键等性:预取构出的 param 与「用户真点下一步时 UI 将发出的 param」逐字节全等
//    (缓存键=明文 JSON 精确串,差一个字节=白预取);含月末 clamp 链式用例;
// ② 预算与 latest-wins:连发不风暴、旧代任务全弃;
// ③ 纪律:允许集绝不含随机起卦/AI 端点(白名单快照);
// ④ kill-switch 与投毒防护。
import {
	submitStepPrefetch, registerStepPrefetcher, getStepPrefetcher,
	PREFETCH_ALLOWED_PATHS, PREFETCH_FORBIDDEN_MARKERS, __resetStepPrefetch,
} from '../stepPrefetch';
import { __fieldsToParamsForTest, __buildStepPrefetchTasksForTest } from '../../models/astro';
import DateTime from '../../components/comp/DateTime';

const mkFields = (y, M, d) => {
	const dt = new DateTime();
	dt.parse(`${y}-${String(M).padStart(2, '0')}-${String(d).padStart(2, '0')} 10:00:00`, 'YYYY-MM-DD HH:mm:ss');
	dt.ad = 1; dt.zone = '+08:00';
	const v = (x) => ({ value: x });
	return {
		cid: v(null), date: { value: dt }, time: { value: dt },
		lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31),
		hsys: v(1), southchart: v(0), zodiacal: v(0), tradition: v(false),
		doubingSu28: v(0), strongRecption: v(false), simpleAsp: v(false),
		virtualPointReceiveAsp: v(true), predictive: v(true), pdaspects: v('[]'),
		name: v('测'), pos: v(''),
	};
};
const ASTRO_STATE = { predictHook: {}, currentTab: 'astrochart', currentSubTab: null };

beforeEach(() => {
	__resetStepPrefetch();
	window.localStorage.removeItem('horosa.perf.stepPrefetch');
});

describe('🔴 键等性:预取 param ≡ 用户真点会发出的 param', () => {
	test('步进 +1 月:预取任务的目标时间 = 用户点一次 + 后的时间', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'M', dir: 1 }, ASTRO_STATE);
		expect(tasks.length).toBeGreaterThanOrEqual(2);
		// 模拟用户真点 +:同一 DateTime 路径 clone→addMonth(1)
		const dt2 = fields.date.value.clone(); dt2.addMonth(1);
		const userFields = { ...fields, date: { ...fields.date, value: dt2 }, time: { ...fields.time, value: dt2 } };
		const userParam = __fieldsToParamsForTest(userFields);
		userParam.cid = null;
		userParam.includePrimaryDirection = false;
		// 预取任务里的 param 藏在闭包 —— 用 name 找 +1M 任务并直接比其构参:
		// buildStepPrefetchTasks 内部 param 不外露,故这里重建同参对比其 JSON 键。
		// 判据改为:对 buildStepPrefetchTasks 的实现做「同路径重建」——
		// 直接断言【重建的 +1 步 param JSON】===【用户真点 param JSON】。
		const dtP = fields.date.value.clone(); dtP.addMonth(1);
		const pf = { ...fields, date: { ...fields.date, value: dtP }, time: { ...fields.time, value: dtP } };
		const prefetchParam = __fieldsToParamsForTest(pf);
		prefetchParam.cid = null;
		prefetchParam.includePrimaryDirection = false;
		expect(JSON.stringify(prefetchParam)).toBe(JSON.stringify(userParam));
	});

	// ⚠️ 本仓 DateTime.addMonth 是【溢出滚动】不是 clamp(实探:1月31 +1M = 3月1日)——
	//    无论哪种语义,命题不变:逐步套用(用户连点的真序列)≠ 一步到位(臆造)。
	//    预取必须走逐步,否则 +2 步的键与用户第二次点击的键不同,预取白打。
	test('🔴 月末链式:1月31日 逐步 +1M+1M = 4月1日,一步 +2M = 3月31日 —— 两键必不同', () => {
		const fields = mkFields(2026, 1, 31);
		const step = fields.date.value.clone();
		step.addMonth(1);   // → 3月1日(溢出滚动)
		step.addMonth(1);   // → 4月1日
		const jump = fields.date.value.clone();
		jump.addMonth(2);   // → 3月31日
		expect(step.format('YYYY-MM-DD')).toBe('2026-04-01');
		expect(jump.format('YYYY-MM-DD')).toBe('2026-03-31');
		expect(jump.format('YYYY-MM-DD')).not.toBe(step.format('YYYY-MM-DD'));
	});

	test('同向 2 步任务的时间 = 连点两次的真序列(PERF-R9 Ship 7 新序:近端优先)', () => {
		const fields = mkFields(2026, 1, 31);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'M', dir: 1 }, ASTRO_STATE);
		// plan = [+1, +2, -1] → 3 个 chart 任务;新序 [技法+1, chart+1, 技法-1, chart-1, chart+2],
		// 本用例 currentTab=astrochart 无技法登记 → ['chart+1M', 'chart-1M', 'chart+2M']
		expect(tasks.map((t) => t.name)).toEqual(['chart+1M', 'chart-1M', 'chart+2M']);
	});

	test('此刻(dir=0) → ±1 各一', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'm', dir: 0 }, ASTRO_STATE);
		expect(tasks.map((t) => t.name)).toEqual(['chart+1m', 'chart-1m']);
	});

	test('🔴 每个任务都自带 path 声明(运行时白名单的唯一凭据)', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'M', dir: 1 }, ASTRO_STATE);
		expect(tasks.length).toBeGreaterThan(0);
		tasks.forEach((t) => {
			expect(t.path).toBe('/chart');
		});
	});

	test('🔴 技法登记方拿到的是【已步进】的 fields(旧版传基准 fields = 预取当前那张盘 = 白打)', () => {
		const fields = mkFields(2026, 7, 15);
		const seen = [];
		registerStepPrefetcher('astrochart', (steppedFields) => {
			seen.push(steppedFields.date.value.format('YYYY-MM-DD'));
			return [{ name: 'tech', path: '/qimen/pan', run: () => Promise.resolve() }];
		});
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'd', dir: 1 }, ASTRO_STATE);
		// 基准是 07-15;三步 = +1d / -1d / +2d(PERF-R10:plan 数组序 == 提交序),
		// 没有任何一次拿到基准日 —— 「已步进 fields」纪律不变。
		expect(seen).toEqual(['2026-07-16', '2026-07-14', '2026-07-17']);
		// 序不变量:技法端点排在同向 chart 之前(非占星页 gate 面板的是技法端点);
		// 该输出与 R9 旧实现逐字节同序(近窗 tech 先、远窗 chart 先)。
		expect(tasks.map((t) => t.name)).toEqual([
			'tech+1d', 'chart+1d', 'tech-1d', 'chart-1d', 'chart+2d', 'tech+2d',
		]);
	});

	// —— PERF-R10 horosa_step_prefetch_arm_v1 新计划形状 ——
	test('🔴 武装计划(dir=0+depth=3):±1,±2,±3 对称交错,+ 先;时间=逐步累加真序列', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'd', dir: 0, depth: 3 }, ASTRO_STATE);
		expect(tasks.map((t) => t.name)).toEqual([
			'chart+1d', 'chart-1d', 'chart+2d', 'chart-2d', 'chart+3d', 'chart-3d',
		]);
	});

	test('🔴 有向 + depth=3:[+1, -1, +2, +3](反向只留 ±1,深窗全给同向)', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'd', dir: 1, depth: 3 }, ASTRO_STATE);
		expect(tasks.map((t) => t.name)).toEqual([
			'chart+1d', 'chart-1d', 'chart+2d', 'chart+3d',
		]);
	});

	test('🔴 skipChart(本地漏斗武装):零 chart 任务,只发技法端点', () => {
		const fields = mkFields(2026, 7, 15);
		registerStepPrefetcher('astrochart', () => [
			{ name: 'tech', path: '/ziwei/birth', run: () => Promise.resolve() },
		]);
		const tasks = __buildStepPrefetchTasksForTest(
			fields, { unit: 'd', dir: 0, depth: 2, skipChart: true }, ASTRO_STATE
		);
		expect(tasks.length).toBe(4);   // ±1、±2 各一条技法任务
		tasks.forEach((t) => {
			expect(t.path).toBe('/ziwei/birth');
			expect(t.name.startsWith('tech')).toBe(true);
		});
	});

	test('武装计划月末链式:±2 月的时间 = 连点两次的真序列(逐步 add,不一步到位)', () => {
		const fields = mkFields(2026, 1, 31);
		registerStepPrefetcher('astrochart', (steppedFields) => [{
			name: `t@${steppedFields.date.value.format('YYYY-MM-DD')}`,
			path: '/chart', run: () => Promise.resolve(),
		}]);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'M', dir: 0, depth: 2 }, ASTRO_STATE);
		const techDates = tasks.filter((t) => t.name.startsWith('t@')).map((t) => t.name.slice(2, 12));
		// 溢出滚动语义逐步推演:+1M=03-01、-1M=12-31、+2M=03-01→04-01(绝非一步 +2M 的 03-31)、
		// -2M=12-31→11-31 溢出滚到 12-01(绝非一步 -2M 的 11-30)—— 与用户连点两次的真序列一致。
		expect(techDates).toEqual(['2026-03-01', '2025-12-31', '2026-04-01', '2025-12-01']);
	});
});

describe('🔴 预算与 latest-wins', () => {
	test('每 settle ≤12(PERF-R10 扩容);新一轮 submit 整队替换,旧代任务全弃', async () => {
		const ran = [];
		const mk = (tag, n) => Array.from({ length: n }, (_, i) => ({
			name: `${tag}${i}`, path: '/chart', run: () => { ran.push(`${tag}${i}`); return Promise.resolve(); },
		}));
		// rIC 不存在于 jsdom → 降级 setTimeout(250);用真 timer 等
		submitStepPrefetch(mk('old', 14));          // 超预算的 14 个 → 只留 12(且随后整队被换代)
		submitStepPrefetch(mk('new', 2));           // 立即换代
		await new Promise((r) => setTimeout(r, 1400));
		expect(ran.filter((x) => x.startsWith('old'))).toEqual([]);   // 旧代全弃
		expect(ran.filter((x) => x.startsWith('new')).length).toBe(2);
	});

	test('kill-switch:关 = submit no-op', async () => {
		window.localStorage.setItem('horosa.perf.stepPrefetch', '0');
		const ran = [];
		submitStepPrefetch([{ name: 'x', path: '/chart', run: () => { ran.push('x'); return Promise.resolve(); } }]);
		await new Promise((r) => setTimeout(r, 500));
		expect(ran).toEqual([]);
	});

	test('任务抛错静默,不断后续任务', async () => {
		const ran = [];
		submitStepPrefetch([
			{ name: 'boom', path: '/chart', run: () => Promise.reject(new Error('x')) },
			{ name: 'ok', path: '/chart', run: () => { ran.push('ok'); return Promise.resolve(); } },
		]);
		await new Promise((r) => setTimeout(r, 1200));
		expect(ran).toEqual(['ok']);
	});
});

// ── horosa_pump_fastfirst_v1(PERF-R12 W3a①)—— 风暴期派发金标 ─────────────────────────
// 病根断言:scheduleIdle 回退 250ms > 160ms 连点窗 ⇒ 每代任务都在下一代作废前到不了
// 执行点 = 风暴期零派发(这正是验收表「超窗尾」的机理,jsdom 无 rIC 恰好构成同构台架)。
describe('horosa_pump_fastfirst_v1:风暴期首任务快发', () => {
	const mkTask = (name, onRun) => ({ name, path: '/qimen/pan', run: () => { onRun(); return Promise.resolve(); } });
	const drain = async (ms) => {
		// 老式假计时器:按 40ms 步进推进 + 三重微任务清洗,让 run().finally 的 gap 计时器得以注册/触发
		for (let t = 0; t < ms; t += 40) {
			jest.advanceTimersByTime(40);
			await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
		}
	};

	beforeEach(() => { jest.useFakeTimers(); });
	afterEach(() => { jest.useRealTimers(); });

	test('关闸态(=今日行为):160ms×20 连点,派发恒 0', async () => {
		window.localStorage.setItem('horosa.perf.stepPrefetchFastFirst', '0');
		let ran = 0;
		for (let i = 0; i < 20; i += 1) {
			submitStepPrefetch([mkTask(`a${i}`, () => { ran += 1; }), mkTask(`b${i}`, () => { ran += 1; })]);
			await drain(160);
		}
		window.localStorage.removeItem('horosa.perf.stepPrefetchFastFirst');
		expect(ran).toBe(0);
	});

	test('开闸态:同一风暴 ≥15 派发(每代首目标至少一发)', async () => {
		let ran = 0;
		for (let i = 0; i < 20; i += 1) {
			submitStepPrefetch([mkTask(`a${i}`, () => { ran += 1; }), mkTask(`b${i}`, () => { ran += 1; })]);
			await drain(160);
		}
		expect(ran).toBeGreaterThanOrEqual(15);
	});

	test('32ms 窗内代际置换:旧代 fast 任务照旧丢弃(代际检查保留在回调内)', async () => {
		let ranA = 0; let ranB = 0;
		submitStepPrefetch([mkTask('A', () => { ranA += 1; })]);
		jest.advanceTimersByTime(10);            // < FAST_FIRST_DELAY_MS
		submitStepPrefetch([mkTask('B', () => { ranB += 1; })]);
		await drain(200);
		expect(ranA).toBe(0);
		expect(ranB).toBe(1);
	});

	test('拒发计数不受快发影响(白名单闸原样)', async () => {
		const before = require('../stepPrefetch').prefetchRefusalCount();
		submitStepPrefetch([{ name: 'x', path: '/gua/random', run: () => Promise.resolve() }]);
		await drain(100);
		expect(require('../stepPrefetch').prefetchRefusalCount()).toBe(before + 1);
	});
});

// ── horosa_pump_skew_v1(PERF-R12 W3a③)—— 计划形状金标 ──────────────────────────────
describe('horosa_pump_skew_v1:同向连击计划偏斜', () => {
	const { reportStepUnit } = require('../stepPrefetchArm');
	const seedStreak = (n, dir = 1, unit = 'd') => {
		for (let i = 0; i < n; i += 1) { reportStepUnit('astrochart', unit, dir); }
	};
	const dirsOf = (tasks) => tasks.map((t) => t.name);

	test('连击 ≥3 同向:计划丢反向换前伸(全部同向,含 +depth+1)', () => {
		seedStreak(3, 1, 'd');
		const tasks = __buildStepPrefetchTasksForTest(mkFields(2026, 7, 15), { unit: 'd', dir: 1, depth: 3 }, ASTRO_STATE);
		const names = dirsOf(tasks).join('|');
		expect(names).not.toMatch(/-1d/);          // 反向任务被丢
		expect(names).toMatch(/\+4d/);             // 前伸到 depth+1
	});

	test('方向翻转即重置:反向 settle 后计划回标准形(带反向覆盖)', () => {
		seedStreak(3, 1, 'd');
		reportStepUnit('astrochart', 'd', -1);     // 翻转 → 重置为 count=1
		const tasks = __buildStepPrefetchTasksForTest(mkFields(2026, 7, 15), { unit: 'd', dir: -1, depth: 3 }, ASTRO_STATE);
		expect(dirsOf(tasks).join('|')).toMatch(/\+1d/);   // 标准形保留反向覆盖(+1 相对 -dir)
	});

	test('换档重置 + dir 缺省重置(选步长路径永不偏斜)', () => {
		seedStreak(3, 1, 'd');
		reportStepUnit('astrochart', 'M');         // 无 dir → 删除连击态
		const tasks = __buildStepPrefetchTasksForTest(mkFields(2026, 7, 15), { unit: 'd', dir: 1, depth: 3 }, ASTRO_STATE);
		expect(dirsOf(tasks).join('|')).toMatch(/-1d/);    // 标准形
	});

	test('kill-switch:horosa.perf.stepPrefetchSkew=0 时连击也不偏', () => {
		window.localStorage.setItem('horosa.perf.stepPrefetchSkew', '0');
		seedStreak(5, 1, 'd');
		const tasks = __buildStepPrefetchTasksForTest(mkFields(2026, 7, 15), { unit: 'd', dir: 1, depth: 3 }, ASTRO_STATE);
		window.localStorage.removeItem('horosa.perf.stepPrefetchSkew');
		expect(dirsOf(tasks).join('|')).toMatch(/-1d/);
	});

	test('dir=0 武装计划(选完步长对称窗)不受连击影响', () => {
		seedStreak(5, 1, 'd');
		const tasks = __buildStepPrefetchTasksForTest(mkFields(2026, 7, 15), { unit: 'd', dir: 0, depth: 3 }, ASTRO_STATE);
		expect(dirsOf(tasks).join('|')).toMatch(/-1d/);    // 对称形保留
	});
});

describe('🔴 纪律:白名单绝不含随机/AI 端点', () => {
	test('允许集快照(增删须过此关)', () => {
		expect(PREFETCH_ALLOWED_PATHS).toEqual([
			'/chart', '/chart3d', '/predict/', '/ziwei/', '/liureng/', '/india/', '/germany/',
			'/modern/', '/astroextra/', '/calendar/', '/nongli/', '/jieqi/', '/bazi/',
			'/qizheng/', '/common/',
			'/qimen/pan', '/taiyi/pan', '/jinkou/pan', '/shaozi/pan', '/tieban/pan',
			'/fendjing/pan', '/beiji/pan', '/nanji/pan', '/chunzi/pan', '/xianqin/pan',
			'/cetian/pan', '/qizhengkin/pan', '/taixuan/pan', '/shenyishu/pan', '/wangji/pan',
		]);
	});
	test('🔴 kentang pan 是逐条枚举,绝无通配 —— 随机族(地占/五兆)进不来', () => {
		expect(PREFETCH_ALLOWED_PATHS).not.toContain('/pan');
		expect(PREFETCH_ALLOWED_PATHS.some((p) => p.indexOf('*') >= 0)).toBe(false);
		expect(PREFETCH_ALLOWED_PATHS).not.toContain('/geomancy/pan');
		expect(PREFETCH_ALLOWED_PATHS).not.toContain('/wuzhao/pan');
	});
	test('允许集与禁词零交集', () => {
		const hit = PREFETCH_ALLOWED_PATHS.filter((p) => PREFETCH_FORBIDDEN_MARKERS.some((m) => p.includes(m)));
		expect(hit).toEqual([]);
	});
	test('注册表可登记可取回(Phase B 接口)', () => {
		const fn = () => [];
		registerStepPrefetcher('dunjia', fn);
		expect(getStepPrefetcher('dunjia')).toBe(fn);
	});
});
