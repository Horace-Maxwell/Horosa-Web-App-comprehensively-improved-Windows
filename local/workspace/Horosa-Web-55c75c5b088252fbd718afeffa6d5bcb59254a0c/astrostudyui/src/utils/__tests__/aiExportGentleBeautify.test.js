// [v2] 温和归一器测试:去 bulletize 膨胀 / GFM 表整块直通 / 保留去噪+段内去重。
// v1 beautifyForAI 行为由既有链路测试守(经典格式回退阀,本套不碰)。
import {
	__aiExportTesting__, getAIExportFormatPreference, isAIExportScreenshotEnabled, loadAIExportSettings,
	getAIExportDefaultOffSet, getAIExportEffectiveSectionsForTechnique, applyAIExportSectionFilterToSnapshot,
} from '../aiExport';

const AI_EXPORT_SETTINGS_KEY = 'horosa.ai.export.settings.v1'; // 与 aiExport.js 内部常量同字面(未导出)

const { beautifyForAIGentle, normalizeAIExportPrefs } = __aiExportTesting__;

describe('beautifyForAIGentle 温和归一', ()=>{
	test('不加 - 项目符、不逐行插空行(告别 2 倍膨胀)', ()=>{
		const src = '[起盘信息]\n干支：甲子\n宫位：命宫';
		const out = beautifyForAIGentle(src);
		expect(out).toContain('干支：甲子');
		expect(out).not.toMatch(/^- /m);
		// v1 会输出 6+ 行(每行后插空行);温和版 = 段头+空行+两行内容
		expect(out.split('\n').length).toBeLessThanOrEqual(4);
	});

	test('GFM 表整块直通:不去重、不改写(重复单元格行保留)', ()=>{
		const src = [
			'[宫位总览]',
			'| 宫 | 星 |',
			'| --- | --- |',
			'| 命宫 | 紫微 |',
			'| 迁移 | 紫微 |',
		].join('\n');
		const out = beautifyForAIGentle(src);
		expect(out).toContain('| --- | --- |');
		expect(out).toContain('| 命宫 | 紫微 |');
		expect(out).toContain('| 迁移 | 紫微 |');
	});

	test('段内去重仍在(同段重复行剔除,跨段不受影响)', ()=>{
		const src = '[甲]\n同一行\n同一行\n[乙]\n同一行';
		const out = beautifyForAIGentle(src);
		expect(out.match(/同一行/g).length).toBe(2);
	});

	test('噪音行剔除(与 v1 同口径)', ()=>{
		const out = beautifyForAIGentle('[段]\n[图形标注文本]\n打印星盘\n真内容');
		expect(out).not.toContain('图形标注文本');
		expect(out).not.toContain('打印星盘');
		expect(out).toContain('真内容');
	});

	test('长句不强拆(v1 会按句号拆行)', ()=>{
		const long = `一${'句'.repeat(120)}。后半段继续。`;
		const out = beautifyForAIGentle(`[段]\n${long}`);
		expect(out).toContain(long);
	});
});

describe('导出偏好 normalize 与读取(默认=v2,用户拍板;v1=显式回退阀)', ()=>{
	test('normalizeAIExportPrefs:未知值回默认 v2;显式 v1/关截图 保留', ()=>{
		expect(normalizeAIExportPrefs(null)).toEqual({ format: 'v2', attachScreenshot: true, legend: true });
		expect(normalizeAIExportPrefs({ format: 'v1', attachScreenshot: false })).toEqual({ format: 'v1', attachScreenshot: false, legend: true });
		expect(normalizeAIExportPrefs({ format: '奇怪值' }).format).toBe('v2');
	});
	test('getter 对脏 settings 兜底(缺省=v2;显式 v1 尊重)', ()=>{
		expect(getAIExportFormatPreference({})).toBe('v2');
		expect(getAIExportFormatPreference({ prefs: { format: 'v1' } })).toBe('v1');
		expect(isAIExportScreenshotEnabled({ prefs: { attachScreenshot: false } })).toBe(false);
		expect(isAIExportScreenshotEnabled({})).toBe(true);
	});

	test('[YC] 默认关段:未自定义=preset−默认关;显式勾选=尊重;union 不硬并;零登记技法原样', ()=>{
		// sixyao 登记了默认关段「判语库·参考诀表」。
		expect(Array.from(getAIExportDefaultOffSet('sixyao'))).toContain('判语库·参考诀表');
		expect(getAIExportDefaultOffSet('ziwei')).toBeNull();
		const noCustom = { version: 42, sections: {} };
		// effective:未自定义 → preset 不含默认关段。
		const eff = getAIExportEffectiveSectionsForTechnique('sixyao', noCustom);
		expect(eff).toContain('卦象');
		expect(eff).not.toContain('判语库·参考诀表');
		// 过滤器:未自定义时默认关段被剔、其余段保留(受控豁免「原样返回」铁律)。
		const doc = '[卦象]\n六冲\n\n[判语库·参考诀表]\n持世诀……';
		const filtered = applyAIExportSectionFilterToSnapshot('sixyao', doc, noCustom);
		expect(filtered).toContain('[卦象]');
		expect(filtered).not.toContain('判语库');
		// 零登记技法(紫微):未自定义仍原样返回(既有零回归铁律不破)。
		const ziweiDoc = '[起盘信息]\n日期：X\n\n[宫位总览]\n| 宫位 |';
		expect(applyAIExportSectionFilterToSnapshot('ziwei', ziweiDoc, noCustom)).toBe(ziweiDoc);
		// 显式勾选默认关段 → 尊重(出现在 effective 与过滤结果)。
		const custom = { version: 42, sections: { sixyao: ['判语库·参考诀表'] } };
		expect(getAIExportEffectiveSectionsForTechnique('sixyao', custom)).toContain('判语库·参考诀表');
		expect(applyAIExportSectionFilterToSnapshot('sixyao', doc, custom)).toContain('持世诀');
		// migration union(旧版本自定义过 sixyao)不硬并默认关段。
		try{
			localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify({ version: 30, sections: { sixyao: ['卦象'] } }));
			const migrated = loadAIExportSettings();
			expect(migrated.sections.sixyao).toContain('卦象');
			expect(migrated.sections.sixyao).not.toContain('判语库·参考诀表');
		}finally{
			localStorage.removeItem(AI_EXPORT_SETTINGS_KEY);
		}
	});

	test('v41 一次性迁移:v40 存量 format=v1(中间态残留)→ 重置 v2;v41 显式 v1 → 永久尊重', ()=>{
		try{
			localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify({ version: 40, sections: {}, prefs: { format: 'v1' } }));
			expect(loadAIExportSettings().prefs.format).toBe('v2');
			localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify({ version: 41, sections: {}, prefs: { format: 'v1' } }));
			expect(loadAIExportSettings().prefs.format).toBe('v1');
			// 真实老用户(v≤40 且无 prefs 字段):走默认 v2,不受迁移影响。
			localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify({ version: 38, sections: { ziwei: ['起盘信息'] } }));
			const migrated = loadAIExportSettings();
			expect(migrated.prefs.format).toBe('v2');
			expect(migrated.sections.ziwei).toContain('起盘信息');
		}finally{
			localStorage.removeItem(AI_EXPORT_SETTINGS_KEY);
		}
	});
});
