// 大玄空（单盘挨星）golden —— 逐条锚古籍原文与其四个算例盘。
// 🔴 这些盘是法律：古籍逐宫列出的数字，任何改动令其中一格不符即为算法回归。
import { daxuankong, yuanOf, starNature, palaceStar } from '../daxuankong';
import { DAXUANKONG_AISTAR_YANG, DAXUANKONG_AISTAR_YIN, DAXUANKONG_YANG_JUE, fumuStarOf } from '../fengshuiLiqiDeepData';
import { SHAN_ORDER } from '../fengshuiData';

const starsOf = (r)=>{ const m = {}; r.palaces.forEach((p)=>{ m[p.gong] = p.star; }); return m; };

describe('大玄空 · 挨星诀基表', ()=>{
	test('阳宅挨星诀八句覆盖二十四山，且五黄无对应山', ()=>{
		expect(DAXUANKONG_YANG_JUE).toHaveLength(8);
		const all = DAXUANKONG_YANG_JUE.reduce((a, g)=>a.concat(g.shans), []);
		expect(all).toHaveLength(24);
		expect(new Set(all).size).toBe(24);
		expect(new Set(all)).toEqual(new Set(SHAN_ORDER));
		expect(DAXUANKONG_YANG_JUE.map((g)=>g.star).sort((a, b)=>a - b)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
		expect(Object.values(DAXUANKONG_AISTAR_YANG)).not.toContain(5);
	});

	// 古籍阴宅八句：甲癸申7 / 坤壬乙8 / 子卯未9 / 戌乾巳1 / 辰巽亥3 / 艮丙辛4 / 寅庚丁5 / 午酉丑6。
	test('阴宅父母星＝阳宅挨星进七位（闭式 +6 mod 9），逐句与古籍所列一致', ()=>{
		const expected = { 甲: 7, 癸: 7, 申: 7, 坤: 8, 壬: 8, 乙: 8, 子: 9, 卯: 9, 未: 9, 戌: 1, 乾: 1, 巳: 1,
			辰: 3, 巽: 3, 亥: 3, 艮: 4, 丙: 4, 辛: 4, 寅: 5, 庚: 5, 丁: 5, 午: 6, 酉: 6, 丑: 6 };
		expect(DAXUANKONG_AISTAR_YIN).toEqual(expected);
		// 闭式自证：逐山 +6 mod 9。
		SHAN_ORDER.forEach((s)=>{ expect(DAXUANKONG_AISTAR_YIN[s]).toBe(fumuStarOf(DAXUANKONG_AISTAR_YANG[s])); });
	});

	test('元属：上四运上元／下四运下元／五运前十年归上、后十年归下', ()=>{
		[1, 2, 3, 4].forEach((y)=>expect(yuanOf(y)).toBe('shang'));
		[6, 7, 8, 9].forEach((y)=>expect(yuanOf(y)).toBe('xia'));
		expect(yuanOf(5, 'first')).toBe('shang');
		expect(yuanOf(5, 'second')).toBe('xia');
	});

	test('正零神与顺逆：上元1234正神阳顺／下元6789正神阳顺，余为零神阴逆', ()=>{
		[1, 2, 3, 4].forEach((s)=>{ expect(starNature(s, 'shang')).toMatchObject({ role: 'zheng', forward: true }); });
		[6, 7, 8, 9].forEach((s)=>{ expect(starNature(s, 'shang')).toMatchObject({ role: 'ling', forward: false }); });
		[6, 7, 8, 9].forEach((s)=>{ expect(starNature(s, 'xia')).toMatchObject({ role: 'zheng', forward: true }); });
		[1, 2, 3, 4].forEach((s)=>{ expect(starNature(s, 'xia')).toMatchObject({ role: 'ling', forward: false }); });
		// 五黄两列皆无位 —— 不臆造，标 unknown。
		expect(starNature(5, 'shang').unknown).toBe(true);
		expect(starNature(5, 'xia').unknown).toBe(true);
	});

	test('宫星公式：入中星 ±(宫洛书数−5)', ()=>{
		expect(palaceStar(7, 8, true)).toBe(1);    // 7 + 3 = 10 → 1
		expect(palaceStar(2, 1, true)).toBe(7);    // 2 − 4 = −2 → 7
		expect(palaceStar(2, 9, false)).toBe(7);   // 2 − 4 = −2 → 7（逆飞）
		expect(palaceStar(9, 5, true)).toBe(9);
	});
});

describe('大玄空 · 古籍四算例逐宫对拍', ()=>{
	// 算例一（阳宅·下元艮山坤向）：艮丙辛位位是破军 → 7 入中；下元七为正神阳星 → 顺飞。
	// 古籍盘：坎3 坤4 震5 巽6 中7 乾8 兑9 艮1 离2。
	test('下元八运 艮山坤向 阳宅：7入中顺飞，八宫逐格与古籍一致', ()=>{
		const r = daxuankong({ zuoShan: '艮', yun: 8, zhaiType: 'yang' });
		expect(r.available).toBe(true);
		expect(r.center).toBe(7);
		expect(r.yuan).toBe('xia');
		expect(r.centerNature).toMatchObject({ role: 'zheng', yinYang: '阳', forward: true });
		expect(starsOf(r)).toEqual({ 1: 3, 2: 4, 3: 5, 4: 6, 6: 8, 7: 9, 8: 1, 9: 2 });
	});

	// 算例二（阳宅·上元壬山丙向）：坤壬乙巨门 → 2 入中；上元二为正神阳星 → 顺飞。
	// 古籍标出：离6 巽1 坤8 艮5。
	test('上元一运 壬山丙向 阳宅：2入中顺飞，离6/巽1/坤8/艮5', ()=>{
		const r = daxuankong({ zuoShan: '壬', yun: 1, zhaiType: 'yang' });
		expect(r.center).toBe(2);
		expect(r.yuan).toBe('shang');
		expect(r.forward).toBe(true);
		expect(starsOf(r)).toEqual({ 1: 7, 2: 8, 3: 9, 4: 1, 6: 3, 7: 4, 8: 5, 9: 6 });
	});

	// 算例三（阳宅·下元壬山丙向）：2 入中；下元二为零神阴星 → 逆飞。古籍标出：离7 巽3 坤5。
	test('下元七运 壬山丙向 阳宅：2入中逆飞，离7/巽3/坤5', ()=>{
		const r = daxuankong({ zuoShan: '壬', yun: 7, zhaiType: 'yang' });
		expect(r.center).toBe(2);
		expect(r.yuan).toBe('xia');
		expect(r.centerNature).toMatchObject({ role: 'ling', yinYang: '阴', forward: false });
		const m = starsOf(r);
		expect(m[9]).toBe(7); expect(m[4]).toBe(3); expect(m[2]).toBe(5);
		expect(m).toEqual({ 1: 6, 2: 5, 3: 4, 4: 3, 6: 1, 7: 9, 8: 8, 9: 7 });
	});

	// 算例四（阴宅·子山午向）：子卯未三碧 → 阳宅3、父母星9；上元九为零神逆飞，下元九为正神顺飞。
	test('阴宅 子山午向：父母星9入中，上元逆飞／下元顺飞', ()=>{
		const up = daxuankong({ zuoShan: '子', yun: 1, zhaiType: 'yin' });
		expect(up.center).toBe(9);
		expect(up.forward).toBe(false);
		const dn = daxuankong({ zuoShan: '子', yun: 8, zhaiType: 'yin' });
		expect(dn.center).toBe(9);
		expect(dn.forward).toBe(true);
		// 同一坐山，阳宅盘与阴宅盘必不同源（父母星≠挨星）。
		expect(daxuankong({ zuoShan: '子', yun: 8, zhaiType: 'yang' }).center).toBe(3);
	});
});

describe('大玄空 · 合局反局与八条断应', ()=>{
	test('正神方满为合、临水为反；零神方水空为合、满实为反', ()=>{
		// 下元八运艮山：坎宫星3（下元零神）、乾宫星8（下元正神）。
		const he = daxuankong({ zuoShan: '艮', yun: 8, envs: { 1: 'lai', 6: 'man' } });
		const kan = he.palaces.find((p)=>p.gong === 1);
		const qian = he.palaces.find((p)=>p.gong === 6);
		expect(kan.role).toBe('ling'); expect(kan.jx).toBe('good');
		expect(qian.role).toBe('zheng'); expect(qian.jx).toBe('good');
		expect(he.ju.key).toBe('he');

		const fan = daxuankong({ zuoShan: '艮', yun: 8, envs: { 1: 'man', 6: 'kong' } });
		expect(fan.palaces.find((p)=>p.gong === 1).jx).toBe('bad');
		expect(fan.palaces.find((p)=>p.gong === 6).jx).toBe('bad');
		expect(fan.ju.key).toBe('fan');
	});

	test('五黄方忌出水（上下元同）；来水聚水则可', ()=>{
		// 下元八运艮山：震宫星5。
		const bad = daxuankong({ zuoShan: '艮', yun: 8, envs: { 3: 'qu' } });
		const zhen = bad.palaces.find((p)=>p.gong === 3);
		expect(zhen.star).toBe(5);
		expect(zhen.jx).toBe('bad');
		expect(zhen.wuHuangWarn).toMatch(/五黄方出水/);
		const ok = daxuankong({ zuoShan: '艮', yun: 8, envs: { 3: 'lai' } });
		expect(ok.palaces.find((p)=>p.gong === 3).wuHuangWarn).toMatch(/来水聚水/);
	});

	test('水破令星：当令之星见去水口主损丁', ()=>{
		// 下元八运艮山：艮宫星1、乾宫星8＝当令。
		const r = daxuankong({ zuoShan: '艮', yun: 8, envs: { 6: 'qu' } });
		const qian = r.palaces.find((p)=>p.gong === 6);
		expect(qian.star).toBe(8);
		expect(qian.poLing).toBe(true);
		expect(qian.verdict).toMatch(/水破令星/);
	});

	test('合十主财／合生成主文贵（挨星与当令运数相较）', ()=>{
		const r = daxuankong({ zuoShan: '艮', yun: 8 });
		expect(r.palaces.find((p)=>p.star === 2).heShi).toBe(true);   // 8+2=10
		expect(r.palaces.find((p)=>p.star === 3).heSC).toBe(true);    // 3-8 合生成
		expect(r.palaces.find((p)=>p.star === 4).heShi).toBe(false);
	});

	test('八条断应齐备且首条为「峦头为体·理气为用」', ()=>{
		const r = daxuankong({ zuoShan: '子', yun: 9 });
		expect(r.duanying).toHaveLength(8);
		expect(r.duanying[0].key).toBe('tiyong');
		expect(r.duanying.map((d)=>d.key)).toEqual(['tiyong', 'duanren', 'poling', 'wuhuang', 'quyong', 'yingqi', 'heshu', 'shutu']);
	});

	test('五运前后十年切元；非法坐山返回不可用', ()=>{
		expect(daxuankong({ zuoShan: '子', yun: 5, wuYunHalf: 'first' }).yuan).toBe('shang');
		expect(daxuankong({ zuoShan: '子', yun: 5, wuYunHalf: 'second' }).yuan).toBe('xia');
		expect(daxuankong({ zuoShan: 'X', yun: 8 }).available).toBe(false);
		expect(daxuankong({ zuoShan: '子', yun: 99 }).available).toBe(false);
	});

	test('阴宅寅山父母星＝五黄入中：不臆造正零，标 unknown 并出注', ()=>{
		const r = daxuankong({ zuoShan: '寅', yun: 8, zhaiType: 'yin' });
		expect(r.center).toBe(5);
		expect(r.wuHuangUnknown).toBe(true);
		expect(r.wuHuangNote).toMatch(/未载/);
	});

	test('二十四山 × 九运 × 阴阳宅 全穷举：恒出八宫、星值域 1..9、不抛不 NaN', ()=>{
		SHAN_ORDER.forEach((s)=>{
			[1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((y)=>{
				['yang', 'yin'].forEach((t)=>{
					const r = daxuankong({ zuoShan: s, yun: y, zhaiType: t });
					expect(r.available).toBe(true);
					expect(r.palaces).toHaveLength(8);
					r.palaces.forEach((p)=>{
						expect(Number.isInteger(p.star)).toBe(true);
						expect(p.star).toBeGreaterThanOrEqual(1);
						expect(p.star).toBeLessThanOrEqual(9);
					});
					// 一盘八宫星值互异（飞泊本性）。
					expect(new Set(r.palaces.map((p)=>p.star)).size).toBe(8);
				});
			});
		});
	});
});
