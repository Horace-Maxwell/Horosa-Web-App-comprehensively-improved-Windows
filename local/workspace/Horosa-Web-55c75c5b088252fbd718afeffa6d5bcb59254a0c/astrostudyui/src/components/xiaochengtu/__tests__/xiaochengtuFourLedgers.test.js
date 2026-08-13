// 小成图 · 四本账同步（AI导出 / AI导出设置 / AI分析挂载 / 命盘事盘储存）。
//
// 🔴 最易静默出事的一环:preset 段名与快照段头必须【逐字一致】——快照出的是 `[应期]`,
//    preset 登记的是 `'应期'`,差一个字 filterContentByWantedSections 就把整段静默滤掉:
//    用户在「AI导出设置」里勾了却导不出来,且无任何报错。故此处拿【真快照】的段头与
//    preset 做集合对拍,而不是各写各的清单。
import { AI_EXPORT_PRESET_SECTIONS, AI_EXPORT_SETTINGS_VERSION, saveAIExportSettings, __aiExportTesting__ } from '../../../utils/aiExport';
import { ANALYSIS_TECHNIQUE_LABELS, ANALYSIS_CASE_TECHNIQUES, listAnalysisTechniqueOptions } from '../../../utils/aiAnalysisContext';
import { TECHNIQUE_SETTINGS_SCHEMA, getTechniqueSettingsDefaults } from '../../../utils/techniqueMountSettings';
import { CASE_TYPE_OPTIONS } from '../../../utils/localcases';
import { buildXiaoChengTuSnapshotText, DEFAULT_SETTINGS } from '../XiaoChengTuMain';
import { qiGuaManual, qiGuaByStock } from '../core/xiaochengtuQiGua';
import { buildPan } from '../core/xiaochengtuPan';

const { applyUserSectionFilter } = __aiExportTesting__;
const PRESET = AI_EXPORT_PRESET_SECTIONS.xiaochengtu;
const QI = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [1, 2, 5] });
const SNAP = buildXiaoChengTuSnapshotText(buildPan(QI), QI, { yongGong: 1, askEvent: '问功名' });
const STOCK_QI = qiGuaByStock({ open: '1563.62', close: '1571.60' });
const STOCK_SNAP = buildXiaoChengTuSnapshotText(buildPan(STOCK_QI), STOCK_QI, { yongGong: 8 });
const headsOf = (t)=>(t.match(/^\[([^\]]+)\]$/gm) || []).map((s)=>s.slice(1, -1));

// applyUserSectionFilter 只认已落盘的设置 → 必须先 save 再断言;且 save 必须带当前 version,
// 否则被当 legacy 存档跑 union 迁移,把整份 preset 并进选择 →「过滤失效」的假象。
const withSections = (arr)=>{ saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION, sections: { xiaochengtu: arr } }); };
afterEach(()=>{ try{ window.localStorage.clear(); }catch(e){ void e; } });

describe('账①②：AI 导出段登记 与 导出设置面板（同源 preset）', ()=>{
	it('🔴 preset 与真快照段头逐字一致(非股市局=前六段)', ()=>{
		expect(headsOf(SNAP)).toEqual(['问事', '起卦', '佈局', '推导', '四象', '应期']);
		headsOf(SNAP).forEach((h)=>{ expect(PRESET).toContain(h); });
	});
	it('🔴 股市局第七段亦在册(股市段只随股价起卦出)', ()=>{
		expect(headsOf(STOCK_SNAP)).toEqual(['问事', '起卦', '佈局', '推导', '四象', '应期', '股市']);
		expect(PRESET).toContain('股市');
	});
	it('preset 恰为七段、无重复、无空白(面板候选=导出白名单同源)', ()=>{
		expect(PRESET).toEqual(['问事', '起卦', '佈局', '推导', '四象', '应期', '股市']);
		expect(new Set(PRESET).size).toBe(PRESET.length);
		PRESET.forEach((s)=>{ expect(typeof s).toBe('string'); expect(s.trim()).toBe(s); });
	});
	it('本轮新增内容一律折进既有段,段头集合零新增(golden-lock)', ()=>{
		// 新增的应期推演链/四象口径行/宫义均在既有段内,故段头恒为上表
		expect(SNAP).toContain('应期推演(系载例归纳)');
		expect(SNAP).toContain('闢卦细判口径');
		expect(headsOf(SNAP).length).toBe(6);
	});
});

