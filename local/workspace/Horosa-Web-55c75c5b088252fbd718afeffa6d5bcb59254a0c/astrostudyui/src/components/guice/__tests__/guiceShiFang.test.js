// 皇极轨策 · 时方（方应可算 / 时方神煞有名无表）金标。
// 🔴 失败 = 引擎错，不得改测试将就。
//
// 本组是「死开关」一类的收口：神煞/时方/数系三个开关曾有控件、入选项键、进储存,
// 却于引擎【零消费】—— 翻之中右栏纹丝不动。jest 当时全绿,因为「开关真生效」一组
// 恰好只测了另外五个开关,而「选项键必变」只证了键会变、没证输出会变。故此处不测键,
// 只测【盘】:同一卦、只改这三个开关,盘必须真的不同。
import { fangYing, shiFang, FANG_WEI, SHI_FANG_SHEN_SHA_NAMES } from '../core/guiceShiFang';
import { buildGuicePan } from '../core/guicePan';
import { DEFAULT_GUICE_SETTINGS } from '../guiceSchools';

const GUA = { up: '坤', lo: '坤', dongYao: 1, fa: 'time', steps: [] };
const CTX = { yearZhi: '辰', monthZhi: '午', lunarMonth: 5, lunarDay: 25, hourZhi: '午', year: 2000, dayGan: '丙' };
const pan = (settings, ctx) => buildGuicePan({ gua: GUA, ctx: { ...CTX, ...ctx }, settings: { ...DEFAULT_GUICE_SETTINGS, ...settings }, shiyingInputs: {} });

describe('轨策·时方 · 方应（古籍明载，可算）', () => {
	// 判据与排序无关（.sort() 按 UTF-16 码位，手抄期望序必错）—— 只问「八卦各一、不重不漏」
	test('八方配后天八卦，一一对应不重不漏', () => {
		expect(FANG_WEI).toHaveLength(8);
		const guas = FANG_WEI.map((f) => f.gua);
		expect(new Set(guas).size).toBe(8);
		['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'].forEach((g) => expect(guas).toContain(g));
		// 后天方位之定序：离南坎北震东兑西（四正），巽东南坤西南乾西北艮东北（四隅）
		const by = FANG_WEI.reduce((m, f) => { m[f.label] = f.gua; return m; }, {});
		expect(by).toEqual({ 南: '离', 北: '坎', 东: '震', 西: '兑', 东南: '巽', 西南: '坤', 西北: '乾', 东北: '艮' });
	});

	// 古籍：「以体为主，看来占之人在何方位…宜生体卦，又宜与体比和，则吉；
	//        如克体卦则凶，如体卦生之，亦不吉矣。」→ 即以方为用、体为主，走体用四诀。
	test('🔴 生体则吉：体坤(土)、占者在南(离火)，火生土 → 用生体', () => {
		expect(fangYing('坤', 'S')).toMatchObject({ fang: '南', gua: '离', key: '用生体', ji: 2 });
	});
	test('🔴 克体则凶：体坤(土)、占者在东(震木)，木克土 → 用克体', () => {
		expect(fangYing('坤', 'E')).toMatchObject({ fang: '东', gua: '震', key: '用克体', ji: -2 });
	});
	test('🔴 体生之亦不吉：体坤(土)、占者在西(兑金)，土生金 → 体生用(耗损)', () => {
		expect(fangYing('坤', 'W')).toMatchObject({ fang: '西', gua: '兑', key: '体生用', ji: -1 });
	});
	test('🔴 比和则吉：体坤(土)、占者在东北(艮土) → 比和', () => {
		expect(fangYing('坤', 'NE')).toMatchObject({ fang: '东北', gua: '艮', key: '比和', ji: 2 });
	});
	test('未录方位 / 坏方位 → null（显式标缺，不臆断一个方）', () => {
		expect(fangYing('坤', undefined)).toBeNull();
		expect(fangYing('坤', 'XX')).toBeNull();
		expect(fangYing(undefined, 'S')).toBeNull();
	});
});

describe('轨策·时方 · 时方神煞（古籍有名而无表 → 标缺不补）', () => {
	test('五名目照古籍', () => {
		expect(SHI_FANG_SHEN_SHA_NAMES).toEqual(['魁', '破', '败', '亡', '灭迹']);
	});
	test('🔴 参神煞则出其名目而恒标缺 —— 造一张查不到出处的神煞表，比不做更坏', () => {
		const r = shiFang({ tiGua: '坤', fangKey: 'S', shuXi: 'zhouyi', shenSha: true });
		expect(r.shenSha.missing).toBe(true);
		expect(r.shenSha.note).toContain('另一辑本');
		expect(r.shenSha).not.toHaveProperty('duan');   // 有断=已臆补
		expect(r.shenSha).not.toHaveProperty('table');
	});
	test('🔴 不参神煞 → 并此块亦不出（出一个恒标缺的空块 = 又一个死控件）', () => {
		expect(shiFang({ tiGua: '坤', fangKey: 'S', shuXi: 'zhouyi', shenSha: false }).shenSha).toBeNull();
		// 而方应不受其累 —— 两层各由其开关掌之
		expect(shiFang({ tiGua: '坤', fangKey: 'S', shuXi: 'zhouyi', shenSha: false }).ying).not.toBeNull();
	});
});

describe('轨策·时方 · 三个开关于【盘】上真生效（非只改键）', () => {
	test('🔴 参时方 开↔关 → 盘必异（此前此开关于引擎零消费，翻之毫无动静）', () => {
		expect(pan({ shiFang: false }).shiFang).toBeNull();
		expect(pan({ shiFang: true, shuXi: 'zhouyi' }).shiFang).not.toBeNull();
	});
	test('🔴 数系 周易数↔梅花 → 时方一层出与不出（两传本之别正在于此）', () => {
		expect(pan({ shiFang: true, shuXi: 'zhouyi' }).shiFang).not.toBeNull();
		// 定本明言梅花不用时方 → 整层不出(非出个空壳)
		expect(pan({ shiFang: true, shuXi: 'meihua' }).shiFang).toBeNull();
	});
	test('🔴 换所坐立之方 → 方应之断必异', () => {
		const s = { shiFang: true, shuXi: 'zhouyi' };
		const a = pan(s, { fangKey: 'S' }); const b = pan(s, { fangKey: 'E' });
		expect(a.shiFang.ying.key).not.toBe(b.shiFang.ying.key);
	});
	test('参时方而未录方位 → 标缺，盘仍成（不因缺一录而全失）', () => {
		const p = pan({ shiFang: true, shuXi: 'zhouyi' }, { fangKey: undefined });
		expect(p.shiFang.fangMissing).toBe(true);
		expect(p.shiFang.ying).toBeNull();
		expect(p.yan.value).toBe(11825);   // 演数不受其累
	});
	test('🔴「默认即现状」：默认档不参时方 → 盘上无此层（零回归）', () => {
		expect(DEFAULT_GUICE_SETTINGS.shiFang).toBe(false);
		expect(pan({}).shiFang).toBeNull();
	});
});
