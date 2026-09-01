jest.mock('../ZWChart', ()=>jest.fn().mockImplementation(()=>({
	draw: jest.fn(),
	zwindicator: {},
})));

import ZiWeiChart from '../ZiWeiChart';

// [Tahoe 域混根修] ensureChartSurfaceSize 行为合同:量容器必须走布局域(offsetWidth),
// 写回 style 才与消费端(svgdom.clientWidth)同域。判别向量=同时布假 rect(×0.9,模拟壳
// 缩放 0.9 档下 rect 域读数):若有人改回 getBoundingClientRect 读法,断言值 986→886 必红。
describe('ZiWeiChart 盘面尺寸域合同', ()=>{
	let stage, viewport, svg;

	beforeEach(()=>{
		stage = document.createElement('div');
		stage.className = 'horosa-chart-stage';
		viewport = document.createElement('div');
		svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.id = 'svgdomaintest';
		viewport.appendChild(svg);
		stage.appendChild(viewport);
		document.body.appendChild(stage);
		// 布局域读数(jsdom 默认 0,显式桩)
		Object.defineProperty(stage, 'offsetWidth', { value: 1000, configurable: true });
		Object.defineProperty(stage, 'offsetHeight', { value: 800, configurable: true });
		// 判别向量:rect 域读数=布局×0.9(壳缩放 0.9 档的真实形态)。实现若吃 rect 必得 886px。
		stage.getBoundingClientRect = ()=>({ width: 900, height: 720, top: 0, left: 0, right: 900, bottom: 720 });
	});

	afterEach(()=>{
		document.body.removeChild(stage);
	});

	test('🔴 布局域直读:1000×800 容器 → 986×786(=offset−pad),绝不是 rect 域的 886', ()=>{
		const c = new ZiWeiChart({ id: 'domaintest', fields: {}, rules: {} });
		const ok = c.ensureChartSurfaceSize();
		expect(ok).toBe(true);
		expect(viewport.style.width).toBe('986px');
		expect(viewport.style.height).toBe('786px');
		expect(svg.style.width).toBe('986px');
		expect(svg.style.height).toBe('786px');
	});

	test('容器 0 尺寸时不写样式,按 svg 现尺寸返回', ()=>{
		Object.defineProperty(stage, 'offsetWidth', { value: 0, configurable: true });
		Object.defineProperty(stage, 'offsetHeight', { value: 0, configurable: true });
		const c = new ZiWeiChart({ id: 'domaintest', fields: {}, rules: {} });
		const ok = c.ensureChartSurfaceSize();
		expect(ok).toBe(false);
		expect(viewport.style.width).toBe('');
	});
});
