jest.mock('../helper', ()=>({
	randomStr: ()=> 'chart-seq-1',
}));

import {
	DEFAULT_PD_TYPE,
	PD_SYNC_REV,
	SUPPORTED_PD_METHODS,
	SUPPORTED_PD_TIME_KEYS,
	mergePrimaryDirectionChartObj,
	normalizePrimaryDirectionSubTabKey,
	normalizePdType,
	pdTypeBaselineNote,
	SUPPORTED_PD_TYPES,
} from '../primaryDirectionSync';

describe('primaryDirectionSync', ()=>{
	test('merges primary direction rows into chart state with synced params', ()=>{
		const chartObj = {
			params: {
				name: 'before',
				pos: 'before pos',
				showPdBounds: 0,
			},
			predictives: {
				firdaria: [{ id: 1 }],
			},
		};
		const next = mergePrimaryDirectionChartObj(chartObj, {
			pdRows: [[1, 'SUN', 'MOON', '', '2000-01-01']],
			showPdBounds: 1,
			pdMethod: 'horosa_legacy',
			pdTimeKey: 'Ptolemy',
			name: 'after',
			pos: 'after pos',
		});

		expect(next.chartId).toBe('chart-seq-1');
		expect(next.params.name).toBe('after');
		expect(next.params.pos).toBe('after pos');
		expect(next.params.showPdBounds).toBe(1);
		expect(next.params.pdtype).toBe(DEFAULT_PD_TYPE);
		expect(next.params.pdMethod).toBe('horosa_legacy');
		expect(next.params.pdTimeKey).toBe('Ptolemy');
		expect(next.params.pdSyncRev).toBe(PD_SYNC_REV);
		expect(next.predictives.primaryDirection).toEqual([[1, 'SUN', 'MOON', '', '2000-01-01']]);
		expect(next.predictives.firdaria).toEqual([{ id: 1 }]);
	});

	test('keeps valid direction sub tabs and falls back only for invalid keys', ()=>{
		expect(normalizePrimaryDirectionSubTabKey('primarydirchart')).toBe('primarydirchart');
		// WS-3 主限天球:三件套登记之 jest 枚举断言(缺登=tab 键被吞回 primarydirect)。
		expect(normalizePrimaryDirectionSubTabKey('primarydirsphere')).toBe('primarydirsphere');
		expect(normalizePrimaryDirectionSubTabKey('firdaria')).toBe('firdaria');
		expect(normalizePrimaryDirectionSubTabKey('unexpected')).toBe('primarydirect');
	});

	test('PD_SYNC_REV 现值 v15 (pd3d 扩展点 points/circles 扩形 → 升盐防 Java paramhash 脏缓存)', ()=>{
		expect(PD_SYNC_REV).toBe('pd_method_sync_v26');
	});

	test('SUPPORTED_PD_METHODS covers 默认+legacy+pd_engine 四法 + 主限法改进新增方位法', ()=>{
		['core_alchabitius', 'horosa_legacy', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
			'meridian', 'porphyry', 'equal_ecliptic', 'equal_hour_circle',
			'morinus', 'in_zodiaco_lon', 'in_zodiaco_abs']
			.forEach((m)=>{ expect(SUPPORTED_PD_METHODS).toContain(m); });
	});

	test('SUPPORTED_PD_TIME_KEYS 含 Ptolemy/Naibod/TrueSolarArc + 静态常数钥匙,全为公式/真算法,无拟合', ()=>{
		['Ptolemy', 'Naibod', 'TrueSolarArc', 'Cardano', 'Umar', 'Wollner', 'Plantiko',
			'Simmonite', 'SynodicYear', 'Kepler', 'Brahe', 'SymbolicDegree', 'SymbolicYear',
			'SymbolicMoon', 'SymbolicMonth', 'Quarterly', 'Quinary', 'Duodenary', 'Novenary', 'SelfMeasure']
			.forEach((k)=>{ expect(SUPPORTED_PD_TIME_KEYS).toContain(k); });
	});

	test('mergePrimaryDirectionChartObj writes new placidus method into params (P0 white-list extension)', ()=>{
		const chartObj = { params: {}, predictives: {} };
		const next = mergePrimaryDirectionChartObj(chartObj, {
			pdRows: [],
			pdMethod: 'placidus',
			pdTimeKey: 'Naibod',
		});
		expect(next.params.pdMethod).toBe('placidus');
		expect(next.params.pdTimeKey).toBe('Naibod');
	});

	test('mergePrimaryDirectionChartObj persists v10 进阶开关 (方向类型/顺逆/映点/界)', ()=>{
		const chartObj = { params: {}, predictives: {} };
		const next = mergePrimaryDirectionChartObj(chartObj, {
			pdRows: [],
			pdMethod: 'regiomontanus',
			pdTimeKey: 'TrueSolarArc',
			pdtype: 1,
			pdDirect: 1,
			pdConverse: 1,
			pdAntiscia: 1,
			pdTerms: 0,
		});
		expect(next.params.pdtype).toBe(1);
		expect(next.params.pdDirect).toBe(1);
		expect(next.params.pdConverse).toBe(1);
		expect(next.params.pdAntiscia).toBe(1);
		expect(next.params.pdTerms).toBe(0);
	});

	test('mergePrimaryDirectionChartObj 顺逆默认都开:pdDirect/pdConverse 未传落库 1,显式 0 才关', ()=>{
		const on = mergePrimaryDirectionChartObj({ params: {}, predictives: {} }, { pdRows: [] });
		expect(on.params.pdDirect).toBe(1);
		expect(on.params.pdConverse).toBe(1);
		const off = mergePrimaryDirectionChartObj({ params: {}, predictives: {} }, { pdRows: [], pdDirect: 0, pdConverse: 0 });
		expect(off.params.pdDirect).toBe(0);
		expect(off.params.pdConverse).toBe(0);
	});

	test('方向类型三值:0 / 1 / 4 原样保留,其余(含后端内部 2 / 3、空、坏值)回落默认', ()=>{
		expect(SUPPORTED_PD_TYPES).toEqual([0, 1, 4]);
		[0, 1, 4].forEach((v)=>{
			expect(normalizePdType(v)).toBe(v);
			expect(normalizePdType(String(v))).toBe(v);
		});
		[2, 3, 5, -1, null, undefined, '', 'x', NaN].forEach((v)=>expect(normalizePdType(v)).toBe(DEFAULT_PD_TYPE));
		expect(mergePrimaryDirectionChartObj({}, { pdtype: 4 }).params.pdtype).toBe(4);
		expect(mergePrimaryDirectionChartObj({}, { pdtype: 2 }).params.pdtype).toBe(DEFAULT_PD_TYPE);
	});

	test('走核内基线的注记:世俗 / Field Plane 下只给没有专属实现的组合', ()=>{
		expect(pdTypeBaselineNote(0, 'zodiacal', 'alcabitius')).toBe('');
		expect(pdTypeBaselineNote(1, 'ptolemy', 'alcabitius')).toBe('');
		expect(pdTypeBaselineNote(1, 'ptolemy', 'meridian')).toBe('');
		expect(pdTypeBaselineNote(1, 'placidus', 'placidus')).toBe('');
		expect(pdTypeBaselineNote(1, 'morinus', 'morinus')).toBe('');
		expect(pdTypeBaselineNote(1, 'ptolemy', 'porphyry')).toContain('核内基线');
		expect(pdTypeBaselineNote(1, 'zodiacal', 'alcabitius')).toContain('核内基线');
		expect(pdTypeBaselineNote(4, 'placidus', 'placidus')).toBe('');
		expect(pdTypeBaselineNote(4, 'topocentric', 'topocentric')).toContain('Field Plane');
	});
});

