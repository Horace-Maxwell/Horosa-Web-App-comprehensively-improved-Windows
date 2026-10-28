// 巴比伦占星快照:七曜实位取不到(排盘服务连不上 / 回包没有结果)时如实失败,不出一份没有行星的「成功」快照。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn() }));
const request = require('../request').default;
const { buildBabylonSnapshotForFields } = require('../babylonAiSnapshot');
const { buildFieldObject } = require('../aiAnalysisContext/recordFields');

const record = { birth: '1990-01-01 08:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, gender: 1 };

describe('buildBabylonSnapshotForFields', ()=>{
	afterEach(()=>request.mockReset());
	it('🔴 排盘请求抛错 → 拒绝(不出快照)', async ()=>{
		request.mockImplementation(()=>Promise.reject(new TypeError('fetch failed')));
		await expect(buildBabylonSnapshotForFields(buildFieldObject(record))).rejects.toThrow(/七曜/);
	});
	it('🔴 回包没有结果(错误信封)→ 拒绝', async ()=>{
		request.mockImplementation(()=>Promise.resolve({ ResultCode: 503, Result: null }));
		await expect(buildBabylonSnapshotForFields(buildFieldObject(record))).rejects.toThrow(/七曜/);
	});
	it('有七曜实位 → 照常出快照(历象接口失败只按段内缺省)', async ()=>{
		const objects = [['Sun', 280.5], ['Moon', 12.3], ['Jupiter', 100.1], ['Venus', 300.2], ['Mercury', 270.4], ['Saturn', 290.6], ['Mars', 230.7]].map(([id, lon])=>({ id, lon }));
		request.mockImplementation((url)=>(/\/chart$/.test(url) ? Promise.resolve({ ResultCode: 0, Result: { chart: { objects } } }) : Promise.reject(new TypeError('fetch failed'))));
		const text = await buildBabylonSnapshotForFields(buildFieldObject(record));
		expect(text).toContain('[七曜按宫]');
		expect(text.length).toBeGreaterThan(200);
	});
});
