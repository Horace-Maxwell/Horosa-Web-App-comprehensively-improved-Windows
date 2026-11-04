// 决策层 · 注册表完备性:每点 定义合法(id / 分组 / 类别 / 时机 / 回落 / 金标 id / 外发说明 / 帮助句 / 四函数)· 金标集在位且非影子点 ≥ 20 条 ·
// 每条金标 truth 与 interpret().value 同形(用假答案跑一遍 interpret)· 只加严类的 isPositive 在 · 手册 / 卡片用的分组与类别标签齐 ·
// 六个存储键已登记 · 基础金标 JSON 形状。
const fs = require('fs');
const path = require('path');
import { listPoints, listPointsByGroup, getPoint, validatePointDefinition, POINT_GROUPS, POINT_KINDS, KIND_LABELS } from '../systemOne/registry';
import { GOLDEN_SETS, goldenSizes } from '../systemOne/golden';
import { CALIBRATION_MIN_ITEMS } from '../systemOne/calibration';
import { validateQuestions } from '../systemOne/questions';
import { buildRequest } from '../systemOne/wire';
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';
import { SYSTEMONE_ENABLED_KEY, SYSTEMONE_POINTS_KEY, SYSTEMONE_THRESHOLDS_KEY, SYSTEMONE_CALIBRATION_KEY, SYSTEMONE_STATS_KEY, SYSTEMONE_DISCLOSURE_KEY } from '../systemOne/prefs';

const UI = path.resolve(__dirname, '..', '..', '..');
const SHARED_IDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'D1D2', 'E1'];

// 按问题类型造一份「像真的」答案(值取 truth 无关的固定形状),只为验证 interpret 不抛且形状与 truth 同类
function fakeAnswers(questions){
	const out = {};
	Object.keys(questions).forEach((k)=>{
		const q = questions[k];
		if(q.type === 'noul'){ out[k] = { kind: 'noul', value: 0.95, confidence: 0.9, probabilities: { true: 0.95, false: 0.05 } }; }
		else if(q.type === 'choice'){ const keys = Object.keys(q.criteria); const probabilities = {}; keys.forEach((o, i)=>{ probabilities[o] = i === 0 ? 0.9 : 0.1 / Math.max(1, keys.length - 1); }); out[k] = { kind: 'choice', value: keys[0], confidence: 0.9, probabilities }; }
		else if(q.type === 'score'){ const n = q.criteria.length; out[k] = { kind: 'score', value: 0, confidence: 0.9, probabilities: { '0': 1 }, levels: q.criteria.map((l, i)=>({ index: i, label: `${l}`, p: i === 0 ? 1 : 0 })) }; }
	});
	return out;
}
const shape = (v)=>(v === null ? 'null' : (Array.isArray(v) ? 'array' : typeof v));

