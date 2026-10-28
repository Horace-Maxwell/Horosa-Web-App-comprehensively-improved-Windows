// 延迟落盘的「读存储再合并」写入者必须交内存快照、读端必须先看待落盘态(deferredStorage 的读合并约定):
// 否则两次改动落在同一个空闲窗内,后一次读到旧存储、把前一次整组改动盖掉(内存态仍新,刷新即丢)。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../..');

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){ if(f !== '__tests__' && f !== 'node_modules' && !f.startsWith('.umi')){ walk(p, out); } }
		else if(/\.(js|jsx)$/.test(f) && !/\.test\./.test(f)){ out.push(p); }
	});
	return out;
}

// 一个文件的违规:scheduleStorageWrite 调用前 8 行内有「展开读出来的旧值」(...getStoredX() / ...cur)= 读合并写入者,
// 它必须交第三个参数(内存快照)或自带待落盘态(onDrop 撤销),且同文件读端用 peekPendingStorageValue / 自带待落盘态
export function readMergeViolations(rel, text){
	const lines = text.split('\n');
	const bad = [];
	const ownPending = /_\w*[Pp]ending\b/.test(text);
	lines.forEach((line, i)=>{
		const at = line.indexOf('scheduleStorageWrite(');
		if(at < 0 || /export function scheduleStorageWrite/.test(line) || /^\s*(\/\/|\*)/.test(line)){ return; }
		const ctx = lines.slice(Math.max(0, i - 8), i + 1).join('\n');
		if(!/\.\.\.\s*(?:get\w*\(|cur\b|current\b|prev\b)/.test(ctx)){ return; }
		const call = lines.slice(i, i + 12).join('\n').slice(lines[i].indexOf('scheduleStorageWrite('));
		const hasSnapshot = /scheduleStorageWrite\(\s*[\w.]+\s*,\s*\(\)\s*=>\s*JSON\.stringify\(\s*(\w+)\s*\)\s*,\s*\1\s*\)/.test(call);
		const peeks = /peekPendingStorageValue\(/.test(text);
		if(!((hasSnapshot && peeks) || ownPending)){ bad.push(`${rel}:${i + 1}`); }
	});
	return bad;
}

describe('延迟落盘的读合并约定', ()=>{
	it('🔴 全仓「读存储再合并」的延迟写都交快照、读端先看待落盘态', ()=>{
		const bad = [];
		walk(SRC, []).forEach((p)=>{
			const text = fs.readFileSync(p, 'utf8');
			if(text.indexOf('scheduleStorageWrite(') < 0){ return; }
			bad.push(...readMergeViolations(path.relative(SRC, p).split(path.sep).join('/'), text));
		});
		expect(bad).toEqual([]);
	});
	it('判别力:没交快照 / 读端不看待落盘态都被抓;整值写不算', ()=>{
		const leaky = "export function getS(){ return JSON.parse(localStorage.getItem(K)); }\nexport function setS(patch){\n\tconst cur = getS();\n\tconst next = { ...cur, ...patch };\n\tscheduleStorageWrite(K, () => JSON.stringify(next));\n}";
		expect(readMergeViolations('x.js', leaky)).toEqual(['x.js:5']);
		const noPeek = leaky.replace('JSON.stringify(next));', 'JSON.stringify(next), next);');
		expect(readMergeViolations('x.js', noPeek)).toEqual(['x.js:5']);
		const ok = `${noPeek}\nconst p = peekPendingStorageValue(K);`;
		expect(readMergeViolations('x.js', ok)).toEqual([]);
		expect(readMergeViolations('y.js', "scheduleStorageWrite(KEY, ()=>JSON.stringify(payload));")).toEqual([]);
	});
});
