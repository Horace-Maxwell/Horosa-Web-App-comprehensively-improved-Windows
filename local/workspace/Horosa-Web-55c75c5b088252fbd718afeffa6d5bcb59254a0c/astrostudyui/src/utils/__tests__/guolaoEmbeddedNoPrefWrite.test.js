// 七政左栏(GuoLaoInput)在择日内嵌实例(persistPrefs={false})里改起盘口径 / 流派预设 / 盘形:
// 只改宿主的盘(经 onFieldsChange),不写七政页的本机保存值、不改宿盘盘形单例与其保存值;七政主页(缺省)照旧写。
// 七政宿盘的版面与画盘按同一判据选圆 / 方(字段优先,缺省回落单例)。
import GuoLaoInput from '../../components/guolao/GuoLaoInput';
import { glChartShape } from '../../components/guolao/GLChart';
import * as SZConst from '../../components/suzhan/SZConst';
import * as Style from '../../components/guolao/GuoLaoChartStyle';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

function mkInput(persistPrefs){
	const calls = [];
	const inst = Object.create(GuoLaoInput.prototype);
	const dt = { ad: 1, zone: '+08:00', clone(){ return this; } };
	inst.props = { onFieldsChange: (p)=>calls.push(p), ...(persistPrefs === undefined ? {} : { persistPrefs }) };
	inst.tmHook = { getValue: ()=>({ value: dt }) };
	return { inst, calls };
}

function snapshotStored(){
	return {
		ayanamsa: Style.getStoredGuolaoAyanamsa(),
		tst: Style.getStoredGuolaoTrueSolarTime(),
		nodeType: Style.getStoredGuolaoNodeType(),
		lilith: Style.getStoredGuolaoLilithType(),
		body: Style.getStoredGuolaoBodyMode(),
		tuibian: Style.getStoredGuolaoTuibianMethod(),
		gufa: Style.getStoredGuolaoGufaPrecess(),
		anchor: Style.getStoredGuolaoEqTropicalAnchor(),
		life: Style.getStoredGuolaoLifeMode(),
		su28: Style.getStoredGuolaoSu28Mode(),
	};
}

function exerciseAll(inst){
	inst.onAyanamsaChange('lahiri');
	inst.onTrueSolarTimeChange('mean');
	inst.onNodeTypeChange('true');
	inst.onLilithTypeChange('true');
	inst.onBodyModeChange('youjin');
	inst.onTuibianMethodChange('shoushi');
	inst.onGufaPrecessChange(1);
	inst.onEqTropicalAnchorChange('chunfen');
	inst.onSchoolPresetChange('huujiao');
}

beforeEach(()=>{ window.localStorage.clear(); });

