// 八宅大游年(翻卦变爻法) + 金锁玉关 golden。
import { dayouNian, bazhai } from '../bazhai';
import { jinsuo } from '../jinsuo';

describe('八宅 大游年（翻卦变爻法）', ()=>{
	it('坎宅游年 == 标准：生气巽/天医震/延年离/伏位坎/五鬼艮/六煞乾/祸害兑/绝命坤', ()=>{
		const s = dayouNian('坎');   // {gong: starObj}
		const byName = {};
		Object.values(s).forEach((v)=>{ byName[v.name] = v.gua; });
		expect(byName['生气']).toBe('巽');
		expect(byName['天医']).toBe('震');
		expect(byName['延年']).toBe('离');
		expect(byName['伏位']).toBe('坎');
		expect(byName['五鬼']).toBe('艮');
		expect(byName['六煞']).toBe('乾');
		expect(byName['祸害']).toBe('兑');
		expect(byName['绝命']).toBe('坤');
	});

	it('八卦坐山游年:每盘八方八星齐全、四吉四凶', ()=>{
		['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'].forEach((z)=>{
			const s = dayouNian(z);
			const stars = Object.values(s);
			expect(stars.length).toBe(8);
			expect(stars.filter((x)=>x.jx === 'good').length).toBe(4);   // 生气/天医/延年/伏位
			expect(stars.filter((x)=>x.jx === 'bad').length).toBe(4);    // 五鬼/六煞/祸害/绝命
			// 伏位恒在坐山本宫。
			const fu = stars.find((x)=>x.name === '伏位');
			expect(fu.gua).toBe(z);
		});
	});

	it('八宅排盘:宅卦组 + 命卦相配（2005男巽=东四 配 离宅=东四→吉）', ()=>{
		const r = bazhai({ zuoGua: '离', ming: { year: 2005, isMale: true } });
		expect(r.available).toBe(true);
		expect(r.zhaiGroup).toBe('东四宅');
		expect(r.mingGua).toBe(4);              // 2005男=巽4
		expect(r.mingGroup).toBe('东四命');
		expect(r.match.same).toBe(true);        // 东四宅+东四命→相配
		expect(r.doorMainStove.door).toMatch(/宜开/);
		expect(r.palaces.length).toBe(8);
	});
});

describe('金锁玉关', ()=>{
	it('得位/失位:1234要砂、6789要水', ()=>{
		const r = jinsuo({ sectors: { 坎: 'sand', 坤: 'sand', 震: 'sand', 巽: 'sand', 乾: 'water', 兑: 'water', 艮: 'water', 离: 'water' } });
		expect(r.available).toBe(true);
		expect(r.deCount).toBe(8);              // 全得位
		expect(r.score).toBe(100);
		r.palaces.forEach((p)=>{ expect(p.deWei).toBe(true); });
	});
	it('失位标记 + 化解:砂宫见水/水宫见砂', ()=>{
		const r = jinsuo({ sectors: { 坎: 'water', 乾: 'sand' } });
		const kan = r.palaces.find((p)=>p.gua === '坎');
		const qian = r.palaces.find((p)=>p.gua === '乾');
		expect(kan.deWei).toBe(false);          // 坎(要砂)见水→失位
		expect(kan.remedy).toMatch(/填实/);
		expect(qian.deWei).toBe(false);          // 乾(要水)见砂→失位
		expect(qian.remedy).toMatch(/疏低|引水/);
		expect(r.palaces.length).toBe(8);
	});
});

describe('金锁玉关 · 切砂水后形态', ()=>{
	const { jinsuoXingOptionsFor, pruneJinsuoXing } = require('../jinsuo');
	test('🔴 原选的形态不在新一侧的档里 → 去掉;还在 → 原样(同一对象);切到平 → 去掉', ()=>{
		// 找一座两侧都有形态、且水侧有砂侧没有的形态的山
		const shans = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];
		const sn = shans.find((s)=>{
			const w = jinsuoXingOptionsFor(s, 'water').map((x)=>x.key);
			const d = jinsuoXingOptionsFor(s, 'sand').map((x)=>x.key);
			return w.length && d.length && w.some((k)=>d.indexOf(k) < 0);
		});
		expect(sn).toBeTruthy();
		const sand = jinsuoXingOptionsFor(sn, 'sand').map((x)=>x.key);
		const onlyWater = jinsuoXingOptionsFor(sn, 'water').map((x)=>x.key).find((k)=>sand.indexOf(k) < 0);
		const xs = { [sn]: onlyWater, 其它: 'x' };
		expect(pruneJinsuoXing(xs, sn, 'sand')).toEqual({ 其它: 'x' });
		expect(pruneJinsuoXing(xs, sn, 'water')).toBe(xs);
		expect(pruneJinsuoXing(xs, sn, 'flat')).toEqual({ 其它: 'x' });
		expect(pruneJinsuoXing({}, sn, 'sand')).toEqual({});
	});
});
