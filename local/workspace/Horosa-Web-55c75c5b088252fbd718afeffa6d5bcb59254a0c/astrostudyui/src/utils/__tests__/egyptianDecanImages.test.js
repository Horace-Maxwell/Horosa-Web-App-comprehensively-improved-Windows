// 三十六旬像 —— 金标(公版古籍逐条译出;完整性/唯一性/红线/接线)
import {
	DECAN_IMAGES, DECAN_IMAGE_BY_GREEK, decanImageAt, DECAN_IMAGE_EFFECT_MISSING, decanImageKeys,
	DECAN_IMAGE_NOTE, EXTRA_ZODIAC_FIGURES, EXTRA_ZODIAC_NOTE,
} from '../../divination/data/egyptianDecanImages';
import { EGYPT_DECANS } from '../../divination/data/egyptianData';

describe('旬像表完整性', ()=>{
	test('恰 36 条,黄道序 1..36 无缺无重', ()=>{
		expect(DECAN_IMAGES.length).toBe(36);
		expect(DECAN_IMAGES.map((d)=>d.greek)).toEqual(Array.from({ length: 36 }, (_, i)=>i + 1));
	});

	test('每旬的座与旬内序与旬名录逐条对齐(不是另起一套编号)', ()=>{
		DECAN_IMAGES.forEach((img)=>{
			const d = EGYPT_DECANS[img.greek - 1];
			expect(d).toBeTruthy();
			expect(img.sign).toBe(d.signId);
			expect(img.n).toBe(d.decanInSign);
		});
	});

	test('十二座各恰三旬、旬内序恒为 1/2/3', ()=>{
		const bySign = {};
		DECAN_IMAGES.forEach((d)=>{ (bySign[d.sign] = bySign[d.sign] || []).push(d.n); });
		expect(Object.keys(bySign).length).toBe(12);
		Object.keys(bySign).forEach((k)=>expect(bySign[k]).toEqual([1, 2, 3]));
	});

	test('象文逐条非空且互不相同(无复制粘贴串行)', ()=>{
		const imgs = DECAN_IMAGES.map((d)=>d.image);
		// 下限取 5:最短一条是狮子第一旬「一男子骑狮。」(原文即极短),再严会误伤真数据
		imgs.forEach((t)=>{ expect(typeof t).toBe('string'); expect(t.length).toBeGreaterThanOrEqual(5); });
		expect(new Set(imgs).size).toBe(36);
	});

	test('所主:除原文未给者外逐条非空,且缺项清单明确', ()=>{
		expect(DECAN_IMAGE_EFFECT_MISSING).toEqual([4]);   // 金牛第一旬,古籍只给象未给所主
		DECAN_IMAGES.forEach((d)=>{
			if(DECAN_IMAGE_EFFECT_MISSING.indexOf(d.greek) >= 0){
				expect(d.effect).toBe('');
				expect(decanImageKeys(d.effect)).toEqual([]);
			}else{
				expect(d.effect.length).toBeGreaterThan(3);
				expect(decanImageKeys(d.effect).length).toBeGreaterThan(0);
			}
		});
	});

	// 标签由译文切分而来,故每个标签必是 effect 的子串 —— 这条断言把「标签不得凭空造」钉死:
	// 一旦有人改回手写概括词,必然有标签不再是子串,此测立刻炸。
	test('检索标签恒为所主译文的子串(不凭空造概括词)', ()=>{
		DECAN_IMAGES.filter((d)=>d.effect).forEach((d)=>{
			const ks = decanImageKeys(d.effect);
			expect(ks.length).toBeGreaterThan(0);
			ks.forEach((k)=>expect(d.effect.indexOf(k)).toBeGreaterThanOrEqual(0));
		});
	});

	test('切分函数:空/非法输入回空数组,不抛', ()=>{
		[undefined, null, '', 0, {}].forEach((x)=>expect(decanImageKeys(x)).toEqual([]));
		expect(decanImageKeys('主甲、乙与丙。')).toEqual(['甲', '乙', '丙']);
	});

	test('取用函数:合法号取到、非法号回 null 不抛', ()=>{
		expect(decanImageAt(1).sign).toBe('aries');
		expect(decanImageAt(36).sign).toBe('pisces');
		expect(decanImageAt('13')).toBe(DECAN_IMAGE_BY_GREEK[13]);
		[0, 37, -1, NaN, null, undefined, '乱码'].forEach((x)=>expect(decanImageAt(x)).toBeNull());
	});
});

describe('黄道外星座', ()=>{
	test('单列且不混进旬像(名与效验齐备、互不相同)', ()=>{
		expect(EXTRA_ZODIAC_FIGURES.length).toBeGreaterThanOrEqual(10);
		const cns = EXTRA_ZODIAC_FIGURES.map((f)=>f.cn);
		expect(new Set(cns).size).toBe(cns.length);
		EXTRA_ZODIAC_FIGURES.forEach((f)=>{
			expect(f.cn.length).toBeGreaterThan(0);
			expect(f.en.length).toBeGreaterThan(0);
			expect(f.effect.length).toBeGreaterThan(2);
		});
		// 不得与旬像混淆:黄道外星座名不应出现在任何旬像的象文里
		const allImg = DECAN_IMAGES.map((d)=>d.image).join('');
		EXTRA_ZODIAC_FIGURES.forEach((f)=>expect(allImg.indexOf(f.en)).toBe(-1));
	});
});

describe('显示层红线', ()=>{
	test('零章节号、零「手册」字样', ()=>{
		const all = [
			...DECAN_IMAGES.map((d)=>`${d.image}${d.effect}${decanImageKeys(d.effect).join('')}`),
			...EXTRA_ZODIAC_FIGURES.map((f)=>`${f.cn}${f.effect}`),
			DECAN_IMAGE_NOTE, EXTRA_ZODIAC_NOTE,
		].join('\n');
		expect(all.indexOf('§')).toBe(-1);
		expect(all.indexOf('手册')).toBe(-1);
	});

	test('不出现具体人名/书名(来源一律中性表述)', ()=>{
		const all = [
			...DECAN_IMAGES.map((d)=>`${d.image}${d.effect}`),
			DECAN_IMAGE_NOTE, EXTRA_ZODIAC_NOTE,
		].join('\n');
		['Agrippa', 'Picatrix', 'Teucer', 'Porphyry', 'Abano', '阿格里帕', '皮卡特里克斯'].forEach((n)=>{
			expect(all.indexOf(n)).toBe(-1);
		});
		expect(DECAN_IMAGE_NOTE).toContain('古籍');
	});

	test('无中英混排残留(逐条象文与所主不得夹带未译英文词)', ()=>{
		DECAN_IMAGES.forEach((d)=>{
			expect(/[A-Za-z]/.test(d.image)).toBe(false);
			expect(/[A-Za-z]/.test(d.effect)).toBe(false);
		});
	});
});
