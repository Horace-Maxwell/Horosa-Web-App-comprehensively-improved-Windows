// jest(jsdom)补齐 WebKit 原生就有、捆绑 jsdom 没有的 Web 平台全局(每个测试文件 setup 阶段先跑,见 jest.config.js setupFiles)。
// 为什么要单列:这些全局曾只在 docx 的 jest 垫片里顺带补上 —— 哪个测试的导入链碰巧带上 docx,哪个测试才有 TextEncoder;
// 导入链一变(比如把 docx 从首屏链上拆掉),不相干的测试就报「TextEncoder is not defined」,而生产 WebKit 里一直好好的。
const util = require('util');
if (typeof globalThis.TextEncoder === 'undefined') { globalThis.TextEncoder = util.TextEncoder; }
if (typeof globalThis.TextDecoder === 'undefined') { globalThis.TextDecoder = util.TextDecoder; }
// 系统随机源:WebKit 原生有 crypto.getRandomValues,捆绑的 jsdom 没有。随机起卦一律只认系统随机源、没有就报错(不退回 Math.random),
// 所以测试环境要接上 Node 的同一个系统随机源。只补 getRandomValues、不补 subtle:要整套 WebCrypto 的测试自己换成 node webcrypto。
if (typeof globalThis.crypto === 'undefined') {
	const nodeCrypto = require('crypto');
	Object.defineProperty(globalThis, 'crypto', {
		value: { getRandomValues: (arr) => nodeCrypto.randomFillSync(arr) },
		configurable: true, writable: true,
	});
}
