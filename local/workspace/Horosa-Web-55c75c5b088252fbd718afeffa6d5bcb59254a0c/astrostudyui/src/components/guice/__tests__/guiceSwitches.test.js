// 皇极轨策 · 十个开关「真生效」+「默认即现状」金标。
// 🔴 失败 = 引擎或 registry 错，不得改测试将就。
// 照 utils/__tests__/heluoSwitches.test.js 之范式：逐个翻转必须使输出变化；全缺省必须逐字节不变。
import {
	DEFAULT_GUICE_SETTINGS, GUICE_PRESETS, GUICE_OPTION_META, GUICE_OPTION_KEYS,
	applyPreset, setOption, normalizeGuiceSettings, getGuiceOptionsKey, schoolNeeds, qiguaFaInputs,
} from '../guiceSchools';
import { yanShu } from '../core/guiceEngine';
import { QI_GUA_FA } from '../core/guiceQiGua';
import { calcDading } from '../core/guiceDading';
import { shiYing } from '../core/guiceShiYing';
import { buildGuicePan } from '../core/guicePan';

describe('轨策·开关 · 🔴 getGuiceOptionsKey 汇总全部十开关（漏一即「勾了没变」）', () => {
	test('开关之全恰九个（皆真生效）', () => {
		expect(GUICE_OPTION_KEYS).toHaveLength(9);
		expect(GUICE_OPTION_KEYS).toEqual([
			'qiguaFa', 'yanshuFa', 'jiGongMode', 'qiguaShu',
			'shenSha', 'shiFang', 'shuXi', 'dadingTable', 'shiyingSet',
		]);
		expect(GUICE_OPTION_KEYS).not.toContain('addHour');   // 加时随法自定,非设置
	});
	test('🔴 逐个翻转 → 选项键必变（机械遍历，非手抄）', () => {
		const alt = {
			qiguaFa: 'baoshu', yanshuFa: 'gui', jiGongMode: 'wuKun', qiguaShu: 'houtian',
			shenSha: true, shiFang: true, shuXi: 'meihua',
			dadingTable: 'dading', shiyingSet: 'rizhen',
		};
		const base = getGuiceOptionsKey(DEFAULT_GUICE_SETTINGS);
		const bad = GUICE_OPTION_KEYS.filter((k) => getGuiceOptionsKey({ ...DEFAULT_GUICE_SETTINGS, [k]: alt[k] }) === base);
		expect(bad).toEqual([]);
	});
	test('每个开关皆有其控件（无隐身开关）—— 起卦法于左栏顶部专渲，余者出元表', () => {
		const metaKeys = GUICE_OPTION_META.map((m) => m.key);
		expect(GUICE_OPTION_KEYS.filter((k) => k !== 'qiguaFa' && metaKeys.indexOf(k) < 0)).toEqual([]);
		expect(metaKeys).not.toContain('qiguaFa');   // 列之则与顶部之控件重出
		expect(metaKeys).not.toContain('addHour');   // 加时非设置,不做成可翻之项
	});
	test('选项键为纯字符串且随设置定（同设置同键）', () => {
		expect(typeof getGuiceOptionsKey(DEFAULT_GUICE_SETTINGS)).toBe('string');
		expect(getGuiceOptionsKey(DEFAULT_GUICE_SETTINGS)).toBe(getGuiceOptionsKey({ ...DEFAULT_GUICE_SETTINGS }));
	});
});

