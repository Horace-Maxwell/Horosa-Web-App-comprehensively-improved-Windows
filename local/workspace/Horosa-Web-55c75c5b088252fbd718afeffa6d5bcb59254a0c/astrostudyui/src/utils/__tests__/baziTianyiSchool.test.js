// 天医两家起法只取其一(天医口径,缺省协纪):
//   协纪辨方书 / 六壬指南:天医正月起戌顺行(月支 +8),地医为其对冲(月支 +2);
//   子平:月支退一位(正月见丑),无地医。
// 曾两套并存:同一张盘两个地支都挂「天医」。
import { calcPillarShenSha, calcFourPillarShenSha, calcFlowShenSha, normalizeTianyiSchool } from '../baziShenShaLocal';

const col = (gan, zhi)=>({ stem: { cell: gan }, branch: { cell: zhi } });
// 寅月:协纪天医 = 戌、地医 = 辰;子平天医 = 丑
function fourWith(timeZhi){
	return { year: col('甲', '子'), month: col('丙', '寅'), day: col('戊', '午'), time: col('壬', timeZhi) };
}
const has = (list, name)=>(list || []).indexOf(name) >= 0;

describe('天医口径', ()=>{
	test('缺省 = 协纪', ()=>{
		expect(normalizeTianyiSchool(undefined)).toBe('xieji');
		expect(normalizeTianyiSchool('bogus')).toBe('xieji');
	});
	test('协纪:寅月时支戌挂天医、辰挂地医,丑不挂天医', ()=>{
		expect(has(calcFourPillarShenSha(fourWith('戌'), '年').time, '天医')).toBe(true);
		expect(has(calcFourPillarShenSha(fourWith('辰'), '年').time, '地医')).toBe(true);
		expect(has(calcFourPillarShenSha(fourWith('丑'), '年').time, '天医')).toBe(false);
	});
	test('子平:寅月时支丑挂天医;戌不挂天医、辰不挂地医', ()=>{
		const o = { tianyiSchool: 'ziping' };
		expect(has(calcFourPillarShenSha(fourWith('丑'), '年', o).time, '天医')).toBe(true);
		expect(has(calcFourPillarShenSha(fourWith('戌'), '年', o).time, '天医')).toBe(false);
		expect(has(calcFourPillarShenSha(fourWith('辰'), '年', o).time, '地医')).toBe(false);
	});
	test('同一张盘只有一个地支挂天医(两套不再并存)', ()=>{
		['xieji', 'ziping'].forEach((sc)=>{
			const zhiWithTianyi = ['丑', '戌'].filter((z)=>has(calcFourPillarShenSha(fourWith(z), '年', { tianyiSchool: sc }).time, '天医'));
			expect(zhiWithTianyi).toEqual(sc === 'xieji' ? ['戌'] : ['丑']);
		});
	});
	test('单柱 / 流运同口径', ()=>{
		const base = { yearGan: '甲', yearZhi: '子', monthZhi: '寅', dayGan: '戊', dayZhi: '午' };
		expect(has(calcPillarShenSha(base, { gan: '壬', zhi: '戌' }, '年'), '天医')).toBe(true);
		expect(has(calcPillarShenSha(base, { gan: '壬', zhi: '丑' }, '年'), '天医')).toBe(false);
		expect(has(calcPillarShenSha(base, { gan: '壬', zhi: '丑' }, '年', { tianyiSchool: 'ziping' }), '天医')).toBe(true);
		const four = fourWith('子');
		expect(has(calcFlowShenSha(four, '甲', '戌'), '天医')).toBe(true);
		expect(has(calcFlowShenSha(four, '甲', '丑'), '天医')).toBe(false);
		expect(has(calcFlowShenSha(four, '甲', '丑', { tianyiSchool: 'ziping' }), '天医')).toBe(true);
		expect(has(calcFlowShenSha(four, '甲', '辰', { tianyiSchool: 'ziping' }), '地医')).toBe(false);
	});
});
