import {
	getLiuRengXunMeta,
	getLiuRengBranchDunGan,
	getLiuRengDisplayGanZhi,
	buildLiuRengSanChuan,
} from '../LRRuleHelper';
import * as LRConst from '../LRConst';

function makeShiftedLayout(shift = 0){
	const downZi = LRConst.ZiList.slice();
	const upZi = downZi.map((_, index)=>downZi[(index + shift + 12) % 12]);
	return {
		downZi,
		upZi,
		houseTianJiang: LRConst.TianJiang.slice(),
	};
}

describe('LRRuleHelper', ()=>{
	test('resolves xun meta for 甲子旬 and its 旬丁 correctly', ()=>{
		const meta = getLiuRengXunMeta('甲子');
		expect(meta.xunName).toBe('甲子旬');
		expect(meta.xunHead).toBe('子');
		expect(meta.xunTail).toBe('酉');
		expect(meta.xunDing).toBe('卯');
		expect(meta.xunKong).toEqual(['戌', '亥']);
		expect(getLiuRengDisplayGanZhi('甲子', '卯')).toBe('丁卯');
	});

	test('resolves 甲辰旬 branch dun-gan mapping from the documented example', ()=>{
		const meta = getLiuRengXunMeta('丁未');
		expect(meta.xunName).toBe('甲辰旬');
		expect(meta.xunDing).toBe('未');
		expect(getLiuRengBranchDunGan('丁未', '未')).toBe('丁');
		expect(getLiuRengDisplayGanZhi('丁未', '未')).toBe('丁未');
		expect(getLiuRengDisplayGanZhi('丁未', '寅')).toBe('空寅');
	});

	test('uses 伏吟 special rule instead of falling through to ordinary near-ke logic', ()=>{
		const layout = makeShiftedLayout(0);
		const out = buildLiuRengSanChuan({
			dayGanZi: '甲子',
			...layout,
			keRaw: [
				['', '巳', '子'],
				['', '午', '巳'],
				['', '申', '丑'],
				['', '酉', '申'],
			],
		});
		expect(out.name).toBe('不虞课');
		expect(out.rawBranches).toEqual(['巳', '申', '寅']);
		expect(out.cuang).toEqual(['己巳', '壬申', '丙寅']);
	});

	test('uses 反吟 special rule when there is no near-ke', ()=>{
		const layout = makeShiftedLayout(6);
		const out = buildLiuRengSanChuan({
			dayGanZi: '甲亥',
			...layout,
			keRaw: [
				['', '寅', '甲'],
				['', '卯', '寅'],
				['', '申', '亥'],
				['', '酉', '申'],
			],
		});
		expect(out.name).toBe('无亲课');
		expect(out.rawBranches).toEqual(['巳', '申', '寅']);
	});

	test('prefers 八专 over generic 四课不备 handling when 一课与三课相同', ()=>{
		const layout = makeShiftedLayout(1);
		const out = buildLiuRengSanChuan({
			dayGanZi: '甲子',
			...layout,
			keRaw: [
				['', '子', '寅'],
				['', '午', '卯'],
				['', '子', '寅'],
				['', '午', '卯'],
			],
		});
		expect(out.name).toBe('八专课');
		expect(out.rawBranches).toEqual(['寅', '子', '子']);
	});

	test('detects 八专 with runtime 四课 shape where 一课下神是日干', ()=>{
		const layout = makeShiftedLayout(1);
		const out = buildLiuRengSanChuan({
			dayGanZi: '甲寅',
			...layout,
			keRaw: [
				['', '子', '甲'],
				['', '卯', '子'],
				['', '子', '寅'],
				['', '卯', '子'],
			],
		});
		expect(out.name).toBe('八专课');
		expect(out.rawBranches).toEqual(['寅', '子', '子']);
	});

	test('uses documented 阴日别责发用 instead of falling back to 昴星', ()=>{
		const layout = makeShiftedLayout(1);
		const out = buildLiuRengSanChuan({
			dayGanZi: '乙酉',
			...layout,
			keRaw: [
				['', '子', '寅'],
				['', '午', '卯'],
				['', '卯', '午'],
				['', '午', '卯'],
			],
		});
		expect(out.name).toBe('芜淫课');
		expect(out.rawBranches).toEqual(['丑', '子', '子']);
		expect(out.cuang[0]).toBe('己丑');
	});

	test('uses documented 亥日阴日别责初传为卯', ()=>{
		const layout = makeShiftedLayout(1);
		const out = buildLiuRengSanChuan({
			dayGanZi: '乙亥',
			...layout,
			keRaw: [
				['', '子', '乙'],
				['', '卯', '子'],
				['', '寅', '亥'],
				['', '卯', '寅'],
			],
		});
		expect(out.name).toBe('芜淫课');
		expect(out.rawBranches[0]).toBe('卯');
	});
});
