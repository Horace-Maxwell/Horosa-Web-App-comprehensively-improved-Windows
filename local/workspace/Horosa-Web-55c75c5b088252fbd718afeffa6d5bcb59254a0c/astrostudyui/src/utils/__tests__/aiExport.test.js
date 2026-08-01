import {
	AI_EXPORT_SETTINGS_VERSION,
	AI_EXPORT_SIMPLE_MODULE_KEYS,
	applyAIExportSectionFilterToSnapshot,
	getAIExportAuditMatrix,
	getAIExportPresetKeys,
	getAIExportEffectiveSectionsForTechnique,
	listAIExportTechniqueSettings,
	loadAIExportSettings,
	resolveAIExportContextForTest,
} from '../aiExport';
import {
	getTechniqueSettingsSchema,
} from '../techniqueMountSettings';
import { saveModuleAISnapshot } from '../moduleAiSnapshot';
import {
	ANALYSIS_CHART_TECHNIQUES,
	ANALYSIS_CASE_TECHNIQUES,
	ANALYSIS_TECHNIQUE_LABELS,
} from '../aiAnalysisContext';
import { CASE_TYPE_OPTIONS } from '../localcases';

const SETTINGS_KEY = 'horosa.ai.export.settings.v1';

function optionsByTechnique(){
	return listAIExportTechniqueSettings().reduce((acc, item)=>{
		acc[item.key] = item.options;
		return acc;
	}, {});
}

beforeEach(()=>{
	window.localStorage.clear();
});

