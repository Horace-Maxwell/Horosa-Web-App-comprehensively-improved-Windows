// [奇门择日 四本账真值] 不查「登记了没」,查「值是什么」:
// ① 真盘拼合快照的段头序列 == AI_EXPORT_PRESET_SECTIONS.qimenzeri 逐字逐序恒等(builder↔preset 活体对拍);
// ② 导出有效段三态语义(未自定义=preset−默认关段 / 显式自定义=完全尊重 / 显式全清=[]);
// ③ 事盘储存全生命周期:upsert→list→payload.zeri 逐字回环→别名归一(奇门择日≠奇门)→meta 路由→
//    同 cid 更新保负载→备份含档→remove;
// ④ 择日附加段 builder 边界(未找局/零命中/超 60 行截断/截断注/嵌套树 且或前缀)。
import { computeQimenScanPan, buildQimenScanSeeds } from '../qimenScanEngine';
import { buildDunJiaSnapshotText } from '../../../components/dunjia/DunJiaCalc';
import { buildQimenZeriSnapshotExtra } from '../qimenZeriSnapshot';
import { newQimenLeaf, newQimenGroup } from '../qimenConditionTypes';
import {
	AI_EXPORT_PRESET_SECTIONS,
	getAIExportEffectiveSectionsForTechnique,
} from '../../../utils/aiExport';
import {
	upsertLocalCase, listLocalCases, removeLocalCase,
	getCaseTypeMeta, getCaseTypeLabel, exportLocalCasesBackup,
} from '../../../utils/localcases';

const ZONE = '+08:00';
const GEO = { zone: ZONE, lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
const OPTS = {
	paiPanType: 3, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1,
	kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false,
	timeAlg: 1, school: '转盘', after23NewDay: 0, lateZiHourUseNextDay: 1,
};
const CFG = { startDate: '2026-05-15', startTime: '00:00', endDate: '2026-05-15', endTime: '23:59' };
const ROW = { start: '2026-05-15 00:00', end: '2026-05-15 01:00', juText: '阳遁七局下元' };

function sampleTree(){
	const a = newQimenLeaf('pattern_ji');
	a.params = { ...a.params, names: ['青龙回首'], palaces: [] };
	const b = newQimenLeaf('door');
	b.params = { ...b.params, values: ['开'], palaces: [8] };
	b.joiner = 'any';
	return { ...newQimenGroup('all'), children: [a, b] };
}
function composedSnapshot(){
	const seeds = buildQimenScanSeeds(2026, 2026, ZONE);
	const pan = computeQimenScanPan(GEO, OPTS, seeds, '2026-05-15', '00:12:00');
	const base = buildDunJiaSnapshotText(pan);
	const extra = buildQimenZeriSnapshotExtra({
		cfg: CFG, geo: { pos: '测试点', zone: ZONE, gpsLon: 120, gpsLat: 30 },
		options: OPTS, tree: sampleTree(), results: [ROW], truncated: false,
	});
	return `${base}\n\n${extra}`;
}
function headersOf(text){
	return text.split('\n').filter((l)=>/^\[[^\]]+\]$/.test(l)).map((l)=>l.slice(1, -1));
}

beforeEach(()=>{
	window.localStorage.clear();
});

