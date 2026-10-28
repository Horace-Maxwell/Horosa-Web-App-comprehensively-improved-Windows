// 设置写入方丢掉写入回值、照样把内存里那份广播出去:存储满(或坏原串封锁)时界面显示「已开 / 已保存」,
// 真正读的时候(发送组上下文、选模型)读的是存储里的旧值 —— 显示与生效对不上,刷新后又变回去。
// 现在:没写进 → 按存储里实际的值广播与返回,并派「没能保存」事件(AI 分析页提示一次)。
// 源码合同:写入回值被丢弃、随后又把同一个值广播出去的写法一律红;本次运行以内存态为准的设计登记在下表。
import fs from 'fs';
import path from 'path';
import { SETTING_NOT_SAVED_EVENT } from '../safeStorage';

const { parseModule } = require('./helpers/importSpecs');
const traverse = require('@babel/traverse').default;
const SRC = path.resolve(__dirname, '../..');

// 文件(相对 src):为什么写不进时广播内存值是对的
const IN_SESSION_TRUTH = {
	'utils/classicalChartGlobals.js': '模块内存缓存是本次运行的读出处(界面上改的值本次运行照样生效,与全局设置镜像同一口径)',
	'utils/divinationJudgeGlobals.js': '同上:模块内存缓存是本次运行的读出处',
	'components/germany/UranianDialStyle.js': '显示偏好:页面状态本次运行以 setState 为准,广播只为让父组件重渲',
};

function walk(dir, acc){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== '.umi' && e.name !== '.umi-production'){ walk(p, acc); } }
		else if(/\.js$/.test(e.name)){ acc.push(p); }
	});
	return acc;
}
const WRITERS = ['safeJsonStringifyToStorage', 'safeLocalStorageSet'];
const calleeName = (c)=>(c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && c.property ? c.property.name : ''));
// 丢掉写入回值(表达式语句)之后,同一函数里又把写入的那个值交给 emit* / dispatchEvent / notify* / broadcast*
function discardThenBroadcast(src){
	const out = [];
	let ast = null;
	try{ ast = parseModule(src); }catch(e){ return out; }
	traverse(ast, {
		CallExpression(p){
			if(WRITERS.indexOf(calleeName(p.node.callee)) < 0){ return; }
			if(!p.parentPath.isExpressionStatement()){ return; }
			const v = p.node.arguments[1];
			const vname = v && v.type === 'Identifier' ? v.name
				: (v && v.type === 'CallExpression' && v.arguments[0] && v.arguments[0].type === 'Identifier' ? v.arguments[0].name : null);
			if(!vname){ return; }
			const fn = p.getFunctionParent();
			if(!fn){ return; }
			const after = p.parentPath.node.end;
			let hit = false;
			fn.traverse({
				CallExpression(q){
					if(hit || q.node.start < after){ return; }
					if(!/^(emit|notify|broadcast)|^dispatchEvent$/i.test(calleeName(q.node.callee))){ return; }
					q.traverse({ Identifier(r){ if(r.node.name === vname){ hit = true; } } });
					q.node.arguments.forEach((a)=>{ if(a.type === 'Identifier' && a.name === vname){ hit = true; } });
				},
			});
			if(hit){ out.push(p.node.loc.start.line); }
		},
	});
	return out;
}

