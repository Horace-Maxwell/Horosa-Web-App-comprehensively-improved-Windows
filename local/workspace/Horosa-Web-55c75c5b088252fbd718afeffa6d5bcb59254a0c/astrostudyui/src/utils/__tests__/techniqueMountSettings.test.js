import {
	TECHNIQUE_SETTINGS_SCHEMA,
	getTechniqueSettingsSchema,
	getTechniqueSettingsDefaults,
	isSectionsOnlyTechnique,
	hasMountSettingsFields,
	pruneOptionsToNonDefault,
	mergeOptionsIntoRecord,
	mergeOptionsIntoPayload,
	loadMountTechniqueDefaults,
	saveMountTechniqueDefaults,
	getMountTechniqueDefault,
	applyLocalStorageSettings,
	snapshotLocalStorageSettings,
	restoreLocalStorageSettings,
	getMountableTechniqueAuditEntry,
	MOUNT_TECHNIQUE_DEFAULTS_KEY,
} from '../techniqueMountSettings';
import {
	ANALYSIS_CHART_TECHNIQUES,
	ANALYSIS_CASE_TECHNIQUES,
} from '../aiAnalysisContext';
// 源组件常量（techniqueMountSettings 因循环导入改内联镜像；此处导入源以断言无漂移）。
import { QI_METHODS } from '../../components/lrzhan/LiuRengMain';
import { HORARY_CATEGORIES } from '../../components/horary/HoraryMain';
import { ELECTION_TOPICS } from '../../components/election/ElectionMain';
import { SU28_MODE_GROUPS } from '../../components/guolao/guolaoData';

// germany 本轮改为可重算 record（fieldsToParams→/chart 真实重算中点盘），故移出只读集。
// wuzhao/taixuan/jingjue/shenyishu：可存事盘(CASE_TYPE_OPTIONS)却此前挂不上，补 sectionsOnly 缓存挂载（不重算）。
// huangji：双栖(命盘侧按出生重算+可存事盘)，由 record→sectionsOnly，与 4 姊妹法同列(事盘读 payload.snapshot 不重算；
//   命盘侧重算不受 schema.kind 影响)，去掉事盘上误显的 TIME_FIELDS 覆盖坏边界。
// wuzhao/taixuan/jingjue/shenyishu 已从 sectionsOnly 升级为 payload(builder 收 opts → 用户挂载设置生效)。
// huangji 保持 sectionsOnly:命盘侧 buildHuangJiSnapshotForFields 已按出生重算,事盘侧读已存 snapshot 不重算。
// auxchart 已除名:页面键在挂载链恒被映射为子 tab 技法键,孤儿 schema 永不命中(挂载死/报告活)。
// huangli(纯日期确定,无齿轮)为 sectionsOnly 新成员。
// 🔴 sixyao/geomancy/tarot 已按正口径转 payload:旧「sectionsOnly 不可重算」定性过宽 ——
// 卦象/figure/牌面恒冻结(payload.gua / seedMode:manual+seed),判读口径重算恒安全。
const SECTIONS_ONLY = ['tongshefa', 'mundane',
	'huangli',
	'relative', // [D2] 合盘:两盘技法只读(快照单源=合盘页,选项在合盘页改即重存)
	'tianxing', // 天星择日:征象搜索结果为一次性产物,按存档快照直读不按时间复算(v3.7.0 并入)
];

beforeEach(()=>{
	window.localStorage.clear();
});

describe('techniqueMountSettings schema 覆盖', ()=>{
	it('每个可挂载技法(命盘类 + 事盘类)都在 schema 有登记(schema 或 sectionsOnly)——无遗漏', ()=>{
		const mountable = Array.from(new Set([...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES]));
		const missing = mountable.filter((key)=>!getTechniqueSettingsSchema(key));
		expect(missing).toEqual([]);
	});

	it('sectionsOnly 集合 = {sixyao,tongshefa,mundane,huangji,…,relative}(变更需显式改测试,防误把可重算技法标只读)', ()=>{
		const flagged = Object.keys(TECHNIQUE_SETTINGS_SCHEMA)
			.filter((key)=>TECHNIQUE_SETTINGS_SCHEMA[key].kind === 'sectionsOnly')
			.sort();
		expect(flagged).toEqual(SECTIONS_ONLY.slice().sort());
		SECTIONS_ONLY.forEach((key)=>{
			expect(isSectionsOnlyTechnique(key)).toBe(true);
			expect(hasMountSettingsFields(key)).toBe(false);
		});
	});

	it('每个 schema 的 kind 都合法,record/payload/localStorage 类的 field 必含 name/type/default', ()=>{
		const VALID_KINDS = new Set(['record', 'payload', 'localStorage', 'sectionsOnly']);
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((key)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
			expect(VALID_KINDS.has(schema.kind)).toBe(true);
			if(schema.kind === 'sectionsOnly'){
				return;
			}
			expect(Array.isArray(schema.fields)).toBe(true);
			schema.fields.forEach((field)=>{
				expect(field.name).toBeTruthy();
				expect(field.type).toBeTruthy();
				expect(Object.prototype.hasOwnProperty.call(field, 'default')).toBe(true);
				if(field.type === 'select'){
					expect(Array.isArray(field.options)).toBe(true);
					expect(field.options.length).toBeGreaterThan(0);
					// 默认值必须在选项里(否则下拉显示空 / 无法回到默认)。
					const vals = field.options.map((o)=>`${o.value}`);
					expect(vals).toContain(`${field.default}`);
				}
			});
		});
	});

	it('payload 类必有 optionsPath(options 或 顶层空串)', ()=>{
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((key)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
			if(schema.kind === 'payload'){
				// 嵌套命名空间白名单:'options'(六壬子组)/'tongshu'(通书,读点 {...defaults,...p.tongshu});
				// ''=顶层铺平。新增路径必须与对应 regenerate 读点同构并在此登记。
				expect(['options', '', 'tongshu', 'liuyaoSettings']).toContain(schema.optionsPath);
			}
		});
	});
});

describe('默认即现状(prune / merge 等价性)', ()=>{
	it('用默认值组成的 options → prune 后为空(不产生任何覆盖)', ()=>{
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((key)=>{
			const defaults = getTechniqueSettingsDefaults(key);
			expect(pruneOptionsToNonDefault(key, defaults)).toEqual({});
		});
	});

	it('mergeOptionsIntoRecord 默认 options → record 不变(浅比较关键键)', ()=>{
		const record = { cid: 'c1', hsys: undefined };
		const merged = mergeOptionsIntoRecord(record, 'astrochart', getTechniqueSettingsDefaults('astrochart'));
		// 默认全等 → 不写入任何 schema 字段(record 仅保留原键)。
		expect(merged.cid).toBe('c1');
		Object.keys(getTechniqueSettingsDefaults('astrochart')).forEach((name)=>{
			expect(merged[name]).toBeUndefined();
		});
	});

	it('mergeOptionsIntoRecord 自定义项 → 写进 record.*(A 类生效前提)', ()=>{
		const merged = mergeOptionsIntoRecord({ cid: 'c1' }, 'astrochart', { hsys: 3, zodiacal: 1 });
		expect(merged.hsys).toBe(3);
		expect(merged.zodiacal).toBe(1);
		expect(merged.cid).toBe('c1');
	});

	it('mergeOptionsIntoPayload(options 路径) 写 payload.options;顶层路径写 payload 顶层', ()=>{
		const qimen = mergeOptionsIntoPayload({}, 'qimen', { qijuMethod: 'chaijbu' });
		expect(qimen.options.qijuMethod).toBe('chaijbu');
		const liureng = mergeOptionsIntoPayload({}, 'liureng', { castMethod: 'xuanshi' });
		expect(liureng.castMethod).toBe('xuanshi');
		expect(liureng.options).toBeUndefined();
	});

	it('mergeOptionsIntoPayload 默认 options → payload 不变', ()=>{
		const base = { foo: 1 };
		expect(mergeOptionsIntoPayload(base, 'qimen', getTechniqueSettingsDefaults('qimen'))).toEqual({ foo: 1 });
		expect(mergeOptionsIntoPayload(base, 'liureng', getTechniqueSettingsDefaults('liureng'))).toEqual({ foo: 1 });
	});

	it('sectionsOnly 技法 merge/prune 不产生覆盖', ()=>{
		expect(pruneOptionsToNonDefault('sixyao', { anything: 1 })).toEqual({});
		expect(mergeOptionsIntoPayload({ x: 1 }, 'mundane', { anything: 1 })).toEqual({ x: 1 });
	});
});

