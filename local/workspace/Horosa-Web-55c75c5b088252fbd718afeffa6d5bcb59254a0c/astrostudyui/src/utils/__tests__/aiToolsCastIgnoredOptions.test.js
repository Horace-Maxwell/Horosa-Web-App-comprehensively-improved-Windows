// AI 助手·cast_technique 的 options 里不生效的键如实列出(ignoredOptions):齿轮里没有 / 取值不在档内 / 此刻不显示,
// 不再静默丢;显隐判据与重算入口的剪枝同一份上下文(合同:逐技法逐字段与 pruneOptionsToNonDefault 的去留一致)。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../aiAnalysisContext', ()=>{
	const actual = jest.requireActual('../aiAnalysisContext');
	return { __esModule: true, ...actual, getAnalysisTechniqueContexts: jest.fn(async (src, keys)=>[{ key: keys[0], status: 'ok', content: '【四柱与三元】甲子' }]) };
});
jest.mock('../aiAnalysisStore', ()=>({
	AI_ANALYSIS_STORES: { contextCache: 'contextCache' },
	getStoreRecord: jest.fn(async ()=>null),
	putStoreRecord: jest.fn(async (storeName, record)=>record),
	schedulePruneContextCache: jest.fn(),
}));
import Ajv from 'ajv';
import { registerBuiltinTools } from '../aiTools';
import { runTool, listTools, __resetToolsForTests } from '../aiTools/registry';
import { classifyCastOptions, hiddenCastOptions } from '../aiTools/tools/castTechnique';
import { TECHNIQUE_SETTINGS_SCHEMA, MOUNT_TECHNIQUE_DEFAULTS_KEY, pruneOptionsToNonDefault, effectiveMountBaseline, fieldCurrentDefault } from '../techniqueMountSettings';

const ctx = ()=>({ origin: 'in-app', requestId: 'r1', dispatch: jest.fn() });
const source = { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' };
const lastOpts = ()=>{ const b = require('../aiAnalysisContext').getAnalysisTechniqueContexts; const c = b.mock.calls[b.mock.calls.length - 1]; return (c && c[2] && c[2].techniqueOptions) || null; };

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests();
	registerBuiltinTools();
});

describe('回包 ignoredOptions', ()=>{
	it('齿轮里没有的键 → unknown;取值不在档内 → invalid 且不下发(同类默认里这一项照旧);正常覆盖照常下发、回包不带 ignoredOptions', async ()=>{
		const r = await runTool('cast_technique', { technique: 'bazi', source, options: { noSuchKey: 1, timeAlg: 99 } }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.ignoredOptions.map((x)=>[x.key, x.reason])).toEqual([['noSuchKey', 'unknown'], ['timeAlg', 'invalid']]);
		expect(r.assumptions.some((a)=>/options 里有 2 项没有生效/.test(a) && /noSuchKey/.test(a) && /timeAlg/.test(a))).toBe(true);
		expect(lastOpts()).toBe(null);   // 两项都没下发
		window.localStorage.setItem(MOUNT_TECHNIQUE_DEFAULTS_KEY, JSON.stringify({ version: 1, techniques: { bazi: { timeAlg: 1 } } }));
		await runTool('cast_technique', { technique: 'bazi', source, options: { timeAlg: 99 } }, ctx());
		expect(lastOpts()).toEqual({ bazi: { timeAlg: 1 } });   // 坏值不盖同类默认
		const ok = await runTool('cast_technique', { technique: 'bazi', source, options: { timeAlg: 0 } }, ctx());
		expect(lastOpts()).toEqual({ bazi: { timeAlg: 0 } });
		expect(ok.data.ignoredOptions).toBeUndefined();
		expect(ok.assumptions.some((a)=>/没有生效/.test(a))).toBe(false);
		// 档值的字符串写法照认(不是坏值)
		const s = await runTool('cast_technique', { technique: 'bazi', source, options: { timeAlg: '0' } }, ctx());
		expect(s.data.ignoredOptions).toBeUndefined();
	});
	it('回包合自己声明的输出结构(带 ignoredOptions 时)', async ()=>{
		const r = await runTool('cast_technique', { technique: 'bazi', source, options: { noSuchKey: 1 } }, ctx());
		const def = listTools().find((d)=>d.name === 'cast_technique');
		const v = new Ajv({ allErrors: true, strict: false }).compile(def.outputSchema);
		expect([v(r.data), JSON.stringify(v.errors)]).toEqual([true, 'null']);
		expect(def.outputSchema.properties.ignoredOptions.items.properties.reason.enum).toEqual(['unknown', 'invalid', 'hidden']);
	});
	it('只读快照类技法(没有可调设置):全部 unknown,说明里带它的原因', ()=>{
		const so = Object.keys(TECHNIQUE_SETTINGS_SCHEMA).find((k)=>TECHNIQUE_SETTINGS_SCHEMA[k].kind === 'sectionsOnly' && TECHNIQUE_SETTINGS_SCHEMA[k].reason);
		const r = classifyCastOptions(so, { hsys: 0 }, {});
		expect(r.ignored.map((x)=>x.reason)).toEqual(['unknown']);
		expect(r.ignored[0].message).toContain(TECHNIQUE_SETTINGS_SCHEMA[so].reason);
		expect(r.options).toEqual({});
	});
});

