// [D80] 后台链「吞错必留痕」机械网:目标任务 / 任务中心 / 调度器 / 自动化引擎这些没有人在键盘前的模块,每个 catch 必须
//   ① 经 reportBackgroundFailure(tag, e) 进 bgSink,或 ② 把错误转成显式结果(体内含 `ok: false` / `throw` / `return` 结果对象),或 ③ 写明理由的 `/* noop: 理由 */`。
//   裸 `catch(e){ /* noop */ }` 与 `.catch(()=>{})` 一律红(此前 goalRunner / tasks/index / reconcile / scheduler / engine 十余处静默吞掉)。
import fs from 'fs';
import path from 'path';

const AGENT = path.resolve(__dirname, '..', 'aiAgent');
const FILES = [
	'goalRunner.js', 'tasks/index.js', 'tasks/reconcile.js', 'tasks/scheduler.js', 'tasks/taskStore.js', 'tasks/noticeStore.js', 'tasks/taskKinds.js',
	'automation/engine.js', 'automation/actions.js', 'automation/deps.js', 'automation/ruleStore.js',
];

function balanced(src, start, open, close){
	let depth = 0; let i = start;
	for(; i < src.length; i++){
		const ch = src[i];
		if(ch === open){ depth += 1; }
		else if(ch === close){ depth -= 1; if(depth === 0){ return src.slice(start, i + 1); } }
	}
	return src.slice(start);
}
function lineOf(src, at){ return src.slice(0, at).split('\n').length; }
// 转结果的形态:ok:false 结果对象 / 抛出 / return / 赋给 error 变量(runHeadlessTurn 把流错转成返回值)/ notifyActionFailure(自动化动作失败进通知中心)
const OK = (body)=>/reportBackgroundFailure\(/.test(body) || /\/\*\s*noop:/.test(body) || /ok:\s*false/.test(body) || /\bthrow\b/.test(body) || /\breturn\b/.test(body) || /\berror\s*=/.test(body) || /notifyActionFailure\(/.test(body);

it('🔴 后台模块每个 catch 都留痕 / 转结果 / 写明理由', ()=>{
	const problems = [];
	FILES.forEach((rel)=>{
		const src = fs.readFileSync(path.join(AGENT, rel), 'utf8');
		let from = 0;
		for(;;){
			const at = src.indexOf('catch', from);
			if(at < 0){ break; }
			from = at + 5;
			const before = src[at - 1] || ' ';
			if(/[A-Za-z0-9_$]/.test(before)){ continue; }   // 标识符的一部分
			const rest = src.slice(at + 5);
			const m = rest.match(/^\s*\(/);
			if(!m){ continue; }
			const parenStart = at + 5 + m[0].length - 1;
			const paren = balanced(src, parenStart, '(', ')');
			let body = '';
			if(before === '.'){
				body = paren;   // .catch((e)=>…) 整个实参
			}else{
				const after = src.slice(parenStart + paren.length);
				const bm = after.match(/^\s*\{/);
				if(!bm){ continue; }
				body = balanced(src, parenStart + paren.length + bm[0].length - 1, '{', '}');
			}
			if(!OK(body)){ problems.push(`${rel}:${lineOf(src, at)} ${body.replace(/\s+/g, ' ').slice(0, 100)}`); }
		}
	});
	expect(problems).toEqual([]);
});

it('bgSink 被这些模块真的引用(不是只在注释里)', ()=>{
	['goalRunner.js', 'tasks/index.js', 'tasks/reconcile.js', 'tasks/scheduler.js', 'tasks/noticeStore.js', 'automation/engine.js', 'automation/actions.js'].forEach((rel)=>{
		const src = fs.readFileSync(path.join(AGENT, rel), 'utf8').replace(/^\s*\/\/.*$/mg, '');
		expect(src).toMatch(/import \{[^}]*reportBackgroundFailure[^}]*\} from '(\.\.\/)?(\.\/)?bgSink'/);
		expect((src.match(/reportBackgroundFailure\(/g) || []).length).toBeGreaterThanOrEqual(1);
	});
});
