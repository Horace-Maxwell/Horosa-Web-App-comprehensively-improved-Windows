// 竖排页签条「选中项滚入视野」在整页缩放下的换算。
// 背景:根节点 zoom 0.9 时,getBoundingClientRect 给的是缩放后的尺寸,scrollTop 是缩放前的;
// 两者直接相加减会少滚一成 —— 点最末一项时它停在底部渐隐带里发灰,还压着窗口右下角的状态灯。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { XQTabs } from '../index';

const { TabPane } = require('antd').Tabs;

const PITCH = 32;        // 每个页签的高度(缩放前)
const COUNT = 33;
const WRAP_H = 710;      // 页签条可视高度(缩放前)
const TAIL = 22;         // 列表末尾留白(避让状态灯)

function mount(zoom, activeKey){
	const host = document.createElement('div');
	document.body.appendChild(host);
	const state = { scrollTop: 0 };
	const maxScroll = COUNT * PITCH + TAIL - WRAP_H;
	const rect = (top, height)=>({ top: top * zoom, bottom: (top + height) * zoom, height: height * zoom, left: 0, right: 98 * zoom, width: 98 * zoom });
	const protoRect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(){
		if(this.classList.contains('xq-tab-rail-wrap')){ return rect(0, WRAP_H); }
		if(this.classList.contains('ant-tabs-tab')){
			const at = Array.prototype.indexOf.call(this.parentNode.children, this);
			return rect(at * PITCH - state.scrollTop, PITCH);
		}
		return rect(0, 0);
	});
	const defs = {
		offsetHeight: { get(){ return this.classList.contains('xq-tab-rail-wrap') ? WRAP_H : 0; } },
		offsetWidth: { get(){ return this.classList.contains('xq-tab-rail-wrap') ? 98 : 0; } },
		clientHeight: { get(){ return this.classList.contains('xq-tab-rail-wrap') ? WRAP_H : 0; } },
		scrollHeight: { get(){ return this.classList.contains('xq-tab-rail-wrap') ? COUNT * PITCH + TAIL : 0; } },
		scrollTop: {
			get(){ return this.classList.contains('xq-tab-rail-wrap') ? state.scrollTop : 0; },
			set(v){ if(this.classList.contains('xq-tab-rail-wrap')){ state.scrollTop = Math.max(0, Math.min(maxScroll, v)); } },
		},
	};
	const saved = {};
	Object.keys(defs).forEach((k)=>{
		saved[k] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k) || Object.getOwnPropertyDescriptor(Element.prototype, k);
		Object.defineProperty(HTMLElement.prototype, k, { configurable: true, ...defs[k] });
	});
	const render = (key)=>act(()=>{
		ReactDOM.render(
			<XQTabs tabPosition="right" activeKey={key} onChange={()=>{}}>
				{Array.from({ length: COUNT }, (_, i)=>(<TabPane tab={`页签${i}`} key={`k${i}`}>内容</TabPane>))}
			</XQTabs>,
			host,
		);
	});
	render(activeKey);
	const cleanup = ()=>{
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		host.remove();
		protoRect.mockRestore();
		Object.keys(defs).forEach((k)=>{
			if(saved[k]){ Object.defineProperty(HTMLElement.prototype, k, saved[k]); }else{ delete HTMLElement.prototype[k]; }
		});
	};
	return { host, state, render, cleanup, maxScroll };
}

describe('页签条选中项滚入视野(整页缩放)', ()=>{
	[1, 0.9, 0.8, 1.1].forEach((zoom)=>{
		test(`缩放 ${zoom}:点最末一项滚到底,不留底部渐隐`, ()=>{
			const m = mount(zoom, 'k3');
			try{
				expect(m.state.scrollTop).toBe(0);
				m.render(`k${COUNT - 1}`);
				expect(m.state.scrollTop).toBe(m.maxScroll);
				const wrap = m.host.querySelector('.xq-tab-rail-wrap');
				expect(wrap.getAttribute('data-more')).toBe('top');
			}finally{ m.cleanup(); }
		});

		test(`缩放 ${zoom}:中段的项停在渐隐带之外`, ()=>{
			const m = mount(zoom, 'k0');
			try{
				m.render('k26');
				// 选中项下缘到页签条下缘的距离(缩放前)要大过 30px 的渐隐带
				const below = WRAP_H - ((26 + 1) * PITCH - m.state.scrollTop);
				expect(below).toBeGreaterThanOrEqual(30);
				expect(below).toBeLessThan(40);
				// 先滚到底,再回到被顶缘压住的项:上缘同样留白
				m.render(`k${COUNT - 1}`);
				m.render('k12');
				const above = 12 * PITCH - m.state.scrollTop;
				expect(above).toBeGreaterThanOrEqual(30);
				expect(above).toBeLessThan(40);
				// 第一项:滚回顶,不留顶部渐隐
				m.render('k0');
				expect(m.state.scrollTop).toBe(0);
			}finally{ m.cleanup(); }
		});
	});
});

// 同类:凡是「拿矩形差值去改 scrollTop」的地方都要先折回滚动量的单位(矩形随整页缩放,scrollTop 不随)
describe('矩形差值 → scrollTop 的换算走同一出口', ()=>{
	const fs = require('fs');
	const path = require('path');
	const SRC = path.resolve(__dirname, '../../..');
	const SITES = [
		'components/xq-ui/index.js',
		'components/astro/ChartDisplaySelector.js',
		'components/astro/AstroDirectedFigures.js',
		'components/astro/AstroPersianDirected.js',
		'components/help/HelpBook.js',
	];
	test.each(SITES)('%s', (rel)=>{
		const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
		const { fileImportsName } = require('../../../utils/__tests__/helpers/importSpecs');   // 按 AST 认 import
		expect(fileImportsName(path.join(SRC, rel), { name: 'pointerLocalRatio', target: path.join(SRC, 'utils', 'zoomDomain.js') })).toBe(true);
		expect(src).toMatch(/pointerLocalRatio\([a-zA-Z]+, [a-zA-Z]+\)\.ky/);
	});

	test('没有新的未换算写法', ()=>{
		const offenders = [];
		const walk = (dir)=>fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
			const p = path.join(dir, d.name);
			if(d.isDirectory()){
				if(d.name === '__tests__' || d.name === 'node_modules' || d.name.startsWith('.umi')){ return; }
				walk(p);
				return;
			}
			if(!/\.js$/.test(d.name)){ return; }
			const src = fs.readFileSync(p, 'utf8');
			src.split('\n').forEach((line, i)=>{
				// 同一行里既量矩形又写滚动位置、却没有换算
				if(/scroll(Top|Left)\s*=[^=]/.test(line) && /getBoundingClientRect\(\)/.test(line)){ offenders.push(`${path.relative(SRC, p)}:${i + 1}`); }
			});
			// 文件里用矩形差值改纵向滚动位置的,必须引入换算
			if(/getBoundingClientRect\(\)\.top\s*-/.test(src) && /\.scrollTop\s*=[^=]/.test(src) && !/pointerLocalRatio/.test(src)){
				offenders.push(path.relative(SRC, p));
			}
		});
		walk(path.join(SRC, 'components'));
		expect(offenders).toEqual([]);
	});
});
