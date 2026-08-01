// 河洛分歧开关「真实生效」矩阵:杜绝死开关(勾了没变)。
//   ① 内核单元测(定论级):wuJiGong/transformHoutian/yuanTangPure 逐 opt 两取值 → 输出必不同。
//   ② calc 端到端透传:ziShu/gender/liunian 整盘扫描判别 + 寄宫可达且 jiGong 透传 + 纯乾坤/至尊可达。
//   ③ 确定性 golden(铁值·非臆造):jiNian / wangShuai(真卦名) / shiJi 结构。④ 全 opts 笛卡尔不抛。
import {
	calculate, daYun, liuNian, liuYue, jiNian, wangShuai, shiJi, judge,
	transformHoutian, wuJiGong, yuanTangPure, guaLines, NAME_TO_TRI, buildSnapshotText,
	solarTermHuagong,
} from '../heluoLocal';

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_ZUN = ['坎為水', '水雷屯', '水山蹇'];
const FP_CASES = [
	{ fourPillars: { year: '甲子', month: '丙寅', day: '庚申', hour: '庚辰' }, birthYear: 1984 },
	{ fourPillars: { year: '乙丑', month: '戊寅', day: '辛酉', hour: '己亥' }, birthYear: 1985 },
	{ fourPillars: { year: '壬午', month: '丙午', day: '戊子', hour: '壬子' }, birthYear: 2002 },
	{ fourPillars: { year: '丁卯', month: '癸卯', day: '丙寅', hour: '甲午' }, birthYear: 1987 },
	{ fourPillars: { year: '己巳', month: '庚午', day: '癸亥', hour: '辛酉' }, birthYear: 1989 },
	{ fourPillars: { year: '癸酉', month: '辛酉', day: '乙卯', hour: '丁丑' }, birthYear: 1993 },
	{ fourPillars: { year: '戊寅', month: '甲寅', day: '壬戌', hour: '丙午' }, birthYear: 1998 },
	{ fourPillars: { year: '庚辰', month: '戊子', day: '甲子', hour: '甲子' }, birthYear: 2000 },
];
const GENDERS = ['男', '女'];

function calc(fc, gender, monthZhi, opts) {
	return calculate({ fourPillars: fc.fourPillars, gender, hourZhi: '辰', birthYear: fc.birthYear, monthZhi, opts });
}
function sig(c) { return `${c.xian.name}|${c.xian.yuan}|${c.hou.name}|${c.hou.yuan}|${c.tian}|${c.di}`; }
function existsDiff(optsA, optsB) {
	for (const fc of FP_CASES) {
		for (const gender of GENDERS) {
			for (const monthZhi of ZHI) {
				if (sig(calc(fc, gender, monthZhi, optsA)) !== sig(calc(fc, gender, monthZhi, optsB))) return true;
			}
		}
	}
	return false;
}

describe('①内核单元测:分歧开关逐个「真实生效」(定论级)', () => {
	test('五寄中宫 wuJiGong: manualSanYuan≠legacy(阴干男命 上元/下元 各异)', () => {
		// 阴干男命(yangGan=false,isMale=true → ay=false):上元 legacy=艮/manual=坤;下元 legacy=離/manual=兌
		expect(wuJiGong(5, false, true, 'legacy')).toBe('艮');
		expect(wuJiGong(5, false, true, 'manualSanYuan')).toBe('坤');
		expect(wuJiGong(80, false, true, 'legacy')).toBe('離');
		expect(wuJiGong(80, false, true, 'manualSanYuan')).toBe('兌');
		// 两 mode 至少一处必不同
		expect(wuJiGong(5, false, true, 'legacy')).not.toBe(wuJiGong(5, false, true, 'manualSanYuan'));
	});

	test('三至尊卦 transformHoutian: zhiZunEnabled true≠false(坎為水 九五阴令 变而不易)', () => {
		const xl = guaLines(NAME_TO_TRI['坎為水'].up, NAME_TO_TRI['坎為水'].low);
		const on = transformHoutian('坎為水', xl, 5, false, { zhiZunEnabled: true });   // 至尊:元堂不动
		const off = transformHoutian('坎為水', xl, 5, false, { zhiZunEnabled: false }); // 常规:上下卦互换、元堂易位
		expect(on.name !== off.name || on.yuan !== off.yuan).toBe(true);
		expect(on.yuan).toBe(5);        // 变而不易:元堂位不动
		expect(off.yuan).toBe(2);       // 常规:5>3 → 5-3=2
		// 非至尊卦名:开关无差(仅 3 卦触发)
		const gl = guaLines(NAME_TO_TRI['乾為天'].up, NAME_TO_TRI['乾為天'].low);
		expect(transformHoutian('乾為天', gl, 5, false, { zhiZunEnabled: true }).name)
			.toBe(transformHoutian('乾為天', gl, 5, false, { zhiZunEnabled: false }).name);
	});

	test('纯乾坤落爻 yuanTangPure: current≠alt(乾為天 女命阳令 元堂反向)', () => {
		const gua = { up: '乾', low: '乾', yangLing: true };
		const cur = yuanTangPure({ ...gua, pureGanKunVariant: 'current' }, '子', false); // 女命
		const alt = yuanTangPure({ ...gua, pureGanKunVariant: 'alt' }, '子', false);
		expect(cur).not.toBe(alt);
		expect(cur).toBe(6);  // reverse=true(女+阳令)→7-1
		expect(alt).toBe(1);  // 反向→base
	});
});

