// 卜卦 / 择日盘壳的「盘面美术」与「外环样式」跨会话:直接读写全局设置(globalSetup)里的对应键。
// 两组读写共用一对按键名读写的函数;这里按真实存储走一遍,确认读回 / 写入 / 坏数据兜底都照旧。
jest.mock('d3', () => ({}));
jest.mock('../../astro/AstroChart', () => () => null);
jest.mock('../../amap/GeoCoordModal', () => () => null);

import fs from 'fs';
import path from 'path';
import DivinationChartShell from '../DivinationChartShell';
import { GlobalSetupKey } from '../../../utils/constants';

function makeShell(props){
	const inst = new DivinationChartShell({ fields: {}, defaults: { tradition: 1, zodiacal: 0, hsys: 2 }, ...(props || {}) });
	inst.setState = (patch, cb) => {
		const next = typeof patch === 'function' ? patch(inst.state) : patch;
		inst.state = { ...inst.state, ...next };
		if(cb){ cb(); }
	};
	return inst;
}
const stored = ()=>JSON.parse(window.localStorage.getItem(GlobalSetupKey));

beforeEach(()=>{ window.localStorage.removeItem(GlobalSetupKey); });

describe('盘壳 · 全局设置里的盘面美术 / 外环样式', ()=>{
	test('开盘时读回已存的值(宿主没传时)', ()=>{
		window.localStorage.setItem(GlobalSetupKey, JSON.stringify({ wheelArt: 'medieval', chartStyle: 'original', other: 1 }));
		const s = makeShell();
		expect(s.state.wheelArt).toBe('medieval');
		expect(s.state.chartStyle).toBe('original');
	});
	test('没存过 / 存储坏了 / 存的是非法值:回落缺省', ()=>{
		expect(makeShell().state.wheelArt).toBe('classic');
		expect(makeShell().state.chartStyle).toBe('current');
		window.localStorage.setItem(GlobalSetupKey, '{bad json');
		expect(makeShell().state.wheelArt).toBe('classic');
		expect(makeShell().state.chartStyle).toBe('current');
		window.localStorage.setItem(GlobalSetupKey, 'null');
		expect(makeShell().state.wheelArt).toBe('classic');
		window.localStorage.setItem(GlobalSetupKey, JSON.stringify({ wheelArt: 'nope', chartStyle: 'nope' }));
		expect(makeShell().state.wheelArt).toBe('classic');
		expect(makeShell().state.chartStyle).toBe('current');
	});
	test('没有 dispatch 时改了就写回全局设置(归一化后),其余键原样保留', ()=>{
		window.localStorage.setItem(GlobalSetupKey, JSON.stringify({ other: 1 }));
		const s = makeShell();
		s.changeWheelArt({ target: { value: 'hellenistic' } });
		expect(stored()).toEqual({ other: 1, wheelArt: 'hellenistic' });
		s.changeWheelArt('bogus');
		expect(stored().wheelArt).toBe('classic');
		s.changeChartStyle({ target: { value: 'original' } });
		expect(stored()).toEqual({ other: 1, wheelArt: 'classic', chartStyle: 'original' });
		s.changeChartStyle('bogus');
		expect(stored().chartStyle).toBe('current');
		expect(s.state.chartStyle).toBe('bogus');   // 本壳 state 存原值,渲染时再归一(与此前一致)
	});
	test('有 dispatch 时走 app/save,不直接写存储', ()=>{
		const calls = [];
		const s = makeShell({ dispatch: (a)=>calls.push(a) });
		s.changeWheelArt('southIndian');
		s.changeChartStyle('original');
		expect(calls).toEqual([{ type: 'app/save', payload: { wheelArt: 'southIndian' } }, { type: 'app/save', payload: { chartStyle: 'original' } }]);
		expect(window.localStorage.getItem(GlobalSetupKey)).toBeNull();
	});
	test('源码:四个读写函数共用一对按键名读写', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'DivinationChartShell.js'), 'utf8');
		expect((src.match(/readGlobalSetupField\(key\)/g) || []).length).toBe(1);   // 读一处:全局设置单源的内存镜像
		expect(src).not.toMatch(/getItem\(Constants\.GlobalSetupKey\)/);
		expect(src).toContain('mergeGlobalSetupWrite({ [key]: value });');   // 写经全局设置落盘单源(以存储现值为底合并)
		expect(src).toContain("function readStoredWheelArt(){ return AstroConst.normalizeWheelArt(readGlobalSetupKey('wheelArt')); }");
		expect(src).toContain("function writeStoredChartStyle(chartStyle){ writeGlobalSetupKey('chartStyle', AstroConst.normalizeChartStyle(chartStyle)); }");
	});
});
