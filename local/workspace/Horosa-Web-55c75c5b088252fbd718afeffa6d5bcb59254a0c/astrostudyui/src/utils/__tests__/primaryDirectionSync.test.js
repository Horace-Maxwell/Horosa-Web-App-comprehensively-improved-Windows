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
		expect(PD_SYNC_REV).toBe('pd_method_sync_v15');
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
});