describe('②calc 端到端透传:opt 经 calculate 真达盘面', () => {
	test('取数法 ziShuMode: pair vs single → 存在判别盘', () => {
		expect(existsDiff({ ziShuMode: 'pair' }, { ziShuMode: 'single' })).toBe(true);
	});

	test('流年次步 liunianStep2: ying vs sequential → 动爻序列不同', () => {
		const fc = FP_CASES[0];
		const chart = calc(fc, '男', '寅', {});
		const dy = daYun(chart.xian, chart.hou, fc.birthYear);
		let diff = false;
		for (const seg of dy.all) {
			const p1 = liuNian(seg, fc.birthYear, { step2: 'ying' }).map((y) => y.pos).join(',');
			const p2 = liuNian(seg, fc.birthYear, { step2: 'sequential' }).map((y) => y.pos).join(',');
			if (p1 !== p2) { diff = true; break; }
		}
		expect(diff).toBe(true);
	});

	test('性别 gender: 男 vs 女 → 阳命盘先后天上下相盪(存在判别盘)', () => {
		let found = false;
		for (const fc of FP_CASES) {
			for (const monthZhi of ZHI) {
				if (sig(calc(fc, '男', monthZhi, {})) !== sig(calc(fc, '女', monthZhi, {}))) { found = true; break; }
			}
			if (found) break;
		}
		expect(found).toBe(true);
	});

	test('取化工法 quHuaGong: tuWangKunGen vs siFangBoOnly → 土用期化工卦不同(补坤艮 vs 不补)', () => {
		// 土用期(tuyong=true):土王寄坤艮法补「坤艮/反乾兑」,直取四方伯只取四方伯卦。取任一四立节气名。
		const tu = solarTermHuagong('立春', true, { quHuaGong: 'tuWangKunGen' });
		const bo = solarTermHuagong('立春', true, { quHuaGong: 'siFangBoOnly' });
		expect(tu.hg).toEqual(expect.arrayContaining(['坤', '艮']));   // 土王法:补坤艮
		expect(bo.hg).not.toEqual(expect.arrayContaining(['坤', '艮'])); // 四方伯:不补
		expect(tu.hg.length).toBeGreaterThan(bo.hg.length);
		expect(tu.tuyong).toBe(true);
		expect(bo.tuyong).toBe(false);
		// 非土用期:两法一致(仅土用期有别)
		expect(solarTermHuagong('立春', false, { quHuaGong: 'tuWangKunGen' }).hg)
			.toEqual(solarTermHuagong('立春', false, { quHuaGong: 'siFangBoOnly' }).hg);
	});

	test('流月起月 liuYueMode: ying vs legacy → 十二卦序不同(正月种子异)', () => {
		const seq = (mode) => liuYue([1, 1, 1, 0, 0, 1], 6, { mode }).map((m) => m.gua).join(',');
		expect(seq('ying')).not.toBe(seq('legacy'));
		// 默认(不传)== ying
		expect(liuYue([1, 1, 1, 0, 0, 1], 6).map((m) => m.gua).join(',')).toBe(seq('ying'));
	});

	// 回归护栏(修 saveSnap 陈旧 bug):快照文本随 liunianStep2 / huangdiOffset 变——
	// 卦身份可不变而这两项改快照,故 HeLuoMain.saveSnap 去重键必含 opts,否则 AI 挂载读陈旧盘。
	test('快照决定项: liunianStep2 / huangdiOffset 改 → buildSnapshotText 文本必变(卦身份可不变)', () => {
		const fc = FP_CASES[0];
		const mk = (opts) => {
			const chart = calc(fc, '男', '寅', opts);
			const jg = judge(chart, fc.fourPillars, '寅');
			const dy = daYun(chart.xian, chart.hou, fc.birthYear);
			const idKey = `${chart.xian.name}|${chart.xian.yuan}|${chart.hou.name}`;
			return { idKey, snap: buildSnapshotText(chart, jg, dy, { season: '春', opts }) };
		};
		const a = mk({ liunianStep2: 'ying', huangdiOffset: 2697 });
		const b = mk({ liunianStep2: 'sequential', huangdiOffset: 2697 });
		const c = mk({ liunianStep2: 'ying', huangdiOffset: 2698 });
		expect(a.idKey).toBe(b.idKey);   // 卦身份不变
		expect(a.snap).not.toBe(b.snap); // 快照却变(流年动爻) → 键须含 opts
		expect(a.idKey).toBe(c.idKey);
		expect(a.snap).not.toBe(c.snap); // 纪年变
	});

	// 合成四柱空间扫描:证 寄宫/纯乾坤/至尊 盘可由 calculate 产出(触发路径非死码)
	test('寄宫(取卦=5) 可达 且 jiGongMode 经 calc 透传改盘', () => {
		let hit = false;
		for (let a = 0; a < GAN.length && !hit; a += 1) {
			for (let b = 0; b < ZHI.length && !hit; b += 1) {
				const fp = { fourPillars: { year: '乙丑', month: '丁亥', day: GAN[a] + ZHI[b], hour: '甲子' }, birthYear: 1918 };
				// 1918=民国7(上元),乙=阴干,男命 → ay=false;若命中寄宫,legacy(艮)≠manual(坤)
				const m1 = calculate({ fourPillars: fp.fourPillars, gender: '男', hourZhi: '子', birthYear: 1918, monthZhi: '亥', opts: { jiGongMode: 'legacy' } });
				const m2 = calculate({ fourPillars: fp.fourPillars, gender: '男', hourZhi: '子', birthYear: 1918, monthZhi: '亥', opts: { jiGongMode: 'manualSanYuan' } });
				if (`${m1.tianGua}${m1.diGua}` !== `${m2.tianGua}${m2.diGua}`) hit = true;
			}
		}
		expect(hit).toBe(true);
	});

	// 扫描合成四柱空间,返回首个满足 pred(chart) 的 {fp, z2}(或 null)
	function scanChart(gender, pred) {
		for (const g1 of GAN) {
			for (const z1 of ZHI) {
				for (const g2 of GAN) {
					for (const z2 of ZHI) {
						const fp = { year: '甲子', month: '丙寅', day: g1 + z1, hour: g2 + z2 };
						const c = calculate({ fourPillars: fp, gender, hourZhi: z2, birthYear: 1984, monthZhi: '寅' });
						if (pred(c)) return { fp, z2 };
					}
				}
			}
		}
		return null;
	}

	test('纯乾坤盘 可达 且 pureGanKunVariant 经 calc 改元堂', () => {
		const pure = scanChart('女', (c) => c.xian.name === '乾為天' || c.xian.name === '坤為地');
		expect(pure).not.toBeNull();
		const base = { fourPillars: pure.fp, gender: '女', hourZhi: pure.z2, birthYear: 1984, monthZhi: '寅' };
		const cur = calculate({ ...base, opts: { pureGanKunVariant: 'current' } });
		const alt = calculate({ ...base, opts: { pureGanKunVariant: 'alt' } });
		expect(cur.xian.yuan).not.toBe(alt.xian.yuan);
	});

	test('至尊卦(坎為水/水雷屯/水山蹇)可由 calc 产出(触发路径可达)', () => {
		expect(scanChart('男', (c) => ZHI_ZUN.includes(c.xian.name))).not.toBeNull();
	});
});

