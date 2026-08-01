// 一掌经 · 压测/规格矩阵：每选项每取值→预期算法效果、组合、边界穷举、一致性、golden 回归。
// 规格对照(选项→预期计算)在各 describe/it 标题内即为验收标准。
import {
	calcYizhangjing, BRANCHES, STARS, mod12, direction, branchIndex, xiaoxianStarAt, xunShenAt, FLOW_SETS, gradeOf,
} from '../yizhangjingLocal';
import { buildYizhangjingModel, resolveLunarInput } from '../yizhangjingReport';

const GENDERS = ['男', '女'];
const RULES = ['yangNanYinNv', 'menShunNvNi'];

function validChart(r) {
	if (!r) return false;
	if (r.pillars.length !== 4) return false;
	if (!r.pillars.every((p) => p.idx >= 0 && p.idx < 12 && STARS.indexOf(p.star) >= 0)) return false;
	if (r.mingIdx < 0 || r.mingIdx >= 12) return false;
	if (r.renshi.length !== 12) return false;
	if (r.dayun.length !== 10) return false;
	return true;
}

describe('一掌经压测 · 边界穷举(所有年支×时支×代表月日×性别×顺逆 均产合法盘)', () => {
	it('9216 组合全部合法、零崩、零 null', () => {
		let count = 0;
		const months = [1, 2, 6, 12];
		const days = [1, 15, 16, 30];
		BRANCHES.forEach((yb) => {
			BRANCHES.forEach((hb) => {
				months.forEach((m) => {
					days.forEach((d) => {
						GENDERS.forEach((g) => {
							RULES.forEach((rule) => {
								const r = calcYizhangjing({ yearBranch: yb, month: m, day: d, hourBranch: hb, gender: g, opts: { shunniRule: rule } });
								expect(validChart(r)).toBe(true);
								count += 1;
							});
						});
					});
				});
			});
		});
		expect(count).toBe(12 * 12 * 4 * 4 * 2 * 2);
	});
});

