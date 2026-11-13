// 赤道类盘「上升起盘」的上升取法两档(改进 = 真赤经,缺省 / 经典 = 旧版的东点黄经 eastPointLon,缺字段回落 ra):
// 宿占(含二十八宿宿盘)、节气页内嵌宿盘、七政赤仪、三式外圈赤道分宫。
import fs from 'fs';
import path from 'path';
import {
	ASC_RA_MODE_IMPROVED, ASC_RA_MODE_CLASSIC, ascRaOf, withAscRaMode, withAscRaModeRoot, ascRaModeSnapshotLine,
	SUZHAN_ASC_SETTINGS, GUOLAO_ASC_SETTINGS, loadSuzhanAscRaMode, guolaoAscRaModeOf, guolaoEquatorialDisplay,
} from '../ascRaMode';
import { buildSuzhanSnapshotText, suzhanAscRaModeOf } from '../../components/suzhan/SuZhanMain';
import { buildOuterData, SANSHI_PAGE_SETTINGS } from '../../components/sanshi/SanShiUnitedMain';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';

const SRC = path.resolve(__dirname, '../..');
const { readSource } = require('./helpers/sourceSet');
// 门面按「子模块 + 门面」全集读(sourceSetManifest 合同)
const read = (rel)=>readSource(path.join(SRC, rel));

// 上升真赤经 100°(巨蟹段),东点黄经 85°(双子段):两档命宫差一座
const ASC = { id: 'Asc', lon: 95, ra: 100, eastPointLon: 85, sign: 'Cancer', signlon: 5 };
const SUN = { id: 'Sun', lon: 40, ra: 37.6, sign: 'Taurus', signlon: 10, house: 'House11', su28: '昴' };
function makeChart(asc){
	return {
		houses: [{ id: 'House1', lon: 95 }, { id: 'House2', lon: 125 }],
		objects: [asc || ASC, SUN],
		fixedStarSu28: [],
	};
}

beforeEach(()=>{ window.localStorage.clear(); });

describe('单源换法', ()=>{
	test('改进 = ra;经典 = eastPointLon,缺字段回落 ra', ()=>{
		expect(ascRaOf(ASC, ASC_RA_MODE_IMPROVED)).toBe(100);
		expect(ascRaOf(ASC, ASC_RA_MODE_CLASSIC)).toBe(85);
		expect(ascRaOf({ id: 'Asc', ra: 100 }, ASC_RA_MODE_CLASSIC)).toBe(100);
		expect(ascRaOf(ASC, 'nonsense')).toBe(100);
	});

	test('经典只换上升点一个对象、不改原盘;改进 / 无旧值原样同引用;同一张盘重算同一个对象', ()=>{
		const chart = { ...makeChart(), objectMap: { Asc: ASC } };
		expect(withAscRaMode(chart, ASC_RA_MODE_IMPROVED)).toBe(chart);
		const c = withAscRaMode(chart, ASC_RA_MODE_CLASSIC);
		expect(c).not.toBe(chart);
		expect(c.objects[0].ra).toBe(85);
		expect(c.objects[1]).toBe(SUN);
		expect(c.objectMap).toBeUndefined();   // 懒缓存不能沿用旧上升点
		expect(chart.objects[0].ra).toBe(100);
		expect(withAscRaMode(chart, ASC_RA_MODE_CLASSIC)).toBe(c);
		const legacy = makeChart({ id: 'Asc', lon: 95, ra: 100 });
		expect(withAscRaMode(legacy, ASC_RA_MODE_CLASSIC)).toBe(legacy);
		const root = { chart: makeChart(), params: {} };
		expect(withAscRaModeRoot(root, ASC_RA_MODE_CLASSIC).chart.objects[0].ra).toBe(85);
		expect(withAscRaModeRoot(root, ASC_RA_MODE_IMPROVED)).toBe(root);
	});

	test('快照行写明档位;经典但本盘没有旧值照实写回落', ()=>{
		expect(ascRaModeSnapshotLine(ASC_RA_MODE_IMPROVED)).toContain('改进');
		expect(ascRaModeSnapshotLine(ASC_RA_MODE_CLASSIC, makeChart())).toBe('上升取法：经典(东点黄经,旧版口径)');
		expect(ascRaModeSnapshotLine(ASC_RA_MODE_CLASSIC, makeChart({ id: 'Asc', ra: 100 }))).toContain('实际按真赤经');
	});
});

