import moment from 'moment';
import * as AstroConst from '../../constants/AstroConst';
import {
	DECENNIAL_HEPHAISTIO_DAY_TABLE,
	DECENNIAL_DAY_METHOD_HEPHAISTIO,
	DECENNIAL_DAY_METHOD_VALENS,
	DECENNIAL_CALENDAR_TRADITIONAL,
	DECENNIAL_CALENDAR_ACTUAL,
	DECENNIAL_PLANET_BASE_MONTHS,
	DECENNIAL_ORDER_CHALDEAN,
	DECENNIAL_ORDER_ZODIACAL,
	DECENNIAL_START_MODE_SECT_LIGHT,
	DECENNIAL_TRADITIONAL_PLANETS,
	buildDecennialTimeline,
	getDecennialCalendarLabel,
	getDecennialDisplayText,
} from '../decennials';

function buildChart(order, extra = {}){
	const lons = {};
	order.forEach((planet, idx)=>{
		lons[planet] = 10 + idx * 10;
	});
	return {
		params: {
			birth: '1984-01-23 00:00:00',
			zone: '+00:00',
			...(extra.params || {}),
		},
		chart: {
			isDiurnal: true,
			objects: DECENNIAL_TRADITIONAL_PLANETS.map((planet)=>({
				id: planet,
				lon: lons[planet],
			})),
			...(extra.chart || {}),
		},
	};
}

