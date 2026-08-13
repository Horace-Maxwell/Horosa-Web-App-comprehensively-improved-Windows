// 阳宅判断 golden —— 峦头断 / 理气断（内外局）/ 客星断（含飞太岁三算例）/ 选宅五原则 / 室内凶局。
// 🔴 两条口径在此机器钉死：
//   ① 形气为主、客星为用 —— 客星段恒带此告诫，且不单独定总断。
//   ② 峤星回风返气强化的是**对宫**之气（宫与对宫弄反即整条判反）。
import { zhaiduan, feiTaiSui } from '../zhaiduan';
import {
	WAI_LIUSHI_YAO, ZHAI_XING_8, XIONGGE_10, WAI_JU_6, NEI_JU_5, NEIWAI_4,
	DUAN_3, XUANZHAI_5, BIKAI_CHANGSUO_10, NEIJU_XINGXING_10, NEIJU_LIQI_2, KEXING_JUE,
} from '../fengshuiZhaiduanData';

const Z = (o)=>zhaiduan({ xiangShan: '午', yun: 8, ...o });

describe('数据完整性（传本枚举）', ()=>{
	it('外六事三纲 / 宅形八条 / 凶格十 / 外局六类 / 内六事五 / 三重点 / 五原则 / 特殊场所十', ()=>{
		expect(WAI_LIUSHI_YAO).toHaveLength(3);
		expect(ZHAI_XING_8).toHaveLength(8);
		expect(XIONGGE_10).toHaveLength(10);
		expect(WAI_JU_6).toHaveLength(6);
		expect(NEI_JU_5).toHaveLength(5);
		expect(DUAN_3).toHaveLength(3);
		expect(XUANZHAI_5).toHaveLength(5);
		expect(BIKAI_CHANGSUO_10).toHaveLength(10);
		expect(NEIWAI_4).toHaveLength(4);
		expect(KEXING_JUE).toHaveLength(2);
	});
	it('室内凶局：宅形不利十条 + 理气不合两条，原子项合计 ≥ 40', ()=>{
		expect(NEIJU_XINGXING_10).toHaveLength(10);
		expect(NEIJU_LIQI_2).toHaveLength(2);
		const n = NEIJU_XINGXING_10.concat(NEIJU_LIQI_2).reduce((a, c)=>a + c.atoms.length, 0);
		expect(n).toBeGreaterThanOrEqual(40);
	});
	it('缺角一条按八宫展开（每宫一项）', ()=>{
		const q = NEIJU_XINGXING_10.find((c)=>c.key === 'quejiao');
		expect(q.atoms).toHaveLength(8);
		expect(q.byGong).toBe(true);
		['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'].forEach((g)=>{
			expect(q.atoms.join('')).toContain(`${g}宫缺角`);
		});
	});
	it('内外局四象限逐条与传本同', ()=>{
		const t = {}; NEIWAI_4.forEach((q)=>{ t[`${q.inner}-${q.outer}`] = q.text; });
		expect(t['good-bad']).toBe('内吉外凶，仅许小康');
		expect(t['bad-good']).toBe('外吉内凶，难除瑕疵');
		expect(t['good-good']).toBe('内外皆吉，诸事顺利');
		expect(t['bad-bad']).toBe('内外皆凶，财丁两败，祸患无穷');
	});
	it('线位合法原则明写「磁子午线而非真子午线」', ()=>{
		expect(XUANZHAI_5.find((x)=>x.key === 'xianwei').text).toMatch(/磁\*\*子午线|磁子午线|磁\*\*/);
		expect(XUANZHAI_5.find((x)=>x.key === 'xianwei').text).toMatch(/而非真子午线/);
	});
});

