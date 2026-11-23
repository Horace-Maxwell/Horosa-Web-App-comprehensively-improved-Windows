// sky_at:天文馆同一后端;方位换成自正北顺时针(后端自正南起),无星等出「—」,恒星按 id 去重,可按天体 / 地平上筛。
jest.mock('../../services/planetarium', ()=>({ fetchPlanetariumState: jest.fn() }));
import fixture from './__fixtures__/planetariumState_20260301.json';
import skyAt, { skyStateText } from '../aiTools/tools/skyAt';

const { fetchPlanetariumState } = require('../../services/planetarium');
const row = (text, name)=>text.split('\n').find((l)=>l.startsWith(`| ${name} `));

describe('sky_at', ()=>{
	test('方位北起 = 后端南起 + 180;无星等出 —', ()=>{
		const t = skyStateText(fixture, { bodies: ['Moon', 'Jupiter'] });
		const moon = fixture.bodies.find((b)=>b.id === 'Moon');
		expect(row(t, '月')).toContain(`| ${((moon.azimuth + 180) % 360).toFixed(2)}° |`);
		expect(row(t, '月')).toContain('| — |');
		expect(row(t, '日')).toBeUndefined();   // 只要月、木
		expect(t.indexOf('| 月 ')).toBeLessThan(t.indexOf('| 木 '));
	});
	test('恒星按 id 去重;只列地平上', ()=>{
		const t = skyStateText(fixture, { bodies: ['Sun'], fixedStars: true, visibleOnly: true });
		const ids = fixture.stars.fixed.map((s)=>s.id);
		const dup = ids.find((id, i)=>ids.indexOf(id) !== i);
		if(dup){ expect(t.split('\n').filter((l)=>l.includes(`(${dup})`)).length).toBeLessThanOrEqual(1); }
		fixture.stars.fixed.filter((s)=>s.altitudeAppa <= 0).forEach((s)=>{ expect(t).not.toContain(`(${s.id}) |`); });
	});
	test('亮星按星等取前 N,带中文名', ()=>{
		const t = skyStateText(fixture, { bodies: ['Sun'], brightestStars: 2 });
		expect(t).toContain('■ 亮星前 2 颗');
		expect(t).toContain('天狼 Sirius');
	});
	test('起盘:时刻地点下发与天文馆同口径;后端没回 → 可重试失败', async ()=>{
		fetchPlanetariumState.mockResolvedValueOnce({ Result: fixture });
		const r = await skyAt.run({ divTime: '2026-03-01 21:00', gpsLat: 39.9, gpsLon: 116.4, zone: '+08:00' });
		expect(r.ok).toBe(true);
		const body = fetchPlanetariumState.mock.calls[0][0];
		expect(body).toMatchObject({ date: '2026/03/01', time: '21:00:00', zone: '+08:00', zodiacal: 0, siderealAyanamsa: '', includeRiseSet: true, starLimit: 0 });
		fetchPlanetariumState.mockResolvedValueOnce(undefined);
		const bad = await skyAt.run({ divTime: '2026-03-01 21:00', gpsLat: 39.9, gpsLon: 116.4 });
		expect(bad.ok).toBe(false);
		expect(bad.retryable).toBe(true);
	});
});
