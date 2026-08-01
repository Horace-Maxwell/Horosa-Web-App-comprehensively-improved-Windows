// 吠陀世运 golden:九主机制/Vimshottari 120 恒等/宿宽 800′ 余额/KP 243/云之孕 195/
// 七潮盘蛇行/Muntha/星期主。
import {
	VARA_LORDS, NAVANAYAKA_OFFICES, VIMSHOTTARI_SEQ, vimshottariFromMoon, kpSubLordAt,
	buildSaptaNadi, SAPTA_NADI_COLS, garbhaDeliveryDate, GARBHA_CONST, munthaSign, varaLordOf,
	KURMA_MODERN, NAKSHATRA_27,
} from '../../divination/mundane/vedicMundane';

describe('九主与星期主', () => {
	test('九职齐备且事件锚正确:王=阴历年首、相=入白羊、军帅=入狮子、云主=入井宿区', () => {
		expect(NAVANAYAKA_OFFICES).toHaveLength(9);
		expect(NAVANAYAKA_OFFICES.find((o) => o.key === 'raja').event).toBe('lunar_new_year');
		expect(NAVANAYAKA_OFFICES.find((o) => o.key === 'mantri').event).toBe('ingress_0');
		expect(NAVANAYAKA_OFFICES.find((o) => o.key === 'senadhipati').event).toBe('ingress_120');
		expect(NAVANAYAKA_OFFICES.find((o) => o.key === 'meghadhipati').event).toBe('ingress_ardra');
	});
	test('星期主固定序:日月火水木金土;2026-07-24 为周五 → 金', () => {
		expect(VARA_LORDS).toEqual(['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn']);
		expect(varaLordOf('2026-07-24 12:00:00')).toBe('venus');
		expect(varaLordOf('2026-07-26 12:00:00')).toBe('sun');
	});
});

describe('Vimshottari 世运', () => {
	test('九主年数合 120;序 计金日月火罗木土水', () => {
		expect(VIMSHOTTARI_SEQ.reduce((s, p) => s + p.years, 0)).toBe(120);
		expect(VIMSHOTTARI_SEQ.map((p) => p.key)).toEqual(['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury']);
	});
	test('起运余额:月在宿首=全额;宿中点=半额;主=宿序 mod 9', () => {
		const atStart = vimshottariFromMoon(0, '2000-01-01', 365.2425);       // 娄宿区首 → 计都
		expect(atStart.lordKey).toBe('ketu');
		expect(atStart.balanceRatio).toBeCloseTo(1, 9);
		const atMid = vimshottariFromMoon(13.3333333 / 2, '2000-01-01', 365.2425);
		expect(atMid.balanceRatio).toBeCloseTo(0.5, 5);
		const nak4 = vimshottariFromMoon(13.3333334 * 3 + 1, '2000-01-01', 365.2425);   // 第 4 宿 → 月
		expect(nak4.lordKey).toBe('moon');
	});
	test('大期时间轴:首期=余额年,after 首期 fromYear 递增;子期 9 段', () => {
		const r = vimshottariFromMoon(0, '2000-01-01', 365.2425);
		expect(r.periods).toHaveLength(9);
		expect(r.periods[0].spanYears).toBeCloseTo(7, 6);           // 计都全额 7
		expect(r.periods[1].fromYear).toBeGreaterThanOrEqual(2006);   // 2000+7 回归年,闰差 ±1 日跨年
		expect(r.periods[1].fromYear).toBeLessThanOrEqual(2007);
		expect(r.periods[0].subs).toHaveLength(9);
	});
});

describe('KP 副主(243=27×9)', () => {
	test('全黄道扫描 243 个不同副段;首段=宿主自身;半开区间', () => {
		const seen = new Set();
		for(let i = 0; i < 24300; i++){
			const r = kpSubLordAt(i * (360 / 24300));
			seen.add(r.subIndex);
		}
		expect(seen.size).toBe(243);
		const first = kpSubLordAt(0);
		expect(first.starLord).toBe('ketu');
		expect(first.subLord).toBe('ketu');   // 副序自本宿之主起
	});
	test('arc=(主年/120)×800′:计都首副段止于 46′40″(=0.7778°)', () => {
		const inKetu = kpSubLordAt(0.77);     // <46.67′ 仍计都
		const inVenus = kpSubLordAt(0.79);    // 越界入金星副
		expect(inKetu.subLord).toBe('ketu');
		expect(inVenus.subLord).toBe('venus');
	});
});

describe('天气农业与杂项', () => {
	test('云之孕 195 日:受孕 2025-12-01 → 产 2026-06-14', () => {
		expect(GARBHA_CONST.gestationDays).toBe(195);
		expect(garbhaDeliveryDate('2025-12-01')).toBe('2026-06-14');
	});
	test('七潮盘:7 列×4 宿=28(含第 28 宿);甘霖列蛇行首元素=第 9 宿(自昴起第 7)', () => {
		const cols = buildSaptaNadi();
		expect(cols).toHaveLength(7);
		cols.forEach((c) => expect(c).toHaveLength(4));
		expect(SAPTA_NADI_COLS[6].key).toBe('amrta');
		expect(cols[6][0]).toBe(NAKSHATRA_27[8]);   // 蛇行:第 7 个(0-based i=6)落列 6
	});
	test('Muntha 年进一座;龟形分野只录古籍已给数例(5)', () => {
		expect(munthaSign('aries', 0)).toBe('aries');
		expect(munthaSign('aries', 13)).toBe('taurus');
		expect(munthaSign('scorpio', 3)).toBe('aquarius');
		expect(KURMA_MODERN).toHaveLength(5);
	});
});
