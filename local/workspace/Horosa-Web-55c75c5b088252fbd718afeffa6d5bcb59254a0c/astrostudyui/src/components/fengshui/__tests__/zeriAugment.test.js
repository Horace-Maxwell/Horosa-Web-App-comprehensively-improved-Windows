// 择日 · 杨公造命四纲（补龙 / 扶山 / 相主 / 避煞）。
// 🔴 铁律：laiLong / zhuMing 缺省时行为与补齐前完全一致（该两纲不产出、不计分）。
import { zaoMing } from '../zeri';
import { SHAN_ORDER } from '../fengshuiData';

const GANGS = ['补龙', '扶山', '相主', '避煞'];

describe('造命四纲', ()=>{
	it('🔴 缺省零回归：不填来龙与主命 → 只出扶山/避煞两纲，分数与只传三参一致', ()=>{
		const a = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20 });
		const b = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, laiLong: '', zhuMing: undefined });
		const c = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, zhuMing: { year: '', isMale: true } });
		expect(a.score).toBe(b.score);
		expect(a.score).toBe(c.score);
		expect(a.laiLong).toBeNull();
		expect(a.zhuMing).toBeNull();
		expect(a.gangDone).toEqual(['扶山', '避煞']);
		a.items.forEach((it)=>{ expect(['扶山', '避煞']).toContain(it.gang); });
	});

	it('补龙：来龙 → 三合局五行，四柱纳音生扶 +1 / 克泄 −1', ()=>{
		const base = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20 });
		const r = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, laiLong: '乾' });
		expect(r.laiLong).toEqual(expect.objectContaining({ shan: '乾', wuxing: expect.any(String) }));
		expect(r.gangDone).toContain('补龙');
		const bu = r.items.filter((it)=>it.gang === '补龙');
		expect(bu.length).toBeGreaterThan(0);
		bu.forEach((it)=>{ expect(['good', 'bad']).toContain(it.jx); });
		// 补龙项的净分 = 总分之差
		const delta = bu.reduce((a2, it)=>a2 + (it.jx === 'good' ? 1 : -1), 0);
		expect(r.score).toBe(base.score + delta);
		// 24 山逐个作来龙都不炸、都能定局
		SHAN_ORDER.forEach((s)=>{
			const x = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, laiLong: s });
			expect(x.available).toBe(true);
			expect(x.laiLong).not.toBeNull();
			expect(['水', '火', '木', '金']).toContain(x.laiLong.wuxing);
		});
	});

	it('相主：主命年+性别 → 命卦五行，生扶 +1 / 克 −2 / 冲主命年支 −2', ()=>{
		const r = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, zhuMing: { year: 1990, isMale: true } });
		expect(r.zhuMing).toEqual(expect.objectContaining({ year: 1990, isMale: true, gua: expect.any(String) }));
		expect(r.gangDone).toContain('相主');
		expect(r.items.some((it)=>it.gang === '相主')).toBe(true);
		// 男女命卦不同 → 相主结论可分化（至少不抛且各自成立）
		[true, false].forEach((m)=>{
			for (let y = 1960; y <= 2000; y += 7) {
				const x = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, zhuMing: { year: y, isMale: m } });
				expect(x.available).toBe(true);
				expect(x.zhuMing.wuxing).toBeTruthy();
			}
		});
		// 非法主命年 → 不评相主，且与缺省同分
		const bad = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, zhuMing: { year: 'abc', isMale: true } });
		expect(bad.zhuMing).toBeNull();
		expect(bad.score).toBe(zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20 }).score);
	});

	it('四纲齐备时 gangDone 全中，items 的纲取值封闭', ()=>{
		const r = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20, laiLong: '乾', zhuMing: { year: 1990, isMale: false } });
		expect(r.gangDone).toEqual(GANGS);
		r.items.forEach((it)=>{ expect(GANGS).toContain(it.gang); });
		expect(r.note).toContain('补龙');
	});

	it('压测：24 坐山 × 8 来龙 × 男女 × 多日期 均不抛、分数为有限数', ()=>{
		const days = [[2026, 1, 5], [2026, 3, 20], [2026, 7, 15], [2026, 12, 31], [1984, 2, 29]];
		SHAN_ORDER.forEach((zs, i)=>{
			const ll = SHAN_ORDER[(i * 3) % 24];
			days.forEach(([y, m, d])=>{
				[true, false].forEach((male)=>{
					const r = zaoMing({ zuoShan: zs, y, m, d, laiLong: ll, zhuMing: { year: 1975, isMale: male } });
					expect(r.available).toBe(true);
					expect(Number.isFinite(r.score)).toBe(true);
					expect(['good', 'neutral', 'bad']).toContain(r.grade.jx);
				});
			});
		});
	});
});
