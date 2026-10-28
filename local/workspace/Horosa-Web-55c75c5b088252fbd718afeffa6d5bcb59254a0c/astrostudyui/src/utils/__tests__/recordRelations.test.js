// 断事日志/关系边/查重合并 闸。
import {
	appendRecordJournal, linkRecords, unlinkRecords, findDuplicateGroups, mergeRecords,
} from '../recordRelations';
import { upsertLocalChart, listLocalCharts, exportLocalChartsBackup, importLocalChartsBackup } from '../localcharts';

function seed(cid, name, birth){
	upsertLocalChart({ cid, name, birth, zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
}

describe('断事日志', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 追加=新在前带时间戳;经导出→导入全链保真(未知键链)', ()=>{
		seed('local-j-1', '甲', '1990-01-01 08:00:00');
		appendRecordJournal('chart', 'local-j-1', '首断:财运佳');
		appendRecordJournal('chart', 'local-j-1', '回访:应验');
		let rec = listLocalCharts()[0];
		expect(rec.journal.length).toBe(2);
		expect(rec.journal[0].text).toBe('回访:应验');
		expect(rec.journal[1].text).toBe('首断:财运佳');
		expect(typeof rec.journal[0].at).toBe('string');
		const backup = exportLocalChartsBackup();
		window.localStorage.clear();
		importLocalChartsBackup(backup);
		rec = listLocalCharts()[0];
		expect(rec.journal.length).toBe(2);
		expect(rec.journal[1].text).toBe('首断:财运佳');
	});
});

describe('关系边', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 双向写边:parent↔child 互逆,其余对称;重复关联覆盖类型;解除双向清', ()=>{
		seed('local-r-a', '父', '1960-01-01 08:00:00');
		seed('local-r-b', '子', '1990-01-01 08:00:00');
		expect(linkRecords('chart', 'local-r-a', 'local-r-b', 'child')).toBe(true);
		let a = listLocalCharts().find((r)=>r.cid === 'local-r-a');
		let b = listLocalCharts().find((r)=>r.cid === 'local-r-b');
		expect(a.relations).toEqual([{ cid: 'local-r-b', type: 'child' }]);
		expect(b.relations).toEqual([{ cid: 'local-r-a', type: 'parent' }]);
		linkRecords('chart', 'local-r-a', 'local-r-b', 'client');   // 覆盖
		a = listLocalCharts().find((r)=>r.cid === 'local-r-a');
		expect(a.relations).toEqual([{ cid: 'local-r-b', type: 'client' }]);
		unlinkRecords('chart', 'local-r-a', 'local-r-b');
		a = listLocalCharts().find((r)=>r.cid === 'local-r-a');
		b = listLocalCharts().find((r)=>r.cid === 'local-r-b');
		expect(a.relations).toEqual([]);
		expect(b.relations).toEqual([]);
	});

	it('关系边不刷新 updateTime(preserve 语义)', ()=>{
		seed('local-r-c', '丙', '1991-01-01 08:00:00');
		seed('local-r-d', '丁', '1992-01-01 08:00:00');
		linkRecords('chart', 'local-r-c', 'local-r-d', 'friend');
		expect(listLocalCharts().find((r)=>r.cid === 'local-r-c').updateTime).toBe('2026-08-01 10:00:00');
	});
});