describe('① 快照段头 活体对拍', ()=>{
	// 条件段:金函系日家专段仅 paiPanType=6 产;择日恒为时家盘 → 该段永不出现。
	// 判据由「逐字全等」精化为「顺序子集恒等 + 无条件段全覆盖」——两者都比原断言更强:
	// ① 快照段头必须逐字逐序等于 preset 去掉条件段后的序列(错序/漏段/多段皆红);
	// ② 择日三段必在尾部(拼合契约)。
	const CONDITIONAL_SECTIONS = ['日家占方（古籍金函系）'];
	test('真盘拼合快照段头序列 == preset.qimenzeri 去条件段后逐字逐序恒等', ()=>{
		const headers = headersOf(composedSnapshot());
		const expected = AI_EXPORT_PRESET_SECTIONS.qimenzeri.filter((s)=>CONDITIONAL_SECTIONS.indexOf(s) < 0);
		expect(headers).toEqual(expected);
		expect(headers.slice(-3)).toEqual(['择日搜索配置', '择日条件', '命中时辰']);
		// 条件段确实登记在 preset(登记在、但本形态不产)——防「因为不产就把登记删了」的反向漂移
		CONDITIONAL_SECTIONS.forEach((s)=>{
			expect(AI_EXPORT_PRESET_SECTIONS.qimenzeri).toContain(s);
			expect(headers).not.toContain(s);
		});
	});
	test('择日三段内容真值:配置行/条件树含且或前缀/命中行含局名', ()=>{
		const text = composedSnapshot();
		expect(text).toContain('时间段：2026-05-15 00:00 → 2026-05-15 23:59');
		expect(text).toContain('地点：测试点');
		expect(text).toContain('时家奇门');
		expect(text).toContain('或 ');
		expect(text).toContain('1. 2026-05-15 00:00 ~ 2026-05-15 01:00　阳遁七局下元');
	});
});

describe('② 导出有效段三态', ()=>{
	test('未自定义 = preset 剔除默认关段(八宫克应)', ()=>{
		const eff = getAIExportEffectiveSectionsForTechnique('qimenzeri');
		expect(eff).toEqual(AI_EXPORT_PRESET_SECTIONS.qimenzeri.filter((s)=>s !== '八宫克应'));
		expect(eff).toContain('择日搜索配置');
		expect(eff).toContain('命中时辰');
	});
	test('显式自定义完全尊重(含勾默认关段);显式全清=[]', ()=>{
		expect(getAIExportEffectiveSectionsForTechnique('qimenzeri', { sections: { qimenzeri: ['命中时辰', '八宫克应'] } }))
			.toEqual(['命中时辰', '八宫克应']);
		expect(getAIExportEffectiveSectionsForTechnique('qimenzeri', { sections: { qimenzeri: [] } })).toEqual([]);
	});
});

describe('③ 事盘储存全生命周期', ()=>{
	test('upsert→list→payload 逐字回环→更新保负载→备份含档→remove', ()=>{
		const snapshot = composedSnapshot();
		const zeri = { version: 1, cfg: CFG, geo: { pos: '测试点', zone: ZONE }, options: OPTS, tree: sampleTree(), results: [ROW], truncated: false };
		const rec = upsertLocalCase({
			event: '奇门择日 2026-05-15 00:12:00',
			caseType: 'qimenzeri',
			divTime: '2026-05-15 00:12:00',
			zone: ZONE, lat: '30n00', lon: '120e00', gpsLat: 30, gpsLon: 120, pos: '测试点',
			payload: { module: 'qimenzeri', snapshot, options: { ...OPTS, chartCategory: 'shi' }, faRelatedPeople: [], zeri },
			sourceModule: 'qimenzeri',
		});
		expect(rec.caseType).toBe('qimenzeri');
		expect(rec.sourceModule).toBe('qimenzeri');
		const listed = listLocalCases().find((c)=>c.cid === rec.cid);
		expect(listed).toBeTruthy();
		const payload = typeof listed.payload === 'string' ? JSON.parse(listed.payload) : listed.payload;
		expect(payload.module).toBe('qimenzeri');
		expect(payload.snapshot).toBe(snapshot);
		expect(payload.zeri.cfg).toEqual(CFG);
		expect(payload.zeri.tree.children.length).toBe(2);
		expect(payload.zeri.tree.children[1].joiner).toBe('any');
		expect(payload.zeri.results).toEqual([ROW]);
		// 同 cid 更新只改动传入字段,负载保留
		const updated = upsertLocalCase({ cid: rec.cid, event: '改名后' });
		expect(updated.event).toBe('改名后');
		const relisted = listLocalCases().find((c)=>c.cid === rec.cid);
		const payload2 = typeof relisted.payload === 'string' ? JSON.parse(relisted.payload) : relisted.payload;
		expect(payload2.zeri.results).toEqual([ROW]);
		expect(listLocalCases().filter((c)=>c.cid === rec.cid).length).toBe(1);
		// 备份含档(接口返回对象,按 JSON 断言)
		expect(JSON.stringify(exportLocalCasesBackup())).toContain('qimenzeri');
		removeLocalCase(rec.cid);
		expect(listLocalCases().find((c)=>c.cid === rec.cid)).toBeFalsy();
	});
	test('别名归一:奇门择日→qimenzeri 与 奇门→qimen 绝不互串;meta 路由三键正确', ()=>{
		const a = upsertLocalCase({ caseType: '奇门择日', divTime: '2026-05-15 01:00:00', payload: { module: 'qimenzeri' } });
		const b = upsertLocalCase({ caseType: '奇门', divTime: '2026-05-15 02:00:00', payload: { module: 'qimen' } });
		expect(a.caseType).toBe('qimenzeri');
		expect(b.caseType).toBe('qimen');
		const meta = getCaseTypeMeta('qimenzeri');
		expect(meta.tab).toBe('zeri');
		expect(meta.subTab).toBe('qimenzeri');
		expect(meta.module).toBe('qimenzeri');
		expect(getCaseTypeLabel('qimenzeri')).toBe('奇门择日');
		expect(getCaseTypeLabel('奇门择日')).toBe('奇门择日');
		removeLocalCase(a.cid);
		removeLocalCase(b.cid);
	});
});