describe('接入点定义', ()=>{
	it('每点定义合法;id 唯一;共享 14 点恒在;分组 / 类别标签齐', ()=>{
		const points = listPoints();
		const ids = points.map((p)=>p.id);
		expect(new Set(ids).size).toBe(ids.length);
		SHARED_IDS.forEach((id)=>expect(ids).toContain(id));
		points.forEach((p)=>expect({ id: p.id, problems: validatePointDefinition(p) }).toEqual({ id: p.id, problems: [] }));
		POINT_KINDS.forEach((k)=>expect(typeof KIND_LABELS[k]).toBe('string'));
		POINT_GROUPS.forEach((g)=>expect(typeof g.label).toBe('string'));
		expect(validatePointDefinition({ id: 'a1' }).length).toBeGreaterThan(0);
		expect(getPoint('nope')).toBe(null);
		expect(listPointsByGroup('chat').map((p)=>p.id)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
	});
	it('只加严类(tighten)必有 isPositive;影子类标 shadowOnly;交互时机只给 A1 / A2 / A3(热路径)', ()=>{
		listPoints().forEach((p)=>{
			if(p.kind === 'tighten'){ expect({ id: p.id, hasPositive: typeof p.isPositive === 'function' }).toEqual({ id: p.id, hasPositive: true }); }
			if(p.kind === 'shadow'){ expect(p.shadowOnly).toBe(true); }
			if(p.timing === 'interactive'){ expect(['A1', 'A2', 'A3']).toContain(p.id); }
		});
	});
	it('每点的 buildState / buildQuestions 对金标输入产出合法请求;interpret 对假答案不抛且 value 与 truth 同形;fallback 不抛', ()=>{
		listPoints().forEach((p)=>{
			const items = GOLDEN_SETS[p.goldenId] || [];
			expect({ id: p.id, golden: items.length > 0 }).toEqual({ id: p.id, golden: true });
			items.forEach((it, i)=>{
				const state = p.buildState(it.inputs);
				const questions = p.buildQuestions(it.inputs);
				const vq = validateQuestions(questions);
				expect({ id: p.id, i, ok: vq.ok, reason: vq.reason }).toEqual({ id: p.id, i, ok: true, reason: undefined });
				const built = buildRequest({ state, questions, model: 'jev-latest' });
				expect({ id: p.id, i, ok: built.ok }).toEqual({ id: p.id, i, ok: true });
				const out = p.interpret(fakeAnswers(questions), { ...(p.defaultThresholds || {}) }, it.inputs);
				expect({ id: p.id, i, has: !!out }).toEqual({ id: p.id, i, has: true });
				const okShapes = new Set(items.map((x)=>shape(x.truth)));
				const got = shape(out.value);
				const accepted = okShapes.has(got) || (got === 'null' && p.fallback(it.inputs) === null);   // 「没有合适的」= null 是这类点的合法值(A4 / A5 粗排选中 none)
				expect({ id: p.id, i, got, truthShapes: Array.from(okShapes), accepted }).toEqual({ id: p.id, i, got, truthShapes: Array.from(okShapes), accepted: true });
				expect(()=>p.fallback(it.inputs)).not.toThrow();
			});
		});
	});
	it('金标集:非影子点 ≥ 校准最小样本数;真值只增不改(锁住每集条数下限)', ()=>{
		const sizes = goldenSizes();
		listPoints().forEach((p)=>{
			if(p.kind !== 'shadow'){ expect({ id: p.id, n: sizes[p.goldenId], min: CALIBRATION_MIN_ITEMS, ok: sizes[p.goldenId] >= CALIBRATION_MIN_ITEMS }).toEqual({ id: p.id, n: sizes[p.goldenId], min: CALIBRATION_MIN_ITEMS, ok: true }); }
		});
		expect(sizes.A1).toBeGreaterThanOrEqual(22); expect(sizes.B3).toBeGreaterThanOrEqual(22); expect(sizes.C1).toBeGreaterThanOrEqual(24); expect(sizes.D1D2).toBeGreaterThanOrEqual(22);
		// 只加严类的金标要同时含正负两类样本(误报率才有判别面)
		['A3', 'B2', 'B3'].forEach((id)=>{ const p = getPoint(id); const items = GOLDEN_SETS[p.goldenId]; const pos = items.filter((it)=>p.isPositive(it.truth)).length; expect({ id, pos, neg: items.length - pos, both: pos > 0 && pos < items.length }).toEqual({ id, pos, neg: items.length - pos, both: true }); });
	});
	it('金标集不含密钥 / 档案 id / 文件路径样式的内容(外发最小化)', ()=>{
		const dump = JSON.stringify(GOLDEN_SETS);
		expect(dump).not.toMatch(/sk-[A-Za-z0-9]{20,}|\/Users\/|C:\\\\/);
	});
});

describe('存储键与可选组标记', ()=>{
	it('六个键都在存储键注册表(备份面)', ()=>{
		const keys = STORAGE_KEY_REGISTRY.map((e)=>e.key);
		[SYSTEMONE_ENABLED_KEY, SYSTEMONE_POINTS_KEY, SYSTEMONE_THRESHOLDS_KEY, SYSTEMONE_CALIBRATION_KEY, SYSTEMONE_STATS_KEY, SYSTEMONE_DISCLOSURE_KEY].forEach((k)=>expect(keys).toContain(k));
	});
	it('基础金标 JSON 不带文件级标记;每份都是 { _doc, sets } 形状', ()=>{
		['chat', 'agent', 'memory', 'materials', 'bestof'].forEach((name)=>{
			const j = JSON.parse(fs.readFileSync(path.join(UI, 'src', 'utils', 'systemOne', 'golden', `${name}.json`), 'utf8'));
			expect({ name, marked: !!j._private, hasSets: !!j.sets && typeof j._doc === 'string' }).toEqual({ name, marked: false, hasSets: true });
		});
	});
});
