// 字段工厂没注册的场合(无头运行):新建入口记下的「新命盘缺省」与桌面(工厂已注册)同一个结果 ——
// 古典全局与新盘种子都按用户设的值随盘记下(此前只打代次标记,无头里 AI 建的盘 / 临时本命源一律按出厂值算)。
// 本文件先在没注册工厂时取一次,再注册「新命盘」字段工厂取一次,逐键对比。
const { recordNewChartSeeds, __resetNewChartSeedsForTest } = require('../newChartSeeds');
const { setClassicalChartGlobal, __resetClassicalGlobalsCacheForTest } = require('../classicalChartGlobals');
const { captureNewChartDefaults, withNewChartDefaults } = require('../newChartCapture');
const { fieldsSchemaBaseline } = require('../recordFieldsRestore');

function setGlobals(){
	window.localStorage.clear();
	__resetNewChartSeedsForTest();
	__resetClassicalGlobalsCacheForTest();
	setClassicalChartGlobal('termsVariant', 1);
	setClassicalChartGlobal('triplicity', 'Ptolemaic');
	setClassicalChartGlobal('westNodeType', 'true');
	recordNewChartSeeds({ hsys: 0, timeAlg: 1, indiaDashaSystem: 'yogini' });
}

test('🔴 无头(工厂未注册)与桌面(工厂已注册)捕获的新命盘缺省逐键相同,且带上用户设的古典全局与种子', ()=>{
	expect(Object.keys(fieldsSchemaBaseline())).toEqual([]);   // 前提:此刻没注册工厂(= 无头)
	setGlobals();
	const headless = captureNewChartDefaults();
	expect(headless.termsVariant).toBe(1);
	expect(headless.triplicity).toBe('Ptolemaic');
	expect(headless.hsys).toBe(0);
	const rec = withNewChartDefaults({ name: '无头建的' }, { forStore: true });
	expect(rec.termsVariant).toBe(1);
	// eslint-disable-next-line global-require
	require('../../models/astro');   // 注册「新命盘」字段工厂(= 桌面)
	expect(Object.keys(fieldsSchemaBaseline()).length).toBeGreaterThan(10);
	setGlobals();
	const desktop = captureNewChartDefaults();
	expect(headless).toEqual(desktop);
});

test('全是出厂值时两边都只带恒落库的键', ()=>{
	window.localStorage.clear();
	__resetNewChartSeedsForTest();
	__resetClassicalGlobalsCacheForTest();
	const { globalsOnlyNewChartFields } = require('../newChartCapture');
	const { captureNonDefaultTechniqueFields } = require('../recordFieldsRestore');
	expect(captureNonDefaultTechniqueFields(globalsOnlyNewChartFields())).toEqual(captureNonDefaultTechniqueFields(fieldsSchemaBaseline()));
});