describe('④ 择日附加段 builder 边界', ()=>{
	const baseCtx = ()=>({ cfg: CFG, geo: { pos: 'x', zone: ZONE }, options: OPTS, tree: sampleTree() });
	test('未找局/零命中/截断注三态文案', ()=>{
		expect(buildQimenZeriSnapshotExtra({ ...baseCtx(), results: null, truncated: false })).toContain('尚未找局');
		expect(buildQimenZeriSnapshotExtra({ ...baseCtx(), results: [], truncated: false })).toContain('无满足条件的时辰');
		expect(buildQimenZeriSnapshotExtra({ ...baseCtx(), results: [ROW], truncated: true })).toContain('已达命中上限截断');
	});
	test('超 60 行截断为「其余 N 条略」', ()=>{
		const many = Array.from({ length: 75 }, (_, i)=>({ ...ROW, start: `2026-05-15 ${String(i % 24).padStart(2, '0')}:00` }));
		const text = buildQimenZeriSnapshotExtra({ ...baseCtx(), results: many, truncated: false });
		expect(text).toContain('(其余 15 条略)');
		expect(text.split('\n').filter((l)=>/^\d+\. /.test(l)).length).toBe(60);
	});
	test('嵌套分组树文本带分组行与门前缀,空树显式占位', ()=>{
		const inner = { ...newQimenGroup('any'), children: [
			(()=>{ const l = newQimenLeaf('tian_gan'); l.params = { ...l.params, values: ['乙'] }; return l; })(),
			(()=>{ const l = newQimenLeaf('di_gan'); l.params = { ...l.params, values: ['丙'] }; l.joiner = 'xor'; return l; })(),
		], joiner: 'any' };
		const tree = { ...newQimenGroup('all'), children: [sampleTree().children[0], inner] };
		const text = buildQimenZeriSnapshotExtra({ ...baseCtx(), tree, results: [] });
		expect(text).toContain('分组(2 条):');
		expect(text).toContain('异或 ');
		const empty = buildQimenZeriSnapshotExtra({ ...baseCtx(), tree: { ...newQimenGroup('all'), children: [] }, results: [] });
		expect(empty).toContain('(未设条件)');
	});
});
