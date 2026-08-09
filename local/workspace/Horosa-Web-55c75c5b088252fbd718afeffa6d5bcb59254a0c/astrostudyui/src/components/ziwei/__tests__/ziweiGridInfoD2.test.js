// [D2] 宫格增量信息金标:
//   ① 四开关默认关 ② dayGanOf 三形状夹具 ③ mingGanOf ④ yearAgesOf 支序推岁 ⑤ formatAgeStrip 截断
//   ⑥ 两盘接线源码守卫(徽在运限槽后调/条在标题带上;kinastro 跳过)
import fs from 'fs';
import path from 'path';
import * as ZiWeiHelper from '../ZiWeiHelper';

const D2_FLAGS = ['ziweiShowMingSihua', 'ziweiShowDaySihua', 'ziweiShowYearAges', 'ziweiShowXiaoxianAges'];
afterEach(()=>{ D2_FLAGS.forEach((k)=>{ try{ localStorage.removeItem(k); }catch(e){ /* noop */ } }); });

describe('[D2] 开关默认关+UI wiring', ()=>{
	test('🔴 四开关默认全关(零绘制=现状);Checkbox 挂通用 handler', ()=>{
		expect(ZiWeiHelper.zwShowMingSihua()).toBe(false);
		expect(ZiWeiHelper.zwShowDaySihua()).toBe(false);
		expect(ZiWeiHelper.zwShowYearAges()).toBe(false);
		expect(ZiWeiHelper.zwShowXiaoxianAges()).toBe(false);
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
		D2_FLAGS.forEach((k)=>{
			expect(`${k}:${src.includes(`onDisplayFlagToggle('${k}'`)}`).toBe(`${k}:true`);
		});
	});
});

describe('[D2] 取数纯函数', ()=>{
	test('🔴 dayGanOf 三形状夹具:fourColumns 优先→bazi.dayGanZi→bazi.bazi.day;全缺 null', ()=>{
		expect(ZiWeiHelper.dayGanOf({ fourColumns: { day: { ganzi: '甲子' } }, bazi: { dayGanZi: '乙丑' } })).toBe('甲');
		expect(ZiWeiHelper.dayGanOf({ bazi: { dayGanZi: '乙丑', bazi: { day: { ganzi: '丙寅' } } } })).toBe('乙');
		expect(ZiWeiHelper.dayGanOf({ bazi: { bazi: { day: { ganzi: '丙寅' } } } })).toBe('丙');
		expect(ZiWeiHelper.dayGanOf({})).toBe(null);
		expect(ZiWeiHelper.dayGanOf(null)).toBe(null);
	});
	test('mingGanOf:命宫宫干;缺盘 null', ()=>{
		const houses = Array.from({ length: 12 }, (_, i)=>({ ganzi: '甲子' }));
		houses[5] = { ganzi: '己巳' };
		expect(ZiWeiHelper.mingGanOf({ lifeHouseIndex: 5, houses })).toBe('己');
		expect(ZiWeiHelper.mingGanOf(null)).toBe(null);
	});
	test('🔴 yearAgesOf:宫支=年支→1 13 25…;隔一支→2 14…;非法支空数组', ()=>{
		expect(ZiWeiHelper.yearAgesOf('午', '午', 4)).toEqual([1, 13, 25, 37]);
		expect(ZiWeiHelper.yearAgesOf('未', '午', 3)).toEqual([2, 14, 26]);
		expect(ZiWeiHelper.yearAgesOf('巳', '午', 3)).toEqual([12, 24, 36]);
		expect(ZiWeiHelper.yearAgesOf('猫', '午')).toEqual([]);
	});
	test('formatAgeStrip:8 内全展;超出截断加省略号;空入空出', ()=>{
		expect(ZiWeiHelper.formatAgeStrip([1, 13, 25])).toBe('1 13 25');
		expect(ZiWeiHelper.formatAgeStrip([1, 2, 3, 4, 5, 6, 7, 8, 9], 8)).toBe('1 2 3 4 5 6 7 8…');
		expect(ZiWeiHelper.formatAgeStrip([])).toBe('');
	});
});

describe('[D2] 两盘接线源码守卫', ()=>{
	test('🔴 徽:两盘 drawStar 内 drawLuckSihuaForStar 之后调 drawStemSihuaChips;条:drawLaiYing 后调 drawAgeStrips', ()=>{
		['ZWHouse.js', 'ZWHouseSangHe.js'].forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
			expect(`${f}:${/drawLuckSihuaForStar[\s\S]{0,300}drawStemSihuaChips/.test(src)}`).toBe(`${f}:true`);
			expect(`${f}:${src.includes('this.drawAgeStrips(')}`).toBe(`${f}:true`);
		});
	});
	test('徽实现:kinastro 跳过+maxBottom 越界保护+槽位从运限层数后起', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZWCommHouse.js'), 'utf8');
		const fn = src.slice(src.indexOf('drawStemSihuaChips(star'));
		const body = fn.slice(0, fn.indexOf('\n\t}\n'));
		expect(body.includes('this.kinastroBorrowed')).toBe(true);
		expect(body.includes('maxBottom')).toBe(true);
		expect(body.includes('luckSihuaLayers || []).length')).toBe(true);
	});
	test('条实现:选中大限命中岁高亮判据+两行向上堆叠越界即停', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'ZWCommHouse.js'), 'utf8');
		const fn = src.slice(src.indexOf('drawAgeStrips(bx'));
		const body = fn.slice(0, fn.indexOf('\n\t}\n'));
		expect(body.includes('inDaxian')).toBe(true);
		expect(body.includes('ry < this.y + 2')).toBe(true);
		expect(body.includes('smallDirection')).toBe(true);
	});
});
