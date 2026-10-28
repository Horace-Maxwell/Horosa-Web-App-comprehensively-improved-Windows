// AI 挂载齿轮里几类「随另一项变」的口径,各自与页面 / 后端同义:
// ① 地占换流派预设像页面一样清空传本逐项改写(GeomancyMain 换 tradition 连同 granular:{} 一起落)
// ② 只记亲手改动键的宿主把「随流派」空档选回 = 删键,与没动过同义
// ③ 留空 = 随存档的父档取空时,子项按存档里父档的实值判显隐(生效着的手动子项不藏)
// ④ 宿占:宿法 = 郑氏恒星制时岁差空档 = 郑氏历元(后端如此解),不是随盘,不能剪掉
import * as TMS from '../techniqueMountSettings';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

describe('① 地占换流派清空逐项改写', ()=>{
	const payload = { options: { tradition: 'arabic_raml', readingScope: 'L2', granular: { judgeRule: 'x' } } };
	test('换派 → granular 清空;其余存档口径照旧随档', ()=>{
		const m = TMS.mergeOptionsIntoPayload(payload, 'geomancy', { tradition: 'greek' });
		expect(m.options.tradition).toBe('greek');
		expect(m.options.granular).toEqual({});
		expect(m.options.readingScope).toBe('L2');
	});
	test('不换派(只改别的口径 / 选回存档派)→ granular 原样', ()=>{
		expect(TMS.mergeOptionsIntoPayload(payload, 'geomancy', { readingScope: 'L3' }).options.granular).toEqual({ judgeRule: 'x' });
		expect(TMS.mergeOptionsIntoPayload(payload, 'geomancy', { tradition: 'arabic_raml', readingScope: 'L3' }).options.granular).toEqual({ judgeRule: 'x' });
	});
	test('存档缺流派(= 页面默认古典定局派):选古典定局派不算换派', ()=>{
		const p = { options: { granular: { judgeRule: 'x' } } };
		expect(TMS.mergeOptionsIntoPayload(p, 'geomancy', { tradition: 'european_classical' }).options.granular).toEqual({ judgeRule: 'x' });
		expect(TMS.mergeOptionsIntoPayload(p, 'geomancy', { tradition: 'greek' }).options.granular).toEqual({});
	});
	test('原存档对象不被改写', ()=>{
		TMS.mergeOptionsIntoPayload(payload, 'geomancy', { tradition: 'greek' });
		expect(payload.options.granular).toEqual({ judgeRule: 'x' });
	});
});

describe('② 只记亲手键的宿主:「随流派」空档选回 = 删键', ()=>{
	test('卜卦判读参数 / 择日流派口径:选回空档删键,不存空串', ()=>{
		expect(TMS.recordHandEditedOption('horary', { hp_accidentalMode: 'lilly', topicId: 'love' }, 'hp_accidentalMode', '')).toEqual({ topicId: 'love' });
		expect(TMS.recordHandEditedOption('election', {}, 'ep_orbProfile', '')).toEqual({});
		expect(TMS.recordHandEditedOption('horary', {}, 'hp_accidentalMode', 'lilly')).toEqual({ hp_accidentalMode: 'lilly' });
	});
	test('「随档」空档选回同样删键(它本就不算覆盖);普通字段照旧只滤字段 + 归一', ()=>{
		expect(TMS.recordHandEditedOption('geomancy', { tradition: 'greek' }, 'tradition', '')).toEqual({});
		expect(TMS.recordHandEditedOption('geomancy', {}, 'tradition', 'greek')).toEqual({ tradition: 'greek' });
		expect(TMS.recordHandEditedOption('horary', {}, 'notAField', 1)).toEqual({});
	});
	test('标记只打在「随流派」空档上', ()=>{
		['horary', 'election'].forEach((k)=>{
			TMS.getTechniqueSettingsSchema(k).fields.forEach((f)=>{
				const blank = (f.options || []).find((o)=>o.value === '');
				const follows = !!(blank && /随流派/.test(blank.label));
				expect([k, f.name, !!f.blankMeansFollowSchool]).toEqual([k, f.name, follows]);
			});
		});
	});
});

describe('③ 随存档父档取空:子项按存档里的父档判显隐', ()=>{
	const schema = TMS.getTechniqueSettingsSchema('fendjing');
	const yearStem = schema.fields.find((f)=>f.name === 'yearStem');
	test('父档存的是手动档、草稿选「随盘」:子项照显;不传基线 = 只看草稿(照旧藏)', ()=>{
		const draft = { stemOverride: '', yearStem: '乙' };
		expect(TMS.isMountFieldVisible(yearStem, draft, schema, { stemOverride: 1, yearStem: '甲' })).toBe(true);
		expect(TMS.isMountFieldVisible(yearStem, draft, schema)).toBe(false);
		expect(TMS.isMountFieldVisible(yearStem, draft, schema, { stemOverride: 0 })).toBe(false);
		expect(TMS.isMountFieldVisible(yearStem, draft, schema, { stemOverride: '' })).toBe(false);
	});
	test('剪枝同口径:生效着的手动子项改了留得住(此前被当隐藏剪掉)', ()=>{
		const base = { stemOverride: 1, yearStem: '甲', hourStem: '' };
		expect(TMS.pruneOptionsToNonDefault('fendjing', { stemOverride: '', yearStem: '乙' }, base)).toEqual({ yearStem: '乙' });
		// 父档存的是自动档:子项仍不算
		expect(TMS.pruneOptionsToNonDefault('fendjing', { stemOverride: '', yearStem: '乙' }, { stemOverride: 0 })).toEqual({});
		// 记录里没存这些键(现状):与此前逐字相同
		expect(TMS.pruneOptionsToNonDefault('fendjing', { stemOverride: '', yearStem: '乙' }, {})).toEqual({});
	});
	test('抽屉把盘现状传给字段渲染(源码锚)', ()=>{
		const src = readSource(require('path').join(__dirname, '../../components/aianalysis/AIAnalysisMain.js'));
		expect(src).toContain('baseline={adjustedMountBaseline(key, techniqueSettingsDraft, drawerBaseline)}');
		const tsf = require('fs').readFileSync(require('path').join(__dirname, '../../components/aianalysis/TechniqueSettingsFields.js'), 'utf8');
		expect(tsf).toContain('isMountFieldVisible(field, draft || {}, schema, baseline)');
	});
});