describe('一掌经压测 · 逐选项效果(勾了必变/按规格变)', () => {
	const B = { yearBranch: '巳', month: 5, day: 17, hourBranch: '酉', gender: '男' }; // 阴年男(两法分歧)

	it('性别 男↔女(阴年)→ 方向翻转 → 四柱四宫变', () => {
		const male = calcYizhangjing({ ...B, gender: '男', opts: {} });
		const female = calcYizhangjing({ ...B, gender: '女', opts: {} });
		expect(male.dir).not.toBe(female.dir);
		expect(male.pillars.map((p) => p.star)).not.toEqual(female.pillars.map((p) => p.star));
	});
	it('顺逆规则(阴年)→ 四柱四宫变；(阳年男)→ 两法一致', () => {
		const a = calcYizhangjing({ ...B, opts: { shunniRule: 'yangNanYinNv' } });
		const b = calcYizhangjing({ ...B, opts: { shunniRule: 'menShunNvNi' } });
		expect(a.pillars.map((p) => p.star)).not.toEqual(b.pillars.map((p) => p.star));
		const y1 = calcYizhangjing({ yearBranch: '子', month: 5, day: 17, hourBranch: '酉', gender: '男', opts: { shunniRule: 'yangNanYinNv' } });
		const y2 = calcYizhangjing({ yearBranch: '子', month: 5, day: 17, hourBranch: '酉', gender: '男', opts: { shunniRule: 'menShunNvNi' } });
		expect(y1.pillars.map((p) => p.star)).toEqual(y2.pillars.map((p) => p.star));
	});
	it('命宫定法 时上起命↔数至卯 → 命宫可不同、人事十二宫起点随命宫', () => {
		const a = calcYizhangjing({ ...B, opts: { mingGongMethod: 'shiShang' } });
		const b = calcYizhangjing({ ...B, opts: { mingGongMethod: 'shuZhiMao' } });
		expect(a.mingIdx).not.toBe(b.mingIdx);
		expect(a.renshi[0].idx).toBe(a.mingIdx);
		expect(b.renshi[0].idx).toBe(b.mingIdx);
	});
	it('大限运长 7↔10 → 大限每步区间变', () => {
		const a = calcYizhangjing({ ...B, opts: { dayunLength: 7 } });
		const b = calcYizhangjing({ ...B, opts: { dayunLength: 10 } });
		expect(a.dayun[1].from).toBe(a.dayun[0].from + 7);
		expect(b.dayun[1].from).toBe(b.dayun[0].from + 10);
	});
	it('大限起运 秘传↔1岁 → 命宫为厄/刃/破/孤时首运岁不同', () => {
		// 遍历找一个命宫落厄/刃/破/孤 的盘,验秘传起运岁≠1
		let found = false;
		BRANCHES.forEach((hb) => {
			const mi = calcYizhangjing({ yearBranch: '子', month: 1, day: 1, hourBranch: hb, gender: '男', opts: { mingGongMethod: 'shuZhiMao', dayunStartAge: 'mi' } });
			const a1 = calcYizhangjing({ yearBranch: '子', month: 1, day: 1, hourBranch: hb, gender: '男', opts: { mingGongMethod: 'shuZhiMao', dayunStartAge: 'age1' } });
			if (['天厄', '天刃', '天破', '天孤'].indexOf(mi.mingStar) >= 0) {
				expect(mi.dayun[0].from).not.toBe(a1.dayun[0].from);
				expect(a1.dayun[0].from).toBe(1);
				found = true;
			}
		});
		expect(found).toBe(true);
	});
	it('小限起宫 日柱宫↔月柱宫 → 小限起点变', () => {
		const a = calcYizhangjing({ ...B, opts: { xiaoxianStart: 'ri' } });
		const b = calcYizhangjing({ ...B, opts: { xiaoxianStart: 'yue' } });
		expect(a.xiaoStartIdx).toBe(a.fourIdx.day);
		expect(b.xiaoStartIdx).toBe(b.fourIdx.month);
		// 起宫不同 → 小限星序不同(除非日宫==月宫,本例不同)
		const sa = []; const sb = [];
		for (let age = 1; age <= 12; age++) { sa.push(xiaoxianStarAt(a.xiaoStartIdx, a.dir, age)); sb.push(xiaoxianStarAt(b.xiaoStartIdx, b.dir, age)); }
		expect(sa).not.toEqual(sb);
	});
	it('流年十二神 A/B/C → 值神集不同', () => {
		expect(FLOW_SETS.A).not.toEqual(FLOW_SETS.B);
		expect(FLOW_SETS.B).not.toEqual(FLOW_SETS.C);
		const f = branchIndex('子');
		const a = []; const b = []; const c = [];
		BRANCHES.forEach((tb, i) => { a.push(xunShenAt(f, i, 'A')); b.push(xunShenAt(f, i, 'B')); c.push(xunShenAt(f, i, 'C')); });
		expect(a).not.toEqual(b);
	});
});

