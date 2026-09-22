// js-rsa 的 jest 垫片。
// 病理:js-rsa/index.js 是 1998 年代的 IIFE 脚本,内部大量「未声明即赋值」的隐式全局
// (biMultiplyDigit 里 `result = new BigInt()` 等)。umi-test 的 transformIgnorePatterns 为空
// → babel 也转换 node_modules,给该文件加了 "use strict" → 隐式全局赋值抛
// ReferenceError: result is not defined → utils/request.js 的 RSA 加密在 jest 里恒失败 →
// **每一个打本地后端(:9999)的请求在 jest 里都静默失败**,aiExportSectionsParityAll 的 SOFT 键
// (三十余个依赖后端盘的技法)即便后端在线也恒「产空不断言」,该闸只对 9 个纯本地键真跑。
// 修法与 docxJestShim 同款:运行时读原始源码,按 CJS 语义在**非严格**函数体里求值(new Function
// 体缺省 sloppy,隐式全局合法),导出真实库;仅 jest 生效,生产 webpack 不经此文件。
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'js-rsa', 'index.js'), 'utf8');
const mod = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('exports', 'module', 'require', src)(mod.exports, mod, require);
module.exports = mod.exports;