describe('③确定性 golden(铁值·非臆造)', () => {
	test('纪年 jiNian: 1864 甲子 = 玄空上元一运起点', () => {
		expect(jiNian(1864)).toEqual({ huangdi: 1864 + 2697, huangdiOffset: 2697, yuan: '上元', yunNo: 1, ganzhi: '甲子' });
	});
	test('纪年 jiNian: 1984 甲子 = 下元七运(黄帝 4681)', () => {
		const jn = jiNian(1984);
		expect(jn.yuan).toBe('下元');
		expect(jn.yunNo).toBe(7);
		expect(jn.ganzhi).toBe('甲子');
		expect(jn.huangdi).toBe(1984 + 2697);
	});
	test('纪年 jiNian: 自定基准 offset 生效;非正年→null', () => {
		expect(jiNian(2000, { huangdiOffset: 2698 }).huangdi).toBe(2000 + 2698);
		expect(jiNian(0)).toBeNull();
	});

	test('卦气旺衰 wangShuai(真卦名): 乾為天(金) 秋旺 / 夏死 / 春囚', () => {
		expect(wangShuai('乾為天', '秋').up.state).toBe('旺');
		expect(wangShuai('乾為天', '夏').up.state).toBe('死');
		expect(wangShuai('乾為天', '春').up.state).toBe('囚');
		expect(wangShuai('乾為天', '秋').up.wuxing).toBe('金');
	});
	test('卦气旺衰 wangShuai: 坎為水(水) 冬旺;離為火(火) 夏旺;未知季/卦→null', () => {
		expect(wangShuai('坎為水', '冬').up.state).toBe('旺');
		expect(wangShuai('離為火', '夏').up.state).toBe('旺');
		expect(wangShuai('乾為天', 'X')).toBeNull();
		expect(wangShuai('無此卦', '春')).toBeNull();
	});

	test('AI 快照 buildSnapshotText: 传 season/opts → 含 [断验](纪年·卦气·十吉);3参旧调用不破', () => {
		const fc = FP_CASES[0];
		const chart = calc(fc, '男', '寅', {});
		const jg = judge(chart, fc.fourPillars, '寅');
		const dy = daYun(chart.xian, chart.hou, fc.birthYear);
		// 4 参:带 [断验]
		const snap = buildSnapshotText(chart, jg, dy, { season: '春', opts: { huangdiOffset: 2697 } });
		expect(snap).toContain('[断验]');
		expect(snap).toContain('纪年：黄帝');
		expect(snap).toContain('先天卦气：');
		expect(snap).toContain('十吉：');
		// monthZhi 亦可推季
		expect(buildSnapshotText(chart, jg, dy, { monthZhi: '寅' })).toContain('先天卦气：');
		// 无 season/opts:仍出 [断验] 的纪年/十吉(旺衰缺省略),3 参旧调用不抛
		const snap3 = buildSnapshotText(chart, jg, dy);
		expect(typeof snap3).toBe('string');
		expect(snap3).toContain('[断验]');
	});

	test('十吉 shiJi: 结构=10 项 + hitCount∈[0,10] + hit 与 items 一致', () => {
		const fc = FP_CASES[2];
		const chart = calc(fc, '女', '午', {});
		const jg = judge(chart, fc.fourPillars, '午');
		const sj = shiJi(chart, jg);
		expect(sj.items.length).toBe(10);
		expect(sj.hitCount).toBeGreaterThanOrEqual(0);
		expect(sj.hitCount).toBeLessThanOrEqual(10);
		expect(sj.hit.length).toBe(sj.hitCount);
		expect(sj.items.filter((x) => x.ok).length).toBe(sj.hitCount);
	});
});