// 🔴 本组是「死开关」一类的总闸,判据只有一条:同一卦、只翻一个开关 → 【盘必真的不同】。
//    此前本文件只有「选项键必变」与五个开关的演算例 —— 恰好漏掉的那几个
//    (神煞/时方/数系/加时)于引擎【零消费】,live 实跑翻之中右栏纹丝不动,而 jest 全绿。
//    故此处机械遍历【全部】开关,一个不落,不再手挑。
describe('轨策·开关 · 🔴 机械遍历:每个开关翻之,盘必真的不同(死开关总闸)', () => {
	const GUA = { up: '坤', lo: '坤', dongYao: 1, fa: 'time', steps: [] };
	const CTX = { yearZhi: '辰', monthZhi: '午', lunarMonth: 5, lunarDay: 25, hourZhi: '午',
		year: 2000, dayGan: '丙', pillars: ['庚辰', '壬午', '丙申', '甲午'], fangKey: 'S' };
	const P = (s) => JSON.stringify(buildGuicePan({ gua: GUA, ctx: CTX, settings: s, shiyingInputs: {} }));
	// 每个开关的「翻到何值」与「其成立之境」(有的开关须先入其境方现身)
	const FLIP = {
		yanshuFa: { to: 'gui' },
		qiguaShu: { to: 'houtian' },
		jiGongMode: { to: 'wuKun', base: { qiguaShu: 'houtian' } },
		dadingTable: { to: 'dading', base: { qiguaShu: 'jiuchou' } },
		shiyingSet: { to: 'rizhen' },
		shiFang: { to: true, base: { shuXi: 'zhouyi' } },
		shuXi: { to: 'meihua', base: { shiFang: true } },   // 两传本之别:梅花不参时方
		shenSha: { to: true, base: { shiFang: true, shuXi: 'zhouyi' } },   // 神煞与方应同属时方一门
		// 🔴 起卦法只作用于【起卦】那一刻,而卦是冻结值 → 于既成之盘上本就不该有影响。
		//    非死开关,是「作用在别处」—— 故不在本组,另由起卦金标守。
	};
	Object.keys(FLIP).forEach((k) => {
		test(`翻「${k}」→ 盘必异`, () => {
			const base = { ...DEFAULT_GUICE_SETTINGS, ...(FLIP[k].base || {}), school: 'custom' };
			expect(P({ ...base, [k]: FLIP[k].to })).not.toBe(P(base));
		});
	});
	test('本组已覆盖除 qiguaFa 外的全部开关(新增开关而忘登记 → 此处即红)', () => {
		const covered = Object.keys(FLIP).concat(['qiguaFa']).sort();
		expect(covered).toEqual(GUICE_OPTION_KEYS.slice().sort());
	});
});

describe('轨策·开关 · 真影响演算（非只改键）', () => {
	test('演数 策↔轨 → 所得之数必异（坤为地一爻动 11825 ↔ 14789）', () => {
		expect(yanShu('坤', '坤', 1, { yanshuFa: 'ce' }).value).toBe(11825);
		expect(yanShu('坤', '坤', 1, { yanshuFa: 'gui' }).value).toBe(14789);
	});
	test('数字配卦之系 三者 → 四位之卦必异', () => {
		const g = (sys) => yanShu('坤', '坤', 1, { qiguaShu: sys }).siwei.map((x) => x.gua).join('');
		const a = g('xiantian'); const b = g('houtian'); const c = g('jiuchou');
		expect(new Set([a, b, c]).size).toBeGreaterThan(1);
	});
	test('五·十寄宫 三法 → 遇五或十者必异（其余不动）', () => {
		// 11825 之零位为 5 → 后天正数下走寄宫
		const g = (m) => yanShu('坤', '坤', 1, { qiguaShu: 'houtian', jiGongMode: m }).siwei.map((x) => x.gua).join('');
		expect(g('wuGen')).not.toBe(g('wuKun'));
	});
	test('六十甲子定数 切本 → 大定之数必异（729 vs 679）', () => {
		const P = ['丙申', '丙申', '癸亥', '己未'];
		expect(calcDading({ pillars: P, up: '坤', lo: '乾', dadingTable: 'xinyifawei' }).value)
			.not.toBe(calcDading({ pillars: P, up: '坤', lo: '乾', dadingTable: 'dading' }).value);
	});
	test('十应名目 切套 → 名目必异', () => {
		const g = (s) => shiYing({ up: '离', lo: '兑', dongYao: 6, set: s }).items.map((x) => x.label).join('');
		expect(new Set(['xinyifawei', 'meihua', 'rizhen'].map(g)).size).toBe(3);
	});
});

describe('轨策·开关 · 「默认即现状」（零回归）', () => {
	test('全缺省 → 与显式默认逐字节同', () => {
		expect(yanShu('坤', '坤', 1)).toEqual(yanShu('坤', '坤', 1, DEFAULT_GUICE_SETTINGS));
		expect(yanShu('坤', '坤', 1, {})).toEqual(yanShu('坤', '坤', 1, DEFAULT_GUICE_SETTINGS));
	});
	test('缺省之档：策数 + 五行生成数 + 刚柔日动态 + 心易发微本/版', () => {
		expect(DEFAULT_GUICE_SETTINGS).toMatchObject({
			qiguaFa: 'time', yanshuFa: 'ce', qiguaShu: 'xiantian', jiGongMode: 'ganrou',
			shuXi: 'zhouyi', dadingTable: 'xinyifawei', shiyingSet: 'xinyifawei',
			shenSha: false, shiFang: false,
		});
	});
	test('规整：坏值一律回默认，不抛', () => {
		expect(normalizeGuiceSettings(null)).toEqual(DEFAULT_GUICE_SETTINGS);
		expect(normalizeGuiceSettings({ qiguaFa: 'nope' }).qiguaFa).toBe('time');
		expect(normalizeGuiceSettings({ yanshuFa: 'x' }).yanshuFa).toBe('ce');
		expect(normalizeGuiceSettings({ qiguaShu: 'x' }).qiguaShu).toBe('xiantian');
		expect(normalizeGuiceSettings({ school: 'nope' }).school).toBe('default');
		expect(normalizeGuiceSettings('x')).toEqual(DEFAULT_GUICE_SETTINGS);
	});
});