describe('源码合同:写入回值丢弃后不许广播内存值', ()=>{
	test('全 src 零命中(登记的除外)', ()=>{
		const bad = [];
		walk(SRC, []).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(!WRITERS.some((w)=>src.indexOf(w) >= 0)){ return; }
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			if(IN_SESSION_TRUTH[rel]){ return; }
			discardThenBroadcast(src).forEach((l)=>bad.push(`${rel}:${l}`));
		});
		expect(bad).toEqual([]);
	});
	test('判别力:丢回值再广播同一值即红;用上回值 / 广播重读的值不红', ()=>{
		expect(discardThenBroadcast("function f(cur){ safeJsonStringifyToStorage(K, cur); emitPrefs(cur); }").length).toBe(1);
		expect(discardThenBroadcast("function f(cur){ try{ safeJsonStringifyToStorage(K, cur); }catch(e){} emit(cur); }").length).toBe(1);
		expect(discardThenBroadcast("function f(cur){ if(safeJsonStringifyToStorage(K, cur) !== true){ emit(read()); return; } emit(cur); }").length).toBe(0);
		expect(discardThenBroadcast("function f(v){ safeLocalStorageSet(K, v); emit(); }").length).toBe(0);
	});
	test('登记的文件都还在、也确实是这种写法(撤掉要一并撤表)', ()=>{
		Object.keys(IN_SESSION_TRUTH).forEach((rel)=>{
			const f = path.join(SRC, rel);
			expect(fs.existsSync(f)).toBe(true);
			expect(discardThenBroadcast(fs.readFileSync(f, 'utf8')).length).toBeGreaterThan(0);
		});
	});
});

describe('🔴 写不进时按存储里的实际值广播与返回,并提示没能保存', ()=>{
	const realSet = Storage.prototype.setItem;
	let full = false;
	beforeEach(()=>{
		localStorage.clear();
		full = false;
		Storage.prototype.setItem = function(k, v){
			if(full){ const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
			return realSet.call(this, k, v);
		};
	});
	afterEach(()=>{ Storage.prototype.setItem = realSet; });
	function capture(fn){
		const got = [];
		const h = (e)=>got.push(e.detail && e.detail.key);
		window.addEventListener(SETTING_NOT_SAVED_EVENT, h);
		const r = fn();
		window.removeEventListener(SETTING_NOT_SAVED_EVENT, h);
		return { r, got };
	}
	test('命主实况发送开关:存储满时不显示成「已发送」', ()=>{
		const SF = require('../subjectFacts');
		const prefsEvents = [];
		const h = (e)=>prefsEvents.push(e.detail);
		window.addEventListener(SF.SUBJECT_FACTS_PREFS_EVENT, h);
		full = true;
		const { r, got } = capture(()=>SF.setSubjectFactsEnabled('local-a', true));
		window.removeEventListener(SF.SUBJECT_FACTS_PREFS_EVENT, h);
		expect(r.bySubject['local-a']).toBeUndefined();
		expect(SF.isSubjectFactsEnabled('local-a')).toBe(false);
		expect(prefsEvents.map((p)=>!!p.bySubject['local-a'])).toEqual([false]);
		expect(got).toEqual([SF.SUBJECT_FACTS_KEY]);
		full = false;
		expect(SF.setSubjectFactsEnabled('local-a', true).bySubject['local-a']).toBe(true);
	});
	test('人设 / 分层口径 / 模型路由选项 / 路由方案:同一口径', ()=>{
		const P = require('../aiChat/persona');
		const L = require('../aiChat/personaLayers');
		const R = require('../aiModelRouting');
		full = true;
		const a = capture(()=>P.writePersona({ text: '口径', enabled: true }));
		expect(a.r.enabled).toBe(false);
		expect(a.got.length).toBe(1);
		const b = capture(()=>L.writePersonaLayer('subject', 'local-a', '只对这位'));
		expect(b.r.bySubject['local-a']).toBeUndefined();
		expect(b.got.length).toBe(1);
		const slot = R.ROUTE_SLOTS[0];
		const c = capture(()=>R.writeRouteOptions({ [slot]: { maxTokens: 1234 } }));
		expect(R.slotOptions(c.r, slot).maxTokens).toBeUndefined();
		expect(c.got.length).toBe(1);
		const d = capture(()=>R.saveRouteProfile('方案甲'));
		expect(Object.keys((d.r && d.r.profiles) || {})).toEqual([]);
		expect(d.got.length).toBe(1);
	});
});
