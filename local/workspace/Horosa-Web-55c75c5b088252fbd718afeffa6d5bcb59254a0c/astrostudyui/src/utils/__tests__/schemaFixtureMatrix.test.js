// 🔴 [V5-C9] schema 夹具矩阵(Room 范式):每个历史 schemaVersion 冻结一份「旧世界备份」
// fixture,测试跑 v_n → 当前版 的完整导入路径逐字段校验 —— 「从很老版本一步跳到最新」
// 的组合路径永远有 golden 覆盖。
//
// 制度:每次升 LOCAL_RECORD_SCHEMA_VERSION 必须新增 fixtures/schema-v{旧版}/ 目录冻结
// 旧世界(preflight[215] 锚:fixtures 目录数 = 当前版-1,少了=红)。fixture 一经冻结不可改
// (它就是旧版本 app 真实导出的样子)。
import fs from 'fs';
import path from 'path';
import { importLocalChartsBackup, listLocalCharts } from '../localcharts';
import { LOCAL_RECORD_SCHEMA_VERSION } from '../localRecordStore';

const FIXTURES_ROOT = path.join(__dirname, '..', '..', 'test', 'fixtures');

describe('[V5-C9] schema 夹具矩阵', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 fixtures 目录覆盖全部历史版(v1..当前-1),升 schemaVersion 忘冻结旧世界=红', ()=>{
		for(let v = 1; v < LOCAL_RECORD_SCHEMA_VERSION; v++){
			const dir = path.join(FIXTURES_ROOT, `schema-v${v}`);
			expect(`schema-v${v}:${fs.existsSync(dir) && fs.readdirSync(dir).length ? 'ok' : 'MISSING(升版必须冻结旧世界 fixture)'}`).toBe(`schema-v${v}:ok`);
		}
	});

	it('🔴 v1 旧世界备份 → 当前版导入:盖章到当前 schemaVersion + 逐字段保真(含 v1 未知键)', ()=>{
		const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_ROOT, 'schema-v1', 'charts-backup.json'), 'utf8'));
		const r = importLocalChartsBackup(fixture);
		expect(r.imported).toBe(2);
		expect(r.failed).toBe(0);
		const list = listLocalCharts();
		const a = list.find((x)=>x.cid === 'local-fixture-v1-a');
		expect(a.name).toBe('夹具甲(v1无schemaVersion)');
		expect(a.birth).toBe('1984-11-05 06:30:00');
		expect(a.gender).toBe(1);
		expect(a.memoAstro).toBe('v1 世界的技法批注');
		expect(a.hsys).toBe(1);
		expect(a.schemaVersion).toBe(LOCAL_RECORD_SCHEMA_VERSION);   // 盖章到当前
		const b = list.find((x)=>x.cid === 'local-fixture-v1-b');
		expect(b.future_v1_key).toBe('v1 时代就带的未知键(迁移不许丢)');   // 未知键保全跨版本成立
		expect(b.schemaVersion).toBe(LOCAL_RECORD_SCHEMA_VERSION);
	});
});