// 合同:逐技法逐字段 —— 判「此刻不显示」与重算入口剪枝的去留一致(换派、留空随存档等都走同一份上下文);档位判据不误杀任何一档与现值缺省
describe('合同:与剪枝同口径', ()=>{
	const tech = Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((k)=>TECHNIQUE_SETTINGS_SCHEMA[k].kind !== 'sectionsOnly' && Array.isArray(TECHNIQUE_SETTINGS_SCHEMA[k].fields) && TECHNIQUE_SETTINGS_SCHEMA[k].fields.length);
	it('每一档的值与现值缺省都认得(不当成坏值)', ()=>{
		const bad = [];
		tech.forEach((t)=>TECHNIQUE_SETTINGS_SCHEMA[t].fields.forEach((f)=>{
			const vals = (Array.isArray(f.options) ? f.options.map((o)=>o.value) : []).concat([fieldCurrentDefault(f)]);
			vals.forEach((v)=>{
				const r = classifyCastOptions(t, { [f.name]: v }, {});
				if(r.ignored.some((x)=>x.reason === 'invalid')){ bad.push(`${t}.${f.name}=${JSON.stringify(v)}`); }
			});
		}));
		expect(bad).toEqual([]);
	});
	it('带显隐条件的字段:拨一个不等于现状的档 —— 报 hidden ⇔ 剪枝去掉它;报 hidden 的都写明由谁决定', ()=>{
		const mismatch = [];
		let hiddenSeen = 0;
		let visibleSeen = 0;
		tech.forEach((t)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[t];
			const base = effectiveMountBaseline(t, {});
			schema.fields.filter((f)=>typeof f.showWhen === 'function' || (f.when && typeof f.when === 'object')).forEach((f)=>{
				const norm = (x)=>(typeof f.normalize === 'function' ? f.normalize(x) : x);
				const pick = (Array.isArray(f.options) ? f.options : []).map((o)=>o.value).find((v)=>v !== '' && v !== null && `${norm(v)}` !== `${norm(base[f.name])}`);   // 归一后也不等于现状(否则剪枝按「等于现状」剪,不是显隐)
				if(pick === undefined){ return; }
				const merged = { [f.name]: pick };
				const hidden = hiddenCastOptions(t, [f.name], merged, {});
				const kept = Object.prototype.hasOwnProperty.call(pruneOptionsToNonDefault(t, merged, base), f.name);
				if((hidden.length > 0) === kept){ mismatch.push(`${t}.${f.name}`); }
				if(hidden.length){ hiddenSeen += 1; if(typeof f.showWhen === 'function' && !(hidden[0].controlledBy || []).length){ mismatch.push(`${t}.${f.name}:无控制项`); } }else{ visibleSeen += 1; }
			});
		});
		expect(mismatch).toEqual([]);
		expect(hiddenSeen).toBeGreaterThan(5);   // 判别力:矩阵里确有缺省下隐藏的字段
		expect(visibleSeen).toBeGreaterThan(5);
	});
	it('上级项同在一次 options 里先拨开:子项不再算隐藏(按合并后的上下文判)', ()=>{
		let checked = 0;
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((t)=>{
			const schema = TECHNIQUE_SETTINGS_SCHEMA[t];
			if(checked || schema.kind === 'sectionsOnly' || !Array.isArray(schema.fields)){ return; }
			schema.fields.filter((f)=>f.when && typeof f.when === 'object' && Object.keys(f.when).length === 1).forEach((f)=>{
				if(checked){ return; }
				const parent = Object.keys(f.when)[0];
				const pick = (f.options || []).map((o)=>o.value).find((v)=>v !== '' && v !== null);
				if(pick === undefined){ return; }
				const alone = hiddenCastOptions(t, [f.name], { [f.name]: pick }, {});
				if(!alone.length){ return; }
				expect(alone[0].controlledBy).toContain(parent);
				const withParent = hiddenCastOptions(t, [f.name], { [parent]: f.when[parent], [f.name]: pick }, {});
				expect(withParent).toEqual([]);
				checked += 1;
			});
		});
		expect(checked).toBe(1);
	});
});

describe('显隐按盘现状判(与剪枝同锚 effectiveMountBaseline)', ()=>{
	it('皇极轨策:存档里数字配卦是后天正数 → 「寄宫法」此刻显示,覆盖照常下发;存档没设 → 此刻不显示,写明由数字配卦决定', ()=>{
		const rec = { payload: JSON.stringify({ options: { qiguaShu: 'houtian' } }) };
		const pick = TECHNIQUE_SETTINGS_SCHEMA.guice.fields.find((f)=>f.name === 'jiGongMode').options.map((o)=>o.value).find((v)=>v !== 'ganrou');
		expect(hiddenCastOptions('guice', ['jiGongMode'], { jiGongMode: pick }, rec)).toEqual([]);
		expect(Object.keys(pruneOptionsToNonDefault('guice', { jiGongMode: pick }, effectiveMountBaseline('guice', rec)))).toEqual(['jiGongMode']);
		const h = hiddenCastOptions('guice', ['jiGongMode'], { jiGongMode: pick }, {});
		expect(h.map((x)=>[x.key, x.reason, x.controlledBy])).toEqual([['jiGongMode', 'hidden', ['qiguaShu']]]);
		expect(h[0].message).toContain('qiguaShu="xiantian"');
	});
});
