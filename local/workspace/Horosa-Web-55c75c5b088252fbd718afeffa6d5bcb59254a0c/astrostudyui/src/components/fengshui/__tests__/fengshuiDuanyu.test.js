// 玄空断语库 + 阳宅三十则 golden。
// 🔴 两条口径钉死：
//   ① 索引只认赋文**自身写出**的星名/卦名，绝不做解读式标注。
//      三处假阳性已在首版踩过并修：「三吉之辅」的「辅」＝辅佐非左辅星；
//      「离乡砂」的「离」＝离开非离卦；且 JS/Python 中空串是任何串的子串，
//      句首/句尾之卦字会因 prv/nxt 为空而恒被误认。
//   ②《飞星赋》本册只述其名未收全文 → 不从他处补入。
import {
	XUANKONG_DUANYU, DUANYU_SOURCES, DUANYU_MISSING_NOTE, DUANYU_INDEX_NOTE,
	duanyuFor, duanyuByPan, YANGZHAI_30, YANGZHAI_30_NOTE,
} from '../fengshuiDuanyuData';

describe('断语库规模与出处', ()=>{
	it('两篇赋文全文逐句共 79 条，出处只此两篇', ()=>{
		expect(XUANKONG_DUANYU).toHaveLength(79);
		expect(new Set(XUANKONG_DUANYU.map((d)=>d.src))).toEqual(new Set(['玄机赋', '玄空秘旨']));
		expect(XUANKONG_DUANYU.filter((d)=>d.src === '玄机赋')).toHaveLength(27);
		expect(XUANKONG_DUANYU.filter((d)=>d.src === '玄空秘旨')).toHaveLength(52);
	});
	it('🔴《飞星赋》未收全文 → 不在库中，并据实说明', ()=>{
		expect(XUANKONG_DUANYU.some((d)=>d.src === '飞星赋')).toBe(false);
		expect(DUANYU_MISSING_NOTE).toMatch(/本册只述其名而未收全文/);
		expect(DUANYU_SOURCES).toHaveLength(2);
	});
	it('每条有出处/序号/正文，同篇内序号连续不重', ()=>{
		['玄机赋', '玄空秘旨'].forEach((src)=>{
			const arr = XUANKONG_DUANYU.filter((d)=>d.src === src);
			expect(arr.map((d)=>d.no)).toEqual(arr.map((_, i)=>i + 1));
			arr.forEach((d)=>{ expect(d.text.length).toBeGreaterThan(3); });
		});
	});
	it('原文逐字保全：抽查数条与传本一致', ()=>{
		const t = XUANKONG_DUANYU.map((d)=>d.text);
		expect(t).toContain('气口司一宅之枢，龙穴乐三吉之辅');
		expect(t).toContain('名扬科第，贪狼星在巽宫；职掌兵权，武曲峰当庚兑');
		expect(t).toContain('一贵当权，诸凶慑服；众凶克主，独力难支');
		expect(t.some((x)=>x.indexOf('漏道在坎宫，遗精泄血') >= 0)).toBe(true);
	});
});

describe('🔴 索引只认原文写明者（防解读式臆造）', ()=>{
	const by = (kw)=>XUANKONG_DUANYU.find((d)=>d.text.indexOf(kw) >= 0);
	it('明写星名者正确索引：贪狼→1、武曲→6、破军→7', ()=>{
		const d = by('贪狼星在巽宫');
		expect(d.stars).toContain(1);
		expect(d.stars).toContain(6);        // 同句另有「武曲峰当庚兑」
		expect(d.guas).toContain('巽');
		expect(by('破军居巽位').stars).toContain(7);
	});
	it('🔴 单字「辅」＝辅佐，不得判为左辅星', ()=>{
		const d = by('龙穴乐三吉之辅');
		expect(d.stars).toEqual([]);
	});
	it('🔴「离乡」之「离」＝离开，不得判为离卦；同句「艮位」应判艮', ()=>{
		const d = by('离乡砂飞艮位');
		expect(d.guas).toContain('艮');
		expect(d.guas).not.toContain('离');
	});
	it('🔴 句首/句尾之卦字不因空邻字而误认（空串是任何串的子串之坑）', ()=>{
		const d = by('艮非宜也，筋伤股折');
		expect(d.guas).toEqual([]);          // 「艮非宜也」句首、「兑不利欤」前为分号，皆不认
	});
	it('卦名紧邻方位词方认（宫/位/方/上）', ()=>{
		expect(by('漏道在坎宫').guas).toEqual(expect.arrayContaining(['坎', '巽', '离']));
		expect(by('巨入坤艮').guas).toEqual(expect.arrayContaining(['坤', '艮']));   // 两卦相连亦认
	});
	it('多数条目无星卦名是常态（总纲/体用/形势之论），不是漏标', ()=>{
		const none = XUANKONG_DUANYU.filter((d)=>!d.stars.length && !d.guas.length);
		expect(none.length).toBeGreaterThan(50);
		expect(DUANYU_INDEX_NOTE).toMatch(/不是漏标/);
	});
});

