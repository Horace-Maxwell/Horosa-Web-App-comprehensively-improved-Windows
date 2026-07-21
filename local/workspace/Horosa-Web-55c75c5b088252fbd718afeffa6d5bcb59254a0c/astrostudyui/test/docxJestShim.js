// docx 库的 jest 垫片(A2)。
// 病理与 three 同款(见 threeJestStub.js 头注):docx@9 的 main 指向 .cjs,
// umi-test 捆绑 jest 的 file transformer 把 .cjs 扩展名当资产 → `import 'docx'`
// 拿到的是文件名字符串,TextRun 等全为 undefined。
// three 可以万能 stub(jsdom 永不真渲染);docx 不行——导出契约测试要解包真 .docx
// 断言 document.xml,必须真库。此垫片运行时读 UMD 源码按 CJS 语义求值,导出真实库;
// 仅 jest 生效(jest.config.js moduleNameMapper),生产 webpack 走 package.module 不受影响。
const fs = require('fs');
const path = require('path');

// 捆绑 jsdom 无 TextEncoder/TextDecoder 全局(docx Packer 编码 xml 时要用)——从 node util 补齐。
const util = require('util');
if (typeof globalThis.TextEncoder === 'undefined') { globalThis.TextEncoder = util.TextEncoder; }
if (typeof globalThis.TextDecoder === 'undefined') { globalThis.TextDecoder = util.TextDecoder; }

const src = fs.readFileSync(
	path.join(__dirname, '..', 'node_modules', 'docx', 'dist', 'index.umd.cjs'),
	'utf8'
);
const mod = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('exports', 'module', 'require', src)(mod.exports, mod, require);
module.exports = mod.exports;
