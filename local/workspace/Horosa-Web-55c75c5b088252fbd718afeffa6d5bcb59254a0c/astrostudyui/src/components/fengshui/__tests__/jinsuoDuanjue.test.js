// 金锁玉关断诀全库 golden —— 48 条基础断语 + 形态 / 对宫映照 / 宫全 / 跨宫 / 房份。
// 🔴 断诀库只作查检：得位/失位之判仍走洛书本法，本测同时钉死「本库不改判据」。
import { jinsuo } from '../jinsuo';
import { JINSUO_SHAN_DUAN, JINSUO_GONG_QUAN, JINSUO_KUA_GONG, JINSUO_XING, JINSUO_DUIGONG } from '../fengshuiJinsuoDuanjue';

const SHAN24 = ['壬', '子', '癸', '未', '坤', '申', '甲', '卯', '乙', '辰', '巽', '巳',
	'戌', '乾', '亥', '庚', '酉', '辛', '丑', '艮', '寅', '丙', '午', '丁'];
const allFlat = ()=>{ const o = {}; SHAN24.forEach((s)=>{ o[s] = 'flat'; }); return o; };

describe('断诀库 · 数据完整性', ()=>{
	it('24 山齐备，每山各有水断与砂断（48 条基础断语）', ()=>{
		expect(Object.keys(JINSUO_SHAN_DUAN).sort()).toEqual([...SHAN24].sort());
		let n = 0;
		SHAN24.forEach((s)=>{
			const d = JINSUO_SHAN_DUAN[s];
			expect(d.gua).toBeTruthy();
			['shui', 'sha'].forEach((k)=>{ expect(d[k].base).toBeTruthy(); expect(Array.isArray(d[k].when)).toBe(true); n++; });
		});
		expect(n).toBe(48);
	});
	it('每宫恰三山，八宫共 24（中五宫不列）', ()=>{
		const byGua = {};
		SHAN24.forEach((s)=>{ const g = JINSUO_SHAN_DUAN[s].gua; byGua[g] = (byGua[g] || 0) + 1; });
		expect(Object.keys(byGua).sort()).toEqual(['乾', '兑', '坎', '坤', '巽', '艮', '离', '震'].sort());
		Object.keys(byGua).forEach((g)=>{ expect(byGua[g]).toBe(3); });
	});
	it('对宫映照十二对齐备且互为对宫（洛书相冲）', ()=>{
		expect(JINSUO_DUIGONG).toHaveLength(12);
		const OPP = { 坎: '离', 离: '坎', 坤: '艮', 艮: '坤', 震: '兑', 兑: '震', 巽: '乾', 乾: '巽' };
		JINSUO_DUIGONG.forEach(({ a, b })=>{
			expect(OPP[JINSUO_SHAN_DUAN[a].gua]).toBe(JINSUO_SHAN_DUAN[b].gua);
		});
	});
	it('宫全 11 条、跨宫 14 条、形态 26 枚', ()=>{
		expect(JINSUO_GONG_QUAN).toHaveLength(11);
		expect(JINSUO_KUA_GONG).toHaveLength(14);
		expect(JINSUO_XING).toHaveLength(26);
	});
	it('🔴 每条 zhao 条件都带机器可判的 req（否则只能靠读文本猜，必静默失效）', ()=>{
		SHAN24.forEach((s)=>{
			['shui', 'sha'].forEach((k)=>{
				JINSUO_SHAN_DUAN[s][k].when.filter((w)=>w.kind === 'zhao').forEach((w)=>{
					expect(Array.isArray(w.req)).toBe(true);
					expect(w.req.length).toBeGreaterThan(0);
					w.req.forEach((r)=>{ expect(SHAN24).toContain(r.shan); expect(['sand', 'water']).toContain(r.side); });
				});
			});
		});
	});
});

