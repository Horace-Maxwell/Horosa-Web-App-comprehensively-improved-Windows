// 月历自适应:applyCellFit 的 DOM 读数各自带兜底(内容签名 / 离屏测量都有 try),剩下只是算术与 setState;
// ResizeObserver.disconnect、从自己的父节点移除测量台都不会抛 —— 这几处直调。
import fs from 'fs';
import path from 'path';
import NongLi from '../NongLi';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'NongLi.js'), 'utf8');

function mkHost(){
	const host = Object.create(NongLi.prototype);
	host.props = {};
	host.state = { cellScale: 1, cellDensity: 'full', cellVLevel: 0 };
	host.setState = jest.fn(function(p){ this.state = { ...this.state, ...p }; });
	return host;
}

describe('月历自适应直调', ()=>{
	let savedRO;
	beforeEach(()=>{ savedRO = global.ResizeObserver; });
	afterEach(()=>{ global.ResizeObserver = savedRO; });

	test('窗口 resize 兜底:按根节点布局宽重算格比例 / 密度', ()=>{
		const host = mkHost();
		host._fitRoot = { clientWidth: 700, querySelector: ()=>null };
		host.fitOnWinResize();
		expect(host.setState).toHaveBeenCalledWith({ cellScale: 0.66, cellDensity: 'compact', cellVLevel: 0 });
		host._fitRoot = null;
		host.fitOnWinResize();
		expect(host.setState).toHaveBeenCalledTimes(1);
	});

	test('挂根节点:建观察器并按当前宽首测;换根 / 卸载时断开', ()=>{
		const made = [];
		global.ResizeObserver = class { constructor(cb){ this.cb = cb; this.observe = jest.fn(); this.disconnect = jest.fn(); made.push(this); } };
		const host = mkHost();
		const el = document.createElement('div');
		Object.defineProperty(el, 'clientWidth', { value: 1050 });
		host.captureRoot(el);
		expect(made.length).toBe(1);
		expect(made[0].observe).toHaveBeenCalledWith(el);
		expect(host.setState).not.toHaveBeenCalled();   // 1050/7=150 → 比例 1、full、0 级,与初值相同不 setState
		made[0].cb([{ contentRect: { width: 560 } }]);
		expect(host.state.cellDensity).toBe('mini');
		host.captureRoot(null);
		expect(made[0].disconnect).toHaveBeenCalledTimes(1);
		expect(host._fitRO).toBe(null);
		host.captureRoot(el);
		host.componentWillUnmount();
		expect(made[1].disconnect).toHaveBeenCalledTimes(1);
		expect(host._fitRO).toBe(null);
	});

	test('离屏测量台用完即拆,不在 body 里留节点', ()=>{
		const host = mkHost();
		const root = document.createElement('div');
		const card = document.createElement('div');
		card.className = 'horosa-lunar-date-card';
		card.textContent = '初一 甲子';
		root.appendChild(card);
		document.body.appendChild(root);
		host._fitRoot = root;
		const before = document.body.children.length;
		const hs = host.measureLevelNaturalHeights(120, 0.8, 'compact');
		expect(Array.isArray(hs) && hs.length).toBe(5);
		expect(document.body.children.length).toBe(before);
		expect(host._measuring).toBe(false);
		document.body.removeChild(root);
	});

	test('源码:五处直调,不再外包空 try', ()=>{
		expect(SRC).not.toMatch(/try\{\s*this\.applyCellFit/);
		expect(SRC).not.toMatch(/try\{\s*this\._fitRO\.disconnect/);
		expect(SRC).not.toMatch(/try\{\s*shell\.parentNode\.removeChild/);
		expect(SRC.split('this._fitRO.disconnect();').length - 1).toBe(2);
		expect(SRC).toContain('this.applyCellFit(el.clientWidth);');
		expect(SRC).toContain('this.applyCellFit(this._fitRoot.clientWidth);');
	});
});
