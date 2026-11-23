// 弹窗 / 抽屉不超过它所在的那块窗口 —— 全站一条规则(01-base),参照物是弹窗外层固定定位的 wrap / 抽屉根(百分比):
//   · 不用 100vw:标准化 zoom 引擎下按物理视口算,壳放大档限不住,比窗口宽的居中弹窗会掉到可视区下面;
//   · 不用 --horosa-lvw:放大档页面有最小布局宽,页面横滚时它比实际窗口宽。
// 各弹窗 / 抽屉不再各写一份封顶(此前三处抽屉各写 lvw 封顶);弹窗 / 抽屉正文用实底(半透明大面板透出底下的页面)。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && !e.name.startsWith('.umi')){ walk(p, out); } }
		else if(/\.less$/.test(e.name)){ out.push(p); }
	});
	return out;
}

describe('弹窗 / 抽屉封顶与实底', ()=>{
	it('全站一条百分比封顶规则', ()=>{
		const base = read('layouts/app/01-base.less');
		expect(base).toMatch(/:root \.ant-modal \{ max-width: calc\(100% - 32px\); \}/);
		expect(base).toMatch(/:root \.ant-drawer-right > \.ant-drawer-content-wrapper \{ max-width: 100%; \}/);
	});
	it('没有哪条样式再拿 lvw 给抽屉 / 弹窗单独封顶', ()=>{
		const bad = walk(SRC, []).filter((f)=>/(ant-drawer-content-wrapper|ant-modal)\b[^{]*\{[^}]*max-width:\s*calc\(100 \* var\(--horosa-lvw/.test(fs.readFileSync(f, 'utf8')))
			.map((f)=>path.relative(SRC, f));
		expect(bad).toEqual([]);
	});
	it('弹窗 / 抽屉正文实底:全局、工作区内原地渲染、统一弹窗件三处都是 surface-solid', ()=>{
		const shell = read('layouts/app/02-shell.less');
		expect(shell).toMatch(/\.ant-modal-content,\n\s*\.ant-drawer-content \{\n\s*background: var\(--horosa-surface-solid\);/);
		expect(shell).toMatch(/\.horosa-workspace-shell \.ant-modal-content,\n\s*\.horosa-workspace-shell \.ant-drawer-content \{\n\s*background: var\(--horosa-surface-solid\);/);
		const nav = read('components/xq-ui/styles/navigation.less');
		const xqModal = /\.xq-modal \.ant-modal-content \{([^}]*)\}/.exec(nav);
		expect(xqModal && xqModal[1]).toMatch(/var\(--horosa-surface-solid\)/);
	});
});