describe('aiExport settings', ()=>{
	it('keeps every listed technique selectable with at least one export section', ()=>{
		const techniques = listAIExportTechniqueSettings();
		expect(techniques.length).toBeGreaterThan(20);
		techniques.forEach((item)=>{
			expect(item.key).toBeTruthy();
			expect(item.label).toBeTruthy();
			expect(item.options.length).toBeGreaterThan(0);
		});
	});

	it('exposes structured section groups for newly added techniques', ()=>{
		const options = optionsByTechnique();
		expect(options.suzhan).toEqual(expect.arrayContaining(['起盘信息', '宿盘宫位与二十八宿星曜']));
		expect(options.qimen).toEqual(expect.arrayContaining(['八宫详解', '九宫方盘', '旺相休囚死·月令能量']));
		expect(options.jinkou).toEqual(expect.arrayContaining([
			'金口诀速览',
			'金口诀四位',
			'金口诀三盘',
			'四位神煞',
			'十二长生',
		]));
		expect(options.taiyi).toEqual(expect.arrayContaining([
			'太乙盘',
			'太乙诸神',
			'风游',
			'主客定算',
			'十二神',
			'八门与宿曜',
			'断法',
			'十六宫标记',
		]));
		expect(options.wuzhao).toEqual(expect.arrayContaining(['起盘', '揲筮', '兆', '木乡', '水乡', '特殊标记']));
		expect(options.taixuan).toEqual(expect.arrayContaining(['起盘', '玄首', '方州部家', '表']));
		expect(options.jingjue).toEqual(expect.arrayContaining(['起课', '卦辞', '三分', '十六卦']));
		expect(options.shenyishu).toEqual(expect.arrayContaining(['干支与五行', '神卦', '五行法则', '主客判断', '长生', '吉凶']));
		// 量化盘 preset 须含[汉堡学派要素]——buildHamburgLines 拼进 germany 快照,否则「AI导出设置」勾不到且被静默过滤。
		expect(options.germany).toEqual(expect.arrayContaining(['宫位宫头', '行星', '中点', '中点相位', '汉堡学派要素']));
		expect(options.otherbu).toEqual(expect.arrayContaining(['骰子结果', '骰子盘宫位与星体', '天象盘宫位与星体']));
		expect(options.bazi).toEqual(expect.arrayContaining(['四柱与三元', '神煞（四柱与三元）', '大运', '流年行运概略', '多运限·指定时段']));
		expect(options.ziwei).toEqual(expect.arrayContaining(['起盘信息', '宫位总览', '运限']));
		expect(options.qizhengkin).toEqual(expect.arrayContaining(['星曜', '张果断语', '命宫解读']));
		// 七政四余(Moira) 快照四段必须与 buildGuolaoSnapshotTextV2 同步——含 [大限]，否则「AI导出设置」漏勾该段。
		expect(options.guolao).toEqual(expect.arrayContaining(['起盘信息', '七政四余宫位与二十八宿星曜', '神煞', '大限']));
		expect(options.tieban).toEqual(expect.arrayContaining(['十二宫', '十二宫条文', '紫微安星', '六亲佐证']));
		expect(options.cetian).toEqual(expect.arrayContaining(['命宮', '父母宮', '星曜属性', '飞化规则', '三合组']));
	});

	it('keeps every AI export technique wired to settings groups and an extractor path', ()=>{
		const matrix = getAIExportAuditMatrix();
		expect(matrix.length).toBeGreaterThan(40);
		matrix.forEach((item)=>{
			expect(item.key).toBeTruthy();
			expect(item.label).toBeTruthy();
			expect(item.presetSections.length).toBeGreaterThan(0);
			expect(item.options.length).toBeGreaterThan(0);
			expect(item.extractionKind).toBeTruthy();
			if(item.key !== 'generic'){
				expect(item.structuredSnapshotKeys.length).toBeGreaterThan(0);
			}
		});
		expect(matrix.filter((item)=>item.isJieQiSplit).map((item)=>item.key)).toEqual([
			'jieqi_meta',
			'jieqi_chunfen',
			'jieqi_xiazhi',
			'jieqi_qiufen',
			'jieqi_dongzhi',
		]);
		matrix.filter((item)=>item.isJieQiSplit).forEach((item)=>{
			expect(item.extractionKind).toBe('jieqi');
			expect(item.presetSections.length).toBeLessThanOrEqual(3); // v39:四分点子盘 = 星盘/宿盘/3D盘 三段;meta ≤2
		});
	});

	it('registers every preset-section technique in AI_EXPORT_TECHNIQUES (no hidden/un-audited technique like canping/heluo)', ()=>{
		// 回归哨兵:有 preset 却没登记进 AI_EXPORT_TECHNIQUES 的技法,会在「AI导出设置」下拉隐身、且不被
		// getAIExportAuditMatrix 覆盖(canping 参评数 / heluo 河洛理数 此前正是此坑)。断言 preset key ⊆ 已登记技法。
		const matrixKeys = new Set(getAIExportAuditMatrix().map((item)=>item.key));
		const missing = getAIExportPresetKeys().filter((key)=>!matrixKeys.has(key));
		expect(missing).toEqual([]);
	});

	it('uses backend snapshot aliases for newly added structured techniques', ()=>{
		const byKey = getAIExportAuditMatrix().reduce((acc, item)=>{
			acc[item.key] = item;
			return acc;
		}, {});
		expect(byKey.sixyao.snapshotModuleKey).toBe('guazhan');
		expect(byKey.sixyao.structuredSnapshotKeys).toEqual(expect.arrayContaining(['guazhan', 'sixyao']));
		expect(byKey.qizhengkin.snapshotModuleKey).toBe('guolao-qizhengkin');
		expect(byKey.qizhengkin.structuredSnapshotKeys).toEqual(expect.arrayContaining(['guolao-qizhengkin', 'qizhengkin']));
		expect(byKey.shaozi.snapshotModuleKey).toBe('kinastro-shaozi');
		expect(byKey.tieban.snapshotModuleKey).toBe('kinastro-tieban');
		expect(byKey.fendjing.snapshotModuleKey).toBe('kinastro-fendjing');
		expect(byKey.beiji.snapshotModuleKey).toBe('kinastro-beiji');
		expect(byKey.nanji.snapshotModuleKey).toBe('kinastro-nanji');
		expect(byKey.chunzi.snapshotModuleKey).toBe('kinastro-chunzi');
		expect(byKey.xianqin.snapshotModuleKey).toBe('kinastro-xianqin');
		expect(byKey.cetian.snapshotModuleKey).toBe('kinastro-cetian');
		[
			'suzhan',
			'tongshefa',
			'huangji',
			'wuzhao',
			'taixuan',
			'jingjue',
			'shenyishu',
			'taiyi',
			'jinkou',
			'qimen',
			'sanshiunited',
			'bazi',
			'ziwei',
		].forEach((key)=>{
			expect(byKey[key].snapshotModuleKey).toBe(key);
		});
	});

	it('keeps split jieqi tab export scoped to the active tab section group', ()=>{
		const settings = {
			version: AI_EXPORT_SETTINGS_VERSION,
			sections: {
				jieqi_chunfen: ['春分星盘'],
				jieqi_xiazhi: ['夏至宿盘'],
				jieqi_qiufen: ['秋分星盘'],
				jieqi_dongzhi: ['冬至宿盘'],
			},
		};
		expect(getAIExportEffectiveSectionsForTechnique('jieqi_chunfen', settings)).toEqual(['春分星盘']);
		expect(getAIExportEffectiveSectionsForTechnique('jieqi_xiazhi', settings)).toEqual(['夏至宿盘']);
		expect(getAIExportEffectiveSectionsForTechnique('jieqi_qiufen', settings)).toEqual(['秋分星盘']);
		expect(getAIExportEffectiveSectionsForTechnique('jieqi_dongzhi', settings)).toEqual(['冬至宿盘']);
		expect(getAIExportEffectiveSectionsForTechnique('jieqi', settings)).toEqual(expect.arrayContaining([
			'春分星盘',
			'夏至宿盘',
			'秋分星盘',
			'冬至宿盘',
		]));
	});

	it('resolves the running jieqi export context to the active split setting key', ()=>{
		saveModuleAISnapshot('jieqi_current', [
			'[夏至星盘]',
			'太阳 巨蟹 0.00',
			'',
			'[夏至宿盘]',
			'夏至宿盘结构化内容',
		].join('\n'));
		const context = resolveAIExportContextForTest({
			key: 'jieqi',
			displayName: '节气盘',
		});
		expect(context.key).toBe('jieqi_xiazhi');
		expect(context.displayName).toBe('节气盘-夏至');
		expect(getAIExportEffectiveSectionsForTechnique(context.key, {
			version: AI_EXPORT_SETTINGS_VERSION,
			sections: {
				jieqi_xiazhi: ['夏至宿盘'],
			},
		})).toEqual(['夏至宿盘']);
	});

	it('migrates old per-technique selections so new backend sections are not silently filtered', ()=>{
		window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
			version: 7,
			sections: {
				suzhan: ['起盘信息'],
				qimen: ['起盘信息'],
				jinkou: ['起盘信息'],
				taiyi: ['起盘信息'],
				germany: ['起盘信息'],
				otherbu: ['起盘信息'],
				bazi: ['起盘信息'],
				ziwei: ['起盘信息'],
			},
		}));
		const settings = loadAIExportSettings();
		expect(settings.version).toBe(AI_EXPORT_SETTINGS_VERSION);
		expect(settings.sections.suzhan).toEqual(expect.arrayContaining(['宿盘宫位与二十八宿星曜']));
		expect(settings.sections.qimen).toEqual(expect.arrayContaining(['旺相休囚死·月令能量']));
		expect(settings.sections.jinkou).toEqual(expect.arrayContaining(['金口诀三盘', '十二长生']));
		expect(settings.sections.taiyi).toEqual(expect.arrayContaining(['太乙诸神', '断法', '十六宫标记']));
		// v28:量化盘 union 后含新段[汉堡学派要素](汉堡功能段此前未登记 preset → 自定义过段的老用户会被静默删)。
		expect(settings.sections.germany).toEqual(expect.arrayContaining(['中点', '中点相位', '汉堡学派要素']));
		expect(settings.sections.otherbu).toEqual(expect.arrayContaining(['骰子结果', '天象盘宫位与星体']));
		expect(settings.sections.bazi).toEqual(expect.arrayContaining(['大运', '多运限·指定时段']));
		expect(settings.sections.ziwei).toEqual(expect.arrayContaining(['宫位总览', '运限']));
	});

	it('migrates corrected backend section names for kentang-derived techniques', ()=>{
		window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
			version: 8,
			sections: {
				wuzhao: ['五兆', '标记'],
				taixuan: ['起盘', '条文'],
				jingjue: ['起盘'],
				shenyishu: ['干支', '五行'],
				qizhengkin: ['命宫', '宿度'],
				tieban: ['宫位'],
				cetian: ['命宫', '父母宫', '十八飞星'],
			},
		}));
		const settings = loadAIExportSettings();
		expect(settings.version).toBe(AI_EXPORT_SETTINGS_VERSION);
		expect(settings.sections.wuzhao).toEqual(expect.arrayContaining(['揲筮', '兆', '特殊标记']));
		expect(settings.sections.taixuan).toEqual(expect.arrayContaining(['玄首', '方州部家', '表']));
		expect(settings.sections.jingjue).toEqual(expect.arrayContaining(['起课', '卦辞', '三分', '十六卦']));
		expect(settings.sections.shenyishu).toEqual(expect.arrayContaining(['干支与五行', '神卦', '五行法则', '主客判断', '吉凶']));
		expect(settings.sections.qizhengkin).toEqual(expect.arrayContaining(['星曜', '张果断语', '命宫解读']));
		expect(settings.sections.tieban).toEqual(expect.arrayContaining(['十二宫', '十二宫条文', '紫微安星']));
		expect(settings.sections.cetian).toEqual(expect.arrayContaining(['命宮', '父母宮', '星曜属性', '飞化规则']));
	});
});

