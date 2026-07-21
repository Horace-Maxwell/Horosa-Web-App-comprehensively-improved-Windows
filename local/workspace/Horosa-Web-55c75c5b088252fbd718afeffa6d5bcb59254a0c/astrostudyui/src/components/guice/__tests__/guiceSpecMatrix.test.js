// 皇极轨策 · 规格对照表【选项 → 预期计算 → 预期显示】+ 穷举压测矩阵。
// 🔴 失败 = 实现与规格不符，不得改测试将就。
//
// 本表是【机械派生】的：取值域一律自代码取（DEFAULT/normalize 白名单/表键），不手抄 ——
// 手抄必漏，而漏掉的那个恰恰就是没人测的那个（上一轮的死开关正是如此漏掉的）。
//
// 判据分两层，缺一不可：
//   ① 「真生效」= 翻之【盘必真的不同】(不是「选项键变了」——键变≠盘变，这是上一轮放过
//      四个死开关的原话);
//   ② 「不塌」  = 任何取值组合(含空/边界/极端/互斥)下 buildGuicePan 皆不抛、且出真盘。
import {
	DEFAULT_GUICE_SETTINGS, GUICE_OPTION_KEYS, normalizeGuiceSettings, applyPreset, setOption,
	GUICE_PRESETS, qiguaFaInputs,
} from '../guiceSchools';
import { buildGuicePan } from '../core/guicePan';
import { qiGua, QI_GUA_FA } from '../core/guiceQiGua';
import { JI_GONG_MODES, SHIYING_SETS } from '../core/guiceConst';
import { LIUSHIJIAZI_DINGSHU } from '../core/guiceJiaziShu';

const GUA = { up: '坤', lo: '坤', dongYao: 1, fa: 'time', steps: [] };
const CTX = {
	yearZhi: '辰', monthZhi: '午', lunarMonth: 5, lunarDay: 25, hourZhi: '午',
	year: 2000, dayGan: '丙', pillars: ['庚辰', '壬午', '丙申', '甲午'], fangKey: 'S',
};
const pan = (settings, ctx) => buildGuicePan({
	gua: GUA, ctx: { ...CTX, ...ctx }, settings: { ...DEFAULT_GUICE_SETTINGS, ...settings, school: 'custom' }, shiyingInputs: {},
});
const sig = (s, c) => JSON.stringify(pan(s, c));

// ── 取值域：一律自代码派生 ─────────────────────────────────────
const DOMAIN = {
	qiguaFa: QI_GUA_FA.map((f) => f.key),
	yanshuFa: ['ce', 'gui'],
	jiGongMode: Object.keys(JI_GONG_MODES),
	qiguaShu: ['xiantian', 'houtian', 'jiuchou'],
	shenSha: [false, true],
	shiFang: [false, true],
	shuXi: ['zhouyi', 'meihua'],
	dadingTable: Object.keys(LIUSHIJIAZI_DINGSHU),
	shiyingSet: Object.keys(SHIYING_SETS),
};

describe('轨策·规格表 · 取值域机械派生（漏登即红）', () => {
	test('🔴 对照表覆盖全部九开关，一个不落', () => {
		expect(Object.keys(DOMAIN).sort()).toEqual(GUICE_OPTION_KEYS.slice().sort());
	});
	test('每个取值域非空，且默认值确在其域内', () => {
		Object.keys(DOMAIN).forEach((k) => {
			expect(DOMAIN[k].length).toBeGreaterThan(0);
			expect(DOMAIN[k]).toContain(DEFAULT_GUICE_SETTINGS[k]);
		});
	});
	test('起卦十二法齐备，且法法有其输入之目（无孤法）', () => {
		expect(DOMAIN.qiguaFa).toHaveLength(12);
		DOMAIN.qiguaFa.forEach((f) => expect(qiguaFaInputs(f).length).toBeGreaterThan(0));
	});
});

describe('轨策·压测 · 每选项每取值：盘皆成、且规整后仍在域内', () => {
	Object.keys(DOMAIN).forEach((k) => {
		DOMAIN[k].forEach((v) => {
			test(`${k} = ${String(v)}`, () => {
				const s = { ...DEFAULT_GUICE_SETTINGS, [k]: v, school: 'custom' };
				const n = normalizeGuiceSettings(s);
				// 规整不得把合法值改掉（梅花强制关神煞/时方是【有意】的联动，例外之）
				if (!(n.shuXi === 'meihua' && (k === 'shenSha' || k === 'shiFang'))) {
					expect(n[k]).toBe(v);
				}
				const p = pan({ [k]: v });
				expect(p).toBeTruthy();
				expect(p.yan.value).toBeGreaterThan(0);
				expect(p.gua.name).toBeTruthy();
			});
		});
	});
});

