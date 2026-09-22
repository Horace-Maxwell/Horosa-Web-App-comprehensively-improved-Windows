// [挂载自检 F-45] 印度占星 三旗盘/问事 Praśna:挂载齿轮(indiaTripataki/indiaPrashna*)→ buildFieldObject → fieldsToParams
// → 请求体必须带 tripataki=1 / prashnaTime…;此前无头不产这些键 → preset「Tripataki 宿距三旗」「问事 Praśna」对挂载恒死。
var mockBodies = [];
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async (url, opts) => { try{ mockBodies.push({ url: `${url}`, body: JSON.parse(opts.body) }); }catch(_e){ mockBodies.push({ url: `${url}`, body: opts && opts.body }); } return { Result: {} }; }) }));
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';
import { TECHNIQUE_SETTINGS_SCHEMA, effectiveMountBaseline, pruneOptionsToNonDefault } from '../techniqueMountSettings';
import * as AstroConst from '../../constants/AstroConst';

const REC = { cid: 'india-p', name: '印', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };
const flat = (o)=>JSON.stringify(o);

describe('印占 三旗/问事 挂载链', ()=>{
	it('🔴 record.indiaTripataki=1 + 问事三键 → 请求体带 tripataki/prashnaTime/prashnaSchools;缺省不带(零 churn)', async ()=>{
		mockBodies = [];
		await regenerateChartTechniqueSnapshot({ ...REC }, 'indiachart');
		const baseAll = flat(mockBodies);
		expect(baseAll).not.toContain('tripataki');
		expect(baseAll).not.toContain('prashna');
		mockBodies = [];
		await regenerateChartTechniqueSnapshot({ ...REC, indiaTripataki: 1, indiaPrashnaTime: '2026/05/15 10:12:00', indiaPrashnaNumber: 108, indiaPrashnaSchools: ['kp', 'tajika'], indiaPrashnaMatter: 'marriage' }, 'indiachart');
		const ovAll = flat(mockBodies);
		expect(ovAll).toContain('"tripataki":1');
		expect(ovAll).toContain('"prashnaTime":"2026/05/15 10:12:00"');
		expect(ovAll).toContain('"prashnaNumber":108');
		expect(ovAll).toContain('"prashnaSchools":"kp,tajika"');
		expect(ovAll).toContain('"prashnaMatter":"marriage"');
	});
	it('schema:七齿轮登记、缺省=页面缺省(schools kp / matter general / cuspMode asc_driven)、问事子键 showWhen 随起卦时刻', ()=>{
		const f = Object.fromEntries(TECHNIQUE_SETTINGS_SCHEMA.indiachart.fields.map((x)=>[x.name, x]));
		['indiaTripataki', 'indiaPrashnaTime', 'indiaPrashnaNumber', 'indiaPrashnaMatter', 'indiaPrashnaSchools', 'indiaPrashnaCuspMode', 'indiaPrashnaPrimaryHouse'].forEach((k)=>expect(f[k]).toBeTruthy());
		expect(f.indiaPrashnaSchools.default).toEqual(['kp']);
		expect(f.indiaPrashnaMatter.default).toBe(AstroConst.INDIA_PRASHNA_MATTER_DEFAULT);
		expect(f.indiaPrashnaCuspMode.default).toBe(AstroConst.INDIA_PRASHNA_CUSP_MODE_DEFAULT);
		expect(f.indiaPrashnaNumber.showWhen({ indiaPrashnaTime: '' })).toBe(false);
		expect(f.indiaPrashnaNumber.showWhen({ indiaPrashnaTime: '2026/05/15 10:12:00' })).toBe(true);
		// 缺省即现状:空覆盖剪空;拨三旗=覆盖
		const base = effectiveMountBaseline('indiachart', REC);
		expect(pruneOptionsToNonDefault('indiachart', { indiaTripataki: 0, indiaPrashnaSchools: ['kp'] }, base)).toEqual({});
		expect(pruneOptionsToNonDefault('indiachart', { indiaTripataki: 1 }, base)).toEqual({ indiaTripataki: 1 });
	});
});