describe('🔴 飞太岁（传本三算例逐年对拍）', ()=>{
	it('2013 癸巳 → 巽宫（巳属巽宫数四，五黄入中，四绿到巽）', ()=>{
		const f = feiTaiSui(2013, '巳');
		expect(f.num).toBe(4);
		expect(f.gong).toBe(4);
		expect(f.dir).toMatch(/巽/);
		expect(f.text).toMatch(/巳属巽宫数4/);
	});
	it('2014 甲午 → 坎宫', ()=>{
		expect(feiTaiSui(2014, '午').gong).toBe(1);
	});
	it('2015 乙未 → 巽宫', ()=>{
		expect(feiTaiSui(2015, '未').gong).toBe(4);
	});
	it('接入主入口后同值（客星卡里的飞太岁即此值）', ()=>{
		expect(Z({ year: 2013 }).keXing.feiTaiSui.gong).toBe(4);
		expect(Z({ year: 2014 }).keXing.feiTaiSui.gong).toBe(1);
		expect(Z({ year: 2015 }).keXing.feiTaiSui.gong).toBe(4);
	});
	it('缺参/非法支 → null（不硬凑）', ()=>{
		expect(feiTaiSui(0, '巳')).toBeNull();
		expect(feiTaiSui(2013, 'X')).toBeNull();
		expect(feiTaiSui(2013, '')).toBeNull();
	});
	it('全年份域遍历不抛，且宫恒在 1..9', ()=>{
		const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		for (let y = 1900; y <= 2043; y++) {
			const f = feiTaiSui(y, ZHI[(y - 1900 + 0) % 12]);
			expect(f).toBeTruthy();
			expect(f.gong).toBeGreaterThanOrEqual(1);
			expect(f.gong).toBeLessThanOrEqual(9);
		}
	});
});

describe('理气断 · 外局（收山出煞）', ()=>{
	it('未录外六事 → 不出行', ()=>{
		expect(Z({}).waiRows).toHaveLength(0);
	});
	it('高起之物看山星、属水之物看向星，生旺为合', ()=>{
		const r = Z({ waiJu: { 1: 'shan', 9: 'shui' } });
		expect(r.waiRows).toHaveLength(2);
		r.waiRows.forEach((x)=>{
			expect(typeof x.ok).toBe('boolean');
			expect(x.text).toMatch(x.kind === 'shan' ? /山星/ : /向星/);
		});
	});
	it('🔴 峤星强化的是对宫之气（宫与对宫不可弄反）', ()=>{
		const r = Z({ qiaoGong: 8 });
		expect(r.qiao.gong).toBe(8);
		expect(r.qiao.oppGong).toBe(2);            // 艮之对宫为坤
		expect(r.qiao.note).toMatch(/艮宫有峤星，回风返气强化对宫坤之气/);
		// 判据：本宫山星 + 对宫向星
		// 八运三吉＝当令 8 + 生气 9 + 次生 1；故「衰死」须取 2/3/4/5/6/7 之数。
		const pal = [];
		[1, 2, 3, 4, 6, 7, 8, 9].forEach((g)=>pal.push({ gong: g, shan: g === 8 ? 8 : 2, xiang: g === 2 ? 8 : 2, yun: 1 }));
		const good = zhaiduan({ palaces: pal, yun: 8, qiaoGong: 8 });
		expect(good.qiao.verdict.jx).toBe('good');
		const bad = zhaiduan({ palaces: pal.map((p)=>({ ...p, shan: 2, xiang: 2 })), yun: 8, qiaoGong: 8 });
		expect(bad.qiao.verdict.jx).toBe('bad');
		// 一合一不合 → 中评（不硬判吉凶）
		const half = zhaiduan({ palaces: pal.map((p)=>({ ...p, shan: p.gong === 8 ? 8 : 2, xiang: 2 })), yun: 8, qiaoGong: 8 });
		expect(half.qiao.verdict.jx).toBe('neutral');
	});
	it('未排盘时峤星如实说无法判，不硬给吉凶', ()=>{
		const r = zhaiduan({ xiangShan: '', yun: 8, qiaoGong: 8 });
		expect(r.qiao.verdict.jx).toBe('neutral');
		expect(r.qiao.verdict.text).toMatch(/未排盘/);
	});
	it('非法宫位不成峤星', ()=>{
		expect(Z({ qiaoGong: 5 }).qiao).toBeNull();
		expect(Z({ qiaoGong: 0 }).qiao).toBeNull();
	});
});

