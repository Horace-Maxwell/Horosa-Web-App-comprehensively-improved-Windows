#!/usr/bin/env node
/*
 * lint-ratchet.js —— 静态检查棘轮(ESLint 规则见 .eslintrc.js;只许减少的语义与 ui-ratchet 同一公共核 scripts/ratchet-core.js)。
 *
 * 逐文件数六类「以后不该再多」的静态问题,与基线比:任何文件的任何一项只许减少(新文件按 0 起算)。
 * 存量不逼一次改完 —— 改到哪个文件顺手清掉,跑一次 --write 基线自动往下收。
 *   undef       用了没定义的名字(no-undef / react/jsx-no-undef):忘了 import,打包照过,运行到那一行才 ReferenceError
 *   unused      定义了 / 引了却没用(no-unused-vars;JSX 里用到的算用到)
 *   hooksRules  Hook 不在组件 / 自定义 Hook 顶层调用(react-hooks/rules-of-hooks)
 *   hooksDeps   effect / memo / callback 的依赖数组漏项或多项(react-hooks/exhaustive-deps)
 *   a11y        无障碍硬伤(jsx-a11y 五条,见 .eslintrc.js)
 *   lateImport  import 写在代码之后(本工具内置规则 horosa/import-first;ES 模块里 import 会提升,写在后面只会误导读的人)
 * 范围:src 下非测试 .js(.umi* / __tests__ 不计)。
 *
 * 用法:
 *   node scripts/lint-ratchet.js                汇总 + 与基线比(npm run lint:ratchet)
 *   node scripts/lint-ratchet.js --changed      只查工作树相对 HEAD 改过 / 新增的文件:逐条列出问题,并与基线比(npm run lint:changed)
 *   --write / --accept-increase / --check-tight 同 ui-ratchet(收紧 / 显式放宽 / 发布前要求基线恰等于当前)
 * 退出码:0 绿;1 有上升 / 基线不紧;2 用法错 / 缺工具链。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const core = require('./ratchet-core');
const { EXTRA_MARK, projectionOf } = require('./ui-ratchet');

const UI_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(UI_ROOT, 'src');
const BASE_SHARED = path.join(__dirname, 'lint-ratchet.baseline.json');
// 附加基线(口径同 ui-ratchet:全文含 EXTRA_MARK 的文件计入这一份;空 = 只有一份基线)
let BASE_EXTRA = '';
const sidesOf = (shared, extra)=>[['主', shared, BASE_SHARED, false]].concat(BASE_EXTRA ? [['附加', extra, BASE_EXTRA, true]] : []);
const SKIP_DIRS = new Set(['__tests__', '.umi', '.umi-production', '.umi-test', 'node_modules']);

// 规则 → 计数项(一条规则只进一项;表外规则不计)
const RULE_METRIC = {
	'no-undef': 'undef',
	'react/jsx-no-undef': 'undef',
	'no-unused-vars': 'unused',
	'react-hooks/rules-of-hooks': 'hooksRules',
	'react-hooks/exhaustive-deps': 'hooksDeps',
	'jsx-a11y/alt-text': 'a11y',
	'jsx-a11y/aria-props': 'a11y',
	'jsx-a11y/aria-role': 'a11y',
	'jsx-a11y/role-has-required-aria-props': 'a11y',
	'jsx-a11y/role-supports-aria-props': 'a11y',
	'horosa/import-first': 'lateImport',
};
const METRICS = ['undef', 'unused', 'hooksRules', 'hooksDeps', 'a11y', 'lateImport'];
const METRIC_HINT = {
	undef: '补上 import(或确属全局就在 .eslintrc.js 声明);打包不报,运行到才 ReferenceError',
	unused: '删掉没用的变量 / 引用(删功能时一起删);真要留着占位用 _ 开头命名',
	hooksRules: 'Hook 只能在组件 / 自定义 Hook 顶层无条件调用',
	hooksDeps: '依赖数组补齐(或把读到的值挪进 ref / 回调参数),不要靠漏项「冻结」旧值',
	a11y: '图片给 alt、aria-* 拼对、role 用规范值并带齐必填属性',
	lateImport: 'import 挪到文件顶部 import 块',
};

// 内置规则:import 出现在任何非 import 语句之后
const LOCAL_PLUGIN = {
	rules: {
		'import-first': {
			meta: { type: 'suggestion', docs: { description: 'import 必须在模块顶部' }, schema: [] },
			create(context){
				return {
					Program(node){
						let seenCode = false;
						node.body.forEach((s)=>{
							if(s.type === 'ImportDeclaration'){ if(seenCode){ context.report({ node: s, message: 'import 写在了代码之后:挪到顶部 import 块' }); } }
							else { seenCode = true; }
						});
					},
				};
			},
		},
	},
};

function walk(dir, out = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ if(!SKIP_DIRS.has(d.name)){ walk(p, out); } return; }
		if(d.name.endsWith('.js') && !d.name.endsWith('.test.js')){ out.push(p); }
	});
	return out;
}

function changedFiles(){
	const run = (args)=>execFileSync('git', args, { cwd: UI_ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
	const names = run(['diff', '--name-only', '--relative', 'HEAD', '--', 'src']).concat(run(['ls-files', '--others', '--exclude-standard', '--', 'src']));
	return [...new Set(names)].map((r)=>path.join(UI_ROOT, r))
		.filter((p)=>fs.existsSync(p) && p.endsWith('.js') && !p.endsWith('.test.js') && !p.split(path.sep).some((seg)=>SKIP_DIRS.has(seg)));
}

function loadEslint(){
	try{ return require('eslint').ESLint; }
	catch(e){ return null; }
}

// 跑 ESLint,按文件归桶计数;returnMessages=true 时另回逐条问题(--changed 列给人看)
// ESLint 实例单源(本脚本与 jest lintRatchet 共用):规则读 .eslintrc.js,另挂内置规则
function makeEslint({ cache = true } = {}){
	const ESLint = loadEslint();
	return new ESLint({
		cwd: UI_ROOT,
		useEslintrc: true,
		cache,
		cacheLocation: path.join(UI_ROOT, 'node_modules', '.cache', 'lint-ratchet', '.eslintcache'),
		plugins: { horosa: LOCAL_PLUGIN },
		overrideConfig: { plugins: ['horosa'], rules: { 'horosa/import-first': 'error' } },
	});
}

async function measure(files, { returnMessages } = {}){
	const eslint = makeEslint();
	const results = await eslint.lintFiles(files);
	const shared = { metrics: {}, lines: {} };
	const extra = { metrics: {}, lines: {} };
	METRICS.forEach((k)=>{ shared.metrics[k] = {}; extra.metrics[k] = {}; });
	const messages = [];
	const tally = (msgs)=>{
		const o = {};
		msgs.forEach((m)=>{ const k = !m.fatal && RULE_METRIC[m.ruleId]; if(k){ o[k] = (o[k] || 0) + 1; } });
		return o;
	};
	for(const r of results){
		const rel = path.relative(SRC, r.filePath).split(path.sep).join('/');
		const text = fs.readFileSync(r.filePath, 'utf8');
		const wholeExtra = !!EXTRA_MARK && text.indexOf(EXTRA_MARK) >= 0;
		r.messages.forEach((m)=>{
			if(m.fatal){ messages.push({ rel, line: m.line, metric: 'parse', text: m.message }); return; }
			const k = RULE_METRIC[m.ruleId];
			if(k && returnMessages){ messages.push({ rel, line: m.line, metric: k, text: `${m.message}(${m.ruleId})` }); }
		});
		const full = tally(r.messages);
		// 主基线按 projectionOf(全文) 的检查结果计数;全文比它多出来的计入附加基线(两者相同的文件只查一遍)
		const body = wholeExtra ? text : projectionOf(text);
		let main = full;
		if(body !== text){
			// eslint-disable-next-line no-await-in-loop
			const [pr] = await eslint.lintText(body, { filePath: r.filePath });
			main = tally(pr.messages);
			if(returnMessages){
				pr.messages.forEach((m)=>{
					const k = !m.fatal && RULE_METRIC[m.ruleId];
					if(k && !r.messages.some((x)=>x.ruleId === m.ruleId && x.message === m.message)){ messages.push({ rel, line: m.line, metric: k, text: `${m.message}(${m.ruleId};行号按主基线计数的那份内容算)` }); }
				});
			}
			Object.keys(full).forEach((k)=>{ const more = full[k] - (main[k] || 0); if(more > 0){ extra.metrics[k][rel] = more; } });
		}
		const bucket = wholeExtra ? extra : shared;
		Object.keys(main).forEach((k)=>{ bucket.metrics[k][rel] = main[k]; });
	}
	return { shared, extra, messages };
}

const compare = (cur, base)=>core.compareMetrics(cur, base, METRICS);
const totals = (side)=>core.sumMetrics(side, METRICS);
function writeBase(file, side, isExtra){
	core.writeBaseFile(file, side, {
		metrics: METRICS, isExtra, marker: EXTRA_MARK,
		doc: '静态检查棘轮基线(scripts/lint-ratchet.js,规则 .eslintrc.js):逐文件计数只许减少。清掉了跑 npm run lint:ratchet -- --write 收紧;真要增加须加 --accept-increase 并在提交里说明。',
	});
}

// --changed:只比改过的文件(基线里别的文件不参与「收紧」判定)
function restrict(base, rels){
	const keep = new Set(rels);
	return { metrics: Object.fromEntries(METRICS.map((k)=>[k, Object.fromEntries(Object.entries((base.metrics || {})[k] || {}).filter(([f])=>keep.has(f)))])), lines: {} };
}

async function main(argv){
	if(!loadEslint()){ console.error('lint-ratchet: 缺 eslint 工具链(在 Horosa-Web/astrostudyui 下 npm install)—— 判据失效即红'); return 2; }
	const changed = argv.includes('--changed');
	const rest = argv.filter((a)=>a !== '--changed');
	if(changed && rest.some((a)=>a === '--write' || a === '--check-tight')){ console.error('lint-ratchet: --changed 只查不写,不与 --write / --check-tight 同用'); return 2; }
	const files = changed ? changedFiles() : walk(SRC);
	if(changed && !files.length){ console.log('[lint-ratchet] 工作树相对 HEAD 没有改过的源码文件'); return 0; }
	const { shared, extra, messages } = await measure(files, { returnMessages: changed });
	const parseFails = messages.filter((m)=>m.metric === 'parse');
	parseFails.forEach((m)=>console.error(`  ✗ 解析失败 ${m.rel}:${m.line} ${m.text}`));
	if(changed){
		messages.filter((m)=>m.metric !== 'parse').forEach((m)=>console.log(`  · ${m.rel}:${m.line} [${m.metric}] ${m.text}`));
		const rels = files.map((p)=>path.relative(SRC, p).split(path.sep).join('/'));
		const sides = sidesOf(shared, extra).map(([n, cur, file, isExtra])=>[n, cur, file, isExtra, restrict(core.loadBase(file), rels)]);
		let bad = parseFails.length ? 1 : 0;
		sides.forEach(([name, cur, , , base])=>{
			const { increases } = compare(cur, base);
			increases.forEach((x)=>console.log(`  ↑ ${x.metric} ${x.file}: ${x.base} → ${x.cur}  —— ${METRIC_HINT[x.metric]}`));
			if(increases.length){ bad = 1; console.error(`  ✗ ${name}:改过的文件里有 ${increases.length} 项比基线多`); }
		});
		if(!bad){ console.log(`[lint-ratchet] 改过的 ${files.length} 个文件不超基线`); }
		return bad;
	}
	const code = core.runRatchetCli({
		tag: 'lint-ratchet', argv: rest,
		sides: sidesOf(shared, extra),
		compare, totals, writeBase, hint: (k)=>METRIC_HINT[k], fixCmd: 'npm run lint:ratchet -- --write',
	});
	return parseFails.length ? Math.max(code, 1) : code;
}

module.exports = { RULE_METRIC, METRICS, METRIC_HINT, LOCAL_PLUGIN, BASE_SHARED, makeEslint, measure, compare, loadBase: core.loadBase, walk, SRC };

if(require.main === module){
	main(process.argv.slice(2)).then((c)=>process.exit(c), (e)=>{ console.error(`lint-ratchet: ${e && e.stack || e}`); process.exit(2); });
}