describe('检索接口', ()=>{
	it('按星检索：贪狼(1) 能检出「贪狼星在巽宫」条', ()=>{
		const hits = duanyuFor({ stars: [1] });
		expect(hits.some((d)=>d.text.indexOf('贪狼星在巽宫') >= 0)).toBe(true);
	});
	it('按卦检索：坎 能检出「漏道在坎宫」条', ()=>{
		expect(duanyuFor({ guas: ['坎'] }).some((d)=>d.text.indexOf('漏道在坎宫') >= 0)).toBe(true);
	});
	it('可限定出处', ()=>{
		duanyuFor({ stars: [1, 2, 3], src: '玄机赋' }).forEach((d)=>expect(d.src).toBe('玄机赋'));
	});
	it('空条件返回空（不把整库倒出来）', ()=>{
		expect(duanyuFor({})).toEqual([]);
		expect(duanyuFor({ stars: [], guas: [] })).toEqual([]);
	});
	it('按盘逐宫检索：只回有命中的宫', ()=>{
		const pan = [{ gong: 4, gua: '巽', dir: '巽(东南)', shan: 1, xiang: 4, yun: 6 },
			{ gong: 2, gua: '坤', dir: '坤(西南)', shan: 3, xiang: 3, yun: 3 }];
		const r = duanyuByPan(pan);
		expect(Array.isArray(r)).toBe(true);
		r.forEach((x)=>{ expect(x.hits.length).toBeGreaterThan(0); });
		const xun = r.find((x)=>x.gong === 4);
		expect(xun).toBeTruthy();
		expect(xun.hits.some((d)=>d.guas.indexOf('巽') >= 0 || d.stars.indexOf(1) >= 0)).toBe(true);
	});
	it('脏入参不抛', ()=>{
		[null, 'x', [], [{}], [{ gong: 1 }]].forEach((p)=>{ expect(()=>duanyuByPan(p)).not.toThrow(); });
		expect(()=>duanyuFor({ stars: 'x' })).not.toThrow();
	});
});

describe('阳宅三十则', ()=>{
	it('恰三十则，序号 1..30 各一次', ()=>{
		expect(YANGZHAI_30).toHaveLength(30);
		expect(YANGZHAI_30.map((x)=>x.no)).toEqual(Array.from({ length: 30 }, (_, i)=>i + 1));
	});
	it('每则有标题与正文', ()=>{
		YANGZHAI_30.forEach((x)=>{
			expect(x.title.length).toBeGreaterThan(0);
			expect(x.text.length).toBeGreaterThan(10);
		});
	});
	it('抽查首末与关键则与传本一致', ()=>{
		expect(YANGZHAI_30[0].title).toBe('城乡取裁不同');
		expect(YANGZHAI_30[1].title).toBe('挨星');
		expect(YANGZHAI_30[29].title).toBe('田角');
		expect(YANGZHAI_30.find((x)=>x.no === 12).title).toBe('造灶');
		expect(YANGZHAI_30.find((x)=>x.no === 12).text).toMatch(/火门向一白为水火既济/);
	});
	it('🔴 原书编号有数字重复之讹，按篇内顺序编号并保留原印之号', ()=>{
		expect(YANGZHAI_30.find((x)=>x.no === 12).ocrNum).toBe('1122');
		expect(YANGZHAI_30.find((x)=>x.no === 30).ocrNum).toBe('3300');
		expect(YANGZHAI_30.find((x)=>x.no === 2).ocrNum).toBe('22');
		expect(YANGZHAI_30_NOTE).toMatch(/按\*\*篇内顺序\*\*编号|按篇内顺序编号/);
		expect(YANGZHAI_30_NOTE).toMatch(/条数恰三十与篇名相符/);
	});
	it('未被讹误破坏的编号全部等于其位次（本次编号法之自证）', ()=>{
		YANGZHAI_30.forEach((x)=>{
			if (x.ocrNum.length <= 2 && x.no !== 2) { expect(Number(x.ocrNum)).toBe(x.no); }
		});
	});
});
