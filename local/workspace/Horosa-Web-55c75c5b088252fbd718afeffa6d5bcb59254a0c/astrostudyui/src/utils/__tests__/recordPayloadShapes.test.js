// 记录 payload 两种形态(库里 JSON 串 / 内存里新建或合成的记录是对象)读取结果必须相同。
// 此前三处读取点用 safeParseJson(record.payload):对象一进 JSON.parse 必抛 → 返回 null,整份存档当没有
// (事盘快照回落泛化摘要、宿占存档的盘式 / 宿度制读不到、齿轮重算丢掉存档设置)。
import { parseRecordPayload, extractCaseSnapshotText } from '../aiAnalysisSources';
import { suzhanFieldsForRecord } from '../aiAnalysisContext';

describe('记录 payload:串 / 对象同一读法', ()=>{
	test('共用解析:对象原样、串解析、坏串 / 空 = null', ()=>{
		const obj = { options: { a: 1 } };
		expect(parseRecordPayload(obj)).toBe(obj);
		expect(parseRecordPayload(JSON.stringify(obj))).toEqual(obj);
		expect(parseRecordPayload('{bad')).toBe(null);
		expect(parseRecordPayload('')).toBe(null);
		expect(parseRecordPayload(null)).toBe(null);
	});

	test('🔴 事盘快照:对象形态的 payload 也读得到存档快照', ()=>{
		const base = { cid: 'k1', caseType: 'wuzhao', sourceModule: 'wuzhao', event: '测', divTime: '2026-01-01 10:00:00' };
		const payload = { module: 'wuzhao', snapshot: '[五兆]\n存档快照正文' };
		const asString = extractCaseSnapshotText({ ...base, payload: JSON.stringify(payload) });
		const asObject = extractCaseSnapshotText({ ...base, payload });
		expect(asString.content).toContain('存档快照正文');
		expect(asObject.content).toBe(asString.content);
		expect(asObject.snapshotStatus).toBe(asString.snapshotStatus);
	});

	test('🔴 宿占:对象形态的 payload 也读得到存档的盘式 / 宿度制', ()=>{
		const rec = { cid: 'k2', divTime: '2026-01-01 10:00:00', birth: '2026-01-01 10:00:00', zone: '+08:00', lon: '116e28', lat: '39n54' };
		const payload = { options: { szchart: 2, doubingSu28: 3 } };
		const a = suzhanFieldsForRecord({ ...rec, payload: JSON.stringify(payload) });
		const b = suzhanFieldsForRecord({ ...rec, payload });
		expect(a.szchart.value).toBe(2);
		expect(b.szchart.value).toBe(2);
		expect(b.doubingSu28.value).toBe(3);
	});
});
