// 占星地图两个参考图层:纬圈按最长昼推纬度;日食路径 / 气候带进 AI 快照。
import fs from 'fs';
import path from 'path';
import {
	latitudeForLongestDay, longestDaySteps, climesLines, climesObliquity, PTOLEMY_OBLIQUITY,
	eclipseSummaryLines, climesSummaryLines, eclipseBandWidthKm,
} from '../acgLayers';
import { buildBands } from '../astroClassicalDerived';
import { setAcgSnapshot, clearAcgSnapshot, buildAcgSectionText } from '../acgSnapshot';

describe('纬圈纬度', ()=>{
	it('托勒密值下复出七气候带的经典纬度(13 时麦罗埃 16°27′、14 时下埃及 30°22′、15 时赫勒斯滂 40°56′)', ()=>{
		// 托勒密原表是弦表手算,和精确公式差几角分以内
		[[13, 16.45], [14, 30.37], [15, 40.93]].forEach(([hours, lat])=>{
			expect(Math.abs(latitudeForLongestDay(hours, PTOLEMY_OBLIQUITY) - lat)).toBeLessThan(0.1);
		});
	});
	it('12 时是赤道,24 时是极圈(90° − 黄赤交角)', ()=>{
		expect(latitudeForLongestDay(12, 23.44)).toBeCloseTo(0, 6);
		expect(latitudeForLongestDay(24, 23.44)).toBeCloseTo(90 - 23.44, 6);
	});
	it('超出 12~24 时或黄赤交角无效时不出纬度', ()=>{
		expect(latitudeForLongestDay(11.5, 23.44)).toBeNull();
		expect(latitudeForLongestDay(25, 23.44)).toBeNull();
		expect(latitudeForLongestDay(14, 0)).toBeNull();
	});
	it('纬圈步长(《至大论》卷二):12¼~18 时每 ¼ 时,18½~20 时每 ½ 时,21~24 时每时,共 32 条(加赤道即 33 圈)', ()=>{
		const steps = longestDaySteps();
		expect(steps[0]).toBe(12.25);
		expect(steps).toContain(18);
		expect(steps.slice(-8)).toEqual([18.5, 19, 19.5, 20, 21, 22, 23, 24]);
		expect(steps.length).toBe(32);
	});
	it('黄赤交角:改进取盘的值,经典取托勒密值,盘里没有时退到托勒密值', ()=>{
		expect(climesObliquity('date', 23.44)).toBe(23.44);
		expect(climesObliquity('ptolemy', 23.44)).toBe(PTOLEMY_OBLIQUITY);
		expect(climesObliquity('date', undefined)).toBe(PTOLEMY_OBLIQUITY);
	});
});

describe('气候带线', ()=>{
	it('七气候带:经典档中线就是古典页同一张表,改进档中线按黄赤交角由最长昼重推', ()=>{
		const classic = climesLines('klimata', 'ptolemy', 23.44).filter((row)=>row.kind === 'center');
		expect(classic.map((row)=>row.lat)).toEqual(buildBands().map((band)=>band.lat));
		const improved = climesLines('klimata', 'date', 23.44).filter((row)=>row.kind === 'center');
		buildBands().forEach((band, i)=>{ expect(improved[i].lat).toBeCloseTo(latitudeForLongestDay(band.longestDay, 23.44), 9); });
		expect(improved.every((row)=>row.lat > 0)).toBe(true);
	});
	it('非中心的全食 / 环食不说成偏食', ()=>{
		const text = eclipseSummaryLines({ ...ECLIPSE, type: 'annular', central: false, widthKm: null }).join('\n');
		expect(text).toContain('非中心食');
		expect(text).not.toContain('偏食没有中心线');
	});
	it('每带两条边界,夹住中线', ()=>{
		const rows = climesLines('klimata', 'ptolemy', 23.44);
		buildBands().forEach((band)=>{
			const edges = rows.filter((row)=>row.kind === 'edge' && row.band === band.n).map((row)=>row.lat).sort((a, b)=>a - b);
			expect(edges.length).toBe(2);
			expect(edges[0]).toBeLessThan(band.lat);
			expect(edges[1]).toBeGreaterThan(band.lat);
		});
	});
	it('纬圈两半球对称,关闭时没有线', ()=>{
		const rows = climesLines('parallels', 'date', 23.44);
		expect(rows.length).toBe(64);
		expect(rows.filter((row)=>row.lat < 0).length).toBe(32);
		expect(climesLines('off', 'date', 23.44)).toEqual([]);
	});
	it('换黄赤交角口径,纬圈纬度跟着变', ()=>{
		const a = climesLines('parallels', 'date', 23.44)[0].lat;
		const b = climesLines('parallels', 'ptolemy', 23.44)[0].lat;
		expect(a).not.toBeCloseTo(b, 4);
	});
});

const ECLIPSE = {
	which: 'prenatal', filter: 'any', jd: 2457987.27, daysFromBirth: -0.23, type: 'total', central: true,
	greatest: { lat: 36.97, lon: -87.67 }, magnitude: 1.0306, widthKm: 106,
	utc: '2017/08/21 18:25', local: '2017/08/21 13:25',
	track: [{ lat: 39.7, lon: -171.7 }, { lat: 11.0, lon: -27.4 }], north: [], south: [],
};

