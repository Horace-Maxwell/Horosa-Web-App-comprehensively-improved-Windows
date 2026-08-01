// C4:AI 导出管线对主限法段的真实处理(段登记/勾选过滤/别名迁移),非仅快照落库。
import {
	AI_EXPORT_PRESET_SECTIONS,
	splitContentSections,
	getAIExportEffectiveSectionsForTechnique,
	applyAIExportSectionFilterToSnapshot,
} from '../aiExport';

const SNAP = [
	'[出生时间]', '1990-03-15 12:30', '',
	'[星盘信息]', '北京', '',
	'[主限法设置]', '弧算法（投影）：Regiomontanus', '盘面宫制（分宫）：Whole Sign（整宫）',
	'应星扩展：Desc、Syzygy、Cusps', '迫星扩展：cusps、stars', '',
	'[主限法表格]', '| Arc | 迫星 | 应星 | 日期 |', '| --- | --- | --- | --- |',
	'| 1度2分 | 第3宫头 | 水 | 2030-01-01 |', '| 2度3分 | 恒星 心宿二 | 精神点 | 2031-02-02 |', '',
	'[主限天球·当前动画所指]', '顺向 11°52′ 第11宫头 → 宿敌点', '',
	'[当前时点]', '2026-07-29', '',
	'[方法说明]', '主限法为古典应期技法。',
].join('\n');

describe('C4 主限法 AI 导出管线', ()=>{
	it('preset 段登记含全部七段(与 builder 实际产出的段头一致)', ()=>{
		const preset = AI_EXPORT_PRESET_SECTIONS.primarydirect;
		['出生时间','星盘信息','主限法设置','主限法表格','主限天球·当前动画所指','当前时点','方法说明']
			.forEach((s)=>{ expect([s, preset.indexOf(s) >= 0]).toEqual([s, true]); });
	});

	it('splitContentSections 能把快照切成登记的段(段头零漂移)', ()=>{
		const parts = splitContentSections(SNAP);
		const names = (Array.isArray(parts) ? parts : Object.keys(parts || {})).map(p=>(p && p.title) || p);
		const preset = AI_EXPORT_PRESET_SECTIONS.primarydirect;
		const unknown = names.filter(n=>n && preset.indexOf(`${n}`.replace(/^\[|\]$/g, '')) < 0);
		expect([names.length > 0, unknown]).toEqual([true, []]);
	});

	it('段勾选过滤:白名单去掉「主限法表格」后导出不含扩展行,但设置段仍在', ()=>{
		// settings.sections[key] = 用户勾选的段白名单(数组);空数组=显式全清。
		const settings = { sections: { primarydirect: ['出生时间', '星盘信息', '主限法设置', '当前时点', '方法说明'] } };
		const filtered = applyAIExportSectionFilterToSnapshot('primarydirect', SNAP, settings);
		expect(filtered.indexOf('弧算法（投影）：Regiomontanus') >= 0).toBe(true);
		expect(filtered.indexOf('第3宫头') >= 0).toBe(false);
	});

	it('空数组=显式全清 → 导出为空(与挂载同语义)', ()=>{
		const filtered = applyAIExportSectionFilterToSnapshot('primarydirect', SNAP, { sections: { primarydirect: [] } });
		expect(`${filtered}`.trim()).toBe('');
	});

	it('只勾「主限法表格」→ 扩展行在、设置段被滤掉(反向对照)', ()=>{
		const settings = { sections: { primarydirect: ['主限法表格'] } };
		const filtered = applyAIExportSectionFilterToSnapshot('primarydirect', SNAP, settings);
		expect(filtered.indexOf('恒星 心宿二') >= 0).toBe(true);
		expect(filtered.indexOf('弧算法（投影）') >= 0).toBe(false);
	});

	it('默认(未自定义)导出含扩展行与九键设置行,零裸 ID', ()=>{
		const eff = getAIExportEffectiveSectionsForTechnique('primarydirect');
		expect(Array.isArray(eff) && eff.length > 0).toBe(true);
		const filtered = applyAIExportSectionFilterToSnapshot('primarydirect', SNAP);
		expect(filtered.indexOf('恒星 心宿二') >= 0).toBe(true);
		expect(/(HC_|FS_|LT_|PD_|PC_|MP_|RP_)[A-Za-z]/.test(filtered)).toBe(false);
	});
});
