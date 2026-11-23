// 九家择日工作台经共用壳 ZeriWorkbenchShell 的真渲染行为(不锚排版,锚行为):
// ① 每家都经共用壳渲染,标题 = 「<家>择日·<动作>工作台」;
// ② 存方案带什么:日粒度(黄历)只存时间范围;时刻粒度存地点 + 参数(宿主给了扫描口径就存扫描口径);带本命区的家连本命一起存;
// ③ 载入方案回灌什么:树 / 时间范围 / 地点 / 参数(经单源打底)/ 本命(只回灌带本命区的家);
// ④ 结果表措辞与徽标列随家(黄历按天、日卡;其余按时长、盘)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import * as stores from '../../../divination/zeri/schemeStore';
import { withFullDefaults } from '../zeriOptionDefaults';
import { normalizeSavedNatal, restoredNatalInput } from '../zeriNatal';

global.React = React;

const CASES = [
	{ file: 'BaziZeriWorkbench', store: 'baziZeriSchemeStore', title: '八字择日·择时工作台', natal: true, badgeHeader: '四柱' },
	{ file: 'LiurengZeriWorkbench', store: 'liurengZeriSchemeStore', title: '六壬择日·择时工作台', natal: true, badgeHeader: '课·三传' },
	{ file: 'ZiweiZeriWorkbench', store: 'ziweiZeriSchemeStore', title: '紫微择日·择时工作台', natal: true, badgeHeader: '命宫·局' },
	{ file: 'SanshiZeriWorkbench', store: 'sanshiZeriSchemeStore', title: '三式择日·择时工作台', natal: true, badgeHeader: '三家(课·局·局)' },
	{ file: 'TaiyiZeriWorkbench', store: 'taiyiZeriSchemeStore', title: '太乙择日·择时工作台', natal: false, badgeHeader: '局·太乙' },
	{ file: 'QizhengZeriWorkbench', store: 'qizhengZeriSchemeStore', title: '七政择日·择时工作台', natal: false, badgeHeader: null },
	{ file: 'IndiaZeriWorkbench', store: 'indiaZeriSchemeStore', title: '印度择日·择时工作台', natal: false, badgeHeader: null },
	{ file: 'QimenZeriWorkbench', store: 'qimenZeriSchemeStore', title: '奇门择日·找局工作台', natal: false, badgeHeader: '局' },
	{ file: 'HuangliZeriWorkbench', store: 'huangliZeriSchemeStore', title: '黄历择日·择吉工作台', natal: false, badgeHeader: '日课(起日)', dayGrain: true },
];

let host = null;
beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); jest.restoreAllMocks(); });

