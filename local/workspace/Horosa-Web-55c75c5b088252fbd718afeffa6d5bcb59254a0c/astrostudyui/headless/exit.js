// 命令行入口统一的退出:先等标准输出 / 标准错误把已写的内容都交给系统,再 process.exit。
// 接管道时(./horosa call … --json | jq、批量的 --list-techniques 等)Node 的写入是异步的,直接 process.exit 会把还在缓冲里的
// 后半截丢掉(实测 `call cast_technique … --json` 的回包在 40 KB 左右被截断,下游拿到不完整的 JSON)。
// 仍要显式退出:本进程里跑过运行时(jsdom 等)时事件循环不会自己空下来。
'use strict';

function exitAfterFlush(code){
	process.exitCode = code;
	let pending = 2;
	const done = ()=>{ pending -= 1; if(pending === 0){ process.exit(code); } };
	// 空写入的回调排在之前所有写入之后:回调到了 = 前面的都已交出去(管道已断时回调带错误,照样退)
	try{ process.stdout.write('', done); }catch(e){ done(); }
	try{ process.stderr.write('', done); }catch(e){ done(); }
}

module.exports = { exitAfterFlush };
