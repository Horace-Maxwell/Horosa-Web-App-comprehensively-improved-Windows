// 模块快照只有一条读写口:saveModuleAISnapshot / loadModuleAISnapshot。
// 早先预留的「结构化真值」旁路(写端存一份 -gt 快照、读端 loadModuleStructuredGT)两头都已拆除:
// 读端在产品代码里从没被调用过,写端每次存卦多算一遍却没人读。这里锁住两头都不再长回来,
// 并确认留下的读写口行为照旧(meta 原样随快照往返)。
import fs from 'fs';
import path from 'path';
import * as moduleAiSnapshot from '../moduleAiSnapshot';

const SRC = path.join(__dirname, '..', '..');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
		if(e.name === 'node_modules' || e.name.startsWith('.')){ return; }
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ walk(p, out); }
		else if(/\.jsx?$/.test(e.name) && !/__tests__/.test(p)){ out.push(p); }
	});
	return out;
}

describe('模块快照不再带结构化真值旁路', () => {
	test('不再导出旁路读口', () => {
		expect(moduleAiSnapshot.loadModuleStructuredGT).toBeUndefined();
		expect(typeof moduleAiSnapshot.saveModuleAISnapshot).toBe('function');
		expect(typeof moduleAiSnapshot.loadModuleAISnapshot).toBe('function');
	});

	test('产品代码里没有旁路的读写痕迹', () => {
		const hits = walk(SRC, []).filter((f) => {
			const s = fs.readFileSync(f, 'utf8');
			return /structuredGT|loadModuleStructuredGT|'guazhan-gt'/.test(s);
		}).map((f) => path.relative(SRC, f));
		expect(hits).toEqual([]);
	});

	test('留下的读写口:meta 原样往返', () => {
		const meta = { from: 'test', n: 1 };
		const saved = moduleAiSnapshot.saveModuleAISnapshot('leanguard-probe', '正文', meta);
		expect(saved && saved.content).toBe('正文');
		const back = moduleAiSnapshot.loadModuleAISnapshot('leanguard-probe');
		expect(back && back.content).toBe('正文');
		expect(back.meta).toEqual(meta);
		moduleAiSnapshot.clearModuleAISnapshot('leanguard-probe');
	});
});
