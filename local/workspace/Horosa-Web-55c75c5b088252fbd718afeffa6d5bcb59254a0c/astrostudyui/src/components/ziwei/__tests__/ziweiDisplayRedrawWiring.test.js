// 紫微「纯显示层开关」的重绘链锁。
//
// 病灶(2026-07-31 运行时死开关审计实证,已修):
//   「显示杂曜」「显示十二神」点了盘面纹丝不动 —— localStorage 写了、checkbox 状态也变了,
//   但盘面 DOM 变更 0 次。根因是两层叠加:
//   ① ZiWeiInput.redrawChart() 靠「把同一份时间字段原样再传一次」求重绘,而这两个开关是纯显示层、
//      不进排盘请求体 → 参数逐字节相等,必被 requestDedupe 命中,chart 引用不变。
//   ② 即便强制 re-render,ZiWeiChart 的重绘签名守卫只比较 props,而 zwShowOthers/zwShowSmall
//      是从 localStorage 读的 —— 不在签名里,守卫判「输入未变」直接 return,整树不重建。
//
// 修法:显示层改走「写仓 + 广播」(同 divinationJudgeGlobals 范式),ZiWeiMain 监听事件递增
// zwDisplayRev 并透传给 ZiWeiChart,该版本号进签名。此测试锁住这条链的每一环。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
// 剥注释:注释里出现键名不等于代码消费了它(本仓踩过三次「grep 被自写注释骗」)。
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const HELPER = strip(read('components/ziwei/ZiWeiHelper.js'));
const INPUT = strip(read('components/ziwei/ZiWeiInput.js'));
const MAIN = strip(read('components/ziwei/ZiWeiMain.js'));
const CHART = strip(read('components/ziwei/ZiWeiChart.js'));

describe('紫微显示层开关 → 盘面重绘链', () => {
	test('① Helper 暴露事件名与广播口', () => {
		expect(HELPER).toContain('ZIWEI_DISPLAY_EVENT');
		expect(HELPER).toContain('bumpZwDisplayRev');
		expect(HELPER).toContain('dispatchEvent');
	});

	test('② 两个开关的 handler 发广播,而不是借道 redrawChart 假装数据变了', () => {
		['onShowOthersChange', 'onShowSmallChange'].forEach((fn) => {
			const at = INPUT.indexOf(`${fn}(e)`);
			expect(at).toBeGreaterThan(-1);
			const body = INPUT.slice(at, INPUT.indexOf('\n\t}', at) + 3);
			expect(body).toContain('bumpZwDisplayRev');
			// redrawChart 对纯显示层无效(参数不变→dedupe 命中),不该再出现在这两个 handler 里
			expect(body).not.toContain('this.redrawChart()');
		});
	});

	test('③ Main 监听事件递增版本号,并在卸载时摘监听', () => {
		expect(MAIN).toContain('ZIWEI_DISPLAY_EVENT');
		expect(MAIN).toContain('zwDisplayRev');
		expect(MAIN).toContain('addEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT');
		expect(MAIN).toContain('removeEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT');
		// 必须真的透传给盘面组件,否则版本号只是躺在 state 里
		expect(/zwDisplayRev=\{this\.state\.zwDisplayRev/.test(MAIN)).toBe(true);
	});

	test('④ 重绘签名同时包含 zwDisplayRev 的**构造**与**比较**(缺一即恒跳过重绘)', () => {
		expect(CHART).toContain('zwDisplayRev: this.props.zwDisplayRev');
		expect(CHART).toContain('last.zwDisplayRev === sig.zwDisplayRev');
	});

	test('⑤ 绘制层仍按开关取杂曜/十二神(消费端没被顺手改掉)', () => {
		const sanghe = strip(read('components/ziwei/ZWHouseSangHe.js'));
		const house = strip(read('components/ziwei/ZWHouse.js'));
		expect(sanghe).toContain('zwShowOthers');
		expect(house).toContain('zwShowOthers');
		expect(HELPER).toContain('ziweiShowOthers');
		expect(HELPER).toContain('ziweiShowSmall');
	});
});
