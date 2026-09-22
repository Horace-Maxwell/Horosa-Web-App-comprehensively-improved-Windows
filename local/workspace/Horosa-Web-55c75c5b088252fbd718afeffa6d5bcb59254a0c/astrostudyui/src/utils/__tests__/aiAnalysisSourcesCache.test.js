// [P0-S2] listAnalysisSources 指纹缓存 + 引用稳定 + findAnalysisSourceById 单条 O(1) 查找。
//
// 判据总纲:真库(不 mock 内核)seed 命盘 30 + 事盘 20(字符串 snapshot / 对象 snapshot / 空 payload 三型),
// 输出与本文件内联的「旧算法参考实现」深度相等(含顺序/snapshotStatus/module/tags);写后按指纹只重建变化条目;
// 记录集无变化 → 同一数组引用;单条查找返回与列表同一 entry;开关关 → 每次全建(输出仍等参考实现)。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../aiAnalysisStore', ()=>({
	AI_ANALYSIS_STORES: { contextCache: 'contextCache' },
	getStoreRecord: jest.fn(async ()=>null),
	putStoreRecord: jest.fn(async (storeName, record)=>record),
}));

import {
	listAnalysisSources, findAnalysisSourceById, normalizeTags, extractCaseSnapshotText,
	__sourcesCacheStatsForTests, __resetSourcesCacheForTests,
} from '../aiAnalysisSources';
import { listLocalCharts, upsertLocalChart, flagLocalChart, pinLocalChart, touchLocalChart, removeLocalChart } from '../localcharts';
import { listLocalCases, upsertLocalCase, flagLocalCase, touchLocalCase, getCaseTypeMeta } from '../localcases';
import { buildSourceFromArgs } from '../aiTools/tools/castTechnique';

const CHARTS_KEY = 'horosa.localCharts.v1';
const CASES_KEY = 'horosa.localCases.v1';
const FLAG_KEY = 'horosa.perf.sourcesCache';

// 旧算法参考实现(逐字照搬改前 listAnalysisSources,只用模块导出的纯函数)。
function referenceList(){
	const charts = listLocalCharts({}).map((item)=>({
		id: item.cid,
		sourceType: 'chart',
		title: item.name || '未命名命盘',
		module: 'astrochart',
		time: item.birth || item.updateTime || '',
		zone: item.zone || '+08:00',
		tags: normalizeTags(item.group),
		snapshotStatus: 'lazy',
		updatedAt: item.updateTime || '',
		record: item,
	}));
	const cases = listLocalCases({}).map((item)=>{
		const meta = getCaseTypeMeta(item.caseType);
		const extracted = extractCaseSnapshotText(item);
		return {
			id: item.cid,
			sourceType: 'case',
			title: item.event || '未命名事盘',
			module: item.sourceModule || extracted.moduleName || meta.module,
			time: item.divTime || item.updateTime || '',
			zone: item.zone || '+08:00',
			tags: normalizeTags(item.group),
			snapshotStatus: extracted.snapshotStatus,
			updatedAt: item.updateTime || '',
			record: item,
		};
	});
	return charts.concat(cases).sort((a, b)=>{
		const ta = Date.parse(a.updatedAt || a.time || '') || 0;
		const tb = Date.parse(b.updatedAt || b.time || '') || 0;
		return tb - ta;
	});
}

function timeAt(i){
	return `2026-0${1 + (i % 8)}-${String(1 + (i % 27)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`;
}