describe('断诀库 · 零回归（不给 shans 时与旧路等值）', ()=>{
	it('八方档输出逐字节不变、duanjue 为 null', ()=>{
		const a = jinsuo({ sectors: { 坎: 'sand', 离: 'water' }, yun: 8, year: 2026 });
		expect(a.duanjue).toBeNull();
		expect(a.granularity).toBe('gong8');
		const b = jinsuo({ sectors: { 坎: 'sand', 离: 'water' }, shans: allFlat(), yun: 8, year: 2026 });
		expect(JSON.stringify(b.palaces)).toBe(JSON.stringify(a.palaces));   // 全 flat ≠ 启用细式
		expect(b.duanjue).toBeNull();
	});
});

describe('断诀库 · 24 山细式逐条', ()=>{
	const S = (patch, xings)=>jinsuo({ shans: { ...allFlat(), ...patch }, xings });

	it('壬见水 → 出「壬水乏嗣，二房先绝」并带房份', ()=>{
		const r = S({ 壬: 'water' }).duanjue.rows.find((x)=>x.shan === '壬');
		expect(r.base).toBe('壬水乏嗣，二房先绝');
		expect(r.fang).toBe('二房');
		expect(r.deWei).toBe(false);              // 坎宫要砂，见水＝失位
		expect(r.fired).toHaveLength(0);          // 未选形态、无对照 → 无条命中
		expect(r.conds.map((c)=>c.cond)).toEqual(['直去', '形如葫芦']);
	});
	it('形态命中才并入正文（未选形态时只列为待验条件）', ()=>{
		const off = S({ 壬: 'water' }).duanjue.rows.find((x)=>x.shan === '壬');
		expect(off.text).toBe('壬水乏嗣，二房先绝');
		const on = S({ 壬: 'water' }, { 壬: 'hulu' }).duanjue.rows.find((x)=>x.shan === '壬');
		expect(on.fired.map((f)=>f.text)).toEqual(['主腰腿损伤']);
		expect(on.text).toContain('（形如葫芦）主腰腿损伤');
	});
	it('🔴 对宫映照自动命中：壬砂 + 丙水 → 文武全才', ()=>{
		const off = S({ 壬: 'sand' }).duanjue.rows.find((x)=>x.shan === '壬');
		expect(off.fired).toHaveLength(0);
		const on = S({ 壬: 'sand', 丙: 'water' }).duanjue.rows.find((x)=>x.shan === '壬');
		expect(on.fired.map((f)=>f.text)).toEqual(['文武全才']);
		expect(on.fired[0].by).toBe('对照命中');
		expect(on.deWei).toBe(true);              // 坎宫见砂＝得位
	});
	it('any 型对照：庚酉任一见水即命中（甲砂财官双旺）', ()=>{
		expect(S({ 甲: 'sand', 庚: 'water' }).duanjue.rows.find((x)=>x.shan === '甲').fired).toHaveLength(1);
		expect(S({ 甲: 'sand', 酉: 'water' }).duanjue.rows.find((x)=>x.shan === '甲').fired).toHaveLength(1);
		expect(S({ 甲: 'sand' }).duanjue.rows.find((x)=>x.shan === '甲').fired).toHaveLength(0);
	});
	it('平（未录）之山不出行', ()=>{
		expect(S({ 壬: 'water' }).duanjue.rows.map((r)=>r.shan)).toEqual(['壬']);
	});
	it('24 山逐一见水、逐一见砂都能取到断语（48 条全可达）', ()=>{
		SHAN24.forEach((s)=>{
			expect(S({ [s]: 'water' }).duanjue.rows[0].base).toBe(JINSUO_SHAN_DUAN[s].shui.base);
			expect(S({ [s]: 'sand' }).duanjue.rows[0].base).toBe(JINSUO_SHAN_DUAN[s].sha.base);
		});
	});
});

