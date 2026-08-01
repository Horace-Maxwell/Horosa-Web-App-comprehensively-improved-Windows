// 印占选项 per-record 持久化 · 三段成对契约锁(X4 审计产物)。
//
// 🔴 根因回放(2026-07-27 实锤):组件把选项全存自身 state、从不写回 dva fields →
// 存盘 values.india* 恒 undefined/默认 → localcharts「落库修复」空转、载盘还原被默认盖。
// 本测试锁:① 双向映射表 ↔ localcharts 落库键 ↔ recordFieldsRestore 还原键 三方一致;
// ② seedIndiaOptionState 规范化(字符串数字/数组串/非法值回退);③ 空值不动默认(零回归)。
import { INDIA_OPTION_FIELD_STATE_MAP, seedIndiaOptionState } from '../../components/astro/IndiaChartMain';
import { buildLocalChartRecord } from '../localcharts';

const fs = require('fs');
const path = require('path');

describe('印占 · 选项持久化三段成对', ()=>{
	const MAP_KEYS = INDIA_OPTION_FIELD_STATE_MAP.map((m)=>m.field);

	it('① 映射表键 ⊆ localcharts 落库键(写穿的每个键都真的会入库)', ()=>{
		const values = {};
		MAP_KEYS.forEach((k)=>{ values[k] = k === 'indiaVargaSet' ? '1,9' : (k === 'indiaTajakaYear' || k === 'indiaDashaYearLength' ? 360 : 'x'); });
		values.birth = null;
		const rec = buildLocalChartRecord({ name: 't', ...values });
		MAP_KEYS.forEach((k)=>{
			expect(rec[k]).not.toBeUndefined();
		});
	});

	it('② 映射表键 recordFieldsRestore 真还原(行为断言:record → fields 每键落 value)', ()=>{
		// 🔴 曾是源码 grep(字符串在文件里即绿)——manifest 行被注释掉字符串仍在,还原已断照绿。
		// 改为跑真 API:applyRecordToFields(baseFields, record) 每键必须落成 {value}。
		const { applyRecordToFields } = require('../recordFieldsRestore');
		const record = {};
		MAP_KEYS.forEach((k)=>{ record[k] = k === 'indiaVargaSet' ? '1,9' : (k === 'indiaTajakaYear' || k === 'indiaDashaYearLength' ? 360 : 'x'); });
		const fields = applyRecordToFields({}, record);
		MAP_KEYS.forEach((k)=>{
			expect(fields[k] && fields[k].value).not.toBeUndefined();
		});
	});

	it('③ seedIndiaOptionState 规范化:字符串数字/数组串/非法回退', ()=>{
		const seeded = seedIndiaOptionState({
			indiaDashaYearLength: { value: '360' },
			indiaDashaSystem: { value: 'yogini' },
			indiaVargaSet: { value: '1,9,10' },
			indiaDashaSeed: { value: 'not-a-seed' },
			indiaAnnualChartType: { value: 'tithi' },
		});
		expect(seeded.indiaDashaYearLength).toBe(360);
		expect(seeded.dashaSystem).toBe('yogini');
		expect(seeded.vargaSetFractals).toEqual([1, 9, 10]);
		expect(seeded.dashaSeed).toBe('moon');          // 非法 seed 回退默认
		expect(seeded.indiaAnnualChartType).toBe('tithi');
	});

	it('④ 空 fields / 空值不产生回种(state 默认保零回归)', ()=>{
		expect(seedIndiaOptionState(null)).toEqual({});
		expect(seedIndiaOptionState({ indiaDashaSystem: { value: null }, indiaVargaSet: { value: '' } })).toEqual({});
	});

	it('⑤ AI 挂载复算端到端:record 键 → fields(aiAnalysisContext 同构) → fieldsToParams 下发三新参', ()=>{
		const { fieldsToParams } = require('../../components/astro/IndiaChart');
		const moment = require('moment');
		// 与 aiAnalysisContext buildFieldObject 的三键写法同构(record.<key> → {value})
		const record = { indiaVargaVariant: '{"3":"somanatha"}', indiaKarakaScheme: '7', indiaYuddhaCriterion: 'longitude' };
		const fields = {
			date: { value: moment('2000-01-01') }, time: { value: moment('2000-01-01 12:00:00') },
			ad: { value: 1 }, zone: { value: 8 }, lat: { value: 39.9 }, lon: { value: 116.4 },
			gpsLat: { value: 39.9 }, gpsLon: { value: 116.4 },
			tradition: { value: false }, strongRecption: { value: false }, simpleAsp: { value: false },
			virtualPointReceiveAsp: { value: false }, name: { value: '' }, pos: { value: '' },
			indiaVargaVariant: { value: record.indiaVargaVariant },
			indiaKarakaScheme: { value: record.indiaKarakaScheme },
			indiaYuddhaCriterion: { value: record.indiaYuddhaCriterion },
		};
		const params = fieldsToParams(fields);
		expect(params.vargaVariant).toBe('{"3":"somanatha"}');
		expect(params.karakaScheme).toBe('7');
		expect(params.yuddhaCriterion).toBe('longitude');
		// 默认态(record 无键)零下发
		const p0 = fieldsToParams({ ...fields, indiaVargaVariant: { value: undefined }, indiaKarakaScheme: { value: '8' }, indiaYuddhaCriterion: { value: 'latitude' } });
		expect(p0.vargaVariant).toBeUndefined();
		expect(p0.karakaScheme).toBeUndefined();
		expect(p0.yuddhaCriterion).toBeUndefined();
	});
});