describe('mount defaults 持久化(独立键,与 aiExport 互不冲突)', ()=>{
	it('saveMountTechniqueDefaults 只存非默认项;全默认 → 删键', ()=>{
		saveMountTechniqueDefaults('qimen', { qijuMethod: 'chaijbu', paiPanType: 3 });
		expect(getMountTechniqueDefault('qimen')).toEqual({ qijuMethod: 'chaijbu' });
		// 写回全默认 → 删除该技法键。
		saveMountTechniqueDefaults('qimen', getTechniqueSettingsDefaults('qimen'));
		expect(getMountTechniqueDefault('qimen')).toEqual({});
	});

	it('mount defaults 存在独立 localStorage 键,不写 aiExport 设置键', ()=>{
		saveMountTechniqueDefaults('astrochart', { hsys: 3 });
		expect(window.localStorage.getItem(MOUNT_TECHNIQUE_DEFAULTS_KEY)).toBeTruthy();
		expect(window.localStorage.getItem('horosa.ai.export.settings.v1')).toBeNull();
		const loaded = loadMountTechniqueDefaults();
		expect(loaded.techniques.astrochart).toEqual({ hsys: 3 });
	});

	it('损坏的存储 → 回退空默认(不抛)', ()=>{
		window.localStorage.setItem(MOUNT_TECHNIQUE_DEFAULTS_KEY, '{bad json');
		expect(loadMountTechniqueDefaults()).toEqual({ version: 1, techniques: {} });
	});
});

describe('C 类 localStorage 写入(七政四余命度/罗计)', ()=>{
	it('applyLocalStorageSettings 仅写非默认项到对应全局键', ()=>{
		applyLocalStorageSettings('guolao', { lifeMode: 'yumao' });
		expect(window.localStorage.getItem('horosaGuolaoLifeMode')).toBe('yumao');
		// nodeMode 用默认 → 不写。
		expect(window.localStorage.getItem('horosaGuolaoNodeMode')).toBeNull();
	});

	it('非 localStorage 类技法调用 applyLocalStorageSettings 无副作用', ()=>{
		applyLocalStorageSettings('astrochart', { hsys: 3 });
		expect(window.localStorage.getItem('horosaGuolaoLifeMode')).toBeNull();
	});
});

