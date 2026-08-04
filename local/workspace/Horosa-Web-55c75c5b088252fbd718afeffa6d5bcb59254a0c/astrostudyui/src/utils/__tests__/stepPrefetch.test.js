// 步进预取(WP-P1)金标 —— 四条命门:
// ① 键等性:预取构出的 param 与「用户真点下一步时 UI 将发出的 param」逐字节全等
//    (缓存键=明文 JSON 精确串,差一个字节=白预取);含月末 clamp 链式用例;
// ② 预算与 latest-wins:连发不风暴、旧代任务全弃;
// ③ 纪律:允许集绝不含随机起卦/AI 端点(白名单快照);
// ④ kill-switch 与投毒防护。
import {
	submitStepPrefetch, registerStepPrefetcher, unregisterStepPrefetcher, getStepPrefetcher,
	PREFETCH_ALLOWED_PATHS, PREFETCH_FORBIDDEN_MARKERS, __resetStepPrefetch,
	isPrefetchPathAllowed, guardPrefetchUrl, prefetchRefusalCount, normalizePrefetchPath,
} from '../stepPrefetch';
import { getPerfCoverageKentang } from '../perfCoverageManifest';
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

	test('同向 2 步任务的时间 = 连点两次的真序列', () => {
		const fields = mkFields(2026, 1, 31);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'M', dir: 1 }, ASTRO_STATE);
		// R4-B2 定序变化(落账):plan [+1,+2,-1] → [+1,-1,+2] —— 反向 ±1(拨过头往回,高频)
		// 提级到同向 +2(连点第三下,较低频)之前;±1 双向即时命中,远窗吃空闲。
		expect(tasks.map((t) => t.name)).toEqual(['chart+1M', 'chart-1M', 'chart+2M']);
	});

	test('R4-B2 武装计划:dir=0+depth=3 → ±1..±3 对称交错 6 任务', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'd', dir: 0, depth: 3 }, ASTRO_STATE);
		expect(tasks.map((t) => t.name)).toEqual(['chart+1d', 'chart-1d', 'chart+2d', 'chart-2d', 'chart+3d', 'chart-3d']);
	});

	test('R4-B2 skipChart:本地漏斗武装只出技法端点(chart 占位不发)', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'd', dir: 0, depth: 2, skipChart: true }, ASTRO_STATE);
		expect(tasks).toEqual([]);   // 无登记方时零任务(chart 全占位)
	});

	test('🔴 R4-B2 登记方拿到的是【步进后的 f2】而非基准 fields(旧版 bug 勘正)', () => {
		const fields = mkFields(2026, 7, 15);
		const seen = [];
		registerStepPrefetcher('astrochart', (steppedFields) => {
			seen.push(steppedFields.date.value.format('YYYY-MM-DD'));
			return [];
		});
		__buildStepPrefetchTasksForTest(fields, { unit: 'd', dir: 0, depth: 1 }, ASTRO_STATE);
		expect(seen).toEqual(['2026-07-16', '2026-07-14']);   // ±1 天,不是两个「7-15 此刻」
		unregisterStepPrefetcher('astrochart', getStepPrefetcher('astrochart'));
	});

	test('此刻(dir=0) → ±1 各一', () => {
		const fields = mkFields(2026, 7, 15);
		const tasks = __buildStepPrefetchTasksForTest(fields, { unit: 'm', dir: 0 }, ASTRO_STATE);
		expect(tasks.map((t) => t.name)).toEqual(['chart+1m', 'chart-1m']);
	});
});

