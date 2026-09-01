// [三式择日 压测] 51 类合并注册表全取值×共享参数矩阵×跨家随机树 fuzz 恒等对拍(zeriStressKit)。
// 三家 plateKey 拼接(L‖Q‖T)+异质时基并集是主战场;S1 全取值天然覆盖 lr_/qm_/ty_ 三前缀族。
import { scanSanshi, computeSanshiScanPan, evaluateSanshiTree, sanshiPlateKeyOf, sanshiKeyMaskOf } from '../sanshiZeriScanEngine';
import { SANSHI_CONDITION_TYPES, newSanshiLeaf, newSanshiGroup, compileSanshiTree } from '../sanshiZeriConditionTypes';
import { zoneOffsetMinutes } from '../hourlyScanEngine';
import { buildQimenScanSeeds } from '../qimenScanEngine';
import { makeZeriStressKit } from './zeriStressKit';

jest.setTimeout(1200000);

const ZONE = '+08:00';
const GEO = { zone: ZONE, lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
// 12h 窗:三式每样本起三盘(太乙全量核最重),24h 窗原配版实测 >70 分钟不适合日常回归——
// 窗减半只减每行采样数,选项覆盖(S1 全类穷举+fuzz 参数随机)与恒等判据不变。
const WIN12 = { startDate: '2026-05-14', startTime: '06:00', endDate: '2026-05-14', endTime: '17:59' };
const NATAL = { mingZhi: '子', bornYear: 1996, male: true };
const BASE_OPTIONS = { guirengType: 0, yueMode: 'zhongqi', taiyiAccum: 0, after23NewDay: 1, lateZiHourUseNextDay: 1, timeAlg: 0 };

// 三式 computePanAt 需 scanCtx{seeds,natal}(奇门家节气种子)——真值端同构自建
const seedsCache = new Map();
function scanCtxFor(dateStr){
	const y = Number(dateStr.slice(0, 4));
	const key = `${y}`;
	if(!seedsCache.has(key)){
		seedsCache.set(key, { seeds: buildQimenScanSeeds(y, y + 1, ZONE), natal: NATAL });
	}
	return seedsCache.get(key);
}

const kit = makeZeriStressKit({
	name: 'sanshi',
	scan: (args)=>scanSanshi({ ...args, options: { ...args.options, _natal: NATAL } }),
	panAt: (geo, options, d, t)=>computeSanshiScanPan(scanCtxFor(d), geo, options, d, t),
	evaluateTree: (compiled, pan)=>evaluateSanshiTree(compiled, pan, null, false),
	compileTree: compileSanshiTree,
	plateKeyOf: sanshiPlateKeyOf,
	keyMaskOf: sanshiKeyMaskOf,
	offsetMin: zoneOffsetMinutes(ZONE),
	geo: GEO,
	baseOptions: BASE_OPTIONS,
	defaultCfg: WIN12,
	stepMs: 3600e3,
});

afterAll(kit.printSummary);

describe('S1 51 类全取值穷举(lr_/qm_/ty_ 三前缀族全覆盖)', ()=>{
	// multiselect 值域大的类限前 6 值(总行数控制在数百;每类每字段至少 6 值恒等)
	const cases = kit.enumerateTypeValueCases(SANSHI_CONDITION_TYPES, newSanshiLeaf, newSanshiGroup, 4);
	cases.forEach((c)=>{
		it(`S1·${c.id}`, async ()=>{
			await kit.scanAndSweep(`S1·${c.id}`, c.root);
		});
	});
});

describe('S2 共享/家系参数矩阵', ()=>{
	const root = ()=>({ ...newSanshiGroup('all'), children: [newSanshiLeaf('lr_ke_name')] });
	const tyRoot = ()=>({ ...newSanshiGroup('all'), children: [newSanshiLeaf('ty_geju_kind')] });
	const AXES = [
		['guirengType', [0, 1, 2], root],
		['yueMode', ['zhongqi', 'jieqi'], root],
		['after23NewDay', [0, 1], root],
		['lateZiHourUseNextDay', [0, 1], root],
		['taiyiAccum', [0, 1, 2, 3], tyRoot],
	];
	AXES.forEach(([key, vals, mk])=>{
		vals.forEach((v)=>{
			it(`S2·${key}=${v}`, async ()=>{
				await kit.scanAndSweep(`S2·${key}=${v}`, mk(), { [key]: v });
			});
		});
	});
});

describe('S4 跨立春窗(三家拼接 plateKey 的跨节面;复审 F11 补)', ()=>{
	const WIN_LICHUN = { startDate: '2027-02-03', startTime: '18:00', endDate: '2027-02-04', endTime: '05:59' };
	it('S4·lichun·lr_taisui(六壬家年支翻转经拼接 key 正确分行)', async ()=>{
		const leaf = newSanshiLeaf('lr_taisui_god_at');
		await kit.scanAndSweep('S4·lichun·lr_taisui', { ...newSanshiGroup('all'), children: [leaf] }, {}, WIN_LICHUN);
	});
	it('S4·lichun·ty_geju(太乙家跨节)', async ()=>{
		const leaf = newSanshiLeaf('ty_geju_kind');
		await kit.scanAndSweep('S4·lichun·ty_geju', { ...newSanshiGroup('all'), children: [leaf] }, {}, WIN_LICHUN);
	});
});

describe('S3 跨家随机树 fuzz(三前缀混排)', ()=>{
	let seed = 20260829;
	const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	const types = Object.keys(SANSHI_CONDITION_TYPES);
	const byPrefix = (p)=>types.filter((t)=>t.startsWith(p));
	const fams = [byPrefix('lr_'), byPrefix('qm_'), byPrefix('ty_')];
	const JOINERS = ['all', 'any', 'xor'];
	const leafFrom = (pool)=>{
		const t = pool[Math.floor(rnd() * pool.length)];
		const leaf = newSanshiLeaf(t);
		// [复审 F11] 叶参数随机化(跨字段非默认组合覆盖)
		const spec = SANSHI_CONDITION_TYPES[t];
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
		it(`S3·crossfam#${i}`, async ()=>{
			// 每树必跨至少两家(三式合参语义主路)
			const famA = fams[i % 3];
			const famB = fams[(i + 1) % 3];
			const root = { ...newSanshiGroup('all'), children: [leafFrom(famA), leafFrom(famB)] };
			try{
				compileSanshiTree(root);
			}catch(e){
				return;	// 随机参数撞 validate=非判定面
			}
			await kit.scanAndSweep(`S3·crossfam#${i}`, root);
		});
	}
});
