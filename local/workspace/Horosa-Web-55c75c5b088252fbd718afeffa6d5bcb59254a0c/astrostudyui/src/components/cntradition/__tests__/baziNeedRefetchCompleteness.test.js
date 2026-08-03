// 八字 needRefetch 白名单完备性锁(L3,2026-08 死开关审计 DS-P1)。
// 核心判据是一条硬同构:needRefetch 比较的键集 ≡ genParams 体内进后端请求的 baziOpt 键集。
//   - genParams 带而 needRefetch 不比 → 改该键后参数变了却不重取 = 「改了不生效」死开关;
//   - needRefetch 比而 genParams 不带 → 白白重取(性能伤 + 语义谎言)。
// 其余产生键(CnTraditionInput 面板出的)必须是「纯前端消费」:在 cntradition 目录
// genParams 之外仍有读点(剥注释),否则就是前端死开关。
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '..');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
// 🔴 切片在原文上做、剥注释只对切出的体做:整文件先剥注释会被字符串里的 `//` 剥断行,
//    连带吞掉后文 marker(实测 genParams marker 在剥后 not found,原文 grep 却命中)。
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const baziRaw = read('BaZi.js');
const inputCode = strip(read('CnTraditionInput.js'));

// 配对大括号切函数体(原文)
function bodyOf(code, marker){
	const i = code.indexOf(marker);
	if(i < 0){ return ''; }
	const j = code.indexOf('{', i);
	let depth = 0;
	for(let k = j; k < code.length; k++){
		if(code[k] === '{'){ depth++; }
		else if(code[k] === '}'){ depth--; if(depth === 0){ return code.slice(j, k + 1); } }
	}
	return '';
}

const OPT_KEY_RE = /baziOpt(?:\s*\|\|\s*\{\})?[.[]\s*'?([a-zA-Z_]+)/g;
const keysIn = (t) => Array.from(new Set(Array.from(t.matchAll(OPT_KEY_RE)).map((m) => m[1]))).sort();

// ① 后端请求面:genParams 体内消费的 baziOpt 键
const genParamsBody = strip(bodyOf(baziRaw, 'genParams(fields){'));
const backendKeys = keysIn(genParamsBody);

// ② needRefetch 比较面:它不是函数,是布尔链常量表达式(:839 `const needRefetch = (prev.X||d) !== (opt.X||d) || …;`)
//    → 切「const needRefetch =」到第一个分号(链式表达式内无分号),再剥注释提键。
const nrStart = baziRaw.indexOf('const needRefetch =');
const needRefetchBody = nrStart >= 0 ? strip(baziRaw.slice(nrStart, baziRaw.indexOf(';', nrStart) + 1)) : '';
const refetchKeys = Array.from(new Set(
	Array.from(needRefetchBody.matchAll(/\.([a-zA-Z_]+)\s*\|\|/g)).map((m) => m[1])
)).sort();

// ③ 产生面:CnTraditionInput 写进 baziOpt 的键(三种真实写法:
//    对象字面量组包 `key: value` / 直接赋值 `opt.key = val` / spread 局部覆盖 `key: {...}`)
const producedKeys = Array.from(new Set(
	Array.from(inputCode.matchAll(/\b([a-zA-Z_]+)\s*:\s*(?:value|checked|val|e\.target\.value|nextVal)/g)).map((m) => m[1])
		.concat(Array.from(inputCode.matchAll(/\bopt\.([a-zA-Z_]+)\s*=/g)).map((m) => m[1]))
		.concat(Array.from(inputCode.matchAll(/\b([a-zA-Z_]+)\s*:\s*\{\s*\.\.\.cur/g)).map((m) => m[1]))
		.concat(Array.from(inputCode.matchAll(/patchBaziOpt\(\s*\{?\s*'?([a-zA-Z_]+)'?/g)).map((m) => m[1]))
)).filter((k) => k !== 'value' && k !== '__stepHint').sort();

describe('八字 needRefetch 完备性(L3)', () => {
	it('提取自证:genParams 键 ≥ 4、needRefetch 键 ≥ 4、函数体都切到了', () => {
		expect(genParamsBody.length).toBeGreaterThan(100);
		expect(needRefetchBody.length).toBeGreaterThan(50);
		expect(backendKeys.length).toBeGreaterThanOrEqual(4);
		expect(refetchKeys.length).toBeGreaterThanOrEqual(4);
	});

	it('硬同构:needRefetch 比较键 ≡ genParams 后端请求键(两侧机械提取必须相等)', () => {
		expect(refetchKeys).toEqual(backendKeys);
	});

	it('产生面覆盖后端键(后端键必须真的能从设置面板发出,否则是僵尸参数)', () => {
		const produced = new Set(producedKeys);
		expect(backendKeys.filter((k) => !produced.has(k))).toEqual([]);
	});

	it('纯显示键(产生但不进后端)在 BaZi.js 的 genParams 之外仍有消费点(前端死开关检查)', () => {
		// cntradition 目录全部组件构成消费面(baziOpt 作为 props 传给 PaiBaZi/BaZiAppInfoPanel 等)
		const corpus = ['BaZi.js', 'PaiBaZi.js', 'BaZiAppInfoPanel.js', 'BaZiLegacyView.js', 'CnTraditionInput.js']
			.filter((f) => fs.existsSync(path.join(DIR, f)))
			.map((f) => strip(read(f)))
			.join('\n');
		const backend = new Set(backendKeys);
		const displayOnly = producedKeys.filter((k) => !backend.has(k))
			// 面板自身的 UI 态键(不入 baziOpt 的本地状态)按 baziOpt 读点为准过滤:
			// 只有真的以 baziOpt.<k> / opt.<k> 形态被读才算八字选项键
			.filter((k) => new RegExp('(baziOpt|opt)(\\s*\\|\\|\\s*\\{\\})?[.[]\\s*\'?' + k + '\\b').test(corpus));
		expect(displayOnly.length).toBeGreaterThanOrEqual(6);	// 已知 10 个纯显示键,守下限防提取塌缩
		displayOnly.forEach((k) => {
			const outsideGen = corpus.replace(genParamsBody, '');
			expect(new RegExp('(baziOpt|opt)(\\s*\\|\\|\\s*\\{\\})?[.[]\\s*\'?' + k + '\\b').test(outsideGen)).toBe(true);
		});
	});
});