describe('一掌经压测 · report 层选项(重犯口诀/定月法,需农历解析)', () => {
	const baziRepeat = {
		gender: 'Male',
		nongli: { yearGZByLunar: '庚子', shengXiaoLunar: '鼠', monthNum: 1, dayNum: 9, leap: false },
		fourColumns: { time: { ganzi: '乙酉' } },
	};
	it('重犯口诀 常见↔异传 → chosen 标记切换、两组文本并存', () => {
		const a = buildYizhangjingModel(baziRepeat, { shunniRule: 'menShunNvNi', mingGongMethod: 'shuZhiMao', chongfanKou: 'alpha' });
		const b = buildYizhangjingModel(baziRepeat, { shunniRule: 'menShunNvNi', mingGongMethod: 'shuZhiMao', chongfanKou: 'beta' });
		expect(a.repeats.length).toBeGreaterThan(0);
		expect(a.repeats[0].chosen).toBe('alpha');
		expect(b.repeats[0].chosen).toBe('beta');
		expect(a.repeats[0].alpha.length).toBeGreaterThan(0);
		expect(a.repeats[0].beta.length).toBeGreaterThan(0);
		expect(a.repeats[0].alpha).not.toBe(a.repeats[0].beta);
	});
	it('定月法 农历月↔节气月 → 月宫可不同', () => {
		// 造一个 农历月≠节气月支序 的 bazi(农历5月, 但月支=午→节气5月... 需支序不同)
		const bazi = {
			gender: 'Male',
			nongli: { yearGZByLunar: '甲子', shengXiaoLunar: '鼠', monthNum: 3, dayNum: 10, leap: false },
			fourColumns: { time: { ganzi: '甲子' }, month: { ganzi: '丙寅' } }, // 节气月支=寅→节气1月
		};
		const nongli = resolveLunarInput(bazi, { dingYue: 'nongli' });
		const jieqi = resolveLunarInput(bazi, { dingYue: 'jieqi' });
		expect(nongli.month).toBe(3);
		expect(jieqi.month).toBe(1); // 寅=节气正月
		expect(nongli.month).not.toBe(jieqi.month);
	});
	it('闰月 十五折半:≤15 作本月、>15 作下月', () => {
		const base = { gender: 'Male', nongli: { yearGZByLunar: '甲子', shengXiaoLunar: '鼠', monthNum: 5, dayNum: 10, leap: true }, fourColumns: { time: { ganzi: '甲子' } } };
		const early = resolveLunarInput(base, {});
		const late = resolveLunarInput({ ...base, nongli: { ...base.nongli, dayNum: 20 } }, {});
		expect(early.month).toBe(5);
		expect(late.month).toBe(6);
	});
	it('神煞合参层 关↔开 → model.shenshaLayer 标志切换', () => {
		const off = buildYizhangjingModel(baziRepeat, {});
		const on = buildYizhangjingModel(baziRepeat, { shenshaLayer: 1 });
		expect(off.shenshaLayer).toBe(false);
		expect(on.shenshaLayer).toBe(true);
	});
});

describe('一掌经压测 · 组合/一致性/回归', () => {
	it('多选项笛卡尔组合(2^5×3)全部合法、无崩', () => {
		const B = { yearBranch: '巳', month: 5, day: 17, hourBranch: '酉', gender: '男' };
		let n = 0;
		[7, 10].forEach((N) => {
			['mi', 'age1'].forEach((sa) => {
				['ri', 'yue'].forEach((xs) => {
					['A', 'B', 'C'].forEach((fs) => {
						['shiShang', 'shuZhiMao'].forEach((mg) => {
							RULES.forEach((rule) => {
								const r = calcYizhangjing({ ...B, opts: { dayunLength: N, dayunStartAge: sa, xiaoxianStart: xs, flowShenSet: fs, mingGongMethod: mg, shunniRule: rule } });
								expect(validChart(r)).toBe(true);
								expect(r.opts.N).toBe(N);
								expect(r.opts.flowSet).toBe(fs);
								n += 1;
							});
						});
					});
				});
			});
		});
		expect(n).toBe(2 * 2 * 2 * 3 * 2 * 2);
	});
	it('确定性:同入参同 opts → 同输出', () => {
		const inp = { yearBranch: '午', month: 5, day: 20, hourBranch: '酉', gender: '男', opts: { dayunLength: 7, flowShenSet: 'A' } };
		expect(JSON.stringify(calcYizhangjing(inp))).toBe(JSON.stringify(calcYizhangjing(inp)));
	});
	it('非法/空入参 → null,不崩', () => {
		expect(calcYizhangjing({ yearBranch: '', month: 5, day: 1, hourBranch: '酉', gender: '男' })).toBeNull();
		expect(calcYizhangjing({ yearBranch: '巳', month: null, day: 1, hourBranch: '酉', gender: '男' })).toBeNull();
		expect(calcYizhangjing({ yearBranch: '巳', month: 5, day: 0, hourBranch: 'Z', gender: '男' })).toBeNull();
		expect(resolveLunarInput(null, {})).toBeNull();
	});
	it('golden 回归:4 古本例仍 byte-perfect(数至卯命宫)', () => {
		const cases = [
			{ i: { yearBranch: '巳', month: 2, day: 7, hourBranch: '寅', gender: '女' }, o: { shunniRule: 'yangNanYinNv', mingGongMethod: 'shuZhiMao' }, s: ['天文', '天福', '天貴', '天權'], mg: '天破' },
			{ i: { yearBranch: '巳', month: 2, day: 7, hourBranch: '寅', gender: '男' }, o: { shunniRule: 'yangNanYinNv', mingGongMethod: 'shuZhiMao' }, s: ['天文', '天奸', '天藝', '天孤'], mg: '天驛' },
			{ i: { yearBranch: '巳', month: 5, day: 17, hourBranch: '酉', gender: '男' }, o: { shunniRule: 'yangNanYinNv', mingGongMethod: 'shuZhiMao' }, s: ['天文', '天厄', '天刃', '天貴'], mg: '天福' },
			{ i: { yearBranch: '子', month: 1, day: 9, hourBranch: '酉', gender: '男' }, o: { shunniRule: 'menShunNvNi', mingGongMethod: 'shuZhiMao' }, s: ['天貴', '天貴', '天孤', '天文'], mg: '天壽' },
		];
		cases.forEach((c) => {
			const r = calcYizhangjing({ ...c.i, opts: c.o });
			expect(r.pillars.map((p) => p.star)).toEqual(c.s);
			expect(r.mingStar).toBe(c.mg);
		});
	});
});

