// [YF v45] 段勾选「所见即所得」语义金标 —— 四 bug 防复发:
//   ①清空按钮死(空数组被当未自定义→UI 回全勾) ②勾了不纳入(清空后 toggle 反向)
//   ③挂载与导出行为分叉(导出主链强推段,挂载封装不强推) ④三式合一等取消不掉(运行时强推)。
// 语义定案:键不存在=未自定义(preset−默认关);空数组=显式全清(全不纳入);非空=白名单逐字尊重。
// 迁移定案:v<45 空数组=旧清空尸块→删键(与老用户所见现状一致零回归);v<45 非空自定义→union 旧强推清单(显式化)。
import {
	AI_EXPORT_SETTINGS_VERSION,
	getAIExportEffectiveSectionsForTechnique,
	applyAIExportSectionFilterToSnapshot,
	saveAIExportSettings,
	loadAIExportSettings,
	exportSettingKeyForSnapshotModule,
	applyPlanetInfoFilterByContext,
	__aiExportTesting__,
} from '../aiExport';

const { applyUserSectionFilter, normalizeAIExportSettings, AI_EXPORT_FORCED_INCLUDE_SECTIONS } = __aiExportTesting__;

afterEach(()=>{ try{ window.localStorage.clear(); }catch(_){} });

describe('v45 迁移(normalizeAIExportSettings)', ()=>{
	test('v<45 空数组=旧清空尸块 → 删键(回未自定义,与旧行为可见面一致)', ()=>{
		const out = normalizeAIExportSettings({ version: 44, sections: { bazi: [], ziwei: ['星曜'] } });
		expect(Object.prototype.hasOwnProperty.call(out.sections, 'bazi')).toBe(false);
		// [v56] v44 存档同时落进 v56 窗(窗口独立逐窗累加,同 v49 系先例)→ ziwei 自定义者补 身宫/八字大运 段
		expect(out.sections.ziwei).toEqual(['星曜', '身宫', '八字大运']);
		expect(out.version).toBe(AI_EXPORT_SETTINGS_VERSION);
	});
	test('v45 起空数组=显式全清 → 原样保留', ()=>{
		const out = normalizeAIExportSettings({ version: 45, sections: { bazi: [] } });
		expect(out.sections.bazi).toEqual([]);
	});
	test('v<45 五技法非空自定义 → union 旧强推清单(显式化,UI 可见可取消)', ()=>{
		const out = normalizeAIExportSettings({ version: 44, sections: { sanshiunited: ['太乙·主算'], qimen: ['九宫方盘'] } });
		AI_EXPORT_FORCED_INCLUDE_SECTIONS.sanshiunited.forEach((sec)=>{
			expect(out.sections.sanshiunited).toContain(sec);
		});
		expect(out.sections.sanshiunited).toContain('太乙·主算');
		AI_EXPORT_FORCED_INCLUDE_SECTIONS.qimen.forEach((sec)=>{
			expect(out.sections.qimen).toContain(sec);
		});
	});
	test('v45 起不再 union 强推;未自定义技法不凭空建键', ()=>{
		const out = normalizeAIExportSettings({ version: 45, sections: { sanshiunited: ['太乙·主算'] } });
		expect(out.sections.sanshiunited).toEqual(['太乙·主算']);
		expect(Object.prototype.hasOwnProperty.call(out.sections, 'qimen')).toBe(false);
	});
});

describe('effective 勾选态(getAIExportEffectiveSectionsForTechnique)', ()=>{
	test('键不存在=未自定义 → preset;空数组=显式全清 → [](清空按钮从此可见生效)', ()=>{
		const none = getAIExportEffectiveSectionsForTechnique('bazi', { version: AI_EXPORT_SETTINGS_VERSION, sections: {} });
		expect(none.length).toBeGreaterThan(0);
		const cleared = getAIExportEffectiveSectionsForTechnique('bazi', { version: AI_EXPORT_SETTINGS_VERSION, sections: { bazi: [] } });
		expect(cleared).toEqual([]);
	});
	test('清空后勾选单段 → effective=[该段](toggle 起点正确,不再反向)', ()=>{
		// 复刻 AIAnalysisMain.toggleSectionForTech 的取数路径:effective([]) → concat 单段。
		const sel = getAIExportEffectiveSectionsForTechnique('bazi', { version: AI_EXPORT_SETTINGS_VERSION, sections: { bazi: [] } });
		const next = sel.concat(['四柱']);
		expect(next).toEqual(['四柱']);
	});
});

