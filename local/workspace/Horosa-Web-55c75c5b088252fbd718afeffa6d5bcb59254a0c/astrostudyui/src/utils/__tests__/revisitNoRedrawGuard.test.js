// 切走再切回(回访)不白白重建盘面:三处接线锁。
// 紫微回访曾整盘重建(近四千次 DOM 改动),七政轮盘回访一帧连排四遍;病根都是「内容没变、对象换了」。
import fs from 'fs';
import path from 'path';

const read = (rel)=>fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8');

describe('回访不重建', ()=>{
	test('紫微:同内容沿用手上的盘对象;盘面按内容判', ()=>{
		const main = read('components/ziwei/ZiWeiMain.js');
		expect(main).toMatch(/if\(this\._resultJson === JSON\.stringify\(result\)\)\{ nextResult = prevResult; \}/);
		expect(main).toMatch(/result: nextResult,/);
		const chart = read('components/ziwei/ZiWeiChart.js');
		expect(chart).toMatch(/&& sameJsonContent\(last\.value, sig\.value\)/);
		expect(chart).not.toMatch(/&& last\.value === sig\.value/);
	});

	test('六壬:与盘面上已画的入参逐字相同不重画;同尺寸的观察器回调不重画;空盘不参与', ()=>{
		const src = read('components/lrzhan/LiuRengChart.js');
		expect(src).toMatch(/this\._drawnInputSig = this\.drawInputSignature\(\);/);
		expect(src).toMatch(/if\(this\.props\.value !== undefined && this\.props\.value !== null && this\._drawnInputSig\)\{/);
		expect(src).toMatch(/if\(sig !== null && sig === this\._drawnInputSig\)\{\s*return;/);
		expect(src).toMatch(/if\(this\._lastDrawnHost && this\._lastDrawnHost\.w === w && this\._lastDrawnHost\.h === h\)\{\s*return;/);
		// 签名覆盖 componentDidUpdate 里比的全部入参
		const sig = src.slice(src.indexOf('drawInputSignature(){'), src.indexOf('componentDidUpdate(prevProps){'));
		['p.value', 'p.liureng', 'p.runyear', 'p.gender', 'p.zhangshengElem', 'p.guireng', 'p.castOverride', 'p.panStyleName', 'p.timeAlg', 'p.chartType', 'p.compactPreview']
			.forEach((k)=>expect({ k, in: sig.includes(k) }).toEqual({ k, in: true }));
	});

	test('七政轮盘:只在画出来会不一样时重排;容器塌成 0 时不拿兜底值重量', ()=>{
		const src = read('components/guolao/GuoLaoMoiraWheel.js');
		expect(src).toMatch(/shouldComponentUpdate\(nextProps, nextState\)\{\s*return propsOrStateChanged\(this\.props, nextProps, this\.state, nextState, \['transitLoading'\]\);/);
		// 被忽略的入参确实没人读(读了就不能忽略)
		expect((src.match(/transitLoading/g) || []).length).toBe(2);
		expect(src).toMatch(/if\(collapsed && this\._measuredLaidOut\)\{\s*return;/);
	});
});
