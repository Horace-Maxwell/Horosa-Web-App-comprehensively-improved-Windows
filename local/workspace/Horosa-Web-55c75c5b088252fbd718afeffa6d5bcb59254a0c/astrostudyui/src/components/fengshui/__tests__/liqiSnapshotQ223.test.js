// [Q-223/T-186·T-187] 风水快照缺行族(FT-24)+ 金锁形态过滤(FT-25)+ 角度归一(FT-29)+ 分至跨 0 年(FT-22)。
import { buildSnapshot, zuoShanYearCheck } from '../LiqiWorkspace';
import { xuankong } from '../xuankong';
import { bazhai } from '../bazhai';
import { yearGods } from '../zeri';
import { jinsuoXingOptionsFor } from '../jinsuo';
import { JINSUO_SHAN_DUAN } from '../fengshuiJinsuoDuanjue';

describe('[Q-223/FT-24] 风水快照补行', () => {
	test('① 玄空:给了 year+month → 快照含「流月飞星」行(月入中/向首流月星),有流月会断则含之', () => {
		const r = xuankong(8, '午', { year: 2026, month: 5 });
		const t = buildSnapshot('xuankong', r);
		expect(t).toMatch(/流月飞星：月入中\d · 向首流月星\d/);
		if (r.monthHui && r.monthHui.length) { expect(t).toContain('流月会断：'); }
		const t0 = buildSnapshot('xuankong', xuankong(8, '午', { year: 2026 }));
		expect(t0).not.toContain('流月飞星');
	});
	test('② 八宅:宅类行恒有;只设门卦 → 「三要（未齐，尚缺主卦、灶卦）」行;三卦全设 → 三要行', () => {
		const one = bazhai({ zuoGua: '坎', doorGua: '离' });
		const t1 = buildSnapshot('bazhai', one);
		expect(t1).toMatch(/宅类：.+·/);
		expect(t1).toMatch(/三要（未齐，尚缺主卦、灶卦）：门卦离/);
		const all = bazhai({ zuoGua: '坎', doorGua: '离', mainGua: '震', stoveGua: '巽' });
		const t3 = buildSnapshot('bazhai', all);
		expect(t3).toContain('三要：门→主');
		expect(t3).not.toContain('三要（未齐');
	});
	test('③ 择日:坐山·本年可动否(不依赖月日)进快照;判定与面板同源函数', () => {
		const yg = yearGods(2026);
		const chk = zuoShanYearCheck('子', yg);
		expect(chk && chk.gongName).toBeTruthy();
		const r = { available: true, isZeri: true, yg, course: null, zaoming: null, zuoShan: '子', zuoShanCheck: chk };
		const t = buildSnapshot('zeri', r);
		expect(t).toContain(`坐山子（${chk.gongName}）本年：${chk.text}`);
	});
});

describe('[Q-223/FT-25] 金锁 24 山形态只列该山该侧断诀会命中的形', () => {
	test('壬水只有 直去/葫芦;壬砂无形态项;平(flat)无', () => {
		const shui = jinsuoXingOptionsFor('壬', 'water').map((x)=>x.label);
		expect(shui).toEqual(expect.arrayContaining(['直去（不回头）', '形如葫芦']));
		expect(shui.length).toBe(2);
		expect(jinsuoXingOptionsFor('壬', 'sand')).toEqual([]);
		expect(jinsuoXingOptionsFor('壬', 'flat')).toEqual([]);
	});
	test('每个 (山×侧) 给出的形态都真在该侧断诀 when 里(无空转项)', () => {
		Object.keys(JINSUO_SHAN_DUAN).forEach((shan)=>{
			['water', 'sand'].forEach((side)=>{
				const conds = ((JINSUO_SHAN_DUAN[shan][side === 'water' ? 'shui' : 'sha'] || {}).when || []).filter((w)=>w.kind === 'xing').map((w)=>w.cond);
				jinsuoXingOptionsFor(shan, side).forEach((x)=>{
					expect(conds.some((c)=>c.indexOf(x.label) >= 0 || x.label.indexOf(c) >= 0)).toBe(true);
				});
			});
		});
	});
});
