// 具名导入必须真被导出:import { x } from './m' 里的 x,m 必须真导出(判据 helpers/namedImports.js)。
// webpack 只警告、jest 只给 undefined —— 名字悬空的导入构建照过、单测照绿,谁顺手用了它运行时才炸。
const path = require('path');
const { missingNamedImports, scanSourceTree } = require('./helpers/namedImports');

const SRC = path.resolve(__dirname, '../..');

describe('具名导入必须真被导出', ()=>{
	test('判别向量:悬空的具名 / 默认导入必报;export * 链、CommonJS 目标、jest.mock 工厂、非代码资源不报', ()=>{
		const R = '/v/src';
		const files = new Map([
			[`${R}/m.js`, 'export const a = 1;\nexport function b(){}\nconst c = 2;\nexport { c as cc };\n'],
			[`${R}/barrel.js`, "export * from './m';\nexport { default as Def } from './withDefault';\n"],
			[`${R}/withDefault.js`, 'export default function(){}\n'],
			[`${R}/noDefault.js`, 'export const only = 1;\n'],
			[`${R}/cjs.js`, 'module.exports = { anything: 1 };\n'],
			[`${R}/use.js`, "import { a, missingName } from './m';\nimport D from './noDefault';\nimport { cc, b } from './barrel';\nimport { anything, whatever } from './cjs';\nimport s from './x.less';\nimport { Def } from './barrel';\n"],
			[`${R}/re.js`, "export { gone } from './m';\n"],
			[`${R}/t.test.js`, "jest.mock('./m', ()=>({ __fake: 1 }));\nimport { __fake } from './m';\nimport { nope } from './noDefault';\n"],
			[`${R}/alias.js`, "import { notThere } from '@/m';\n"],
		]);
		const got = missingNamedImports(files, { srcRoot: R }).map((x)=>`${path.basename(x.file)}:${x.name}`).sort();
		expect(got).toEqual(['alias.js:notThere', 're.js:gone', 't.test.js:nope', 'use.js:default', 'use.js:missingName'].sort());
	});

	test('src 全树(含测试)零悬空的具名导入', ()=>{
		const { files, missing } = scanSourceTree(SRC);
		expect(files.size).toBeGreaterThan(500);
		const rows = missing.map((x)=>`${path.relative(SRC, x.file)}:${x.line} 导入 ${x.name},但 ${path.relative(SRC, x.target)} 不导出它`);
		expect(rows).toEqual([]);
	});
});
