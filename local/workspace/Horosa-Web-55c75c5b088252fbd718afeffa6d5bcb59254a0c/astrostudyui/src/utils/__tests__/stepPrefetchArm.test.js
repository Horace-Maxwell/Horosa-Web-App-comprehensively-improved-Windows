// horosa_step_prefetch_arm_v1 金标(PERF-R10 Ship2)——「选步长即武装」的契约:
//   ① 选步长恰好武装一次,单位/深度正确,任务经 submitStepPrefetch(白名单闸照走);
//   ② NO_ARM_TABS(随机/取现时/流式/浏览型)零任务;
//   ③ 旁路时间条(selectorDatetime 与主盘不同分钟)零任务 —— moira 流年/案例编辑不武装主盘;
//   ④ depth=0 / kill-switch 关 → 零任务;
//   ⑤ settle 单位记忆:reportStepUnit 后 currentStepUnit 按技法返回,未知技法回退 'm'。
import {
	registerArmPlanBuilder, armStepPrefetch, notifyStepUnitSelected,
	reportStepUnit, currentStepUnit, shouldArmForTab, armStats, __resetStepPrefetchArm,
} from '../stepPrefetchArm';
import { __resetStepPrefetch, prefetchRefusalCount } from '../stepPrefetch';
import { setGlobalStore } from '../storageutil';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 极简 DateTime 桩:武装模块只用 clone/format(比较分钟)——真实构参在 planBuilder 里,
// 本套件用注入的 builder 谱式隔离(构参正确性由 stepPrefetch.test.js 的真 builder 金标覆盖)。
const mkDt = (stamp) => ({
	stamp,
	clone(){ return mkDt(this.stamp); },
	format(){ return this.stamp; },
});

const storeWith = (tab, stamp) => setGlobalStore({
	astro: {
		currentTab: tab,
		fields: { date: { value: mkDt(stamp || '202607211200') }, time: { value: mkDt(stamp || '202607211200') } },
	},
});

beforeEach(() => {
	__resetStepPrefetch();
	__resetStepPrefetchArm();
	window.localStorage.removeItem('horosa.perf.stepPrefetch');
	window.localStorage.removeItem('horosa.perf.stepPrefetchArm');
	window.localStorage.removeItem('horosa.perf.stepPrefetchDepth');
});

test('🔴 选步长 → 恰好一次武装:hint={unit,dir:0,depth=3},任务真进泵(白名单内照跑)', async () => {
	const calls = [];
	const ran = [];
	registerArmPlanBuilder((fields, hint) => {
		calls.push(hint);
		return [{ name: 'armed', path: '/chart', run: () => { ran.push('armed'); return Promise.resolve(); } }];
	});
	storeWith('astrochart');
	const n = notifyStepUnitSelected('d', mkDt('202607211200'));
	expect(n).toBe(1);
	expect(calls.length).toBe(1);
	expect(calls[0]).toMatchObject({ unit: 'd', dir: 0, depth: 3 });
	expect(armStats().arms).toBe(1);
	expect(armStats().lastReason).toBe('unit-select');
	await wait(900);
	expect(ran).toEqual(['armed']);   // 提交走 submitStepPrefetch,泵真的跑了
});

test('🔴 武装任务同样受运行时白名单约束(禁端点被丢弃并计数)', async () => {
	registerArmPlanBuilder(() => [
		{ name: 'bad', path: '/geomancy/pan', run: () => Promise.resolve() },
	]);
	storeWith('astrochart');
	const before = prefetchRefusalCount();
	armStepPrefetch('settle', {});
	await wait(600);
	expect(prefetchRefusalCount() - before).toBe(1);   // 武装不是白名单的后门
});

test('🔴 NO_ARM_TABS:随机/取现时/流式/浏览型技法零武装', () => {
	const calls = [];
	registerArmPlanBuilder((f, h) => { calls.push(h); return [{ name: 'x', path: '/chart', run: () => Promise.resolve() }]; });
	['guazhan', 'planetarium', 'aianalysis', 'astrodata', 'xuanshi'].forEach((tab) => {
		storeWith(tab);
		expect(armStepPrefetch('tab-activate', {})).toBe(0);
	});
	expect(calls.length).toBe(0);
	expect(shouldArmForTab('guazhan')).toBe(false);
	expect(shouldArmForTab('ziwei')).toBe(true);
});

test('🔴 旁路时间条语境闸:selectorDatetime 与主盘不同分钟 → 零武装;同分钟 → 武装', () => {
	const calls = [];
	registerArmPlanBuilder((f, h) => { calls.push(h); return [{ name: 'x', path: '/chart', run: () => Promise.resolve() }]; });
	storeWith('guolao', '202607211200');
	expect(notifyStepUnitSelected('y', mkDt('209901010000'))).toBe(0);   // moira 流年时间条
	expect(calls.length).toBe(0);
	expect(notifyStepUnitSelected('y', mkDt('202607211200'))).toBe(1);   // 主盘时间条
	expect(calls.length).toBe(1);
});

test('depth=0 与 kill-switch 关 → 零武装;深度开关值进 hint', () => {
	const calls = [];
	registerArmPlanBuilder((f, h) => { calls.push(h); return [{ name: 'x', path: '/chart', run: () => Promise.resolve() }]; });
	storeWith('astrochart');
	window.localStorage.setItem('horosa.perf.stepPrefetchDepth', '0');
	expect(armStepPrefetch('settle', {})).toBe(0);
	window.localStorage.setItem('horosa.perf.stepPrefetchDepth', '2');
	expect(armStepPrefetch('settle', {})).toBe(1);
	expect(calls[calls.length - 1].depth).toBe(2);
	window.localStorage.setItem('horosa.perf.stepPrefetchArm', '0');
	expect(armStepPrefetch('settle', {})).toBe(0);
});

test('settle 单位记忆:reportStepUnit 按技法记,currentStepUnit 未知技法回退 m', () => {
	expect(currentStepUnit('ziwei')).toBe('m');
	reportStepUnit('ziwei', 'h');
	expect(currentStepUnit('ziwei')).toBe('h');
	expect(currentStepUnit('dunjia')).toBe('h');   // 全局最近值兜底(用户跨技法保持步长习惯)
	reportStepUnit('dunjia', 'd');
	expect(currentStepUnit('dunjia')).toBe('d');
	expect(currentStepUnit('ziwei')).toBe('h');    // 各技法记忆互不覆盖
});

test('skipChart / fieldsOverride 透传给 builder(本地漏斗 b′ 的契约)', () => {
	const seen = [];
	registerArmPlanBuilder((fields, hint) => {
		seen.push({ stamp: fields.date.value.stamp, skipChart: hint.skipChart });
		return [{ name: 'x', path: '/ziwei/', run: () => Promise.resolve() }];
	});
	storeWith('ziwei', '202607211200');
	const localFields = { date: { value: mkDt('202607211204') }, time: { value: mkDt('202607211204') } };
	armStepPrefetch('local-settle', { fieldsOverride: localFields, skipChart: true });
	expect(seen).toEqual([{ stamp: '202607211204', skipChart: true }]);
});
