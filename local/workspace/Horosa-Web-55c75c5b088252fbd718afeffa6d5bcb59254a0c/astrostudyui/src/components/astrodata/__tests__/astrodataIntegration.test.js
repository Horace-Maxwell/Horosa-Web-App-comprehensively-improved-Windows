// astrodataIntegration.test.js —— 名人星盘数据库「工具·数据库」页集成哨兵。
// 覆盖两条集成关键路径:
//   ① 「加入命盘」数据路径:iframe 送来的 chart(birth 为字符串)经 buildLocalChartRecord/upsertLocalChart
//      必须落库不抛(修 addChart 假定 birth 为 moment 的隐藏 bug);
//   ② AstrodataPage.onMsg 接线:仅对本页 iframe 的 astrodata:importChart 消息 dispatch(user/addLocalChartQuiet),
//      忽略无关类型与伪造来源。
import AstrodataPage from '../AstrodataPage';
import { buildLocalChartRecord, upsertLocalChart } from '../../../utils/localcharts';
import { openExternalUrl } from '../../../utils/aiAnalysisDesktop';

describe('数据库导入命盘 · 字符串 birth 数据路径', () => {
	// 名人库详情 postMessage 的 chart:birth 是 "YYYY-MM-DD HH:mm:ss" 字符串、group 为数组。
	const adbChart = {
		cid: 'adb-12345', name: 'Albert Einstein', birth: '1879-03-14 11:30:00',
		zone: '+00:39', lat: '48n24', lon: '9e59', gpsLat: 48.4, gpsLon: 9.983,
		pos: 'Ulm, Germany', gender: 1, isPub: 0, doubingSu28: 0,
		group: ['Astrodatabank', 'AA'], creator: 'local',
	};

	test('buildLocalChartRecord 容忍字符串 birth,原样保留、不抛', () => {
		const rec = buildLocalChartRecord(adbChart);
		expect(rec.birth).toBe('1879-03-14 11:30:00');   // 字符串未被当作 moment 调用 .format
		expect(rec.name).toBe('Albert Einstein');
		expect(rec.cid).toBe('adb-12345');
		expect(rec.gender).toBe(1);
		// group 落库为 JSON 字符串(normalizeGroup 约定),读回时解析。
		expect(typeof rec.group).toBe('string');
		expect(rec.group).toContain('Astrodatabank');
		expect(rec.group).toContain('AA');
	});

	test('gender 字符串归一为整数', () => {
		expect(buildLocalChartRecord({ ...adbChart, gender: '0' }).gender).toBe(0);
		expect(buildLocalChartRecord({ ...adbChart, gender: '-1' }).gender).toBe(-1);
	});

	test('upsertLocalChart 端到端落库 + 读回(字符串 birth 全程不抛)', () => {
		try { localStorage.clear(); } catch (e) { /* jsdom localStorage */ }
		const rec = upsertLocalChart(adbChart);
		expect(rec.birth).toBe('1879-03-14 11:30:00');
		expect(rec.cid).toBe('adb-12345');
		// 同 cid 重复导入 = upsert(不重复入库)
		const rec2 = upsertLocalChart({ ...adbChart, name: 'Einstein (dup)' });
		expect(rec2.cid).toBe('adb-12345');
	});
});

describe('AstrodataPage.onMsg 接线', () => {
	function makeInst() {
		const calls = [];
		const inst = new AstrodataPage({ dispatch: (a) => calls.push(a) });
		return { inst, calls };
	}
	const chart = { cid: 'adb-1', name: 'X', birth: '1990-01-01 12:00:00', group: ['Astrodatabank', 'A'] };

	test('合法 astrodata:importChart 消息 → dispatch(user/addLocalChartQuiet)', () => {
		const { inst, calls } = makeInst();
		inst.onMsg({ data: { type: 'astrodata:importChart', chart }, source: null });
		expect(calls.length).toBe(1);
		expect(calls[0].type).toBe('user/addLocalChartQuiet');
		// 经名人建档单源构造:原字段不动,补来源备注(评级没随消息来时取分组里的评级)、新盘缺省设置与代次标记
		const { buildCelebrityChartValues } = require('../../../utils/astrodata/celebrityDedupe');
		expect(calls[0].payload).toEqual(buildCelebrityChartValues(chart, { rodden: 'A' }));
		expect(calls[0].payload).toEqual(expect.objectContaining({ cid: 'adb-1', name: 'X', memo: '来自名人库(Astro-Databank,Rodden A)', fieldsCaptureGen: 1, ziweiSettingsGen: 1 }));
		expect(chart.memo).toBeUndefined();   // 不改调用方的对象
	});

	test('无关类型 / 空数据 → 不 dispatch', () => {
		const { inst, calls } = makeInst();
		inst.onMsg({ data: { type: 'something-else', chart }, source: null });
		inst.onMsg({ data: null, source: null });
		inst.onMsg({ data: { type: 'astrodata:importChart' }, source: null });   // 缺 chart
		expect(calls.length).toBe(0);
	});

	test('伪造来源窗口 → 拒收;本页 iframe 来源 → 接收', () => {
		const { inst, calls } = makeInst();
		const frameWin = {};
		inst.iframeRef = { current: { contentWindow: frameWin } };
		inst.onMsg({ data: { type: 'astrodata:importChart', chart }, source: {} });   // 别的窗口
		expect(calls.length).toBe(0);
		inst.onMsg({ data: { type: 'astrodata:importChart', chart }, source: frameWin }); // 本页 iframe
		expect(calls.length).toBe(1);
	});
});

