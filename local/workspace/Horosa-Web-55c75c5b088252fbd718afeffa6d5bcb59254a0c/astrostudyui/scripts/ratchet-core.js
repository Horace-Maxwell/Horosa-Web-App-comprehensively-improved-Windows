/*
 * ratchet-core.js —— 逐文件计数棘轮的公共核(ui-ratchet.js 写法棘轮 / lint-ratchet.js 静态检查棘轮共用)。
 *
 * 语义(两个棘轮完全相同,只在这里写一次):
 *   · 逐文件、逐项计数,与基线比:任何文件的任何一项只许减少、不许增加(新文件按 0 起算);
 *   · --write 把基线收到当前值,有上升时拒写;--write --accept-increase 连上升一起写(显式决策,提交里要说明);
 *   · --check-tight 基线必须恰等于当前值(改好了却没收基线 = 红,否则下一次能悄悄涨回旧值);
 *   · 调用方可以另给一份附加基线:全文含指定字样的文件计入附加基线,不进主基线。
 * 计数形状:side = { metrics: { 项名: { 文件: 次数 } }, lines?: { 文件: 行数 } }(lines 是 ui-ratchet 专有的超长文件项,由调用方自比)。
 */
const fs = require('fs');

function loadBase(file){
	if(!fs.existsSync(file)){ return { metrics: {}, lines: {} }; }
	const j = JSON.parse(fs.readFileSync(file, 'utf8'));
	return { metrics: j.metrics || {}, lines: j.lines || {} };
}

// 与基线比(只比 metrics 里列出的项):回 { increases, loose }(increases = 新增 / 上升;loose = 基线比当前宽)
function compareMetrics(cur, base, metrics){
	const increases = [];
	const loose = [];
	metrics.forEach((k)=>{
		const c = (cur.metrics || {})[k] || {};
		const b = (base.metrics || {})[k] || {};
		Object.keys(c).forEach((f)=>{ if(c[f] > (b[f] || 0)){ increases.push({ metric: k, file: f, base: b[f] || 0, cur: c[f] }); } });
		Object.keys(b).forEach((f)=>{ if((c[f] || 0) < b[f]){ loose.push({ metric: k, file: f, base: b[f], cur: c[f] || 0 }); } });
	});
	return { increases, loose };
}

const sumMetrics = (side, metrics)=>Object.fromEntries(metrics.map((k)=>[k, Object.values((side.metrics || {})[k] || {}).reduce((a, b)=>a + b, 0)]));
const sortObj = (o)=>Object.fromEntries(Object.keys(o || {}).sort().map((k)=>[k, o[k]]));

// 基线文件:附加那份带 _marker(字样由调用方传入)
function writeBaseFile(file, side, { metrics, isExtra, marker, doc, withLines }){
	const out = {
		...(isExtra ? { _marker: marker } : {}),
		_doc: doc,
		metrics: Object.fromEntries(metrics.map((k)=>[k, sortObj((side.metrics || {})[k])])),
		...(withLines ? { lines: sortObj(side.lines) } : {}),
	};
	fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
}

/**
 * 命令行主流程。opts:
 *   tag        日志前缀(如 'ui-ratchet')
 *   argv       命令行参数(已去掉 node 与脚本名)
 *   extraFlags 本工具额外认的参数(主流程只校验不解读)
 *   sides      [[显示名, 当前计数, 基线文件, 是否附加基线], …]
 *   compare(cur, base) / totals(cur) / writeBase(file, cur, isExtra) / hint(项名) / fixCmd(收紧基线的命令文字)
 * 退出码:0 绿;1 有上升 / 基线不紧 / 拒写;2 用法错。
 */
function runRatchetCli(opts){
	const { tag, argv, sides, compare, totals, writeBase, hint, fixCmd } = opts;
	const known = ['--write', '--accept-increase', '--check-tight'].concat(opts.extraFlags || []);
	const unknown = argv.filter((a)=>known.indexOf(a) < 0);
	if(unknown.length){ console.error(`${tag}: 不认识的参数 ${unknown.join(' ')}`); return 2; }
	const write = argv.includes('--write');
	const accept = argv.includes('--accept-increase');
	const tight = argv.includes('--check-tight');
	let bad = 0;
	sides.forEach(([name, cur, file, isExtra])=>{
		const empty = !Object.values(cur.metrics || {}).some((o)=>Object.keys(o).length) && !Object.keys(cur.lines || {}).length;
		if(isExtra && !fs.existsSync(file) && empty){ return; }
		const base = loadBase(file);
		const { increases, loose } = compare(cur, base);
		console.log(`[${tag}] ${name}: ${JSON.stringify(totals(cur))}`);
		increases.forEach((x)=>console.log(`  ↑ ${x.metric} ${x.file}: ${x.base} → ${x.cur}  —— ${hint(x.metric)}`));
		if(write){
			if(increases.length && !accept){ console.error(`  ✗ ${name}基线有 ${increases.length} 处上升,拒写(确属有意增加:加 --accept-increase 并在提交里说明)`); bad = 1; return; }
			writeBase(file, cur, isExtra);
			console.log(`  ✓ ${name}基线已写(收紧 ${loose.length} 处)`);
			return;
		}
		if(increases.length){ bad = 1; }
		if(tight && loose.length){
			loose.slice(0, 20).forEach((x)=>console.log(`  ↓ 基线未收紧 ${x.metric} ${x.file}: 基线 ${x.base} / 当前 ${x.cur}`));
			console.error(`  ✗ ${name}基线有 ${loose.length} 处比当前宽 —— 跑 ${fixCmd} 收紧`);
			bad = 1;
		}
	});
	return bad;
}

module.exports = { loadBase, compareMetrics, sumMetrics, writeBaseFile, runRatchetCli };
