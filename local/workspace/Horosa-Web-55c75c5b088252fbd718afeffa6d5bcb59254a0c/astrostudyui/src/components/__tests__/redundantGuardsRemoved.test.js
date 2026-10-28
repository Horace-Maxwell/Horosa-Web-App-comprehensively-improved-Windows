// 调用方多包的一层保护已去掉 —— 被调函数自身就不会抛 / 不会缺,保护层只是重复。
// 每组先按真实行为跑一遍(证明去掉保护后行为不变),再锁住源码不回到多余写法。
import fs from 'fs';
import path from 'path';
import ChartList from '../user/ChartList';
import CaseList from '../user/CaseList';
import { markWebLedger, markStaticCacheStats, __resetWebLedgerForTest } from '../../utils/startupLedger';
import { setCurrentTechnique } from '../../utils/perfMark';
import { getDesktopInvokeApi, openExternalUrl } from '../../utils/aiAnalysisDesktop';
import { safeLocalStorageGet, clearRecoverableCaches } from '../../utils/safeStorage';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as LRConst from '../liureng/LRConst';
import { getShenPublic } from '../liureng/LRShenJiangDoc';
import { ZhangSheng } from '../liureng/LRZhangSheng';
import { buildXiangContext } from '../liureng/LRXiangDoc';
import { matchBiFa } from '../liureng/LRBiFaDoc';
import DateTime from '../comp/DateTime';

const SRC = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

function inst(Comp, props){
	const c = new Comp(props);
	c.setState = (u, cb)=>{ c.state = { ...c.state, ...(typeof u === 'function' ? u(c.state) : u) }; if(cb){ cb(); } };
	return c;
}

describe('被调函数本身不抛', ()=>{
	test('启动账本:任意段名 / 无桥环境都不抛', ()=>{
		__resetWebLedgerForTest();
		expect(()=>markWebLedger('web.umi_exec')).not.toThrow();
		expect(()=>markWebLedger(null)).not.toThrow();
		expect(()=>markWebLedger('bad name', 123)).not.toThrow();
		expect(()=>markStaticCacheStats()).not.toThrow();
	});
	test('性能归属 / 桌面句柄 / 存储读取 / 缓存自愈都不抛', ()=>{
		expect(()=>setCurrentTechnique(undefined)).not.toThrow();
		expect(getDesktopInvokeApi()).toBeNull();   // jsdom 无桥
		const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(()=>{ throw new Error('boom'); });
		try{
			expect(safeLocalStorageGet('x')).toBeNull();
		}finally{
			spy.mockRestore();
		}
		expect(()=>clearRecoverableCaches()).not.toThrow();
	});
	test('外链打开:网页端自己回落 window.open,且从不 reject', async ()=>{
		const open = jest.spyOn(window, 'open').mockImplementation(()=>null);
		try{
			await expect(openExternalUrl('https://example.com/a')).resolves.toBe(true);
			expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer');
			open.mockImplementation(()=>{ throw new Error('blocked'); });
			await expect(openExternalUrl('https://example.com/b')).resolves.toBe(false);
			await expect(openExternalUrl('ftp://x')).resolves.toBe(false);
		}finally{
			open.mockRestore();
		}
	});
});

describe('导入的常量 / 方法一定在', ()=>{
	test('外环样式归一、星体字形表、六壬常量表与长生表都已导出', ()=>{
		expect(typeof AstroConst.normalizeChartStyle).toBe('function');
		expect(AstroConst.normalizeChartStyle('nope')).toBe(AstroConst.normalizeChartStyle(undefined));
		expect(AstroText.AstroMsg && typeof AstroText.AstroMsg).toBe('object');
		['ZiHe', 'ZiXing', 'ZiHai'].forEach((k)=>expect(typeof LRConst[k]).toBe('object'));
		expect(typeof getShenPublic).toBe('function');
		expect(ZhangSheng.ganzi['甲_亥']).toBe('长生');
		expect(typeof new DateTime().calcJdn).toBe('function');
		expect(typeof new DateTime().clone().clone).toBe('function');
	});
	test('六壬取象聚合:合中带刑害只落在巳 / 申', ()=>{
		const hit = LRConst.ZiList.filter((z)=>{
			const ctx = buildXiangContext(z, '甲');
			return ctx && (ctx.relationNotes || []).some((n)=>n.type === '蜜中砒霜');
		});
		expect(hit.sort()).toEqual(['巳', '申'].sort());
		expect(buildXiangContext('', '甲')).toBeNull();
	});
	test('毕法匹配:空上下文返回空表,长生判读不因缺字段抛错', ()=>{
		expect(matchBiFa(null)).toEqual([]);
		expect(Array.isArray(matchBiFa({ dayGan: '甲', dayZhiGan: '' }))).toBe(true);
	});
});