describe('理气断 · 内局（内六事）', ()=>{
	it('五事恒列，未登记者标「未登记方位」', ()=>{
		const r = Z({});
		expect(r.neiRows).toHaveLength(5);
		r.neiRows.forEach((n)=>{ expect(n.verdict).toBe('未登记方位'); expect(n.ok).toBeNull(); });
	});
	it('门户/客厅看向星，卧房看山星', ()=>{
		const pal = [{ gong: 1, shan: 8, xiang: 1, yun: 1 }];
		const r = zhaiduan({ palaces: pal, yun: 8, neiJu: { menhu: 1, wofang: 1, keting: 1 } });
		const by = {}; r.neiRows.forEach((n)=>{ by[n.key] = n; });
		expect(by.menhu.verdict).toMatch(/向星1/);
		expect(by.keting.verdict).toMatch(/向星1/);
		expect(by.wofang.verdict).toMatch(/山星8/);
		expect(by.wofang.ok).toBe(true);          // 8 运山星 8 当旺
	});
	it('厨房宜山星木（三四）土（八）或一白，忌金火与二黑五黄', ()=>{
		const mk = (shan)=>zhaiduan({ palaces: [{ gong: 1, shan, xiang: 1, yun: 1 }], yun: 8, neiJu: { chufang: 1 } })
			.neiRows.find((n)=>n.key === 'chufang');
		[3, 4, 8, 1].forEach((s)=>{ expect(mk(s).ok).toBe(true); });
		[2, 5, 6, 7, 9].forEach((s)=>{ expect(mk(s).ok).toBe(false); });
	});
	it('🔴 浴厕宜失令、忌生旺，尤忌一四／一六（压制文昌）', ()=>{
		const mk = (shan, xiang)=>zhaiduan({ palaces: [{ gong: 1, shan, xiang, yun: 1 }], yun: 8, neiJu: { yuce: 1 } })
			.neiRows.find((n)=>n.key === 'yuce');
		expect(mk(2, 3).ok).toBe(true);            // 皆失令
		expect(mk(8, 3).ok).toBe(false);           // 山星当旺
		expect(mk(1, 4).ok).toBe(false);
		expect(mk(1, 4).verdict).toMatch(/压制文昌/);
		expect(mk(6, 1).verdict).toMatch(/压制文昌/);
	});
});

describe('室内凶局逐项', ()=>{
	it('未勾 → 不出；勾中原子项才出，并按类分「宅形不利／理气不合」', ()=>{
		expect(Z({}).neiXiongRows).toHaveLength(0);
		const r = Z({ neiXiong: { kaimenjian: [0, 2], baiju: [1] } });
		expect(r.neiXiongN).toBe(3);
		const by = {}; r.neiXiongRows.forEach((x)=>{ by[x.key] = x; });
		expect(by.kaimenjian.hits).toEqual(['开门见灶', '开门见镜']);
		expect(by.kaimenjian.cls).toBe('宅形不利');
		expect(by.baiju.cls).toBe('理气不合');
	});
	it('越界索引被滤，不产空项', ()=>{
		const r = Z({ neiXiong: { kaimenjian: [0, 99, -1] } });
		expect(r.neiXiongRows[0].hits).toEqual(['开门见灶']);
	});
	it('缺角八宫可逐宫勾', ()=>{
		const r = Z({ neiXiong: { quejiao: [2, 3] } });
		expect(r.neiXiongRows[0].hits).toEqual(['震宫缺角', '巽宫缺角']);
	});
});