describe('本轮缺漏修复——每技法选项与主页面对齐(防"对不上")', ()=>{
	const optVals = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.options.map((o)=>`${o.value}`) : null;
	};
	const defOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.default : undefined;
	};

	it('germany 改为可重算 record(不再 sectionsOnly),字段面=真下发键+uranian 显示仓覆盖(timeAlg inert→不放)', ()=>{
		expect(isSectionsOnlyTechnique('germany')).toBe(false);
		expect(hasMountSettingsFields('germany')).toBe(true);
		// 🔴 旧断言只锁 hsys/zodiacal 两键 —— 该覆盖面已被证伪:builder 亲读 getStoredUranianDisplay()
		// 的 school/orb/orbPersonal/strictFactors/showDeclination/frames 且 fieldsToParams 真下发
		// siderealAyanamsa/tradition/强互容/简化相位/虚点。改锁全集(缺一键=齿轮盖不住的死角复发)。
		const names = getTechniqueSettingsSchema('germany').fields.map((f)=>f.name).sort();
		expect(names).toEqual([
			'hsys', 'orb', 'orbPersonal', 'school', 'showDeclination', 'showEastPoint', 'showHouseFrames',
			'siderealAyanamsa', 'simpleAsp', 'strictFactors', 'strongRecption', 'tradition', 'virtualPointReceiveAsp', 'zodiacal',
		]);
	});

	it('自检修复:germany 不含 inert 的 timeAlg / 印占暴露岁差制+分宫制(已接入挂载设置)', ()=>{
		expect(getTechniqueSettingsSchema('germany').fields.map((f)=>f.name)).not.toContain('timeAlg');
		// 印占岁差制/分宫制现已接入挂载设置(buildFieldObject→fieldsToParams 读 indiaAyanamsa/indiaHsys)。
		expect(hasMountSettingsFields('indiachart')).toBe(true);
		const indiaNames = getTechniqueSettingsSchema('indiachart').fields.map((f)=>f.name);
		expect(indiaNames).toContain('indiaAyanamsa');
		expect(indiaNames).toContain('indiaHsys');
	});

	it('印占挂载设置暴露 Sthira 座运起座(lagna 默认/brahma;默认 prune 不写 record→Sthira 座运零回归)', ()=>{
		const indiaNames = getTechniqueSettingsSchema('indiachart').fields.map((f)=>f.name);
		expect(indiaNames).toContain('indiaSthiraStart');
		expect(defOf('indiachart', 'indiaSthiraStart')).toBe('lagna');
		expect(optVals('indiachart', 'indiaSthiraStart')).toEqual(expect.arrayContaining(['lagna', 'brahma']));
		// 选 brahma → 落 record.indiaSthiraStart(buildFieldObject 读 → IndiaChart.fieldsToParams 下发 sthiraStart)
		expect(mergeOptionsIntoRecord({ cid: 'x' }, 'indiachart', { indiaSthiraStart: 'brahma' }).indiaSthiraStart).toBe('brahma');
		// 默认 lagna → prune → 不写 record(守「默认即现状」:后端缺键即 lagna,Sthira 座运字节零回归)
		expect(pruneOptionsToNonDefault('indiachart', { indiaSthiraStart: 'lagna' })).toEqual({});
	});

	it('西洋盘挂载设置暴露 siderealAyanamsa 岁差制覆盖(与印占两段式一致;默认空=随盘,prune 不覆盖存盘)', ()=>{
		const names = getTechniqueSettingsSchema('astrochart').fields.map((f)=>f.name);
		expect(names).toContain('siderealAyanamsa');
		expect(defOf('astrochart', 'siderealAyanamsa')).toBe('');
		expect(optVals('astrochart', 'siderealAyanamsa')).toEqual(expect.arrayContaining(['', 'raman', 'fagan_bradley']));
		// 选具体 ayanāṃśa → 落 record.siderealAyanamsa(buildFieldObject 读 → fieldsToParams 下发)
		expect(mergeOptionsIntoRecord({ cid: 'x' }, 'astrochart', { siderealAyanamsa: 'fagan_bradley' }).siderealAyanamsa).toBe('fagan_bradley');
		// 默认空 → prune → 不覆盖存盘 ayanāṃśa(守「默认即现状」)
		expect(mergeOptionsIntoRecord({ cid: 'x', siderealAyanamsa: 'raman' }, 'astrochart', { siderealAyanamsa: '' }).siderealAyanamsa).toBe('raman');
	});

	it('西洋盘挂载设置暴露 termsVariant 界系(埃及默认/托勒密/莉莉/迦勒底;默认0=现状,prune 不覆盖)', ()=>{
		const names = getTechniqueSettingsSchema('astrochart').fields.map((f)=>f.name);
		expect(names).toContain('termsVariant');
		expect(defOf('astrochart', 'termsVariant')).toBe(0);
		// 含本会话新增的迦勒底界(value 3),四档齐全。
		expect(optVals('astrochart', 'termsVariant')).toEqual(expect.arrayContaining(['0', '1', '2', '3']));
		// 选托勒密界 → 落 record.termsVariant(buildFieldObject 读 → 下发 /chart)
		expect(mergeOptionsIntoRecord({ cid: 'x' }, 'astrochart', { termsVariant: 1 }).termsVariant).toBe(1);
		// 迦勒底界(3)同样落 record。
		expect(mergeOptionsIntoRecord({ cid: 'x' }, 'astrochart', { termsVariant: 3 }).termsVariant).toBe(3);
		// 默认 0(埃及)→ prune → 不写 record(守「默认即现状」零回归)
		expect(pruneOptionsToNonDefault('astrochart', { termsVariant: 0 })).toEqual({});
	});

	it('西洋盘挂载设置暴露本会话希腊化新设置(月交点真平/区分缓冲/狮子土星/三分集含水象变体/福点反转)', ()=>{
		const names = getTechniqueSettingsSchema('astrochart').fields.map((f)=>f.name);
		// G12/G13/G15/G20-P2 五项均在 record schema(挂载抽屉可调)。
		['westNodeType', 'sectBuffer', 'leoBoundFirst', 'triplicity', 'lotReversal'].forEach((n)=>{
			expect(names).toContain(n);
		});
		// 默认 === 现状(平交点/几何/关/Dorothean/反转ON):prune 后皆不写 record → 字节零回归。
		expect(defOf('astrochart', 'westNodeType')).toBe('mean');
		expect(defOf('astrochart', 'sectBuffer')).toBe('geo');
		expect(defOf('astrochart', 'leoBoundFirst')).toBe(0);
		expect(defOf('astrochart', 'triplicity')).toBe('Dorothean');
		expect(defOf('astrochart', 'lotReversal')).toBe(1);
		expect(pruneOptionsToNonDefault('astrochart', {
			westNodeType: 'mean', sectBuffer: 'geo', leoBoundFirst: 0, triplicity: 'Dorothean', lotReversal: 1,
		})).toEqual({});
		// 三分集含本会话新增的托勒密·水象变体(真 sect-aware 后端换表)。
		expect(optVals('astrochart', 'triplicity')).toEqual(expect.arrayContaining(['Dorothean', 'Ptolemaic', 'PtolemaicWaterVariant']));
		// 非默认 → 落 record(buildFieldObject→fieldsToParams 下发 /chart 复算)。
		expect(mergeOptionsIntoRecord({ cid: 'x' }, 'astrochart', { triplicity: 'PtolemaicWaterVariant' }).triplicity).toBe('PtolemaicWaterVariant');
		expect(mergeOptionsIntoRecord({ cid: 'x' }, 'astrochart', { lotReversal: 0 }).lotReversal).toBe(0);
	});

	it('三分主星/Balbillus/关键点 不再空 schema,暴露推运参数', ()=>{
		expect(hasMountSettingsFields('triplicityrulers')).toBe(true);
		expect(optVals('triplicityrulers', 'division')).toEqual(expect.arrayContaining(['thirds', 'halves']));
		expect(defOf('triplicityrulers', 'lifespan')).toBeGreaterThan(0);
		expect(hasMountSettingsFields('balbillus')).toBe(true);
		expect(optVals('balbillus', 'yearType')).toEqual(expect.arrayContaining(['solar', 'hellenistic']));
		expect(optVals('balbillus', 'mode')).toEqual(expect.arrayContaining(['nearest', 'forward']));
		expect(hasMountSettingsFields('keypoints')).toBe(true);
		expect(optVals('keypoints', 'mode')).toEqual(expect.arrayContaining(['soul', 'body']));
	});

	it('八字 timeAlg 4 档(含平太阳时=3/春分定卯时=2,对齐 CnTraditionInput) / phaseType 3 档(含值2) / godKeyPos 含「年日」', ()=>{
		expect(optVals('bazi', 'timeAlg').slice().sort()).toEqual(['0', '1', '2', '3']);
		expect(optVals('bazi', 'phaseType')).toEqual(['0', '1', '2']);
		expect(optVals('bazi', 'godKeyPos')).toContain('年日');
	});

	it('卜卦 topicId=18 类(批2 起 lost/message 正式类;2026-07-31 增 father/mother 父母宫两派转宫)', ()=>{
		// 历史注记:lost 曾是无引擎支撑的假值被本测试拦截;2026-07 批2 落地失物专题
		// (CATEGORY_DEF.lost + topicModule.buildLostObject)后转正,与 message(B3 消息真假)一并入册。
		const vals = optVals('horary', 'topicId');
		expect(vals.length).toBe(18);
		expect(vals).toContain('theft');
		expect(vals).toContain('lost');
		expect(vals).toContain('message');
	});

	it('择日 topicId=25 类(含 renovation/surgery 与 R2 六新分科,无假值 construction/medical)', ()=>{
		const vals = optVals('election', 'topicId');
		expect(vals.length).toBe(25);
		expect(vals).toEqual(expect.arrayContaining(['planting', 'sailing', 'litigation', 'release', 'haircut', 'talisman']));
		expect(vals).toEqual(expect.arrayContaining(['renovation', 'surgery']));
		expect(vals).not.toContain('construction');
		expect(vals).not.toContain('medical');
	});

	it('大六壬 起课法=26 法(全 QI_METHODS,含报数/端法活时)', ()=>{
		expect(optVals('liureng', 'castMethod').length).toBe(26);
		expect(optVals('liureng', 'castMethod')).toEqual(expect.arrayContaining(['zheng', 'xuanshi', 'yanshu', 'baoshu', 'bake2', 'cike1', 'alnr']));
	});

	it('内联镜像常量 === 源组件常量(防漂移:起课法/卜卦类别/择日类别)', ()=>{
		const castOpts = getTechniqueSettingsSchema('liureng').fields.find((f)=>f.name === 'castMethod').options;
		expect(castOpts).toEqual(QI_METHODS.map((m)=>({ value: m.key, label: m.name })));
		const horaryOpts = getTechniqueSettingsSchema('horary').fields.find((f)=>f.name === 'topicId').options;
		expect(horaryOpts).toEqual(HORARY_CATEGORIES);
		const electionOpts = getTechniqueSettingsSchema('election').fields.find((f)=>f.name === 'topicId').options;
		expect(electionOpts).toEqual(ELECTION_TOPICS);
	});

	it('七政宿度制 挂载选项值集 === SU28_MODE_GROUPS 全值(防漏新宿度制,如赤道回归实时=8)', ()=>{
		const su28Vals = optVals('guolao', 'su28Mode').slice().sort((a, b)=>a - b);
		const sourceVals = SU28_MODE_GROUPS.reduce((acc, g)=>acc.concat(g.options.map((o)=>`${o.value}`)), []).sort((a, b)=>a - b);
		expect(su28Vals).toEqual(sourceVals);
		// 回归锚点子项须在 赤道回归 元明(7) 与 实时(8) 下都揭示。
		const anchorField = getTechniqueSettingsSchema('guolao').fields.find((f)=>f.name === 'guolaoEqTropicalAnchor');
		expect(anchorField.showWhen({ su28Mode: 7 })).toBe(true);
		expect(anchorField.showWhen({ su28Mode: 8 })).toBe(true);
		expect(anchorField.showWhen({ su28Mode: 2 })).toBe(false);
	});

	it('金口诀 guireng 默认=0(六壬法,对齐组件 state) + diFen 默认 sentinel auto(含 auto+12 支)', ()=>{
		expect(defOf('jinkou', 'guireng')).toBe(0);
		// 坑修：diFen 默认 'auto'（按占时支）而非具体「子」，否则选「子」会被 prune 误丢、钉不成子。
		expect(defOf('jinkou', 'diFen')).toBe('auto');
		const diFenVals = optVals('jinkou', 'diFen');
		expect(diFenVals.length).toBe(13); // auto + 12 支
		expect(diFenVals).toContain('auto');
		['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].forEach((zi)=>{
			expect(diFenVals).toContain(zi);
		});
	});

	it('金口诀 diFen round-trip：默认 auto 被 prune 丢(=现状走占时支)，选具体地支保留(真钉地分)', ()=>{
		// 默认 'auto' → prune 后为空对象 → payload.diFen 缺省 → regen 走占时支(=现状)。
		expect(pruneOptionsToNonDefault('jinkou', { diFen: 'auto' })).toEqual({});
		// 选「子」(≠ 默认 'auto') → prune 保留 → regen 的 resolveJinKouDiFen 首分支 currentZi='子' → 真落子。
		expect(pruneOptionsToNonDefault('jinkou', { diFen: '子' })).toEqual({ diFen: '子' });
		expect(pruneOptionsToNonDefault('jinkou', { diFen: '午' })).toEqual({ diFen: '午' });
	});

	it('太乙 暴露 日界/晚子时', ()=>{
		const names = getTechniqueSettingsSchema('taiyi').fields.map((f)=>f.name);
		expect(names).toEqual(expect.arrayContaining(['after23NewDay', 'lateZiHourUseNextDay']));
	});

	it('紫微 暴露 四化流派 + 多选运限(批A) / 主限法 暴露 pdYears 默认100', ()=>{
		const ziweiNames = getTechniqueSettingsSchema('ziwei').fields.map((f)=>f.name);
		// 批A：单值 periodLevel + 5 number 子项 → 改为多选集合字段。
		expect(ziweiNames).toEqual(expect.arrayContaining(['sihuaSchool', 'daxianSel', 'liunianSel', 'liuyueSel', 'liuriSel', 'liushiSel']));
		expect(ziweiNames).not.toContain('periodLevel');
		expect(defOf('primarydirect', 'pdYears')).toBe(100);
	});
});

