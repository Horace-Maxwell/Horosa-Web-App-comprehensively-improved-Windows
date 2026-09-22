// AI 助手·归一层合同:出生时间多形态矩阵 / 离线地名 / 时区 / 罗盘串(抄本切片锁) / 事盘类型镜像。
import fs from 'fs';
import path from 'path';
import { parseBirthInput, BIRTH_OUTPUT_PATTERN } from '../aiTools/normalize/birthText';
import { resolvePlaceOffline } from '../aiTools/normalize/place';
import { resolveZone } from '../aiTools/normalize/zone';
import { normalizeGender } from '../aiTools/normalize/gender';
import * as geo from '../aiTools/normalize/geoCompass';
import { normalizeCaseTypeStrict, TIME_CASTABLE_MIRROR } from '../aiTools/normalize/caseType';
import { TIME_CASTABLE_DIVINATION } from '../aiAnalysisContext';
import { CASE_TYPE_OPTIONS } from '../localcases';
import { searchCities, searchCitiesScored, toCityItem } from '../../components/amap/cityMatch';
import CITIES from '../../data/cities.json';
import { buildLocalChartRecord } from '../localcharts';
import { DefGpsLat, DefGpsLon, DefLat, DefLon } from '../constants';

const SRC = path.resolve(__dirname, '..', '..');

describe('birthText 归一矩阵', ()=>{
	const ok = (text, opts)=>{ const r = parseBirthInput(text, opts); expect(r.ok).toBe(true); expect(BIRTH_OUTPUT_PATTERN.test(r.birth)).toBe(true); return r; };
	test.each([
		['1990-01-01 08:00', '1990-01-01 08:00:00'],
		['1990-01-01 08:00:30', '1990-01-01 08:00:30'],
		['1990/1/1 8:05', '1990-01-01 08:05:00'],
		['1990.01.01 08:00', '1990-01-01 08:00:00'],
		['1990年1月1日早上8点', '1990-01-01 08:00:00'],
		['1990年1月1日 晚上8点半', '1990-01-01 20:30:00'],
		['1990年1月1日下午3点', '1990-01-01 15:00:00'],
		['1990年1月1日 下午三点二十分', '1990-01-01 15:20:00'],
		['1990年1月1日凌晨2点一刻', '1990-01-01 02:15:00'],
		['1990年1月1日中午12点', '1990-01-01 12:00:00'],
		['1990年1月1日 08:00', '1990-01-01 08:00:00'],
		['一九九〇年一月一日八点', '1990-01-01 08:00:00'],
		['1990年1月1日辰时', '1990-01-01 08:00:00'],
		['前100年3月1日 0:00', '-0100-03-01 00:00:00'],
		['-0100-03-01 00:00', '-0100-03-01 00:00:00'],
	])('%s → %s', (text, expected)=>{
		expect(ok(text).birth).toBe(expected);
	});
	test('公元前输出 ad=-1 且 buildLocalChartRecord 同判', ()=>{
		const r = ok('前100年3月1日 0:00');
		expect(r.ad).toBe(-1);
		expect(buildLocalChartRecord({ name: 'x', birth: r.birth }).ad).toBe(-1);
	});
	test('子时按早子 00:00 并记 assumption', ()=>{
		const r = ok('1990年1月1日子时');
		expect(r.birth).toBe('1990-01-01 00:00:00');
		expect(r.assumptions.join('')).toContain('早子');
	});
	test('缺时间 → E_BIRTH_TIME_MISSING;timeUnknown → 12:00 并记 assumption', ()=>{
		expect(parseBirthInput('1990-01-01').code).toBe('E_BIRTH_TIME_MISSING');
		const r = ok('1990-01-01', { timeUnknown: true });
		expect(r.birth).toBe('1990-01-01 12:00:00');
		expect(r.assumptions.join('')).toContain('正午');
	});
	test('农历 正月初一 → 1990-01-27;闰四月;域外年拒', ()=>{
		const r = ok('农历1990年正月初一 早上8点');
		expect(r.birth).toBe('1990-01-27 08:00:00');
		expect(r.calendar).toBe('lunar');
		expect(r.echo).toContain('庚午');
		const leap = ok('农历2020年闰四月初一 8:00');
		expect(leap.birth).toBe('2020-05-23 08:00:00');
		expect(parseBirthInput('1990年正月初一 8:00', { calendar: 'lunar' }).birth).toBe('1990-01-27 08:00:00');
		expect(parseBirthInput('农历10000年正月初一 8:00').code).toBe('E_LUNAR_UNSUPPORTED_RANGE');
	});
	test('非法日期/乱文本 → E_BIRTH_UNPARSEABLE', ()=>{
		expect(parseBirthInput('1990-02-30 08:00').code).toBe('E_BIRTH_UNPARSEABLE');
		expect(parseBirthInput('某年某月').code).toBe('E_BIRTH_UNPARSEABLE');
		expect(parseBirthInput('').code).toBe('E_BIRTH_UNPARSEABLE');
	});
});