describe('导出主链与挂载封装同语义', ()=>{
	const SNAP = ['[六壬大格]', '大格正文', '', '[太乙·主算]', '主算正文', '', '[八宫详解]', '八宫正文'].join('\n');
	test('三式合一:取消六壬大格/八宫详解 → 导出真取消(强推已死),挂载同结果', ()=>{
		saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION, sections: { sanshiunited: ['太乙·主算'] } });
		const exported = applyUserSectionFilter(SNAP, 'sanshiunited');
		expect(exported).toContain('主算正文');
		expect(exported).not.toContain('大格正文');
		expect(exported).not.toContain('八宫正文');
		const mounted = applyAIExportSectionFilterToSnapshot('sanshiunited', SNAP);
		expect(mounted).toContain('主算正文');
		expect(mounted).not.toContain('大格正文');
		expect(mounted).not.toContain('八宫正文');
	});
	test('显式全清 → 导出与挂载一并置空(全不纳入)', ()=>{
		saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION, sections: { sanshiunited: [] } });
		expect(`${applyUserSectionFilter(SNAP, 'sanshiunited')}`.trim()).toBe('');
		expect(`${applyAIExportSectionFilterToSnapshot('sanshiunited', SNAP)}`.trim()).toBe('');
	});
	test('五技法旧强推清单逐键真取消(qimen/liureng/jinkou/horary 抽验)', ()=>{
		const CASES = [
			{ key: 'qimen', forced: '八宫详解', keep: '九宫方盘' },
			{ key: 'liureng', forced: '大格', keep: '四课' },
			{ key: 'jinkou', forced: '金口诀速览', keep: '四位' },
			{ key: 'horary', forced: '月亮的故事', keep: '起盘信息' },
		];
		CASES.forEach(({ key, forced, keep })=>{
			const text = [`[${forced}]`, `${forced}-正文`, '', `[${keep}]`, `${keep}-正文`].join('\n');
			saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION, sections: { [key]: [keep] } });
			const out = applyUserSectionFilter(text, key);
			expect(out).toContain(`${keep}-正文`);
			expect(out).not.toContain(`${forced}-正文`);
		});
	});
	test('源层 module→设置键反查:guazhan→sixyao(不归一则六爻设置在事盘源永远打不中)', ()=>{
		expect(exportSettingKeyForSnapshotModule('guazhan')).toBe('sixyao');
		expect(exportSettingKeyForSnapshotModule('kinastro-tieban')).toBe('tieban');
		expect(exportSettingKeyForSnapshotModule('guolao-qizhengkin')).toBe('qizhengkin');
		expect(exportSettingKeyForSnapshotModule('liureng')).toBe('liureng');
		expect(exportSettingKeyForSnapshotModule('astrochart')).toBe('astrochart');
		expect(exportSettingKeyForSnapshotModule('')).toBe('');
	});
	test('星曜后天信息开关挂载可消费:关「显示星曜宫位」→ 快照宫位括注被剔;非 planetInfo 技法原样', ()=>{
		const text = '太阳 狮子 15° （后天：5th；主一宫）';
		saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION, planetInfo: { astrochart: { showHouse: 0, showRuler: 1 } } });
		const trimmed = applyPlanetInfoFilterByContext(text, 'astrochart');
		expect(trimmed).not.toContain('5th');
		expect(trimmed).toContain('主一宫');
		// 非 planetInfo 技法(qimen)零变换:
		expect(applyPlanetInfoFilterByContext(text, 'qimen')).toBe(text);
		// 默认全开零变换:
		saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION });
		expect(applyPlanetInfoFilterByContext(text, 'astrochart')).toBe(text);
	});
	test('[MT parity] primarydirect 死段头已删+老自定义经 legacy 映射迁真名', ()=>{
		const { AI_EXPORT_PRESET_SECTIONS } = require('../aiExport');
		expect(AI_EXPORT_PRESET_SECTIONS.primarydirect).not.toContain('主/界限法设置');
		expect(AI_EXPORT_PRESET_SECTIONS.primarydirect).not.toContain('主/界限法表格');
		expect(AI_EXPORT_PRESET_SECTIONS.primarydirect).toEqual(expect.arrayContaining(['主限法设置', '主限法表格']));
		// 老用户自定义里勾了死名 → 过滤时迁真名(内容段 [主限法设置] 被保留而非当陌生段丢掉):
		const text = ['[主限法设置]', '设置正文', '', '[当前时点]', '时点正文'].join('\n');
		saveAIExportSettings({ version: AI_EXPORT_SETTINGS_VERSION, sections: { primarydirect: ['主/界限法设置'] } });
		const out = applyUserSectionFilter(text, 'primarydirect');
		expect(out).toContain('设置正文');
		expect(out).not.toContain('时点正文');
	});
	test('老用户升级链端到端:v44 存清空尸块+自定义 → load 后行为=旧可见现状', ()=>{
		// 直接写 v44 原始串(绕过 save 的 normalize),模拟老设备 localStorage。
		window.localStorage.setItem('horosa.ai.export.settings.v1', JSON.stringify({
			version: 44,
			sections: { bazi: [], liureng: ['四课'] },
		}));
		const loaded = loadAIExportSettings();
		// 尸块删键 → bazi 未自定义 → 挂载/导出走默认(非空)。
		expect(Object.prototype.hasOwnProperty.call(loaded.sections, 'bazi')).toBe(false);
		// liureng 自定义 union 强推 → 旧导出可见段(四课+大格等)全在。
		expect(loaded.sections.liureng).toEqual(expect.arrayContaining(['四课', '大格', '小局', '参考', '概览']));
	});
});

