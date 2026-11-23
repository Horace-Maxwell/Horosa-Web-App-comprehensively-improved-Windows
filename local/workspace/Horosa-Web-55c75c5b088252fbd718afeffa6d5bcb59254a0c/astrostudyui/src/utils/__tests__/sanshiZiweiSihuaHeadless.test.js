// 三式合一「紫微四化」无头同源:起课时刻取紫微盘(参数形同页签 buildZiweiParams),首个大限 / 流年 = 页签初始选中;取盘失败不产段。
import * as Constants from '../constants';

jest.mock('../request', ()=>jest.fn());
jest.mock('../../components/sanshi/SanShiZiWeiSihua', ()=>({
	__esModule: true,
	default: function Stub(){ return null; },
	buildSanShiZiweiSihuaSnapshotLines: jest.fn(()=>['◆ 生年四化（丙）：禄天同·财帛']),
}));

const request = require('../request');
const { buildSanShiZiweiSihuaSnapshotLines } = require('../../components/sanshi/SanShiZiWeiSihua');
const { regenerateSanshiZiweiSihuaLines } = require('../aiAnalysisContext/regenDivination');

const RECORD = { divTime: '2026-03-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, gender: 0 };

describe('regenerateSanshiZiweiSihuaLines', ()=>{
	beforeEach(()=>{ request.mockReset(); buildSanShiZiweiSihuaSnapshotLines.mockClear(); });

	test('参数形同页签;盘交给同源取数,大限 / 流年取首项', async ()=>{
		const chart = { tag: 'zw' };
		request.mockResolvedValue({ [Constants.ResultKey]: { chart } });
		const lines = await regenerateSanshiZiweiSihuaLines(RECORD, { options: { timeAlg: 1 } });
		expect(lines).toEqual(['◆ 生年四化（丙）：禄天同·财帛']);
		const [url, init] = request.mock.calls[0];
		expect(url).toMatch(/\/ziwei\/birth$/);
		const body = JSON.parse(init.body);
		expect(body).toMatchObject({ date: '2026-03-01', time: '10:00:00', zone: '+08:00', gender: 0, timeAlg: 1 });
		expect(Object.keys(body).sort()).toEqual(['after23NewDay', 'date', 'gender', 'gpsLat', 'gpsLon', 'lat', 'lateZiHourUseNextDay', 'lon', 'time', 'timeAlg', 'zone']);
		expect(buildSanShiZiweiSihuaSnapshotLines).toHaveBeenCalledWith(chart, 0, 0);
	});

	test('取盘失败 / 无盘 → 不产段', async ()=>{
		request.mockRejectedValue(new Error('offline'));
		expect(await regenerateSanshiZiweiSihuaLines(RECORD, {})).toEqual([]);
		request.mockResolvedValue({ [Constants.ResultKey]: {} });
		expect(await regenerateSanshiZiweiSihuaLines(RECORD, {})).toEqual([]);
	});
});
