// 双触发收敛通用件:同签名第二路跳过 / A→B→A 照常 / 失败可重试 / 时间窗 / 开关 / 身份编号
import fs from 'fs';
import path from 'path';
import { claimTrigger, settleTrigger, identityOf, SINGLE_TRIGGER_WINDOW_MS, __resetSingleTrigger } from '../singleTrigger';

describe('singleTrigger', ()=>{
	const owner = {};
	beforeEach(()=>{ __resetSingleTrigger(owner); localStorage.removeItem('horosa.perf.singleTrigger'); });

	test('同签名第二路跳过;不同 slot / 不同 owner 互不影响', ()=>{
		const t1 = claimTrigger(owner, 'pan', 'A');
		expect(t1).toBeGreaterThan(0);
		expect(claimTrigger(owner, 'pan', 'A')).toBe(0);
		expect(claimTrigger(owner, 'other', 'A')).toBeGreaterThan(0);
		expect(claimTrigger({}, 'pan', 'A')).toBeGreaterThan(0);
	});

	test('A→B→A:第三下与最近一次认领(B)不同 → 照常执行', ()=>{
		expect(claimTrigger(owner, 'pan', 'A')).toBeGreaterThan(0);
		expect(claimTrigger(owner, 'pan', 'B')).toBeGreaterThan(0);
		expect(claimTrigger(owner, 'pan', 'A')).toBeGreaterThan(0);
		expect(claimTrigger(owner, 'pan', 'A')).toBe(0);
	});

	test('失败报回 → 同参可立即重试;被顶替的旧令牌报失败无效', ()=>{
		const t1 = claimTrigger(owner, 'pan', 'A');
		settleTrigger(owner, 'pan', t1, false);
		const t2 = claimTrigger(owner, 'pan', 'A');
		expect(t2).toBeGreaterThan(0);
		const t3 = claimTrigger(owner, 'pan', 'B');
		settleTrigger(owner, 'pan', t2, false);          // t2 已被 B 顶替
		expect(claimTrigger(owner, 'pan', 'B')).toBe(0); // B 仍在,重复被挡
		settleTrigger(owner, 'pan', t3, true);
		expect(claimTrigger(owner, 'pan', 'B')).toBe(0);
	});

	test('时间窗外同参照常执行(有意重发不受影响)', ()=>{
		const spy = jest.spyOn(performance, 'now');
		spy.mockReturnValue(1000);
		expect(claimTrigger(owner, 'pan', 'A')).toBeGreaterThan(0);
		spy.mockReturnValue(1000 + SINGLE_TRIGGER_WINDOW_MS - 1);
		expect(claimTrigger(owner, 'pan', 'A')).toBe(0);
		spy.mockReturnValue(1000 + SINGLE_TRIGGER_WINDOW_MS + 5);
		expect(claimTrigger(owner, 'pan', 'A')).toBeGreaterThan(0);
		spy.mockRestore();
	});

	test('开关关 → 恒放行;空签名恒放行', ()=>{
		localStorage.setItem('horosa.perf.singleTrigger', '0');
		expect(claimTrigger(owner, 'pan', 'A')).toBeGreaterThan(0);
		expect(claimTrigger(owner, 'pan', 'A')).toBeGreaterThan(0);
		localStorage.removeItem('horosa.perf.singleTrigger');
		expect(claimTrigger(owner, 'pan', null)).toBeGreaterThan(0);
		expect(claimTrigger(owner, 'pan', null)).toBeGreaterThan(0);
	});

	test('身份编号:同对象同号、不同对象不同号、原始值原样', ()=>{
		const a = {}; const b = {};
		expect(identityOf(a)).toBe(identityOf(a));
		expect(identityOf(a)).not.toBe(identityOf(b));
		expect(identityOf(null)).toBe('null');
		expect(identityOf('x')).toBe('x');
	});
});

// 接线棘轮:2026-09-26 真浏览器调试日志点实测「同一次取盘重算两三遍」的 13 处都必须经通用件认领(只增不减)。
const WIRED = [
	'guolao/GuoLaoChartMain', 'taiyi/TaiYiMain', 'babylon/BabylonMain', 'astro/AstroDecennials',
	'germany/UranianDialMain', 'germany/UranianGraphicEphemeris', 'germany/UranianHouseFrames',
	'huangji/HuangJiMain', 'jingjue/JingJueMain', 'shenyishu/ShenYiShuMain', 'taixuan/TaiXuanMain', 'wuzhao/WuZhaoMain',
	'kinastro/KinAstroMain',
];
test('13 处双触发重算都经 claimTrigger 认领', ()=>{
	const root = path.join(__dirname, '..', '..', 'components');
	const missing = WIRED.filter((f)=>!/claimTrigger\(this, '/.test(fs.readFileSync(path.join(root, `${f}.js`), 'utf8')));
	expect(missing).toEqual([]);
});
// 失败回报棘轮:request() 吞错 resolve 空、阶段性回落(旧盘 / 本地规则)都不抛。收敛前第二路会顺带重试,
// 收敛后这些「未抛出的失败」也必须 settleTrigger(false),否则同参重试会被当成重复挡掉(只增不减)。
const SETTLE_MIN = {
	'guolao/GuoLaoChartMain': ['guolaoBundle', 4],          // 无盘可画 / 本命回落旧盘 / 流年空 / 规则空
	'taiyi/TaiYiMain': ['requestNongli', 1],
	'babylon/BabylonMain': ['refresh', 1],
	'germany/UranianDialMain': ['requestNatalTnp', 2],       // 空回 / 抛错
	'germany/UranianGraphicEphemeris': ['requestData', 2],   // 空回 / 抛错
	'germany/UranianHouseFrames': ['load', 2],               // 空回 / 抛错
	'huangji/HuangJiMain': ['fetchPan', 1],
	'jingjue/JingJueMain': ['fetchPan', 1],
	'shenyishu/ShenYiShuMain': ['fetchPan', 1],
	'taixuan/TaiXuanMain': ['fetchPan', 1],
	'wuzhao/WuZhaoMain': ['fetchPan', 1],
	'kinastro/KinAstroMain': ['fetchPan', 1],
};
test('未抛出的失败也回报失败(同参可重试)', ()=>{
	const root = path.join(__dirname, '..', '..', 'components');
	const short = [];
	Object.keys(SETTLE_MIN).forEach((f)=>{
		const [slot, min] = SETTLE_MIN[f];
		const src = fs.readFileSync(path.join(root, `${f}.js`), 'utf8');
		const n = src.split(`settleTrigger(this, '${slot}'`).length - 1;
		if(n < min){ short.push(`${f}:${slot} ${n}<${min}`); }
	});
	expect(short).toEqual([]);
	// 巴比伦:支持区间内历象空回也算失败(区间外本就为空,不算)
	const bab = fs.readFileSync(path.join(root, 'babylon', 'BabylonMain.js'), 'utf8');
	expect(bab).toMatch(/!ephem && jdn && jdn >= EPHEM_MIN_JDN/);
});
// 五兆:判重必须先于「重掷取种」(否则第二路先换了种子再判,签名永远不同 → 一次改动掷两次兆)
test('五兆判重先于重掷取种', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'wuzhao', 'WuZhaoMain.js'), 'utf8');
	const body = src.slice(src.indexOf('async fetchPan(fields, opts){'));
	expect(body.indexOf("claimTrigger(this, 'fetchPan'")).toBeGreaterThan(0);
	expect(body.indexOf("claimTrigger(this, 'fetchPan'")).toBeLessThan(body.indexOf('newCastSeed()'));
});

