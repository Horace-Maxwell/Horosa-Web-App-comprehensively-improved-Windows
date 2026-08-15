// 🔴 [V3 制度化] 记录字段保真总闸 —— 「记录上有的一切,导出/导入/管理全链一个不落」的永久锁。
//
// 由来(用户明令):凡记录携带的字段(含内容/设置/自定义/内核管理字段/未来新字段),在
// 新建/编辑/导出/导入/另存副本/回收站恢复 全链必须零丢失。历史漏斗=导入新增路径经
// buildRecord 白名单重建,「新增字段忘枚举→导入即丢」屡犯(pin 族曾靠显式透传才活)。
// 根治=内核 upsert 未知键一律保全(buildRecord 是归一器不是过滤器)。
//
// 判据设计(属性级,不逐字段写死):往返记录同时携带**全部已知代表键 + 人造未来未知键**
// (future_scalar/future_obj)——未知键保真通过 ⇒ 未来任何新增字段自动被本闸覆盖。
// 域层「归一键」白名单显式列出(birth/divTime 串化、group/payload 串化、caseType 别名、
// gender/isPub int 化、schemaVersion 盖章、updateTime 语义):新增归一行为必须在此登记,
// 其余键一律要求逐字节相等。
import {
	upsertLocalChart, listLocalCharts, exportLocalChartsBackup, importLocalChartsBackup,
	removeLocalChart, listLocalChartsTrash, restoreLocalChartFromTrash,
} from '../localcharts';
import {
	upsertLocalCase, listLocalCases, exportLocalCasesBackup, importLocalCasesBackup,
} from '../localcases';

// 域层归一键(值形态允许被归一;仍必须「在」):键 → 归一后判据
const CHART_NORMALIZED = {
	birth: (v)=>typeof v === 'string',
	group: (v)=>typeof v === 'string' || v === null,
	payload: (v)=>typeof v === 'string' || v === null,
	gender: (v)=>typeof v === 'number',
	isPub: (v)=>typeof v === 'number',
	schemaVersion: (v)=>typeof v === 'number',
	updateTime: (v)=>typeof v === 'string',
	ad: (v)=>typeof v === 'number',
};

const FULL_CHART = {
	cid: 'local-fid-1', name: '保真甲', birth: '1990-02-01 12:30:00', ad: 1, zone: '+08:00',
	lat: '31n12', lon: '121e30', gpsLat: 31.2, gpsLon: 121.5, pos: '上海', gender: 0, isPub: 0,
	group: ['保真', '甲组'], creator: 'local', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true,
	memo: '通用备注保真', memoAstro: 'astro批注', payload: { k: 1 },
	hsys: 3, zodiacal: 1, termsVariant: 2, orbScale: 1.5, after23NewDay: 1, timeAlg: 1,
	pinTier: 1, pinAt: '2026-08-02 09:00:00', orderKey: -123456,
	future_scalar: 'v99-新字段',                       // 人造未来标量键
	future_obj: { nested: [1, 2], flag: true },       // 人造未来结构键
};

function assertChartFidelity(rec, label){
	Object.keys(FULL_CHART).forEach((k)=>{
		if(k === 'preserveUpdateTime'){
			return;
		}
		expect(`${label}:${k}:${rec[k] === undefined ? 'MISSING' : 'ok'}`).toBe(`${label}:${k}:ok`);
		if(CHART_NORMALIZED[k]){
			expect(CHART_NORMALIZED[k](rec[k])).toBe(true);
		}else{
			expect(rec[k]).toEqual(FULL_CHART[k]);
		}
	});
}

describe('[V3] 记录字段保真总闸(含未来未知键)', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 新建落库:全部键(含未知键)零丢失', ()=>{
		upsertLocalChart({ ...FULL_CHART });
		assertChartFidelity(listLocalCharts()[0], '落库');
	});

	it('🔴 导出→清库→导入:全链零丢失(导入新增路径=历史漏斗本斗)', ()=>{
		upsertLocalChart({ ...FULL_CHART });
		const backup = exportLocalChartsBackup();
		window.localStorage.clear();
		importLocalChartsBackup(backup);
		assertChartFidelity(listLocalCharts()[0], '导入');
	});

	it('另存副本(spread+新 cid):除 cid 外零丢失', ()=>{
		upsertLocalChart({ ...FULL_CHART });
		const dup = { ...listLocalCharts()[0] };
		delete dup.cid;
		delete dup.schemaVersion;
		dup.name = '保真甲(副本)';
		upsertLocalChart(dup);
		const rec = listLocalCharts().find((r)=>r.name === '保真甲(副本)');
		expect(rec.future_scalar).toBe(FULL_CHART.future_scalar);
		expect(rec.future_obj).toEqual(FULL_CHART.future_obj);
		expect(rec.memo).toBe(FULL_CHART.memo);
		expect(rec.pinTier).toBe(1);
		expect(rec.hsys).toBe(3);
	});

	it('回收站 删除→恢复:零丢失', ()=>{
		upsertLocalChart({ ...FULL_CHART });
		removeLocalChart('local-fid-1');
		expect(listLocalChartsTrash().length).toBe(1);
		restoreLocalChartFromTrash('local-fid-1');
		const rec = listLocalCharts().find((r)=>r.cid === 'local-fid-1');
		expect(rec.future_scalar).toBe(FULL_CHART.future_scalar);
		expect(rec.future_obj).toEqual(FULL_CHART.future_obj);
		expect(rec.memo).toBe(FULL_CHART.memo);
		expect(rec.pinTier).toBe(1);
		expect(rec.orderKey).toBe(FULL_CHART.orderKey);
	});

	it('编辑(部分键 upsert):未提供键(含未知键)全保留', ()=>{
		upsertLocalChart({ ...FULL_CHART });
		upsertLocalChart({ cid: 'local-fid-1', name: '保真甲改' });
		const rec = listLocalCharts().find((r)=>r.cid === 'local-fid-1');
		expect(rec.name).toBe('保真甲改');
		expect(rec.future_scalar).toBe(FULL_CHART.future_scalar);
		expect(rec.memo).toBe(FULL_CHART.memo);
		expect(rec.hsys).toBe(3);
		expect(rec.pinTier).toBe(1);
	});

	it('preserveUpdateTime 是控制标志,绝不入库', ()=>{
		upsertLocalChart({ ...FULL_CHART });
		expect('preserveUpdateTime' in listLocalCharts()[0]).toBe(false);
	});

	it('事盘同语义:未知键+memo+gender+pin 经 导出→导入 零丢失', ()=>{
		upsertLocalCase({
			cid: 'local-case-fid-1', event: '保真课', caseType: 'liuyao', divTime: '2026-08-13 10:00:00',
			zone: '+08:00', gender: 0, memo: '事盘备注', updateTime: '2026-08-01 09:00:00', preserveUpdateTime: true,
			payload: { module: 'guazhan', gua: [1, 2] }, pinTier: -1, pinAt: '2026-08-02 08:00:00',
			future_case_key: { deep: 'kept' },
		});
		const backup = exportLocalCasesBackup();
		window.localStorage.clear();
		importLocalCasesBackup(backup);
		const rec = listLocalCases()[0];
		expect(rec.future_case_key).toEqual({ deep: 'kept' });
		expect(rec.memo).toBe('事盘备注');
		expect(rec.gender).toBe(0);
		expect(rec.pinTier).toBe(-1);
		expect('preserveUpdateTime' in rec).toBe(false);
	});
});