describe('④ 宿占郑氏恒星制下的岁差空档', ()=>{
	const schema = TMS.getTechniqueSettingsSchema('suzhan');
	const ayan = schema.fields.find((f)=>f.name === 'siderealAyanamsa');
	const base = { zodiacal: 1, doubingSu28: 4, siderealAyanamsa: 'raman' };
	test('宿法 = 郑氏恒星制:选空档 = 郑氏(显式覆盖,不被剪);其它宿法照旧随盘', ()=>{
		expect(TMS.pruneOptionsToNonDefault('suzhan', { siderealAyanamsa: '' }, base)).toEqual({ siderealAyanamsa: '' });
		expect(TMS.pruneOptionsToNonDefault('suzhan', { siderealAyanamsa: '' }, { ...base, doubingSu28: 0 })).toEqual({});
		// 草稿里刚把宿法换成郑氏恒星制
		expect(TMS.pruneOptionsToNonDefault('suzhan', { doubingSu28: 4, siderealAyanamsa: '' }, { ...base, doubingSu28: 0 })).toEqual({ doubingSu28: 4, siderealAyanamsa: '' });
		// 盘存的就是郑氏(空):选空档 = 没改
		expect(TMS.pruneOptionsToNonDefault('suzhan', { siderealAyanamsa: '' }, { ...base, siderealAyanamsa: '' })).toEqual({});
	});
	test('空档标签随宿法写明', ()=>{
		const blankLabel = (d)=>TMS.mountFieldOptions(ayan, d, '').find((o)=>o.value === '').label;
		expect(blankLabel({ doubingSu28: 4 })).toMatch(/郑氏/);
		expect(blankLabel({ doubingSu28: 0 })).toMatch(/随盘/);
	});
	test('星盘 / 量化盘共用的岁差字段不受影响(仍是布尔标记)', ()=>{
		expect(TMS.getTechniqueSettingsSchema('astrochart').fields.find((f)=>f.name === 'siderealAyanamsa').blankFollowsBaseline).toBe(true);
		expect(TMS.pruneOptionsToNonDefault('astrochart', { siderealAyanamsa: '' }, { zodiacal: 1, siderealAyanamsa: 'raman' })).toEqual({});
	});
});

describe('⑤ 只记亲手键宿主的函数形空档 / 卜卦流派空串 / 抽屉显隐基准 / AI 设置工具删回不设', ()=>{
	test('宿占岁差空档:显示「随盘」时删键;草稿里宿法 = 黄仪(黄道)·恒星制时照存空串(= 郑氏)', ()=>{
		expect(TMS.recordHandEditedOption('suzhan', { zodiacal: 1, siderealAyanamsa: 'raman' }, 'siderealAyanamsa', '')).toEqual({ zodiacal: 1 });
		expect(TMS.recordHandEditedOption('suzhan', { zodiacal: 1, doubingSu28: 4, siderealAyanamsa: 'raman' }, 'siderealAyanamsa', '')).toEqual({ zodiacal: 1, doubingSu28: 4, siderealAyanamsa: '' });
		const f = TMS.getTechniqueSettingsSchema('suzhan').fields.find((x)=>x.name === 'siderealAyanamsa');
		expect(f.blankHint).toMatch(/郑氏历元/);
	});
	test('卜卦流派空串 / null = 没设:不算换派,不清判读参数,剪枝不留它', ()=>{
		const base = { horarySchool: 'strict', hp_accidentalMode: 'lilly' };
		expect(TMS.pruneOptionsToNonDefault('horary', { horarySchool: '', hp_accidentalMode: 'lilly' }, base)).toEqual({});
		expect(TMS.pruneOptionsToNonDefault('horary', { horarySchool: null, hp_accidentalMode: 'lilly' }, base)).toEqual({});
		expect(TMS.composeTechniqueDraft('horary', base, { horarySchool: '' }).hp_accidentalMode).toBe('lilly');
	});
	test('抽屉显隐基准与剪枝同一份(adjustedMountBaseline)', ()=>{
		const base = { horarySchool: 'classical', hp_accidentalMode: 'classic' };
		expect(TMS.adjustedMountBaseline('horary', { horarySchool: 'strict' }, base).hp_accidentalMode).toBe('');
		expect(TMS.adjustedMountBaseline('horary', {}, base)).toBe(base);
		expect(TMS.adjustedMountBaseline('qimen', { x: 1 }, base)).toBe(base);
	});
});