describe('七政择日内嵌左栏不写七政页保存值', ()=>{
	test('内嵌(persistPrefs=false):本机保存值全部不动,宿主仍收到字段改动', ()=>{
		const before = snapshotStored();
		const { inst, calls } = mkInput(false);
		exerciseAll(inst);
		expect(snapshotStored()).toEqual(before);
		expect(calls.length).toBe(9);
		expect(calls[0].guolaoAyanamsa.value).toBe('lahiri');
		expect(calls[8].doubingSu28.value).toBe(5);
		expect(calls[8].guolaoLifeMode.value).toBe('asc');
	});

	test('内嵌改盘形:不改宿盘盘形单例与保存值,只经字段带给宿主', ()=>{
		const shape0 = SZConst.SZChart.shape;
		const other = shape0 === SZConst.SZChart_Circle ? SZConst.SZChart_Square : SZConst.SZChart_Circle;
		const { inst, calls } = mkInput(false);
		inst.onChartShapeChange(other);
		expect(SZConst.SZChart.shape).toBe(shape0);
		expect(window.localStorage.getItem('suzhanChartShape')).toBeNull();
		expect(calls[0].szshape.value).toBe(other);
	});

	test('主页(缺省):照旧写本机保存值与盘形', ()=>{
		const before = snapshotStored();
		const { inst } = mkInput(undefined);
		exerciseAll(inst);
		const after = snapshotStored();
		expect(after.tst).toBe('true');   // 预设 huujiao 最后写 true
		expect(after.lilith).toBe('true');
		expect(after.body).toBe('taiyin');
		expect(after.su28).toBe(5);
		expect(after).not.toEqual(before);
		const shape0 = SZConst.SZChart.shape;
		const other = shape0 === SZConst.SZChart_Circle ? SZConst.SZChart_Square : SZConst.SZChart_Circle;
		inst.onChartShapeChange(other);
		expect(SZConst.SZChart.shape).toBe(other);
		SZConst.SZChart.shape = shape0;
	});

	test('七政页按页面范围给左栏传 persistPrefs', ()=>{
		const fs = require('fs'); const path = require('path');
		const { jsxNodesInFile } = require('./helpers/jsxProps');
		const inputs = jsxNodesInFile(path.join(__dirname, '../../components/guolao/GuoLaoChartMain.js'), 'GuoLaoInput');
		expect(inputs.length).toBeGreaterThan(0);
		expect(inputs.every((e)=>e.attrs.persistPrefs === "(this.props.techniqueScope || 'guolao') === 'guolao'")).toBe(true);
	});

	test('宿盘圆 / 方:字段优先,缺省回落单例', ()=>{
		const shape0 = SZConst.SZChart.shape;
		try{
			SZConst.SZChart.shape = SZConst.SZChart_Square;
			expect(glChartShape({ szshape: { value: 0 } })).toBe(SZConst.SZChart_Circle);
			expect(glChartShape({ szshape: { value: '1' } })).toBe(SZConst.SZChart_Square);
			expect(glChartShape({})).toBe(SZConst.SZChart_Square);
			expect(glChartShape(null)).toBe(SZConst.SZChart_Square);
		}finally{ SZConst.SZChart.shape = shape0; }
	});
});

describe('七政择日内嵌实例的星盘样式 / 引擎 / 坚七政选项 / 流年神煞显隐 / 显示偏好不写七政页记忆', ()=>{
	const GuoLaoChartMain = require('../../components/guolao/GuoLaoChartMain').default;
	function mkMain(scope){
		const inst = Object.create(GuoLaoChartMain.prototype);
		inst.props = scope ? { techniqueScope: scope } : {};
		inst.state = { chartStyle: Style.getStoredGuolaoChartStyle(), engineMode: 'horosa', guolaoDisplay: Style.getStoredGuolaoDisplay(), kinastroOptions: {}, showMoiraTransitGods: true };
		inst.setState = function(p){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; };
		inst.requestKinastroQizheng = ()=>{};
		inst.requestChartObj = ()=>{};
		inst.requestGuolaoBundle = ()=>{};
		inst.genParams = ()=>null;
		return inst;
	}
	function stored(){
		const out = {};
		for(let i = 0; i < window.localStorage.length; i += 1){ const k = window.localStorage.key(i); out[k] = window.localStorage.getItem(k); }
		return out;
	}
	function exercise(inst){
		inst.onChartStyleChange(Style.GUOLAO_CHART_STYLE_QIZHENG);
		inst.onEngineModeChange('horosa');
		inst.onKinastroOptionChange('showShensha', false);
		inst.onMoiraTransitGodsVisibleChange(false);
		inst.onGuolaoDisplayChange({ mountains: true });
	}
	test('内嵌:本页状态照改,本机记忆一项不动', ()=>{
		const before = stored();
		const inst = mkMain('qizhengzeri');
		exercise(inst);
		expect(stored()).toEqual(before);
		expect(inst.state.guolaoDisplay.mountains).toBe(true);
		expect(inst.state.showMoiraTransitGods).toBe(false);
		expect(inst.state.kinastroOptions.showShensha).toBe(false);
	});
	test('七政主页:照旧写记忆', ()=>{
		const before = stored();
		exercise(mkMain());
		expect(stored()).not.toEqual(before);
		expect(Style.getStoredGuolaoDisplay().mountains).toBe(true);
	});
});
