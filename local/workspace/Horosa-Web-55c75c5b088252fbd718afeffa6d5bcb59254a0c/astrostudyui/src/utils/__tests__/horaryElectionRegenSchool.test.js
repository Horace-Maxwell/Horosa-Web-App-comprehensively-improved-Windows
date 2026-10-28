// 合同:卜卦 / 择日挂载重算 —— 不换派时存档里手改过的宫制为准(不被流派宫制顶掉);缺流派按存档宫制反推流派(与页面同一判据);
//   只有齿轮换了流派,新派后端字段才覆盖存档。三处(齿轮基线展平 / 换没换派 / 重算)同一个 horaryStoredSchool,不各写缺省。
import fs from 'fs';
import path from 'path';

const calls = [];
jest.mock('../../services/astro', ()=>({
	__esModule: true,
	fetchChart: jest.fn(async (values)=>{ calls.push(values); return null; }),   // 只看请求,不起盘
}));

const { regenerateHorarySnapshot, regenerateElectionSnapshot } = require('../aiAnalysisContext/regenHoraryElection');
const { horaryStoredSchool, HORARY_SCHOOLS, horaryBackendFields } = require('../../divination/horary/horarySchools');
const { flattenHoraryStored } = require('../techniqueMountSettings');

const caseRecord = (payload)=>({ cid: 'c1', divTime: '2024-01-01 10:00:00', zone: '+08:00', lon: '116e24', lat: '39n54', payload: JSON.stringify(payload) });
const hsysOf = (id)=>HORARY_SCHOOLS[id].backend.hsys;

beforeEach(()=>{ calls.length = 0; });

test('🔴 卜卦存整宫 + 经典主流、不换派 → 请求宫制 = 存档的整宫', async ()=>{
	const whole = hsysOf('hellenistic');
	expect(whole).not.toBe(hsysOf('classical'));
	const payload = { extra: { horarySchool: 'classical' }, settings: { hsys: whole } };
	await regenerateHorarySnapshot(caseRecord(payload), payload);
	expect(Number(calls[0].hsys)).toBe(whole);
});

test('🔴 齿轮换了派 → 新派宫制覆盖存档', async ()=>{
	const payload = { extra: { horarySchool: 'classical' }, settings: { hsys: hsysOf('hellenistic') } };
	await regenerateHorarySnapshot(caseRecord(payload), { ...payload, horarySchool: 'modern' });
	expect(Number(calls[0].hsys)).toBe(horaryBackendFields('modern').hsys);
});

test('🔴 缺流派 + 整宫 → 按希腊化;抽屉基线显示希腊化(选它不算换派)', ()=>{
	const payload = { extra: {}, settings: { hsys: hsysOf('hellenistic') } };
	expect(horaryStoredSchool(payload)).toBe('hellenistic');
	expect(flattenHoraryStored(payload).horarySchool).toBe('hellenistic');
	expect(horaryStoredSchool({ extra: {} })).toBe('classical');
	expect(horaryStoredSchool({ extra: { horarySchool: 'modern' }, settings: { hsys: hsysOf('hellenistic') } })).toBe('modern');
});

test('🔴 择日存 hsys 1 + 希腊化、不换派 → 请求 1;齿轮换派 → 新派宫制', async ()=>{
	const payload = { extra: { westSchool: 'hellenistic' }, settings: { hsys: 1 } };
	await regenerateElectionSnapshot(caseRecord(payload), payload);
	expect(Number(calls[0].hsys)).toBe(1);
	const { schoolOf } = require('../../divination/election/westernSchools');
	const target = ['modern_main', 'persian', 'renaissance', 'modern_revival'].find((id)=>{ const sc = schoolOf(id); return sc && sc.hsys !== null && sc.hsys !== undefined && sc.hsys !== 1; });
	if(target){
		calls.length = 0;
		await regenerateElectionSnapshot(caseRecord(payload), { ...payload, westSchool: target });
		expect(Number(calls[0].hsys)).toBe(schoolOf(target).hsys);
	}
});

test('静态锁:重算件不各写缺省流派', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '../aiAnalysisContext/regenHoraryElection.js'), 'utf8');
	expect(src).not.toMatch(/'classical'/);
	expect((src.match(/horaryStoredSchool\(/g) || []).length).toBeGreaterThanOrEqual(2);
});
