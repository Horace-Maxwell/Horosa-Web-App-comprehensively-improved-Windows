// IANA tzdb 2026b/2026c 前瞻覆盖表金标:系统 ICU 未收录的新立法规则必须由覆盖层兜住。
// 语义:生效日起恒定偏移;生效日前走 Intl 原生数据(历史零扰动)。
import { offsetForZoneAtDate, isDstActiveAt } from '../timezone';

describe('TZ_RULE_OVERRIDES(tzdb 2026b/2026c 前瞻覆盖)', () => {
	// —— 2026c:Alberta 永久 -06(模型化 2026-11-01 取消回落)——
	test('Edmonton 2026-12(旧规则会错给 -07)→ -06:00', () => {
		expect(offsetForZoneAtDate('America/Edmonton', '2026-12-01')).toBe('-06:00');
	});
	test('Edmonton 2027 全年恒 -06:00', () => {
		expect(offsetForZoneAtDate('America/Edmonton', '2027-01-15')).toBe('-06:00');
		expect(offsetForZoneAtDate('America/Edmonton', '2027-07-15')).toBe('-06:00');
	});
	test('Edmonton 2026-07(夏令 -06,生效日前走 Intl)→ -06:00', () => {
		expect(offsetForZoneAtDate('America/Edmonton', '2026-07-01')).toBe('-06:00');
	});
	test('Edmonton 2025-12(历史标准时)→ -07:00 零扰动', () => {
		expect(offsetForZoneAtDate('America/Edmonton', '2025-12-01')).toBe('-07:00');
	});

	// —— 2026b:British Columbia 永久 -07 ——
	test('Vancouver 2026-12(旧规则会错给 -08)→ -07:00', () => {
		expect(offsetForZoneAtDate('America/Vancouver', '2026-12-15')).toBe('-07:00');
	});
	test('Vancouver 2025-12(历史标准时)→ -08:00 零扰动', () => {
		expect(offsetForZoneAtDate('America/Vancouver', '2025-12-15')).toBe('-08:00');
	});

	// —— 2026c:摩洛哥+西撒哈拉 2026-09-20 起永久 +00 ——
	test('Casablanca 2026-10-01(旧规则会错给 +01)→ +00:00', () => {
		expect(offsetForZoneAtDate('Africa/Casablanca', '2026-10-01')).toBe('+00:00');
	});
	test('Casablanca 生效前一日 2026-09-19 仍 +01:00(走 Intl)', () => {
		expect(offsetForZoneAtDate('Africa/Casablanca', '2026-09-19')).toBe('+01:00');
	});
	test('El_Aaiun(西撒同规则)2027-01-01 → +00:00', () => {
		expect(offsetForZoneAtDate('Africa/El_Aaiun', '2027-01-01')).toBe('+00:00');
	});

	// —— 收敛性:永久制次年冬夏同偏移 → isDstActiveAt=false ——
	test('Edmonton 2027(冬夏同 -06)不再判为夏令时', () => {
		expect(isDstActiveAt('America/Edmonton', '2027-07-15')).toBe(false);
	});

	// —— 未覆盖时区完全不受影响 ——
	test('北京/洛杉矶等未覆盖时区走 Intl 原生', () => {
		expect(offsetForZoneAtDate('Asia/Shanghai', '2026-12-01')).toBe('+08:00');
		expect(offsetForZoneAtDate('America/Los_Angeles', '2026-07-01')).toBe('-07:00');
	});
});