describe('AI 四同步跨系统一致性(导出 / 导出设置 / AI挂载 / 命盘事盘储存)', ()=>{
	// 把四套注册表交叉钉死:任何新增技法漏接其中一套都在此红。详见 docs/西占新功能-AI导出与储存接入清单.md。
	// 六爻在「储存」里叫 liuyao、在「导出/挂载」里叫 sixyao,以此别名打通。
	const CASE_TO_EXPORT_ALIAS = { liuyao: 'sixyao' };

	it('有预设分段的技法都登记进 migration(jieqi 走自有 split 迁移除外)——防「升级后新段不入老用户设置」', ()=>{
		const missing = getAIExportAuditMatrix()
			.filter((item)=>item.presetSections.length > 0)
			.filter((item)=>item.key !== 'generic' && item.key !== 'jieqi' && !item.isJieQiSplit)
			.filter((item)=>!item.migrationEnabled)
			.map((item)=>item.key);
		expect(missing).toEqual([]);
	});

	it('v24：双盘技法预设含「本命盘配置」+ 时段盘段(防 builder 新段被导出段过滤静默删)', ()=>{
		const dual = {
			solarreturn: ['本命盘配置', '时段盘配置'],
			lunarreturn: ['本命盘配置', '时段盘配置'],
			solararc: ['本命盘配置', '时段盘配置'],
			profection: ['本命盘配置', '时段盘配置'],
			givenyear: ['本命盘配置', '时段盘配置'],
			planetaryarc: ['本命盘配置', '时段盘配置'],
			vedicprog: ['本命盘配置', '时段盘配置 二次推运位置'],
			jaynesprog: ['本命盘配置', '时段盘 赤纬平行/反平行'],
			primarydirchart: ['本命盘配置', '主限法盘配置'],
		};
		Object.keys(dual).forEach((key)=>{
			const preset = getAIExportEffectiveSectionsForTechnique(key, { version: AI_EXPORT_SETTINGS_VERSION, sections: {} });
			dual[key].forEach((title)=>{
				expect(preset).toContain(title);
			});
		});
	});

	it('v24：返照族旧「星盘信息」段经 legacy map 迁到「时段盘配置」(老用户自定义不丢)', ()=>{
		['solarreturn', 'solararc', 'profection', 'givenyear', 'lunarreturn'].forEach((key)=>{
			const eff = getAIExportEffectiveSectionsForTechnique(key, { version: AI_EXPORT_SETTINGS_VERSION, sections: { [key]: ['星盘信息'] } });
			expect(eff).toContain('时段盘配置');
			expect(eff).not.toContain('星盘信息');
		});
	});

	it('所有可挂载技法(命盘类 + 事盘类)都在 AI导出技法表、且有中文标签', ()=>{
		const exportKeys = new Set(getAIExportAuditMatrix().map((item)=>item.key));
		const mountable = [...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES];
		expect(mountable.filter((key)=>!exportKeys.has(key))).toEqual([]);
		expect(mountable.filter((key)=>!ANALYSIS_TECHNIQUE_LABELS[key])).toEqual([]);
	});

	it('事盘类可挂载技法都能落到「命盘事盘储存」CASE_TYPE_OPTIONS(含 sixyao↔liuyao 别名)', ()=>{
		const missing = ANALYSIS_CASE_TECHNIQUES.filter((key)=>{
			const stored = key === 'sixyao' ? 'liuyao' : key;
			return !CASE_TYPE_OPTIONS.some((o)=>o.value === stored);
		});
		expect(missing).toEqual([]);
	});

	it('每个事盘储存技法别名解析后都能被 AI导出(⊆ 导出技法表)', ()=>{
		const exportKeys = new Set(getAIExportAuditMatrix().map((item)=>item.key));
		const notExportable = CASE_TYPE_OPTIONS
			.map((o)=>CASE_TO_EXPORT_ALIAS[o.value] || o.value)
			.filter((key)=>!exportKeys.has(key));
		expect(notExportable).toEqual([]);
	});

	it('事盘可挂载技法都有 snapshotModuleKey(挂载读得到模块快照)', ()=>{
		const byKey = getAIExportAuditMatrix().reduce((acc, item)=>{ acc[item.key] = item; return acc; }, {});
		ANALYSIS_CASE_TECHNIQUES.forEach((key)=>{
			expect(byKey[key]).toBeTruthy();
			expect(`${byKey[key].snapshotModuleKey || ''}`.length).toBeGreaterThan(0);
		});
	});

	it('「简单模块」预测技法路由表与四套注册表一致(回归哨兵:多重回归 extrareturns 曾漏 extractContentByKey 路由 → AI导出/挂载拿不到快照)', ()=>{
		const matrix = getAIExportAuditMatrix();
		const exportKeys = new Set(matrix.map((item)=>item.key));
		// ① 路由表里每个键都必须登记进 AI导出技法表(否则导出设置下拉隐身 / 提取无内容)
		expect(AI_EXPORT_SIMPLE_MODULE_KEYS.filter((k)=>!exportKeys.has(k))).toEqual([]);
		// ② 四个星运新技法在「导出路由 + 导出技法表 + AI挂载集合 + 中文标签」四处同时钉死
		['triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns'].forEach((k)=>{
			expect(AI_EXPORT_SIMPLE_MODULE_KEYS).toContain(k);
			expect(exportKeys.has(k)).toBe(true);
			expect(ANALYSIS_CHART_TECHNIQUES).toContain(k);
			expect(ANALYSIS_TECHNIQUE_LABELS[k]).toBeTruthy();
		});
	});
});

