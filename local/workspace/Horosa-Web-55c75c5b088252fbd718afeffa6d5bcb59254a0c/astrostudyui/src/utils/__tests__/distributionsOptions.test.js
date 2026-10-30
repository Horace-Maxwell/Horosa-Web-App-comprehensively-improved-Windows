// 界推运四项口径:前端选项表与后端 distributions.py 逐个相同;请求只带非出厂值;快照写明口径与伙伴星期。
import fs from 'fs';
import path from 'path';
import {
	DIST_RELEASERS, DIST_METHODS, DIST_YEARS, DIST_SPANS, DIST_DEFAULTS,
	normalizeDistSettings, distRequestParams, distSettingsLine, partnerAspectText,
} from '../distributionsOptions';
import { distributionsRequestBody, buildDistributionsSnapshotFromResult } from '../../components/astro/AstroDistributions';
import { DIRECTION_PAGE_SETTINGS } from '../directionPageSettings';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const PY = fs.readFileSync(path.resolve(__dirname, '../../../../astropy/astrostudy/distributions.py'), 'utf8');
const pyTuple = (name) => {
	const m = new RegExp(`^${name} = \\(([\\s\\S]*?)\\)$`, 'm').exec(PY);
	return m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
};

describe('界推运 · 选项表与后端同一份', () => {
	test('发放点 / 时间算法 / 年长 / 年限与 distributions.py 逐个相同,出厂值相同', () => {
		expect(DIST_RELEASERS.map((o) => o.value)).toEqual(pyTuple('RELEASERS'));
		expect(DIST_METHODS.map((o) => o.value)).toEqual(pyTuple('METHODS'));
		expect(DIST_SPANS.map(String)).toEqual(pyTuple('SPANS'));
		const years = /^YEAR_DAYS = \{([^}]*)\}/m.exec(PY)[1];
		DIST_YEARS.forEach((o) => { expect(years).toContain(`'${o.value}': ${o.days === 365 ? '365.0' : o.days}`); });
		expect(/^DEFAULT_RELEASER = '([^']+)'/m.exec(PY)[1]).toBe(DIST_DEFAULTS.distReleaser);
		expect(/^DEFAULT_METHOD = '([^']+)'/m.exec(PY)[1]).toBe(DIST_DEFAULTS.distMethod);
		expect(/^DEFAULT_YEAR = '([^']+)'/m.exec(PY)[1]).toBe(DIST_DEFAULTS.distYear);
		expect(Number(/^DEFAULT_SPAN = (\d+)/m.exec(PY)[1])).toBe(DIST_DEFAULTS.distYears);
	});
	test('页面保存键与挂载齿轮同键同值域', () => {
		const fields = getTechniqueSettingsSchema('distributions').fields;
		Object.keys(DIST_DEFAULTS).forEach((k) => {
			const f = fields.find((x) => x.name === k);
			expect([k, f.default]).toEqual([k, DIST_DEFAULTS[k]]);
			expect([k, f.options.map((o) => o.value)]).toEqual([k, DIRECTION_PAGE_SETTINGS.schema[k].oneOf]);
		});
	});
});

describe('界推运 · 请求与快照', () => {
	const chartObj = { params: { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n38', lon: '118e27' }, chart: { objects: [] } };
	test('出厂值不进请求体(缺省请求与旧版逐字节相同);非出厂值逐键带上;非法值回出厂', () => {
		const base = distributionsRequestBody(chartObj, DIST_DEFAULTS);
		['distReleaser', 'distMethod', 'distYear', 'distYears'].forEach((k) => expect(base[k]).toBeUndefined());
		expect(distRequestParams({ distReleaser: 'Sun', distMethod: 'qisma', distYear: 'julian', distYears: 150 }))
			.toEqual({ distReleaser: 'Sun', distMethod: 'qisma', distYear: 'julian', distYears: 150 });
		expect(normalizeDistSettings({ distReleaser: 'X', distMethod: 'y', distYear: 'z', distYears: 7 })).toEqual(DIST_DEFAULTS);
		expect(distributionsRequestBody(chartObj, { distMethod: 'exact' }).distMethod).toBe('exact');
	});
	test('相位点写法:本体 / 左右六合四分三分 / 对冲', () => {
		expect(partnerAspectText(0, '')).toBe('本体');
		expect(partnerAspectText(90, 'D')).toBe('四分·右');
		expect(partnerAspectText(120, 'S')).toBe('三分·左');
		expect(partnerAspectText(180, '')).toBe('对冲');
	});
	test('快照:首段写明四项口径与发放点黄经;分配星期带起始岁 / 时长 / 期内伙伴;伙伴星期另成一段', () => {
		const r = {
			dist: [
				{ distributor: 'Venus', sign: 'Taurus', startYears: 0, years: 3.1, startDate: '1990-05-18 10:00:00', endDate: '1993-06-24 22:00:00', participants: ['Mars'], partnerDetail: [{ planet: 'Mars', aspect: 90, side: 'D' }] },
				{ distributor: 'Mercury', sign: 'Taurus', startYears: 3.1, years: 6.2, startDate: '1993-06-24 22:00:00', endDate: '1999-09-04 10:00:00', participants: [], partnerDetail: [] },
			],
			distSettings: { distReleaser: 'Sun', distMethod: 'exact', distYear: 'julian', distYears: 120, releaserLon: 57.25 },
			distPartners: [{ planet: 'Mars', aspect: 90, side: 'D', lon: 60.5, startYears: 1.2, years: 4, startDate: '1991-08-01 00:00:00', endDate: '1995-08-01 00:00:00' }],
		};
		const txt = buildDistributionsSnapshotFromResult(chartObj, r, {});
		expect(txt).toContain(distSettingsLine(r.distSettings));
		expect(txt).toContain('（黄经 57.25°）');
		expect(txt).toContain('| 金 | 金牛 | 0.00 | 3.10 | 1990-05-18 10:00:00 | 1993-06-24 22:00:00 | 火四分·右 |');
		expect(txt).toContain('[伙伴星期]');
		expect(txt).toContain('| 火 | 四分·右（60.50°） | 1.20 | 4.00 |');
		expect(buildDistributionsSnapshotFromResult(chartObj, { dist: [] }, {})).toBe('');
	});
});
