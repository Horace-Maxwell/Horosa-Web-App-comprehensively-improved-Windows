// [D56] 默认路径重算遇后端不可达不再静默成 missing:源码级锁(builder 依赖真排盘链,jsdom 里无法端到端喂错)。
const fs = require('fs');
const path = require('path');
const CTX = path.resolve(__dirname, '..', 'aiAnalysisContext.js');
const strip = (s)=>s.replace(/^\s*\/\/.*$/mg, '');

it('🔴 regenerateChartTechniqueSnapshot 支持 throwOnError;默认路径调用带它并把错落 status:error + meta.error;逐技法隔离', ()=>{
	const src = strip(fs.readFileSync(CTX, 'utf8'));
	expect(src).toContain('export async function regenerateChartTechniqueSnapshot(record, key, opts){');
	expect(src).toContain('if(opts && opts.throwOnError){ throw e; }');
	expect(src).toContain("generatedText = await regenerateChartTechniqueSnapshot(record, key, { throwOnError: true });");
	expect(src).toContain("status: hasContent ? 'ready' : (genError ? 'error' : 'missing'),");
	expect(src).toContain("...(!hasContent && genError ? { error:");
	expect(src).toContain("context = { key: k, title: getTechniqueLabel(k), module: k, content: '', available: false, status: 'error',");
	// 旧形态(catch 一律 return '' 且调用方裸 await)不得回潮
	expect(src).not.toContain("const generatedText = await regenerateChartTechniqueSnapshot(record, key);");
});
