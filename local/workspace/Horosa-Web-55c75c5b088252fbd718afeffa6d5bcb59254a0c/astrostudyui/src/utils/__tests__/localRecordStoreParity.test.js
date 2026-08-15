// 🔴 [S0] 命盘/事盘存储层「字节金标」—— 内核收编(S1..S9)每一步的零回归审阅面。
//
// 判据:固定输入序列(显式 cid + preserveUpdateTime + 固定 updateTime,绕开 nowStr/随机 cid)
// 写入后,两个 localStorage 键的**原始字符串**必须与 golden 逐字节相等。
// 任何一步重构后本金标必须不变;唯 S7(schemaVersion 盖章)**有意更新过一次**(已发生):
// diff 仅每记录尾插 "schemaVersion":2,经审阅 —— 此后金标再度冻结,后续步骤零字节变。
//
// 输入覆盖面(刻意挑齐分支):新增/按 cid 合并覆盖/技法键 present 才落/gender 0 合法值/
// group 数组归一 JSON 串/payload 对象归一串/caseType 繁简别名归一/sort 按 updateTime 倒序。
// egypt 兜底在洁净 jsdom(无全局流派存储)= 全默认不落键,确定性成立。
import { upsertLocalChart, listLocalCharts, exportLocalChartsBackup } from '../localcharts';
import { upsertLocalCase, listLocalCases, exportLocalCasesBackup } from '../localcases';

const CHARTS_KEY = 'horosa.localCharts.v1';
const CASES_KEY = 'horosa.localCases.v1';

// golden 采自现行实现首跑(String.raw 保住 JSON-in-JSON 的反斜杠,逐字节)。
const CHARTS_GOLDEN = String.raw`[{"cid":"local-9000-000001","name":"金标·甲","birth":"1984-11-05 03:15:00","ad":1,"zone":"+08:00","lat":"39n54","lon":"116e28","gpsLat":39.9,"gpsLon":116.47,"pos":"北京","gender":1,"isPub":0,"group":"[\"金标\",\"甲组\"]","creator":"local","updateTime":"2026-08-01 10:00:00","memoAstro":"astro备注","memoBaZi":null,"memoZiWei":null,"memo74":null,"memoGua":null,"memoLiuReng":null,"memoQiMeng":null,"memoSuZhan":null,"payload":"{\"k\":1}","sourceModule":null,"chartType":null,"after23NewDay":1,"orbScale":1.5,"timeAlg":1,"hsys":3,"zodiacal":1,"termsVariant":2,"schemaVersion":2},{"cid":"local-9000-000002","name":"金标·乙改","birth":"1990-02-01 12:30:00","ad":1,"zone":"-05:00","lat":"40n43","lon":"74w00","pos":"","gender":0,"isPub":0,"group":null,"creator":"local","updateTime":"2026-07-16 08:00:00","memoAstro":null,"memoBaZi":null,"memoZiWei":null,"memo74":null,"memoGua":null,"memoLiuReng":null,"memoQiMeng":null,"memoSuZhan":null,"payload":null,"sourceModule":null,"chartType":null,"schemaVersion":2}]`;
const CASES_GOLDEN = String.raw`[{"cid":"local-case-9000-000002","event":"金标·择日","caseType":"qimenzeri","divTime":"2026-08-14 14:00:00","zone":"+08:00","pos":"","isPub":0,"group":null,"creator":"local","updateTime":"2026-08-03 09:00:00","payload":null,"sourceModule":"qimenzeri","schemaVersion":2},{"cid":"local-case-9000-000001","event":"金标·占婚","caseType":"liuyao","divTime":"2026-08-13 10:00:00","zone":"+08:00","lat":"31n12","lon":"121e30","gpsLat":31.2,"gpsLon":121.5,"pos":"上海","gender":0,"isPub":0,"group":"[\"金标\"]","creator":"local","updateTime":"2026-08-02 09:00:00","payload":"{\"module\":\"guazhan\",\"version\":1,\"fieldSnapshot\":{\"timeAlg\":1},\"gua\":[1,2,3]}","sourceModule":"guazhan","schemaVersion":2}]`;

function seedCharts(){
	upsertLocalChart({
		cid: 'local-9000-000001', name: '金标·甲', birth: '1984-11-05 03:15:00', ad: 1, zone: '+08:00',
		lat: '39n54', lon: '116e28', gpsLat: 39.9, gpsLon: 116.47, pos: '北京', gender: 1, isPub: 0,
		group: ['金标', '甲组'], creator: 'local', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true,
		memoAstro: 'astro备注', payload: { k: 1 },
		hsys: 3, zodiacal: 1, termsVariant: 2, orbScale: 1.5, after23NewDay: 1, timeAlg: 1,
	});
	upsertLocalChart({
		cid: 'local-9000-000002', name: '金标·乙', birth: '1990-02-01 12:30:00', zone: '-05:00',
		lat: '40n43', lon: '74w00', gender: 0, updateTime: '2026-07-15 08:00:00', preserveUpdateTime: true,
	});
	// 按 cid 合并覆盖(upsert 合并语义:{...base,...values} 后重建,未提供键保留)
	upsertLocalChart({ cid: 'local-9000-000002', name: '金标·乙改', updateTime: '2026-07-16 08:00:00', preserveUpdateTime: true });
}

function seedCases(){
	upsertLocalCase({
		cid: 'local-case-9000-000001', event: '金标·占婚', caseType: 'liuyao', divTime: '2026-08-13 10:00:00',
		zone: '+08:00', lat: '31n12', lon: '121e30', gpsLat: 31.2, gpsLon: 121.5, pos: '上海', gender: 0,
		group: ['金标'], updateTime: '2026-08-02 09:00:00', preserveUpdateTime: true,
		payload: { module: 'guazhan', version: 1, fieldSnapshot: { timeAlg: 1 }, gua: [1, 2, 3] },
	});
	upsertLocalCase({
		cid: 'local-case-9000-000002', event: '金标·择日', caseType: '奇门择日', divTime: '2026-08-14 14:00:00',
		zone: '+08:00', updateTime: '2026-08-03 09:00:00', preserveUpdateTime: true, sourceModule: 'qimenzeri',
	});
}

describe('[S0] 存储层字节金标', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 命盘键原串逐字节等于 golden', ()=>{
		seedCharts();
		expect(window.localStorage.getItem(CHARTS_KEY)).toBe(CHARTS_GOLDEN);
	});

	it('🔴 事盘键原串逐字节等于 golden', ()=>{
		seedCases();
		expect(window.localStorage.getItem(CASES_KEY)).toBe(CASES_GOLDEN);
	});

	it('派生行为锚:排序/合并/信封形状(exportedAt 外)', ()=>{
		seedCharts();
		seedCases();
		expect(listLocalCharts().map((r)=>r.name)).toEqual(['金标·甲', '金标·乙改']);
		expect(listLocalCases().map((r)=>r.caseType)).toEqual(['qimenzeri', 'liuyao']);
		const cb = exportLocalChartsBackup();
		expect(cb.format).toBe('horosa-local-charts');
		expect(cb.version).toBe(1);
		expect(cb.total).toBe(2);
		const eb = exportLocalCasesBackup();
		expect(eb.format).toBe('horosa-local-cases');
		expect(eb.version).toBe(1);
		expect(eb.total).toBe(2);
	});
});