describe('命盘 / 事盘列表:dispatch 由 connect 恒注入,直接派发', ()=>{
	const mk = (Comp, extra)=>{ const calls = []; const c = inst(Comp, { dispatch: (a)=>calls.push(a), ...extra }); return { c, calls }; };

	test('命盘列表:翻页 / 每页条数 / 排序 / 新增 / 编辑 / 删除 / 载入 / 检索都会派发', ()=>{
		const { c, calls } = mk(ChartList, { pageSize: 30 });
		c.changePage(2, 30);
		c.changeShowSize(1, 50);
		c.onTableChange({}, {}, { order: 'ascend', field: 'name' });
		c.clickAdd();
		c.clickEdit({ cid: 'a' });
		c.clickDLFeature({ cid: 'a' });
		c.clickRemove({ cid: 'a' });
		c.clickInfo({ cid: 'a' });
		c.searchByName('');
		c.searchByName('张');
		expect(calls.map((a)=>a.type)).toEqual([
			'user/searchCharts', 'user/searchCharts', 'user/searchCharts',
			'astro/openDrawer', 'astro/openDrawer', 'astro/openDrawer',
			'user/deleteChart', 'user/setCurrentChart',
			'user/fetchCharts', 'user/searchCharts',
		]);
		expect(calls[0].payload.PageIndex).toBe(2);
		expect(calls[1].payload.PageSize).toBe(50);
		expect(calls[2].payload).toMatchObject({ PageIndex: 1, PageSize: 30, orderBy: 'name', orderDir: 'asc' });
		expect(calls[9].payload.name).toBe('张');
	});

	test('事盘列表:同一套操作都会派发,载入后关抽屉', ()=>{
		const { c, calls } = mk(CaseList, { casePageSize: 30 });
		c.changePage(3, 30);
		c.changeShowSize(1, 20);
		c.onTableChange({}, {}, { order: 'descend', field: 'event' });
		c.clickAdd();
		c.clickEdit({ cid: 'b' });
		c.clickRemove({ cid: 'b' });
		c.clickInfo({ cid: 'b' });
		c.searchByName('');
		expect(calls.map((a)=>a.type)).toEqual([
			'user/searchCases', 'user/searchCases', 'user/searchCases',
			'astro/openDrawer', 'astro/openDrawer',
			'user/deleteCase', 'user/applyCase', 'astro/closeDrawer',
			'user/fetchCases',
		]);
		expect(calls[2].payload).toMatchObject({ orderBy: 'event', orderDir: 'desc' });
	});
});

describe('源码不再叠多余保护', ()=>{
	test('启动 / 页签切换 / 错误边界 / 存储页 / 启动门的调用直接调用', ()=>{
		expect(read('global.js')).not.toMatch(/try\{ __hwlMark\(/);
		const index = read('pages/index.js');
		expect(index).not.toContain('try{ markStaticCacheStats(); }');
		expect(index).not.toContain('try{ setCurrentTechnique(key); }');
		expect(index).not.toMatch(/try\{ console\.warn\('\[lazy-preload\]/);
		expect(read('components/common/StartupGate.js')).not.toMatch(/try \{ api = getDesktopInvokeApi\(\); \}/);
		expect(read('components/common/StorageHealthModal.js')).not.toContain('try{ text = safeLocalStorageGet(a.key); }');
		const teb = read('components/common/TechniqueErrorBoundary.js');
		expect(teb).not.toContain('try{ clearRecoverableCaches(); }');
		expect(teb).not.toMatch(/try\{ console\.warn/);
	});
	test('console 调用不再包 try', ()=>{
		['components/common/ChartCaptureMount.js', 'components/common/ServiceStatusBanner.js'].forEach((rel)=>{
			expect(`${rel}:${/try ?\{ ?console\./.test(read(rel))}`).toBe(`${rel}:false`);
		});
		expect(read('components/common/ChartCaptureMount.js')).toContain('componentDidCatch(err){ this.props.onError(err); }');
	});
	test('页头外链只交给 openExternalUrl', ()=>{
		const header = read('components/homepage/PageHeader.js');
		const i = header.indexOf('function openHorosaLink(url){');
		const body = header.slice(i, header.indexOf('\n}\n', i)).split('\n').filter((l)=>!/^\s*\/\//.test(l)).join('\n');
		expect(body).toContain('openExternalUrl(url);');
		expect(body).not.toContain('window.open');
		expect(body).not.toContain('Promise.resolve()');
	});
	test('导入的常量 / 方法不再做存在性判断', ()=>{
		const shell = read('components/divination/DivinationChartShell.js');
		expect(shell).not.toContain('AstroConst.normalizeChartStyle ?');
		expect(shell).not.toContain('nextFields.time = { value: nd.clone ? nd.clone() : nd');
		expect(shell).not.toContain('f2.time = { value: nd.clone ? nd.clone() : nd');
		expect(shell).toContain('props.chartStyle : readStoredChartStyle())');
		const xiang = read('components/liureng/LRXiangDoc.js');
		expect(xiang).not.toContain("typeof getShenPublic === 'function'");
		expect(xiang).not.toMatch(/LRConst\.Zi(He|Xing|Hai) \?/);
		const bifa = read('components/liureng/LRBiFaDoc.js');
		expect(bifa).not.toContain('ZhangSheng && ZhangSheng.ganzi');
		expect(read('components/babylon/BabylonHoroscope.js')).not.toContain('AstroText.AstroMsg &&');
		const yzj = read('components/yizhangjing/YiZhangJingMain.js');
		expect(yzj).not.toMatch(/LORE\.(starFull|poems) &&/);
		expect(yzj).not.toMatch(/DATA\.(data|gradeTables) &&/);
		expect(read('components/xuanshi/XuanShiMain.js')).not.toContain("typeof tm.calcJdn === 'function'");
	});
	test('命盘 / 事盘列表与外壳不再判 dispatch 是否存在', ()=>{
		['components/user/ChartList.js', 'components/user/CaseList.js'].forEach((rel)=>{
			const src = read(rel);
			expect(`${rel}:${(src.match(/if\(this\.props\.dispatch\)\{/g) || []).length}`).toBe(`${rel}:0`);
			expect(src).not.toContain('&& this.props.dispatch)');
		});
		const app = read('layouts/app.js');
		expect(app).not.toContain('|| !dispatch');
		expect(app).not.toMatch(/if\(dispatch\)\{/);
	});
});