describe('宿占:只在 ASC 起盘时起作用', ()=>{
	const fields = (mode)=>({ houseStartMode: { value: mode } });
	test('缺省 = 改进;八字公式起盘恒按改进(存了经典也一样)', ()=>{
		expect(loadSuzhanAscRaMode()).toBe(ASC_RA_MODE_IMPROVED);
		SUZHAN_ASC_SETTINGS.save({ ascRaMode: ASC_RA_MODE_CLASSIC });
		expect(suzhanAscRaModeOf(fields(1))).toBe(ASC_RA_MODE_CLASSIC);
		expect(suzhanAscRaModeOf(fields(0))).toBe(ASC_RA_MODE_IMPROVED);
		// 无头重算带进来的字段优先
		expect(suzhanAscRaModeOf({ ...fields(1), ascRaMode: { value: ASC_RA_MODE_IMPROVED } })).toBe(ASC_RA_MODE_IMPROVED);
	});

	test('两档命宫不同(真赤经巨蟹 / 东点黄经双子),快照写明档位;八字公式起盘不出这一行', ()=>{
		const root = { chart: makeChart(), params: {} };
		const improved = buildSuzhanSnapshotText(root, fields(1), null);
		expect(improved).toContain('上升取法：改进');
		expect(improved).toMatch(/巨蟹座—第1宫/);
		SUZHAN_ASC_SETTINGS.save({ ascRaMode: ASC_RA_MODE_CLASSIC });
		const classic = buildSuzhanSnapshotText(root, fields(1), null);
		expect(classic).toContain('上升取法：经典(东点黄经,旧版口径)');
		expect(classic).toMatch(/巨蟹座—第2宫/);
		expect(root.chart.objects[0].ra).toBe(100);   // 不就地改盘
		expect(buildSuzhanSnapshotText(root, fields(0), null)).not.toContain('上升取法');
	});

	test('左栏:只在 ASC 起盘、非只读嵌入时显示;亲手改才落盘;盘面与宫宿表都按换过的盘', ()=>{
		const input = read('components/suzhan/SuZhanInput.js');
		expect(input).toContain("houseStartMode === SZConst.SZHouseStart_ASC && !this.props.embeddedReadOnly ?");
		expect(input).toContain('value={this.state.ascRaMode}');
		expect(input).toContain('SUZHAN_ASC_SETTINGS.save({ ascRaMode: mode });');
		const main = read('components/suzhan/SuZhanMain.js');
		expect(main).toContain('let chartObj = withAscRaModeRoot(this.props.value, suzhanAscRaModeOf(this.props.fields));');
		expect(main).toContain('const chartObj = withAscRaModeRoot(this.props.value, suzhanAscRaModeOf(this.props.fields)) || {};');
		// 节气页的分至宿盘段同一换法
		const jieqi = read('components/jieqi/JieQiChartsMain.js');
		expect(jieqi).toContain('const chartObj = withAscRaModeRoot(rawChartObj, ascRaMode);');
	});
});

describe('三式:只在外圈赤道分宫时起作用', ()=>{
	const chart = ()=>makeChart();
	test('赤道:两档上升落支不同,快照行挂在第 1 宫那一支;黄道:逐字现状', ()=>{
		const imp = buildOuterData(chart(), 'equatorial', ASC_RA_MODE_IMPROVED);
		const cls = buildOuterData(chart(), 'equatorial', ASC_RA_MODE_CLASSIC);
		const firstBranch = (od)=>Object.keys(od.housesByBranch).find((b)=>od.housesByBranch[b].indexOf('1') >= 0);
		expect(firstBranch(imp)).toBe('未');   // 赤经 100° → 巨蟹段 → 未
		expect(firstBranch(cls)).toBe('申');   // 东点黄经 85° → 双子段 → 申
		expect(imp.ascRaLine).toContain('改进');
		expect(cls.ascRaLine).toContain('经典');
		const ecl = buildOuterData(chart(), 'ecliptic', ASC_RA_MODE_CLASSIC);
		expect(ecl.ascRaLine).toBeUndefined();
		expect(ecl).toEqual(buildOuterData(chart(), 'ecliptic'));
	});

	test('设置件收了上升取法(出厂改进);左栏只在外圈 = 赤道时显示;缓存键 / 去重签名带上档位', ()=>{
		expect(SANSHI_PAGE_SETTINGS.defaults().ascRaMode).toBe(ASC_RA_MODE_IMPROVED);
		const src = read('components/sanshi/SanShiUnitedMain.js');
		// horosa_win_slice_form_v1(Windows 侧移植适配):合一页左栏在我方渲染切片里是独立组件,state 经 props 进入,
		// 同一判据的代码形是 `{this.props.outerCoord === 'equatorial' ? (`;两形皆认(判据零放宽:仍必须是「外圈 = 赤道才显示」),
		// 切片形另须宿主把 outerCoord / ascRaMode / 处理器三项都传进去(少传一项 = 下拉不显示或一改就 TypeError)。
		const hostForm = src.includes("{this.state.outerCoord === 'equatorial' ? (");
		const sliceForm = src.includes("{this.props.outerCoord === 'equatorial' ? (")
			&& src.includes('outerCoord={this.state.outerCoord}')
			&& src.includes('ascRaMode={this.state.ascRaMode}')
			&& src.includes('onAscRaModeChange={(mode)=>this.onAscRaModeChange(mode)}');
		expect(hostForm || sliceForm).toBe(true);
		expect(src).toContain('SANSHI_PAGE_SETTINGS.save({ ascRaMode: m });');
		expect(src).toContain('`${this.outerCoordCacheKey()}`,');
		expect(read('components/sanshi/SanshiUnitedBoard.js')).toContain('buildOuterData(astroChartTop, outerCoord, ascRaMode)');
	});
});

