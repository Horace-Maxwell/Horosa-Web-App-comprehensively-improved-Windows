// 宿盘外盘类 / 盘形:画盘与左栏下拉同源(fields 有值即为准,缺省回落全站单例);
// 分至页等只读内嵌宿盘改外盘 / 盘形 / 人事十二宫起法,不改全站单例、不写本机偏好(只经字段交给宿主)。
import SuZhanInput from '../../components/suzhan/SuZhanInput';
import { szChartSelection } from '../../components/suzhan/SZChart';
import * as SZConst from '../../components/suzhan/SZConst';

const saved = { ...SZConst.SZChart };
afterEach(()=>{ Object.assign(SZConst.SZChart, saved); window.localStorage.clear(); });

function mkInput(props){
	const calls = [];
	const inst = Object.create(SuZhanInput.prototype);
	inst.props = { onFieldsChange: (p)=>calls.push(p), ...props };
	return { inst, calls };
}

describe('宿盘画盘按字段取外盘类 / 盘形', ()=>{
	test('字段优先,缺省回落单例', ()=>{
		SZConst.SZChart.chart = SZConst.SZChart_SignChart;
		SZConst.SZChart.shape = SZConst.SZChart_Square;
		expect(szChartSelection({ szchart: { value: 2 }, szshape: { value: 0 } })).toEqual({ chart: SZConst.SZChart_BaGuaChart, shape: SZConst.SZChart_Circle });
		expect(szChartSelection({ szchart: { value: '6' } })).toEqual({ chart: SZConst.SZChart_FengYeChart, shape: SZConst.SZChart_Square });
		expect(szChartSelection({})).toEqual({ chart: SZConst.SZChart_SignChart, shape: SZConst.SZChart_Square });
		expect(szChartSelection(null)).toEqual({ chart: SZConst.SZChart_SignChart, shape: SZConst.SZChart_Square });
	});

	test('载入存了八卦外盘的事盘后单例被别处冲回偏好:画盘仍按字段(与左栏一致)', ()=>{
		const fields = { szchart: { value: SZConst.SZChart_BaGuaChart } };
		SZConst.SZChart.chart = SZConst.SZChart_SignChart;   // 别处宿盘实例构造期按本机偏好重置
		expect(szChartSelection(fields).chart).toBe(SZConst.SZChart_BaGuaChart);
	});

	test('画盘分支只经 szChartSelection 取值(不再直读单例)', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '../../components/suzhan/SZChart.js'), 'utf8');
		const draw = src.slice(src.indexOf('draw(){'));
		expect(draw).toMatch(/const sel = szChartSelection\(this\.fields\);/);
		expect(draw).not.toMatch(/SZConst\.SZChart\.(chart|shape) ===/);
	});
});

describe('只读内嵌宿盘不改单例与本机偏好', ()=>{
	test('内嵌:外盘 / 盘形 / 起宫只经字段', ()=>{
		SZConst.SZChart.chart = SZConst.SZChart_SignChart;
		SZConst.SZChart.shape = SZConst.SZChart_Circle;
		SZConst.SZChart.houseStartMode = SZConst.SZHouseStart_Bazi;
		const { inst, calls } = mkInput({ embeddedReadOnly: true });
		inst.onChartTypeChange(SZConst.SZChart_BaGuaChart);
		inst.onChartShapeChange(SZConst.SZChart_Square);
		inst.onHouseStartModeChange(SZConst.SZHouseStart_ASC);
		expect(SZConst.SZChart.chart).toBe(SZConst.SZChart_SignChart);
		expect(SZConst.SZChart.shape).toBe(SZConst.SZChart_Circle);
		expect(SZConst.SZChart.houseStartMode).toBe(SZConst.SZHouseStart_Bazi);
		expect(window.localStorage.getItem('suzhanChartType')).toBeNull();
		expect(window.localStorage.getItem('suzhanChartShape')).toBeNull();
		expect(window.localStorage.getItem('suzhanHouseStartMode')).toBeNull();
		expect(calls.map((c)=>Object.keys(c)[0])).toEqual(['szchart', 'szshape', 'houseStartMode']);
	});

	test('宿占主页:照旧改单例并写本机偏好', ()=>{
		const { inst } = mkInput({});
		inst.onChartTypeChange(SZConst.SZChart_BaGuaChart);
		inst.onChartShapeChange(SZConst.SZChart_Square);
		inst.onHouseStartModeChange(SZConst.SZHouseStart_ASC);
		expect(SZConst.SZChart.chart).toBe(SZConst.SZChart_BaGuaChart);
		expect(SZConst.SZChart.shape).toBe(SZConst.SZChart_Square);
		expect(SZConst.SZChart.houseStartMode).toBe(SZConst.SZHouseStart_ASC);
		expect(window.localStorage.getItem('suzhanChartType')).toBe(`${SZConst.SZChart_BaGuaChart}`);
	});
});

describe('载入宿占事盘只经字段带进这张盘,不改全站单例', ()=>{
	test('事盘的外盘 / 盘形 / 起宫进字段;单例不动,之后的新盘与七政宿盘仍按偏好', ()=>{
		jest.isolateModules(()=>{
			jest.doMock('../kentangCaseSave', ()=>({ ...jest.requireActual('../kentangCaseSave'), getKentangSavedCasePayload: ()=>({ caseVersion: 7, payload: { options: { szchart: 2, szshape: 1, houseStartMode: 1 } } }) }));
			require('../../models/astro');
			const { fieldsSchemaBaseline } = require('../recordFieldsRestore');
			const SZ = require('../../components/suzhan/SZConst');
			const { szChartSelection: sel } = require('../../components/suzhan/SZChart');
			const { glChartShape } = require('../../components/guolao/GLChart');
			const SuZhanMain = require('../../components/suzhan/SuZhanMain').default;
			SZ.SZChart.chart = SZ.SZChart_SignChart;
			SZ.SZChart.shape = SZ.SZChart_Circle;
			SZ.SZChart.houseStartMode = SZ.SZHouseStart_Bazi;
			const dispatched = [];
			const inst = new SuZhanMain({ fields: fieldsSchemaBaseline(), dispatch: (a)=>dispatched.push(a) });
			expect(inst.restoreFromCurrentCase(true)).toBe(true);
			expect([SZ.SZChart.chart, SZ.SZChart.shape, SZ.SZChart.houseStartMode]).toEqual([SZ.SZChart_SignChart, SZ.SZChart_Circle, SZ.SZHouseStart_Bazi]);
			const loaded = dispatched.find((a)=>a.type === 'astro/fetchByFields').payload;
			expect(loaded.houseStartMode.value).toBe(SZ.SZHouseStart_ASC);
			// 这张盘照事盘画
			expect(sel(loaded)).toEqual({ chart: SZ.SZChart_BaGuaChart, shape: SZ.SZChart_Square });
			// 新盘(字段没有外盘 / 盘形)与七政宿盘回落的仍是偏好
			expect(sel({})).toEqual({ chart: SZ.SZChart_SignChart, shape: SZ.SZChart_Circle });
			expect(glChartShape({})).toBe(SZ.SZChart_Circle);
		});
	});
});
