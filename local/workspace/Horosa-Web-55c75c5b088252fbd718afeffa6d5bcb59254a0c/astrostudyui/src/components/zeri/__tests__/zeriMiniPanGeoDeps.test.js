// 择日结果行「概览」浮窗:开着时宿主换了地点(返回条件改地点后重扫 → previewGeo 换成新的冻结地点),
// 每张卡都必须按新地点重取 / 重排。此前六壬 / 三式 / 八字 / 紫微 / 七政 / 印度卡的依赖里没有地点,照旧显示旧地点的盘
// (太乙卡按 geo 引用比对才跟上)。按值比:宿主每次渲染新拼一个同值对象不重算。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const calls = { chart: [], gods: [], bazi: [], ziwei: [], taiyi: [] };
jest.mock('../../../services/astro', ()=>({
	fetchChart: jest.fn((p)=>{ calls.chart.push(p); return new Promise(()=>{}); }),   // 永不回:只看发了什么
}));
jest.mock('../../../utils/request', ()=>({
	__esModule: true,
	default: jest.fn((url, opt)=>{ calls.gods.push(JSON.parse((opt && opt.body) || '{}')); return new Promise(()=>{}); }),
}));
jest.mock('../../../utils/baziLunarLocal', ()=>{
	const actual = jest.requireActual('../../../utils/baziLunarLocal');
	return { ...actual, buildLocalBaziResult: (p)=>{ calls.bazi.push(p); return null; } };
});
jest.mock('../../ziwei/ZiweiCalc', ()=>{
	const actual = jest.requireActual('../../ziwei/ZiweiCalc');
	return { ...actual, calcZiwei: (b)=>{ calls.ziwei.push(b); return null; } };
});
jest.mock('../../../divination/zeri/taiyiZeriScanEngine', ()=>{
	const actual = jest.requireActual('../../../divination/zeri/taiyiZeriScanEngine');
	return { ...actual, computeTaiyiScanPan: (g)=>{ calls.taiyi.push(g); return null; } };
});
jest.mock('../../../services/rules', ()=>({ ziweirulesCached: ()=>new Promise(()=>{}) }));

// eslint-disable-next-line import/first
import ZeriMiniPanPopup, { geoDepKey } from '../ZeriMiniPanPopup';

const ROW = { start: '2026-05-01 10:00', pick: '2026-05-01 10:00' };
const OPTS = {};   // 宿主传冻结参数(同一引用),只让地点变
const G1 = { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, pos: '北京' };
const G2 = { zone: '+08:00', lon: '121e28', lat: '31n14', gpsLon: 121.47, gpsLat: 31.23, pos: '上海' };

function mount(host, tech, geo){
	return act(async ()=>{
		ReactDOM.render(<ZeriMiniPanPopup tech={tech} row={ROW} geo={geo} techOptions={OPTS} onClose={()=>{}} />, host);
		await new Promise((r)=>setTimeout(r, 0));
	});
}

describe('概览浮窗:地点变了按新地点重取', ()=>{
	let host;
	beforeEach(()=>{
		Object.keys(calls).forEach((k)=>{ calls[k].length = 0; });
		host = document.createElement('div');
		document.body.appendChild(host);
	});
	afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); });

	const lonsOf = (list)=>list.map((p)=>(p && (p.lon !== undefined ? p.lon : p.geoParams && p.geoParams.lon)));
	test.each([
		['liureng', 'chart'], ['liureng', 'gods'], ['sanshi', 'chart'], ['qizheng', 'chart'], ['india', 'chart'],
		['bazi', 'bazi'], ['ziwei', 'ziwei'], ['taiyi', 'taiyi'],
	])('%s 卡(%s):换地点后用新地点再取一次;同值新对象不重取', async (tech, channel)=>{
		await mount(host, tech, G1);
		const n1 = calls[channel].length;
		expect(n1).toBeGreaterThanOrEqual(1);
		await mount(host, tech, { ...G1 });   // 同值新对象
		expect(calls[channel].length).toBe(n1);
		await mount(host, tech, G2);
		expect(calls[channel].length).toBeGreaterThan(n1);
		const last = calls[channel][calls[channel].length - 1];
		if(channel === 'taiyi'){ expect(last).toEqual(G2); } else { expect(lonsOf([last])[0]).toBe(G2.lon); }
	});

	test('地点依赖键按值比', ()=>{
		expect(geoDepKey(G1)).toBe(geoDepKey({ ...G1 }));
		expect(geoDepKey(G1)).not.toBe(geoDepKey(G2));
		expect(geoDepKey(null)).toBe(geoDepKey({}));
	});
});
