// [黄历月历高度链哨兵] 六周月份末行被裁事故(2026-08-30 用户实报)的防回归锚。
//
// 病理复读:.horosa-calendar-board-panel 有 padding14+border1(上下合 30px),NongLi 若拿
// HuangLiMain 算好的**外框数字**(工作区高−30)会恰好高出面板内容盒 ⇒ 面板 overflow:hidden
// 把日历底裁掉——五周月裁的是空白不显形,六周月裁刀正落在末行格子的下边框上。
// 修法=height='100%' 直接贴面板内容盒(by construction 平账,不做算术)。
// 本套件锚死这两个前提;判别向量已自证:把 '100%' 改回 {height} 时锚 A 必红。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('黄历月历高度链(六周月末行裁切防回归)', () => {
	it("🔴 锚A:HuangLiMain 传给 <NongLi 的必须是 height='100%'(禁回外框数字)", () => {
		const t = read('components/calendar/HuangLiMain.js');
		// 剥注释后判定(literal-sentinel 双向陷阱:修复注释里复写旧写法不许触发假红)
		const code = t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
		const m = /<NongLi[\s\S]{0,400}?height=([^\s/>]+)/.exec(code);
		expect(m && m[1]).toBe("'100%'");
	});

	it('锚B:面板 overflow:hidden 在位(平账的另一半——溢出裁切语义不许静默变滚动/可见)', () => {
		const less = read('layouts/app.less');
		const i = less.indexOf('.horosa-workspace-shell .horosa-calendar-board-panel,');
		expect(i).toBeGreaterThan(0);
		const seg = less.slice(i, i + 400);
		expect(seg.indexOf('overflow: hidden')).toBeGreaterThan(0);
	});
});
