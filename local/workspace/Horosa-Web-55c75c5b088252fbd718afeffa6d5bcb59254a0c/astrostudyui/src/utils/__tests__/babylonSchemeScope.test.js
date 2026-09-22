// [Q-346] 派系只在真有差异的页上出现「有用」的样子
import { SCHEME_VARYING_KEYS, schemeAffectsTab, BABYLON_PARAM_SPEC, BABYLON_TABS } from '../../divination/babylon/babylonSchools';
it('🔴 派系差异键由三档配置自证;只有个人星盘/数理星历两页受影响', ()=>{
	expect(SCHEME_VARYING_KEYS.slice().sort()).toEqual(['ephemerisSource', 'solstice']);
	expect(schemeAffectsTab('horoscope')).toBe(true);
	expect(schemeAffectsTab('ephemeris')).toBe(true);
	['mulapin', 'microzodiac', 'melothesia', 'eae', 'almanac', 'hemerology'].forEach((t)=>{
		expect(schemeAffectsTab(t)).toBe(false);
	});
	// 判别向量:微黄道页仍保留它真读的 dodecaVariant
	const micro = BABYLON_PARAM_SPEC.filter((p)=>(p.appliesTo || []).indexOf('microzodiac') >= 0).map((p)=>p.key);
	expect(micro).toEqual(['dodecaVariant']);
});
