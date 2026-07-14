// umi-test（lib/index.js）会读取本文件并把 moduleNameMapper 合并到其默认映射之上
//（默认 CSS/资源映射保留，见 umi-test 的 _objectSpread(defaults, ..., userModuleNameMapper)）。
//
// 为何需要：新装 pdf-lib/@pdf-lib/fontkit 后，共享 npx 缓存里的 jsdom 依赖 parse5-parser-stream@7
// 用 `node:` 协议前缀 import（如 `require('node:stream')`），而 umi-test 捆绑的旧 jest 解析器不认
// `node:` 协议 → 所有 jsdom 环境用例在 setup 阶段即 "Cannot find module 'node:stream'" 失败。
// 下面把 `node:xxx` 一律映射回内建 `xxx`（内建模块无前缀可正常解析），恢复测试环境；对业务零影响。
module.exports = {
	moduleNameMapper: {
		'^node:(.*)$': '$1',
	},
};