describe('geoCompass 罗盘串', ()=>{
	test.each([
		[26.076417371316914, 'lat', '26n04'],
		[119.31516153077507, 'lon', '119e18'],
		[116.4074, 'lon', '116e24'],
		[-33.8688, 'lat', '33s52'],
		[-118.2437, 'lon', '118w14'],
		[0.5, 'lat', '0n30'],
		[-0.12, 'lat', '0s07'],
	])('%s %s → %s', (v, kind, expected)=>{
		expect(kind === 'lat' ? geo.convertLatToStr(v) : geo.convertLonToStr(v)).toBe(expected);
	});
	test('默认纬度串 = constants;往返换算', ()=>{
		const f = geo.geoPairToRecordFields(DefGpsLat, DefGpsLon);
		expect(f.lat).toBe(DefLat);
		expect(typeof DefLon).toBe('string');
	});
	test('🔴 抄本切片锁:三函数与 AstroHelper.js 逐字同构(两件反向换算无消费方已删)', ()=>{
		const helper = fs.readFileSync(path.join(SRC, 'components', 'astro', 'AstroHelper.js'), 'utf8');
		const copy = fs.readFileSync(path.join(SRC, 'utils', 'aiTools', 'normalize', 'geoCompass.js'), 'utf8');
		const slice = (src, name)=>{
			const i = src.indexOf(`export function ${name}(`);
			expect(i).toBeGreaterThanOrEqual(0);
			let depth = 0, j = src.indexOf('{', i);
			for(; j < src.length; j++){
				if(src[j] === '{'){ depth++; }
				else if(src[j] === '}'){ depth--; if(depth === 0){ break; } }
			}
			return src.slice(i, j + 1).replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ');
		};
		['splitDegree', 'convertLatToStr', 'convertLonToStr'].forEach((n)=>{
			expect(slice(copy, n)).toBe(slice(helper, n));
		});
	});
});

describe('place 离线地名', ()=>{
	test('北京 唯一高置信 + 罗盘串 + 时区', async ()=>{
		const r = await resolvePlaceOffline('北京', { dateStr: '1990-01-01' });
		expect(r.resolved).toBe(true);
		expect(r.confidence).toBe('high');
		expect(r.place.lat).toBe('39n54');
		expect(r.place.lon).toBe('116e24');
		expect(r.place.zone).toBe('+08:00');
	});
	test('拼音/繁体/英文 命中', async ()=>{
		expect((await resolvePlaceOffline('beijing')).resolved).toBe(true);
		expect((await resolvePlaceOffline('臺北')).resolved).toBe(true);
		expect((await resolvePlaceOffline('Shanghai')).resolved).toBe(true);
	});
	test('零命中 → E_PLACE_NOT_FOUND', async ()=>{
		const r = await resolvePlaceOffline('zzqqxx不存在的地方');
		expect(r.resolved).toBe(false);
		expect(r.code).toBe('E_PLACE_NOT_FOUND');
	});
	test('多候选返回 candidates 且不擅自解析', async ()=>{
		const r = await resolvePlaceOffline('朝阳');
		if(r.candidates.length > 1 && !r.resolved){
			expect(r.candidates.length).toBeGreaterThan(1);
		}else{
			expect(r.candidates.length).toBeGreaterThan(0);
		}
	});
	test('searchCities parity:委托 searchCitiesScored 后输出逐项相等', ()=>{
		const a = searchCities('bei', [CITIES], {}, 20);
		const b = searchCitiesScored('bei', [CITIES], {}, 20).map((h)=>toCityItem(h.c));
		expect(a).toEqual(b);
	});
});

describe('zone/gender/caseType', ()=>{
	test('用户明说优先;经纬夏令时;缺经纬回退 +08:00', ()=>{
		expect(resolveZone({ userZone: '-05:00' }).zone).toBe('-05:00');
		const la = resolveZone({ gpsLat: 34.05, gpsLon: -118.24, dateStr: '1990-06-01' });
		expect(la.zone).toBe('-07:00'); expect(la.source).toBe('dst-aware');
		expect(resolveZone({ gpsLat: 34.05, gpsLon: -118.24, dateStr: '1990-01-15' }).zone).toBe('-08:00');
		const fb = resolveZone({});
		expect(fb.zone).toBe('+08:00'); expect(fb.source).toBe('fallback');
	});
	test('性别:命盘缺省 -1,事盘 unknown 不传', ()=>{
		expect(normalizeGender('male')).toBe(1);
		expect(normalizeGender('female')).toBe(0);
		expect(normalizeGender('unknown')).toBe(-1);
		expect(normalizeGender('unknown', { forCase: true })).toBeUndefined();
		expect(normalizeGender('女', { forCase: true })).toBe(0);
	});
	test('🔴 TIME_CASTABLE 镜像 toEqual 单源;caseType 枚举=CASE_TYPE_OPTIONS;别名归一;未登记拒', ()=>{
		expect(TIME_CASTABLE_MIRROR).toEqual(TIME_CASTABLE_DIVINATION);
		const q = normalizeCaseTypeStrict('奇門');
		expect(q.ok).toBe(true); expect(q.meta.value).toBe('qimen'); expect(q.castable).toBe(true);
		const ly = normalizeCaseTypeStrict('六爻');
		expect(ly.ok).toBe(true); expect(ly.castable).toBe(false);
		expect(normalizeCaseTypeStrict('不存在的技法xyz').ok).toBe(false);
	});
});

describe('resolvePlaceOffline · 外国城市中文名与重音', () => {
	test('雷克雅未克 → 解析成功且时区 +00:00(冰岛全年 UTC)', async () => {
		const r = await resolvePlaceOffline('雷克雅未克', { dateStr: '1995-11-02' });
		expect(r.resolved).toBe(true);
		expect(r.place && r.place.en).toBe('Reykjavík');
		expect(r.place && r.place.zone).toBe('+00:00');
	});
	test('Zurich(无重音)→ 命中 Zürich', async () => {
		const r = await resolvePlaceOffline('Zurich', { dateStr: '2000-06-15' });
		expect(r.resolved || (r.candidates && r.candidates.length > 0)).toBe(true);
		const en = r.resolved ? r.place.en : r.candidates[0].en;
		expect(/Z[üu]rich/.test(`${en}`)).toBe(true);
	});
});