describe('主限法设置项登记表', () => {
	const {
		PD_EXTRA_SETTING_SPECS, PD_EXTRA_SETTING_KEYS, pickPdExtraSettings, pdExtraRequestParams,
		pdExtraSettingsKey, pdExtraSettingLines, mergePrimaryDirectionChartObj,
	} = require('../primaryDirectionSync');

	it('缺省值与后端解析一致', () => {
		expect(PD_EXTRA_SETTING_KEYS).toEqual(['pdGeometry', 'pdAspectSide', 'pdTradConverse', 'pdIgnoreSigLat', 'pdIgnorePromLat', 'pdLunarParallax', 'pdTruePosition', 'pdSolarArcRegressive', 'pdYearDays', 'pdPromAspectLat']);
		expect(pickPdExtraSettings()).toEqual({ pdGeometry: 'improved', pdAspectSide: 0, pdTradConverse: 1, pdIgnoreSigLat: 0, pdIgnorePromLat: 0, pdLunarParallax: 0, pdTruePosition: 0, pdSolarArcRegressive: 0, pdYearDays: 0, pdPromAspectLat: 0 });
	});

	it('归一:传统逆向只有显式关才关;相位侧非法回缺省;多来源取第一个有值的', () => {
		expect(pickPdExtraSettings({ pdTradConverse: '0' }).pdTradConverse).toBe(0);
		expect(pickPdExtraSettings({ pdTradConverse: 'x' }).pdTradConverse).toBe(1);
		expect(pickPdExtraSettings({ pdAspectSide: '2' }).pdAspectSide).toBe(2);
		expect(pickPdExtraSettings({ pdAspectSide: 7 }).pdAspectSide).toBe(0);
		expect(pickPdExtraSettings({ pdLunarParallax: null }, { pdLunarParallax: 1 }).pdLunarParallax).toBe(1);
		expect(pickPdExtraSettings({ pdGeometry: 'classic' }).pdGeometry).toBe('classic');
		expect(pickPdExtraSettings({ pdGeometry: 'other' }).pdGeometry).toBe('improved');
		expect(pickPdExtraSettings({ pdYearDays: '1' }).pdYearDays).toBe(1);
		expect(pickPdExtraSettings({ pdYearDays: 3 }).pdYearDays).toBe(0);
		expect(pickPdExtraSettings({ pdPromAspectLat: '2' }).pdPromAspectLat).toBe(2);
		expect(pickPdExtraSettings({ pdPromAspectLat: 4 }).pdPromAspectLat).toBe(4);
		expect(pickPdExtraSettings({ pdPromAspectLat: 9 }).pdPromAspectLat).toBe(0);
		// 只发非缺省:缺省请求体不变(缓存键零回归)
		expect(pdExtraRequestParams({ pdPromAspectLat: 0 }).pdPromAspectLat).toBeUndefined();
		expect(pdExtraRequestParams({ pdPromAspectLat: 3 }).pdPromAspectLat).toBe(3);
	});

	it('主限法盘只带「日期 → 年」用得到的两项(只发非缺省)', () => {
		const { pdChartDateRequestParams, PD_CHART_DATE_SETTING_KEYS } = require('../primaryDirectionSync');
		expect(PD_CHART_DATE_SETTING_KEYS.every((k)=>PD_EXTRA_SETTING_KEYS.indexOf(k) >= 0)).toBe(true);
		expect(pdChartDateRequestParams({})).toEqual({});
		expect(pdChartDateRequestParams({ pdYearDays: 0, pdTruePosition: 1, pdAspectSide: 2 })).toEqual({});
		expect(pdChartDateRequestParams({ pdYearDays: 1, pdSolarArcRegressive: 1, pdTradConverse: 0 })).toEqual({ pdYearDays: 1, pdSolarArcRegressive: 1 });
		// 多来源:本盘参数优先,缺了取页面传入的扩展设置
		expect(pdChartDateRequestParams({}, { pdYearDays: 1 })).toEqual({ pdYearDays: 1 });
		expect(pdChartDateRequestParams({ pdYearDays: 0 }, { pdYearDays: 1 })).toEqual({});
	});

	it('请求只发与缺省不同的值(缺省请求体不变)', () => {
		expect(pdExtraRequestParams({})).toEqual({});
		expect(pdExtraRequestParams({ pdTradConverse: 1, pdAspectSide: 0 })).toEqual({});
		expect(pdExtraRequestParams({ pdTradConverse: 0, pdTruePosition: true })).toEqual({ pdTradConverse: 0, pdTruePosition: 1 });
		expect(pdExtraRequestParams({ pdGeometry: 'classic' })).toEqual({ pdGeometry: 'classic' });
	});

	it('比对键随任一项变化', () => {
		const base = pdExtraSettingsKey({});
		PD_EXTRA_SETTING_SPECS.forEach((spec) => {
			const flipped = spec.type === 'switch' ? (spec.default ? 0 : 1) : spec.options[1].value;
			expect(pdExtraSettingsKey({ [spec.key]: flipped })).not.toBe(base);
		});
	});

	it('自陈行逐项列出', () => {
		const lines = pdExtraSettingLines({ pdAspectSide: 1, pdTradConverse: 0 });
		expect(lines).toContain('相位侧：只出右旋');
		expect(lines).toContain('传统逆向：否');
		// 几何口径并进「弧算法」那一行,不另起一行
		expect(lines.length).toBe(PD_EXTRA_SETTING_SPECS.filter((spec)=>!spec.inProjection).length);
		expect(lines.some((l)=>l.indexOf('几何口径') === 0)).toBe(false);
	});

	it('落库:传了才落全套,未传保旧', () => {
		const a = mergePrimaryDirectionChartObj({ params: { pdLunarParallax: 1 } }, { pdRows: [] });
		expect(a.params.pdLunarParallax).toBe(1);
		const b = mergePrimaryDirectionChartObj({ params: { pdLunarParallax: 1 } }, { pdRows: [], pdExtra: { pdLunarParallax: 0 } });
		expect(b.params.pdLunarParallax).toBe(0);
		expect(b.params.pdTradConverse).toBe(1);
	});
});