// ── [v49] 风水三新段的键内 union 迁移 ────────────────────────────────────
// 场景：老用户自定义过风水导出段（勾了一部分），本版风水新增三段。
// 需求：新段补进去（否则被白名单静默滤掉、导出设置里也勾不到），且不得复活用户取消过的旧段，
// 也不得让 v45+ 存档重走「全 preset union」（那会违「取消=真取消」铁律）。
describe('[v49] 风水三新段 union 迁移', ()=>{
	const { AI_EXPORT_PRESET_SECTIONS } = require('../aiExport');
	const V49 = ['风水·玄空六法', '风水·命理派', '风水·综合罗经'];

	it('已自定义过风水的老用户：补上三新段，且原有勾选一个不少、被取消的不复活', ()=>{
		const kept = ['起盘信息', '风水·玄空飞星'];
		const n = normalizeAIExportSettings({ version: 48, sections: { fengshui: kept.slice() } });
		V49.forEach((s)=>{ expect(n.sections.fengshui).toContain(s); });
		kept.forEach((s)=>{ expect(n.sections.fengshui).toContain(s); });
		// 用户当年取消掉的旧段不得因本次迁移复活
		expect(n.sections.fengshui).not.toContain('风水·择日选择');
		expect(n.sections.fengshui).not.toContain('风水·形势峦头');
	});


	it('未自定义过风水的用户不受影响（无 fengshui 键 → 走 preset 全量，本就含三新段）', ()=>{
		const n = normalizeAIExportSettings({ version: 48, sections: { ziwei: ['宫位总览'] } });
		expect(n.sections.fengshui).toBeUndefined();
		V49.forEach((s)=>{ expect(AI_EXPORT_PRESET_SECTIONS.fengshui).toContain(s); });
	});

	it('显式全清（空数组）不得被 union 灌回内容', ()=>{
		const n = normalizeAIExportSettings({ version: 48, sections: { fengshui: [] } });
		expect(n.sections.fengshui).toEqual([]);
	});


});


// [v50] babylon「微黄道」段:同 v49 机制的下一窗
describe('[v50] babylon 微黄道段 union 迁移', ()=>{
	const { AI_EXPORT_PRESET_SECTIONS } = require('../aiExport');

	it('已自定义过 babylon 的老用户(v49 存档):补上「微黄道」,原勾选不动、被取消段不复活', ()=>{
		const kept = ['起盘信息', '位三法'];
		const n = normalizeAIExportSettings({ version: 49, sections: { babylon: kept.slice() } });
		expect(n.sections.babylon).toContain('微黄道');
		kept.forEach((s)=>{ expect(n.sections.babylon).toContain(s); });
		expect(n.sections.babylon).not.toContain('七曜按宫');   // 当年取消的不得复活
		expect(n.sections.babylon.length).toBe(kept.length + 1);
	});

	it('v50 起用户取消「微黄道」=真取消(不再被 union 顶回)', ()=>{
		const n = normalizeAIExportSettings({ version: 50, sections: { babylon: ['起盘信息'] } });
		expect(n.sections.babylon).not.toContain('微黄道');
	});

	it('未自定义过 babylon 的用户走 preset 全量,preset 已含微黄道且居末', ()=>{
		const n = normalizeAIExportSettings({ version: 49, sections: { ziwei: ['宫位总览'] } });
		expect(n.sections.babylon).toBeUndefined();
		expect(AI_EXPORT_PRESET_SECTIONS.babylon).toContain('微黄道');
		expect(AI_EXPORT_PRESET_SECTIONS.babylon[AI_EXPORT_PRESET_SECTIONS.babylon.length - 1]).toBe('微黄道');
	});
});


