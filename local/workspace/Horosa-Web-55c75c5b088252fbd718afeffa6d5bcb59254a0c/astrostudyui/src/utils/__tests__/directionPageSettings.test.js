// 星运族排盘设置:写死的候选值必须与各组件自己的常量逐个相同(组件加了新档而这里没跟 = 那一档选了重开就丢)。
import fs from 'fs';
import path from 'path';
import { DIRECTION_PAGE_SETTINGS } from '../directionPageSettings';
import { MINOR_VARIANT_OPTIONS, DEFAULT_MINOR_VARIANT } from '../../components/astro/AstroProgChart';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('directionPageSettings', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	it('月长算法候选 = 组件常量;缺省同为标准朔望月', ()=>{
		expect(DIRECTION_PAGE_SETTINGS.schema.minorVariant.oneOf).toEqual(MINOR_VARIANT_OPTIONS.map((o)=>o.value));
		expect(DIRECTION_PAGE_SETTINGS.schema.minorVariant.def).toBe(DEFAULT_MINOR_VARIANT);
	});

	it('年数档 / 波斯向运速率与年数的候选 = 组件源码里的候选', ()=>{
		const ages = read('components/astro/AstroPlanetaryAges.js');
		const bands = []; const re = /\{ value: '([a-z]+)', label: '[^']+' \}/g; let m;
		const seg = ages.slice(ages.indexOf('const YEAR_BAND_OPTIONS'), ages.indexOf('];', ages.indexOf('const YEAR_BAND_OPTIONS')));
		while((m = re.exec(seg))){ bands.push(m[1]); }
		expect(DIRECTION_PAGE_SETTINGS.schema.yearBand.oneOf).toEqual(bands);
		const persian = read('components/astro/AstroPersianDirected.js');
		const rate = /const RATE = \{([^}]*)\}/.exec(persian)[1].split(',').map((x)=>x.split(':')[0].trim());
		expect(DIRECTION_PAGE_SETTINGS.schema.persianRateKey.oneOf).toEqual(rate);
		const years = /\{\[([0-9, ]+)\]\.map\(\(y\) => <Option value=\{y\}/.exec(persian)[1].split(',').map((x)=>Number(x.trim()));
		expect(DIRECTION_PAGE_SETTINGS.schema.persianMaxYears.oneOf).toEqual(years);
	});

	it('空库 = 各页原来的出厂值(零回归)', ()=>{
		expect(DIRECTION_PAGE_SETTINGS.load()).toEqual({
			nodeRetrograde: false, minorVariant: 'synodic', yearBand: 'least', triplicityDivision: 'thirds', triplicityLifespan: 75,
			ephemerisTransits: true, givenYearInverse: false, lunarReturnInverse: true, solarReturnInverse: true,
			persianRateKey: 'persian', persianDirection: 'direct', persianMaxYears: 90,
			decennialStartMode: 'sect_light', decennialOrderType: 'zodiacal', decennialDayMethod: 'valens', decennialCalendarType: 'calendar_360',
			profGrain: 'y', profStart: 'asc',
			balbillusStartPlanet: 'Sun', balbillusYearType: 'solar', balbillusMode: 'nearest', keypointsMode: 'soul',
		});
	});

	it('容许度与三分体系不在保留之列(初值另有全局 / 随盘来源)', ()=>{
		expect(DIRECTION_PAGE_SETTINGS.has('asporb')).toBe(false);
		expect(DIRECTION_PAGE_SETTINGS.has('system')).toBe(false);
	});
});
