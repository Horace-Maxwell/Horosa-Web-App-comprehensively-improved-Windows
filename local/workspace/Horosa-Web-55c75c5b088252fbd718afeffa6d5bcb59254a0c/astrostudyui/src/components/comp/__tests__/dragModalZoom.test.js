// 可拖动对话框在页面缩放档下必须「跟手」:鼠标位移是视觉域,translate 是 CSS px(布局域)。
// 引擎模型:rect 反映缩放(rect = 布局值 × Z)。判别向量:1.8 档下鼠标右移 180 视觉像素,对话框必须平移 100 CSS px(渲染出来正好 180 视觉像素);
// 旧件写的是 180 CSS px → 渲染成 324,比鼠标多跑 144。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import DragModal from '../DragModal';
import { __resetScaleCacheForTest } from '../../../utils/zoomDomain';

const realRect = Element.prototype.getBoundingClientRect;
let Z = 1;
let container;

function installEngine(z){
	Z = z;
	Element.prototype.getBoundingClientRect = function(){
		if(this.classList && this.classList.contains('ant-modal-content')){
			const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec((this.closest('.ant-modal-wrap') || {}).style ? this.closest('.ant-modal-wrap').style.transform : '');
			const dx = m ? parseFloat(m[1]) : 0; const dy = m ? parseFloat(m[2]) : 0;
			const l = (300 + dx) * Z; const t = (100 + dy) * Z; const w = 520 * Z; const h = 300 * Z;
			return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t };
		}
		const st = this.style || {};
		const px = (v) => (parseFloat(v) || 0) * Z;
		const l = px(st.left); const w = px(st.width);
		return { left: l, top: 0, width: w, height: 0, right: l + w, bottom: 0, x: l, y: 0 };
	};
	document.documentElement.style.zoom = z === 1 ? '' : String(z);
	__resetScaleCacheForTest();
}

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => {
	act(() => { ReactDOM.unmountComponentAtNode(container); });
	container.remove();
	document.querySelectorAll('.ant-modal-root').forEach((n) => n.remove());
	Element.prototype.getBoundingClientRect = realRect;
	document.documentElement.style.zoom = '';
	__resetScaleCacheForTest();
});

function dragBy(dxClient, dyClient){
	act(() => { ReactDOM.render(<DragModal open title="标题" footer={null} transitionName="" maskTransitionName="">正文</DragModal>, container); });
	const title = [...document.querySelectorAll('.ant-modal-title div')].find((d) => d.style.cursor === 'move');
	expect(title).toBeTruthy();
	act(() => { title.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 600, clientY: 200 })); });
	act(() => { document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 600 + dxClient, clientY: 200 + dyClient })); });
	act(() => { document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); });
	return document.querySelector('.ant-modal-wrap').style.transform;
}

describe('DragModal · 拖动位移换到布局域', () => {
	it('100% 档:位移逐值等于鼠标位移(与第三方原件同值)', () => {
		installEngine(1);
		expect(dragBy(180, 90)).toBe('translate(180px,90px)');
	});

	it('🔴 1.8 档:鼠标移 180×90 视觉像素 → 平移 100×50 CSS px(渲染出来正好跟手)', () => {
		installEngine(1.8);
		expect(dragBy(180, 90)).toBe('translate(100px,50px)');
	});

	it('0.7 档:鼠标移 70 视觉像素 → 平移 100 CSS px', () => {
		installEngine(0.7);
		const m = /translate\(([-\d.]+)px,([-\d.]+)px\)/.exec(dragBy(70, 0));
		expect(parseFloat(m[1])).toBeCloseTo(100, 4);
	});

	it('拖出窗口上沿时夹回(初始位置与视口同域比较)', () => {
		installEngine(1.8);
		const m = /translate\(([-\d.]+)px,([-\d.]+)px\)/.exec(dragBy(0, -900));
		expect(parseFloat(m[2])).toBeCloseTo(-100, 4);   // 原位 top = 100 CSS px ⇒ 最多上移 100
	});

	it('静态方法沿用 antd Modal(confirm / info 等调用点不受影响)', () => {
		expect(typeof DragModal.confirm).toBe('function');
	});
});