function daysBetween(node){
	return node.endText && node.startText
		? moment.utc(node.endText, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD'], true)
			.diff(moment.utc(node.startText, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD'], true), 'days', true)
		: 0;
}

function minutesBetween(node){
	return node.endText && node.startText
		? moment.utc(node.endText, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD'], true)
			.diff(moment.utc(node.startText, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD'], true), 'minutes', true)
		: 0;
}

describe('decennials timing', ()=>{
	let nowSpy = null;

	beforeAll(()=>{
		nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2000-01-01T00:00:00Z').getTime());
	});

	afterAll(()=>{
		nowSpy.mockRestore();
	});

	test('builds zodiacal decennials from the sect light and shows HH:mm on L4', ()=>{
		const chartObj = buildChart([
			AstroConst.SUN,
			AstroConst.MERCURY,
			AstroConst.SATURN,
			AstroConst.VENUS,
			AstroConst.MARS,
			AstroConst.JUPITER,
			AstroConst.MOON,
		]);
		const timeline = buildDecennialTimeline(chartObj, {
			startMode: DECENNIAL_START_MODE_SECT_LIGHT,
			orderType: DECENNIAL_ORDER_ZODIACAL,
			dayMethod: DECENNIAL_DAY_METHOD_VALENS,
		});

		expect(timeline.resolvedStartPlanet).toBe(AstroConst.SUN);
		expect(timeline.list[0].planet).toBe(AstroConst.SUN);
		expect(timeline.list[0].date).toBe('1984-01-23 - 1994-08-28');
		expect(timeline.list[0].nominal).toBe('0个月 - 10年9个月');
		expect(getDecennialDisplayText(timeline.list[0], DECENNIAL_CALENDAR_TRADITIONAL))
			.toBe('1984-01-23 - 1994-08-28（名义：0个月 - 10年9个月）');
		expect(getDecennialDisplayText(timeline.list[0], DECENNIAL_CALENDAR_ACTUAL)).toBe('1984-01-23 - 1994-08-28');
		expect(timeline.list[0].sublevel.map((item)=>item.planet)).toEqual([
			AstroConst.SUN,
			AstroConst.MERCURY,
			AstroConst.SATURN,
			AstroConst.VENUS,
			AstroConst.MARS,
			AstroConst.JUPITER,
			AstroConst.MOON,
		]);
		expect(timeline.list[0].sublevel[0].nominal).toBe('0个月 - 1年7个月');
		expect(timeline.list[0].sublevel[0].sublevel[0].sublevel[0].date)
			.toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
		expect(timeline.list[0].sublevel[0].sublevel[0].sublevel[0].nominal)
			.toMatch(/^\d+天 \d{2}:\d{2} - \d+天 \d{2}:\d{2}$/);
	});

	test('uses concrete dates for both calendar modes and stretches the actual-year mode', ()=>{
		const chartObj = buildChart([
			AstroConst.SUN,
			AstroConst.MERCURY,
			AstroConst.SATURN,
			AstroConst.VENUS,
			AstroConst.MARS,
			AstroConst.JUPITER,
			AstroConst.MOON,
		]);
		const traditionalTimeline = buildDecennialTimeline(chartObj, {
			startMode: DECENNIAL_START_MODE_SECT_LIGHT,
			orderType: DECENNIAL_ORDER_ZODIACAL,
			dayMethod: DECENNIAL_DAY_METHOD_VALENS,
			calendarType: DECENNIAL_CALENDAR_TRADITIONAL,
		});
		const actualTimeline = buildDecennialTimeline(chartObj, {
			startMode: DECENNIAL_START_MODE_SECT_LIGHT,
			orderType: DECENNIAL_ORDER_ZODIACAL,
			dayMethod: DECENNIAL_DAY_METHOD_VALENS,
			calendarType: DECENNIAL_CALENDAR_ACTUAL,
		});
		const birth = moment.parseZone('1984-01-23 00:00:00 +00:00', 'YYYY-MM-DD HH:mm:ss Z', true);
		const actualEnd = birth.clone().add(3870 * 1461, 'minutes');

		expect(traditionalTimeline.list[0].date).toBe('1984-01-23 - 1994-08-28');
		expect(actualTimeline.list[0].date).toBe(
			`1984-01-23 - ${actualEnd.format('YYYY-MM-DD')}`
		);
		expect(actualTimeline.list[0].date).not.toBe(traditionalTimeline.list[0].date);
		expect(actualTimeline.list[0].sublevel[0].sublevel[0].sublevel[0].date)
			.toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	});

	test('uses the Hephaistio source table for Saturn month-lord days', ()=>{
		const chartObj = buildChart([
			AstroConst.SATURN,
			AstroConst.JUPITER,
			AstroConst.MARS,
			AstroConst.SUN,
			AstroConst.VENUS,
			AstroConst.MERCURY,
			AstroConst.MOON,
		]);
		const timeline = buildDecennialTimeline(chartObj, {
			startMode: AstroConst.SATURN,
			orderType: DECENNIAL_ORDER_CHALDEAN,
			dayMethod: DECENNIAL_DAY_METHOD_HEPHAISTIO,
		});

		const saturnMonth = timeline.list[0].sublevel[0];
		const mercuryDays = saturnMonth.sublevel[5];
		const birth = moment.parseZone('1984-01-23 00:00:00 +00:00', 'YYYY-MM-DD HH:mm:ss Z', true);
		const mercuryStart = birth.clone().add(210 + 84 + 105 + 133 + 56, 'days');
		const mercuryEnd = mercuryStart.clone().add(150, 'days');

		expect(saturnMonth.planet).toBe(AstroConst.SATURN);
		expect(saturnMonth.sublevel.map((item)=>item.planet)).toEqual([
			AstroConst.SATURN,
			AstroConst.JUPITER,
			AstroConst.MARS,
			AstroConst.SUN,
			AstroConst.VENUS,
			AstroConst.MERCURY,
			AstroConst.MOON,
		]);
		expect(mercuryDays.planet).toBe(AstroConst.MERCURY);
		expect(mercuryDays.date).toBe(
			`${mercuryStart.format('YYYY-MM-DD')} - ${mercuryEnd.format('YYYY-MM-DD')}`
		);
	});

	test('exports the full Hephaistio day table exactly as documented', ()=>{
		expect(DECENNIAL_HEPHAISTIO_DAY_TABLE).toEqual({
			[AstroConst.SATURN]: {
				[AstroConst.SATURN]: 210,
				[AstroConst.JUPITER]: 84,
				[AstroConst.MARS]: 105,
				[AstroConst.SUN]: 133,
				[AstroConst.VENUS]: 56,
				[AstroConst.MERCURY]: 150,
				[AstroConst.MOON]: 175,
			},
			[AstroConst.JUPITER]: {
				[AstroConst.JUPITER]: 34,
				[AstroConst.SATURN]: 85,
				[AstroConst.MARS]: 42,
				[AstroConst.SUN]: 54,
				[AstroConst.VENUS]: 22,
				[AstroConst.MERCURY]: 57,
				[AstroConst.MOON]: 71,
			},
			[AstroConst.MARS]: {
				[AstroConst.MARS]: 52,
				[AstroConst.SUN]: 66,
				[AstroConst.VENUS]: 28,
				[AstroConst.MERCURY]: 70,
				[AstroConst.MOON]: 87,
				[AstroConst.SATURN]: 105,
				[AstroConst.JUPITER]: 42,
			},
			[AstroConst.SUN]: {
				[AstroConst.SUN]: 83,
				[AstroConst.MOON]: 118,
				[AstroConst.SATURN]: 130,
				[AstroConst.JUPITER]: 52,
				[AstroConst.MARS]: 64,
				[AstroConst.VENUS]: 35,
				[AstroConst.MERCURY]: 87,
			},
			[AstroConst.VENUS]: {
				[AstroConst.VENUS]: 15,
				[AstroConst.SUN]: 36,
				[AstroConst.MOON]: 47,
				[AstroConst.SATURN]: 57,
				[AstroConst.JUPITER]: 22,
				[AstroConst.MARS]: 28,
				[AstroConst.MERCURY]: 38,
			},
			[AstroConst.MERCURY]: {
				[AstroConst.MERCURY]: 96,
				[AstroConst.SUN]: 90,
				[AstroConst.MOON]: 117,
				[AstroConst.SATURN]: 141,
				[AstroConst.JUPITER]: 56,
				[AstroConst.MARS]: 70,
				[AstroConst.VENUS]: 36,
			},
			[AstroConst.MOON]: {
				[AstroConst.MOON]: 148,
				[AstroConst.SUN]: 115,
				[AstroConst.SATURN]: 177,
				[AstroConst.JUPITER]: 71,
				[AstroConst.MARS]: 87,
				[AstroConst.VENUS]: 47,
				[AstroConst.MERCURY]: 119,
			},
		});
	});

	test('exports calendar labels for nominal and actual timing modes', ()=>{
		expect(getDecennialCalendarLabel(DECENNIAL_CALENDAR_TRADITIONAL)).toBe('360天/年（按30天/月换算）');
		expect(getDecennialCalendarLabel(DECENNIAL_CALENDAR_ACTUAL)).toBe('365.25天/年（按回归年换算）');
	});

	test('uses moon as the sect light for nocturnal charts and rotates chaldean order correctly', ()=>{
		const chartObj = buildChart(DECENNIAL_TRADITIONAL_PLANETS, {
			chart: {
				isDiurnal: false,
			},
		});
		const timeline = buildDecennialTimeline(chartObj, {
			startMode: DECENNIAL_START_MODE_SECT_LIGHT,
			orderType: DECENNIAL_ORDER_CHALDEAN,
			dayMethod: DECENNIAL_DAY_METHOD_VALENS,
		});

		expect(timeline.resolvedStartPlanet).toBe(AstroConst.MOON);
		expect(timeline.baseOrder).toEqual([
			AstroConst.MOON,
			AstroConst.SATURN,
			AstroConst.JUPITER,
			AstroConst.MARS,
			AstroConst.SUN,
			AstroConst.VENUS,
			AstroConst.MERCURY,
		]);
		expect(timeline.list.slice(0, 7).map((item)=>item.planet)).toEqual([
			AstroConst.MOON,
			AstroConst.SATURN,
			AstroConst.JUPITER,
			AstroConst.MARS,
			AstroConst.SUN,
			AstroConst.VENUS,
			AstroConst.MERCURY,
		]);
	});

	test('keeps Valens hierarchy durations internally consistent', ()=>{
		const chartObj = buildChart([
			AstroConst.VENUS,
			AstroConst.MOON,
			AstroConst.SUN,
			AstroConst.MERCURY,
			AstroConst.MARS,
			AstroConst.JUPITER,
			AstroConst.SATURN,
		], {
			params: {
				date: '1984-01-23',
				time: '12:34',
				birth: undefined,
				zone: '+08:00',
			},
		});
		const timeline = buildDecennialTimeline(chartObj, {
			startMode: AstroConst.VENUS,
			orderType: DECENNIAL_ORDER_ZODIACAL,
			dayMethod: DECENNIAL_DAY_METHOD_VALENS,
		});

		const l1 = timeline.list[0];
		expect(daysBetween(l1)).toBe(3870);
		expect(l1.sublevel).toHaveLength(7);
		expect(l1.sublevel.reduce((sum, item)=>sum + daysBetween(item), 0)).toBe(3870);

		l1.sublevel.forEach((l2)=>{
			expect(daysBetween(l2)).toBe(DECENNIAL_PLANET_BASE_MONTHS[l2.planet] * 30);
			const l2MinutesFromL4 = l2.sublevel.reduce(
				(sum, l3)=>sum + l3.sublevel.reduce((inner, l4)=>inner + minutesBetween(l4), 0),
				0
			);
			expect(l2MinutesFromL4).toBe(daysBetween(l2) * 24 * 60);
			l2.sublevel.forEach((l3)=>{
				expect(l3.date).toMatch(/^\d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}$/);
				expect(l3.sublevel.reduce((sum, item)=>sum + minutesBetween(item), 0)).toBeGreaterThan(0);
				l3.sublevel.forEach((l4)=>{
					expect(minutesBetween(l4)).toBeGreaterThanOrEqual(0);
					expect(l4.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
				});
			});
		});
	});
});
