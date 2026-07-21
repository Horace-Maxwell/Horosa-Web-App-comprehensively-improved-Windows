// umi-test（lib/index.js）会读取本文件并把 moduleNameMapper 合并到其默认映射之上
//（默认 CSS/资源映射保留，见 umi-test 的 _objectSpread(defaults, ..., userModuleNameMapper)）。
//
// 为何需要：新装 pdf-lib/@pdf-lib/fontkit 后，共享 npx 缓存里的 jsdom 依赖 parse5-parser-stream@7
// 用 `node:` 协议前缀 import（如 `require('node:stream')`），而 umi-test 捆绑的旧 jest 解析器不认
// `node:` 协议 → 所有 jsdom 环境用例在 setup 阶段即 "Cannot find module 'node:stream'" 失败。
// 下面把 `node:xxx` 一律映射回内建 `xxx`（内建模块无前缀可正常解析），恢复测试环境；对业务零影响。
// three r0.185(2026-07 升级):jest 里 three 全族走万能 stub(三层病理与决策依据详
// test/threeJestStub.js 头注 —— .cjs 被 file transformer 当资产/ESM 构建带 ES2022
// static class blocks 超出捆绑 babel 能力/全仓仅 astro3d 用 three 且 jsdom 永不实例化)。
module.exports = {
	moduleNameMapper: {
		'^node:(.*)$': '$1',
		'^three$': '<rootDir>/test/threeJestStub.js',
		'^three/examples/jsm/(.*)$': '<rootDir>/test/threeJestStub.js',
		// docx@9 main 是 .cjs,file transformer 当资产(同 three 病理)→ 走真库垫片
		// (导出契约测试要解包真 .docx,不能 stub;详 test/docxJestShim.js 头注)。
		'^docx$': '<rootDir>/test/docxJestShim.js',
	},
};