describe('主限法设置项登记表 × 后端同名同序', () => {
	const fs = require('fs');
	const path = require('path');
	const { PD_EXTRA_SETTING_KEYS } = require('../primaryDirectionSync');
	const web = path.resolve(__dirname, '../../../..');
	const quoted = (text) => (text.match(/["']([A-Za-z]+)["']/g) || []).map((q) => q.slice(1, -1));

	it('Python 排盘模块的 PD_EXTRA_SETTING_KEYS', () => {
		// 按定义处找文件(只许一处定义),不写死模块文件名
		const dir = path.join(web, 'astropy/astrostudy');
		const hits = fs.readdirSync(dir).filter((f) => f.endsWith('.py'))
			.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).filter((t) => /^PD_EXTRA_SETTING_KEYS = \(/m.test(t));
		expect(hits.length).toBe(1);
		const m = hits[0].match(/PD_EXTRA_SETTING_KEYS = \(([\s\S]*?)\)/);
		expect(m).toBeTruthy();
		expect(quoted(m[1])).toEqual(PD_EXTRA_SETTING_KEYS);
	});

	it('Java PdWire.SETTING_KEYS', () => {
		const src = fs.readFileSync(path.join(web, 'astrostudysrv/basecomm/src/main/java/spacex/basecomm/constants/PdWire.java'), 'utf8');
		const m = src.match(/SETTING_KEYS = new String\[\] \{([\s\S]*?)\};/);
		expect(m).toBeTruthy();
		expect(quoted(m[1])).toEqual(PD_EXTRA_SETTING_KEYS);
	});
});
