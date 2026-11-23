// rectify_india:与印占页校时器同一接口与参数(rectifyWindowMinutes / StepSeconds / RpSource);只读;后端没回 → 可重试。
jest.mock('../request', ()=>jest.fn());
import * as Constants from '../constants';
import rectifyIndia, { rectifyResultText } from '../aiTools/tools/rectifyIndia';

const request = require('../request');
const RES = { available: true, resolution: { maxLagnaDeltaDeg: 0.27, narrowestSubDeg: 0.67, adequate: true },
	runs: { lagnaSubLord: [{ value: 'Moon', fromTime: '07:40:00', toTime: '07:44:00', count: 5 }] },
	top: [{ time: '07:46:00', score: { total: 13 }, rp: { score: 6 }, pranapada: { overall: 'good' }, offsetSeconds: -840 }], disclaimer: '半自动校时' };
const SRC = { kind: 'natal', birth: '1990-01-01 08:00', gpsLat: 39.9, gpsLon: 116.4, zone: '+08:00' };

describe('rectify_india', ()=>{
	beforeEach(()=>request.mockReset());
	test('参数与页面同名;正文列区段与候选;候选结构化回', async ()=>{
		request.mockResolvedValue({ [Constants.ResultKey]: RES });
		const r = await rectifyIndia.run({ source: SRC, windowMinutes: 20, stepSeconds: 30, rpSource: 'candidate' });
		expect(r.ok).toBe(true);
		const [url, init] = request.mock.calls[0];
		expect(url).toMatch(/\/india\/rectify$/);
		expect(JSON.parse(init.body)).toMatchObject({ rectifyWindowMinutes: 20, rectifyStepSeconds: 30, rectifyRpSource: 'candidate' });
		expect(r.data.content).toContain('月亮:07:40:00 ~ 07:44:00(5 采样)');
		expect(r.data.content).toContain('| 1 | 07:46:00 | 13 | 6 | good |');
		expect(r.data.candidates[0]).toEqual({ time: '07:46:00', total: 13, rp: 6, pranapada: 'good', offsetSeconds: -840 });
	});
	test('缺分数出空、不出 undefined', ()=>{
		expect(rectifyResultText({ top: [{ time: '08:00:00' }] }, { windowMinutes: 1, stepSeconds: 1, rpSource: 'anchor' })).not.toMatch(/undefined/);
	});
	test('后端没回 / 不可用 → 可重试失败', async ()=>{
		request.mockResolvedValue({ [Constants.ResultKey]: { available: false } });
		expect((await rectifyIndia.run({ source: SRC })).retryable).toBe(true);
	});
});
