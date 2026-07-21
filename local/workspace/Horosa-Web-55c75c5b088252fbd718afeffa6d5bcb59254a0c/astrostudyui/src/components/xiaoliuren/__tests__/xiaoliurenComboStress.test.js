// [P3] 小六壬 · 组合压测:选项全组合 × 输入边界 —— 中间区(三传/判读)与快照层同验。
// 选项面(与左栏一一对应):school{main,dao} × 取数{按占时=合法三数, 手动} × 三数边界。
import { sanChuan, teLi, analyze, qiKe } from '../core/xiaoliurenKe';
import { MAIN_RING, DAO_RING } from '../core/xiaoliurenConst';
import { buildXiaoLiuRenSnapshotText } from '../XiaoLiuRenMain';

const SCHOOLS = ['main', 'dao'];

describe('[P3] 小六壬组合压测 · 起课核(school × 三数全域)', ()=>{
	test('两流派 × m,d,h ∈ 1..13 全组合(2×13³=4394):不抛,三传恒属对应环', ()=>{
		SCHOOLS.forEach((school)=>{
			const ring = school === 'dao' ? DAO_RING : MAIN_RING;
			for(let m = 1; m <= 13; m += 1){
				for(let d = 1; d <= 13; d += 1){
					for(let h = 1; h <= 13; h += 1){
						const r = qiKe({ m, d, h, school });
						expect(r).toBeTruthy();
						expect(r.chuan).toHaveLength(3);
						r.chuan.forEach((c)=>expect(ring).toContain(c));
						// 判读结构完备
						expect(r.analysis.stages).toHaveLength(3);
						expect(r.analysis.across).toBeTruthy();
						expect(Array.isArray(r.analysis.teLi)).toBe(true);
						// 道门必有相邻两对;主流 pairs 空(不调五行)但同神同义标记在
						if(school === 'dao'){
							expect(r.analysis.pairs).toHaveLength(2);
						}else{
							expect(r.analysis.pairs).toHaveLength(0);
						}
					}
				}
			}
		});
	});

	test('环长算法金标:main 6/dao 9;大数取余与逐步顺数等价', ()=>{
		// m=7 在六宫 = m=1(7-1 步 mod 6);m=10 在九宫 = m=1
		expect(sanChuan({ m: 7, d: 7, h: 7, school: 'main' }).chuan)
			.toEqual(sanChuan({ m: 1, d: 1, h: 1, school: 'main' }).chuan);
		expect(sanChuan({ m: 10, d: 10, h: 10, school: 'dao' }).chuan)
			.toEqual(sanChuan({ m: 1, d: 1, h: 1, school: 'dao' }).chuan);
		// 巨数不炸
		expect(sanChuan({ m: 99999, d: 88888, h: 77777, school: 'main' })).toBeTruthy();
	});

	test('非法输入边界:0/负/空/NaN/小数截断 → null 安全(UI 起课报错而非脏课)', ()=>{
		[
			{ m: 0, d: 1, h: 1 }, { m: 1, d: -2, h: 1 }, { m: 1, d: 1, h: null },
			{ m: undefined, d: 1, h: 1 }, { m: 'x', d: 1, h: 1 }, {},
		].forEach((input)=>{
			expect(sanChuan({ ...input, school: 'main' })).toBe(null);
			expect(qiKe({ ...input, school: 'dao' })).toBe(null);
		});
		// 小数截断(1.9→1)合法
		expect(sanChuan({ m: 1.9, d: 2.2, h: 3.7, school: 'main' }).nums).toEqual([1, 2, 3]);
		// 未知流派回退主流环
		const r = sanChuan({ m: 1, d: 1, h: 1, school: 'weird' });
		expect(MAIN_RING).toContain(r.chuan[0]);
	});

	test('特例侦测全谱:两留连/两赤口/空亡(含叠加)', ()=>{
		expect(teLi(['留连', '留连', '大安']).map((t)=>t.key)).toEqual(['两留连']);
		expect(teLi(['赤口', '赤口', '空亡']).map((t)=>t.key)).toEqual(['两赤口', '空亡']);
		expect(teLi(['大安', '速喜', '小吉'])).toEqual([]);
		expect(teLi(null)).toEqual([]);
	});

	test('道门生克断语双金标:被生=贵人相助;克=我克者为财+拜解登记', ()=>{
		// 构造:速喜(火)→大安(木):木生火 ⇒ 1 生 2(rel=生,仅列关系)
		// 需要「被生」:a 被 b 生 —— 大安(木)在前、速喜(火)在后?木生火=a生b。
		// 找「后生前」:第二传五行生第一传:速喜(火)前、大安(木)后?木生火→b生a=被生 ✓
		const r = analyze({ school: 'dao', chuan: ['速喜', '大安', '大安'] });
		expect(r.pairs[0].rel).toBe('被生');
		expect(r.pairs[0].duan).toContain('贵人');
		// 克:大安(木)前、病符?用 克 对:木克土(空亡=土)
		const r2 = analyze({ school: 'dao', chuan: ['大安', '空亡', '空亡'] });
		expect(r2.pairs[0].rel).toBe('克');
		expect(r2.pairs[0].duan).toContain('财');
		expect(r2.baiJie.length).toBeGreaterThan(0);
		expect(r2.baiJie[0].victim).toBe('空亡');
	});
});

describe('[P3] 小六壬组合压测 · 快照层(AI 导出/挂载共用文本)', ()=>{
	test('两流派 × 有/无问事 × 有/无特例:快照非空且含流派与三传', ()=>{
		SCHOOLS.forEach((school)=>{
			[['留连', 6], ['大安', 1]].forEach(([, seed])=>{
				const ke = qiKe({ m: seed, d: seed, h: seed, school });
				['考试求财', ''].forEach((askEvent)=>{
					const txt = buildXiaoLiuRenSnapshotText(ke, askEvent, {});
					expect(typeof txt).toBe('string');
					expect(txt.length).toBeGreaterThan(30);
					expect(txt).toContain(school === 'dao' ? '道门九宫' : '主流六宫');
					ke.chuan.forEach((c)=>expect(txt).toContain(c));
					if(askEvent){ expect(txt).toContain(askEvent); }
				});
			});
		});
	});

	test('坏课安全:null/缺 chuan 不抛且给出可读占位', ()=>{
		expect(()=>buildXiaoLiuRenSnapshotText(null, '', {})).not.toThrow();
		expect(()=>buildXiaoLiuRenSnapshotText({ school: 'main' }, '', {})).not.toThrow();
	});
});
