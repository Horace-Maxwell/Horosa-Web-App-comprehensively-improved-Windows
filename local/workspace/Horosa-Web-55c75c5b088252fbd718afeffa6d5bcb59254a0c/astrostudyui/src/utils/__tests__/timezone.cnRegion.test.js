import { dstAwareZoneAt, resolveGeoZone } from '../timezone';
import { resolveZone } from '../aiTools/normalize/zone';

// 中国境内时区口径金标(选点预览/存档推断/AI 工具三条路径同源于 dstAwareZoneAt)。
// 现状:纯 IANA 地理时区——新疆(Asia/Urumqi)全年 +06:00;历史夏令时按 Intl 数据库如实给出。
// 本文件锁「口径决定」:任何改动口径的提交必须同时改这里的期望并在 docs/DATA_ASSETS_LEDGER.md 记录决定。
const URUMQI = { lat: 43.8256, lng: 87.6168 };
const KASHGAR = { lat: 39.4704, lng: 75.9898 };
const LHASA = { lat: 29.65, lng: 91.1 };
const BEIJING = { lat: 39.9042, lng: 116.4074 };
const SHANGHAI = { lat: 31.2304, lng: 121.4737 };
const TAIPEI = { lat: 25.033, lng: 121.5654 };
const HONGKONG = { lat: 22.3193, lng: 114.1694 };

describe('timezone · 中国境内口径金标', ()=>{
	test('新疆坐标 → Asia/Urumqi(地理时区 +06:00,统一口径见 D1)', ()=>{
		const u = dstAwareZoneAt(URUMQI.lat, URUMQI.lng, '1995-11-02');
		expect(u.geoZone || u.zone).toBe('Asia/Urumqi');
		expect(u.offset).toBe('+08:00');
		expect(u.advisory).toBe('cn-unified');
		const k = dstAwareZoneAt(KASHGAR.lat, KASHGAR.lng, '2000-06-15');
		expect(k.offset).toBe('+08:00');
	});

	test('统一北京时间之前(1949-10-01 前)的新疆仍按地理时区 +06:00', ()=>{
		const u = dstAwareZoneAt(URUMQI.lat, URUMQI.lng, '1940-06-01');
		expect(u.offset).toBe('+06:00');
		expect(u.advisory).toBeFalsy();
	});

	test('拉萨(Asia/Shanghai)→ +08:00,无 advisory', ()=>{
		const l = dstAwareZoneAt(LHASA.lat, LHASA.lng, '1995-11-02');
		expect(l.zone).toBe('Asia/Shanghai');
		expect(l.offset).toBe('+08:00');
		expect(l.advisory).toBeFalsy();
	});

	test('1986–1991 夏令时:北京 1988-07 → +09:00,1988-12 → +08:00(Intl 历史库,不得被写死掩盖)', ()=>{
		expect(dstAwareZoneAt(BEIJING.lat, BEIJING.lng, '1988-07-15').offset).toBe('+09:00');
		expect(dstAwareZoneAt(BEIJING.lat, BEIJING.lng, '1988-12-15').offset).toBe('+08:00');
	});

	test('归并后的新疆同样吃到 1986–1991 夏令时(1988-07 → +09:00)', ()=>{
		expect(dstAwareZoneAt(URUMQI.lat, URUMQI.lng, '1988-07-15').offset).toBe('+09:00');
	});

	test('上海 1945-07 → +09:00;台北 1979-07 → +09:00;香港 1978-07 → +08:00', ()=>{
		expect(dstAwareZoneAt(SHANGHAI.lat, SHANGHAI.lng, '1945-07-15').offset).toBe('+09:00');
		expect(dstAwareZoneAt(TAIPEI.lat, TAIPEI.lng, '1979-07-15').offset).toBe('+09:00');
		expect(dstAwareZoneAt(HONGKONG.lat, HONGKONG.lng, '1978-07-15').offset).toBe('+08:00');
	});

	test('存档已有 zone 优先沿用,不被归并覆盖', ()=>{
		expect(resolveGeoZone({ zone: '+06:00', gpsLat: URUMQI.lat, gpsLng: URUMQI.lng }, '1995-11-02')).toBe('+06:00');
		expect(resolveGeoZone({ gpsLat: URUMQI.lat, gpsLng: URUMQI.lng }, '1995-11-02')).toBe('+08:00');
	});

	test('AI 工具 resolveZone 乌鲁木齐 → dst-aware +08:00 并带 advisory', ()=>{
		const z = resolveZone({ gpsLat: URUMQI.lat, gpsLon: URUMQI.lng, dateStr: '1995-11-02' });
		expect(z.source).toBe('dst-aware');
		expect(z.zone).toBe('+08:00');
		expect(z.advisory).toBe('cn-unified');
	});

	test('kill-switch horosa.tz.cnUnified=0 → 回到纯地理时区 +06:00', ()=>{
		localStorage.setItem('horosa.tz.cnUnified', '0');
		try{
			const u = dstAwareZoneAt(URUMQI.lat, URUMQI.lng, '1995-11-02');
			expect(u.offset).toBe('+06:00');
			expect(u.advisory).toBeFalsy();
		}finally{
			localStorage.removeItem('horosa.tz.cnUnified');
		}
	});
});
