// 全技法齿轮差分闸的分片计划(非 .test.js:测试公因子)。
//
// 为什么分片:差分闸是全量 jest 里最慢的单个文件(在线全谱约 68 分钟,单文件串行),它一个文件就定了全量 jest 的墙钟,
// 其余一千多套件早跑完了。各齿轮的判定互相独立(只共用「同一盘变体 × 同一上下文」缺省路径两遍的基线,
// 那是可重算的缓存,不是状态),所以按「技法 × 齿轮」为单位切到 DIFFNET_SHARDS 个分片文件并行。
//
// 怎么分(确定性,同一份登记表与耗时表永远分出同一结果):
//   单位 = 每个有字段技法(sectionsOnly 除外)的每个齿轮,顺序同 TECHNIQUE_SETTINGS_SCHEMA;
//   耗时 = mountSettingsDiffAll.costs.json 里实测的毫秒数(在线全谱实跑,经 scripts/diffnet_costs.js 从判定产物重生成);
//          表里没有的单位(新加的齿轮)按已知耗时的中位数估;
//   分法 = 最长处理时间优先(LPT):按耗时降序,每个单位放进当前负载最小的分片;负载相同优先放进已有同技法齿轮的分片
//          (少重算一份基线),再比分片序号。负载再加上「分片里每多一个技法就多算一份基线」的估计(KEY_SETUP_MS)。
// 覆盖合同(mountSettingsDiffAllPlan.test.js):全部单位恰好各进一个分片;分片文件 1..N 都在、各调自己那一片;
// 每个分片运行时再核自己跑到的齿轮数 = 计划给它的数(齿轮漏跑当场红)。
const { TECHNIQUE_SETTINGS_SCHEMA } = require('../techniqueMountSettings');
const COSTS = require('./mountSettingsDiffAll.costs.json');

const DIFFNET_SHARDS = 12;
// 一个分片里每出现一个技法,要先把该技法各盘变体的缺省路径各跑两遍定噪声(基线);按实测量级估一个固定值
const KEY_SETUP_MS = 4000;

function diffnetKeys(schemaMap = TECHNIQUE_SETTINGS_SCHEMA){
	return Object.keys(schemaMap).filter((k)=>{ const s = schemaMap[k]; return s && s.kind !== 'sectionsOnly' && Array.isArray(s.fields) && s.fields.length; });
}

// 全部单位(按登记表顺序);only = 只跑这些技法(HOROSA_DIFFNET_ONLY)
function diffnetUnits(schemaMap = TECHNIQUE_SETTINGS_SCHEMA, only = null){
	const out = [];
	diffnetKeys(schemaMap).filter((k)=>!only || only.includes(k)).forEach((key)=>{
		schemaMap[key].fields.forEach((f)=>{ out.push({ key, name: f.name, id: `${key}.${f.name}` }); });
	});
	return out;
}

function median(xs){
	if(!xs.length){ return 1000; }
	const s = xs.slice().sort((a, b)=>a - b);
	return s[Math.floor(s.length / 2)];
}

// 返回 N 个分片,每片是单位数组(片内按登记表原顺序排,判定顺序与分片前同技法内一致)
function planShards(units, n = DIFFNET_SHARDS, costs = COSTS.costs || {}){
	const known = Object.values(costs).filter((x)=>Number.isFinite(x));
	const fallback = median(known);
	const order = units.map((u, i)=>({ u, i, c: Number.isFinite(costs[u.id]) ? costs[u.id] : fallback }))
		.sort((a, b)=>(b.c - a.c) || (a.i - b.i));
	const shards = Array.from({ length: n }, ()=>({ load: 0, keys: new Set(), items: [] }));
	order.forEach(({ u, i, c })=>{
		let best = -1; let bestLoad = Infinity;
		shards.forEach((s, si)=>{
			const load = s.load + c + (s.keys.has(u.key) ? 0 : KEY_SETUP_MS);
			if(load < bestLoad || (load === bestLoad && best >= 0 && s.keys.has(u.key) && !shards[best].keys.has(u.key))){ best = si; bestLoad = load; }
		});
		const s = shards[best];
		s.load = bestLoad; s.keys.add(u.key); s.items.push({ u, i });
	});
	return shards.map((s)=>s.items.sort((a, b)=>a.i - b.i).map((x)=>x.u));
}

// 第 k 片(1 起)
function shardUnits(k, n = DIFFNET_SHARDS, only = null){
	return planShards(diffnetUnits(TECHNIQUE_SETTINGS_SCHEMA, only), n)[k - 1] || [];
}

module.exports = { DIFFNET_SHARDS, KEY_SETUP_MS, diffnetKeys, diffnetUnits, planShards, shardUnits };