describe('账①：勾选真的过滤到正文（不是只改设置不改输出）', ()=>{
	it('只勾三段 → 正文只剩这三段,其余被滤掉', ()=>{
		withSections(['问事', '佈局', '应期']);
		const out = applyUserSectionFilter(SNAP, 'xiaochengtu');
		expect(out).toContain('[问事]');
		expect(out).toContain('[佈局]');
		expect(out).toContain('[应期]');
		expect(out).not.toContain('[四象]');
		expect(out).not.toContain('[推导]');
		// 段内正文随段走(勾了段就带得出内容)
		expect(out).toContain('中宫五、十居中');
		expect(out).toContain('应期推演');
	});
	it('全勾 → 七段齐全', ()=>{
		withSections([...PRESET]);
		const out = applyUserSectionFilter(STOCK_SNAP, 'xiaochengtu');
		headsOf(STOCK_SNAP).forEach((h)=>{ expect(out).toContain(`[${h}]`); });
	});
	it('未自定义(无 xiaochengtu 键)→ 全量不过滤', ()=>{
		const out = applyUserSectionFilter(SNAP, 'xiaochengtu');
		expect(headsOf(out)).toEqual(headsOf(SNAP));
	});
	it('🔴 段名逐字匹配:写错一个字那段即被丢弃(故上面的对拍不可省)', ()=>{
		withSections(['问事', '应期X']);
		const out = applyUserSectionFilter(SNAP, 'xiaochengtu');
		expect(out).toContain('[问事]');
		expect(out).not.toContain('应期推演');
	});
	it('全部段名都对不上 → 兜底回退原文(宁可全给,不给空白)', ()=>{
		withSections(['佈局X']);
		const out = applyUserSectionFilter(SNAP, 'xiaochengtu');
		expect(out).toContain('[佈局]');
		expect(out).toContain('[四象]');
	});
});

describe('账③：AI 分析挂载', ()=>{
	it('标签在册 + 在事盘类可挂清单内 + 起课时间源下拉可见(缺卦走时间卦兜底)', ()=>{
		expect(ANALYSIS_TECHNIQUE_LABELS.xiaochengtu).toBe('小成图');
		expect(ANALYSIS_CASE_TECHNIQUES).toContain('xiaochengtu');
		// 起课时间源:下拉单源自 TIMEPOINT_CASTABLE_SET,入集即入下拉
		const opts = listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).map((o)=>o.value);
		expect(opts).toContain('xiaochengtu');
	});
	it('每技法设置(齿轮)登记:用宫 + 闢卦口径,默认与组件同源', ()=>{
		const spec = TECHNIQUE_SETTINGS_SCHEMA.xiaochengtu;
		expect(spec.kind).toBe('payload');
		expect(spec.optionsPath).toBe('options');
		expect(spec.fields.map((f)=>f.name).sort()).toEqual(['piKoujing', 'yongGong']);
		expect(getTechniqueSettingsDefaults('xiaochengtu')).toEqual({ yongGong: DEFAULT_SETTINGS.yongGong, piKoujing: DEFAULT_SETTINGS.piKoujing });
	});
	it('🔴 起卦法/配数流派不登记(齿轮重配=伪造卦,卦须是冻结值)', ()=>{
		const names = TECHNIQUE_SETTINGS_SCHEMA.xiaochengtu.fields.map((f)=>f.name);
		['qiguaFa', 'qiguaShu', 'kline'].forEach((k)=>{ expect(names).not.toContain(k); });
	});
});

describe('账④：命盘事盘储存', ()=>{
	it('事盘模块在册,module/subTab/tab 三键齐备', ()=>{
		const hit = CASE_TYPE_OPTIONS.find((m)=>m.value === 'xiaochengtu');
		expect(hit).toBeTruthy();
		expect(hit.label).toBe('小成图');
		expect(hit.module).toBe('xiaochengtu');
		expect(hit.subTab).toBe('xiaochengtu');
		expect(hit.tab).toBe('cnyibu');
	});
});
