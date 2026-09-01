// [黄历择日 压测] 日粒度专用(不套 zeriStressKit 分钟语义):全类型全取值×随机树 fuzz,
// 中心不变量=scanHuangli 行日覆盖 ≡ 逐日 buildHuangliDay+evaluateHuangliTree 独立真值。
import { scanHuangli, evaluateHuangliTree, HUANGLI_MAX_TOTAL_HITS } from '../huangliZeriScanEngine';
import { HUANGLI_CONDITION_TYPES, newHuangliLeaf, newHuangliGroup, compileHuangliTree, makeHuangliZeriEvalCtx } from '../huangliZeriConditionTypes';
import { buildHuangliDay } from '../../../components/calendar/huangliDay';

jest.setTimeout(600000);

// 60 天窗:跨两个月+至少一节气翻转(建除/月家系字段变面)
const WIN = { startDate: '2026-05-01', endDate: '2026-06-29' };
const MATRIX = [];

function* eachDay(startDate, endDate){
	const [y0, m0, d0] = startDate.split('-').map(Number);
	const [y1, m1, d1] = endDate.split('-').map(Number);
	const mk = (y, m, d)=>{ const t = new Date(0); t.setUTCFullYear(y, m - 1, d); return t; };
	for(let t = mk(y0, m0, d0); t <= mk(y1, m1, d1); t = new Date(t.getTime() + 86400e3)){
		yield { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
	}
}
const pad2 = (n)=>(n < 10 ? `0${n}` : `${n}`);
const ymd = (w)=>`${w.y}-${pad2(w.m)}-${pad2(w.d)}`;

async function scanAndSweep(id, uiRoot, cfg){
	const c = cfg || WIN;
	const compiled = compileHuangliTree(uiRoot);
	const res = await scanHuangli({ cfg: c, tree: compiled });
	const mismatches = [];
	// 良构:行按日连续合并/不重叠/days 自洽
	let prevEnd = -Infinity;
	res.intervals.forEach((r)=>{
		if(!(r.endOrd >= r.startOrd)){ mismatches.push(`空行 ${r.start}`); }
		if(!(r.startOrd > prevEnd)){ mismatches.push(`重叠/未合并 ${r.start}`); }
		if(r.days !== r.endOrd - r.startOrd + 1){ mismatches.push(`days 不自洽 ${r.start}`); }
		prevEnd = r.endOrd;
	});
	// 恒等:逐日真值 vs 行覆盖
	const covered = (ord)=>res.intervals.some((r)=>r.startOrd <= ord && ord <= r.endOrd);
	for(const w of eachDay(c.startDate, c.endDate)){
		const day = buildHuangliDay(w.y, w.m, w.d);
		const pass = day ? !!evaluateHuangliTree(compiled, day, null, false).pass : false;
		const t = new Date(0); t.setUTCFullYear(w.y, w.m - 1, w.d);
		const ord = Math.round(t.getTime() / 86400e3);
		if(pass !== covered(ord)){
			mismatches.push(`${ymd(w)} 真值=${pass} 覆盖=${covered(ord)}`);
		}
	}
	MATRIX.push({ id, hits: res.intervals.length });
	expect({ id, mismatches }).toEqual({ id, mismatches: [] });
	return res;
}

afterAll(()=>{
	const zero = MATRIX.filter((r)=>r.hits === 0).length;
	// eslint-disable-next-line no-console
	console.log(`[huangli 压测矩阵] 共 ${MATRIX.length} 行;零命中 ${zero} 行(0 命中亦须真值全假,已恒等)`);
});

describe('S1 全类型全取值穷举', ()=>{
	const cases = [];
	Object.keys(HUANGLI_CONDITION_TYPES).forEach((type)=>{
		const spec = HUANGLI_CONDITION_TYPES[type];
		const selectFields = (spec.fields || []).filter((f)=>(f.kind === 'select' || f.kind === 'multiselect') && Array.isArray(f.options) && f.options.length);
		if(!selectFields.length){
			cases.push({ id: `${type}·defaults`, type, params: {} });
			return;
		}
		selectFields.forEach((f)=>{
			f.options.forEach((o)=>{
				const v = o && o.value !== undefined ? o.value : o;
				cases.push({ id: `${type}·${f.key}=${JSON.stringify(v)}`, type, params: { [f.key]: f.kind === 'multiselect' ? [v] : v } });
			});
		});
	});
	cases.forEach((c)=>{
		it(`S1·${c.id}`, async ()=>{
			const leaf = newHuangliLeaf(c.type);
			leaf.params = { ...leaf.params, ...c.params };
			const root = { ...newHuangliGroup('all'), children: [leaf] };
			try{
				compileHuangliTree(root);
			}catch(e){
				MATRIX.push({ id: `S1·${c.id}·SKIP`, hits: -1 });
				return;	// validate 撞墙=非判定面(kit 同律)
			}
			await scanAndSweep(`S1·${c.id}`, root);
		});
	});
});

describe('S3 随机树 fuzz', ()=>{
	let seed = 20260829;
	const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	const types = Object.keys(HUANGLI_CONDITION_TYPES);
	const JOINERS = ['all', 'any', 'xor'];
	const randomLeaf = ()=>{
		const t = types[Math.floor(rnd() * types.length)];
		const leaf = newHuangliLeaf(t);
		// [复审 F11] 叶参数随机化:恒默认参数=跨字段非默认组合零覆盖——随机改一个 select
		// 字段值(multiselect 单值形;validate 撞墙由 compile 预检兜)
		const spec = HUANGLI_CONDITION_TYPES[t];
		const sf = ((spec && spec.fields) || []).filter((x)=>(x.kind === 'select' || x.kind === 'multiselect') && Array.isArray(x.options) && x.options.length);
		if(sf.length && rnd() < 0.7){
			const fld = sf[Math.floor(rnd() * sf.length)];
			const o = fld.options[Math.floor(rnd() * fld.options.length)];
			const v = o && o.value !== undefined ? o.value : o;
			leaf.params = { ...leaf.params, [fld.key]: fld.kind === 'multiselect' ? [v] : v };
		}
		leaf.negate = rnd() < 0.3;
		leaf.joiner = JOINERS[Math.floor(rnd() * 3)];
		return leaf;
	};
	for(let i = 0; i < 10; i++){
		it(`S3·fuzz#${i}`, async ()=>{
			const group = { ...newHuangliGroup(JOINERS[Math.floor(rnd() * 3)]), children: [randomLeaf(), randomLeaf()], negate: rnd() < 0.3 };
			group.joiner = JOINERS[Math.floor(rnd() * 3)];
			const root = { ...newHuangliGroup('all'), children: [randomLeaf(), group] };
			try{
				compileHuangliTree(root);
			}catch(e){
				MATRIX.push({ id: `S3·fuzz#${i}·SKIP`, hits: -1 });
				return;
			}
			await scanAndSweep(`S3·fuzz#${i}`, root);
		});
	}
});

describe('S4 边界窗', ()=>{
	it('S4·跨年窗(建除/太岁翻转)', async ()=>{
		const leaf = newHuangliLeaf(Object.keys(HUANGLI_CONDITION_TYPES)[0]);
		await scanAndSweep('S4·newyear', { ...newHuangliGroup('all'), children: [leaf] }, { startDate: '2026-12-20', endDate: '2027-02-10' });
	});
});
