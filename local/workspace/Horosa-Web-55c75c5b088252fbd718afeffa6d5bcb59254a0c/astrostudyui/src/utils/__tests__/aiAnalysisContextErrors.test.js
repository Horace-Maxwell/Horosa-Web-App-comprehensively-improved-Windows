// 默认路径重算遇后端不可达不再静默成 missing:源码级锁(builder 依赖真排盘链,jsdom 里无法端到端喂错)。
const fs = require('fs');
const path = require('path');
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读
const CTX = path.resolve(__dirname, '..', 'aiAnalysisContext.js');
const strip = (s)=>s.replace(/^\s*\/\/.*$/mg, '');

it('🔴 regenerateChartTechniqueSnapshot 支持 throwOnError;默认路径调用带它并把错落 status:error + meta.error;逐技法隔离', ()=>{
	const src = strip(readSource(CTX));
	expect(src).toContain('export async function regenerateChartTechniqueSnapshot(record, key, opts){');
	expect(src).toContain('if(opts && opts.throwOnError){ throw e; }');
	expect(src).toContain("generatedText = canonicalSnapshotText(await regenerateChartTechniqueSnapshot(record, key, { throwOnError: true }));");
	expect(src).toContain("status: hasContent ? 'ready' : (genError ? 'error' : 'missing'),");
	expect(src).toContain("...(!hasContent && genError ? { error:");
	expect(src).toContain("context = { key: k, title: getTechniqueLabel(k), module: k, content: '', available: false, status: 'error',");
	// 旧形态(catch 一律 return '' 且调用方裸 await)不得回潮
	expect(src).not.toContain("const generatedText = await regenerateChartTechniqueSnapshot(record, key);");
});

// 同一张盘第一次起盘与之后读槽必须逐字相同:当场算出的正文与存进槽的是同一个规范形(canonicalSnapshotText,去首尾空白)。
// 此前当场回的是构建器原样输出(不少技法结尾带一个换行),存槽的是去空白后的 —— 第一次与第二次起盘差一个结尾换行
it('🔴 当场重算的正文与存槽同一规范形:时间点 / 事盘 / 命盘 / 覆盖重算四处都过 canonicalSnapshotText', ()=>{
	const src = strip(readSource(CTX));
	expect(src).toContain('export function canonicalSnapshotText(content){');
	expect(src).toContain('const text = canonicalSnapshotText(content);');
	expect(src).toContain('timeText = canonicalSnapshotText(await regenerateCaseTechniqueSnapshot(record, key, payload));');
	expect(src).toContain('generatedText = canonicalSnapshotText(generatedText);');
	expect(src).toContain('text = canonicalSnapshotText(text);');
	// 重算出口不许再有不过规范形的裸赋值
	expect(src).not.toContain('timeText = await regenerateCaseTechniqueSnapshot(');
	expect(src).not.toMatch(/generatedText = await regenerateChartTechniqueSnapshot\(/);
});

it('canonicalSnapshotText:去首尾空白;空 / 非字符串安全', ()=>{
	const { canonicalSnapshotText } = require('../aiAnalysisContext/recordFields');
	expect(canonicalSnapshotText('[段]\n内容\n')).toBe('[段]\n内容');
	expect(canonicalSnapshotText('  a\n\n')).toBe('a');
	expect(canonicalSnapshotText(null)).toBe('');
	expect(canonicalSnapshotText(undefined)).toBe('');
});
