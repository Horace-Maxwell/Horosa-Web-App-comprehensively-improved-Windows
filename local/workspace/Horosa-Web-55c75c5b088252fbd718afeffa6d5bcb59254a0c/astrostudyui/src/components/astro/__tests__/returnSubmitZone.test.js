// [Q-303/T-290] 返照 / 流年盘「提交」带上所选时区(与 DateTimeSelector 自动请求同源),不再沿用上一次响应写回的旧 dirZone。
import DateTime from '../../comp/DateTime';

global.React = require('react');

const PAGES = ['AstroSolarReturn', 'AstroLunarReturn', 'AstroGivenYear'];

describe('返照 / 流年盘 submit(values) 时区来源', () => {
	PAGES.forEach((name) => {
		it(`${name}:表单无 zone 项时取 values.datetime.zone;有 zone 项仍以 zone 为准`, () => {
			const Cls = require(`../${name}`).default;
			const calls = [];
			const fake = { state: { params: { dirZone: '+08:00', dirLat: '1n', dirLon: '1e' } }, requestDirection: (p) => calls.push(p) };
			const dt = new DateTime();
			dt.parse('2026-03-01 10:00:00', 'YYYY-MM-DD HH:mm:ss');
			dt.setZone('+00:00');
			Cls.prototype.submit.call(fake, { datetime: dt, lat: '2n', lon: '2e' });
			expect(calls.length).toBe(1);
			expect(calls[0].dirZone).toBe('+00:00');   // 此前=沿用 state 的 +08:00(自动请求在途时提交 → 旧时区胜出)
			expect(calls[0].dirLat).toBe('2n');
			Cls.prototype.submit.call(fake, { datetime: dt, lat: '2n', lon: '2e', zone: '+03:00' });
			expect(calls[1].dirZone).toBe('+03:00');
		});
	});
});
