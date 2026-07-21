// 神数正传 · 五流派名单一源 + 「宿主不得静态引 lazy 组件」哨兵。
//
// 🔴 病例(实测栽过)：为让中栏盘题与左栏下拉共用流派名，把常量导在 ZhengChuanMain 里、
//    宿主静态 import 之 —— 而 ZhengChuanMain 正是宿主用 React.lazy 载入的那个组件，
//    遂成循环依赖：其时该导出解析为 undefined，整页当场崩
//    「Element type is invalid: expected a string … but got: undefined」。
//    且静态 import 会把其引擎从 lazy chunk 拖回宿主 chunk，lazy 前功尽弃。
//    治：常量另置一处零依赖的文件，宿主与组件各自引之。
import fs from 'fs';
import path from 'path';
import { SCHOOL_LABEL, SCHOOL_KEYS } from '../zhengchuanSchools';

const SRC = (...p) => path.join(__dirname, '..', '..', ...p);

describe('神数正传 · 流派名单一源', () => {
	test('五流派齐备', () => {
		expect(SCHOOL_KEYS).toEqual(['tieban', 'shaozi', 'dading', 'liuqin', 'xinyi']);
		SCHOOL_KEYS.forEach((k) => {
			expect(typeof SCHOOL_LABEL[k]).toBe('string');
			expect(SCHOOL_LABEL[k].length).toBeGreaterThan(1);
		});
	});

	test('🔴 常量文件零依赖（一有 import 便可能再度成环）', () => {
		const src = fs.readFileSync(SRC('shusuan', 'zhengchuanSchools.js'), 'utf8');
		expect(src).not.toMatch(/^import /m);
		expect(src).not.toMatch(/require\(/);
	});

	test('🔴 宿主不得静态 import 那个 lazy 组件（成环 → 整页崩）', () => {
		const host = fs.readFileSync(SRC('kinastro', 'KinAstroMain.js'), 'utf8');
		// lazy 那行是应有的；除它之外不得再有指向 ZhengChuanMain 的静态 import
		expect(host).toMatch(/React\.lazy\([\s\S]{0,120}?ZhengChuanMain'\)\)/);   // 真代码带 webpackChunkName 注释，正则须容之
		expect(host).not.toMatch(/^import .*from '\.\.\/shusuan\/ZhengChuanMain'/m);
		// 流派名须自独立常量文件引
		expect(host).toMatch(/from '\.\.\/shusuan\/zhengchuanSchools'/);
	});

	test('🔴 左栏下拉由单一源派生，不再手抄五行 Option（抄则必与盘题漂）', () => {
		const host = fs.readFileSync(SRC('kinastro', 'KinAstroMain.js'), 'utf8');
		expect(host).toMatch(/Object\.keys\(ZHENGCHUAN_SCHOOL_LABEL\)/);
		SCHOOL_KEYS.forEach((k) => {
			expect(host).not.toMatch(new RegExp(`<Option value="${k}">[^<]+</Option>`));
		});
	});

	test('组件自单一源取盘题，不另存一份', () => {
		const cmp = fs.readFileSync(SRC('shusuan', 'ZhengChuanMain.js'), 'utf8');
		expect(cmp).toMatch(/from '\.\/zhengchuanSchools'/);
		expect(cmp).not.toMatch(/const SCHOOL_LABEL = \{/);
		expect(cmp).toContain('SCHOOL_LABEL[m.school]');
	});
});

// 🔴 右栏子tab 与「勾了没反应」之防：antd Tabs 默认只渲染当前那一页，而本技法诸选项
//    各自只影响某一目 —— 只渲当前目，则改了不属眼前这目的选项，右栏纹丝不动。
//    (加 tab 那次，「改 sound/xqZhi/xqYushu → 右栏必变」三例当场转红，非臆测。)
describe('神数正传 · 右栏子tab', () => {
	const src = fs.readFileSync(SRC('shusuan', 'ZhengChuanMain.js'), 'utf8');
	const body = (src.match(/\tauxTabs\(items\) \{[\s\S]*?\n\t\}/) || [''])[0];

	test('样式类照本页诸兄弟（不另起一套）', () => {
		expect(body).toContain('horosa-huangji-tabs');
		expect(body).toContain('size="small"');
	});

	test('🔴 诸目一概 forceRender —— 漏之即「改了不属眼前这目的选项，右栏不动」', () => {
		expect(body).toMatch(/<TabPane[^>]*forceRender/);
	});

	test('只一目则不出页签（徒增一层）；无目则不出', () => {
		expect(body).toContain('if (list.length === 1) return list[0].node;');
		expect(body).toContain('if (!list.length) return null;');
	});

	test('null 项就地滤掉（某流派无此目 → 不出空页签）', () => {
		expect(body).toMatch(/\.filter\(\(x\) => x && x\.node\)/);
	});

	test('所选之目不在本流派目中时回落首目（切流派不留死 activeKey）', () => {
		expect(body).toMatch(/list\.some\(\(x\) => x\.key === this\.state\.auxTab\)/);
	});

	test('🔴 流年【列全】，不再截前 24（中栏明写覆盖 108 年，截之则自相矛盾）', () => {
		expect(src).not.toMatch(/rows\.slice\(0, ?24\)/);
		expect(src).toContain('流年条文（${ln.rows.length} 年全）');
	});
});