describe('批3——推运/数算 builder 加 opts + 接线（schema 字段 + 默认对 + 真改输出前提）', ()=>{
	const optVals = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.options.map((o)=>`${o.value}`) : null;
	};
	const defOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.default : undefined;
	};
	const hasField = (key, name)=>!!getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);

	it('黄道星释 zodialrelease：基点11 + 输出层级4 + 逐层钻取 idx；不再空 schema', ()=>{
		expect(hasMountSettingsFields('zodialrelease')).toBe(true);
		expect(optVals('zodialrelease', 'basePoint').length).toBe(11);
		// 默认基点=福点（builder 现状）。
		expect(defOf('zodialrelease', 'basePoint')).toBe('Pars Fortuna');
		expect(optVals('zodialrelease', 'aiMode')).toEqual(expect.arrayContaining(['l1_all', 'l2_in_l1', 'l3_in_l2', 'l4_in_l3']));
		expect(defOf('zodialrelease', 'aiMode')).toBe('l1_all');
		['aiL1Idx', 'aiL2Idx', 'aiL3Idx'].forEach((n)=>expect(defOf('zodialrelease', n)).toBe(0));
	});

	it('十年大运 decennials：起运/次序/日限/历法 + 输出层级；默认=本光起运/黄道序/Valens/360日', ()=>{
		expect(hasMountSettingsFields('decennials')).toBe(true);
		expect(defOf('decennials', 'startMode')).toBe('sect_light');
		expect(defOf('decennials', 'orderType')).toBe('zodiacal');
		expect(defOf('decennials', 'dayMethod')).toBe('valens');
		expect(defOf('decennials', 'calendarType')).toBe('calendar_360');
		expect(optVals('decennials', 'orderType')).toEqual(expect.arrayContaining(['zodiacal', 'chaldean']));
		expect(optVals('decennials', 'calendarType')).toEqual(expect.arrayContaining(['calendar_360', 'calendar_365_25']));
		expect(defOf('decennials', 'aiMode')).toBe('l1_all');
	});

	it('行星弧 planetaryarc：弧源7 + 目标时刻 + 容许度；默认 月亮/空/1', ()=>{
		expect(optVals('planetaryarc', 'arcSource').length).toBe(7);
		expect(defOf('planetaryarc', 'arcSource')).toBe('Moon');
		expect(defOf('planetaryarc', 'targetDatetime')).toBe('');
		expect(defOf('planetaryarc', 'asporb')).toBe(1);
	});

	it('波斯向运 persiandirected：速率3 + 方向2 + 应期年数5；默认 persian/direct/90', ()=>{
		expect(optVals('persiandirected', 'rateKey')).toEqual(expect.arrayContaining(['persian', 'prophected', 'naibod']));
		expect(defOf('persiandirected', 'rateKey')).toBe('persian');
		expect(optVals('persiandirected', 'direction')).toEqual(['direct', 'converse']);
		expect(defOf('persiandirected', 'direction')).toBe('direct');
		// 应期年数：5 档（50/90/120/150/200），默认 90 → prune 丢弃 → builder/挂载缺省 90 = 现状。
		expect(optVals('persiandirected', 'maxYears')).toEqual(['50', '90', '120', '150', '200']);
		expect(defOf('persiandirected', 'maxYears')).toBe(90);
	});

	it('恒星推运/赤纬推运 vedicprog/jaynesprog：targetDate + targetTime，默认空(→today/12:00)', ()=>{
		['vedicprog', 'jaynesprog'].forEach((k)=>{
			expect(hasField(k, 'targetDate')).toBe(true);
			expect(hasField(k, 'targetTime')).toBe(true);
			expect(defOf(k, 'targetDate')).toBe('');
			expect(defOf(k, 'targetTime')).toBe('');
		});
	});

	it('目标时刻型5法：profection/solararc 4 基项；3返照另加 dirLat/dirLon', ()=>{
		['profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear'].forEach((k)=>{
			expect(hasField(k, 'datetime')).toBe(true);
			expect(defOf(k, 'datetime')).toBe('');
			expect(defOf(k, 'tmType')).toBe('y');
			expect(defOf(k, 'asporb')).toBe(1);
			expect(defOf(k, 'nodeRetrograde')).toBe(0);
		});
		// profection/solararc 无异地经纬。
		['profection', 'solararc'].forEach((k)=>{
			expect(hasField(k, 'dirLat')).toBe(false);
			expect(hasField(k, 'dirLon')).toBe(false);
		});
		// 3 返照有异地经纬。
		['solarreturn', 'lunarreturn', 'givenyear'].forEach((k)=>{
			expect(hasField(k, 'dirLat')).toBe(true);
			expect(hasField(k, 'dirLon')).toBe(true);
		});
	});

	it('金口诀 yueJiang/zhanShi（功能项,12 支+auto,默认 auto）；timeBasis 不入 schema(降级)', ()=>{
		expect(defOf('jinkou', 'yueJiang')).toBe('auto');
		expect(defOf('jinkou', 'zhanShi')).toBe('auto');
		expect(optVals('jinkou', 'yueJiang').length).toBe(13); // auto + 12 支
		expect(optVals('jinkou', 'zhanShi').length).toBe(13);
		expect(hasField('jinkou', 'timeBasis')).toBe(false);
	});

	it('数算参评数 canping：method(明法ming/古法gu,默认 ming) 已加且保留时间换算', ()=>{
		expect(defOf('canping', 'method')).toBe('ming');
		expect(optVals('canping', 'method')).toEqual(['ming', 'gu']);
		expect(hasField('canping', 'timeAlg')).toBe(true);
	});

	it('河洛 quHuaGong（土王寄坤艮tuWangKunGen 默认/直取四方伯siFangBoOnly）已加且保留时间换算', ()=>{
		expect(defOf('heluo', 'quHuaGong')).toBe('tuWangKunGen');
		expect(optVals('heluo', 'quHuaGong')).toEqual(['tuWangKunGen', 'siFangBoOnly']);
		expect(hasField('heluo', 'timeAlg')).toBe(true);
	});

	it('容许度 orbScale(数字,默认1) + useStoredOrbs(开关,默认0) 加入 astrochart/astrochart_like/suzhan', ()=>{
		['astrochart', 'astrochart_like', 'suzhan'].forEach((k)=>{
			expect(defOf(k, 'orbScale')).toBe(1);
			expect(defOf(k, 'useStoredOrbs')).toBe(0);
		});
		// germany 只 hsys/zodiacal（timeAlg inert 已移除；不含容许度 orbScale/useStoredOrbs）。
		expect(hasField('germany', 'orbScale')).toBe(false);
		expect(hasField('germany', 'useStoredOrbs')).toBe(false);
	});

	it('round-trip：批3 各技法默认 options → prune 后为空（守「默认即现状」字节级一致）', ()=>{
		['zodialrelease', 'decennials', 'planetaryarc', 'persiandirected', 'vedicprog', 'jaynesprog',
			'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear',
			'jinkou', 'canping', 'heluo', 'astrochart'].forEach((k)=>{
			expect(pruneOptionsToNonDefault(k, getTechniqueSettingsDefaults(k))).toEqual({});
		});
	});

	it('round-trip：改非默认 → prune 保留该项（确保真能驱动重算）', ()=>{
		expect(pruneOptionsToNonDefault('zodialrelease', { basePoint: 'Asc' })).toEqual({ basePoint: 'Asc' });
		expect(pruneOptionsToNonDefault('decennials', { orderType: 'chaldean' })).toEqual({ orderType: 'chaldean' });
		expect(pruneOptionsToNonDefault('persiandirected', { direction: 'converse' })).toEqual({ direction: 'converse' });
		expect(pruneOptionsToNonDefault('persiandirected', { maxYears: 200 })).toEqual({ maxYears: 200 });
		expect(pruneOptionsToNonDefault('planetaryarc', { arcSource: 'Sun' })).toEqual({ arcSource: 'Sun' });
		expect(pruneOptionsToNonDefault('givenyear', { dirLat: '40.0' })).toEqual({ dirLat: '40.0' });
		expect(pruneOptionsToNonDefault('jinkou', { yueJiang: '午', zhanShi: '卯' })).toEqual({ yueJiang: '午', zhanShi: '卯' });
		expect(pruneOptionsToNonDefault('canping', { method: 'gu' })).toEqual({ method: 'gu' });
		expect(pruneOptionsToNonDefault('heluo', { quHuaGong: 'siFangBoOnly' })).toEqual({ quHuaGong: 'siFangBoOnly' });
		expect(pruneOptionsToNonDefault('astrochart', { orbScale: 1.5 })).toEqual({ orbScale: 1.5 });
		expect(pruneOptionsToNonDefault('astrochart', { useStoredOrbs: 1 })).toEqual({ useStoredOrbs: 1 });
		// orbScale=1（默认）→ 丢弃，不下发=现状。
		expect(pruneOptionsToNonDefault('astrochart', { orbScale: 1 })).toEqual({});
	});

	it('mergeOptionsIntoRecord：批3 自定义项写进 record.*（A 类生效前提）', ()=>{
		const m = mergeOptionsIntoRecord({ cid: 'c1' }, 'decennials', { calendarType: 'calendar_365_25', aiMode: 'l2_in_l1' });
		expect(m.calendarType).toBe('calendar_365_25');
		expect(m.aiMode).toBe('l2_in_l1');
	});
});

