// aiExport 段名【类型】机械互核 —— 守「登记了、但值是错的」这一类。
//
// 🔴 病例(本轮实抓):皇极轨策的提取路由那行
//      if(key === 'guice'){ return extractSimpleModuleContent('guice'); }
//    被误放进了 mapLegacySectionTitle —— 一个纯「段名→段名」的字符串映射器。
//    extractSimpleModuleContent 是 async,于是本技法【每个段名都变成 Promise】:
//      getAIExportEffectiveSectionsForTechnique('guice') 返 10 个 Promise 而非 10 个段名
//      → 按段过滤拿 Promise 去比字符串,恒失配 → 该技法的段选择整个失灵。
//
// 🔴 为何既有的测试全都放过了它:
//    · 四本账哨兵查的是「登记了没」(grep 得到 guice: 即绿) —— 不查【值是什么】;
//    · preflight[132] 同理;
//    · 段名 parity 测试比的是 PRESET 表(那张表是好的,坏的是经过 map 之后的结果)。
//    最后是文档生成器把它印成十个「[object Promise]」才露的马脚 —— 靠运气,不能算守。
//    故立此哨兵:不问登记与否,只问【值的类型】,且遍历全技法、无白名单。
import {
	getAIExportPresetKeys,
	getAIExportEffectiveSectionsForTechnique,
	AI_EXPORT_PRESET_SECTIONS,
	AI_EXPORT_SETTINGS_VERSION,
} from '../aiExport';

const EMPTY = { version: AI_EXPORT_SETTINGS_VERSION, sections: {} };

describe('aiExport 段名类型 · 全技法机械遍历(无白名单)', () => {
	const keys = getAIExportPresetKeys() || [];

	test('技法清单非空', () => {
		expect(keys.length).toBeGreaterThan(20);
	});

	test('🔴 preset 表里每个段名都是非空字符串', () => {
		const bad = [];
		keys.forEach((k) => {
			(AI_EXPORT_PRESET_SECTIONS[k] || []).forEach((t, i) => {
				if (typeof t !== 'string' || !t.trim()) bad.push(`${k}[${i}]: ${Object.prototype.toString.call(t)}`);
			});
		});
		expect(bad).toEqual([]);
	});

	test('🔴 经 effective 之后仍是非空字符串 —— 不得是 Promise/对象/undefined', () => {
		const bad = [];
		keys.forEach((k) => {
			let eff;
			try { eff = getAIExportEffectiveSectionsForTechnique(k, EMPTY); } catch (e) { bad.push(`${k}: 抛 ${e.message}`); return; }
			if (!Array.isArray(eff)) { bad.push(`${k}: 非数组(${Object.prototype.toString.call(eff)})`); return; }
			eff.forEach((t, i) => {
				if (t && typeof t.then === 'function') { bad.push(`${k}[${i}]: 🔴 Promise —— 必有 async 函数混进了同步的段名链`); return; }
				if (typeof t !== 'string' || !t.trim()) bad.push(`${k}[${i}]: ${Object.prototype.toString.call(t)}`);
			});
		});
		expect(bad).toEqual([]);
	});

	test('🔴 effective ⊆ preset(经 map 之后不得凭空多出段名)', () => {
		const bad = [];
		keys.forEach((k) => {
			const preset = new Set(AI_EXPORT_PRESET_SECTIONS[k] || []);
			if (!preset.size) return;
			const eff = getAIExportEffectiveSectionsForTechnique(k, EMPTY) || [];
			// map 会把老段名迁到新段名(合法),故只验:效果集里的每一项要么在 preset 里、要么确是迁移之的。
			// 此处只做「皆为字符串且非空」之外的一条:数目不得多于 preset(多出即凭空生段)。
			if (eff.length > preset.size) bad.push(`${k}: effective ${eff.length} > preset ${preset.size}`);
		});
		expect(bad).toEqual([]);
	});

	test('负锚:皇极轨策十段皆为真段名(其提取路由须在路由函数里,不得混进段名映射器)', () => {
		const eff = getAIExportEffectiveSectionsForTechnique('guice', EMPTY);
		expect(eff).toHaveLength(10);
		eff.forEach((t) => {
			expect(typeof t).toBe('string');
			expect(t && t.then).toBeUndefined();
		});
		expect(eff).toEqual(expect.arrayContaining(['占事直断', '演数', '四位', '断法', '时方', '三要十应']));
	});
});