// ── [v56] 内容完备性审计批·紫微「身宫」段 union 迁移 ──────────────────────
// 场景:老用户自定义过紫微导出段;本版快照补上恒缺的 [身宫](盘面/深报早有,快照反方向审计首批)。
// 同 v49-v55 键内段级一次性 union:新段本版才诞生、用户无从取消过,并入不复活任何被取消项。
describe('[v56] 紫微身宫段 union 迁移', ()=>{
	const { AI_EXPORT_PRESET_SECTIONS } = require('../aiExport');

	it('已自定义过紫微的 v55 存档:补上「身宫/八字大运」,原勾选不动、被取消段不复活(取消=真取消)', ()=>{
		const kept = ['起盘信息', '宫位总览'];
		const n = normalizeAIExportSettings({ version: 55, sections: { ziwei: kept.slice() } });
		expect(n.sections.ziwei).toContain('身宫');
		expect(n.sections.ziwei).toContain('八字大运');
		kept.forEach((s)=>{ expect(n.sections.ziwei).toContain(s); });
		expect(n.sections.ziwei).not.toContain('来因宫');   // 当年取消的不得因迁移复活
		expect(n.sections.ziwei.length).toBe(kept.length + 2);
		// bazi 同窗:已自定义者补「干支合冲」
		const nb = normalizeAIExportSettings({ version: 55, sections: { bazi: ['起盘信息'] } });
		expect(nb.sections.bazi).toEqual(['起盘信息', '干支合冲']);
		// astrochart 同窗:补衍化三段;世界范式盘=默认关段不入 union(口径倒挂防线)
		const na = normalizeAIExportSettings({ version: 55, sections: { astrochart: ['起盘信息'] } });
		expect(na.sections.astrochart).toEqual(['起盘信息', '古典·派生宫转宫', '古典·气候带', '古典·显赫计分']);
		expect(na.sections.astrochart).not.toContain('古典·世界范式盘');
	});

	it('显式全清(空数组)不得被 union 灌回', ()=>{
		const n = normalizeAIExportSettings({ version: 55, sections: { ziwei: [] } });
		expect(n.sections.ziwei).toEqual([]);
	});

	it('本版及以后的存档不再重跑本次迁移', ()=>{
		const n = normalizeAIExportSettings({ version: 56, sections: { ziwei: ['宫位总览'] } });
		expect(n.sections.ziwei).toEqual(['宫位总览']);
	});

	it('未自定义紫微的用户不凭空建键;迁移段 ⊆ preset 且段序=builder 文档序(身宫紧随宫位总览)', ()=>{
		const n = normalizeAIExportSettings({ version: 55, sections: { fengshui: ['起盘信息'] } });
		expect(n.sections.ziwei).toBeUndefined();
		const p = AI_EXPORT_PRESET_SECTIONS.ziwei;
		expect(p).toContain('身宫');
		expect(p[p.indexOf('宫位总览') + 1]).toBe('身宫');
	});
});

// ── [M-2] 挂载封装补禁段剥离(与导出主链收敛) ──────────────────────────
describe('[M-2] 挂载封装 FORBIDDEN 剥离', ()=>{
	const { applyAIExportSectionFilterToSnapshot } = require('../aiExport');
	const SAMPLE = '[大格]\n贼克法。\n\n[右侧栏目]\n(纯 UI 回显噪音)\n\n[小局]\n元首课。';

	it('🔴 未自定义(键不存在):禁段剥除、相邻段原样(此前挂载带着导出恒剥的禁段=两链分叉)', ()=>{
		const out = applyAIExportSectionFilterToSnapshot('liureng', SAMPLE, { version: 56, sections: {} });
		expect(out).not.toContain('右侧栏目');
		expect(out).toContain('[大格]');
		expect(out).toContain('[小局]');
	});
	it('自定义白名单:禁段照旧进不来;无禁段技法(bazi)原样零波及', ()=>{
		const out = applyAIExportSectionFilterToSnapshot('liureng', SAMPLE, { version: 56, sections: { liureng: ['大格'] } });
		expect(out).toContain('[大格]');
		expect(out).not.toContain('右侧栏目');
		expect(out).not.toContain('[小局]');
		const baziSample = '[四柱与三元]\n表。';
		expect(applyAIExportSectionFilterToSnapshot('bazi', baziSample, { version: 56, sections: {} })).toBe(baziSample);
	});
});
