// 全技法 lazy 目标可载入 smoke —— 条件编译块投影悬空锁第三道(2026-07-31 辅盘实案)。
// 病灶:条件块内 import 的绑定名在块外被引用,该块被剔除后就成了未定义自由变量,
// 模块顶层 ReferenceError;首爆被预载 catch 吞、二次点击伪装成「Lazy chunk resolved
// empty」。本测试逐个 require pages/index.js 里全部 lazyPreloadable 目标,
// 任何「顶层炸/无默认导出」当场即红。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(SRC, 'pages', 'index.js'), 'utf8');

// jsdom 下无真 canvas/WebGL:个别重可视化组件顶层探测环境属实,豁免须注明理由。
const REQUIRE_WHITELIST = new Set([
	// (当前无豁免;新增必须写明「顶层为何必须碰环境」的理由)
]);

const targets = [];
const re = /lazyPreloadable\(\s*\(\)\s*=>\s*import\(\s*['"](\.\.\/[^'"]+)['"]\s*\)/g;
let m;
while ((m = re.exec(indexSource))) {
	targets.push(m[1]);
}

describe('全技法 lazy 目标可载入(marker 投影悬空第三道锁)', () => {
	it('解析到的 lazy 目标数量应覆盖全技法(>=20)', () => {
		expect(targets.length).toBeGreaterThanOrEqual(20);
	});

	targets.forEach((rel) => {
		const label = rel.replace('../', '');
		it(`${label} 可 require 且有默认导出`, () => {
			if (REQUIRE_WHITELIST.has(rel)) { return; }
			let mod;
			expect(() => {
				// eslint-disable-next-line global-require, import/no-dynamic-require
				mod = require(path.join(SRC, 'pages', rel));
			}).not.toThrow();
			expect(mod && (mod.default || mod)).toBeTruthy();
			expect(mod.default).toBeTruthy();
		});
	});
});
