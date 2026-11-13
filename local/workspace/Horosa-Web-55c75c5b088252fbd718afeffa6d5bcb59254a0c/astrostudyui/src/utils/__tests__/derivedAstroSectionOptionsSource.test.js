// 派生盘「纳入内容」候选与导出正文同源:导出抽取读各页自己的模块快照,候选也必须读它 ——
// 此前候选一律读本命快照,黄道制(正文只有【黄道制】一段)的设置里冒出 18 个本命段;用户取消唯一真段后,
// 剩下勾的全是正文里没有的段 → 过滤为空 → 回退原文 = 取消不掉。
jest.mock('../aiExport/snapshotLookup', ()=>{
	const actual = jest.requireActual('../aiExport/snapshotLookup');
	const NATAL = ['[起盘信息]', 'a', '[星与虚点]', 'b', '[古典格局]', 'c', '[本命独有段]', 'd'].join('\n');
	const MODULES = {
		hellenastro: ['[起盘信息]', 'x', '[十三分盘]', 'y'].join('\n'),
	};
	return {
		...actual,
		getAstroCachedContent: ()=>NATAL,
		getModuleCachedContent: (key)=>MODULES[key] || '',
	};
});

import { getOptionsForTechniqueKey, AI_EXPORT_PRESET_SECTIONS } from '../aiExport';
import { DERIVED_ASTRO_MODULE_KEYS, DERIVED_ASTRO_NO_NATAL_FALLBACK_KEYS } from '../aiExport/presets';

describe('派生盘段候选 × 导出正文同源', ()=>{
	it('黄道制没出盘:候选只有自己的段,不混入本命段', ()=>{
		expect(getOptionsForTechniqueKey('zodiacsystems')).toEqual(['黄道制']);
	});
	it('变换盘没出盘:候选 = preset,不混入本命独有段', ()=>{
		const opts = getOptionsForTechniqueKey('transformchart');
		expect(opts).toEqual(AI_EXPORT_PRESET_SECTIONS.transformchart);
		expect(opts).not.toContain('本命独有段');
	});
	it('有模块快照的派生盘读本页快照(不读本命)', ()=>{
		const opts = getOptionsForTechniqueKey('hellenastro');
		expect(opts).toContain('十三分盘');
		expect(opts).not.toContain('本命独有段');
	});
	it('本命盘照旧读本命快照', ()=>{
		expect(getOptionsForTechniqueKey('astrochart')).toContain('本命独有段');
	});
	it('导出抽取与候选共用同一份键表', ()=>{
		const fs = require('fs');
		const path = require('path');
		const ext = fs.readFileSync(path.join(__dirname, '../aiExport/extractors.js'), 'utf8');
		const model = fs.readFileSync(path.join(__dirname, '../aiExport/settingsModel.js'), 'utf8');
		[ext, model].forEach((src)=>{
			expect(src).toMatch(/DERIVED_ASTRO_MODULE_KEYS\.indexOf/);
			expect(src).toMatch(/DERIVED_ASTRO_NO_NATAL_FALLBACK_KEYS\.indexOf/);
			expect(src).not.toMatch(/const\s+(DERIVED_ASTRO_MODULE_KEYS|NO_NATAL_FALLBACK_KEYS)\s*=/);
		});
		expect(DERIVED_ASTRO_NO_NATAL_FALLBACK_KEYS.every((k)=>DERIVED_ASTRO_MODULE_KEYS.includes(k))).toBe(true);
	});
});