describe('AI 挂载段过滤封装 applyAIExportSectionFilterToSnapshot（第五同步：挂载复用导出段设置）', ()=>{
	// 用 preset 头构造合成快照文本（每段一行 [段头] + 一行占位正文）。
	function buildSyntheticSnapshot(key){
		const sections = getAIExportEffectiveSectionsForTechnique(key, { version: AI_EXPORT_SETTINGS_VERSION, sections: {} });
		const lines = [];
		sections.forEach((title)=>{
			lines.push(`[${title}]`);
			lines.push(`${title}-正文占位`);
			lines.push('');
		});
		return { text: lines.join('\n').trim(), sections };
	}

	it('每个有 preset 的技法：默认设置(未自定义段)下返回原文逐字不变（默认即现状）', ()=>{
		getAIExportPresetKeys().forEach((key)=>{
			const { text, sections } = buildSyntheticSnapshot(key);
			if(!text || sections.length < 1){
				return;
			}
			// 未在 sections 里登记该 key → 原样返回。
			expect(applyAIExportSectionFilterToSnapshot(key, text)).toBe(text);
		});
	});

	it('自定义去掉某段后正确过滤（保留勾选段、剔除未勾选段）', ()=>{
		// astrochart preset 含「起盘信息」「希腊点」；只勾「起盘信息」→ 结果含起盘信息、不含希腊点。
		const { text, sections } = buildSyntheticSnapshot('astrochart');
		expect(sections).toEqual(expect.arrayContaining(['起盘信息', '希腊点']));
		const settings = { version: AI_EXPORT_SETTINGS_VERSION, sections: { astrochart: ['起盘信息'] } };
		const out = applyAIExportSectionFilterToSnapshot('astrochart', text, settings);
		expect(out).toContain('[起盘信息]');
		expect(out).not.toContain('[希腊点]');
	});

	it('[YF v45] 空数组=显式全清 → 全不纳入(空);段名全不匹配 → 回退原文防误伤', ()=>{
		const { text } = buildSyntheticSnapshot('bazi');
		// 空数组 = 用户在设置里显式清空 → 该技法全不纳入(挂载卡与导出一并置空,所见即所得)。
		// 旧语义(空数组回 preset 全量)正是「清空按钮点完复选框纹丝不动」的病根,勿回退。
		const emptyOut = applyAIExportSectionFilterToSnapshot('bazi', text, { version: AI_EXPORT_SETTINGS_VERSION, sections: { bazi: [] } });
		expect(`${emptyOut}`.trim()).toBe('');
		// 非空白名单但段名全不匹配(preset 与产出漂移):filter 后为空 → 回退原文(防段名失配惩罚用户)。
		const mismatchOut = applyAIExportSectionFilterToSnapshot('bazi', text, { version: AI_EXPORT_SETTINGS_VERSION, sections: { bazi: ['不存在的段X'] } });
		expect(mismatchOut).toBe(text);
	});

	it('空/无内容输入 → 原样返回，不抛', ()=>{
		expect(applyAIExportSectionFilterToSnapshot('astrochart', '')).toBe('');
		expect(applyAIExportSectionFilterToSnapshot('astrochart', null)).toBe(null);
	});

	// 动态段头运行期折叠命中(端到端:喂真实产出的动态段名 → 折叠占位勾选能保留)。
	// 静态守卫(aiExportRoundtrip)只证「占位进了 preset」,不证「运行期 normalizeSectionTitle 真把产出段名折到占位」——
	// 若折叠分支正则打错,静态守卫仍绿而自定义用户丢整族动态段(座运/专题深化/基于X 各 3-11 段)。本用例堵此洞。
	it('动态段头运行期折叠命中:实际产出段名(座运·摩羯/专题深化·诉讼/基于X点推运/基于X起运)被折叠占位勾选保留、未勾选段剔除', ()=>{
		const CASES = [
			{ key: 'horary', produced: '专题深化·诉讼胜负（1宫本方 vs 7宫对方，10宫法官）', placeholder: '专题深化·X' },
			{ key: 'indiachart', produced: '座运·摩羯', placeholder: '座运·X' },
			{ key: 'zodialrelease', produced: '基于金星点推运', placeholder: '基于X点推运' },
			{ key: 'decennials', produced: '基于土星起运', placeholder: '基于X起运' },
		];
		CASES.forEach(({ key, produced, placeholder })=>{
			const text = [`[${produced}]`, `${produced}-正文`, '', '[勿选占位段]', '勿选-正文', ''].join('\n').trim();
			const settings = { version: AI_EXPORT_SETTINGS_VERSION, sections: { [key]: [placeholder] } };
			const out = applyAIExportSectionFilterToSnapshot(key, text, settings);
			expect(out).toContain(`${produced}-正文`); // 产出动态段名折叠命中占位 → 正文保留
			expect(out).not.toContain('勿选-正文');     // 未勾选段被剔除(证明确在过滤,非全文兜底放行)
		});
	});

	it('techniqueDefaults schema 不破坏四同步：每个有 preset 的挂载技法都能取到 schema(schema 或 sectionsOnly)', ()=>{
		const mountableWithPreset = [...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES]
			.filter((key)=>getAIExportPresetKeys().indexOf(key) >= 0);
		const missing = mountableWithPreset.filter((key)=>!getTechniqueSettingsSchema(key));
		expect(missing).toEqual([]);
	});

	it('反向哨兵:有导出预设的技法必须可挂载、或在显式豁免清单(kinastro 七技法曾「可导出不可挂载」从正向检查溜过)', ()=>{
		// 豁免=结构上不可按单记录/单事盘重算者;新增豁免必须在此写明理由,否则新技法漏挂载当场红。
		const MOUNT_EXEMPT = {
			generic: '通用兜底键,非具体技法',
			jieqi: '节气盘走自有 split 多取数导出,无单盘挂载语义',
			relative: '合盘需两张盘,单记录挂载不适用',
			otherbu: '骰子随机不可复算,无事盘存储',
			fengshui: '风水按宅盘交互起盘,无事盘存储',
			calendar: '黄历为日期工具页,无盘主记录语义,照 jieqi/fengshui 先例只导出不挂载',
			huangli: '按「起课时间」源挂载(TIMEPOINT 白名单,纯日期确定复算),无命盘/事盘记录语义',
			tongshu: '按「起课时间」源挂载(TIMEPOINT 白名单,齿轮落 payload.tongshu),无命盘/事盘记录语义',
			// [YD 拆键] 六衍生盘导出键独立(段勾选可分盘),挂载语义仍走 astrochart_like 聚合键(主盘族重算)。
			hellenastro: '衍生盘挂载走 astrochart_like 聚合键',
			dwadasamsa: '衍生盘挂载走 astrochart_like 聚合键',
			harmonic: '衍生盘挂载走 astrochart_like 聚合键',
			draconic: '衍生盘挂载走 astrochart_like 聚合键',
			relocation: '衍生盘挂载走 astrochart_like 聚合键',
			locastro: '衍生盘挂载走 astrochart_like 聚合键',
		};
		const mountable = new Set([...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES]);
		const leftovers = getAIExportPresetKeys()
			.filter((key)=>!mountable.has(key))
			.filter((key)=>!key.startsWith('jieqi_'))   // 节气盘 split 子键族:随 jieqi 自有分节机制,同族豁免
			.filter((key)=>!Object.prototype.hasOwnProperty.call(MOUNT_EXEMPT, key));
		expect(leftovers).toEqual([]);
		// 豁免清单不许养僵尸:每个豁免键必须仍真实存在于导出预设表
		const zombie = Object.keys(MOUNT_EXEMPT).filter((key)=>getAIExportPresetKeys().indexOf(key) < 0);
		expect(zombie).toEqual([]);
	});

	it('可挂载技法的挂载快照建构分支必达(kinastro 系经通用建构器,标签/清单/schema/分支四点齐)', ()=>{
		['qizhengkin', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi'].forEach((key)=>{
			expect(ANALYSIS_CHART_TECHNIQUES).toContain(key);
			expect(ANALYSIS_TECHNIQUE_LABELS[key]).toBeTruthy();
			expect(getTechniqueSettingsSchema(key)).toBeTruthy();
			expect(getAIExportPresetKeys()).toContain(key);
		});
	});
});

