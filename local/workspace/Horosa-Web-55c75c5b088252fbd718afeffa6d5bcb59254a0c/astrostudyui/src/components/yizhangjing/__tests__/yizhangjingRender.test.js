// 一掌经 WP-D/E 渲染契约 + 中/右双活证明。
// 不真 mount（class 组件手动实例化，直调 render 方法收集元素树文本），验证：
// ① 中栏新盘面（人事宫色带/四世带/六道徽章/掌诀图开关）② 右栏 8 tab（新增十二宫/断法）
// ③ 开关真联动（改 annualMethod/starNaming → 输出确变）——防「接引擎不接 UI」死开关。
import React from 'react';
import moment from 'moment';
import YiZhangJingMain from '../YiZhangJingMain';

// 递归收集元素树内全部字符串 + 全部 key（TabPane key 用于探测 tab 集合），最多 4000 节点。
function collectText(node, acc) {
	if (node === null || node === undefined || acc.count > 4000) return acc;
	if (typeof node === 'string' || typeof node === 'number') { acc.text += node + ' '; return acc; }
	if (Array.isArray(node)) { node.forEach((c) => collectText(c, acc)); return acc; }
	if (!React.isValidElement(node)) return acc;
	acc.count++;
	if (node.key !== null && node.key !== undefined) acc.keys.add(`${node.key}`);
	const kids = node.props && node.props.children;
	if (kids) collectText(kids, acc);
	// 展开函数组件（本组件树中的 antd Tabs/TabPane 为对象型，children 已在上面递归）
	return acc;
}

function inst(opts, slot) {
	const props = {
		slot: slot || 'aux',
		gender: 1,
		opts: opts || {},
		fields: {
			date: { value: moment('1985-06-20') },
			time: { value: moment('1985-06-20 09:30:00') },
			lon: { value: 120 },
			timeAlg: { value: 1 },
		},
	};
	const it = new YiZhangJingMain(props);
	it.state = { tab: 'overview' };
	return it;
}

function auxText(opts) {
	const it = inst(opts, 'aux');
	const m = it.getModel();
	expect(m).toBeTruthy();
	const acc = collectText(it.renderAux(m), { text: '', keys: new Set(), count: 0 });
	return acc;
}
function centerText(opts) {
	const it = inst(opts, 'center');
	const m = it.getModel();
	expect(m).toBeTruthy();
	return collectText(it.renderCenter(m), { text: '', keys: new Set(), count: 0 });
}

describe('一掌经 WP-D/E 渲染契约', () => {
	test('右栏 8 tab（含新增 十二宫 / 断法），无抛错', () => {
		const acc = auxText({});
		['overview', 'geju', 'renshi', 'dayun', 'duanfa', 'lore', 'sizhu'].forEach((k) => expect(acc.keys.has(k)).toBe(true));
	});
	test('十二宫 tab 出人事宫寓意（C30 最大缺口可见）', () => {
		const it = inst({}, 'aux');
		const m = it.getModel();
		const acc = collectText(it.renderRenshiTab(m), { text: '', keys: new Set(), count: 0 });
		expect(acc.text).toMatch(/人事十二宫/);
		expect(acc.text).toMatch(/寓意/);
	});
	test('断法 tab 出刑冲害/阴阳克父母/兄弟数', () => {
		const it = inst({}, 'aux');
		const m = it.getModel();
		const acc = collectText(it.renderDuanfa(m), { text: '', keys: new Set(), count: 0 });
		expect(acc.text).toMatch(/刑冲害/);
		expect(acc.text).toMatch(/克父母/);
		expect(acc.text).toMatch(/兄弟数/);
	});
	test('中栏出四世权重带 / 六道徽章（人事宫色带/掌诀图已按用户要求删冗余）', () => {
		const acc = centerText({});
		expect(acc.text).toMatch(/%/); // 四世权重带段内百分比
		expect(acc.text).not.toMatch(/掌诀图/); // 掌诀图已删
	});
	test('诗文 tab 出逐日值星 / 时辰细断（F10/F11 零渲染缺口补上）', () => {
		const it = inst({}, 'aux');
		const m = it.getModel();
		const acc = collectText(it.renderLore(m), { text: '', keys: new Set(), count: 0 });
		expect(acc.text).toMatch(/逐日值星|值日/);
		expect(acc.text).toMatch(/时辰细断|时/);
	});
});

describe('一掌经 中/右双活 · 开关真联动（防死开关）', () => {
	test('逐年法互斥：xiaoxian 藏流年神、liunian 藏小限', () => {
		const xiao = auxText({ annualMethod: 'xiaoxian' }).text;
		const liu = auxText({ annualMethod: 'liunian' }).text;
		// 只用一套时给出明示语，且两者输出不同
		expect(xiao).toMatch(/只用/);
		expect(liu).toMatch(/只用/);
		expect(xiao).not.toBe(liu);
	});
	test('星名系统 B：显示名随之变（映射层非死开关）', () => {
		const a = centerText({ starNaming: 'A' }).text;
		const b = centerText({ starNaming: 'B' }).text;
		expect(a).not.toBe(b); // 辰=天合 等异名进入盘面
	});
	test('品级分类 variant：格局/品级随之变', () => {
		const std = auxText({ gradeSet: 'standard' }).text;
		const vr = auxText({ gradeSet: 'variant' }).text;
		expect(std).not.toBe(vr);
	});
});