// WP-F/H 新开关笛卡尔积：annualMethod × xiaoxianDir × leapRule × starNaming × daoTerm × gradeSet × zaoZi
describe('一掌经压测 · 新流派开关笛卡尔(不抛+确定性+null降级)', () => {
	const BZ = { nongli: { yearGZByLunar: '丁巳', shengXiaoLunar: '蛇', monthNum: 5, dayNum: 17, leap: false, clockTime: '1977-06-01 23:10:00' }, fourColumns: { time: { ganzi: '己酉' }, day: { ganzi: '戊申' }, month: { ganzi: '丙午' }, year: { ganzi: '丁巳' } }, gender: 'Male' };
	const AXES = {
		annualMethod: ['xiaoxian', 'liunian'],
		xiaoxianDir: ['chart', 'always'],
		leapRule: ['half', 'midnight'],
		starNaming: ['A', 'B', 'C'],
		daoTerm: ['gui', 'edao'],
		gradeSet: ['standard', 'variant'],
		zaoZiAdjust: [false, true],
	};
	it('192 组合全部产合法模型、零崩、快照非空、确定', () => {
		let count = 0;
		for (const annualMethod of AXES.annualMethod) {
			for (const xiaoxianDir of AXES.xiaoxianDir) {
				for (const leapRule of AXES.leapRule) {
					for (const starNaming of AXES.starNaming) {
						for (const daoTerm of AXES.daoTerm) {
							for (const gradeSet of AXES.gradeSet) {
								for (const zaoZiAdjust of AXES.zaoZiAdjust) {
									const opts = { annualMethod, xiaoxianDir, leapRule, starNaming, daoTerm, gradeSet, zaoZiAdjust, mingGongMethod: 'shuZhiMao' };
									const m = buildYizhangjingModel(BZ, opts);
									expect(m).toBeTruthy();
									expect(m.chart.pillars).toHaveLength(4);
									expect(m.sishi.rows).toHaveLength(4);
									count++;
								}
							}
						}
					}
				}
			}
		}
		expect(count).toBe(2 * 2 * 2 * 3 * 2 * 2 * 2);
	});
	it('null/缺 bazi → 降级返 null 不抛', () => {
		expect(buildYizhangjingModel(null, { annualMethod: 'liunian' })).toBeNull();
		expect(buildYizhangjingModel({ nongli: {}, fourColumns: {} }, { gradeSet: 'variant' })).toBeNull();
	});
	it('未知开关值 → 回退默认不抛', () => {
		const m = buildYizhangjingModel(BZ, { annualMethod: 'xxx', starNaming: 'Z', daoTerm: 'q', gradeSet: 'foo', leapRule: 'bar' });
		expect(m).toBeTruthy();
		expect(m.naming).toBe('A'); // 非法星名回退 A
		expect(m.gradeSet).toBe('standard');
	});
});