describe('🔴 预算与 latest-wins', () => {
	// R4-B1 行为变化点(落账):任务契约加 path 过运行时白名单;缺省预算 3→12。
	test('缺省预算 ≤12;新一轮 submit 整队替换,旧代任务全弃', async () => {
		const ran = [];
		const mk = (tag, n) => Array.from({ length: n }, (_, i) => ({
			name: `${tag}${i}`, path: '/chart', run: () => { ran.push(`${tag}${i}`); return Promise.resolve(); },
		}));
		// rIC 不存在于 jsdom → 降级 setTimeout(250);用真 timer 等
		submitStepPrefetch(mk('old', 14));          // 超预算的 14 个 → 只留 12
		submitStepPrefetch(mk('new', 2));           // 立即换代
		await new Promise((r) => setTimeout(r, 1400));
		expect(ran.filter((x) => x.startsWith('old'))).toEqual([]);   // 旧代全弃
		expect(ran.filter((x) => x.startsWith('new')).length).toBe(2);
	});

	test('显式 budget 仍硬顶 5(R3-A1 上游语义保持)', async () => {
		const ran = [];
		const mk = (n) => Array.from({ length: n }, (_, i) => ({
			name: `t${i}`, path: '/chart', run: () => { ran.push(i); return Promise.resolve(); },
		}));
		submitStepPrefetch(mk(9), { budget: 9 });
		await new Promise((r) => setTimeout(r, 2600));
		expect(ran.length).toBe(5);
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

	// horosa_prefetch_pump_livelock_v1(R4-B1,实测「20 连点 0 派发」病灶):
	// 连点=每 ~300ms 一次 settle→submit 换代。旧泵一拍只处理一个 entry(拍到时多是旧代,
	// 丢弃即耗掉整拍)⇒ 稳态颗粒无收。新泵一拍内丢净旧代、就地执行当代任务。
	// 硬指标:20 连点期间派发 ≥15。
	test('🔴 连点泵保底:20 次连点 submit 期间派发 ≥15', async () => {
		let ran = 0;
		const mk = () => [
			{ name: 'a', path: '/chart', run: () => { ran += 1; return Promise.resolve(); } },
			{ name: 'b', path: '/chart', run: () => { ran += 1; return Promise.resolve(); } },
		];
		for(let i = 0; i < 20; i += 1){
			submitStepPrefetch(mk());
			// eslint-disable-next-line no-await-in-loop
			await new Promise((r) => setTimeout(r, 300));
		}
		await new Promise((r) => setTimeout(r, 800));
		expect(ran).toBeGreaterThanOrEqual(15);
	});
});

describe('🔴 纪律:白名单绝不含随机/AI 端点', () => {
	// R4-B1 快照更新(落账):枚举扩容 —— 裸 '/pan'(匹配不到任何真实路径,形同虚设)删除,
	// 改为 kentang deterministic 15 条逐条枚举 + 通用计算端点族 + /bazi 精确条目。
	test('允许集快照(增删须过此关)', () => {
		expect(PREFETCH_ALLOWED_PATHS).toEqual([
			// [Windows-only] '/chart3d':3D 星盘状态路由(v3.5.0 起),AstroChartMain3D 步进预取
			// 声明它;上游列表无此路由,Windows 补位(requestDedupe 落桶同款一行)。
			'/chart', '/chart3d', '/predict/', '/ziwei/', '/liureng/',
			'/india/', '/germany/', '/modern/', '/astroextra/', '/nongli/', '/jieqi/',
			'/bazi/birth', '/bazi/direct',
			'/qimen/pan', '/taiyi/pan', '/jinkou/pan', '/wangji/pan', '/wuzhao/pan',
			'/shenyishu/pan', '/shaozi/pan', '/tieban/pan', '/fendjing/pan', '/beiji/pan',
			'/nanji/pan', '/chunzi/pan', '/xianqin/pan', '/cetian/pan', '/qizhengkin/pan',
		]);
	});
	test('允许集与禁词零交集', () => {
		const hit = PREFETCH_ALLOWED_PATHS.filter((p) => PREFETCH_FORBIDDEN_MARKERS.some((m) => p.includes(m)));
		expect(hit).toEqual([]);
	});
	test('🔴 kentang 枚举 ≡ 政策表 deterministic 集(单一真值源对拍,漏登/多登皆红)', () => {
		const modules = getPerfCoverageKentang();
		const deterministic = Object.keys(modules)
			.filter((k) => modules[k].policy === 'deterministic')
			// 区间扫描型(qizhengelection/electionscan)无步进语义且不走 /{key}/pan 形态,不进步进白名单
			.filter((k) => k !== 'qizhengelection' && k !== 'electionscan')
			.map((k) => `/${k}/pan`)
			.sort();
		const enumerated = PREFETCH_ALLOWED_PATHS.filter((p) => p.endsWith('/pan')).sort();
		expect(enumerated).toEqual(deterministic);
		// seedInBody 族(预取即钉死起课)绝不在允许集,且在禁词里
		['taixuan', 'jingjue', 'geomancy'].forEach((k) => {
			expect(modules[k].policy).toBe('seedInBody');
			expect(PREFETCH_ALLOWED_PATHS).not.toContain(`/${k}/pan`);
			expect(isPrefetchPathAllowed(`/${k}/pan`)).toBe(false);
		});
	});
	test('isPrefetchPathAllowed:正反面(禁词优先/前缀锚定/带 host 与 query 归一)', () => {
		expect(isPrefetchPathAllowed('/chart')).toBe(true);
		expect(isPrefetchPathAllowed('http://127.0.0.1:9999/chart?x=1')).toBe(true);
		expect(isPrefetchPathAllowed('/qimen/pan')).toBe(true);
		expect(isPrefetchPathAllowed('/predict/dice')).toBe(false);      // 禁词优先
		expect(isPrefetchPathAllowed('/geomancy/pan')).toBe(false);
		expect(isPrefetchPathAllowed('/aianalysis/stream')).toBe(false);
		expect(isPrefetchPathAllowed('/heartbeat')).toBe(false);
		expect(isPrefetchPathAllowed('/bazi/pattern/update')).toBe(false); // 精确条目外的 /bazi/ 族
		expect(isPrefetchPathAllowed('')).toBe(false);
		expect(normalizePrefetchPath('https://h.com/qimen/pan#f')).toBe('/qimen/pan');
	});
	test('🔴 运行时闸:白名单外任务提交即丢弃并计数;guardPrefetchUrl 非预取作用域恒放行', async () => {
		const before = prefetchRefusalCount();
		const ran = [];
		submitStepPrefetch([
			{ name: 'evil', path: '/geomancy/pan', run: () => { ran.push('evil'); return Promise.resolve(); } },
			{ name: 'nopath', run: () => { ran.push('nopath'); return Promise.resolve(); } },
			{ name: 'ok', path: '/chart', run: () => { ran.push('ok'); return Promise.resolve(); } },
		]);
		await new Promise((r) => setTimeout(r, 900));
		expect(ran).toEqual(['ok']);
		expect(prefetchRefusalCount() - before).toBe(2);
		// 非预取作用域(用户真实请求):恒放行,零影响
		expect(guardPrefetchUrl('/aianalysis/stream')).toBe(true);
	});
	test('注册表可登记可取回可反注册(Phase B 接口)', () => {
		const fn = () => [];
		registerStepPrefetcher('dunjia', fn);
		expect(getStepPrefetcher('dunjia')).toBe(fn);
		unregisterStepPrefetcher('dunjia', fn);
		expect(getStepPrefetcher('dunjia')).toBe(undefined);
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

	// (v3.7.1 重钉:上游 horosa_prefetch_pump_livelock_v1[排干旧代+500ms 保底]落地后,关闸态
	//  不再是「风暴期零派发」—— 那正是上游修掉的病。fast-first 的分辨力契约改钉【首发延迟】:
	//  关=首拍等 rIC 降级 250ms(jsdom),40ms 窗内必无派发;开=32ms 让帧即发。)
	test('关闸态:submit 后 40ms 窗内零派发(首拍仍等空闲降级档)', async () => {
		window.localStorage.setItem('horosa.perf.stepPrefetchFastFirst', '0');
		let ran = 0;
		submitStepPrefetch([mkTask('a', () => { ran += 1; }), mkTask('b', () => { ran += 1; })]);
		await drain(40);
		const at40 = ran;
		await drain(400);
		window.localStorage.removeItem('horosa.perf.stepPrefetchFastFirst');
		expect(at40).toBe(0);                       // 40ms 内没发(无 fast-first)
		expect(ran).toBeGreaterThanOrEqual(1);      // 但 livelock 修保底,稍后必发(不再饿死)
	});

	test('开闸态:submit 后 40ms 窗内首任务已派发(32ms 让帧)', async () => {
		let ran = 0;
		submitStepPrefetch([mkTask('a', () => { ran += 1; }), mkTask('b', () => { ran += 1; })]);
		await drain(40);
		expect(ran).toBeGreaterThanOrEqual(1);
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
