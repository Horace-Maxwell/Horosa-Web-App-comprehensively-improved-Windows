// 命盘挂载的「盘面细节」段按细节页设置取数:设置一变,源层上下文缓存戳必须跟着变,否则挂载继续喂旧文
import { sourceContextCacheStamp } from '../aiAnalysisContext/catalog';
import { CHART_DETAIL_SETTINGS } from '../chartDetails';

describe('盘面细节设置进源层缓存签名', ()=>{
	beforeEach(()=>{ localStorage.clear(); });

	it('缺省设置不改签名;改了任一项签名就变', ()=>{
		const base = sourceContextCacheStamp();
		expect(base.formatVersion.startsWith('2:')).toBe(true);
		CHART_DETAIL_SETTINGS.save({ detailLunar: 'tithi' });
		const changed = sourceContextCacheStamp();
		expect(changed.calibreSig).not.toBe(base.calibreSig);
		expect(changed.calibreSig).toContain('lunarMethod');
		CHART_DETAIL_SETTINGS.save({ detailLunar: 'traditional' });
		expect(sourceContextCacheStamp().calibreSig).toBe(base.calibreSig);
	});
});

describe('盘面细节进 AI 正文:部分相位与非黄经中点(审计缺口:后端算了、AI 拿不到)', ()=>{
	const { buildChartDetailsText } = require('../chartDetails');
	const base = { persian: [], accidental: { rows: [] }, temperament: {}, dispositors: {}, sunPhases: [], sect: [], receptions: [], topics: [], hyleg: [], eminence: [], considerations: [], slavery: [], hellenistic: {}, patterns: [], hourAspects: { pairs: [] } };
	test('部分相位:同度投照命中逐对列一次(两向对称不重复)', ()=>{
		const bindhu = [
			{ point: 'Sun', sign: 0, degree: 7, a60: [2, 10], a90: [3, 9], a120: [4, 8], a180: [6] },
			{ point: 'Moon', sign: 4, degree: 7, a60: [6, 2], a90: [7, 1], a120: [8, 0], a180: [10] },
			{ point: 'Mars', sign: 4, degree: 9, a60: [6, 2], a90: [7, 1], a120: [8, 0], a180: [10] },
		];
		const text = buildChartDetailsText({ ...base, bindhu });
		const line = text.split('\n').find((l)=>l.startsWith('部分相位'));
		expect(line).toBeTruthy();
		expect((line.match(/拱/g) || []).length).toBe(1);
		expect(line).not.toContain('火星');
	});
	test('中点坐标选赤经时也写中点(此前整行不出)', ()=>{
		const text = buildChartDetailsText({ ...base, midpoints: { coord: 'ra', rows: [{ a: 'Sun', b: 'Moon', midpoint: 123.456 }] } });
		expect(text).toContain('中点(赤经,前 15 组):');
		expect(text).toContain('123.46°');
	});
});

describe('盘面细节五项挂载齿轮:记录上的值覆盖细节页保存值,逐项改变细节请求体(/astroextra/chartdetails)', ()=>{
	const { chartDetailSettingsFor, chartDetailRequestFields } = require('../chartDetails');
	const base = chartDetailRequestFields(chartDetailSettingsFor({}));
	[['detailFaces', 'element', 'detailFaces'], ['detailVariant', 'classic', 'variant'], ['detailLunar', 'tithi', 'lunarMethod'], ['detailMundo', 'placidus', 'mundoSystem'], ['detailMidpoint', 'ra', 'midpointCoord']].forEach(([gear, value, bodyKey])=>{
		test(`${gear}=${value} → 请求体 ${bodyKey} 变`, ()=>{
			const body = chartDetailRequestFields(chartDetailSettingsFor({ [gear]: value }));
			expect(body[bodyKey]).toBe(value);
			expect(base[bodyKey]).not.toBe(value);
		});
	});
	test('非法值不覆盖(回细节页保存值)', ()=>{
		expect(chartDetailRequestFields(chartDetailSettingsFor({ detailMundo: 'nope', detailFaces: 42 }))).toEqual(base);
	});
	test('两条挂载路径都按记录取细节设置', ()=>{
		const fs = require('fs');
		const path = require('path');
		const src = (f)=>fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext', f), 'utf8');
		expect(src('sourceContext.js')).toContain('fetchChartDerivedSections(params, chartDetailSettingsFor(record))');
		expect(src('techniqueContext.js')).toContain('fetchChartDerivedSections(params, chartDetailSettingsFor(record))');
	});
});