describe('印占 · 大运体系单一真值源(Z 轮:双表分叉载回打回修复)', ()=>{
	const AstroConst = require('../../constants/AstroConst');
	const FULL_13 = ['vimshottari', 'yogini', 'ashtottari', 'tribhagi',
		'shodashottari', 'dvadashottari', 'panchottari', 'shatabdika',
		'chaturashitiSama', 'dwisaptatiSama', 'shashtihayani', 'shattrimshaSama', 'chara'];
	// W 轮显式扩表:+2 前端展示体系(数据恒在响应,不下发 dashaSystem)。
	const FULL_15 = FULL_13.concat(['taraDasha', 'akkg']);

	it('INDIA_DASHA_SYSTEM_OPTIONS = 15 体系全集(13 + 展示体系 taraDasha/akkg)', ()=>{
		expect(AstroConst.INDIA_DASHA_SYSTEM_OPTIONS.map((o)=>o.value)).toEqual(FULL_15);
		expect(AstroConst.INDIA_DASHA_DISPLAY_ONLY_SYSTEMS).toEqual(['taraDasha', 'akkg']);
	});

	it('normalize 载回不打回:15 值全部保真、非法值回默认', ()=>{
		FULL_15.forEach((v)=>{
			expect(AstroConst.normalizeIndiaDashaSystem(v)).toBe(v);
		});
		expect(AstroConst.normalizeIndiaDashaSystem('nonsense')).toBe(AstroConst.INDIA_DASHA_SYSTEM_DEFAULT);
	});

	it('map 条目 norm 端到端:存 chara/条件系 → seed 回种同值(载盘不回落 vimshottari)', ()=>{
		const seeded = seedIndiaOptionState({
			indiaDashaSystem: { value: 'chara' },
		});
		expect(seeded.dashaSystem).toBe('chara');
		const seeded2 = seedIndiaOptionState({
			indiaDashaSystem: { value: 'shodashottari' },
		});
		expect(seeded2.dashaSystem).toBe('shodashottari');
	});

	it('挂载齿轮 schema 的大运体系下拉同源 13 项', ()=>{
		const { getTechniqueSettingsSchema } = require('../techniqueMountSettings');
		const schema = getTechniqueSettingsSchema('indiachart') || {};
		const entry = (schema.fields || []).find((it)=>it.name === 'indiaDashaSystem');
		expect(entry).toBeTruthy();
		expect((entry.options || []).map((o)=>o.value)).toEqual(FULL_15);
	});
});

describe('印占 · 载盘流派派生(Z 轮:adopt/seed 后 tabs/范式/主场随派)', ()=>{
	const AstroConst = require('../../constants/AstroConst');
	const { INDIA_OPTION_FIELD_STATE_MAP } = require('../../components/astro/IndiaChartMain');

	function fakeAdopt(prevFields, nextFields, state){
		// 与组件 adoptIndiaOptionFields 同构的最小复现(map 采纳 + school 派生)
		const patch = seedIndiaOptionState(nextFields);
		const diff = {};
		Object.keys(patch).forEach((k)=>{
			const same = String(state[k]) === String(patch[k]);
			if(!same){ diff[k] = patch[k]; }
		});
		if(diff.indiaSchool){
			const def = AstroConst.getIndiaSchoolDefaults(diff.indiaSchool) || {};
			if(Array.isArray(def.tabs) && def.tabs.length){
				diff.visibleTabKeys = def.tabs;
				diff.jyotishTab = (def.primaryTab && def.tabs.indexOf(def.primaryTab) >= 0) ? def.primaryTab : def.tabs[0];
			}
			if(def.aspectParadigm){ diff.indiaAspectParadigm = def.aspectParadigm; }
		}
		return diff;
	}

	it('载入 nadi 派记录 → 派生 tab 集/主场 16/范式 nadi', ()=>{
		const diff = fakeAdopt({}, { indiaSchool: { value: 'nadi' } }, { indiaSchool: 'parashari' });
		const def = AstroConst.getIndiaSchoolDefaults('nadi');
		expect(diff.indiaSchool).toBe('nadi');
		expect(diff.visibleTabKeys).toEqual(def.tabs);
		expect(diff.jyotishTab).toBe(def.primaryTab);
		expect(diff.indiaAspectParadigm).toBe(def.aspectParadigm);
	});

	it('组件源码:adopt 与构造期 seed 双路径都带 school 派生(防回退哨兵)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../components/astro/IndiaChartMain.js'), 'utf8');
		const adoptBody = src.slice(src.indexOf('adoptIndiaOptionFields(prevProps){'));
		expect(adoptBody.indexOf('diff.visibleTabKeys = def.tabs')).toBeGreaterThan(-1);
		const ctorIdx = src.indexOf('seedIndiaOptionState(props.fields)');
		expect(ctorIdx).toBeGreaterThan(-1);
		expect(src.slice(ctorIdx, ctorIdx + 900).indexOf('seededDef.tabs')).toBeGreaterThan(-1);
	});
});