describe('客星断（形气为主·客星为用）', ()=>{
	it('不给年份 → 客星段整组不出', ()=>{
		expect(Z({ year: null }).keXing).toBeNull();
	});
	it('🔴 客星段恒带「形气为主、客星为用」之告诫', ()=>{
		const k = Z({ year: 2013 }).keXing;
		expect(k.zhuCi).toMatch(/形、气为主，客星为用/);
		expect(k.zhuCi).toMatch(/片面/);
	});
	it('大门逢年五黄 / 逢太岁 / 两者并临，逐档判语不同', ()=>{
		const y = 2013;
		const base = zhaiduan({ xiangShan: '午', yun: 8, year: y });
		const wuG = base.keXing.wuHuang.gong; const taiG = base.keXing.taisui.gong;
		const atWu = zhaiduan({ xiangShan: '午', yun: 8, year: y, neiJu: { menhu: wuG } });
		expect(atWu.keXing.menWarn.jx).toBe('bad');
		const atTai = zhaiduan({ xiangShan: '午', yun: 8, year: y, neiJu: { menhu: taiG } });
		expect(atTai.keXing.menWarn.jx).toBe(wuG === taiG ? 'bad' : 'bad');
		// 未登记大门 → 中性说明，不硬判
		expect(base.keXing.menWarn.jx).toBe('neutral');
		expect(base.keXing.menWarn.text).toMatch(/未登记入户门/);
	});
	it('九星吊递断诀两句原文在册', ()=>{
		const k = Z({ year: 2013 }).keXing;
		expect(k.jue[0]).toBe('天文九星岁岁推，地理九宫永不移。飞去相生生贵子，飞来克伏是凶期。');
		expect(k.jue[1]).toBe('三白到坐主怀胎，紫白临门喜气来。刑害空亡俱不实，生扶应得贵人财。');
	});
	it('生克两档：得令者生入比和吉、失令者克入凶', ()=>{
		const k = Z({ year: 2013 }).keXing;
		expect(k.shengKe).toHaveLength(2);
		expect(k.shengKe[0].jx).toBe('good');
		expect(k.shengKe[1].jx).toBe('bad');
	});
});

describe('总断（内外合参）', ()=>{
	it('未排盘 → 中性并说明客星不能单独定吉凶', ()=>{
		const r = zhaiduan({ xiangShan: '', yun: 8, year: 2013 });
		expect(r.hasPan).toBe(false);
		expect(r.verdict.jx).toBe('neutral');
		expect(r.verdict.text).toMatch(/客星只作用，不能单独定吉凶/);
	});
	it('内外皆合 → 诸事顺利；内外皆违 → 财丁两败', ()=>{
		const pal = [];
		[1, 2, 3, 4, 6, 7, 8, 9].forEach((g)=>pal.push({ gong: g, shan: 8, xiang: 8, yun: 1 }));
		const good = zhaiduan({ palaces: pal, yun: 8, waiJu: { 1: 'shan' }, neiJu: { menhu: 1, wofang: 1 } });
		expect(good.quad.text).toBe('内外皆吉，诸事顺利');
		const badPal = pal.map((p)=>({ ...p, shan: 2, xiang: 2 }));
		const bad = zhaiduan({ palaces: badPal, yun: 8, waiJu: { 1: 'shan' }, neiJu: { menhu: 1, wofang: 1 },
			xiongGe: ['buzheng'], neiXiong: { kaimenjian: [0] } });
		expect(bad.quad.text).toBe('内外皆凶，财丁两败，祸患无穷');
		expect(bad.verdict.jx).toBe('bad');
	});
	it('首重向首：有盘即出向首星与得令与否', ()=>{
		const r = Z({});
		expect(r.xiangShou).toBeTruthy();
		expect(r.xiangShou.star).toBe(8);          // 八运向午，向首向星当旺
		expect(r.xiangShou.deLing).toBe(true);
		expect(r.xiangShou.ge).toBeTruthy();
	});
	it('脏入参一律不抛', ()=>{
		[{}, { waiJu: 'x' }, { neiJu: null }, { neiXiong: 'x' }, { xiongGe: 'x' }, { qiaoGong: 'x' },
			{ palaces: 'x' }, { year: 'x' }].forEach((o)=>{
			expect(()=>zhaiduan(o)).not.toThrow();
		});
	});
});
