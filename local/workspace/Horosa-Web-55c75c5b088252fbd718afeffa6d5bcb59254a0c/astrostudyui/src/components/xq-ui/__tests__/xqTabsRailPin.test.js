// 竖排页签条钉边:工作区横向滚动时页签条不被推出可见区(放大档宿盘曾整条落在窗口外)。
import { railPinShift } from '..';

describe('railPinShift', ()=>{
	const visible = { left: 0, right: 1000 };
	it('放得下(没越出可见区)不动', ()=>{
		expect(railPinShift({ left: 900, right: 990 }, visible)).toBe(0);
		expect(railPinShift({ left: 0, right: 90 }, visible)).toBe(0);
	});
	it('🔴 右边越出 → 往左挪回可见区(布局 px = 屏幕 px × k)', ()=>{
		expect(railPinShift({ left: 1100, right: 1190 }, visible)).toBe(-190);
		expect(railPinShift({ left: 1100, right: 1190 }, visible, 1 / 1.8)).toBe(-106);
	});
	it('左边越出(左侧页签条、外层已往右滚)→ 往右挪', ()=>{
		expect(railPinShift({ left: -60, right: 30 }, visible)).toBe(60);
	});
	it('亚像素误差不动;缺量不动', ()=>{
		expect(railPinShift({ left: 900, right: 1000.4 }, visible)).toBe(0);
		expect(railPinShift(null, visible)).toBe(0);
	});
});

// 挂载行为:外层横滚把页签条推出可见区 → 钉回并挂 is-pinned;滚到尽头 → 回位去类;卸载 → 复原、不再听滚动。
// jsdom 没有布局:滚动容器与页签条的屏幕矩形由桩给出,页签条矩形随自身 translateX 平移(与真内核一致)。
describe('useRailPin 挂载行为', ()=>{
	const React = require('react');
	const ReactDOM = require('react-dom');
	const { act } = require('react-dom/test-utils');
	const { XQTabs } = require('..');
	const { TabPane } = require('antd').Tabs;

	let host;
	let scroller;
	let rafQ;
	const restore = [];
	// 页签条在滚动内容里的位置:内容 1300 宽,页签条占 1200–1290(右侧留 10px 内边距);视口 1000 宽
	const state = { contentLeft: 1200, scrollLeft: 0 };
	const flush = ()=>act(()=>{ while(rafQ.length){ rafQ.shift()(); } });
	const shiftOf = (el)=>{ const m = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(el.style.transform || ''); return m ? parseFloat(m[1]) : 0; };

	beforeEach(()=>{
		rafQ = [];
		state.contentLeft = 1200;
		state.scrollLeft = 0;
		const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb)=>{ rafQ.push(cb); return rafQ.length; });
		const cafSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(()=>{});
		const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(){
			if(this.dataset && this.dataset.testScroller){ return { left: 0, right: 1000, top: 0, bottom: 600, width: 1000, height: 600 }; }
			if(this.classList.contains('xq-tab-rail')){
				const left = state.contentLeft - state.scrollLeft + shiftOf(this);
				return { left, right: left + 90, top: 0, bottom: 600, width: 90, height: 600 };
			}
			return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
		});
		restore.push(()=>{ rafSpy.mockRestore(); cafSpy.mockRestore(); rectSpy.mockRestore(); });
		scroller = document.createElement('div');
		scroller.dataset.testScroller = '1';
		scroller.style.overflowX = 'auto';
		Object.defineProperty(scroller, 'scrollWidth', { configurable: true, get: ()=>1300 });
		Object.defineProperty(scroller, 'clientWidth', { configurable: true, get: ()=>1000 });
		Object.defineProperty(scroller, 'scrollLeft', { configurable: true, get: ()=>state.scrollLeft, set: (v)=>{ state.scrollLeft = v; } });
		host = document.createElement('div');
		scroller.appendChild(host);
		document.body.appendChild(scroller);
		act(()=>{
			ReactDOM.render(
				<XQTabs tabPosition="right" activeKey="a" onChange={()=>{}}>
					<TabPane tab="宿盘" key="a">内容</TabPane>
					<TabPane tab="金口诀" key="b">内容</TabPane>
				</XQTabs>,
				host,
			);
		});
	});
	afterEach(()=>{
		if(host.parentNode){ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); }
		scroller.remove();
		while(restore.length){ restore.pop()(); }
	});

	it('🔴 页签条在可见区右外 → 钉回可见区(停在滚到尽头时它自然停的位置:离右缘同样留 10px)并挂 is-pinned、标钉在右边', ()=>{
		flush();
		const nav = scroller.querySelector('.xq-tab-rail');
		expect(nav).toBeTruthy();
		expect(shiftOf(nav)).toBe(-300);
		expect(nav.classList.contains('is-pinned')).toBe(true);
		expect(nav.getAttribute('data-pin')).toBe('right');
		const r = nav.getBoundingClientRect();
		expect(r.right).toBe(990);
	});

	it('🔴 一路滚到尽头,钉住的位置连续收拢到自然位置 —— 解钉那一下不跳', ()=>{
		flush();
		const nav = scroller.querySelector('.xq-tab-rail');
		const rights = [];
		[100, 250, 299, 300].forEach((x)=>{
			state.scrollLeft = x;
			act(()=>{ scroller.dispatchEvent(new Event('scroll')); });
			flush();
			rights.push(nav.getBoundingClientRect().right);
		});
		expect(rights).toEqual([990, 990, 990, 990]);
		expect(nav.style.transform).toBe('');
		expect(nav.classList.contains('is-pinned')).toBe(false);
		expect(nav.hasAttribute('data-pin')).toBe(false);
	});

	it('🔴 滚到尽头(页签条自然落回可见区)→ 回位、去掉 is-pinned', ()=>{
		flush();
		const nav = scroller.querySelector('.xq-tab-rail');
		state.scrollLeft = 300;
		act(()=>{ scroller.dispatchEvent(new Event('scroll')); });
		flush();
		expect(nav.style.transform).toBe('');
		expect(nav.classList.contains('is-pinned')).toBe(false);
	});

	it('🔴 卸载后复原样式、不再听外层滚动', ()=>{
		flush();
		const nav = scroller.querySelector('.xq-tab-rail');
		expect(nav.classList.contains('is-pinned')).toBe(true);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		expect(nav.style.transform).toBe('');
		expect(nav.classList.contains('is-pinned')).toBe(false);
		rafQ.length = 0;
		scroller.dispatchEvent(new Event('scroll'));
		expect(rafQ.length).toBe(0);
	});

	it('外层不横滚(放得下)→ 什么都不做', ()=>{
		Object.defineProperty(scroller, 'scrollWidth', { configurable: true, get: ()=>1000 });
		state.naturalLeft = 905;
		act(()=>{ window.dispatchEvent(new Event('resize')); });
		flush();
		const nav = scroller.querySelector('.xq-tab-rail');
		expect(nav.style.transform).toBe('');
		expect(nav.classList.contains('is-pinned')).toBe(false);
	});
});
