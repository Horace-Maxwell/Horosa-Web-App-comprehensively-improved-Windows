// [Q-105 裁决 2026-09-18]「按能算即能挂」:小限 G9 年/月/日小限摘要抽单源 → 页面 / 无头快照 / 齿轮三处同源。
import {
	deriveProfection, profectionDateTimesFromParams, buildProfectionSummaryLines,
	PROFECTION_GRAIN_OPTIONS, PROFECTION_START_OPTIONS,
} from '../profectionSummary';
import { buildPredictiveSnapshotText } from '../predictiveAiSnapshot';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import DateTime from '../../components/comp/DateTime';

const CHART = {
	chart: {
		isDiurnal: true,
		objects: [
			{ id: 'Sun', sign: 'Leo', lon: 130 },
			{ id: 'Moon', sign: 'Taurus', lon: 40 },
			{ id: 'Pars Fortuna', sign: 'Gemini', lon: 75 },
		],
		angles: [{ id: 'Asc', sign: 'Aries', lon: 10 }, { id: 'MC', sign: 'Capricorn', lon: 280 }],
		houses: [],
		aspects: [],
	},
	params: { date: '1990-05-18', time: '12:00:00', zone: '+08:00', lat: '31N14', lon: '121E28' },
};
const BASE_PARAMS = { date: '1990-05-18', time: '12:00:00', zone: '+08:00', dirZone: '+08:00', lat: '31N14', lon: '121E28', asporb: 1, nodeRetrograde: 0 };

describe('profectionSummary 单源', ()=>{
	it('deriveProfection:36 岁回上升(白羊·第1宫·主星火);字符串目标与 DateTime 目标同数', ()=>{
		const a = profectionDateTimesFromParams({ ...BASE_PARAMS, datetime: '2026-05-18 12:00' });
		expect(a.birthDt).toBeTruthy();
		expect(a.targetDt).toBeTruthy();
		const info = deriveProfection(a.birthDt, a.targetDt, 'y', 'asc', CHART);
		expect(info).toEqual(expect.objectContaining({ ageYears: 36, signIdx: 0, house: 1, rulerId: 'Mars', yearHouse: 1 }));
		const dt = new DateTime();
		dt.parse('2026-05-18 12:00:00', 'YYYY-MM-DD HH:mm:ss');
		dt.setZone('+08:00');
		const b = profectionDateTimesFromParams({ ...BASE_PARAMS, datetime: dt });
		expect(b.targetDt).toBe(dt);
		expect(deriveProfection(b.birthDt, b.targetDt, 'y', 'asc', CHART)).toEqual(info);
	});

	it('起点多源:区分光(昼=日→狮子)/福点/天顶;粒度 月/日 带年级参照', ()=>{
		const { birthDt, targetDt } = profectionDateTimesFromParams({ ...BASE_PARAMS, datetime: '2026-05-18 12:00' });
		expect(deriveProfection(birthDt, targetDt, 'y', 'sect', CHART).signIdx).toBe(4);     // Leo + 36 → Leo
		expect(deriveProfection(birthDt, targetDt, 'y', 'fortune', CHART).signIdx).toBe(2);  // Gemini
		expect(deriveProfection(birthDt, targetDt, 'y', 'mc', CHART).signIdx).toBe(9);       // Capricorn
		const lines = buildProfectionSummaryLines(CHART, { ...BASE_PARAMS, datetime: '2026-08-18 12:00' }, 'm', 'asc');
		expect(lines[0]).toMatch(/^月小限（自上升）：/);
		expect(lines.some((l)=>l.startsWith('年级参照：'))).toBe(true);
		expect(lines.some((l)=>/当年第 \d+ 月/.test(l))).toBe(true);
	});

	it('算不出(未排盘/缺目标)→ [];非法粒度/起点回落 年/上升', ()=>{
		expect(buildProfectionSummaryLines(null, { ...BASE_PARAMS, datetime: '2026-05-18 12:00' }, 'y', 'asc')).toEqual([]);
		expect(buildProfectionSummaryLines(CHART, { ...BASE_PARAMS }, 'y', 'asc')).toEqual([]);
		const lines = buildProfectionSummaryLines(CHART, { ...BASE_PARAMS, datetime: '2026-05-18 12:00' }, 'zzz', 'nope');
		expect(lines[0]).toMatch(/^年小限（自上升）：牡羊 · 第 1 宫/);
		expect(lines[1]).toBe('小限主星：火');
	});

	it('快照:profection 产 [小限摘要] 段(在 [起盘信息] 之后、[时段盘配置] 之前);solararc 不产', ()=>{
		const result = { chart: { objects: [], angles: [], houses: [], aspects: [] } };
		const txt = buildPredictiveSnapshotText(CHART, { ...BASE_PARAMS, datetime: '2026-05-18 12:00', profGrain: 'y', profStart: 'asc' }, result, 'profection');
		const i1 = txt.indexOf('[起盘信息]'); const i2 = txt.indexOf('[小限摘要]'); const i3 = txt.indexOf('[时段盘配置]');
		expect(i1).toBeGreaterThan(-1); expect(i2).toBeGreaterThan(i1); expect(i3).toBeGreaterThan(i2);
		expect(txt).toContain('年小限（自上升）：牡羊 · 第 1 宫（自上升所在星座起数）');
		// 齿轮缺省(undefined)= 页面缺省 年/上升 → 同字节
		const txt2 = buildPredictiveSnapshotText(CHART, { ...BASE_PARAMS, datetime: '2026-05-18 12:00' }, result, 'profection');
		expect(txt2).toBe(txt);
		// 起盘信息段不泄漏 profGrain/profStart 键名
		expect(txt).not.toMatch(/profGrain|profStart/);
		const sa = buildPredictiveSnapshotText(CHART, { ...BASE_PARAMS, datetime: '2026-05-18 12:00' }, result, 'solararc');
		expect(sa).not.toContain('[小限摘要]');
	});

	it('齿轮:profection 多 profGrain/profStart 两键(select,缺省 y/asc,选项与页面控件同源)', ()=>{
		const schema = getTechniqueSettingsSchema('profection');
		const fields = (schema && schema.fields) || [];
		const g = fields.find((f)=>f.name === 'profGrain'); const s = fields.find((f)=>f.name === 'profStart');
		expect(g).toBeTruthy(); expect(s).toBeTruthy();
		expect(g.type).toBe('select'); expect(s.type).toBe('select');
		expect(g.default).toBe('y'); expect(s.default).toBe('asc');
		expect(g.options).toBe(PROFECTION_GRAIN_OPTIONS); expect(s.options).toBe(PROFECTION_START_OPTIONS);
		expect((getTechniqueSettingsSchema('solararc').fields || []).some((f)=>f.name === 'profGrain')).toBe(false);
	});
});