const tree0 = { kind: 'group', op: 'all', children: [] };
function baseProps(over){
	return {
		open: true, onClose: jest.fn(),
		cfg: { startDate: '2026-01-01', startTime: '00:00', endDate: '2026-01-02', endTime: '23:59' }, onCfgChange: jest.fn(),
		geo: { gpsLat: 30, gpsLon: 120, zone: '+08:00', pos: '杭州' }, onGeoChange: jest.fn(),
		options: { timeAlg: 0 }, onOptionsChange: jest.fn(), optionDefaults: { timeAlg: 0, zz: 9 },
		natal: { label: '本命甲子' }, natalInput: { date: '2000-01-01', time: '12:00', gender: 1 },
		onNatalInputChange: jest.fn(), onResolveNatal: jest.fn(), onClearNatal: jest.fn(), onRestoreNatal: jest.fn(),
		tree: tree0, onTreeChange: jest.fn(), onRun: jest.fn(), onCancelScan: jest.fn(), onPickInterval: jest.fn(), onExplain: jest.fn(),
		scanning: false, progress: null, results: null, truncated: false, scanErr: '',
		...over,
	};
}
const render = (Cmp, props)=>act(()=>{ ReactDOM.render(<Cmp {...props} />, host); });
const btn = (text)=>[...host.querySelectorAll('button')].find((b)=>b.textContent.replace(/\s/g, '') === text);
function typeInto(input, value){
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
	act(()=>{ setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe.each(CASES)('$file', (C)=>{
	const Cmp = ()=>require(`../${C.file}`).default;

	it('经共用壳渲染,标题 = 家名·动作·工作台;首开条件类型是本家注册表里的条件', ()=>{
		const own = fs.readFileSync(path.join(__dirname, '..', `${C.file}.js`), 'utf8');
		expect(own).toMatch(/return <ZeriWorkbenchShell \{\.\.\.props\} school=\{[A-Z_]+_SCHOOL\} \/>;/);
		render(Cmp(), baseProps());
		expect(host.textContent).toContain(C.title);
		expect(host.querySelector('.ant-select-selection-item').textContent).not.toMatch(/^[a-z_0-9]+$/);   // 显示条件名,不是裸键
	});

	it('🔴 存方案带的内容随家(日粒度只存时间范围;带本命区的家连本命)', ()=>{
		const store = stores[C.store];
		const spy = jest.spyOn(store, 'saveScheme').mockReturnValue({ ok: true });
		const scanOpts = { timeAlg: 1, pageKey: 'P' };
		render(Cmp(), baseProps({ getSchemeOptions: ()=>scanOpts }));
		typeInto(host.querySelector('input[placeholder="方案名…"]'), '我的方案');
		act(()=>{ btn('保存方案').click(); });
		expect(spy).toHaveBeenCalledTimes(1);
		const [name, conf, tree] = spy.mock.calls[0];
		expect(name).toBe('我的方案');
		expect(tree).toBe(tree0);
		const keys = Object.keys(conf).sort();
		if(C.dayGrain){ expect(keys).toEqual(['cfg']); return; }
		expect(conf.geo).toEqual(baseProps().geo);
		expect(conf.options).toBe(scanOpts);   // 宿主给了扫描口径就存扫描口径
		expect(keys).toEqual(C.natal ? ['cfg', 'geo', 'natal', 'natalInput', 'options'] : ['cfg', 'geo', 'options']);
	});

	it('🔴 载入方案回灌:树 / 时间范围 / 地点 / 参数经单源打底 / 本命只回灌带本命区的家', ()=>{
		const store = stores[C.store];
		const rec = { id: 's1', name: '旧方案', savedAt: '2026-01-01T00:00:00Z', tree: { kind: 'group', op: 'all', children: [] },
			config: { cfg: { startDate: '2030-05-05' }, geo: { pos: '北京' }, options: { timeAlg: 3 }, natal: { label: '旧本命' }, natalInput: { date: '1990-01-01' } } };
		jest.spyOn(store, 'listSchemes').mockReturnValue([rec]);
		const props = baseProps();
		render(Cmp(), props);
		act(()=>{ btn('方案管理…').click(); });
		act(()=>{ btn('载入').click(); });
		expect(props.onTreeChange).toHaveBeenCalledWith(rec.tree);
		expect(props.onCfgChange).toHaveBeenCalledWith({ ...props.cfg, startDate: '2030-05-05' });
		expect(props.onGeoChange).toHaveBeenCalledWith({ ...props.geo, pos: '北京' });
		expect(props.onOptionsChange).toHaveBeenCalledWith(withFullDefaults(props.optionDefaults, { timeAlg: 3 }), { source: 'scheme' });
		if(C.natal){
			expect(props.onRestoreNatal).toHaveBeenCalledWith(normalizeSavedNatal(rec.config.natal));
			expect(props.onNatalInputChange).toHaveBeenCalledWith(restoredNatalInput(rec.config.natalInput));
		}else{
			expect(props.onRestoreNatal).not.toHaveBeenCalled();
			expect(props.onNatalInputChange).not.toHaveBeenCalled();
		}
	});

	it('结果表措辞与徽标列随家;过期提示带口径注', ()=>{
		const row = { start: '2026-01-01 01:00', end: '2026-01-01 03:00', durationMin: 120, days: 2,
			pillarText: '甲子', keText: '课', chuanText: '传', mingText: '命', juText: '局', taiyiText: '太', sanshiText: '三', badge: '建' };
		const props = baseProps({ scanning: true, progress: { done: 1, total: 2, hits: 0 } });
		render(Cmp(), props);
		render(Cmp(), { ...props, scanning: false, results: [row], resultsStale: true, staleCalibreNote: '口径已变' });
		const text = host.textContent;
		expect(text).toContain(C.dayGrain ? '天数' : '时长');
		expect(text).toContain(C.dayGrain ? '2天' : '2.0小时');
		if(C.badgeHeader){ expect(text).toContain(C.badgeHeader); }
		expect(btn(C.dayGrain ? '卡' : '盘')).toBeTruthy();
		expect(host.querySelector('.horosa-zeri-stale-calibre').textContent).toBe('口径已变');
	});
});

it('共用壳之外不再有第二份工作台实现(九家文件都很薄)', ()=>{
	CASES.forEach((C)=>{
		const own = fs.readFileSync(path.join(__dirname, '..', `${C.file}.js`), 'utf8');
		expect([C.file, /<Modal\b|useState\(/.test(own)]).toEqual([C.file, false]);
		expect([C.file, own.split('\n').length < 120]).toEqual([C.file, true]);
	});
});
