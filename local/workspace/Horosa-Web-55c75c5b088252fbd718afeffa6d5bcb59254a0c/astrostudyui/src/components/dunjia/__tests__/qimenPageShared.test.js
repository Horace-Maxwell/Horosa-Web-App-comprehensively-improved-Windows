// 奇门主页与三式合一页共用小工具单一来源 dunjia/qimenPageShared;盘头时间信息单一来源 DunJiaBoard.getBoardTimeInfo。
// 两页同口径自然成立(三式合一同步)。
import fs from 'fs';
import path from 'path';
import { clamp, safe, resolveCalcGeo, buildDisplaySolarParams, getNongliKey } from '../qimenPageShared';
import * as SanShi from '../../sanshi/SanShiUnitedMain';
import { getBoardTimeInfo } from '../DunJiaBoard';

const COMP = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(COMP, rel), 'utf8');

describe('qimenPageShared', ()=>{
	test('clamp / safe', ()=>{
		expect(clamp(5, 0, 3)).toBe(3);
		expect(clamp(-1, 0, 3)).toBe(0);
		expect(safe(undefined)).toBe('');
		expect(safe(null, '—')).toBe('—');
		expect(safe(0, 'x')).toBe(0);
	});
	test('计算地理:只取经纬与 GPS 经纬,缺省空串', ()=>{
		expect(resolveCalcGeo({ lon: { value: '120e00' }, lat: { value: '30n00' } }, { timeAlg: 1 })).toEqual({ lon: '120e00', lat: '30n00', gpsLon: '', gpsLat: '' });
		expect(resolveCalcGeo(null)).toEqual({ lon: '', lat: '', gpsLon: '', gpsLat: '' });
	});
	test('显示真太阳时参数强制 timeAlg=0;空入参回 null', ()=>{
		expect(buildDisplaySolarParams({ a: 1, timeAlg: 1 })).toEqual({ a: 1, timeAlg: 0 });
		expect(buildDisplaySolarParams(null)).toBe(null);
	});
	test('农历签名', ()=>{
		expect(getNongliKey(null)).toBe('');
		expect(getNongliKey({ yearGanZi: '丙午', monthGanZi: '庚寅', dayGanZi: '甲子', time: '甲子', jieqi: '立春', runyear: '' })).toBe('丙午|庚寅|甲子|甲子|立春|');
	});
	test('三式合一原有的 safe / clamp 导出仍在,且就是同一个函数', ()=>{
		expect(SanShi.safe).toBe(safe);
		expect(SanShi.clamp).toBe(clamp);
	});
	test('盘头时间信息:真太阳时 / 直接时间两行', ()=>{
		expect(getBoardTimeInfo({ realSunTime: '2026-01-02 03:04:05', dateStr: '2026-01-02', timeStr: '03:10:00' }))
			.toEqual({ dateText: '2026年01月02日', clockHm: '03:10', solarHm: '03:04' });
		expect(getBoardTimeInfo({ dateStr: '2026-01-02', timeStr: '03:10:00' }))
			.toEqual({ dateText: '2026年01月02日', clockHm: '03:10', solarHm: '03:10' });
		expect(getBoardTimeInfo(null)).toEqual({ dateText: '日期--', clockHm: '--:--', solarHm: '--:--' });
	});
});

describe('源码:两页改从单一来源取', ()=>{
	test('奇门主页 / 三式合一页不再各自定义', ()=>{
		[['dunjia/DunJiaMain.js', "from './qimenPageShared';"], ['sanshi/SanShiUnitedMain.js', "from '../dunjia/qimenPageShared';"]].forEach(([rel, imp])=>{
			const src = read(rel);
			expect(src).toContain(`import { clamp, safe, resolveCalcGeo, buildDisplaySolarParams, getNongliKey } ${imp}`);
			['clamp', 'safe', 'resolveCalcGeo', 'buildDisplaySolarParams', 'getNongliKey'].forEach((n)=>{
				expect(src).not.toMatch(new RegExp(`function ${n}\\(`));
			});
		});
		expect(read('sanshi/SanShiUnitedMain.js')).toContain('export { clamp, safe };');
	});
	test('奇门主页的盘头时间信息取自 DunJiaBoard', ()=>{
		const dj = read('dunjia/DunJiaMain.js');
		expect(dj).toContain("import DunJiaBoard, { getBoardTimeInfo } from './DunJiaBoard';");
		expect(dj).not.toContain('function getBoardTimeInfo(');
		expect(dj).not.toContain('function parseDisplayDateHm(');
		expect(read('dunjia/DunJiaBoard.js')).toContain('export function getBoardTimeInfo(pan){');
	});
});