describe('④全 opts 全链压测:6 维笛卡尔 × 四柱/性别/月支 → 全链不抛 + 结构完整', () => {
	const TRIGRAMS = ['乾', '坤', '震', '巽', '坎', '離', '艮', '兌'];
	function fullChainOk(fc, gender, monthZhi, opts) {
		const chart = calc(fc, gender, monthZhi, opts);
		if (!chart || !chart.xian.name || !chart.hou.name || chart.xian.lines.length !== 6) return false;
		if (!TRIGRAMS.includes(chart.tianGua) || !TRIGRAMS.includes(chart.diGua)) return false;
		const dy = daYun(chart.xian, chart.hou, fc.birthYear);
		if (!dy.all || dy.all.length !== 12) return false;
		// 流年(透传 step2)对每段不抛 + 动爻位合法
		for (const seg of dy.all) {
			const yrs = liuNian(seg, fc.birthYear, { step2: opts.liunianStep2 });
			if (!Array.isArray(yrs)) return false;
			if (yrs.some((y) => !(y.pos >= 1 && y.pos <= 6))) return false;
		}
		const jg = judge(chart, fc.fourPillars, monthZhi);
		if (!(jg.yuan && jg.huagong && jg.erShu && jg.yuanTang)) return false;
		const snap = buildSnapshotText(chart, jg, dy, { monthZhi, opts });
		if (typeof snap !== 'string' || snap.indexOf('[断验]') < 0) return false;
		return true;
	}

	test('ziShu×jiGong×zhiZun×pureGanKun×liunian(32) × 3四柱 × 2性别 × 2月支(384):全链恒真', () => {
		let n = 0;
		const fcSub = [FP_CASES[0], FP_CASES[4], FP_CASES[7]];
		['pair', 'single'].forEach((ziShuMode) => {
			['manualSanYuan', 'legacy'].forEach((jiGongMode) => {
				[true, false].forEach((zhiZunEnabled) => {
					['current', 'alt'].forEach((pureGanKunVariant) => {
						['ying', 'sequential'].forEach((liunianStep2) => {
							fcSub.forEach((fc) => {
								GENDERS.forEach((gender) => {
									['寅', '午'].forEach((monthZhi) => {
										const opts = { ziShuMode, jiGongMode, zhiZunEnabled, pureGanKunVariant, liunianStep2 };
										expect(fullChainOk(fc, gender, monthZhi, opts)).toBe(true);
										n += 1;
									});
								});
							});
						});
					});
				});
			});
		});
		expect(n).toBe(2 * 2 * 2 * 2 * 2 * 3 * 2 * 2); // 384
	});

	test('流月 liuYue 全域: 6 元堂位 × 多本卦 × 两档 → 恒 12 卦、动爻∈[1,6]、卦名合法', () => {
		const SAMPLE_LINES = [
			[1, 1, 1, 0, 0, 1], [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1],
			[1, 0, 1, 0, 1, 0], [0, 1, 0, 1, 0, 1], [1, 1, 0, 0, 1, 1],
		];
		let n = 0;
		SAMPLE_LINES.forEach((lines) => {
			for (let yuanPos = 1; yuanPos <= 6; yuanPos += 1) {
				['ying', 'legacy'].forEach((mode) => {
					const r = liuYue(lines.slice(), yuanPos, { mode });
					expect(r.length).toBe(12);
					r.forEach((mo) => {
						expect(mo.pos).toBeGreaterThanOrEqual(1);
						expect(mo.pos).toBeLessThanOrEqual(6);
						expect(mo.lines.length).toBe(6);
						expect(NAME_TO_TRI[mo.gua]).toBeTruthy();   // 卦名可解析(真 64 卦之一)
					});
					n += 1;
				});
			}
		});
		expect(n).toBe(6 * 6 * 2); // 72
	});

	test('纪年基准 huangdiOffset 极端/边界值 → jiNian 不抛且计算正确', () => {
		// 非默认有效值:直接生效
		expect(jiNian(1984, { huangdiOffset: 9999 }).huangdi).toBe(1984 + 9999);
		expect(jiNian(1984, { huangdiOffset: 100 }).huangdi).toBe(1984 + 100);
		// 0 / NaN / 缺省 → 引擎按 `|| 2697` 回退默认(offset 0 无意义,回退合理·与 UI parseInt||2697 一致)
		expect(jiNian(1984, { huangdiOffset: 0 }).huangdi).toBe(1984 + 2697);
		expect(jiNian(1984, { huangdiOffset: NaN }).huangdi).toBe(1984 + 2697);
		expect(jiNian(1984, {}).huangdi).toBe(1984 + 2697);
		expect(jiNian(1984, { huangdiOffset: 0 }).huangdiOffset).toBe(2697);
	});

	test('边界/冲突:空 opts / 未知枚举 / undefined / 全非法组合 → 全链回退默认不抛', () => {
		const fc = FP_CASES[1];
		expect(() => calc(fc, '男', '寅', {})).not.toThrow();
		expect(() => calc(fc, '男', '寅', { ziShuMode: 'zzz', jiGongMode: 'zzz', pureGanKunVariant: 'zzz', liunianStep2: 'zzz' })).not.toThrow();
		expect(() => calc(fc, '男', '寅', undefined)).not.toThrow();
		// 冲突:未知性别字符 → 引擎按非女即男处理,不抛
		expect(() => calc(fc, '?', '寅', {})).not.toThrow();
		// 未知月支 → chartExtras/judge 不抛
		const chart = calc(fc, '男', 'ZZ', {});
		expect(() => judge(chart, fc.fourPillars, 'ZZ')).not.toThrow();
		expect(() => buildSnapshotText(chart, judge(chart, fc.fourPillars, 'ZZ'), daYun(chart.xian, chart.hou, fc.birthYear), { monthZhi: 'ZZ', opts: {} })).not.toThrow();
	});
});