// 提取派发反向哨兵：反向哨兵(getAIExportAuditMatrix)查 getExtractorKindByExportKey 的「登记」，
// 但不查 extractContentByKey 的「实际派发」——二者可漂移。曾致 yizhangjing / distributions / agepoint
// 登记为 module/predictive 却无 extractContentByKey 分支 → 落 extractGenericContent → 导出空。
// 本哨兵读源码断言：每个推运候选键都被 extractContentByKey 显式派发，不静默落 generic。
describe('AI导出 · 提取派发反向哨兵(防新增技法漏 extractContentByKey 分支)', () => {
	// eslint-disable-next-line global-require
	const fs = require('fs');
	// eslint-disable-next-line global-require
	const path = require('path');
	const SRC = fs.readFileSync(path.join(__dirname, '../aiExport.js'), 'utf8');

	it('每个推运候选键(predictiveKeys)都被 extractContentByKey 显式派发,不落 generic', () => {
		const pkMatch = SRC.match(/predictiveKeys\s*=\s*\[([^\]]*)\]/);
		expect(pkMatch).toBeTruthy();
		const predictiveKeys = [...pkMatch[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
		expect(predictiveKeys.length).toBeGreaterThan(10);

		// 截取 extractContentByKey 函数体(到下一个顶层 async function 声明为止)。
		const start = SRC.indexOf('async function extractContentByKey');
		expect(start).toBeGreaterThan(0);
		const rest = SRC.slice(start + 34);
		const end = rest.indexOf('\nasync function ');
		const body = end > 0 ? rest.slice(0, end) : rest;

		// 显式派发键 = 分支里所有 `exportKey === 'X'` ∪ 简单模块键组。
		const handled = new Set([...body.matchAll(/exportKey\s*===\s*'([a-z0-9_]+)'/g)].map((m) => m[1]));
		AI_EXPORT_SIMPLE_MODULE_KEYS.forEach((k) => handled.add(k));

		const missing = predictiveKeys.filter((k) => !handled.has(k));
		expect(missing).toEqual([]); // 缺分支 → 落 generic → 导出空(distributions/agepoint 曾如此)
	});
});