describe('数据库外链 · 系统浏览器打开(桌面 target=_blank 无反应修复)', () => {
	const realOpen = window.open;
	afterEach(() => { window.open = realOpen; });

	test('openExternalUrl 仅放行 http(s),挡 javascript:/file:/空', async () => {
		const opened = [];
		window.open = (u) => { opened.push(u); return {}; };
		expect(await openExternalUrl('https://www.astro.com/astro-databank')).toBe(true);
		expect(await openExternalUrl('http://en.wikipedia.org/')).toBe(true);
		expect(await openExternalUrl('javascript:alert(1)')).toBe(false);
		expect(await openExternalUrl('file:///etc/passwd')).toBe(false);
		expect(await openExternalUrl('')).toBe(false);
		expect(await openExternalUrl(null)).toBe(false);
		expect(opened).toEqual(['https://www.astro.com/astro-databank', 'http://en.wikipedia.org/']);
	});

	test('onMsg 收 astrodata:openExternal → 走系统浏览器(不误入命盘 dispatch)', async () => {
		const calls = [];
		const inst = new AstrodataPage({ dispatch: (a) => calls.push(a) });
		const opened = [];
		window.open = (u) => { opened.push(u); return {}; };
		inst.onMsg({ data: { type: 'astrodata:openExternal', url: 'https://en.wikipedia.org/wiki/Einstein' }, source: null });
		await new Promise((r) => setTimeout(r, 0));
		expect(calls.length).toBe(0);
		expect(opened).toEqual(['https://en.wikipedia.org/wiki/Einstein']);
	});
});

describe('名人库页导入结果提示(宿主回报 → 页内如实提示)', () => {
	const fs = require('fs');
	const path = require('path');
	const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'public', 'astrodata', 'index.html'), 'utf8');
	test('宿主回报:写入失败 → failed;只进了本次运行的列表 → session;其余按调用方给的成功档', async () => {
		const { importStatusOf } = require('../AstrodataPage');
		expect(importStatusOf(false, 'imported')).toBe('failed');
		expect(importStatusOf('session', 'imported')).toBe('session');
		expect(importStatusOf(true, 'refreshed')).toBe('refreshed');
		expect(importStatusOf(undefined, 'imported')).toBe('imported');
		const posted = [];
		const frameWin = { postMessage: (m)=>posted.push(m) };
		const inst = new AstrodataPage({ dispatch: () => 'session' });
		inst.iframeRef = { current: { contentWindow: frameWin } };
		inst.onMsg({ data: { type: 'astrodata:importChart', chart: { cid: 'adb-session-1', name: 'Y', birth: '1991-01-01 12:00:00', group: ['Astrodatabank', 'A'] } }, source: frameWin });
		await new Promise((r)=>setTimeout(r, 0));
		expect(posted).toEqual([{ type: 'astrodata:importResult', status: 'session', name: 'Y' }]);
	});
	test('页内:「只在本次运行」有专门提示(中英两套);等回报期间再点不重复发送;不再写死宿度制', () => {
		expect((html.match(/impSession:/g) || []).length).toBe(2);
		expect(html).toContain("else if(d.status==='session'){toast(t.impSession);}");
		expect(html).toContain('if(IMP.timer)return;');
		const importFn = html.slice(html.indexOf('function importChart(r){'), html.indexOf('const IMP={timer:null'));
		expect(importFn).not.toContain('doubingSu28');
		expect(importFn).toContain("meta:{rodden:r.rodden||''");
		// 单独打开时复制的 JSON 带名人库标志、不再写死代次标记(由软件导入时按新命盘设置补齐)
		expect(importFn).toContain('chart.importAsNewChart=1;');
		expect(importFn).not.toContain('fieldsCaptureGen');
	});
});

