// cast_acg:请求体 / 界面层状态 / 正文与占星地图页同一份(acgRequestParams / acgSnapshotUiState / buildAcgTextFor);
// 不动页面的「最近一次地图状态」;事盘源拒;落点分析走 /location/acgpoint。
jest.mock('../request', ()=>jest.fn());
import * as Constants from '../constants';
import castAcg from '../aiTools/tools/castAcg';
import { acgInitialState, acgRequestParams, ACG_PAGE_SETTINGS } from '../../components/acg/AstroAcg';
import { buildAcgSectionText, clearAcgSnapshot } from '../acgSnapshot';

const request = require('../request');
const PLANETS = { planets: [{ id: 'Sun', mc: 10, ic: -170, asc: [{ lat: 0, lon: 100 }], dsc: [{ lat: 0, lon: -80 }] }], meta: { mode: 'mundo', coord: 'geo' } };
const SRC = { kind: 'natal', birth: '1990-01-01 08:00', gpsLat: 39.9, gpsLon: 116.4, zone: '+08:00' };

describe('cast_acg', ()=>{
	beforeEach(()=>{ request.mockReset(); clearAcgSnapshot(); });
	test('请求体 = 页面同一构参(页面保存的设置);不改页面的最近地图状态', async ()=>{
		request.mockResolvedValue({ [Constants.ResultKey]: PLANETS });
		const r = await castAcg.run({ source: SRC });
		expect(r.ok).toBe(true);
		expect(r.data.content).toMatch(/占星地图/);
		const [url, init] = request.mock.calls[0];
		expect(url).toMatch(/\/location\/acg$/);
		const body = JSON.parse(init.body);
		const st = acgInitialState(ACG_PAGE_SETTINGS.load());
		['mode', 'lsMode', 'coord', 'posType', 'horizon', 'nodeType', 'lilithType', 'draconic', 'midpointMode', 'geodetic', 'geodeticVar', 'hsys'].forEach((k)=>{ expect(`${k}=${body[k]}`).toBe(`${k}=${st[k]}`); });
		expect(body.date).toBe('1990/01/01');
		expect(typeof acgRequestParams).toBe('function');
		expect(buildAcgSectionText()).toBe('');   // 页面快照没被工具写
	});
	test('落点分析:经纬度走 acgpoint,带容许度', async ()=>{
		request.mockImplementation((url)=>Promise.resolve({ [Constants.ResultKey]: /acgpoint$/.test(url) ? { hits: [] } : PLANETS }));
		const r = await castAcg.run({ source: SRC, point: { lat: 31.23, lon: 121.47 }, orb: 3 });
		expect(r.ok).toBe(true);
		const pointCall = request.mock.calls.find((c)=>/acgpoint$/.test(c[0]));
		const pb = JSON.parse(pointCall[1].body);
		expect([pb.clickLat, pb.clickLon, pb.orb]).toEqual([31.23, 121.47, 3]);
		expect(r.data.point).toEqual({ lat: 31.23, lon: 121.47 });
	});
	test('后端没回 → 可重试失败;point 缺坐标 → 参数错', async ()=>{
		request.mockResolvedValue(undefined);
		const bad = await castAcg.run({ source: SRC });
		expect(bad.retryable).toBe(true);
		request.mockResolvedValue({ [Constants.ResultKey]: PLANETS });
		expect((await castAcg.run({ source: SRC, point: {} })).code).toBe('E_ARGS_INVALID');
	});
});
