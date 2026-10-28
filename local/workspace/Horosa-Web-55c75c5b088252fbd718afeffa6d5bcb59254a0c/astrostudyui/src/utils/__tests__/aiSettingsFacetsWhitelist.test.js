// AI 助手 set_settings 六面「可写键 ⊆ 登记键」完备性锁(L3 第四处;范式照 changeCondWhitelist.test)。
// 助手改设置走的是各面正门(chart→changeCond / app→app.save / classical→classicalChartGlobal /
// mount·technique→技法 schema / page→该页 definePageSettings 的 save),正门只认登记过的键——面里能写、门口不认 = 模型改了回「已修改」、
// 盘面纹丝不动的死开关。判据全部机械抽取(剥注释后切函数体),不抄键名清单。
import fs from 'fs';
import path from 'path';
import {
	CHART_FACET_KEYS, CHART_FACET_PLACE_KEYS, CHART_COND_KEY_VIA, APP_PREF_READONLY_KEYS, APP_PREF_EXEMPT_KEYS, APP_PREF_DERIVED_KEYS,
	appPrefSpec, describeFacet, SETTING_FACETS, preparePageFacet, PAGE_FACET_EXCLUDED,
} from '../aiTools/settingsFacets';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import { geoPairToRecordFields } from '../aiTools/normalize/geoCompass';
import { CLASSICAL_PARAM_SPEC, CLASSICAL_SPEC_KEYS } from '../classicalParamSpec';
import { CLASSICAL_GLOBAL_DEFAULTS } from '../classicalChartGlobals';
import { TECHNIQUE_SETTINGS_SCHEMA, hasMountSettingsFields } from '../techniqueMountSettings';
import { GLOBAL_SETUP_FIELDS } from '../globalSetupStore';

const PAGE_SRC = path.resolve(__dirname, '..', '..', 'pages', 'index.js');
const APP_MODEL_SRC = path.resolve(__dirname, '..', '..', 'models', 'app.js');
const FACETS_SRC = path.resolve(__dirname, '..', 'aiTools', 'settingsFacets.js');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// 先在原文定位切体、再对体剥注释(整文件先剥会被字符串里的 `//` 殃及后文 marker)
function bodyOf(code, marker){
	const i = code.indexOf(marker);
	if(i < 0){ return ''; }
	const j = code.indexOf('{', i);
	let depth = 0;
	for(let k = j; k < code.length; k++){
		if(code[k] === '{'){ depth++; }
		else if(code[k] === '}'){ depth--; if(depth === 0){ return code.slice(j, k + 1); } }
	}
	return '';
}

// 判定核:产生面里不在登记面的键(纯函数,便于注错自证)
function missingKeys(produced, registered){
	const reg = new Set(registered);
	return Array.from(new Set(produced)).filter((k)=>!reg.has(k)).sort();
}

