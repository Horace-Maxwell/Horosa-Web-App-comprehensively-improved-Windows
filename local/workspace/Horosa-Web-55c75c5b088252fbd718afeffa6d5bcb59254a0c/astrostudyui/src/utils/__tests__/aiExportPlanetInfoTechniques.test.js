// 「星曜后天信息」两项开关(落宫 / 主宰宫)只列给正文里真带这种括注的技法。
// 曾经:期表类时主、推运图类、七政等 16 个技法也在表里 —— 它们的正文没有后天括注,设置面上却列着两项,勾了没反应。
import {
	AI_EXPORT_PLANET_INFO_TECHNIQUES, AI_EXPORT_ASTRO_MEANING_TECHNIQUES, AI_EXPORT_MEANING_ONLY_TECHNIQUES, AI_EXPORT_TECHNIQUES,
} from '../aiExport/presets';
import { applyPlanetInfoFilterByContext } from '../aiExport/sectionFilter';
import { AI_EXPORT_SETTINGS_KEY } from '../aiExport/presets';

const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', '..');

describe('星曜后天信息 · 适用技法表', ()=>{
	it('只进释义表的技法不在后天信息表里,且都在释义表与导出技法表里', ()=>{
		const all = new Set(AI_EXPORT_TECHNIQUES.map((t)=>t.key));
		expect(AI_EXPORT_MEANING_ONLY_TECHNIQUES.length).toBeGreaterThanOrEqual(16);
		AI_EXPORT_MEANING_ONLY_TECHNIQUES.forEach((k)=>{
			expect(AI_EXPORT_PLANET_INFO_TECHNIQUES.has(k)).toBe(false);
			expect(AI_EXPORT_ASTRO_MEANING_TECHNIQUES.has(k)).toBe(true);
			expect(all.has(k)).toBe(true);
		});
	});

	// 这几个技法的正文由各自的生成函数直接写出,源码里不调后天括注的出口 → 不该出现在后天信息表里
	it('只进释义表的技法,其正文生成源码不调后天括注出口', ()=>{
		const builders = {
			balbillus: 'utils/balbillus.js', yearsystem129: 'utils/yearSystem129.js', triplicityrulers: 'utils/triplicityRulers.js',
			keypoints: 'utils/keypoints120.js', lunationphase: 'utils/lunationPhase.js', neroman: 'utils/directedFigures.js',
			bezzafigure: 'utils/directedFigures.js', jayprofection: 'utils/directedFigures.js', michon: 'utils/directedFigures.js', timelords: 'utils/directedFigures.js',
		};
		Object.keys(builders).forEach((k)=>{
			const src = fs.readFileSync(path.join(SRC, builders[k]), 'utf8');
			expect(src).not.toMatch(/appendPlanetHouseInfo|formatPlanetHouseInfo/);
			expect(AI_EXPORT_MEANING_ONLY_TECHNIQUES).toContain(k);
		});
	});

	it('表里的技法:带括注的正文,两项开关各自生效;表外的技法:原样', ()=>{
		const text = ['[行星]', '太阳：白羊 10˚20分 (后天: 3th; 1R5R)', '月亮：金牛 5˚ (后天: 4th; 2R)'].join('\n');
		const set = (key, v)=>window.localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify({ version: 999, sections: {}, planetInfo: { [key]: v }, astroMeaning: {}, prefs: {} }));
		set('solararc', { showHouse: 0, showRuler: 1 });
		const noHouse = applyPlanetInfoFilterByContext(text, 'solararc');
		expect(noHouse).not.toContain('3th');
		expect(noHouse).toContain('1R5R');
		set('solararc', { showHouse: 1, showRuler: 0 });
		const noRuler = applyPlanetInfoFilterByContext(text, 'solararc');
		expect(noRuler).toContain('3th');
		expect(noRuler).not.toContain('1R5R');
		set('balbillus', { showHouse: 0, showRuler: 0 });
		expect(applyPlanetInfoFilterByContext(text, 'balbillus')).toBe(text);
		window.localStorage.removeItem(AI_EXPORT_SETTINGS_KEY);
	});
});