// 命盘 30(分组形态:JSON 数组串/逗号串/数组/空)+ 事盘 20(三型 payload 轮转;类型含繁简别名;部分不给 sourceModule)。
// 平局只安排在「命盘 vs 事盘」之间(命盘 5 与事盘 2 同时刻),命盘之间时刻互异。
function seed(){
	for(let i = 0; i < 30; i++){
		const group = [['"事业","财运"'], '事业,健康', ['家庭'], undefined][i % 4];
		upsertLocalChart({
			cid: `local-c-${i}`, name: i % 7 === 0 ? '' : `命盘${i}`, birth: `199${i % 10}-0${1 + (i % 9)}-1${i % 10} 0${i % 10}:00:00`,
			zone: i % 5 === 0 ? undefined : '+08:00', lat: '39n54', lon: '116e28', gender: i % 2, group: i % 4 === 0 ? JSON.parse(`[${group[0]}]`) : group,
			payload: i % 3 === 0 ? { k: i } : undefined, updateTime: timeAt(i), preserveUpdateTime: true,
		});
	}
	const types = ['liuyao', '六壬', 'wuzhao', 'horary', 'sanshiunited', '皇极经世'];
	for(let i = 0; i < 20; i++){
		const kind = i % 3;
		let payload;
		if(kind === 0){
			payload = { module: 'wuzhao', version: 1, snapshot: `[五兆]\n外卦 火 / 内卦 水 #${i}` };   // 字符串 snapshot
		}else if(kind === 1){
			payload = { module: 'horary', snapshot: { content: `卜卦快照正文 #${i}`, meta: { i } } };   // 对象 snapshot
		}else{
			payload = i % 6 === 2 ? { module: 'guazhan', gua: [1, 2, 3] } : undefined;   // 无 snapshot 的 payload / 空 payload
		}
		upsertLocalCase({
			cid: `local-case-${i}`, event: i % 9 === 0 ? '' : `事盘${i}`, caseType: types[i % types.length],
			sourceModule: i % 4 === 1 ? undefined : undefined, divTime: `2026-0${1 + (i % 8)}-2${i % 8} 1${i % 10}:00:00`,
			zone: '+08:00', group: i % 2 ? '["占断"]' : undefined, payload, updateTime: i === 2 ? timeAt(5) : timeAt(100 + i), preserveUpdateTime: true,
		});
	}
}

