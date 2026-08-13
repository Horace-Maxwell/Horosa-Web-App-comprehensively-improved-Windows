// 玄空大卦深化 golden —— 二元八运 / 四数 / 两卦相见四档 / 五种交通。
// 🔴 星运是由传本生成规则推出的**封闭体系**：八运各恰 8 卦、合计 64。这个自洽性
//    本身就是最强校验 —— 规则抄错一处，计数立刻破。
import {
	ERYUAN_8YUN, eryuanAt, eryuanZhengLing, ERYUAN_NOTE,
	XINGYUN_MAP, XINGYUN_RULE, HOUTIAN_WEI, BAGONG_64, GUA8_LUOSHU, WEI_YANG, WEI_YIN,
	XIANGJIAN_4, xiangJianOf, ZONG_SELF_8, zongOf, QIXING_DAJIE_28,
	JIAOTONG_5, jiaotongWuxing, jiaotongGuayun, jiaotongQinyuan, jiaotongDajie,
	HEXIANGTONG_UNDEFINED, __selfCheck,
} from '../fengshuiDaguaDeepData';
import { GUA64_TABLE } from '../fengshuiData';

describe('二元八运', ()=>{
	it('八运齐（无五运），运序＝坤1巽2离3兑4艮6坎7震8乾9', ()=>{
		expect(ERYUAN_8YUN).toHaveLength(8);
		expect(ERYUAN_8YUN.map((e)=>e.yun)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
		expect(ERYUAN_8YUN.map((e)=>e.gua)).toEqual(['坤', '巽', '离', '兑', '艮', '坎', '震', '乾']);
		expect(ERYUAN_8YUN.some((e)=>e.yun === 5)).toBe(false);
	});
	it('起讫年逐运与传本相同（1864 起，2043 止，首尾相接无缝无叠）', ()=>{
		const G = [[1864, 1881], [1882, 1905], [1906, 1929], [1930, 1953],
			[1954, 1974], [1975, 1995], [1996, 2016], [2017, 2043]];
		ERYUAN_8YUN.forEach((e, i)=>{ expect([e.from, e.to]).toEqual(G[i]); });
		for (let i = 1; i < ERYUAN_8YUN.length; i++) {
			expect(ERYUAN_8YUN[i].from).toBe(ERYUAN_8YUN[i - 1].to + 1);
		}
	});
	it('🔴 年数＝阳爻×9＋阴爻×6（末运乾 27 年恰合，前七运亦逐运自洽）', ()=>{
		ERYUAN_8YUN.forEach((e)=>{
			expect(e.yang + e.yin).toBe(3);
			expect(e.byYao).toBe(e.yang * 9 + e.yin * 6);
		});
		// 坤三阴＝18、乾三阳＝27、巽离兑＝24、艮坎震＝21
		const m = {}; ERYUAN_8YUN.forEach((e)=>{ m[e.gua] = e.byYao; });
		expect(m).toEqual({ 坤: 18, 巽: 24, 离: 24, 兑: 24, 艮: 21, 坎: 21, 震: 21, 乾: 27 });
		expect(ERYUAN_8YUN.find((e)=>e.gua === '乾').years).toBe(27);
	});
	it('按年取运；域外返回 null（不外推）', ()=>{
		expect(eryuanAt(2026).yun).toBe(9);
		expect(eryuanAt(2026).gua).toBe('乾');
		expect(eryuanAt(1996).yun).toBe(8);
		expect(eryuanAt(1863)).toBeNull();
		expect(eryuanAt(2044)).toBeNull();
	});
	it('正神零神按上下四运二分且互为补集', ()=>{
		expect(eryuanZhengLing(3)).toEqual({ yuan: '上元', zheng: [1, 2, 3, 4], ling: [9, 8, 7, 6] });
		expect(eryuanZhengLing(9)).toEqual({ yuan: '下元', zheng: [6, 7, 8, 9], ling: [4, 3, 2, 1] });
		[1, 2, 3, 4, 6, 7, 8, 9].forEach((y)=>{
			const r = eryuanZhengLing(y);
			expect(r.zheng.concat(r.ling).sort((a, b)=>a - b)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
		});
		expect(ERYUAN_NOTE).toMatch(/无五运/);
	});
});

describe('星运（卦运）· 生成规则自洽', ()=>{
	it('🔴 六十四卦全覆盖，八运各恰 8 卦（规则抄错一处，此处立破）', ()=>{
		expect(__selfCheck.total).toBe(64);
		expect(__selfCheck.byYun).toEqual({ 1: 8, 2: 8, 3: 8, 4: 8, 6: 8, 7: 8, 8: 8, 9: 8 });
		expect(__selfCheck.byYun[5]).toBeUndefined();     // 无五运
	});
	it('父卦＝八纯卦为一运', ()=>{
		['乾为天', '兑为泽', '离为火', '震为雷', '巽为风', '坎为水', '艮为山', '坤为地'].forEach((n)=>{
			expect(XINGYUN_MAP[n].yun).toBe(1);
			expect(XINGYUN_MAP[n].cls).toBe('父卦');
		});
	});
	it('母卦＝夫妇正配八卦为九运（泰否损咸既济未济恒益）', ()=>{
		['地天泰', '天地否', '山泽损', '泽山咸', '水火既济', '火水未济', '雷风恒', '风雷益'].forEach((n)=>{
			expect(XINGYUN_MAP[n].yun).toBe(9);
			expect(XINGYUN_MAP[n].cls).toBe('母卦');
		});
	});
	it('江东卦：父卦变初/二/三爻＝八/七/六运（乾为体逐条）', ()=>{
		expect(XINGYUN_MAP['天风姤'].yun).toBe(8);
		expect(XINGYUN_MAP['天火同人'].yun).toBe(7);
		expect(XINGYUN_MAP['天泽履'].yun).toBe(6);
		['天风姤', '天火同人', '天泽履'].forEach((n)=>{ expect(XINGYUN_MAP[n].cls).toBe('江东卦'); });
	});
	it('江西卦：母卦变初/二/三爻＝二/三/四运（否为体逐条）', ()=>{
		expect(XINGYUN_MAP['天雷无妄'].yun).toBe(2);
		expect(XINGYUN_MAP['天水讼'].yun).toBe(3);
		expect(XINGYUN_MAP['天山遁'].yun).toBe(4);
		['天雷无妄', '天水讼', '天山遁'].forEach((n)=>{ expect(XINGYUN_MAP[n].cls).toBe('江西卦'); });
	});
	it('四类生成规则一一在册', ()=>{
		expect(XINGYUN_RULE).toHaveLength(8);
		expect(new Set(XINGYUN_RULE.map((r)=>r.cls)).size).toBe(3 + 1);   // 父/母/江东/江西
	});
});

describe('后天卦位（八宫）', ()=>{
	it('八宫各 8 卦、合计 64，且宫数＝该宫后天数', ()=>{
		expect(__selfCheck.gongTotal).toBe(64);
		Object.keys(BAGONG_64).forEach((g)=>{
			expect(BAGONG_64[g]).toHaveLength(8);
			BAGONG_64[g].forEach((n)=>{ expect(HOUTIAN_WEI[n].num).toBe(GUA8_LUOSHU[g]); });
		});
		expect(HOUTIAN_WEI['乾为天'].num).toBe(6);
		expect(HOUTIAN_WEI['水泽节'].num).toBe(1);        // 节卦属坎宫
	});
	it('八宫卦名与 GUA64_TABLE 完全同名（差一字即查不到）', ()=>{
		const all = new Set();
		Object.keys(GUA64_TABLE).forEach((l)=>Object.keys(GUA64_TABLE[l]).forEach((u)=>all.add(GUA64_TABLE[l][u])));
		expect(all.size).toBe(64);
		Object.keys(HOUTIAN_WEI).forEach((n)=>{ expect(all.has(n)).toBe(true); });
	});
	it('阴阳：乾6坎1艮8震3为阳，巽4离9坤2兑7为阴（互补且覆盖八数）', ()=>{
		expect([...WEI_YANG].sort()).toEqual([1, 3, 6, 8]);
		expect([...WEI_YIN].sort()).toEqual([2, 4, 7, 9]);
	});
});

describe('两卦相见四档', ()=>{
	it('夫妇正配四对最吉', ()=>{
		[[6, 2], [3, 4], [9, 1], [8, 7]].forEach(([a, b])=>{
			expect(xiangJianOf(a, b).name).toBe('夫妇正配');
			expect(xiangJianOf(b, a).name).toBe('夫妇正配');     // 无序
			expect(xiangJianOf(a, b).jx).toBe('good');
		});
	});
	it('次吉六对、不吉五对逐条', ()=>{
		[[1, 4], [1, 7], [2, 8], [3, 9], [6, 7], [8, 9]].forEach(([a, b])=>{ expect(xiangJianOf(a, b).rank).toBe(2); });
		[[1, 2], [2, 3], [3, 7], [4, 8], [6, 9]].forEach(([a, b])=>{ expect(xiangJianOf(a, b).rank).toBe(3); });
		expect(XIANGJIAN_4.map((g)=>g.pairs.length)).toEqual([4, 6, 5]);
	});
	it('🔴 纯阳相见 / 纯阴相见＝阴阳相乘，凶', ()=>{
		[[6, 1], [1, 8], [8, 3], [3, 6]].forEach(([a, b])=>{
			const r = xiangJianOf(a, b);
			expect(r.rank).toBe(4); expect(r.jx).toBe('bad'); expect(r.pure).toBe('纯阳');
		});
		[[4, 9], [9, 2], [2, 7], [7, 4]].forEach(([a, b])=>{
			expect(xiangJianOf(a, b).pure).toBe('纯阴');
		});
	});
	it('传本未列之异阴阳组合据实标出，不硬判吉凶', ()=>{
		const r = xiangJianOf(2, 6);              // 6-2 已列 → 换一个未列的
		expect(r.name).toBe('夫妇正配');
		const u = xiangJianOf(4, 6);              // 阳6 阴4，四档未列
		expect(u.rank).toBe(0);
		expect(u.jx).toBe('neutral');
		expect(u.text).toMatch(/不臆断/);
	});
	it('同一对数在四档中不重复登记（重复＝判据自相矛盾）', ()=>{
		const seen = new Set();
		XIANGJIAN_4.forEach((g)=>g.pairs.forEach(([a, b])=>{
			const k = [a, b].sort().join('-');
			expect(seen.has(k)).toBe(false); seen.add(k);
		}));
	});
});

describe('综卦与七星打劫二十八对', ()=>{
	it('🔴 恰二十八对（三十二对去八自综卦）', ()=>{
		expect(QIXING_DAJIE_28).toHaveLength(28);
		expect(__selfCheck.dajiePairs).toBe(28);
		expect(ZONG_SELF_8).toHaveLength(8);
	});
	it('八自综卦确为自身之倒象', ()=>{
		const named = { 乾为天: ['乾', '乾'], 坤为地: ['坤', '坤'], 山雷颐: ['震', '艮'], 泽风大过: ['巽', '兑'],
			坎为水: ['坎', '坎'], 离为火: ['离', '离'], 风泽中孚: ['兑', '巽'], 雷山小过: ['艮', '震'] };
		Object.keys(named).forEach((n)=>{
			const [l, u] = named[n];
			expect(zongOf(l, u).name).toBe(n);
		});
	});
	it('传本举例：屯与蒙、需与讼互为综卦', ()=>{
		expect(jiaotongDajie('水雷屯', '山水蒙').ge).toBe('七星打劫');
		expect(jiaotongDajie('水天需', '天水讼').ge).toBe('七星打劫');
		expect(jiaotongDajie('水雷屯', '天水讼').ge).toBe('无打劫');
	});
	it('自综八卦不入打劫（据实说明，不误报吉）', ()=>{
		const r = jiaotongDajie('乾为天', '坤为地');
		expect(r.ge).toBe('无打劫');
		expect(r.text).toMatch(/八自综卦/);
	});
	it('二十八对两两不重、且不含自综卦', ()=>{
		const seen = new Set();
		QIXING_DAJIE_28.forEach((p)=>{
			expect(p.a).not.toBe(p.b);
			expect(ZONG_SELF_8).not.toContain(p.a);
			expect(ZONG_SELF_8).not.toContain(p.b);
			const k = [p.a, p.b].sort().join('|');
			expect(seen.has(k)).toBe(false); seen.add(k);
		});
	});
});

describe('五种交通', ()=>{
	it('五类齐备且吉格数与传本相同', ()=>{
		expect(JIAOTONG_5.map((j)=>j.key)).toEqual(['wuxing', 'guayun', 'qinyuan', 'dajie', 'houtian']);
		expect(JIAOTONG_5.find((j)=>j.key === 'wuxing').ge).toHaveLength(3);
		expect(JIAOTONG_5.find((j)=>j.key === 'guayun').ge).toHaveLength(4);
	});
	it('五行交通：一卦纯清 / 合五合十合十五 / 合生成', ()=>{
		expect(jiaotongWuxing(3, 3).ge).toBe('一卦纯清');
		expect(jiaotongWuxing(1, 4).ge).toBe('合中·合五');
		expect(jiaotongWuxing(2, 8).ge).toBe('合中·合十');
		expect(jiaotongWuxing(6, 9).ge).toBe('合中·合十五');
		expect(jiaotongWuxing(1, 6).ge).toBe('合生成');
		expect(jiaotongWuxing(1, 3).ge).toBe('不合');
	});
	it('卦运交通：同运 / 合中 / 合生成', ()=>{
		expect(jiaotongGuayun(8, 8).ge).toBe('同运');
		expect(jiaotongGuayun(3, 7).ge).toBe('合中·合十');
		expect(jiaotongGuayun(4, 9).ge).toBe('合生成');
	});
	it('🔴「合相通」传本未给判据 → 据实标注，绝不自造规则', ()=>{
		expect(HEXIANGTONG_UNDEFINED).toMatch(/未给出判据/);
		expect(jiaotongGuayun(2, 6).undefinedGe).toBe(HEXIANGTONG_UNDEFINED);
		expect(jiaotongGuayun(8, 8).undefinedGe).toBeUndefined();     // 已判吉者不再挂未定说明
	});
	it('亲缘交通：同宫为一家骨肉', ()=>{
		expect(jiaotongQinyuan('乾为天', '天风姤').ge).toBe('一家骨肉');
		expect(jiaotongQinyuan('乾为天', '坎为水').ge).toBe('非一家');
	});
	it('缺参一律返回 null（不产半成品判断）', ()=>{
		expect(jiaotongWuxing(0, 3)).toBeNull();
		expect(jiaotongGuayun(3, null)).toBeNull();
		expect(jiaotongQinyuan('X', '乾为天')).toBeNull();
		expect(jiaotongDajie('', '乾为天')).toBeNull();
		expect(xiangJianOf(null, 6)).toBeNull();
	});
});
