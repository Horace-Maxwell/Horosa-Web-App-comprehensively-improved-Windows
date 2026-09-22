// [挂载自检 阶段3(b)] 「能挂即能选」机械网:每个技法 preset 段 ⊆ 抽屉「纳入内容」候选(getOptionsForTechniqueKey),
// 且缺省有效段(无自定义)⊆ 候选;缺省关段不在缺省有效段里。新增 preset 段而候选取不到 → 用户想关关不掉,当场红。
import { AI_EXPORT_PRESET_SECTIONS, getOptionsForTechniqueKey, getAIExportEffectiveSectionsForTechnique, getAIExportDefaultOffSet, normalizeSectionTitle } from '../aiExport';

const norm = (s)=>normalizeSectionTitle(s).replace(/\s+/g, '');

describe('preset ⊆ 纳入内容候选(全键机械)', ()=>{
	Object.keys(AI_EXPORT_PRESET_SECTIONS).forEach((key)=>{
		it(`${key}:preset 段全部出现在候选;缺省有效段 ⊆ 候选;缺省关段不在缺省有效段`, ()=>{
			const preset = AI_EXPORT_PRESET_SECTIONS[key] || [];
			const options = new Set(getOptionsForTechniqueKey(key).map(norm));
			const missing = preset.map(norm).filter((s)=>!options.has(s));
			expect(missing).toEqual([]);
			const eff = getAIExportEffectiveSectionsForTechnique(key, { sections: {} }).map(norm);
			expect(eff.filter((s)=>!options.has(s))).toEqual([]);
			const off = getAIExportDefaultOffSet(key);
			if(off){
				const offNorm = [...off].map((s)=>`${s}`.replace(/\s+/g, ''));
				expect(eff.filter((s)=>offNorm.includes(s))).toEqual([]);
			}
		});
	});
});
