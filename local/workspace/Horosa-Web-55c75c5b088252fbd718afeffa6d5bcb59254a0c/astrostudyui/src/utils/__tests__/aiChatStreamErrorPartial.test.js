// [D67] 对话流:上游在正文之后发 error 帧 ⇒ 不得把半截当完整。源码级锁(AIAnalysisMain 在 jsdom 渲染不了):
//   errorInfo 只要有 streamError 就记;正文非空时 partial:true;旧形态「只在正文为空时记 errorInfo」不得回潮。
const fs = require('fs');
const path = require('path');
const MAIN = path.resolve(__dirname, '..', '..', 'components', 'aianalysis', 'AIAnalysisMain.js');
const strip = (s)=>s.replace(/^\s*\/\/.*$/mg, '');

it('🔴 streamError ⇒ errorInfo 恒记;正文非空 ⇒ partial:true;旧形态归零', ()=>{
	const src = strip(fs.readFileSync(MAIN, 'utf8'));
	expect(src).toContain('const errorInfo = streamError ? classifyStreamError(streamError) : null;');
	expect(src).toContain('const partialAfterError = !!(finalContent && streamError);');
	expect(src).toContain('partial: partialAfterError || undefined,');
	expect(src).not.toContain('const errorInfo = (!finalContent && streamError)');
	// 状态口径不变:正文空 + 错 ⇒ error;有正文 ⇒ done/aborted(历史与上下文照常)
	expect(src).toContain("streamStatus: (!finalContent && streamError) ? 'error' :");
});
