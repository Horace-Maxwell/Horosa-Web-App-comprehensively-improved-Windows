// 年龄推进点四项口径:前端选项表与后端 agepoint.py 逐个相同;请求只带非出厂值;Java 代理白名单登记了全部请求键;快照写明口径与事件相位。
import fs from 'fs';
import path from 'path';
import {
	AP_METHODS, AP_EVENTS, AP_YEARS, AP_SPANS, AP_DEFAULTS,
	normalizeApSettings, apRequestParams, apSettingsLine, apAspectText,
} from '../agePointOptions';
import { DIST_DEFAULTS } from '../distributionsOptions';
import { agePointRequestBody, buildAgePointSnapshotFromResult } from '../../components/astro/AstroAgePoint';
import { DIRECTION_PAGE_SETTINGS } from '../directionPageSettings';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const PY = fs.readFileSync(path.resolve(__dirname, '../../../../astropy/astrostudy/agepoint.py'), 'utf8');
const JAVA = fs.readFileSync(path.resolve(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java'), 'utf8');
const pyTuple = (name) => {
	const m = new RegExp(`^${name} = \\(([^)]*)\\)$`, 'm').exec(PY);
	return m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
};

describe('年龄推进点 · 选项表与后端同一份', () => {
	test('推进方式 / 事件 / 年长 / 年限与 agepoint.py 逐个相同,出厂值相同', () => {
		expect(AP_METHODS.map((o) => o.value)).toEqual(pyTuple('METHODS'));
		expect(AP_EVENTS.map((o) => o.value)).toEqual(pyTuple('EVENTS'));
		expect(AP_SPANS.map(String)).toEqual(pyTuple('SPANS'));
		const years = /^YEAR_DAYS = \{([^}]*)\}/m.exec(PY)[1];
		AP_YEARS.forEach((o) => { expect(years).toContain(`'${o.value}': ${o.days}`); });
		expect(/^DEFAULT_METHOD = '([^']+)'/m.exec(PY)[1]).toBe(AP_DEFAULTS.apMethod);
		expect(/^DEFAULT_EVENTS = '([^']+)'/m.exec(PY)[1]).toBe(AP_DEFAULTS.apEvents);
		expect(/^DEFAULT_YEAR = '([^']+)'/m.exec(PY)[1]).toBe(AP_DEFAULTS.apYear);
		expect(Number(/^DEFAULT_SPAN = (\d+)/m.exec(PY)[1])).toBe(AP_DEFAULTS.apMaxAge);
	});
	test('页面保存键与挂载齿轮同键同值域', () => {
		const fields = getTechniqueSettingsSchema('agepoint').fields;
		Object.keys(AP_DEFAULTS).forEach((k) => {
			const f = fields.find((x) => x.name === k);
			expect([k, f.default]).toEqual([k, AP_DEFAULTS[k]]);
			expect([k, f.options.map((o) => o.value)]).toEqual([k, DIRECTION_PAGE_SETTINGS.schema[k].oneOf]);
		});
	});
	test('Java 代理白名单登记了年龄推进点与界推运的全部请求键(没登记的键会被静默丢掉)', () => {
		const m = /TECHNIQUE_OPTION_KEYS = new String\[\] \{([^}]*)\}/.exec(JAVA);
		const keys = m[1].split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean);
		[...Object.keys(AP_DEFAULTS), ...Object.keys(DIST_DEFAULTS)].forEach((k) => expect([k, keys.includes(k)]).toEqual([k, true]));
	});
});

describe('年龄推进点 · 请求与快照', () => {
	const chartObj = { params: { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n38', lon: '118e27' }, chart: { objects: [] } };
	test('出厂值不进请求体;非出厂值逐键带上;非法值回出厂', () => {
		const base = agePointRequestBody(chartObj, AP_DEFAULTS);
		Object.keys(AP_DEFAULTS).forEach((k) => expect(base[k]).toBeUndefined());
		expect(apRequestParams({ apMethod: 'equal5', apEvents: 'conj', apYear: 'sidereal', apMaxAge: 144 }))
			.toEqual({ apMethod: 'equal5', apEvents: 'conj', apYear: 'sidereal', apMaxAge: 144 });
		expect(normalizeApSettings({ apMethod: 'x', apEvents: 'y', apYear: 'z', apMaxAge: 9 })).toEqual(AP_DEFAULTS);
	});
	test('事件写法:合 / 左右六合四分三分 / 冲', () => {
		expect(apAspectText(0, '')).toBe('合');
		expect(apAspectText(60, 'S')).toBe('六合·左');
		expect(apAspectText(90, 'D')).toBe('四分·右');
		expect(apAspectText(180, '')).toBe('冲');
	});
	test('快照:首段写明四项口径;关键岁数与逐岁表带事件相位与日期', () => {
		const r = { agepoint: {
			settings: { apMethod: 'equal5', apEvents: 'full', apYear: 'sidereal', apMaxAge: 100 },
			points: [
				{ age: 0, date: '1990-05-18', sign: 'Leo', signlon: 4.05, house: 1 },
				{ age: 1, date: '1991-05-18', sign: 'Leo', signlon: 9.05, house: 1, aspectTo: 'Mars', aspectAge: 1.4, aspects: [{ aspectTo: 'Mars', aspectAge: 1.4, aspectType: 90, side: 'S' }] },
			],
			crossings: [{ age: 1.4, aspectTo: 'Mars', aspect: 90, side: 'S', apLon: 131.0, date: '1991-10-11' }],
		} };
		const txt = buildAgePointSnapshotFromResult(chartObj, r, {});
		expect(txt).toContain(apSettingsLine(r.agepoint.settings));
		expect(txt).toContain('关键岁数（精确穿越岁数）：1.4岁四分·左火(1991-10-11)');
		expect(txt).toContain('| 1岁 | 1991-05-18 | 狮子 9.05° | 1宫 | 四分·左火(1.4岁) |');
		expect(buildAgePointSnapshotFromResult(chartObj, { agepoint: { points: [] } }, {})).toBe('');
	});
});