// ── 登记面 ①:pages/index.js changeCond 体内读到的 values.X
const pageRaw = fs.readFileSync(PAGE_SRC, 'utf8');
const changeCondBody = strip(bodyOf(pageRaw, 'function changeCond(values)'));
const changeCondKeys = Array.from(new Set(
	Array.from(changeCondBody.matchAll(/\bvalues\.([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((m)=>m[1])
)).sort();

// ── 登记面 ②:全局设置落盘字段表(utils/globalSetupStore 的 GLOBAL_SETUP_FIELDS;app/save 合并任意键,但只有表里的键才落盘、才有消费方)。
//    app 模型的 save 只经它落盘(源码合同另由 globalSetupMergeWrite.test 看守)
const appRaw = fs.readFileSync(APP_MODEL_SRC, 'utf8');
const globalSetupKeys = Array.from(new Set(GLOBAL_SETUP_FIELDS)).sort();

// ── 产生面(chart):写入 patch 键 = 口径键 ∪ 经纬四键 ∪ pos ∪ confirmed;撤销回灌键 = snapshotFacet 的字面量键表 ∪ confirmed
const facetsRaw = fs.readFileSync(FACETS_SRC, 'utf8');
const snapshotBody = strip(bodyOf(facetsRaw, 'export function snapshotFacet('));
const snapshotChartKeys = (()=>{
	const m = snapshotBody.match(/\[((?:\s*'[a-zA-Z_][a-zA-Z0-9_]*'\s*,?)+)\]\.forEach/);
	return m ? Array.from(m[1].matchAll(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g)).map((x)=>x[1]) : [];
})();
const geoKeys = Object.keys(geoPairToRecordFields(39.9, 116.4) || {});
// 时区等不按同名键下发的字段按 CHART_COND_KEY_VIA 换成实际下发键(时区 → tm)
const viaCond = (k)=>(CHART_COND_KEY_VIA[k] || k);
const chartWriteKeys = [...CHART_FACET_KEYS, ...geoKeys, 'pos', 'confirmed', viaCond('zone')];
const chartRestoreKeys = [...snapshotChartKeys.map(viaCond), 'confirmed'];

describe('AI set_settings 五面可写键 ⊆ 登记键(L3 第四处)', ()=>{
	it('判定核注错自证:混入未登记键必被点名,全登记则为空', ()=>{
		expect(missingKeys(['hsys', 'bogusKey', 'hsys'], ['hsys', 'zodiacal'])).toEqual(['bogusKey']);
		expect(missingKeys(['hsys'], ['hsys', 'zodiacal'])).toEqual([]);
	});

	it('提取自证:changeCond 体 ≥ 800 字且白名单 ≥ 14 键;globalSetup ≥ 15 键;快照键表 ≥ 10 键', ()=>{
		expect(changeCondBody.length).toBeGreaterThan(800);
		expect(changeCondKeys.length).toBeGreaterThanOrEqual(14);
		expect(globalSetupKeys.length).toBeGreaterThanOrEqual(15);
		expect(strip(bodyOf(appRaw, 'reducers: {'))).toContain('mergeGlobalSetupWrite(');   // app/save 确经落盘字段表落盘
		expect(snapshotChartKeys.length).toBeGreaterThanOrEqual(10);
		expect(geoKeys.sort()).toEqual(['gpsLat', 'gpsLon', 'lat', 'lon']);
	});

	it('chart 面:写入 patch 的每个键都被 changeCond 读取(漏登 = 助手改口径静默丢)', ()=>{
		expect(missingKeys(chartWriteKeys, changeCondKeys)).toEqual([]);
		// place 键本身不发给 changeCond(先离线解析成经纬四键 + pos),故不在白名单也合法;其余地点键必须在
		expect(CHART_FACET_PLACE_KEYS).toContain('place');
		expect(missingKeys(CHART_FACET_PLACE_KEYS.filter((k)=>k !== 'place'), changeCondKeys)).toEqual([]);
	});

	it('chart 面:撤销回灌的快照键都被 changeCond 读取(否则撤销回「已恢复」而盘面不动)', ()=>{
		expect(missingKeys(chartRestoreKeys, changeCondKeys)).toEqual([]);
	});

	it('chart 面:describe 列出的可改键 ⊆ 写入 patch 键 ∪ place(面里能写的门口都认)', ()=>{
		// 页面在场(工作区桥已登记):缺桥时整面只读,另有专条
		const { registerWorkspaceBridge } = require('../aiTools/workspaceBridge');
		registerWorkspaceBridge({ changeCond: ()=>{} });
		const d = describeFacet('chart');
		expect(d.ok).toBe(true);
		const settable = d.items.filter((it)=>it.settable !== false).map((it)=>it.key);
		expect(settable.length).toBeGreaterThanOrEqual(10);
		expect(missingKeys(settable, [...chartWriteKeys, 'place'])).toEqual([]);
	});

	it('app 面:可改键 ∪ 只读键 ∪ 豁免键 ⊆ globalSetup 声明键(app/save 合并任意键,未声明键无消费方=死写)', ()=>{
		const produced = [...appPrefSpec().map((s)=>s.key), ...APP_PREF_READONLY_KEYS, ...APP_PREF_EXEMPT_KEYS, ...APP_PREF_DERIVED_KEYS];
		expect(produced.length).toBeGreaterThanOrEqual(15);
		expect(missingKeys(produced, globalSetupKeys)).toEqual([]);
		// 反向:globalSetup 里的每个键要么可改、要么只读、要么豁免——新增全局偏好键不表态即红
		expect(missingKeys(globalSetupKeys, produced)).toEqual([]);
		// 派生只读项不是豁免表:每个都要真出现在 describe 里、只读
		const d = describeFacet('app');
		APP_PREF_DERIVED_KEYS.forEach((k)=>{
			const it = d.items.find((x)=>x.key === k);
			expect([k, !!it, it && it.settable]).toEqual([k, true, false]);
		});
	});

	it('classical 面:describe 可改键 == spec 里 send≠never 的键,且全部在全局仓默认表内', ()=>{
		const d = describeFacet('classical');
		expect(d.ok).toBe(true);
		const settable = d.items.filter((it)=>it.settable !== false).map((it)=>it.key).sort();
		const expected = CLASSICAL_PARAM_SPEC.filter((s)=>s.send !== 'never').map((s)=>s.key).sort();
		expect(settable).toEqual(expected);
		expect(missingKeys(CLASSICAL_SPEC_KEYS, Object.keys(CLASSICAL_GLOBAL_DEFAULTS))).toEqual([]);
	});

	it('mount / technique 面:每个可调技法 describe 出的键 ⊆ 该技法 schema 字段名', ()=>{
		const techs = Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((k)=>hasMountSettingsFields(k));
		expect(techs.length).toBeGreaterThan(5);
		techs.forEach((t)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[t];
			const fieldNames = (schema.fields || []).map((f)=>f.name);
			const facet = schema.kind === 'localStorage' ? 'technique' : 'mount';
			const d = describeFacet(facet, t);
			expect(d.ok).toBe(true);
			expect(missingKeys(d.items.map((it)=>it.key), fieldNames)).toEqual([]);
		});
	});

	it('page 面:每页 describe 出的键 == 该页登记字段,可写键 ⊆ 登记字段(写走该页自己的 save,登记表即正门)', async ()=>{
		const live = PAGE_SETTINGS_REGISTRY.filter((p)=>!PAGE_FACET_EXCLUDED[p.page]);
		expect(live.length).toBeGreaterThan(10);
		for(let i = 0; i < live.length; i++){
			const e = live[i];
			await preparePageFacet(e.page);   // eslint-disable-line no-await-in-loop
			const d = describeFacet('page', e.page);
			expect(`${e.page}:${d.ok}`).toBe(`${e.page}:true`);
			expect(d.items.map((it)=>it.key).sort()).toEqual(e.fields.slice().sort());
			expect(missingKeys(d.items.filter((it)=>it.settable).map((it)=>it.key), e.fields)).toEqual([]);
		}
	});

	it('六面枚举本身未漂移(新增面必须来此登记登记面)', ()=>{
		expect(SETTING_FACETS).toEqual(['chart', 'mount', 'app', 'classical', 'technique', 'page']);
	});
});

describe('mount 面显示条件:与挂载抽屉同一判据(完整草稿 + 对象式 when + 本次要写的值)', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });
	it('🔴 缺省档下隐藏的子项不列成可改;同一次写入里先改盘式再改它带出的子项可以一起改', ()=>{
		const { validateFacetValues } = require('../aiTools/settingsFacets');
		// 策天:农历算法只在「原法」下出现(对象式 when);缺省书法档不列
		const cet = describeFacet('mount', 'cetian');
		expect(cet.items.map((it)=>it.key)).not.toContain('lunarMode');
		expect(cet.items.map((it)=>it.key)).toContain('brightnessSchool');
		expect(validateFacetValues('mount', 'cetian', { method: 'kentang', lunarMode: 'classic' }).ok).toBe(true);
		expect(validateFacetValues('mount', 'cetian', { lunarMode: 'classic' }).ok).toBe(false);
		// 奇门:混合盘的分层只在盘式 = 混合时出现
		expect(describeFacet('mount', 'qimen').items.map((it)=>it.key)).not.toContain('mixTian');
		expect(validateFacetValues('mount', 'qimen', { school: '混合', mixTian: 'fei' }).ok).toBe(true);
	});
	it('🔴 下拉档是布尔 / 0-1 的开关项:按开关习惯传 1 / true / 0 也认(按字段归一后对档);乱写的值照旧拒', ()=>{
		const { validateFacetValues } = require('../aiTools/settingsFacets');
		const fj = (v)=>validateFacetValues('mount', 'qimen', { fengJu: v });
		expect(fj(1)).toMatchObject({ ok: true, values: { fengJu: true } });
		expect(fj('true')).toMatchObject({ ok: true, values: { fengJu: true } });
		expect(fj(0)).toMatchObject({ ok: true, values: { fengJu: false } });
		expect(fj('yes').ok).toBe(false);
		expect(fj(2).ok).toBe(false);
		// 数值档(刻位 / 时间算法 / 容许度)不认开关写法:true 不收成 1、'true' 不收成 0
		expect(validateFacetValues('mount', 'tieban', { tiebanKe: true }).ok).toBe(false);
		expect(validateFacetValues('mount', 'ziwei', { timeAlg: true }).ok).toBe(false);
		expect(validateFacetValues('mount', 'ziwei', { timeAlg: 'true' }).ok).toBe(false);
		expect(validateFacetValues('mount', 'solararc', { asporb: true }).ok).toBe(false);
		// 揲筮模式是起卦输入(决定兆象),助手本就不能改
		expect(validateFacetValues('mount', 'wuzhao', { mode: 'tang', manual: 1 })).toMatchObject({ ok: false, castInput: true });
	});
});