function seedBig(nCharts, nCases){
	const charts = [];
	for(let i = 0; i < nCharts; i++){
		charts.push({ cid: `local-big-${i}`, name: `大库${i}`, birth: '1990-01-01 08:00:00', ad: 1, zone: '+08:00', group: '["大库"]', creator: 'local', updateTime: timeAt(i), payload: JSON.stringify({ k: i }), schemaVersion: 2 });
	}
	window.localStorage.setItem(CHARTS_KEY, JSON.stringify(charts));
	const cases = [];
	for(let i = 0; i < nCases; i++){
		cases.push({ cid: `local-case-big-${i}`, event: `大事盘${i}`, caseType: 'liuyao', divTime: '2026-01-01 10:00:00', zone: '+08:00', creator: 'local', updateTime: timeAt(i + 3), payload: JSON.stringify({ module: 'guazhan', snapshot: `正文${i}` }), sourceModule: 'guazhan', schemaVersion: 2 });
	}
	window.localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

describe('[P0-S2] listAnalysisSources 指纹缓存', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		__resetSourcesCacheForTests();
		seed();
	});

	it('① 真库 seed 30+20 → 输出与旧算法参考实现深度相等(顺序/snapshotStatus/module/tags/record);三型 payload 状态齐', ()=>{
		const out = listAnalysisSources();
		const ref = referenceList();
		expect(out.length).toBe(50);
		expect(out).toEqual(ref);
		expect(out.map((s)=>s.id)).toEqual(ref.map((s)=>s.id));
		const statuses = new Set(out.filter((s)=>s.sourceType === 'case').map((s)=>s.snapshotStatus));
		expect(statuses).toEqual(new Set(['ready', 'generated']));
		expect(out.find((s)=>s.id === 'local-case-0').snapshotStatus).toBe('ready');      // 字符串 snapshot
		expect(out.find((s)=>s.id === 'local-case-1').snapshotStatus).toBe('ready');      // 对象 snapshot
		expect(out.find((s)=>s.id === 'local-case-2').snapshotStatus).toBe('generated');  // 无 snapshot payload
		expect(out.find((s)=>s.id === 'local-case-5').snapshotStatus).toBe('generated');  // 空 payload
		expect(out.find((s)=>s.id === 'local-case-1').module).toBe('liureng');            // 繁简别名归一后的模块
		expect(out.find((s)=>s.id === 'local-c-1').tags).toEqual(['事业', '健康']);
		expect(out.find((s)=>s.id === 'local-c-0').tags).toEqual(['事业', '财运']);
		expect(out.find((s)=>s.id === 'local-c-0').title).toBe('未命名命盘');
		expect(out.find((s)=>s.id === 'local-case-0').title).toBe('未命名事盘');
		// 平局:命盘 5 与事盘 2 同 updatedAt → 命盘在前(输入序稳定),与参考实现同位
		const i5 = out.findIndex((s)=>s.id === 'local-c-5');
		const j2 = out.findIndex((s)=>s.id === 'local-case-2');
		expect(j2).toBe(i5 + 1);
		expect(__sourcesCacheStatsForTests().builds).toBe(50);
	});

	it('② 两次调用无写 → 同一数组引用,builds 不增、hits=50', ()=>{
		const a = listAnalysisSources();
		const b = listAnalysisSources();
		expect(b).toBe(a);
		const st = __sourcesCacheStatsForTests();
		expect(st.builds).toBe(50);
		expect(st.hits).toBe(50);
	});

	it('③ upsert 新增 1 条 → 新数组,但旧 id 的 entry 对象 ===,builds 恰 +1,输出仍等参考实现', ()=>{
		const b = listAnalysisSources();
		const before = __sourcesCacheStatsForTests().builds;
		upsertLocalChart({ cid: 'local-c-new', name: '新命盘', birth: '2000-01-01 08:00:00', zone: '+08:00' });
		const c = listAnalysisSources();
		expect(c).not.toBe(b);
		expect(c.length).toBe(51);
		expect(__sourcesCacheStatsForTests().builds - before).toBe(1);
		b.forEach((e)=>expect(c.find((x)=>x.id === e.id)).toBe(e));
		expect(c[0].id).toBe('local-c-new');   // 最新 updateTime 排最前
		expect(c).toEqual(referenceList());
	});

	it('④ touch/pin/star 类写(指纹不变)→ 仍同一数组引用;entry.record 跟到内核最新对象', ()=>{
		const c = listAnalysisSources();
		touchLocalChart('local-c-3');
		expect(listAnalysisSources()).toBe(c);
		pinLocalChart('local-c-8', 1);
		expect(listAnalysisSources()).toBe(c);
		flagLocalChart('local-c-11', 'starred', true);
		expect(listAnalysisSources()).toBe(c);
		flagLocalCase('local-case-4', 'starred', true);
		touchLocalCase('local-case-7');
		expect(listAnalysisSources()).toBe(c);
		expect(__sourcesCacheStatsForTests().builds).toBe(50);
		const e3 = c.find((s)=>s.id === 'local-c-3');
		expect(e3.record).toBe(listLocalCharts({}).find((r)=>r.cid === 'local-c-3'));
		expect(e3.record.openCount).toBe(1);
		expect(c.find((s)=>s.id === 'local-c-8').record.pinTier).toBe(1);
		expect(c.find((s)=>s.id === 'local-case-4').record.starred).toBe(true);
		expect(c).toEqual(referenceList());
	});

	it('⑤ 归档 → 条目消失(其余 entry 同一);编辑(updateTime 变)→ 仅该条目重建;删除同理', ()=>{
		const c = listAnalysisSources();
		flagLocalChart('local-c-6', 'archived', true);
		const d = listAnalysisSources();
		expect(d).not.toBe(c);
		expect(d.length).toBe(49);
		expect(d.find((s)=>s.id === 'local-c-6')).toBeUndefined();
		d.forEach((e)=>expect(c.find((x)=>x.id === e.id)).toBe(e));
		expect(__sourcesCacheStatsForTests().builds).toBe(50);
		expect(d).toEqual(referenceList());
		// 取消归档 → 该条目重建(缓存已换代掉出),其余同一
		flagLocalChart('local-c-6', 'archived', false);
		const d2 = listAnalysisSources();
		expect(d2.length).toBe(50);
		expect(d2.find((s)=>s.id === 'local-c-6')).not.toBe(c.find((s)=>s.id === 'local-c-6'));
		expect(__sourcesCacheStatsForTests().builds).toBe(51);
		// 编辑:updateTime 刷新 → 该条目新对象,其余 ===
		const before = __sourcesCacheStatsForTests().builds;
		upsertLocalChart({ cid: 'local-c-9', name: '命盘9改' });
		const e = listAnalysisSources();
		expect(__sourcesCacheStatsForTests().builds - before).toBe(1);
		expect(e.find((s)=>s.id === 'local-c-9')).not.toBe(d2.find((s)=>s.id === 'local-c-9'));
		expect(e.find((s)=>s.id === 'local-c-9').title).toBe('命盘9改');
		e.filter((s)=>s.id !== 'local-c-9').forEach((s)=>expect(d2.find((x)=>x.id === s.id)).toBe(s));
		expect(e).toEqual(referenceList());
		// 事盘编辑(payload 变、updateTime 变)→ snapshotStatus 跟着变,只重建该条
		upsertLocalCase({ cid: 'local-case-5', payload: { module: 'guazhan', snapshot: '补上的快照' } });
		const f = listAnalysisSources();
		expect(f.find((s)=>s.id === 'local-case-5').snapshotStatus).toBe('ready');
		expect(__sourcesCacheStatsForTests().builds - before).toBe(2);
		expect(f).toEqual(referenceList());
		removeLocalChart('local-c-2');
		const g = listAnalysisSources();
		expect(g.length).toBe(49);
		expect(g).toEqual(referenceList());
	});

	it('⑥ findAnalysisSourceById:与列表同一对象(命盘/事盘;先查后列或先列后查皆同);归档/不存在/空 → null', ()=>{
		// 先查后列
		const f3 = findAnalysisSourceById('local-c-3');
		const fc4 = findAnalysisSourceById('local-case-4');
		expect(f3.sourceType).toBe('chart');
		expect(fc4.sourceType).toBe('case');
		const list = listAnalysisSources();
		expect(list.find((s)=>s.id === 'local-c-3')).toBe(f3);
		expect(list.find((s)=>s.id === 'local-case-4')).toBe(fc4);
		// 先列后查
		expect(findAnalysisSourceById('local-c-12')).toBe(list.find((s)=>s.id === 'local-c-12'));
		expect(findAnalysisSourceById('local-case-10')).toBe(list.find((s)=>s.id === 'local-case-10'));
		expect(findAnalysisSourceById('local-case-10')).toEqual(referenceList().find((s)=>s.id === 'local-case-10'));
		// 归档/不存在/空
		flagLocalChart('local-c-12', 'archived', true);
		flagLocalCase('local-case-10', 'archived', true);
		expect(findAnalysisSourceById('local-c-12')).toBeNull();
		expect(findAnalysisSourceById('local-case-10')).toBeNull();
		expect(listAnalysisSources().find((s)=>s.id === 'local-c-12')).toBeUndefined();
		expect(findAnalysisSourceById('local-none')).toBeNull();
		expect(findAnalysisSourceById('')).toBeNull();
		expect(findAnalysisSourceById(null)).toBeNull();
		expect(findAnalysisSourceById(undefined)).toBeNull();
		// 记录被外部直改(缓存键失效)后仍能查到新态
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify([{ cid: 'ext-1', name: '外改', updateTime: '2026-08-02 10:00:00' }]));
		expect(findAnalysisSourceById('ext-1').title).toBe('外改');
		expect(findAnalysisSourceById('local-c-3')).toBeNull();
	});

	it('⑦ 预算:1200 记录 1000 次 findAnalysisSourceById ≤ 50ms(热身一次冷读后计时)', ()=>{
		window.localStorage.clear();
		__resetSourcesCacheForTests();
		seedBig(600, 600);
		expect(findAnalysisSourceById('local-big-0').id).toBe('local-big-0');
		expect(findAnalysisSourceById('local-case-big-0').id).toBe('local-case-big-0');
		const t0 = Date.now();
		let ok = 0;
		for(let i = 0; i < 1000; i++){
			const cid = i % 2 ? `local-big-${(i * 131) % 600}` : `local-case-big-${(i * 131) % 600}`;
			const hit = findAnalysisSourceById(cid);
			if(hit && hit.id === cid){
				ok += 1;
			}
		}
		const dt = Date.now() - t0;
		expect(ok).toBe(1000);
		expect(dt).toBeLessThanOrEqual(50);
		// 与整表结果同一对象
		const list = listAnalysisSources();
		expect(list.length).toBe(1200);
		expect(list.find((s)=>s.id === 'local-big-7')).toBe(findAnalysisSourceById('local-big-7'));
	});

	it('⑧ force → builds 等于总数,数组与 entry 皆新;之后无写再调 → 又稳定', ()=>{
		const a = listAnalysisSources();
		const b0 = __sourcesCacheStatsForTests().builds;
		const forced = listAnalysisSources({ force: true });
		expect(__sourcesCacheStatsForTests().builds - b0).toBe(50);
		expect(forced).not.toBe(a);
		forced.forEach((e, i)=>expect(e).not.toBe(a[i]));
		expect(forced).toEqual(referenceList());
		expect(listAnalysisSources()).toBe(forced);
	});

	it('⑨ castTechnique 记录源:归档 cid → E_RECORD_NOT_FOUND;在库 → source 即列表同一 entry', async ()=>{
		flagLocalChart('local-c-4', 'archived', true);
		const miss = await buildSourceFromArgs({ kind: 'record', cid: 'local-c-4' });
		expect(miss.error.code).toBe('E_RECORD_NOT_FOUND');
		const none = await buildSourceFromArgs({ kind: 'record', cid: 'local-none' });
		expect(none.error.code).toBe('E_RECORD_NOT_FOUND');
		const hit = await buildSourceFromArgs({ kind: 'record', cid: 'local-c-5' });
		expect(hit.error).toBeUndefined();
		expect(hit.source.id).toBe('local-c-5');
		expect(hit.source).toBe(listAnalysisSources().find((s)=>s.id === 'local-c-5'));
		const kase = await buildSourceFromArgs({ kind: 'record', cid: 'local-case-1' });
		expect(kase.source.sourceType).toBe('case');
		expect(kase.source.snapshotStatus).toBe('ready');
	});

	it('⑩ 开关 \'0\':每次全建新数组/新 entry(旧行为),输出仍等参考实现;单条查找仍正确但不共享对象', ()=>{
		window.localStorage.setItem(FLAG_KEY, '0');
		const a = listAnalysisSources();
		const b = listAnalysisSources();
		expect(b).not.toBe(a);
		a.forEach((e, i)=>expect(b[i]).not.toBe(e));
		expect(a).toEqual(referenceList());
		expect(b).toEqual(a);
		expect(__sourcesCacheStatsForTests().builds).toBe(100);
		expect(__sourcesCacheStatsForTests().hits).toBe(0);
		const f = findAnalysisSourceById('local-c-3');
		expect(f).toEqual(b.find((s)=>s.id === 'local-c-3'));
		expect(f).not.toBe(b.find((s)=>s.id === 'local-c-3'));
		flagLocalChart('local-c-3', 'archived', true);
		expect(findAnalysisSourceById('local-c-3')).toBeNull();
	});
});