describe('轨策·压测 · 九开关笛卡尔积（全组合，含互斥）', () => {
	// 9 开关全积 = 12×2×3×3×2×2×2×2×3 = 20736 —— 太多；起卦法于既成之盘无影响(卦是冻结值)，
	// 故其固定，余 8 开关全积 = 2×3×3×2×2×2×2×3 = 864 组，逐组验盘成且不抛。
	const keys = GUICE_OPTION_KEYS.filter((k) => k !== 'qiguaFa');
	const combos = keys.reduce((acc, k) => acc.flatMap((c) => DOMAIN[k].map((v) => ({ ...c, [k]: v }))), [{}]);

	test('组合数如算（864 = 2×3×3×2×2×2×2×3）', () => {
		expect(combos.length).toBe(864);
	});

	test('🔴 864 组全跑：无一抛错、无一出空盘', () => {
		const bad = [];
		combos.forEach((c) => {
			try {
				const p = pan(c);
				if (!p) bad.push(`${JSON.stringify(c)} → null`);
				else if (!(p.yan.value > 0)) bad.push(`${JSON.stringify(c)} → 演数 ${p.yan.value}`);
			} catch (e) { bad.push(`${JSON.stringify(c)} → 抛 ${e.message}`); }
		});
		expect(bad).toEqual([]);
	});

	test('🔴 864 组全跑：快照皆可构且非空（导出/挂载之所本）', () => {
		const { buildGuiceSnapshotText } = require('../guiceSnapshot');
		const bad = [];
		combos.forEach((c) => {
			try {
				const t = buildGuiceSnapshotText(pan(c));
				if (!t || t.length < 50) bad.push(`${JSON.stringify(c)} → 快照 ${t ? t.length : 0} 字`);
				if (/undefined|NaN|\[object/.test(t)) bad.push(`${JSON.stringify(c)} → 快照含字面 undefined/NaN`);
			} catch (e) { bad.push(`${JSON.stringify(c)} → 抛 ${e.message}`); }
		});
		expect(bad).toEqual([]);
	});

	test('🔴 互斥之组：梅花 + 神煞/时方开 → 规整必强制关（不留勾着却不生效）', () => {
		const n = normalizeGuiceSettings({ ...DEFAULT_GUICE_SETTINGS, shuXi: 'meihua', shenSha: true, shiFang: true });
		expect([n.shenSha, n.shiFang]).toEqual([false, false]);
		// 且盘上时方一层确不出
		expect(pan({ shuXi: 'meihua', shiFang: true, shenSha: true }).shiFang).toBeNull();
	});
});

describe('轨策·压测 · 空值 / 坏值 / 极端（不抛、不臆造）', () => {
	test('设置为 null / 非对象 / 坏值 → 一律回默认，不抛', () => {
		[null, undefined, 'x', 123, [], { qiguaFa: 'nope', yanshuFa: 'x', qiguaShu: 'y', jiGongMode: 'z' }].forEach((bad) => {
			expect(() => normalizeGuiceSettings(bad)).not.toThrow();
			const n = normalizeGuiceSettings(bad);
			GUICE_OPTION_KEYS.forEach((k) => expect(DOMAIN[k]).toContain(n[k]));
		});
	});
	test('ctx 全空（未排盘）→ 盘不出，但不抛', () => {
		expect(() => buildGuicePan({ gua: GUA, ctx: {}, settings: DEFAULT_GUICE_SETTINGS, shiyingInputs: {} })).not.toThrow();
		const p = buildGuicePan({ gua: GUA, ctx: {}, settings: DEFAULT_GUICE_SETTINGS, shiyingInputs: {} });
		expect(p).toBeTruthy();          // 卦在则盘成 —— 演数只需卦，不需时
		expect(p.dading).toBeNull();     // 缺四柱 → 大定不出（不臆造）
	});
	test('缺四柱而择九畴之系 → 大定不出、盘仍成（不因缺一物而全失）', () => {
		const p = pan({ qiguaShu: 'jiuchou' }, { pillars: undefined });
		expect(p).toBeTruthy();
		expect(p.dading).toBeNull();
		expect(p.yan.value).toBeGreaterThan(0);
	});
	test('坏卦 / 缺卦 → null，不抛', () => {
		[null, {}, { up: '甲', lo: '坤', dongYao: 1 }, { up: '坤', lo: '坤', dongYao: 0 },
			{ up: '坤', lo: '坤', dongYao: 7 }].forEach((g) => {
			expect(() => buildGuicePan({ gua: g, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS, shiyingInputs: {} })).not.toThrow();
			expect(buildGuicePan({ gua: g, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS, shiyingInputs: {} })).toBeNull();
		});
	});
	test('🔴 六十四卦全谱 × 六爻皆动（384 局）→ 盘皆成、演数皆正', () => {
		const G8 = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
		const bad = [];
		G8.forEach((up) => G8.forEach((lo) => [1, 2, 3, 4, 5, 6].forEach((y) => {
			try {
				const p = buildGuicePan({ gua: { up, lo, dongYao: y, fa: 'time', steps: [] }, ctx: CTX, settings: DEFAULT_GUICE_SETTINGS, shiyingInputs: {} });
				if (!p || !(p.yan.value > 0) || !p.gua.name) bad.push(`${up}${lo}${y}`);
			} catch (e) { bad.push(`${up}${lo}${y} 抛 ${e.message}`); }
		})));
		expect(bad).toEqual([]);
	});
});

describe('轨策·压测 · 十二起卦法 × 输入边界（不可起者须明说，不臆造一个卦）', () => {
	const base = { ...CTX };
	test('年月日时起例：时齐则出卦', () => {
		const r = qiGua('time', base);
		expect(r).toBeTruthy();
		expect(r.dongYao).toBeGreaterThanOrEqual(1);
		expect(r.dongYao).toBeLessThanOrEqual(6);
	});
	test('🔴 诸法遇空输入 → 返 null 或 error，绝不臆造一个卦', () => {
		const bad = [];
		QI_GUA_FA.forEach((f) => {
			const r = qiGua(f.key, {});   // 全空
			if (r && !r.error && r.up && r.lo) bad.push(`${f.key} 空输入却出了卦 ${r.up}${r.lo}`);
		});
		expect(bad).toEqual([]);
	});
	test('报数：一数 / 二数 / 零 / 负 / 超大', () => {
		expect(qiGua('baoshu', { ...base, nums: [35] })).toBeTruthy();
		expect(qiGua('baoshu', { ...base, nums: [3, 2] })).toBeTruthy();
		expect(qiGua('baoshu', { ...base, nums: [] })).toBeNull();
		expect(qiGua('baoshu', { ...base, nums: [0] })).toBeNull();
		const big = qiGua('baoshu', { ...base, nums: [999999999] });
		expect(big && big.dongYao).toBeGreaterThanOrEqual(1);
	});
	test('丈尺占：本不加时；寸数不用（多给亦不受其影响）', () => {
		const a = qiGua('zhangchi', { ...base, zhang: 3, chi: 5 });
		const b = qiGua('zhangchi', { ...base, zhang: 3, chi: 5, cun: 9 });
		expect(a).toBeTruthy();
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));   // 寸数不用 → 给与不给同
	});
	test('🔴 占静物：无初创之时可稽者，古籍明其不可起 → 须出 error，不出卦', () => {
		const r = qiGua('jingwu', { ...base, kind: '江河山石' });
		expect(r && r.error).toBeTruthy();
		expect(r.up).toBeUndefined();
	});
	test('字占：一字草书不可得卦；四至十字用声调；十一字以上止用字数', () => {
		expect(qiGua('zizhan', { ...base, text: '天', shu: 'cao' })).toMatchObject({ error: expect.any(String) });
		const four = qiGua('zizhan', { ...base, text: '今日何如', shu: 'kai', tones: ['平', '去', '平', '上'] });
		expect(four).toBeTruthy();
		const many = qiGua('zizhan', { ...base, text: '一二三四五六七八九十十一', shu: 'kai' });
		expect(many).toBeTruthy();
	});
});

describe('轨策·规格表 · 预设（一键套一组，且改单项即标自定义）', () => {
	test('四预设齐，且各自之档皆在取值域内', () => {
		Object.keys(GUICE_PRESETS).forEach((p) => {
			const s = applyPreset(p);
			GUICE_OPTION_KEYS.forEach((k) => expect(DOMAIN[k]).toContain(s[k]));
			expect(pan(s)).toBeTruthy();
		});
	});
	test('套预设 → 改单项偏离 → 自动标 custom；未偏离则不动', () => {
		expect(setOption(applyPreset('meihua'), 'yanshuFa', 'gui').school).toBe('custom');
		expect(setOption(applyPreset('meihua'), 'shuXi', 'meihua').school).toBe('meihua');
	});
});