describe('轨策·开关 · 预设与自定义', () => {
	test('四预设皆备', () => {
		expect(Object.keys(GUICE_PRESETS)).toEqual(['default', 'meihua', 'zhouyishu', 'dading']);
	});
	test('套预设 → school 随之；改单项而偏离 → 自动标 custom', () => {
		expect(applyPreset('meihua').school).toBe('meihua');
		expect(setOption(applyPreset('meihua'), 'yanshuFa', 'gui').school).toBe('custom');
	});
	test('改单项而未偏离预设 → school 不变', () => {
		const m = applyPreset('meihua');
		expect(setOption(m, 'shuXi', 'meihua').school).toBe('meihua');
	});
	test('梅花预设：数系梅花、神煞与时方皆关、十应取梅花版', () => {
		expect(applyPreset('meihua')).toMatchObject({ shuXi: 'meihua', shenSha: false, shiFang: false, shiyingSet: 'meihua' });
	});
	test('大定预设：数字配卦走九畴数', () => {
		expect(applyPreset('dading').qiguaShu).toBe('jiuchou');
	});
});

describe('轨策·开关 · 互斥联动（死控件隐藏，不留「勾了不生效」之惑）', () => {
	test('🔴 梅花 → 神煞与时方隐且强制关（两书明载梅花不用时方应）', () => {
		const n = schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, shuXi: 'meihua' });
		expect(n.shenSha).toBe(false);
		expect(n.shiFang).toBe(false);
		expect(n.disabled.shenSha).toContain('梅花');
	});
	test('🔴 切至梅花 → 已开之神煞/时方一并关（非留着不生效）', () => {
		const on = { ...DEFAULT_GUICE_SETTINGS, shenSha: true, shiFang: true };
		const m = setOption(on, 'shuXi', 'meihua');
		expect([m.shenSha, m.shiFang]).toEqual([false, false]);
	});
	test('🔴 旧档若存着「梅花 + 神煞开」→ 规整时一并关（与 setOption 同则，不留分叉）', () => {
		expect(normalizeGuiceSettings({ shuXi: 'meihua', shenSha: true, shiFang: true }))
			.toMatchObject({ shenSha: false, shiFang: false });
	});
	test('寄宫仅后天正数用得着（五行生成数无寄宫；九畴之借由口诀自载）', () => {
		expect(schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, qiguaShu: 'houtian' }).jiGong).toBe(true);
		expect(schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, qiguaShu: 'xiantian' }).jiGong).toBe(false);
		expect(schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, qiguaShu: 'jiuchou' }).jiGong).toBe(false);
	});
	test('🔴 加时随法自定，非可选 —— schoolNeeds.addHour 只作左栏照实之说明', () => {
		expect(schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, qiguaFa: 'zhangchi' }).addHour).toBe(false);  // 丈尺占不加时
		expect(schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, qiguaFa: 'chicun' }).addHour).toBe(true);     // 尺寸占加时
		expect(schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, qiguaFa: 'time' }).addHour).toBe(true);       // 年月日时起例加时
	});
	test('🔴 旧档若存过 addHour → 规整时抹去（免留一个存着却不生效之死值）', () => {
		expect(DEFAULT_GUICE_SETTINGS).not.toHaveProperty('addHour');
		expect(normalizeGuiceSettings({ addHour: false })).not.toHaveProperty('addHour');
	});
	test('六十甲子定数唯大定用之', () => {
		expect(schoolNeeds({ ...DEFAULT_GUICE_SETTINGS, qiguaShu: 'jiuchou' }).dading).toBe(true);
		expect(schoolNeeds(DEFAULT_GUICE_SETTINGS).dading).toBe(false);
	});
	test('起卦法各有其所需之输入（切法 → 只显该法所需）', () => {
		expect(qiguaFaInputs('time')).toEqual(['time']);
		expect(qiguaFaInputs('zizhan')).toEqual(['text', 'shu', 'tones']);
		expect(qiguaFaInputs('zhangchi')).toEqual(['zhang', 'chi']);
		expect(qiguaFaInputs('chicun')).toEqual(['chi', 'cun']);
		expect(qiguaFaInputs('nope')).toEqual([]);
	});
	test('十二法皆有其输入之目（无孤法）', () => {
		const bad = QI_GUA_FA.filter((f) => qiguaFaInputs(f.key).length === 0);
		expect(bad).toEqual([]);
	});
});
