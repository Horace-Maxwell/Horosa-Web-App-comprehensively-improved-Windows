// AI 助手 set_settings 五面「可写键 ⊆ 登记键」完备性锁(L3 第四处;范式照 changeCondWhitelist.test)。
// 助手改设置走的是各面正门(chart→changeCond / app→app.save / classical→classicalChartGlobal /
// mount·technique→技法 schema),正门只认登记过的键——面里能写、门口不认 = 模型改了回「已修改」、
// 盘面纹丝不动的死开关。判据全部机械抽取(剥注释后切函数体),不抄键名清单。
import fs from 'fs';
import path from 'path';
import {
	CHART_FACET_KEYS, CHART_FACET_PLACE_KEYS, APP_PREF_READONLY_KEYS, APP_PREF_EXEMPT_KEYS,
	appPrefSpec, describeFacet, SETTING_FACETS,
} from '../aiTools/settingsFacets';
import { geoPairToRecordFields } from '../aiTools/normalize/geoCompass';
import { CLASSICAL_PARAM_SPEC, CLASSICAL_SPEC_KEYS } from '../classicalParamSpec';
import { CLASSICAL_GLOBAL_DEFAULTS } from '../classicalChartGlobals';
import { TECHNIQUE_SETTINGS_SCHEMA, hasMountSettingsFields } from '../techniqueMountSettings';

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

// ── 登记面 ②:models/app.js globalSetup 字面量键(app/save 合并任意键,但只有这里声明的键才有消费方)
const appRaw = fs.readFileSync(APP_MODEL_SRC, 'utf8');
const globalSetupBody = strip(bodyOf(appRaw, 'let globalSetup = {'));
const globalSetupKeys = Array.from(new Set(
	Array.from(globalSetupBody.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm)).map((m)=>m[1])
)).sort();

// ── 产生面(chart):写入 patch 键 = 口径键 ∪ 经纬四键 ∪ pos ∪ confirmed;撤销回灌键 = snapshotFacet 的字面量键表 ∪ confirmed
const facetsRaw = fs.readFileSync(FACETS_SRC, 'utf8');
const snapshotBody = strip(bodyOf(facetsRaw, 'export function snapshotFacet('));
const snapshotChartKeys = (()=>{
	const m = snapshotBody.match(/\[((?:\s*'[a-zA-Z_][a-zA-Z0-9_]*'\s*,?)+)\]\.forEach/);
	return m ? Array.from(m[1].matchAll(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g)).map((x)=>x[1]) : [];
})();
const geoKeys = Object.keys(geoPairToRecordFields(39.9, 116.4) || {});
const chartWriteKeys = [...CHART_FACET_KEYS, ...geoKeys, 'pos', 'confirmed'];
const chartRestoreKeys = [...snapshotChartKeys, 'confirmed'];

describe('AI set_settings 五面可写键 ⊆ 登记键(L3 第四处)', ()=>{
	it('判定核注错自证:混入未登记键必被点名,全登记则为空', ()=>{
		expect(missingKeys(['hsys', 'bogusKey', 'hsys'], ['hsys', 'zodiacal'])).toEqual(['bogusKey']);
		expect(missingKeys(['hsys'], ['hsys', 'zodiacal'])).toEqual([]);
	});

	it('提取自证:changeCond 体 ≥ 800 字且白名单 ≥ 14 键;globalSetup ≥ 15 键;快照键表 ≥ 10 键', ()=>{
		expect(changeCondBody.length).toBeGreaterThan(800);
		expect(changeCondKeys.length).toBeGreaterThanOrEqual(14);
		expect(globalSetupKeys.length).toBeGreaterThanOrEqual(15);
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
		const d = describeFacet('chart');
		expect(d.ok).toBe(true);
		const settable = d.items.filter((it)=>it.settable !== false).map((it)=>it.key);
		expect(settable.length).toBeGreaterThanOrEqual(10);
		expect(missingKeys(settable, [...chartWriteKeys, 'place'])).toEqual([]);
	});

	it('app 面:可改键 ∪ 只读键 ∪ 豁免键 ⊆ globalSetup 声明键(app/save 合并任意键,未声明键无消费方=死写)', ()=>{
		const produced = [...appPrefSpec().map((s)=>s.key), ...APP_PREF_READONLY_KEYS, ...APP_PREF_EXEMPT_KEYS];
		expect(produced.length).toBeGreaterThanOrEqual(15);
		expect(missingKeys(produced, globalSetupKeys)).toEqual([]);
		// 反向:globalSetup 里的每个键要么可改、要么只读、要么豁免——新增全局偏好键不表态即红
		expect(missingKeys(globalSetupKeys, produced)).toEqual([]);
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

	it('五面枚举本身未漂移(新增面必须来此登记登记面)', ()=>{
		expect(SETTING_FACETS).toEqual(['chart', 'mount', 'app', 'classical', 'technique']);
	});
});
