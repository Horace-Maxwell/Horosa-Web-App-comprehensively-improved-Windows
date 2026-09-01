// [奇门择日 T3] 四本账哨兵:导航/储存/AI 挂载/AI 导出四套注册表在位 + 快照段头逐字成对 +
// 键归一不受染。漏任一本 = 老用户静默缺功能(加技法四本账铁律);本测试把八账钉死。
import fs from 'fs';
import path from 'path';
import { ZERI_SUBTABS } from '../../../constants/SubTabRegistry';
import { CASE_TYPE_OPTIONS } from '../../../utils/localcases';
import { AI_EXPORT_PRESET_SECTIONS, getAIExportAuditMatrix, getAIExportDefaultOffSet } from '../../../utils/aiExport';
import { ANALYSIS_TECHNIQUE_LABELS, ANALYSIS_CASE_TECHNIQUES } from '../../../utils/aiAnalysisContext';
import { isSectionsOnlyTechnique, getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';
import { buildQimenZeriSnapshotExtra } from '../qimenZeriSnapshot';
import { newQimenLeaf, newQimenGroup } from '../qimenConditionTypes';

describe('账本一:导航', ()=>{
	test('ZERI_SUBTABS 含 qimenzeri 且尾部追加(首档天星不变)', ()=>{
		expect(ZERI_SUBTABS[0]).toBe('tianxing');
		expect(ZERI_SUBTABS).toContain('qimenzeri');
	});
	test('ZeriMain TabPane 与注册表成对(防切走切回被打回首档)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../../components/zeri/ZeriMain.js'), 'utf8');
		ZERI_SUBTABS.forEach((key)=>{
			expect({ key, has: src.includes(`key="${key}"`) }).toEqual({ key, has: true });
		});
	});
});

describe('账本二:事盘储存', ()=>{
	test('CASE_TYPE_OPTIONS 含 qimenzeri 完整路由(tab=zeri/subTab=qimenzeri/module=qimenzeri)', ()=>{
		const hit = CASE_TYPE_OPTIONS.find((o)=>o.value === 'qimenzeri');
		expect(hit).toBeTruthy();
		expect(hit.label).toBe('奇门择日');
		expect(hit.tab).toBe('zeri');
		expect(hit.subTab).toBe('qimenzeri');
		expect(hit.module).toBe('qimenzeri');
	});
});

describe('账本三:AI 挂载', ()=>{
	test('标签/可挂载清单/sectionsOnly 定性三处在位', ()=>{
		expect(ANALYSIS_TECHNIQUE_LABELS.qimenzeri).toBe('奇门择日');
		expect(ANALYSIS_CASE_TECHNIQUES).toContain('qimenzeri');
		expect(isSectionsOnlyTechnique('qimenzeri')).toBe(true);
		expect(getTechniqueSettingsSchema('qimenzeri')).toBeTruthy();
	});
	test('键归一不受染:aiAnalysisContext 源中 qimenzeri 绝不被 remap 成 qimen', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../../utils/aiAnalysisContext.js'), 'utf8');
		expect(/qimenzeri['"]?\s*:\s*['"]qimen['"]/.test(src)).toBe(false);
		expect(src).toContain(`case 'qimenzeri':`);
	});
	test('🔴 挂载分支兼容快照双形(对象包.content/纯字符串;按字符串直读对象=挂出 [object Object])', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../../utils/aiAnalysisContext.js'), 'utf8');
		const at = src.indexOf(`case 'qimenzeri':`);
		const caseBlock = src.slice(at, at + 1200);
		expect(caseBlock).toContain(`typeof payload.snapshot === 'object'`);
		expect(caseBlock).toContain('payload.snapshot.content');
	});
});

describe('账本四:AI 导出(含设置迁移)', ()=>{
	test('审计矩阵含 qimenzeri 且 migrationEnabled', ()=>{
		const matrix = getAIExportAuditMatrix();
		const hit = matrix.find((item)=>item.key === 'qimenzeri');
		expect(hit).toBeTruthy();
		expect(hit.migrationEnabled).toBe(true);
	});
	test('preset = qimen 全段(单一真值源自动跟随) + 择日三段;默认关段沿 qimen', ()=>{
		const preset = AI_EXPORT_PRESET_SECTIONS.qimenzeri;
		expect(Array.isArray(preset)).toBe(true);
		expect(preset.slice(0, -3)).toEqual(AI_EXPORT_PRESET_SECTIONS.qimen);
		expect(preset.slice(-3)).toEqual(['择日搜索配置', '择日条件', '命中时辰']);
		const offSet = getAIExportDefaultOffSet('qimenzeri');
		expect(offSet && offSet.has('八宫克应')).toBe(true);
	});
	test('🔒 段头逐字成对:builder 实产段头 == preset 追加三段(注错自证:错一字必咬)', ()=>{
		const tree = { ...newQimenGroup('all'), children: [newQimenLeaf('pattern_ji')] };
		const extra = buildQimenZeriSnapshotExtra({
			cfg: { startDate: '2026-05-15', startTime: '00:00', endDate: '2026-05-15', endTime: '23:59' },
			geo: { pos: '杭州', zone: '+08:00', gpsLon: 120, gpsLat: 30 },
			options: { paiPanType: 3, qijuMethod: 'chaibu', school: '转盘', kongMode: 'day', yimaMode: 'day', timeAlg: 1, after23NewDay: 0 },
			tree,
			results: [{ start: '2026-05-15 00:00', end: '2026-05-15 01:00', juText: '阳遁七局下元' }],
			truncated: false,
		});
		const headers = extra.split('\n').filter((l)=>/^\[[^\]]+\]$/.test(l)).map((l)=>l.slice(1, -1));
		expect(headers).toEqual(AI_EXPORT_PRESET_SECTIONS.qimenzeri.slice(-3));
		expect(extra).toContain('阳遁七局下元');
		expect(extra).toContain('吉格');
	});
});
