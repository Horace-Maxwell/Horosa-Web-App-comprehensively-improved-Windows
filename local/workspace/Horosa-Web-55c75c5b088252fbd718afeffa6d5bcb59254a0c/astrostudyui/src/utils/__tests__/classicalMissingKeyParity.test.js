// 古典口径键缺席时,AI 构造器 / 挂载齿轮基线 / 页面载入三方同一口径:
// 带随盘代次标记的盘缺键 = 出厂默认;早先没打标记的旧盘缺键 = 当前全局(页面沿用当前值)。界系 / 双子界序同此规则。
import { resolveGuolaoFields } from '../aiAnalysisContext';
import { effectiveMountBaseline, getTechniqueSettingsSchema, TECHNIQUE_SETTINGS_SCHEMA } from '../techniqueMountSettings';
import { setClassicalChartGlobal, CLASSICAL_GLOBAL_DEFAULTS } from '../classicalChartGlobals';
import { applyRecordToFields, RECORD_FIELDS_CAPTURE_MARK } from '../recordFieldsRestore';

const REC = { cid: 'local-1-x', name: 'T', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', gpsLat: 31.23, gpsLon: 121.47, gender: 1 };

describe('古典口径缺键三方同口径', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });
	afterEach(()=>{ setClassicalChartGlobal('vocMode', CLASSICAL_GLOBAL_DEFAULTS.vocMode); setClassicalChartGlobal('termsVariant', CLASSICAL_GLOBAL_DEFAULTS.termsVariant); });
	test('全局改成非默认:带标记的盘缺键 → 出厂默认(AI 构造器 / 齿轮基线 / 页面载入一致)', ()=>{
		setClassicalChartGlobal('vocMode', 'by_orb');
		setClassicalChartGlobal('termsVariant', 2);
		const marked = { ...REC, [RECORD_FIELDS_CAPTURE_MARK]: 1 };
		const f = resolveGuolaoFields(marked);
		expect(f.vocMode.value).toBe(CLASSICAL_GLOBAL_DEFAULTS.vocMode);
		expect(f.termsVariant.value).toBe(CLASSICAL_GLOBAL_DEFAULTS.termsVariant);
		const b = effectiveMountBaseline('astrochart', marked);
		expect(b.vocMode).toBe(CLASSICAL_GLOBAL_DEFAULTS.vocMode);
		expect(b.termsVariant).toBe(CLASSICAL_GLOBAL_DEFAULTS.termsVariant);
		const page = applyRecordToFields({ vocMode: { value: 'by_orb' }, termsVariant: { value: 2 } }, marked);
		expect(page.vocMode.value).toBe(CLASSICAL_GLOBAL_DEFAULTS.vocMode);
	});
	test('全局改成非默认:旧盘(没打标记)缺键 → 当前全局(三方一致)', ()=>{
		setClassicalChartGlobal('vocMode', 'by_orb');
		setClassicalChartGlobal('termsVariant', 2);
		const f = resolveGuolaoFields({ ...REC });
		expect(f.vocMode.value).toBe('by_orb');
		expect(f.termsVariant.value).toBe(2);
		const b = effectiveMountBaseline('astrochart', { ...REC });
		expect(b.vocMode).toBe('by_orb');
		expect(b.termsVariant).toBe(2);
	});
	test('每个技法齿轮里的古典口径键都锚全局现值(旧盘缺键随全局),与构造器同口径(主限法表格界系此前漏了)', ()=>{
		setClassicalChartGlobal('termsVariant', 1);
		const missing = [];
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((k)=>{
			const schema = getTechniqueSettingsSchema(k);
			(schema && schema.fields || []).forEach((fd)=>{
				if(Object.prototype.hasOwnProperty.call(CLASSICAL_GLOBAL_DEFAULTS, fd.name) && typeof fd.globalCurrent !== 'function'){ missing.push(`${k}.${fd.name}`); }
			});
		});
		expect(missing).toEqual([]);
		const f = resolveGuolaoFields({ ...REC });
		expect(f.termsVariant.value).toBe(1);
		expect(effectiveMountBaseline('primarydirect', { ...REC }).termsVariant).toBe(1);
		expect(effectiveMountBaseline('primarydirect', { ...REC, [RECORD_FIELDS_CAPTURE_MARK]: 1 }).termsVariant).toBe(CLASSICAL_GLOBAL_DEFAULTS.termsVariant);
	});
	test('记录里存了的按记录', ()=>{
		setClassicalChartGlobal('vocMode', 'by_orb');
		expect(resolveGuolaoFields({ ...REC, vocMode: 'kenodromia', [RECORD_FIELDS_CAPTURE_MARK]: 1 }).vocMode.value).toBe('kenodromia');
	});
});
