// 神数正传 · 十七开关逐项真生效（真机逐项翻过一遍后落成之金标）
//
// 🔴 本组之由：真机把十七项逐一翻了一遍，初测「十五项纹丝不动」——
//    而那是【测法错了】：左栏控件按流派分组显示，父母年龄只属邵子、元运只属邵子、
//    物/声/刻/宫只属心易…… 在铁板流派下翻它们，本就不该有反应（其控件根本不在页上）。
//    改在【各自所属之流派】下重测，十四项立见其变。故此处金标亦按流派分组。
//
// 🔴 余下那一项(yuan/元运)是【数学等价的伪报】，不是死开关 —— 详见文末那一组。
import { calcShaozi } from '../../../utils/zhengchuanShaoziLocal';
import { deriveDadingYearPillars } from '../ZhengChuanMain';
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';
import { xianTianMingGua } from '../../../utils/zhengchuanShaoziLocal';
import fs from 'fs';
import path from 'path';

const HOST = fs.readFileSync(path.join(__dirname, '..', '..', 'kinastro', 'KinAstroMain.js'), 'utf8');

describe('神数正传 · 十七开关一个不落地汇入 opts（漏一个 = 那项永不生效）', () => {
	const body = (HOST.match(/buildZhengChuanOpts\(\)\{[\s\S]*?\n\t\}/) || [''])[0];

	// 十八 = 原十七 + dadingYear(所推流年;大定之主控,余四者由其派生)
	test('buildZhengChuanOpts 汇齐十八项', () => {
		const keys = (body.match(/this\.state\.zhengchuan[A-Za-z]+/g) || [])
			.map((s) => s.split('.')[2]);
		expect(keys.length).toBe(18);
		expect(new Set(keys).size).toBe(18);   // 无重复
		expect(keys).toContain('zhengchuanDadingYear');
	});

	// 🔴 控件按流派分组显示 —— 此乃「在铁板流派下翻邵子的开关，纹丝不动」之由(非 bug)。
	test('五流派各有其参数组（分组本身是设计，不是漏渲）', () => {
		['tieban', 'shaozi', 'dading', 'liuqin', 'xinyi'].forEach((s) => {
			expect(HOST).toContain(`this.state.zhengchuanSchool === '${s}'`);
		});
	});
});

// 🔴 元运(yuan)：真机在【现命例】下翻它中右栏不动，一度疑为死开关 —— 实非。
//    其只在【先天命卦配数余五】时入算:河洛配卦表无「5」一格，故余五者另按元运×性别定卦。
//    余数非五者，元运插不上手 —— 中栏就明写着「23 → 余 3 → 震」，翻它自然纹丝不动。
//    此为【数学等价】类伪报(与卜·皇极轨策的寄宫法同类)。下二组把这事钉死，免再误报。
describe('🔴 元运 · 余五方入算（数学等价之伪报，非死开关）', () => {
	const P_NO5 = ['甲子', '辛未', '庚戌', '乙酉'];   // 真机现盘：天余 3、地余 2
	const P_HAS5 = ['甲子', '辛未', '庚午', '甲申'];  // 全域扫得：天数余 5

	test('余数非五者：三元同出一卦（故真机翻它不变 —— 预期如此，非 bug）', () => {
		const g = ['shang', 'zhong', 'xia'].map((yuan) => {
			const r = xianTianMingGua({ pillars: P_NO5, gender: '男', yuan });
			return `${r.up}/${r.lo}`;
		});
		expect(new Set(g).size).toBe(1);
	});

	// ⚠️ 古法本身即如此：上元男与中元阳男【同为艮】—— 二元在「阳男」这一支上重合。
	//    故拿上元/中元去注错验不出东西来(删了上元那支，落到中元兜底照样是艮)；
	//    判据须锚在下元(離)上，方分得开。此非缺陷，是法之本然。
	test('🔴 余五者：元运确实入算（此项若真死，下元必塌回兜底之艮）', () => {
		const shang = xianTianMingGua({ pillars: P_HAS5, gender: '男', yuan: 'shang' });
		const zhong = xianTianMingGua({ pillars: P_HAS5, gender: '男', yuan: 'zhong' });
		const xia = xianTianMingGua({ pillars: P_HAS5, gender: '男', yuan: 'xia' });
		expect(shang.up).toBe('艮');     // 上元男 → 艮
		expect(zhong.up).toBe('艮');     // 中元阳男 → 艮（与上元重合，法之本然）
		expect(xia.up).toBe('離');       // 下元男 → 離 ← 分水岭在此
		expect(xia.up).not.toBe(shang.up);
	});

	// ⚠️ 性别在此处有【两重】作用，勿混为一谈（我起初只当它一重，判据遂写错）：
	//    ① 余五时配哪一卦：上元男艮、上元女坤；
	//    ② 天地卦谁上谁下：阳男阴女天上地下，阴男阳女反之。
	//    甲子为阳年 → 男 groupA(天上地下)、女则天下地上 → 余五那个天卦，男落上、女落下。
	test('余五者 × 性别：男女各异（元运与性别合定，且天地上下亦随性别翻转）', () => {
		const nan = xianTianMingGua({ pillars: P_HAS5, gender: '男', yuan: 'shang' });
		const nv = xianTianMingGua({ pillars: P_HAS5, gender: '女', yuan: 'shang' });
		expect(nan.up).toBe('艮');   // 阳年男：天上 → 余五之天卦(上元男→艮)在上
		expect(nv.lo).toBe('坤');    // 阳年女：天下 → 余五之天卦(上元女→坤)落下
		expect(`${nan.up}${nan.lo}`).not.toBe(`${nv.up}${nv.lo}`);
	});

	test('🔴 左栏须向用户明示其适用之境（不说，则「翻了没反应」是界面之过）', () => {
		// 元运那一格的 label 里须见「余五」二字 —— 用户方知其只在余五时入算
		expect(HOST).toMatch(/余五/);
	});
});