describe('查重与合并', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 检测:同名同分钟=精确组;同名 24h 内=近似组;异名不入组', ()=>{
		seed('local-d-1', '戊', '1993-05-05 10:30:00');
		seed('local-d-2', '戊', '1993-05-05 10:30:40');   // 同分钟
		seed('local-d-3', '戊', '1993-05-05 22:00:00');   // 24h 内近似
		seed('local-d-4', '己', '1993-05-05 10:30:00');   // 异名
		const groups = findDuplicateGroups(listLocalCharts(), 'birth');
		expect(groups.length).toBe(1);
		expect(groups[0].map((r)=>r.cid).sort()).toEqual(['local-d-1', 'local-d-2', 'local-d-3']);
	});

	it('🔴 合并:备注拼接/标签并集/主优先副补缺(含未知键);副本进回收站可反悔', ()=>{
		upsertLocalChart({ cid: 'local-m-p', name: '庚', birth: '1994-01-01 08:00:00', zone: '+08:00', memo: '主备注', group: ['甲组'], updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		upsertLocalChart({ cid: 'local-m-s', name: '庚', birth: '1994-01-01 08:00:00', zone: '+08:00', memo: '副备注', group: ['乙组'], pos: '上海', future_merge_key: 'kept', updateTime: '2026-08-01 09:00:00', preserveUpdateTime: true });
		const merged = mergeRecords('chart', 'local-m-p', 'local-m-s');
		expect(merged.cid).toBe('local-m-p');
		const rec = listLocalCharts().find((r)=>r.cid === 'local-m-p');
		expect(rec.memo).toContain('主备注');
		expect(rec.memo).toContain('副备注');
		expect(JSON.parse(rec.group).sort()).toEqual(['乙组', '甲组']);
		expect(rec.pos).toBe('上海');                       // 主缺副补
		expect(rec.future_merge_key).toBe('kept');          // 未知键随并
		expect(listLocalCharts().find((r)=>r.cid === 'local-m-s')).toBeUndefined();   // 副已移出主库
	});
});

describe('合并后的关系边', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });
	const rel = (cid)=>(listLocalCharts({ includeArchived: true }).find((r)=>r.cid === cid) || {}).relations || [];

	it('🔴 第三方指向副记录的边改指主记录;全库没有边指向副记录,主 ↔ 第三方双向成对', ()=>{
		seed('local-r-a', '甲', '2000-01-01 00:00:00');
		seed('local-r-b', '甲', '2000-01-01 00:00:00');
		seed('local-r-c', '乙', '1990-01-01 00:00:00');
		linkRecords('chart', 'local-r-c', 'local-r-b', 'parent');   // B 为 C 的父母
		mergeRecords('chart', 'local-r-a', 'local-r-b');
		const all = listLocalCharts({ includeArchived: true });
		all.forEach((r)=>(r.relations || []).forEach((e)=>expect(e.cid).not.toBe('local-r-b')));
		expect(rel('local-r-a')).toEqual([{ cid: 'local-r-c', type: 'child' }]);
		expect(rel('local-r-c')).toEqual([{ cid: 'local-r-a', type: 'parent' }]);
	});

	it('第三方已有指向主记录的边:保留那条、不重复;主记录与副记录之间的边不留成自指', ()=>{
		seed('local-s-a', '丙', '2000-01-01 00:00:00');
		seed('local-s-b', '丙', '2000-01-01 00:00:00');
		seed('local-s-c', '丁', '1990-01-01 00:00:00');
		linkRecords('chart', 'local-s-c', 'local-s-a', 'friend');
		linkRecords('chart', 'local-s-c', 'local-s-b', 'client');
		linkRecords('chart', 'local-s-a', 'local-s-b', 'sibling');
		mergeRecords('chart', 'local-s-a', 'local-s-b');
		expect(rel('local-s-c')).toEqual([{ cid: 'local-s-a', type: 'friend' }]);
		expect(rel('local-s-a')).toEqual([{ cid: 'local-s-c', type: 'friend' }]);
	});

	it('「关联两条记录」框里的当前关系读作「右为左的…」,父母 / 子女不说反', ()=>{
		const { describeExistingRelation } = require('../../components/common/RecordToolsModals');
		const a = { cid: 'x', name: '小明' };
		const b = { cid: 'y', name: '老王' };
		// linkRecords(a, b, 'parent') 存 a.relations = [{cid: b, type: 'parent'}] = 「b 是 a 的父母」
		const text = describeExistingRelation(a, b, 'parent');
		expect(text).toContain('右为左的「父母」');
		expect(text).toContain('老王 是 小明 的父母');
		expect(text).not.toContain('左为右');
	});
});
