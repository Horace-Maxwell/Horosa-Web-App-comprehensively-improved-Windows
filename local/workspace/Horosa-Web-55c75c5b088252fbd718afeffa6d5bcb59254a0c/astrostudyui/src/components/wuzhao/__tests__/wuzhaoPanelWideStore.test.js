// 五兆左栏展宽态:与侧栏折叠态共用一张 map(horosa.sidebar.collapse.v1 的 wuzhao.panelWide 项)。
// safeJsonParseFromStorage / safeJsonStringifyToStorage 自带全部兜底(读失败回 null、坏 JSON 自愈、写失败静默),
// 读写两函数直调。
import fs from 'fs';
import path from 'path';
import WuZhaoMain from '../WuZhaoMain';

const KEY = 'horosa.sidebar.collapse.v1';
const SRC = fs.readFileSync(path.join(__dirname, '..', 'WuZhaoMain.js'), 'utf8');

function mkHost(){
	const h = Object.create(WuZhaoMain.prototype);
	h.state = { panelWide: false };
	h.setState = function(p){ this.state = { ...this.state, ...p }; };
	return h;
}

describe('五兆左栏展宽态本机持久', ()=>{
	beforeEach(()=>{ window.localStorage.removeItem(KEY); });

	test('切换展宽:写进共用 map,保留同 map 里的其它项', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ 'astro.side': true }));
		const h = mkHost();
		h.togglePanelWide();
		expect(h.state.panelWide).toBe(true);
		expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ 'astro.side': true, 'wuzhao.panelWide': true });
		h.togglePanelWide();
		expect(JSON.parse(window.localStorage.getItem(KEY))['wuzhao.panelWide']).toBe(false);
	});

	test('map 是数组 / 坏 JSON / 空:写入时另起一张新 map', ()=>{
		const h = mkHost();
		window.localStorage.setItem(KEY, '[1,2]');
		h.togglePanelWide();
		expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ 'wuzhao.panelWide': true });
		window.localStorage.setItem(KEY, '{bad');
		h.state.panelWide = false;
		h.togglePanelWide();
		expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ 'wuzhao.panelWide': true });
	});

	test('新开页面读回展宽态;非布尔 / 坏数据按收起', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ 'wuzhao.panelWide': true }));
		expect(new WuZhaoMain({}).state.panelWide).toBe(true);
		window.localStorage.setItem(KEY, JSON.stringify({ 'wuzhao.panelWide': 'yes' }));
		expect(new WuZhaoMain({}).state.panelWide).toBe(false);
		window.localStorage.setItem(KEY, '{bad');
		expect(new WuZhaoMain({}).state.panelWide).toBe(false);
		window.localStorage.removeItem(KEY);
		expect(new WuZhaoMain({}).state.panelWide).toBe(false);
	});

	test('源码:读写两函数不再外包空 try', ()=>{
		const read = SRC.slice(SRC.indexOf('function readPanelWide(){'), SRC.indexOf('function writePanelWide('));
		const write = SRC.slice(SRC.indexOf('function writePanelWide('), SRC.indexOf('function pickOptions('));
		expect(read).not.toContain('try{');
		expect(write).not.toContain('try{');
		expect(read).toContain('const map = safeJsonParseFromStorage(SIDE_COLLAPSE_STORE_KEY);');
		expect(write).toContain('safeJsonStringifyToStorage(SIDE_COLLAPSE_STORE_KEY, next);');
	});
});
