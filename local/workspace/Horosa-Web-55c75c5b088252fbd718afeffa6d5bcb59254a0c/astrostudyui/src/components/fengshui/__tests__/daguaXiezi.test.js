// 些子法（抽爻换象）· 传本算例对照。
//
// 🔴 传本算例：「姤卦来龙，复卦水口，立大过卦，向颐卦」，并称抽某爻后
//    「龙与山 6、7 为阴阳相见且同类五行，向与水 8、2 为阴阳相见」。
//    本器按「抽第 n 爻＝自初爻起数、该爻阴阳互换」实算：**恰在抽第二爻时**
//    得出龙6/山7/向8/水2，与传本所载数字逐一相同；而传本把这一结果称作「抽三爻」。
//    爻序约定的这一处差异，本测据实钉住 —— 只锚可自证的数字，不改口径去迁就标签。
import { dagua } from '../dagua';

// 传本算例入参：向＝山雷颐（震下艮上），坐(山)＝其错卦泽风大过；龙＝天风姤（巽下乾上），水＝其错卦地雷复。
const BOOK = { xiangLower: '震', xiangUpper: '艮', longLower: '巽', longUpper: '乾', showDeep: true, yun: 9 };
const at = (n)=>dagua({ ...BOOK, chouYao: n }).deep.siShu.after;

describe('些子法 · 四卦生成（山＝向之错卦、水＝龙之错卦）', ()=>{
	it('不抽爻时即传本原局：龙姤 / 水复 / 向颐 / 山大过', ()=>{
		const a = at(0);
		expect(a.long.name).toBe('天风姤');
		expect(a.shui.name).toBe('地雷复');
		expect(a.xiang.name).toBe('山雷颐');
		expect(a.shan.name).toBe('泽风大过');
	});
	it('抽爻在四卦同位进行，错卦关系恒不变', ()=>{
		const INV = { 乾: '坤', 坤: '乾', 兑: '艮', 艮: '兑', 离: '坎', 坎: '离', 震: '巽', 巽: '震' };
		[0, 1, 2, 3, 4, 5, 6].forEach((n)=>{
			const a = at(n);
			expect(a.shan.lower).toBe(INV[a.xiang.lower]);
			expect(a.shan.upper).toBe(INV[a.xiang.upper]);
			expect(a.shui.lower).toBe(INV[a.long.lower]);
			expect(a.shui.upper).toBe(INV[a.long.upper]);
		});
	});
	it('抽 0 / 越界爻＝不抽（不产半成品）', ()=>{
		['', null, 7, -1, 'x'].forEach((n)=>{
			expect(dagua({ ...BOOK, chouYao: n }).deep.siShu.after.long.name).toBe('天风姤');
		});
	});
});

describe('🔴 传本算例数字对照（龙6·山7 ／ 向8·水2）', ()=>{
	it('抽第二爻恰得传本所载四数：遯6 / 咸7 / 损8 / 临2', ()=>{
		const a = at(2);
		expect(a.long.name).toBe('天山遁');
		expect(a.shan.name).toBe('泽山咸');
		expect(a.xiang.name).toBe('山泽损');
		expect(a.shui.name).toBe('地泽临');
		expect([a.long.houTianWei, a.shan.houTianWei]).toEqual([6, 7]);
		expect([a.xiang.houTianWei, a.shui.houTianWei]).toEqual([8, 2]);
	});
	it('该组合在四档中确为「阴阳相见」而非相乘（与传本判语同）', ()=>{
		const d = dagua({ ...BOOK, chouYao: 2 }).deep;
		const byLabel = {}; d.ciXiong.forEach((c)=>{ byLabel[c.label] = c.verdict; });
		expect(byLabel['龙与山'].name).toMatch(/阴阳相见/);
		expect(byLabel['向与水'].name).toMatch(/夫妇正配|阴阳相见/);
		expect(byLabel['龙与山'].jx).toBe('good');
	});
	it('其余各爻均不得出该组四数（唯一性——不是碰巧命中）', ()=>{
		[0, 1, 3, 4, 5, 6].forEach((n)=>{
			const a = at(n);
			expect([a.long.houTianWei, a.shan.houTianWei, a.xiang.houTianWei, a.shui.houTianWei])
				.not.toEqual([6, 7, 8, 2]);
		});
	});
});

describe('些子法三校输出结构', ()=>{
	it('龙未设 → 据实说明不足，不给结论', ()=>{
		const d = dagua({ xiangLower: '震', xiangUpper: '艮', showDeep: true, yun: 9 }).deep;
		expect(d.jiaoTong).toHaveLength(0);
		expect(d.verdict.text).toMatch(/未设来龙卦/);
		expect(d.verdict.jx).toBe('neutral');
	});
	it('龙山向水俱全 → 两路交通各出五项判', ()=>{
		const d = dagua({ ...BOOK, chouYao: 2 }).deep;
		expect(d.jiaoTong.map((p)=>p.label)).toEqual(['龙与山', '向与水']);
		d.jiaoTong.forEach((p)=>{
			['wuxing', 'guayun', 'qinyuan', 'dajie', 'houtian'].forEach((k)=>{ expect(p[k]).toBeTruthy(); });
			expect(typeof p.okN).toBe('number');
		});
	});
	it('求生旺四卦逐卦出「五行档／卦运档」，且一运卦在下元、九运卦在上元各有专断', ()=>{
		const d = dagua({ ...BOOK, chouYao: 0 }).deep;         // 颐＝三运? 逐卦实算，不预设
		expect(d.shengWang).toHaveLength(4);
		d.shengWang.forEach((x)=>{ expect(x.qi).toBeTruthy(); expect(x.yun).toBeTruthy(); });
		// 一运卦（八纯）在下元：不旺亦不衰
		const pure = dagua({ xiangLower: '乾', xiangUpper: '乾', longLower: '坎', longUpper: '坎', showDeep: true, yun: 9 }).deep;
		expect(pure.shengWang.find((x)=>x.name === '乾为天').yun).toMatch(/一运卦在下元不旺亦不衰/);
		// 九运卦（母卦）在上元：不旺亦不衰
		const mu = dagua({ xiangLower: '乾', xiangUpper: '坤', longLower: '兑', longUpper: '艮', showDeep: true, yun: 2 }).deep;
		expect(mu.shengWang.find((x)=>x.name === '天地否').yun).toMatch(/九运卦在上元不旺亦不衰/);
	});
	it('🔴 深化层 opt-in：不开 showDeep 时 deep 为 null，其余字段逐字节不变（零回归）', ()=>{
		const off = dagua({ xiangLower: '震', xiangUpper: '艮', yun: 9 });
		const on = dagua({ xiangLower: '震', xiangUpper: '艮', yun: 9, showDeep: true });
		expect(off.deep).toBeNull();
		const strip = (o)=>{ const c = { ...o }; delete c.deep; return JSON.stringify(c); };
		expect(strip(on)).toBe(strip(off));
	});
	it('罗盘告诫随器标出（传本明言罗盘不可尽信）', ()=>{
		expect(dagua({ ...BOOK, chouYao: 2 }).deep.luopanNote).toMatch(/罗盘内容不可尽信/);
	});
	it('🔴 爻序称法差异据实标出（不改口径去迁就标签，也不隐瞒）', ()=>{
		const n = dagua({ ...BOOK, chouYao: 2 }).deep.yaoXuNote;
		expect(n).toMatch(/自初爻起数/);
		expect(n).toMatch(/抽二爻/);
		expect(n).toMatch(/传本称此结果为「抽三爻」/);
	});
});
