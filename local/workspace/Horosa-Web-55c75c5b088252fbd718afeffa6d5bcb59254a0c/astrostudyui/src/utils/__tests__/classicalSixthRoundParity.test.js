// [第六轮独立审计 2026-08-18] 占星设置全键「透传终局合同」——行为级四面:
// ① 随盘清单完备性:RECORD_FIELDS_RESTORE_MANIFEST ⊇ spec 全键(漏一键=该设置不随盘存档)
// ② 随盘 roundtrip:全 spec 键非默认 → capture 逐键落 → 以捕获值再构 send 载荷逐键仍在(存→载→发等值链)
// ③ 判读全局层:classical 仓判读键逐键非默认 → judgeLayerOverrides() 逐键出现(卜卦/择日 AI 挂载共此层)
// ④ AI 挂载再生构参:aiAnalysisContext.fieldParams 必 spread classicalBackendOverridesFromFields(单源锚,
//    防回退手写键列表);挂载走主盘同链,行为面由 ② 的 send 函数全键覆盖。
// 背景:五轮复审(65 项)后第六轮行为级压测同日在引擎面(:8899 真打)逐键证活 49/51,
// 两死档(saturnExalt20 exaltDeg 零消费 / polarMcMode swap 分支实测不可达)已于 2026-08-18 拍板删档,全链退场。
import fs from 'fs';
import path from 'path';
import { CLASSICAL_PARAM_SPEC } from '../classicalParamSpec';
import { classicalBackendOverridesFromPlain, setClassicalChartGlobal, __resetClassicalGlobalsCacheForTest } from '../classicalChartGlobals';
import { RECORD_FIELDS_RESTORE_MANIFEST, captureNonDefaultTechniqueFields, registerFieldsBaselineFactory } from '../recordFieldsRestore';
import { judgeLayerOverrides } from '../judgeLayerOverrides';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

function probeValue(def){
	if(def.type === 'switch'){
		return def.default ? 0 : 1;
	}
	const opts = (def.options || []).map((o)=>(o && typeof o === 'object' ? o.value : o));
	const found = opts.find((v)=>v !== def.default && !(Array.isArray(def.defaultAliases) && def.defaultAliases.indexOf(v) >= 0));
	return found !== undefined ? found : def.default;
}

afterEach(()=>{
	window.localStorage.clear();
	__resetClassicalGlobalsCacheForTest();
	registerFieldsBaselineFactory(null);
});

describe('① 随盘清单完备性(manifest ⊇ spec 随盘键)', ()=>{
	// seed='never' 12 键=本机全局偏好层(不进 fields/record 链;AI 快照面由 [F11] 快照敏感键收口,
	// 判读面由 judgeLayerOverrides 收口)——设计内分层。枚举冻结:此集扩张必须显式过审,
	// 防止新键误标 never 而静默丢失随盘性。
	const LOCAL_ONLY_KEYS = [
		'dignityDebilities', 'peregrineScore', 'almutenTripMode', 'domicileMasterMethod',
		'dynamicalDivisions', 'busyPlaces', 'planetaryHourMethod', 'transitOrb',
		'aspectShowOnlyApplying', 'separatingOrbCap', 'partileDef', 'eclipseTimeMode',
		'stationMarking', 'rayWeighting', 'solarReturnVariant', 'returnLatitudeMode',
		'vulcanCalc', 'topocentricMoon', 'westLilithType',
	];
	it('seed≠never 的 spec 键都在 RECORD_FIELDS_RESTORE_MANIFEST(漏登=改了设置存档不带走)', ()=>{
		const manifestKeys = new Set(RECORD_FIELDS_RESTORE_MANIFEST.map((m)=>m.key));
		const missing = CLASSICAL_PARAM_SPEC
			.filter((d)=>d.seed !== 'never')
			.filter((d)=>!manifestKeys.has(d.key))
			.map((d)=>d.key);
		expect(missing).toEqual([]);
	});
	it('seed=never 键集冻结(新键标 never 必须显式过审入此枚举)', ()=>{
		const neverKeys = CLASSICAL_PARAM_SPEC.filter((d)=>d.seed === 'never').map((d)=>d.key).sort();
		const unexpected = neverKeys.filter((k)=>!LOCAL_ONLY_KEYS.includes(k));
		expect(unexpected).toEqual([]);
	});
});

describe('② 随盘 roundtrip(存→载→发等值链,全键)', ()=>{
	it('全 spec 键非默认 → capture 逐键落 → 捕获值再构 send 载荷:send 键逐键仍在且值等', ()=>{
		const baseline = {};
		CLASSICAL_PARAM_SPEC.forEach((d)=>{ baseline[d.key] = { value: d.default }; });
		registerFieldsBaselineFactory(()=>baseline);

		const fields = {};
		const probes = {};
		CLASSICAL_PARAM_SPEC.forEach((d)=>{
			const v = probeValue(d);
			probes[d.key] = v;
			fields[d.key] = { value: v };
		});
		// 伴发条件:vocIncludeOuter 需非默认 vocMode(probeValue 已使 vocMode 非默认,天然满足)
		const captured = captureNonDefaultTechniqueFields(fields);
		const notCaptured = CLASSICAL_PARAM_SPEC
			.filter((d)=>d.seed !== 'never')   // never 键=本机偏好层不随盘(①冻结枚举看守)
			.filter((d)=>probes[d.key] !== d.default)
			.filter((d)=>!(d.key in captured))
			.map((d)=>d.key);
		expect(notCaptured).toEqual([]);

		const sendPayload = classicalBackendOverridesFromPlain(captured);
		const missingInSend = CLASSICAL_PARAM_SPEC
			.filter((d)=>d.send !== 'never' && probes[d.key] !== d.default)
			.filter((d)=>{
				const bk = d.backendKey || d.key;
				return sendPayload[bk] === undefined;
			})
			.map((d)=>d.key);
		expect(missingInSend).toEqual([]);
	});
});

