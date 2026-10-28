// 宿占「人事十二宫起宫」纳入新盘种子(唯一来源;旧偏好 suzhanHouseStartMode 一次性并入、之后只作镜像):
// 新盘读种子;亲手改记种子(只读嵌入不记);载入事盘不写偏好;存盘恒带这个键;旧记录缺键按当时的偏好(并入时冻结)理解。
require('../../models/astro');
const seeds = require('../newChartSeeds');
const { fieldsSchemaBaseline, applyRecordToFields, captureNonDefaultTechniqueFields, markFieldsCaptured } = require('../recordFieldsRestore');

beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

test('🔴 旧偏好是上升 → 首读并入种子,新盘按上升;之后亲手改以种子为准', ()=>{
	window.localStorage.setItem('suzhanHouseStartMode', '1');
	expect(fieldsSchemaBaseline().houseStartMode.value).toBe(1);
	seeds.recordNewChartSeeds({ houseStartMode: 0 });
	expect(fieldsSchemaBaseline().houseStartMode.value).toBe(0);
});

test('🔴 存盘恒带这个键(八字起宫 = 内建默认也带);载入:带键按记录,旧记录缺键按并入时冻结的旧偏好(之后不随种子漂)', ()=>{
	const f = fieldsSchemaBaseline();
	expect(captureNonDefaultTechniqueFields(f).houseStartMode).toBe(0);
	// 没有旧偏好(= 当时为八字起宫):并入时冻结 0;之后亲手改成上升,旧记录照旧 0
	seeds.recordNewChartSeeds({ houseStartMode: 1 });
	const loadedOld = applyRecordToFields(fieldsSchemaBaseline(), { cid: 'c1', birth: '1990-01-01 08:00:00' });
	expect(loadedOld.houseStartMode.value).toBe(0);
	const loadedOldMarked = applyRecordToFields(fieldsSchemaBaseline(), markFieldsCaptured({ cid: 'c2', birth: '1990-01-01 08:00:00' }));
	expect(loadedOldMarked.houseStartMode.value).toBe(0);
	const loadedNew = applyRecordToFields(fieldsSchemaBaseline(), markFieldsCaptured({ cid: 'c3', birth: '1990-01-01 08:00:00', houseStartMode: 0 }));
	expect(loadedNew.houseStartMode.value).toBe(0);
});

test('🔴 旧偏好是上升时存的旧盘:升级后载入是上升;之后亲手改成八字起宫,同一张旧盘再载入仍是上升(冻结,不随种子漂)', ()=>{
	window.localStorage.setItem('suzhanHouseStartMode', '1');
	const rec = { cid: 'old-asc', birth: '1990-01-01 08:00:00' };
	expect(applyRecordToFields(fieldsSchemaBaseline(), rec).houseStartMode.value).toBe(1);
	seeds.recordNewChartSeeds({ houseStartMode: 0 });
	expect(fieldsSchemaBaseline().houseStartMode.value).toBe(0);
	expect(applyRecordToFields(fieldsSchemaBaseline(), rec).houseStartMode.value).toBe(1);
	expect(applyRecordToFields(fieldsSchemaBaseline(), markFieldsCaptured({ ...rec })).houseStartMode.value).toBe(1);
	expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
});

test('🔴 并入时种子已有值:旧仓镜像同步成种子值(读旧仓的地方与新盘实际用的一致)', ()=>{
	window.localStorage.setItem('horosa.chart.newChartSeeds.v1', JSON.stringify({ values: { doubingSu28: 4, houseStartMode: 1 } }));
	window.localStorage.setItem('horosaGuolaoSu28Mode', '2');
	window.localStorage.setItem('suzhanHouseStartMode', '0');
	expect(seeds.newChartSeedValue('doubingSu28')).toBe(4);
	expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).toBe('4');
	expect(window.localStorage.getItem('suzhanHouseStartMode')).toBe('1');
	// 旧记录缺起宫键 = 当时等于旧偏好(八字起宫)
	expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(0);
});

test('🔴 宿占页亲手改记种子与镜像;只读嵌入(分至页)两样都不写', ()=>{
	const SuZhanInput = require('../../components/suzhan/SuZhanInput').default;
	const mk = (embeddedReadOnly)=>{ const i = new SuZhanInput({ fields: fieldsSchemaBaseline(), embeddedReadOnly, onFieldsChange: ()=>{} }); return i; };
	mk(true).onHouseStartModeChange(1);
	expect(seeds.newChartSeedValue('houseStartMode')).toBe(0);
	expect(window.localStorage.getItem('suzhanHouseStartMode')).toBe(null);
	mk(false).onHouseStartModeChange(1);
	expect(seeds.newChartSeedValue('houseStartMode')).toBe(1);
	expect(window.localStorage.getItem('suzhanHouseStartMode')).toBe('1');
});

test('🔴 载入宿占事盘不写偏好(盘式 / 盘形 / 起宫)', ()=>{
	jest.isolateModules(()=>{
		jest.doMock('../kentangCaseSave', ()=>({ ...jest.requireActual('../kentangCaseSave'), getKentangSavedCasePayload: ()=>({ caseVersion: 9, payload: { options: { szchart: 2, szshape: 1, houseStartMode: 1 } } }) }));
		const SuZhanMain = require('../../components/suzhan/SuZhanMain').default;
		const inst = new SuZhanMain({ fields: fieldsSchemaBaseline(), dispatch: ()=>{} });
		const before = ['suzhanChartType', 'suzhanChartShape', 'suzhanHouseStartMode'].map((k)=>window.localStorage.getItem(k));
		inst.restoreFromCurrentCase(true);
		expect(['suzhanChartType', 'suzhanChartShape', 'suzhanHouseStartMode'].map((k)=>window.localStorage.getItem(k))).toEqual(before);
		expect(seeds.newChartSeedValue('houseStartMode')).toBe(0);
	});
});

test('AI 挂载缺键与页面同口径(并入时冻结的旧偏好,不随种子)', ()=>{
	window.localStorage.setItem('suzhanHouseStartMode', '1');
	seeds.recordNewChartSeeds({ houseStartMode: 0 });
	// AI 的字段构造(七政 / 宿占无头共用 buildFieldObject;resolveGuolaoFields 是它的导出入口)
	const { resolveGuolaoFields } = require('../aiAnalysisContext');
	expect(resolveGuolaoFields({ birth: '1990-01-01 08:00:00', zone: '+08:00', lon: '121e28', lat: '31n14' }).houseStartMode.value).toBe(1);
	expect(resolveGuolaoFields({ birth: '1990-01-01 08:00:00', zone: '+08:00', lon: '121e28', lat: '31n14', houseStartMode: 0 }).houseStartMode.value).toBe(0);
	expect(applyRecordToFields(fieldsSchemaBaseline(), { cid: 'x', birth: '1990-01-01 08:00:00' }).houseStartMode.value).toBe(1);
	const { newChartSeedRecordMissingValue } = seeds;
	expect(newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
	expect(newChartSeedRecordMissingValue('hsys')).toBe(seeds.newChartSeedInternalDefault('hsys'));
});