describe('批4 三式合一复合 + 条件揭示', ()=>{
	it('三式合一 sanshiunited 合并 六壬+奇门+太乙 子组(去重共享时间键,字段名无冲突)', ()=>{
		const names = getTechniqueSettingsSchema('sanshiunited').fields.map((f)=>f.name);
		expect(names).toEqual(expect.arrayContaining(['castMethod', 'guireng', 'wuxing']));   // 六壬子组
		expect(names).toEqual(expect.arrayContaining(['paiPanType', 'qijuMethod']));          // 奇门子组
		// 🔴 太乙子组必须用存档键名 taiyiStyle/taiyiAccum/taiyiSchool_*(页面 state.options 同名),
		// 且绝不得再出现裸 style/tn/sex(与奇门 school 字符串/sex 数字域撞键 → 存档挂载全落默认的旧病)。
		expect(names).toEqual(expect.arrayContaining(['taiyiStyle', 'taiyiAccum', 'taiyiSchool_jishen']));
		expect(names).not.toEqual(expect.arrayContaining(['style']));
		expect(names).not.toEqual(expect.arrayContaining(['tn']));
		expect(names.filter((n)=>n === 'sex').length).toBe(1);       // 仅奇门一份(1/0 域;太乙侧 regenerate 归一男/女)
		expect(names.filter((n)=>n === 'school').length).toBe(1);    // 仅奇门盘式一份(太乙流派走 taiyiSchool_*)
		// 共享时间键各只一份(去重)
		expect(names.filter((n)=>n === 'after23NewDay').length).toBe(1);
		expect(names.filter((n)=>n === 'lateZiHourUseNextDay').length).toBe(1);
		expect(names.filter((n)=>n === 'timeAlg').length).toBe(1);
		// 整体无重名(分桶路由前提)
		expect(names.length).toBe(new Set(names).size);
	});

	it('三式合一默认 options → prune 为空(默认即现状)', ()=>{
		expect(pruneOptionsToNonDefault('sanshiunited', getTechniqueSettingsDefaults('sanshiunited'))).toEqual({});
	});

	it('大六壬/三式合一 选时支·演数 条件揭示(showWhen 按 castMethod)', ()=>{
		const xsz = getTechniqueSettingsSchema('liureng').fields.find((f)=>f.name === 'xuanShiZhi');
		expect(typeof xsz.showWhen).toBe('function');
		expect(xsz.showWhen({ castMethod: 'xuanshi' })).toBe(true);
		expect(xsz.showWhen({ castMethod: 'zheng' })).toBe(false);
		const ysn = getTechniqueSettingsSchema('liureng').fields.find((f)=>f.name === 'yanShuNum');
		expect(ysn.showWhen({ castMethod: 'yanshu' })).toBe(true);
		expect(ysn.showWhen({ castMethod: 'zheng' })).toBe(false);
	});
});