describe('命盘列表导入名人库 JSON(名人库页单独打开时复制出来的)', () => {
	const { prepareCelebrityChartsImport } = require('../../../utils/astrodata/celebrityDedupe');
	const { importLocalChartsBackup, getLocalChart, upsertLocalChart: up } = require('../../../utils/localcharts');
	beforeEach(()=>{ window.localStorage.clear(); });
	test('已有这位只刷新出生时刻与地点,不给旧档补代次标记;新人按新命盘设置补齐并打标记;归档里的跳过;真备份条目原样', () => {
		up({ cid: 'adb-9', name: '我改过的名', birth: '1950-01-01 10:00:00', zone: '+00:00', lat: '1n0', lon: '1e0', group: ['我的组'], memo: '我的备注', hsys: 0 });
		up({ cid: 'adb-8', name: '归档的', birth: '1951-01-01 10:00:00', zone: '+00:00', archived: true });
		const json = { format: 'horosa-local-charts', version: 1, total: 4, charts: [
			{ cid: 'adb-9', celebrityId: 'adb-9', name: 'Orig', birth: '1950-01-01 11:30:00', zone: '+01:00', lat: '2n0', lon: '2e0', gpsLat: 2, gpsLon: 2, pos: 'P', group: ['Astrodatabank', 'A'], memo: '来自名人库', importAsNewChart: 1 },
			{ cid: 'adb-8', celebrityId: 'adb-8', name: 'Arch', birth: '1951-01-01 10:00:00', zone: '+00:00', importAsNewChart: 1 },
			{ cid: 'adb-7', celebrityId: 'adb-7', name: 'New', birth: '1960-01-01 10:00:00', zone: '+00:00', group: ['Astrodatabank', 'AA', ''], memo: '来自名人库', importAsNewChart: 1 },
			{ cid: 'local-x', name: 'Backup', birth: '1970-01-01 10:00:00', zone: '+00:00' },
		] };
		const { payload, skipped } = prepareCelebrityChartsImport(json);
		expect(skipped).toBe(1);
		expect(payload.charts.map((c)=>c.cid)).toEqual(['adb-9', 'adb-7', 'local-x']);
		expect(payload.charts[0]).toEqual({ cid: 'adb-9', celebrityId: 'adb-9', updateTime: expect.any(String), birth: '1950-01-01 11:30:00', zone: '+01:00', lat: '2n0', lon: '2e0', gpsLat: 2, gpsLon: 2, pos: 'P' });
		expect(payload.charts[1].group).toEqual(['Astrodatabank', 'AA']);
		expect(payload.charts[1]).toMatchObject({ fieldsCaptureGen: 1, ziweiSettingsGen: 1 });
		expect(payload.charts[1].importAsNewChart).toBeUndefined();
		expect(payload.charts[2]).toBe(json.charts[3]);
		// 与命盘列表同一口径:名人库 JSON 按字段合并(刷新出生数据,保留你改过的名字与备注),不按「较新者整条胜出」
		importLocalChartsBackup(payload, { sameCid: 'merge' });
		const kept = getLocalChart('adb-9');
		expect(kept).toMatchObject({ name: '我改过的名', memo: '我的备注', hsys: 0, birth: '1950-01-01 11:30:00', pos: 'P' });
		expect(kept.fieldsCaptureGen).toBeUndefined();
		expect(kept.ziweiSettingsGen).toBeUndefined();
		expect(getLocalChart('adb-7')).toMatchObject({ name: 'New', fieldsCaptureGen: 1 });
		// 命盘列表导入名人库 JSON 时确实按字段合并
		const chartListSrc = require('fs').readFileSync(require('path').join(__dirname, '../../user/ChartList.js'), 'utf8');
		expect(chartListSrc).toContain("const importOpts = toImport !== json ? { sameCid: 'merge' } : undefined;");
		// 没有名人库标志的普通备份:原样
		const plain = { format: 'horosa-local-charts', version: 1, charts: [{ cid: 'a' }] };
		expect(prepareCelebrityChartsImport(plain)).toEqual({ payload: plain, skipped: 0 });
	});
});
