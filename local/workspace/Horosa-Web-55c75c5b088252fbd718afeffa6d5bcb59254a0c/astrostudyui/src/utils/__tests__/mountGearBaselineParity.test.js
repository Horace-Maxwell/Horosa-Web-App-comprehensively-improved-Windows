// 挂载齿轮「外层判已改」与「内层合并剪枝」同锚(同一个 effectiveMountBaseline),以及基线 = 构造器真正读的存档值:
// ① record 类技法:外层判为覆盖的每一项,合并后都真写进记录(不被内层二次剪掉);
// ② 太乙 / 三式合一流派六轴:存档是对象,基线按摊平值;③ 宿占事盘:平铺键缺席时读存档选项;
// ④ 显示条件与页面同判据(奇门家别 / 起局 / 盘式;空亡计三王星)。
import {
	TECHNIQUE_SETTINGS_SCHEMA, hasMountSettingsFields, effectiveMountBaseline, pruneOptionsToNonDefault,
	mergeOptionsIntoRecord, isMountFieldVisible, getTechniqueSettingsSchema,
} from '../techniqueMountSettings';
import { TAIYI_SCHOOL_OPTIONS } from '../../components/taiyi/core/taiyiSchool';

beforeEach(()=>{ window.localStorage.clear(); });

const REC = { cid: 'local-1-x', name: 'T', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', gpsLat: 31.23, gpsLon: 121.47, gender: 1 };

function nonDefaultValue(field){
	const opts = Array.isArray(field.options) ? field.options : [];
	const pick = opts.find((o)=>`${o.value}` !== `${field.default}` && o.value !== '' && o.value !== null && o.value !== undefined);
	return pick ? pick.value : undefined;
}

describe('① record 类:外层判已改的覆盖,内层合并一项不丢', ()=>{
	const recordKinds = Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((k)=>hasMountSettingsFields(k) && TECHNIQUE_SETTINGS_SCHEMA[k].kind === 'record');
	test('至少覆盖若干 record 类技法(判别力前提)', ()=>{ expect(recordKinds.length).toBeGreaterThan(5); });
	recordKinds.forEach((key)=>{
		test(`${key}`, ()=>{
			const schema = getTechniqueSettingsSchema(key);
			const base = effectiveMountBaseline(key, REC);
			const draft = {};
			schema.fields.forEach((f)=>{ const v = nonDefaultValue(f); if(v !== undefined){ draft[f.name] = v; } });
			const outer = pruneOptionsToNonDefault(key, draft, base);
			const merged = mergeOptionsIntoRecord(REC, key, outer);
			Object.keys(outer).forEach((name)=>{
				const f = schema.fields.find((x)=>x.name === name);
				const target = f && f.recordKey ? f.recordKey : name;
				expect([key, name, merged[target]]).toEqual([key, name, outer[name]]);
			});
		});
	});
});

describe('② 太乙 / 三式合一流派六轴:基线按存档对象摊平', ()=>{
	const ax = Object.keys(TAIYI_SCHOOL_OPTIONS).find((a)=>(TAIYI_SCHOOL_OPTIONS[a] || []).some((o)=>o.value !== 'default'));
	const v = TAIYI_SCHOOL_OPTIONS[ax].find((o)=>o.value !== 'default').value;
	test('独立太乙事盘 options.school 对象', ()=>{
		const rec = { ...REC, payload: JSON.stringify({ options: { style: 3, school: { [ax]: v } } }) };
		expect(effectiveMountBaseline('taiyi', rec)[`school_${ax}`]).toBe(v);
		// 拨回默认可表达(不被剪掉)
		expect(pruneOptionsToNonDefault('taiyi', { [`school_${ax}`]: 'default' }, effectiveMountBaseline('taiyi', rec))).toEqual({ [`school_${ax}`]: 'default' });
	});
	test('三式合一事盘 options.taiyiSchool 对象(options.school 是奇门盘式字符串,不串)', ()=>{
		const rec = { ...REC, payload: JSON.stringify({ options: { school: '飞盘', taiyiSchool: { [ax]: v } } }) };
		const b = effectiveMountBaseline('sanshiunited', rec);
		expect(b[`taiyiSchool_${ax}`]).toBe(v);
		expect(b.school).toBe('飞盘');
	});
});

describe('③ 宿占事盘:平铺键缺席时读存档选项', ()=>{
	test('houseStartMode 存在 payload.options', ()=>{
		const rec = { ...REC, payload: JSON.stringify({ options: { houseStartMode: 1 } }) };
		expect(Number(effectiveMountBaseline('suzhan', rec).houseStartMode)).toBe(1);
		expect(Number(effectiveMountBaseline('suzhan', { ...rec, houseStartMode: 0 }).houseStartMode)).toBe(0);
	});
	test('宿法同样从 payload.options 读(此前基线恒为 0:抽屉显示荀爽、选回荀爽被剪掉);命盘顶层带宿法的照用顶层', ()=>{
		const rec = { ...REC, payload: JSON.stringify({ options: { doubingSu28: 4 } }) };
		expect(Number(effectiveMountBaseline('suzhan', rec).doubingSu28)).toBe(4);
		expect(Number(effectiveMountBaseline('suzhan', { ...rec, doubingSu28: 1 }).doubingSu28)).toBe(1);
	});
});

describe('④ 显示条件与页面同判据', ()=>{
	const qm = getTechniqueSettingsSchema('qimen');
	const F = (n)=>qm.fields.find((f)=>f.name === n);
	const vis = (n, d)=>isMountFieldVisible(F(n), { paiPanType: 3, qijuMethod: 'zhirun', school: '转盘', shiftPalace: 0, feiMenZhongCan: 1, ...d }, qm);
	test('置闰天数:置闰 × 时家 / 刻家;报数:阴盘', ()=>{
		expect(vis('zhirunLeapDays', {})).toBe(true);
		expect(vis('zhirunLeapDays', { paiPanType: 4 })).toBe(true);
		expect(vis('zhirunLeapDays', { paiPanType: 0 })).toBe(false);
		expect(vis('zhirunLeapDays', { qijuMethod: 'chaibu' })).toBe(false);
		expect(vis('shuziReportNumber', {})).toBe(false);
		expect(vis('shuziReportNumber', { qijuMethod: 'shuzi' })).toBe(true);
	});
	test('家别专属项只在对应家别;值使只在转盘;移星值符只在移星开', ()=>{
		expect([vis('yueJiaQiJuType', {}), vis('yueJiaQiJuType', { paiPanType: 1 })]).toEqual([false, true]);
		expect([vis('yearJiaJu', {}), vis('yearJiaJu', { paiPanType: 0 })]).toEqual([false, true]);
		expect([vis('dayJiaJu', {}), vis('dayJiaJu', { paiPanType: 2 })]).toEqual([false, true]);
		expect([vis('keJiaFenDun', {}), vis('keZiZhengHuanShi', { paiPanType: 4 })]).toEqual([false, true]);
		expect([vis('jinhanMenPai', {}), vis('jinhanMenPai', { paiPanType: 6 })]).toEqual([false, true]);
		expect([vis('zhiShiType', {}), vis('zhiShiType', { school: '飞盘' })]).toEqual([true, false]);
		expect([vis('shiftZhiFuMode', {}), vis('shiftZhiFuMode', { shiftPalace: 2 })]).toEqual([false, true]);
	});
	test('飞盘四项只在飞盘 / 混合;中宫门位还要中门不参与;混合四层只在混合', ()=>{
		expect([vis('feiXingShun', {}), vis('feiXingShun', { school: '飞盘' }), vis('feiXingShun', { school: '混合' })]).toEqual([false, true, true]);
		expect([vis('feiMenZhongShow', { school: '飞盘' }), vis('feiMenZhongShow', { school: '飞盘', feiMenZhongCan: false })]).toEqual([false, true]);
		expect([vis('mixTian', { school: '飞盘' }), vis('mixTian', { school: '混合' })]).toEqual([false, true]);
	});
	test('三式合一的奇门子组同一判据(由奇门字段派生)', ()=>{
		const ss = getTechniqueSettingsSchema('sanshiunited');
		const f = ss.fields.find((x)=>x.name === 'zhirunLeapDays');
		expect(isMountFieldVisible(f, { paiPanType: 0, qijuMethod: 'zhirun' }, ss)).toBe(false);
		expect(isMountFieldVisible(f, { paiPanType: 3, qijuMethod: 'zhirun' }, ss)).toBe(true);
	});
	test('空亡计三王星:1647 与四座豁免档都不显示;六壬昼夜阳阴只在六壬法贵人', ()=>{
		const as = getTechniqueSettingsSchema('astrochart');
		const voc = as.fields.find((x)=>x.name === 'vocIncludeOuter');
		expect(['classic', 'exempt4', 'by_orb'].map((m)=>isMountFieldVisible(voc, { vocMode: m }, as))).toEqual([false, false, true]);
		const lr = getTechniqueSettingsSchema('liureng');
		const yy = lr.fields.find((x)=>x.name === 'yinyangSystem');
		expect([isMountFieldVisible(yy, { guireng: 2 }, lr), isMountFieldVisible(yy, { guireng: 0 }, lr)]).toEqual([false, true]);
	});
});