describe('⑤ 数据管理面:store 备份 JSON 字符串往返 → 导入 → 全键保真 → 再构 send(用户明令全消费面)', ()=>{
	it('全 spec 随盘键非默认 → upsert 入库 → exportBackup → stringify/parse(模拟落盘文件) → 清库 importBackup → record 逐键等值 → send 载荷逐键仍在', ()=>{
		const { upsertLocalChart, removeLocalChart, listLocalCharts, exportLocalChartsBackup, importLocalChartsBackup } = require('../localcharts');
		const baseline = {};
		CLASSICAL_PARAM_SPEC.forEach((d)=>{ baseline[d.key] = { value: d.default }; });
		registerFieldsBaselineFactory(()=>baseline);
		const fields = {};
		const probes = {};
		CLASSICAL_PARAM_SPEC.forEach((d)=>{
			const v = probeValue(d);
			probes[d.key] = v;
			fields[d.key] = { value: v };
		});
		const captured = captureNonDefaultTechniqueFields(fields);
		const rec = upsertLocalChart({ name: '__parity_backup_probe__', birth: '1990-01-01 12:00', ...captured });
		const cid = rec && rec.cid;
		expect(cid).toBeTruthy();
		// 真实落盘往返:JSON 字符串化再解析(数据管理「全量备份/导出 JSON」的文件形态)
		const wire = JSON.stringify(exportLocalChartsBackup());
		removeLocalChart(cid);
		const back = importLocalChartsBackup(JSON.parse(wire));
		expect(back && back.ok !== false).toBeTruthy();
		const restored = (listLocalCharts() || []).find((r)=>r.name === '__parity_backup_probe__');
		expect(restored).toBeTruthy();
		// 逐键保真:capture 落的每个随盘键,备份往返后 record 上逐键仍在且值等
		const lost = Object.keys(captured)
			.filter((k)=>CLASSICAL_PARAM_SPEC.some((d)=>d.key === k))
			.filter((k)=>String(restored[k]) !== String(captured[k]));
		expect(lost).toEqual([]);
		// 终端判据:恢复出的 record 再构 send 载荷,非默认键逐键仍在(与合同②同口径)
		const sendPayload = classicalBackendOverridesFromPlain(restored);
		const missingInSend = CLASSICAL_PARAM_SPEC
			.filter((d)=>d.send !== 'never' && d.seed !== 'never' && probes[d.key] !== d.default)
			.filter((d)=>{
				const bk = d.backendKey || d.key;
				return sendPayload[bk] === undefined;
			})
			.map((d)=>d.key);
		expect(missingInSend).toEqual([]);
	});
});

describe('③ 判读全局层(卜卦/择日 AI 挂载共用)', ()=>{
	it('classical 仓判读键逐键非默认 → judgeLayerOverrides() 逐键出现', ()=>{
		const JUDGE_KEYS = [
			'cazimiOrb', 'combustOrb', 'underBeamsOrb',
			'vocMode', 'vocIncludeOuter', 'fixedStarOrb', 'fixedStarOrbMode',
			'viaCombustaVariant', 'partileDef', 'antisciaOrb',
		];
		JUDGE_KEYS.forEach((k)=>{
			const def = CLASSICAL_PARAM_SPEC.find((d)=>d.key === k);
			expect(`${k}:spec`).toBe(`${k}:${def ? 'spec' : 'MISSING'}`);
			setClassicalChartGlobal(k, probeValue(def));
		});
		// 伴发:vocIncludeOuter 依赖 vocMode 非默认(上循环已置)
		const out = judgeLayerOverrides();
		const missing = JUDGE_KEYS.filter((k)=>out[k] === undefined);
		expect(missing).toEqual([]);
	});
});

describe('④ AI 挂载再生构参单源锚', ()=>{
	it('aiAnalysisContext.fieldParams 必 spread classicalBackendOverridesFromFields(防回退手写)', ()=>{
		const src = fs.readFileSync(path.join(SRC_ROOT, 'utils/aiAnalysisContext.js'), 'utf8');
		const fnStart = src.indexOf('function fieldParams(');
		expect(fnStart).toBeGreaterThan(0);
		// 函数超长(主限八键+七政六键+希腊化六项全在里面),窗口给足;锚=单源 spread 存在于函数体内。
		const seg = src.slice(fnStart, fnStart + 12000);
		expect(seg.includes('classicalBackendOverridesFromFields')).toBe(true);
	});
});