describe('批A 多运限多选字段（紫微/八字）+ 数组 prune 顺序无关', ()=>{
	const defOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.default : undefined;
	};
	const typeOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.type : undefined;
	};

	it('紫微多选运限字段默认 [] / 文本默认 ""（守「默认即现状」）', ()=>{
		expect(defOf('ziwei', 'daxianSel')).toEqual([]);
		expect(typeOf('ziwei', 'daxianSel')).toBe('multiselect');
		expect(defOf('ziwei', 'liuyueSel')).toEqual([]);
		expect(defOf('ziwei', 'liuriSel')).toEqual([]);
		expect(defOf('ziwei', 'liushiSel')).toEqual([]);
		// 流年是开放年份 → 文本逗号列表，默认空串。
		expect(defOf('ziwei', 'liunianSel')).toBe('');
		expect(typeOf('ziwei', 'liunianSel')).toBe('text');
	});

	it('八字多选运限字段默认 [] / 文本默认 ""', ()=>{
		expect(defOf('bazi', 'liuyueSel')).toEqual([]);
		expect(defOf('bazi', 'liuriSel')).toEqual([]);
		expect(defOf('bazi', 'liushiSel')).toEqual([]);
		expect(defOf('bazi', 'liunianSel')).toBe('');
	});

	it('getTechniqueSettingsDefaults 数组默认返回新副本（防共享引用被污染）', ()=>{
		const a = getTechniqueSettingsDefaults('ziwei');
		const b = getTechniqueSettingsDefaults('ziwei');
		expect(a.daxianSel).toEqual([]);
		expect(a.daxianSel).not.toBe(b.daxianSel); // 不同引用
		a.daxianSel.push(99); // 改一份不应影响 schema/另一份
		expect(getTechniqueSettingsDefaults('ziwei').daxianSel).toEqual([]);
	});

	it('紫微/八字 全默认 options → prune 为空（多段不挂 = 现状）', ()=>{
		expect(pruneOptionsToNonDefault('ziwei', getTechniqueSettingsDefaults('ziwei'))).toEqual({});
		expect(pruneOptionsToNonDefault('bazi', getTechniqueSettingsDefaults('bazi'))).toEqual({});
	});

	it('选多个 → prune 保留该多选数组；空数组等价默认 → 剪掉', ()=>{
		expect(pruneOptionsToNonDefault('ziwei', { daxianSel: [2, 8] })).toEqual({ daxianSel: [2, 8] });
		expect(pruneOptionsToNonDefault('ziwei', { liuyueSel: [3, 6] })).toEqual({ liuyueSel: [3, 6] });
		expect(pruneOptionsToNonDefault('ziwei', { daxianSel: [] })).toEqual({});
		expect(pruneOptionsToNonDefault('bazi', { liushiSel: [0, 6, 11] })).toEqual({ liushiSel: [0, 6, 11] });
		expect(pruneOptionsToNonDefault('bazi', { liuyueSel: [] })).toEqual({});
	});

	it('数组 prune 顺序无关：[8,2] 与 [2,8] 都视为非默认且彼此 prune 结果等价（不误判）', ()=>{
		const p1 = pruneOptionsToNonDefault('ziwei', { daxianSel: [8, 2] });
		const p2 = pruneOptionsToNonDefault('ziwei', { daxianSel: [2, 8] });
		// 都保留（非空 ≠ 默认空）。
		expect(p1.daxianSel).toBeDefined();
		expect(p2.daxianSel).toBeDefined();
		// 排序后等价（证明比较是顺序无关的）。
		expect([...p1.daxianSel].sort()).toEqual([...p2.daxianSel].sort());
	});

	it('文本年份列表（liunianSel）：逗号串非空 → 保留；空串 → 剪掉', ()=>{
		expect(pruneOptionsToNonDefault('ziwei', { liunianSel: '1996,2000' })).toEqual({ liunianSel: '1996,2000' });
		expect(pruneOptionsToNonDefault('ziwei', { liunianSel: '' })).toEqual({});
	});

	it('mergeOptionsIntoRecord：多选数组写进 record.*（A 类生效前提）', ()=>{
		const m = mergeOptionsIntoRecord({ cid: 'c1' }, 'ziwei', { daxianSel: [2, 8], liuyueSel: [3] });
		expect(m.daxianSel).toEqual([2, 8]);
		expect(m.liuyueSel).toEqual([3]);
		expect(m.cid).toBe('c1');
	});
});

describe('批B P4 推运 datetime 优雅化 + 区间扫描', ()=>{
	const defOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.default : undefined;
	};
	const typeOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.type : undefined;
	};
	const hasField = (key, name)=>!!getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);

	it('目标时刻型5法 + planetaryarc：datetime 字段 type 已是 datetime（default 仍 ""）', ()=>{
		['profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear'].forEach((k)=>{
			expect(typeOf(k, 'datetime')).toBe('datetime');
			expect(defOf(k, 'datetime')).toBe('');
		});
		expect(typeOf('planetaryarc', 'targetDatetime')).toBe('datetime');
		expect(defOf('planetaryarc', 'targetDatetime')).toBe('');
	});

	it('vedicprog/jaynesprog：targetDate=date 型 / targetTime=time 型（default 仍 ""）', ()=>{
		['vedicprog', 'jaynesprog'].forEach((k)=>{
			expect(typeOf(k, 'targetDate')).toBe('date');
			expect(typeOf(k, 'targetTime')).toBe('time');
			expect(defOf(k, 'targetDate')).toBe('');
			expect(defOf(k, 'targetTime')).toBe('');
		});
	});

	it('区间扫描字段 datetimeEnd + scanStep 加入各 datetime 型技法，default 全空（守「默认即现状」=单点）', ()=>{
		['profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'planetaryarc', 'vedicprog', 'jaynesprog'].forEach((k)=>{
			expect(hasField(k, 'datetimeEnd')).toBe(true);
			expect(hasField(k, 'scanStep')).toBe(true);
			expect(defOf(k, 'datetimeEnd')).toBe('');
			expect(defOf(k, 'scanStep')).toBe('');
		});
		// scanStep 是 select（关闭/年/月/日 4 选项），datetimeEnd 在 datetime 型走 datetime picker、date 型走 date picker。
		expect(typeOf('profection', 'scanStep')).toBe('select');
		expect(typeOf('profection', 'datetimeEnd')).toBe('datetime');
		expect(typeOf('vedicprog', 'datetimeEnd')).toBe('date');
	});

	it('round-trip 现状：区间扫描默认空 → prune 后为空（单点=现状，字节级一致）', ()=>{
		['profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'planetaryarc', 'vedicprog', 'jaynesprog'].forEach((k)=>{
			expect(pruneOptionsToNonDefault(k, getTechniqueSettingsDefaults(k))).toEqual({});
		});
		// 单独喂空区间扫描字段也 prune 为空（不会误挂多段）。
		expect(pruneOptionsToNonDefault('profection', { datetimeEnd: '', scanStep: '' })).toEqual({});
	});

	it('round-trip 改区间：datetimeEnd/scanStep 非默认 → prune 保留（真能驱动多段扫描）', ()=>{
		expect(pruneOptionsToNonDefault('profection', { scanStep: 'm' })).toEqual({ scanStep: 'm' });
		expect(pruneOptionsToNonDefault('planetaryarc', { datetimeEnd: '2030-01-01 12:00', scanStep: 'y' }))
			.toEqual({ datetimeEnd: '2030-01-01 12:00', scanStep: 'y' });
		expect(pruneOptionsToNonDefault('vedicprog', { datetimeEnd: '2030-01-01', scanStep: 'd' }))
			.toEqual({ datetimeEnd: '2030-01-01', scanStep: 'd' });
	});
});