describe('七政:只在赤仪时起作用', ()=>{
	test('黄仪恒改进;赤仪按保存值;旧响应无 displayCoord 按盘面同一回退判据', ()=>{
		GUOLAO_ASC_SETTINGS.save({ ascRaMode: ASC_RA_MODE_CLASSIC });
		expect(guolaoAscRaModeOf({ displayCoord: 'ecliptic' }, null)).toBe(ASC_RA_MODE_IMPROVED);
		expect(guolaoAscRaModeOf({ displayCoord: 'equatorial' }, null)).toBe(ASC_RA_MODE_CLASSIC);
		expect(guolaoEquatorialDisplay({ params: { doubingSu28: 4 } })).toBe(false);
		expect(guolaoEquatorialDisplay({ params: { doubingSu28: 0 } })).toBe(true);
	});

	test('盘面三种盘式 / 右栏 / 快照同一份换过的盘;左栏只在赤仪且七政主页显示', ()=>{
		const main = read('components/guolao/GuoLaoChartMain.js');
		expect(main).toContain('chart = withAscRaMode(chart, ascRaMode);');
		expect(main).toContain('chartObj = withAscRaModeRoot(chartObj, ascRaMode);');
		const snap = read('components/guolao/main/snapshot.js');
		expect(snap).toContain('const _ascRaMode = guolaoAscRaModeOf(_rawChart, fields);');
		const input = read('components/guolao/GuoLaoInput.js');
		expect(input).toContain('GUOLAO_EQUATORIAL_SU28_MODES.indexOf(Number(fields.doubingSu28.value)) >= 0 && this.persistsPrefs() ?');
		expect(input).toContain('GUOLAO_ASC_SETTINGS.save({ ascRaMode: mode });');
	});
});

test('四本账:页面设置登记(保存键字面量)、存储键登记为设置', ()=>{
	const pages = PAGE_SETTINGS_REGISTRY.map((e)=>e.page);
	expect(pages).toEqual(expect.arrayContaining(['suzhan', 'guolao']));
	expect(PAGE_SETTINGS_REGISTRY.find((e)=>e.page === 'sanshiunited').fields).toContain('ascRaMode');
	const util = read('utils/ascRaMode.js');
	expect(util).toContain("export const SUZHAN_ASC_SETTINGS = definePageSettings('horosa.suzhan.settings.v1'");
	expect(util).toContain("export const GUOLAO_ASC_SETTINGS = definePageSettings('horosa.guolao.settings.v1'");
});

describe('宿占挂载齿轮', ()=>{
	const { getTechniqueSettingsSchema, effectiveMountBaseline, isMountFieldVisible, getTechniqueSettingsCurrentDefaults, pruneOptionsToNonDefault } = require('../techniqueMountSettings');
	const { suzhanFieldsForRecord } = require('../aiAnalysisContext/regenChart');
	test('有「上升取法」一项:只在 ASC 起盘时显示;记录里没有 = 跟宿占页现值', ()=>{
		const schema = getTechniqueSettingsSchema('suzhan');
		const f = schema.fields.find((x)=>x.name === 'ascRaMode');
		expect(f).toBeTruthy();
		expect(f.options.map((o)=>o.value)).toEqual([ASC_RA_MODE_IMPROVED, ASC_RA_MODE_CLASSIC]);
		const defs = getTechniqueSettingsCurrentDefaults('suzhan');
		expect(isMountFieldVisible(f, { ...defs, houseStartMode: 0 }, schema)).toBe(false);
		expect(isMountFieldVisible(f, { ...defs, houseStartMode: 1 }, schema)).toBe(true);
		const rec = { birth: '1990-01-01 12:00:00', houseStartMode: 1 };
		expect(effectiveMountBaseline('suzhan', rec).ascRaMode).toBe(ASC_RA_MODE_IMPROVED);
		SUZHAN_ASC_SETTINGS.save({ ascRaMode: ASC_RA_MODE_CLASSIC });
		expect(effectiveMountBaseline('suzhan', rec).ascRaMode).toBe(ASC_RA_MODE_CLASSIC);
		// 拨到与现值不同的档才算覆盖(拨回现值被剪空 = 跟页面)
		expect(pruneOptionsToNonDefault('suzhan', { ascRaMode: ASC_RA_MODE_IMPROVED }, effectiveMountBaseline('suzhan', rec))).toEqual({ ascRaMode: ASC_RA_MODE_IMPROVED });
	});
	test('无头重算:记录里的上升取法带进 fields,快照按它换上升点', ()=>{
		const fo = suzhanFieldsForRecord({ birth: '1990-01-01 12:00:00', houseStartMode: 1, ascRaMode: 'classic' });
		expect(fo.ascRaMode).toEqual({ value: 'classic' });
		expect(suzhanAscRaModeOf(fo)).toBe(ASC_RA_MODE_CLASSIC);
		expect(suzhanFieldsForRecord({ birth: '1990-01-01 12:00:00' }).ascRaMode).toBeUndefined();
	});
});