describe('断诀库 · 宫全 / 跨宫', ()=>{
	const S = (patch)=>jinsuo({ shans: { ...allFlat(), ...patch } });
	it('坤宫三山全水 → 「坤宫都是水，二三房寿夭」', ()=>{
		const q = S({ 未: 'water', 坤: 'water', 申: 'water' }).duanjue.gongQuan;
		expect(q.some((g)=>g.text.indexOf('二三房寿夭') >= 0)).toBe(true);
	});
	it('🔴 三山未录满不算「全是」（不足而断＝造假阳）', ()=>{
		const q = S({ 未: 'water', 坤: 'water' }).duanjue.gongQuan;
		expect(q.some((g)=>g.gua === '坤' && g.side === 'shui')).toBe(false);
	});
	it('跨宫组合：坤兑二宫皆水 → 婆媳有灾', ()=>{
		const k = S({ 未: 'water', 坤: 'water', 申: 'water', 庚: 'water', 酉: 'water', 辛: 'water' }).duanjue.kuaGong;
		expect(k.some((x)=>x.text.indexOf('婆媳有灾') >= 0)).toBe(true);
	});
	it('宫全之 extra 条件亦须命中才并出（七赤全砂 + 辰巽巳水）', ()=>{
		const noExtra = S({ 庚: 'sand', 酉: 'sand', 辛: 'sand' }).duanjue.gongQuan.find((g)=>g.gua === '兑' && g.side === 'sha');
		expect(noExtra.extraFired).toBeNull();
		const withExtra = S({ 庚: 'sand', 酉: 'sand', 辛: 'sand', 辰: 'water' }).duanjue.gongQuan.find((g)=>g.gua === '兑' && g.side === 'sha');
		expect(withExtra.extraFired.text).toBe('人品不良，奸诈异常');
	});
});

describe('断诀库 · 宫粒度归纳与死开关闸', ()=>{
	it('三山一致 → 该宫按此判得位失位', ()=>{
		const r = jinsuo({ shans: { ...allFlat(), 壬: 'sand', 子: 'sand', 癸: 'sand' } });
		expect(r.palaces.find((p)=>p.gua === '坎').deWei).toBe(true);
		expect(r.mixedGuas).toEqual([]);
	});
	it('三山参差 → 该宫作未定并登记 mixed（不臆断哪一山说了算）', ()=>{
		const r = jinsuo({ shans: { ...allFlat(), 壬: 'sand', 子: 'water' } });
		expect(r.palaces.find((p)=>p.gua === '坎').actual).toBe('flat');
		expect(r.mixedGuas).toContain('坎');
	});
	it('🔴 八方档遗留的 flat 不得吞掉细式录入（死开关闸）', ()=>{
		// sectors 里坎宫写着 'flat'（非空串＝truthy），若按真值先判会整宫吞掉 24 山输入。
		const r = jinsuo({ sectors: { 坎: 'flat' }, shans: { ...allFlat(), 壬: 'sand', 子: 'sand', 癸: 'sand' } });
		expect(r.palaces.find((p)=>p.gua === '坎').actual).toBe('sand');
		expect(r.duanjue.rows).toHaveLength(3);
	});
	it('某宫三山全未录 → 退回八方档之值', ()=>{
		const r = jinsuo({ sectors: { 离: 'water' }, shans: { ...allFlat(), 壬: 'sand' } });
		expect(r.palaces.find((p)=>p.gua === '离').actual).toBe('water');
		expect(r.palaces.find((p)=>p.gua === '离').deWei).toBe(true);
	});
	it('细式不改得位判据：得位数仍由洛书本法算', ()=>{
		const r = jinsuo({ shans: { ...allFlat(), 壬: 'sand', 子: 'sand', 癸: 'sand', 丙: 'water', 午: 'water', 丁: 'water' } });
		expect(r.deCount).toBe(2);                 // 坎得位 + 离得位
		expect(r.score).toBe(25);
	});
	it('脏入参不抛', ()=>{
		[{ shans: 'x' }, { shans: { 壬: 'X' } }, { shans: {}, xings: 'y' }, { shans: { 壬: 'water' }, xings: { 壬: 'nope' } }]
			.forEach((o)=>{ expect(()=>jinsuo(o)).not.toThrow(); });
	});
});