describe('批B P5 主限法 盘/表格 字段拆分', ()=>{
	const defOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.default : undefined;
	};
	const typeOf = (key, name)=>{
		const f = getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);
		return f ? f.type : undefined;
	};
	const hasField = (key, name)=>!!getTechniqueSettingsSchema(key).fields.find((x)=>x.name === name);

	it('主限法·表格 primarydirect：有 pdYears(默认100) / 无 datetime（年限范围非单一时刻）', ()=>{
		expect(hasField('primarydirect', 'pdYears')).toBe(true);
		expect(defOf('primarydirect', 'pdYears')).toBe(100);
		expect(hasField('primarydirect', 'datetime')).toBe(false);
		// 方位法/度数换算保留。
		expect(hasField('primarydirect', 'pdMethod')).toBe(true);
		expect(hasField('primarydirect', 'pdTimeKey')).toBe(true);
	});

	it('主限法·盘 primarydirchart：有 datetime(type datetime,默认"") / 无 pdYears；含向运方向 direction', ()=>{
		expect(hasField('primarydirchart', 'datetime')).toBe(true);
		expect(typeOf('primarydirchart', 'datetime')).toBe('datetime');
		expect(defOf('primarydirchart', 'datetime')).toBe('');
		expect(hasField('primarydirchart', 'pdYears')).toBe(false);
		// 拆分后盘有独立的「向运方向」(direct 默认/converse)。
		expect(defOf('primarydirchart', 'direction')).toBe('direct');
		expect(hasField('primarydirchart', 'pdMethod')).toBe(true);
		expect(hasField('primarydirchart', 'pdTimeKey')).toBe(true);
	});

	it('round-trip 现状：盘/表格默认 options → prune 后均为空（默认即现状）', ()=>{
		expect(pruneOptionsToNonDefault('primarydirect', getTechniqueSettingsDefaults('primarydirect'))).toEqual({});
		expect(pruneOptionsToNonDefault('primarydirchart', getTechniqueSettingsDefaults('primarydirchart'))).toEqual({});
	});

	it('round-trip 改值：盘 datetime/direction 非默认 → prune 保留；表格 pdYears 非默认 → prune 保留', ()=>{
		expect(pruneOptionsToNonDefault('primarydirchart', { datetime: '2025-06-05 10:00', direction: 'converse' }))
			.toEqual({ datetime: '2025-06-05 10:00', direction: 'converse' });
		expect(pruneOptionsToNonDefault('primarydirect', { pdYears: 50 })).toEqual({ pdYears: 50 });
	});
});

describe('C 类挂载覆盖快照/还原（防一次覆盖永久改写全局设置）', ()=>{
	it('apply → restore 后全局 key 回到先前值,原本不存在的 key 被删除', ()=>{
		// 先置场景:lifeMode 有用户自定值,nodeMode 不存在
		window.localStorage.setItem('horosaGuolaoLifeMode', 'yumao');
		window.localStorage.removeItem('horosaGuolaoNodeMode');
		window.localStorage.removeItem('horosaGuolaoSu28Mode');
		const snap = snapshotLocalStorageSettings('guolao');
		// 施加非默认覆盖(会写 3 个全局 key)
		applyLocalStorageSettings('guolao', { lifeMode: 'cotrans', nodeMode: 'northRahuSouthKetu', su28Mode: 4 });
		expect(window.localStorage.getItem('horosaGuolaoLifeMode')).toBe('cotrans');
		expect(window.localStorage.getItem('horosaGuolaoNodeMode')).toBe('northRahuSouthKetu');
		// 还原:已有值回原值,原本不存在的回到不存在(null)
		restoreLocalStorageSettings(snap);
		expect(window.localStorage.getItem('horosaGuolaoLifeMode')).toBe('yumao');
		expect(window.localStorage.getItem('horosaGuolaoNodeMode')).toBeNull();
		expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).toBeNull();
	});

	it('snapshot 对非 localStorage 技法返回 null,restore(null) 安全无操作', ()=>{
		expect(snapshotLocalStorageSettings('ziwei')).toBeNull();
		expect(()=>restoreLocalStorageSettings(null)).not.toThrow();
	});
});

