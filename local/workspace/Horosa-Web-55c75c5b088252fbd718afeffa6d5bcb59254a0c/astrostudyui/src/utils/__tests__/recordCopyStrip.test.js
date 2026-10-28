// 复制记录(另存副本 / 历史版本恢复为副本)的单源剥离表:去掉存储身份、管理字段、名人编号、AI 来源、关系边;
// 代次标记与全部随盘设置 / 批注 / 分组保留(副本载入必须与原件一致)。AI 工具禁键覆盖全部管理字段。
import { toRecordCopy, RECORD_COPY_STRIP_KEYS, RECORD_MANAGEMENT_KEYS } from '../localRecordStore';
import { FORBIDDEN_ARG_KEYS } from '../aiTools/catalog';

describe('复制记录剥离表', ()=>{
	const rec = {
		cid: 'adb-2939', schemaVersion: 2, deletedAt: 't', updateTime: 'u', pinTier: 1, pinAt: 'p', orderKey: 3, archived: true, starred: true,
		lastOpenedAt: 'l', openCount: 2, celebrityId: 'adb-2939', aiOrigin: { tool: 'x', inputFingerprint: 'f' }, relations: [{ cid: 'local-1' }],
		name: '爱因斯坦', birth: '1879-03-14 11:30:00', fieldsCaptureGen: 1, ziweiSettingsGen: 1, after23NewDay: 1, timeAlg: 1, sihuaSchool: 'zhongzhou',
		memoAstro: '批注', group: ['Astrodatabank'], egypt_calendarAnchor: 'philip',
	};
	test('去掉身份 / 管理 / 外部身份 / 关系边;标题加后缀;其余原样', ()=>{
		const dup = toRecordCopy(rec, { titleKey: 'name', suffix: '(副本)' });
		RECORD_COPY_STRIP_KEYS.forEach((k)=>expect([k, Object.prototype.hasOwnProperty.call(dup, k)]).toEqual([k, false]));
		expect(dup).toEqual(expect.objectContaining({ name: '爱因斯坦(副本)', birth: rec.birth, fieldsCaptureGen: 1, ziweiSettingsGen: 1, after23NewDay: 1, timeAlg: 1,
			sihuaSchool: 'zhongzhou', memoAstro: '批注', group: ['Astrodatabank'], egypt_calendarAnchor: 'philip' }));
		expect(rec.cid).toBe('adb-2939');   // 原件不动
		expect(toRecordCopy({ event: '问事' }, { titleKey: 'event', suffix: '(历史版)' }).event).toBe('问事(历史版)');
	});
	test('AI 工具禁键覆盖全部管理字段与存储身份', ()=>{
		RECORD_MANAGEMENT_KEYS.concat(['cid', 'schemaVersion', 'deletedAt', 'updateTime', 'preserveUpdateTime']).forEach((k)=>{
			expect([k, FORBIDDEN_ARG_KEYS.indexOf(k) >= 0]).toEqual([k, true]);
		});
	});
	test('另存副本 / 恢复为副本 四处都走单源(不再各删各的)', ()=>{
		const fs = require('fs');
		const path = require('path');
		const R = (f)=>fs.readFileSync(path.resolve(__dirname, '../../', f), 'utf8');
		expect(R('components/user/ChartList.js')).toContain("toRecordCopy(rec, { titleKey: 'name', suffix: '(副本)' })");
		expect(R('components/user/CaseList.js')).toContain("toRecordCopy(rec, { titleKey: 'event', suffix: '(副本)' })");
		expect(R('components/user/ChartData.js')).toContain("toRecordCopy(snap, { titleKey: 'name', suffix: '(历史版)' })");
		expect(R('components/user/CaseData.js')).toContain("toRecordCopy(snap, { titleKey: 'event', suffix: '(历史版)' })");
		['ChartList', 'CaseList', 'ChartData', 'CaseData'].forEach((n)=>expect([n, /delete dup\.cid/.test(R(`components/user/${n}.js`))]).toEqual([n, false]));
	});
});

describe('合并重复记录不从副记录补管理字段', ()=>{
	test('副记录已归档 / 置底 → 主记录不继承;名人库编号主记录缺时照补', ()=>{
		const { upsertLocalChart, getLocalChart } = require('../localcharts');
		const { mergeRecords } = require('../recordRelations');
		window.localStorage.clear();
		upsertLocalChart({ cid: 'local-1-a', name: '甲', birth: '1990-01-01 12:00:00' });
		upsertLocalChart({ cid: 'local-2-b', name: '甲', birth: '1990-01-01 12:00:00', archived: true, pinTier: -1, celebrityId: 'adb-9', memoAstro: '副记录批注' });
		const r = mergeRecords('chart', 'local-1-a', 'local-2-b');
		expect(r).toBeTruthy();
		const p = getLocalChart('local-1-a');
		expect(p.archived).not.toBe(true);
		expect(p.pinTier).not.toBe(-1);
		expect(p.celebrityId).toBe('adb-9');   // 名人库编号例外:主记录缺时照补(否则名人库 / AI 建档会再建一条)
		expect(p.memoAstro).toBe('副记录批注');   // 内容照补
	});
	test('名人库旧档(只在 cid 里带 adb- 身份、没有 celebrityId 字段)并进本机档:编号取自它的 cid', ()=>{
		const { upsertLocalChart, getLocalChart } = require('../localcharts');
		const { mergeRecords } = require('../recordRelations');
		window.localStorage.clear();
		upsertLocalChart({ cid: 'local-9-a', name: '乙', birth: '1950-01-01 12:00:00' });
		upsertLocalChart({ cid: 'adb-9', name: '乙', birth: '1950-01-01 12:00:00' });
		expect(mergeRecords('chart', 'local-9-a', 'adb-9')).toBeTruthy();
		expect(getLocalChart('local-9-a').celebrityId).toBe('adb-9');
		// 主记录已有编号:不改
		upsertLocalChart({ cid: 'local-8-a', name: '丙', birth: '1950-01-01 12:00:00', celebrityId: 'adb-1' });
		upsertLocalChart({ cid: 'adb-8', name: '丙', birth: '1950-01-01 12:00:00' });
		mergeRecords('chart', 'local-8-a', 'adb-8');
		expect(getLocalChart('local-8-a').celebrityId).toBe('adb-1');
	});
});

describe('名人去重取法稳定', ()=>{
	test('编号相同多条:cid 精确命中优先;否则未归档优先,再取最早建的(不随列表顺序变)', ()=>{
		const { upsertLocalChart } = require('../localcharts');
		const { findCelebrityChart } = require('../astrodata/celebrityDedupe');
		window.localStorage.clear();
		upsertLocalChart({ cid: 'local-200-x', name: 'A', birth: '1900-01-01 12:00:00', celebrityId: 'adb-5' });
		upsertLocalChart({ cid: 'local-100-y', name: 'A(改)', birth: '1900-01-01 12:00:00', celebrityId: 'adb-5' });
		expect(findCelebrityChart({ id: 'adb-5' }).cid).toBe('local-100-y');
		upsertLocalChart({ cid: 'local-100-y', archived: true });
		expect(findCelebrityChart({ id: 'adb-5' }).cid).toBe('local-200-x');
		upsertLocalChart({ cid: 'adb-5', name: 'A', birth: '1900-01-01 12:00:00' });
		expect(findCelebrityChart({ id: 'adb-5' }).cid).toBe('adb-5');
	});
});
