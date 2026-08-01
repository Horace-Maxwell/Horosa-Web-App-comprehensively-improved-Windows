// 风水 · 四本账同步（AI导出 / AI导出设置 / AI分析挂载 / 命盘事盘储存）。
//
// 🔴 最易静默出事的一环是「段名不逐字匹配」：buildSnapshot 输出的段头是
//    `【风水·${SCHOOL_CN[school]}】`，而白名单里登记的是字符串常量。差一个字，
//    filterContentByWantedSections 会把整段静默滤掉——用户在设置里勾了却导不出来。
//    故此处把 SCHOOL_CN 与 PRESET_SECTIONS 做集合对拍，而不是各写各的清单。
import { SCHOOL_CN } from '../LiqiWorkspace';
import { AI_EXPORT_PRESET_SECTIONS, AI_EXPORT_SETTINGS_VERSION, saveAIExportSettings, __aiExportTesting__ } from '../../../utils/aiExport';
import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_TECHNIQUE_LABELS } from '../../../utils/aiAnalysisContext';

const { applyUserSectionFilter, normalizeAIExportSettings } = __aiExportTesting__;
const PRESET = AI_EXPORT_PRESET_SECTIONS.fengshui;
// applyUserSectionFilter 只认已落盘的设置（不收 settings 形参）→ 测试必须先 save 再断言，
// 否则读到空设置走「未自定义=不过滤」分支，会把「过滤没生效」误判成 bug。
// 🔴 save 必须带当前 version：不带 version 会被当成 legacy 存档跑全量 union 迁移，
//    把整份 preset 并进选择 → 看起来「过滤失效」，实为迁移把该勾的都勾上了。
const withSections = (arr)=>{ saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION, sections: { fengshui: arr } }); };
afterEach(()=>{ try{ window.localStorage.clear(); }catch(e){ void e; } });

describe('账①②：AI 导出段登记 与 导出设置面板（同源 preset）', ()=>{
	it('十六项流派逐一在册，且段名与 buildSnapshot 段头逐字一致', ()=>{
		const keys = Object.keys(SCHOOL_CN);
		expect(keys.length).toBe(16);
		keys.forEach((k)=>{
			const header = `风水·${SCHOOL_CN[k]}`;                       // buildSnapshot 出的是 【${header}】
			expect(PRESET).toContain(header);
		});
	});
	it('preset 里的「风水·」段与十六项一一对应，无多余无遗漏', ()=>{
		const inPreset = PRESET.filter((s)=>s.indexOf('风水·') === 0).sort();
		const expected = Object.keys(SCHOOL_CN).map((k)=>`风水·${SCHOOL_CN[k]}`).sort();
		expect(inPreset).toEqual(expected);
	});
	it('导出设置面板的候选项即 preset（勾得到才导得出）', ()=>{
		// 面板 defaults 走 AI_EXPORT_PRESET_SECTIONS[activeKey]，与导出白名单同源 → 只需断言同一份数组。
		expect(Array.isArray(PRESET)).toBe(true);
		expect(new Set(PRESET).size).toBe(PRESET.length);        // 无重复项（重复会让面板出现两个同名勾）
		PRESET.forEach((s)=>{ expect(typeof s).toBe('string'); expect(s.trim()).toBe(s); });
	});
});

describe('账①：勾选真的过滤到正文（不是只改了设置不改输出）', ()=>{
	const snap = ['【风水·综合罗经】', '坐子 向午 · 度数 0.00°', '三针：地盘正针＝子山',
		'', '【风水·玄空六法】', '9运 坐子 向午', '玄空（零正）：零正颠倒'].join('\n');
	it('只勾综合罗经 → 正文只剩该段，六法段被滤掉', ()=>{
		withSections(['风水·综合罗经']);
		const out = applyUserSectionFilter(snap, 'fengshui');
		expect(out).toContain('综合罗经');
		expect(out).toContain('三针：地盘正针');
		expect(out).not.toContain('玄空六法');
	});
	it('两段都勾 → 两段都在', ()=>{
		withSections(['风水·综合罗经', '风水·玄空六法']);
		const out = applyUserSectionFilter(snap, 'fengshui');
		expect(out).toContain('综合罗经');
		expect(out).toContain('玄空六法');
	});
	it('未自定义（无 fengshui 键）→ 全量不过滤', ()=>{
		const out = applyUserSectionFilter(snap, 'fengshui');   // 未落盘任何 fengshui 选择
		expect(out).toContain('综合罗经');
		expect(out).toContain('玄空六法');
	});
	it('🔴 白名单逐字匹配：一对一错时错的那段被丢弃（故 preset 与段头的对拍不可省）', ()=>{
		withSections(['风水·综合罗经', '风水·玄空六法X']);   // 后者多一个字
		const out = applyUserSectionFilter(snap, 'fengshui');
		expect(out).toContain('三针：地盘正针');
		expect(out).not.toContain('零正颠倒');
	});
	it('全部段名都对不上 → 按既定兜底回退原文（宁可全给，不给空白）', ()=>{
		withSections(['风水·综合罗盘']);   // 「罗经」写成「罗盘」，无一命中
		const out = applyUserSectionFilter(snap, 'fengshui');
		expect(out).toContain('三针：地盘正针');
		expect(out).toContain('零正颠倒');
	});
});

describe('账③④：挂载与事盘储存——风水为「只导出不挂载」，是结论不是遗漏', ()=>{
	it('风水不在命盘类挂载清单（其快照是工作台态，随流派 tab 实时覆盖）', ()=>{
		expect(ANALYSIS_CHART_TECHNIQUES).not.toContain('fengshui');
	});
	it('但标签仍在册（导出/他处引用）', ()=>{
		expect(ANALYSIS_TECHNIQUE_LABELS.fengshui).toBe('风水');
	});
});

describe('账②：新增流派的老用户迁移（勾过风水的人必须补到新段）', ()=>{
	it('v48 已自定义 → 三新段补入；已有勾选不丢、未勾的旧段不复活', ()=>{
		const n = normalizeAIExportSettings({ version: 48, sections: { fengshui: ['风水·玄空飞星'] } });
		['风水·玄空六法', '风水·命理派', '风水·综合罗经'].forEach((s)=>{ expect(n.sections.fengshui).toContain(s); });
		expect(n.sections.fengshui).toContain('风水·玄空飞星');
		expect(n.sections.fengshui).not.toContain('风水·纳气盘');
	});
});