describe('R3 挂载大修覆盖面锁(2026-07-30)', ()=>{
	it('金口诀合占镜像 === JinKouCalc 源常量(内联断循环导入,漂移即红)', ()=>{
		// eslint-disable-next-line global-require
		const { JINKOU_HEZHAN_FOCUS, JINKOU_HEZHAN_TIME } = require('../../components/jinkou/JinKouCalc');
		const ask = getTechniqueSettingsSchema('jinkou').fields.find((f)=>f.name === 'askKey');
		expect(ask.options.slice(1)).toEqual(Object.keys(JINKOU_HEZHAN_FOCUS).map((k)=>({ value: k, label: JINKOU_HEZHAN_FOCUS[k].label })));
		const ts = getTechniqueSettingsSchema('jinkou').fields.find((f)=>f.name === 'timeScope');
		expect(ts.options).toEqual(Object.keys(JINKOU_HEZHAN_TIME).map((k)=>({ value: k, label: JINKOU_HEZHAN_TIME[k].label })));
	});

	it('六爻:payload(liuyaoSettings) 23 键判读层;起卦输入/纯显示五键绝不入齿轮', ()=>{
		const sc = getTechniqueSettingsSchema('sixyao');
		expect(sc.kind).toBe('payload');
		expect(sc.optionsPath).toBe('liuyaoSettings');
		const names = sc.fields.map((f)=>f.name);
		['school', 'askType', 'yongOverride', 'tuChangsheng', 'bianyaoScope', 'fushen', 'yuepoMode', 'shishen',
			'jinTuiTu', 'tianshiSchool', 'yearBoundary', 'benming', 'guashen', 'sixGods', 'yuqi', 'yingqi',
			'doctrine', 'gufa', 'yueLiushen', 'shenshaOn', 'shenshaBase', 'shenshaSet', 'shenshaExOn']
			.forEach((k)=>expect(names).toContain(k));
		// 起卦输入(coinFace)/装卦行序(writeDir)/中栏页签(biangua)/纯显示(changshengUse/changshengYinYang)恒不入。
		['coinFace', 'writeDir', 'biangua', 'changshengUse', 'changshengYinYang'].forEach((k)=>expect(names).not.toContain(k));
	});
	it('地占/塔罗:payload 判读轴;种子/牌阵/问句(可伪造新卦面)绝不入齿轮', ()=>{
		['geomancy', 'tarot'].forEach((k)=>{
			const sc = getTechniqueSettingsSchema(k);
			expect(sc.kind).toBe('payload');
			expect(sc.optionsPath).toBe('options');
			const names = sc.fields.map((f)=>f.name);
			['seed', 'seedMode', 'question', 'deckId', 'spreadType'].forEach((bad)=>expect(names).not.toContain(bad));
		});
	});
	it('卜卦/择日:hp_/ep_ 扁平键与 SPEC 单源等长(漏一键=判读参数在挂载里蒸发)', ()=>{
		const h = getTechniqueSettingsSchema('horary').fields.filter((f)=>f.name.indexOf('hp_') === 0);
		expect(h.length).toBeGreaterThanOrEqual(20);   // HORARY_PARAM_SPEC scope='horary' 现 22 键
		h.forEach((f)=>expect(`${f.default}`).toBe(''));  // 恒 '' = 随流派(prune 剪掉零回归)
		const e = getTechniqueSettingsSchema('election').fields.filter((f)=>f.name.indexOf('ep_') === 0);
		expect(e.length).toBeGreaterThanOrEqual(13);
		e.forEach((f)=>expect(`${f.default}`).toBe(''));
	});
	it('奇门:sex/chartCategory 在位(命式:undefined 病灶),jieQiType 三重死项不复活', ()=>{
		const names = getTechniqueSettingsSchema('qimen').fields.map((f)=>f.name);
		expect(names).toContain('sex');
		expect(names).toContain('chartCategory');
		expect(names).not.toContain('jieQiType');
	});
	it('太乙流派六轴/通书 event+mingYear(zuoShan 幽灵不复活)/皇极 historyYear', ()=>{
		const ty = getTechniqueSettingsSchema('taiyi').fields.map((f)=>f.name);
		['school_jishen', 'school_wenchang', 'school_keJianChen', 'school_sanji', 'school_youshen', 'school_shijiCoord']
			.forEach((k)=>expect(ty).toContain(k));
		const tsu = getTechniqueSettingsSchema('tongshu').fields.map((f)=>f.name);
		expect(tsu).toContain('event');
		expect(tsu).toContain('mingYear');
		expect(tsu).not.toContain('zuoShan');
		expect(getTechniqueSettingsSchema('huangji').fields.map((f)=>f.name)).toContain('historyYear');
	});
	it('kinastro 族:齿轮全为哨兵默认(prune 后空 = 无头 payload 不带键 = 现状零回归)', ()=>{
		['xianqin', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi'].forEach((k)=>{
			const sc = getTechniqueSettingsSchema(k);
			expect(sc.kind).toBe('record');
			expect(sc.fields.length).toBeGreaterThan(0);
			expect(pruneOptionsToNonDefault(k, getTechniqueSettingsDefaults(k))).toEqual({});
		});
		// qizhengkin:挂载 route 消费面未实证 → 有意空集(接线前不放无效选项)。
		expect(getTechniqueSettingsSchema('qizhengkin').fields.length).toBe(0);
	});
	it('量化盘/七政显示三键/紫微小限顺逆:齿轮在位且默认即现状', ()=>{
		expect(getTechniqueSettingsSchema('babylon').fields.map((f)=>f.name)).toEqual(
			['babylonScheme', 'babylonEphemerisSource', 'babylonSolstice', 'babylonEra']);
		expect(pruneOptionsToNonDefault('babylon', getTechniqueSettingsDefaults('babylon'))).toEqual({});
		const gl = getTechniqueSettingsSchema('guolao').fields.map((f)=>f.name);
		['guolaoLifeMasterMode', 'guolaoMinorLimitType', 'guolaoTongxianBase'].forEach((k)=>expect(gl).toContain(k));
		expect(getTechniqueSettingsSchema('ziwei').fields.map((f)=>f.name)).toContain('ziweiXiaoxianYinyang');
		expect(pruneOptionsToNonDefault('ziwei', getTechniqueSettingsDefaults('ziwei'))).toEqual({});
	});
	it('astrochart:古典 10 键+geminiBoundEmended+lotsDocReverse 在位;PD 界系标签与 chart 单源(莉莉界绝迹)', ()=>{
		const an = getTechniqueSettingsSchema('astrochart').fields.map((f)=>f.name);
		['houseCuspAdvance', 'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter',
			'fixedStarOrb', 'fixedStarOrbMode', 'antisciaOrb', 'viaCombustaVariant', 'geminiBoundEmended', 'lotsDocReverse']
			.forEach((k)=>expect(an).toContain(k));
		expect(an).not.toContain('timeAlg');
		const pd = getTechniqueSettingsSchema('primarydirect').fields.find((f)=>f.name === 'termsVariant');
		expect(pd.options.map((o)=>o.label).join('')).not.toContain('莉莉');
		expect(pd.options.length).toBe(4);   // 含迦勒底(与 BOUNDS_SYSTEM_OPTIONS 单源)
	});
});

describe('挂载审计条目', ()=>{
	it('supportsMountSettings 与 schema 一致', ()=>{
		expect(getMountableTechniqueAuditEntry('astrochart').supportsMountSettings).toBe(true);
		expect(getMountableTechniqueAuditEntry('qimen').supportsMountSettings).toBe(true);
		expect(getMountableTechniqueAuditEntry('guolao').supportsMountSettings).toBe(true);
		expect(getMountableTechniqueAuditEntry('sixyao').supportsMountSettings).toBe(true); // 判读层 23 键(卦恒冻结)
		// 纯推运空 schema(参数固定=现状)→ 无可调项。
		expect(getMountableTechniqueAuditEntry('firdaria').supportsMountSettings).toBe(false);
		expect(getMountableTechniqueAuditEntry('firdaria').kind).toBe('record');
	});
});

// tongshu 齿轮 → payload.tongshu(此前 aiAnalysisContext 读点 {...defaults,...p.tongshu} 无任何写入方)
describe('tongshu optionsPath 嵌套命名空间', ()=>{
	const { mergeOptionsIntoPayload, getTechniqueSettingsSchema } = require('../techniqueMountSettings');
	it('齿轮值写进 payload.tongshu.<name>,与 regenerate 读点同构;默认值被剪除', ()=>{
		const out = mergeOptionsIntoPayload({ some: 1 }, 'tongshu', { school: 'wutu', liexiuUse: '建宅', event: '安葬', mingYear: '甲子' });
		expect(out.some).toBe(1);
		// liexiuUse=默认被 prune;mingYear=默认(甲子)同剪;event 非默认保留。
		// zuoShan 已从 schema 删除(无流派声明 needs、builder 全文不消费的双重幽灵) —— 不得再出现。
		expect(out.tongshu).toEqual({ school: 'wutu', event: '安葬' });
	});
	it('全默认 → payload 原样(不产生空 tongshu 命名空间)', ()=>{
		const out = mergeOptionsIntoPayload({ a: 1 }, 'tongshu', { school: 'donggong' });
		expect(out).toEqual({ a: 1 });
	});
	it('huangli schema 在位且为 sectionsOnly;astrochart 埃及七键入组', ()=>{
		expect(getTechniqueSettingsSchema('huangli').kind).toBe('sectionsOnly');
		const astro = getTechniqueSettingsSchema('astrochart');
		const names = astro.fields.map((f)=>f.name);
		['egypt_decanRuler','egypt_decanAnchor','egypt_decanNaming','egypt_starClock','egypt_calendarAnchor','egypt_petosirisMod','egypt_godEdition']
			.forEach((k)=>expect(names).toContain(k));
	});
});