describe('日食摘要', ()=>{
	it('写出食型、时刻、食甚地点、带宽和路径起止', ()=>{
		const text = eclipseSummaryLines(ECLIPSE).join('\n');
		expect(text).toContain('出生前最近一次日食:全食');
		// local 是按出生盘时区折算的时刻,不是食甚地点的当地时间
		expect(text).toContain('2017/08/21 13:25(出生地时区)');
		expect(text).not.toContain('(当地)');
		expect(text).toContain('36.97°N 87.67°W');
		// 没有边界线时只能报本影直径,并注明是投影面上的量(不能读成地面带宽)
		expect(text).toContain('本影直径 106 km(投影面上的量,不是地面带宽)');
	});
	it('有两侧边界时报食甚处的地面带宽(2026-08-12:投影面 132 km,地面约 300 km)', ()=>{
		const e = {
			...ECLIPSE, widthKm: 132.46, greatest: { lat: 65.159, lon: -25.134 },
			north: [{ lat: 66.45, lon: -22.361 }, { lat: 65.88, lon: -22.188 }, { lat: 65.313, lon: -22.003 }, { lat: 64.75, lon: -21.809 }, { lat: 64.19, lon: -21.603 }],
			south: [{ lat: 66.011, lon: -28.903 }, { lat: 65.412, lon: -28.594 }, { lat: 64.817, lon: -28.28 }, { lat: 64.225, lon: -27.963 }, { lat: 63.636, lon: -27.64 }],
		};
		const w = eclipseBandWidthKm(e);
		expect(w).toBeGreaterThan(290);
		expect(w).toBeLessThan(305);
		const text = eclipseSummaryLines(e).join('\n');
		expect(text).toContain(`食甚处食带宽约 ${Math.round(w)} km(两侧边界之间的地面距离)`);
		expect(text).not.toContain('132 km');
		// 缺一侧边界算不出,退回本影直径
		expect(eclipseBandWidthKm({ ...e, south: [] })).toBeNull();
		expect(eclipseBandWidthKm({ ...e, central: false })).toBeNull();
		expect(text).toContain('中心线:39.70°N 171.70°W → 11.00°N 27.40°W');
	});
	it('偏食说明没有中心线', ()=>{
		const text = eclipseSummaryLines({ ...ECLIPSE, type: 'partial', central: false, widthKm: null }).join('\n');
		expect(text).toContain('偏食');
		expect(text).toContain('最大食分点轨迹');
		expect(text).not.toContain('km');
	});
	it('没有日食时不出行', ()=>{
		expect(eclipseSummaryLines(null)).toEqual([]);
	});
});

describe('进 AI 快照', ()=>{
	const data = { meta: { mode: 'mundo', coord: 'geo', obliquity: 23.4371 }, planets: { Sun: { lines: { mc: { lon: 10 }, ic: { lon: -170 } } } } };
	afterEach(()=>clearAcgSnapshot());
	it('日食路径随后端响应进,气候带开着才进', ()=>{
		setAcgSnapshot({ ...data, eclipse: ECLIPSE }, { climes: 'off' });
		let text = buildAcgSectionText();
		expect(text).toContain('◆ 日食路径');
		expect(text).not.toContain('气候带');
		setAcgSnapshot(data, { climes: 'klimata', climesObliquity: 'ptolemy' });
		text = buildAcgSectionText();
		expect(text).not.toContain('◆ 日食路径');
		expect(text).toContain('◆ 七气候带(黄赤交角 23.8556°,经典:托勒密值)');
		expect(text).toContain('第 1 带 · 麦罗埃 16.45°N');
	});
	it('纬圈只列北半球,改进档写出生时刻的黄赤交角', ()=>{
		setAcgSnapshot(data, { climes: 'parallels', climesObliquity: 'date' });
		expect(climesSummaryLines('parallels', 'date', 23.4371)[0]).toContain('23.4371°');
		const text = buildAcgSectionText();
		expect(text).toContain('◆ 托勒密纬圈');
		expect(text).not.toContain('°S');
	});
});

describe('七气候带地名', ()=>{
	it('第 6 带是中本都,博里斯提尼斯河口是第 7 带', ()=>{
		const bands = buildBands();
		expect(bands[5].cityCn).toBe('中本都');
		expect(bands[5].cityCn).not.toContain('博里斯提尼斯');
		expect(bands[6].cityCn).toBe('博里斯提尼斯河口');
		const labels = climesLines('klimata', 'ptolemy', 23.44).filter((row)=>row.kind === 'center').map((row)=>row.label);
		expect(labels[5]).toBe('第 6 带 · 中本都');
	});
	it('地图上中线标签画在标签层(压在行星线之上)并带底片,单双号错开经度', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../components/acg/AcgD3Map.js'), 'utf8');
		const body = src.slice(src.indexOf('drawClimes(data, th) {'), src.indexOf('drawEclipse(data, th) {'));
		expect(body).toContain('this.labelG.append');
		expect(body).toContain("attr('fill', th.chipBg)");
		expect(body).not.toContain("this.geoG.append('text')");
		expect(body).toMatch(/% 2 \? -172 : -112/);
	});
});
