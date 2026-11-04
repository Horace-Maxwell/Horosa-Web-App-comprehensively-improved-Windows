#!/usr/bin/env node
// 全技法齿轮差分闸的产物工具(HOROSA_DIFFNET_OUT 落的判定文件;分片时每片一份 *.shard<k>of<N>.json)。
//   重生成分片耗时表:node scripts/diffnet_costs.js --costs <产物…>
//     → 写 src/utils/__tests__/mountSettingsDiffAll.costs.json(同一齿轮出现多次取中位数;只收在线全谱的产物)
//   合并分片产物:    node scripts/diffnet_costs.js --merge <产物…> --out <合并.json>
//     → 一份与分片前单文件同形的判定文件(results 按 技法.齿轮 排序;counts / strengthCounts 重算)
//   对拍两份判定:    node scripts/diffnet_costs.js --compare <a.json> <b.json>
//     → 逐齿轮比 verdict / via / value / strength / tries / evidence,有差异 exit 1(耗时 ms 不比)
const fs = require('fs');
const path = require('path');

const COSTS_FILE = path.join(__dirname, '..', 'src', 'utils', '__tests__', 'mountSettingsDiffAll.costs.json');

function load(files){
	return files.map((f)=>({ file: f, data: JSON.parse(fs.readFileSync(f, 'utf8')) }));
}
function median(xs){ const s = xs.slice().sort((a, b)=>a - b); return s[Math.floor(s.length / 2)]; }
const idOf = (r)=>`${r.key}.${r.name}`;

function merged(inputs){
	const online = inputs.every((x)=>x.data.online === true);
	const byId = new Map();
	inputs.forEach((x)=>(x.data.results || []).forEach((r)=>{
		const id = idOf(r);
		if(byId.has(id)){ throw new Error(`齿轮 ${id} 在多个产物里出现(${x.file}):合并只收同一次运行的各分片`); }
		byId.set(id, r);
	}));
	const results = [...byId.keys()].sort().map((id)=>byId.get(id));
	const counts = results.reduce((a, r)=>{ a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
	const strengthCounts = results.filter((r)=>r.verdict === 'OK').reduce((a, r)=>{ const k = r.strength === 'weak' ? `weak:${`${r.via}`.split('@')[0]}` : 'strong'; a[k] = (a[k] || 0) + 1; return a; }, {});
	return { online, counts, strengthCounts, results };
}

const COMPARE_KEYS = ['verdict', 'via', 'value', 'strength', 'tries', 'evidence', 'note', 'weakVia'];
function compare(a, b){
	const A = new Map((a.results || []).map((r)=>[idOf(r), r]));
	const B = new Map((b.results || []).map((r)=>[idOf(r), r]));
	const diffs = [];
	new Set([...A.keys(), ...B.keys()]).forEach((id)=>{
		const x = A.get(id); const y = B.get(id);
		if(!x || !y){ diffs.push(`${id}: 只在${x ? '前' : '后'}一份里`); return; }
		COMPARE_KEYS.forEach((k)=>{ if(JSON.stringify(x[k]) !== JSON.stringify(y[k])){ diffs.push(`${id}.${k}: ${JSON.stringify(x[k])} ≠ ${JSON.stringify(y[k])}`); } });
	});
	return diffs;
}

function main(argv){
	const mode = argv[0];
	if(mode === '--costs'){
		const inputs = load(argv.slice(1));
		if(!inputs.length){ throw new Error('没给产物文件'); }
		const off = inputs.filter((x)=>x.data.online !== true).map((x)=>x.file);
		if(off.length){ throw new Error(`耗时表只收在线全谱的产物(离线只判蒸发、耗时不具代表性):${off.join(', ')}`); }
		const per = new Map();
		inputs.forEach((x)=>(x.data.results || []).forEach((r)=>{ if(Number.isFinite(r.ms)){ const id = idOf(r); if(!per.has(id)){ per.set(id, []); } per.get(id).push(r.ms); } }));
		if(!per.size){ throw new Error('产物里没有逐齿轮耗时(ms):用带计时的差分闸重跑'); }
		const old = fs.existsSync(COSTS_FILE) ? JSON.parse(fs.readFileSync(COSTS_FILE, 'utf8')) : {};
		const costs = {};
		[...per.keys()].sort().forEach((id)=>{ costs[id] = Math.max(1, Math.round(median(per.get(id)))); });
		fs.writeFileSync(COSTS_FILE, `${JSON.stringify({ _doc: old._doc, costs }, null, 1)}\n`);
		console.log(`耗时表已写:${per.size} 个齿轮 → ${path.relative(process.cwd(), COSTS_FILE)}`);
		return 0;
	}
	if(mode === '--merge'){
		const oi = argv.indexOf('--out');
		if(oi < 0 || !argv[oi + 1]){ throw new Error('--merge 要 --out <合并.json>'); }
		const files = argv.slice(1).filter((_f, i)=>i + 1 !== oi && i + 1 !== oi + 1);
		const m = merged(load(files));
		fs.writeFileSync(argv[oi + 1], JSON.stringify(m, null, 1));
		console.log(`合并 ${files.length} 份 → ${m.results.length} 个齿轮 ${JSON.stringify(m.counts)}`);
		return 0;
	}
	if(mode === '--compare'){
		const [a, b] = load(argv.slice(1, 3)).map((x)=>x.data);
		const diffs = compare(a, b);
		if(diffs.length){ console.log(diffs.slice(0, 200).join('\n')); console.log(`共 ${diffs.length} 处不同`); return 1; }
		console.log(`逐齿轮相同:${(a.results || []).length} 个齿轮`);
		return 0;
	}
	console.error('用法:diffnet_costs.js --costs <产物…> | --merge <产物…> --out <合并.json> | --compare <a.json> <b.json>');
	return 2;
}

if(require.main === module){
	try{ process.exit(main(process.argv.slice(2))); }catch(e){ console.error(`❌ ${e.message}`); process.exit(2); }
}
module.exports = { merged, compare };
