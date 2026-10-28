// 农历闰月只写一个「闰」:历法服务的 month 不带「闰」(另给 leap),本地历算的 month 已带「闰」(「闰六月」)、leap 也为真。
// 此前各处一律「leap ? '闰' : ''」拼在前面,收到本地结果时写成「闰闰六月」(八字页恒用本地历算;太乙盘头改取本地后也中)。
import { leapPrefix } from '../lunarText';
import { normalizeBackendPan } from '../../components/taiyi/TaiYiCalc';
import buildLocalBaziResult from '../baziLunarLocal';

test('单源:month 自带「闰」不再补;历法服务形态照补;非闰月不补', ()=>{
	expect(leapPrefix({ leap: true, month: '闰六月' })).toBe('');
	expect(leapPrefix({ leap: true, month: '六月' })).toBe('闰');
	expect(leapPrefix({ leap: false, month: '六月' })).toBe('');
	expect(leapPrefix(null)).toBe('');
});

test('🔴 2025-07-30(闰六月):太乙盘头农历行只有一个「闰」', ()=>{
	const r = buildLocalBaziResult({ date: '2025-07-30', time: '12:00:00', zone: '+08:00', lon: '116e28', lat: '39n54', gpsLat: 39.9, gpsLon: 116.46, gender: 1, timeAlg: 1 });
	expect(r.bazi.nongli.month).toBe('闰六月');
	const pan = normalizeBackendPan({ palace16: [] }, { timeBasis: 'direct' }, { year: '乙巳', month: '六月', day: '初六', leap: true }, r);
	expect(pan.lunarText).toContain('闰六月');
	expect(pan.lunarText).not.toContain('闰闰');
	const backendOnly = normalizeBackendPan({ palace16: [] }, { timeBasis: 'direct' }, { year: '乙巳', month: '六月', day: '初六', leap: true }, null);
	expect(backendOnly.lunarText).toBe('乙巳年闰六月初六');
});

test('各处农历行都走单源(不再就地拼「leap ? 闰」+ 中文月名)', ()=>{
	const fs = require('fs');
	const path = require('path');
	const files = ['components/ziwei/ZiWeiMain.js', 'components/ziwei/ZWCenterHouse.js', 'components/calendar/NongLiMain.js', 'components/jinkou/JinKouPanChart.js',
		'components/lrzhan/RengChart.js', 'components/cntradition/PaiBaZi.js', 'components/su28/HouseSuCenter.js', 'components/taiyi/TaiYiCalc.js', 'components/guazhan/GZChart.js',
		'components/cntradition/BaZi.js', 'components/cntradition/BaZiAppInfoPanel.js', 'components/cntradition/BaZiLegacyView.js', 'components/dunjia/DunJiaCalc.js',
		'components/taiyi/core/TaiYiCore.js', 'utils/aiTools/normalize/birthText.js', 'components/calendar/NongLiDate.js',
		'components/sanshi/SanshiUnitedBoard.js', 'components/sanshi/SanShiUnitedMain.js', 'divination/zeri/baziZeriConditionTypes.js'];
	files.forEach((rel)=>{
		const src = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
		// 三种就地拼法都不许:三元式、if 里赋值前缀「闰」、月名后再补「(闰)」
		expect([rel, /\.leap \? '闰' : ''/.test(src), /'闰' ?\+ ?\w|`闰\$\{/.test(src), /\(闰\)/.test(src)]).toEqual([rel, false, false, false]);
	});
	const { lunarMonthLabel } = require('../lunarText');
	expect(lunarMonthLabel({ leap: true, month: '闰六月' })).toBe('闰六月');
	expect(lunarMonthLabel({ leap: true, month: '六' })).toBe('闰六月');
	expect(lunarMonthLabel({ leap: false, month: '二月' })).toBe('二月');
	const bt = fs.readFileSync(path.join(__dirname, '..', 'aiTools', 'normalize', 'birthText.js'), 'utf8');
	expect(bt).not.toMatch(/\$\{leap \? '闰' : ''\}\$\{lunar\.getMonthInChinese\(\)\}/);   // getMonthInChinese 自带「闰」
});

describe('闰月月名自带「闰」的同类判据', ()=>{
	test('紫微跨年判据:本地历算给「闰冬月 / 闰腊月」时同样认作冬月 / 腊月', ()=>{
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../components/ziwei/ZWChart.js'), 'utf8');
		expect(src).toContain("let nongliM = `${this.chartObj.nongli.month || ''}`.replace(/^闰/, '');");
	});
	test('日期换算点日历格:闰月读出「农历闰六月…」', ()=>{
		const DateCalc = require('../../components/commtools/DateCalc').default;
		const DateTime = require('../../components/comp/DateTime').default;
		const inst = new DateCalc({});
		inst.state = { ...(inst.state || {}), destDate: new DateTime(), dateSelected: { birth: '2025-07-30 00:00:00', month: '六月', dayInt: '初六', leap: true } };
		expect(inst.genResultDom()).toContain('农历闰六月初六');
		inst.state = { ...inst.state, dateSelected: { birth: '2025-06-30 00:00:00', month: '六月', dayInt: '初六', leap: false } };
		expect(inst.genResultDom()).toContain('农历六月初六');
	});
});