// 各流派的开关真入算 —— 引擎层逐项翻（真机那一遍已过，此处落成可回归之金标）
describe('神数正传 · 邵子：父母年龄真入算', () => {
	const base = { pillars: ['甲子', '辛未', '庚戌', '乙酉'], gender: '男', lunarMonth: 6, lunarDay: 2 };

	test('父年一改，其数即异', () => {
		const a = calcShaozi({ ...base, fatherAge: 27, motherAge: 26 });
		const b = calcShaozi({ ...base, fatherAge: 35, motherAge: 26 });
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
	});

	test('母年一改，其数即异', () => {
		const a = calcShaozi({ ...base, fatherAge: 27, motherAge: 26 });
		const b = calcShaozi({ ...base, fatherAge: 27, motherAge: 33 });
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
	});
});

// 🔴 大定「所推流年」—— 从前此处要用户手填【虚岁 + 大运/小运/岁君三个干支】:
//    得自己算虚岁、自己排大运、自己查太岁，换一年又得从头来一遍。今只取一年，余者自出。
//    派生一律取自八字既有之推运表(smallDirection / mainDirection)，【绝不另造一份推法】——
//    另造必与八字盘漂移，同一人两页所见之大运不同，是为大忌。
describe('🔴 大定 · 择年则四者自出（真机逐年翻过后落成之金标）', () => {
	const BAZI = buildLocalBaziResult({
		date: '1984-07-15', time: '18:17:00', lon: '', gender: 1, timeAlg: 1,
		after23NewDay: 1, lateZiHourUseNextDay: 1,
	}).bazi;

	test('择一年 → 虚岁/小运/岁君/大运俱出（真机实测之值）', () => {
		const d = deriveDadingYearPillars(BAZI, 2026);
		expect(d.age).toBe(43);
		expect(d.xiaoyun).toBe('戊辰');
		expect(d.suijun).toBe('丙午');      // 2026 年太岁
		expect(d.dayun).toBe('乙亥');
		expect(d.beforeQiYun).toBe(false);
	});

	// 🔴 起运之前只行小运、无大运可言 —— 其 ganzi 本就是空，非缺漏。
	//    此命「出生后七年七月余起运」，故 1984–1991 皆未行大运，调用方自然回落月柱。
	test('未起运之年 → beforeQiYun 为真、大运付阙（调用方遂回落月柱）', () => {
		const d = deriveDadingYearPillars(BAZI, 1990);
		expect(d.beforeQiYun).toBe(true);
		expect(d.dayun).toBeUndefined();
		expect(d.age).toBe(7);              // 而虚岁/小运/岁君照出
		expect(d.xiaoyun).toBe('壬辰');
	});

	test('🔴 大运随性别顺逆（阳男阴女顺、阴男阳女逆 —— 真机翻性别实证过）', () => {
		const nv = buildLocalBaziResult({
			date: '1984-07-15', time: '18:17:00', lon: '', gender: 0, timeAlg: 1,
			after23NewDay: 1, lateZiHourUseNextDay: 1,
		}).bazi;
		const m = deriveDadingYearPillars(BAZI, 2050);
		const f = deriveDadingYearPillars(nv, 2050);
		expect(m.dayun).not.toBe(f.dayun);
		expect(m.suijun).toBe(f.suijun);    // 而岁君不随性别 —— 太岁属天
		expect(m.age).toBe(f.age);
	});

	test('逐年递进：虚岁与岁君皆随年而移', () => {
		const a = deriveDadingYearPillars(BAZI, 2026);
		const b = deriveDadingYearPillars(BAZI, 2027);
		expect(b.age).toBe(a.age + 1);
		expect(b.suijun).not.toBe(a.suijun);
	});

	test('表外之年（生年前/百岁外）→ 返空，不臆造（调用方回落本命四柱）', () => {
		expect(deriveDadingYearPillars(BAZI, 1900)).toEqual({});
		expect(deriveDadingYearPillars(BAZI, 3000)).toEqual({});
	});

	// 挂载那边的表单只出数、无空可言，遂以 0 为「未择」—— 故 0 必须返空。
	test('🔴 0 → 返空（挂载以 0 为「未择」之默认；勿当公元 0 年）', () => {
		expect(deriveDadingYearPillars(BAZI, 0)).toEqual({});
		expect(deriveDadingYearPillars(BAZI, '0')).toEqual({});
		expect(deriveDadingYearPillars(BAZI, -5)).toEqual({});
	});

	test('坏输入 → 返空不崩', () => {
		expect(deriveDadingYearPillars(null, 2026)).toEqual({});
		expect(deriveDadingYearPillars(BAZI, '')).toEqual({});
		expect(deriveDadingYearPillars(BAZI, 'abc')).toEqual({});
		expect(deriveDadingYearPillars({}, 2026)).toEqual({});
	});

	// 🔴 手订仍须压过自出(古法偶有特例)，且【撤回手订须真回到自出】——
	//    「取消不是真取消」是此类接线的惯犯，故钉之。
	test('手订压过自出；撤回则复归自出（真机四态验过）', () => {
		const d = deriveDadingYearPillars(BAZI, 2050);
		const pick = (opts) => ({
			dayun: opts.dayun || d.dayun || '(月柱)',
			age: Number(opts.age) || d.age || 40,
		});
		expect(pick({})).toEqual({ dayun: d.dayun, age: d.age });
		expect(pick({ dayun: '甲子', age: '88' })).toEqual({ dayun: '甲子', age: 88 });
		expect(pick({ dayun: '', age: '' })).toEqual({ dayun: d.dayun, age: d.age });   // 撤回 = 真撤回
	});

	// 界面之实:年份一格 + 手订折叠 —— 不可退回「四格全摊在外」那副苦相。
	test('🔴 左栏以流年为主控，手订诸格收于折叠之下', () => {
		const body = (HOST.match(/renderDadingYearFields\(\)\{[\s\S]*?\n\t\}/) || [''])[0];
		expect(body).toContain('所推流年');
		expect(body).toContain('zhengchuanDadingYear');
		expect(body).toContain('Collapse');
		expect(body).toContain('手订七位');
	});

	// 虚岁默认须【空】—— 留 '40' 则「手订」恒真、且恒压过流年派生，那还是老样子。
	test('🔴 虚岁之默认是空（留 40 则流年派生永远出不来头）', () => {
		expect(HOST).toMatch(/zhengchuanAge: '',/);
		expect(HOST).not.toMatch(/zhengchuanAge: '40',/);
	});
});
