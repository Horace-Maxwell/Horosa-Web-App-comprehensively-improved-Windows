// 七政无头快照 / 挂载齿轮的宿度制口径 = 页面载入同一张盘时的口径:
// 记录缺 doubingSu28 → 荀爽距星(0)(页面载入时宿度制是新盘种子键,先复位到内建默认,记录里有才覆盖);
// 不回落本机七政仓(此前回落 → 同一张盘页面按荀爽、AI 按本机存的值)。显式存的按存的(0 是真实档位)。
import { resolveGuolaoFields } from '../aiAnalysisContext';
import { GUOLAO_DEFAULT_SU28_MODE } from '../../components/guolao/GuoLaoChartStyle';
import { effectiveMountBaseline, localStorageMountBaseline, mergeOptionsIntoRecord } from '../techniqueMountSettings';

const REC = { cid: 'c1', name: '审计', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };

beforeEach(()=>{ window.localStorage.clear(); });

it('🔴 record 缺 doubingSu28 → 荀爽距星(0),与新盘种子内建默认同值', ()=>{
	const f = resolveGuolaoFields({ ...REC });
	expect(f.doubingSu28.value).toBe(GUOLAO_DEFAULT_SU28_MODE);
	expect(GUOLAO_DEFAULT_SU28_MODE).toBe(0);
	const { newChartSeedInternalDefault } = require('../newChartSeeds');
	expect(newChartSeedInternalDefault('doubingSu28')).toBe(GUOLAO_DEFAULT_SU28_MODE);
});

it('🔴 record 缺 doubingSu28 + 本机七政仓存了 5 → 仍按 0(与页面载入一致,不回落本机仓)', ()=>{
	window.localStorage.setItem('horosaGuolaoSu28Mode', '5');
	expect(resolveGuolaoFields({ ...REC }).doubingSu28.value).toBe(0);
	expect(resolveGuolaoFields({ ...REC, doubingSu28: '' }).doubingSu28.value).toBe(0);
	// 挂载齿轮基线同口径:抽屉显示 0;选 5(恰等于本机仓)不被剪掉,写进记录
	expect(effectiveMountBaseline('guolao', { ...REC }).su28Mode).toBe(0);
	expect(mergeOptionsIntoRecord({ ...REC }, 'guolao', { su28Mode: 5 }).doubingSu28).toBe(5);
	// 没有记录的场合(全局设置面)仍读本机仓
	expect(localStorageMountBaseline('guolao').su28Mode).toBe(5);
});

it('record 显式存 0(荀爽距星)→ 仍按 0;存 3 → 3(存档优先于本机仓)', ()=>{
	window.localStorage.setItem('horosaGuolaoSu28Mode', '5');
	expect(resolveGuolaoFields({ ...REC, doubingSu28: 0 }).doubingSu28.value).toBe(0);
	expect(resolveGuolaoFields({ ...REC, doubingSu28: 3 }).doubingSu28.value).toBe(3);
	expect(effectiveMountBaseline('guolao', { ...REC, doubingSu28: 3 }).su28Mode).toBe(3);
});

it('七政其余随盘字段(恒星岁差 / 推变法 / 命主取法等)以记录同名键为基线:选「恰等于本机全局值」不被剪掉', ()=>{
	window.localStorage.setItem('horosaGuolaoAyanamsa', 'lahiri_icrc');
	const rec = { ...REC, doubingSu28: 4, guolaoAyanamsa: 'lahiri_1940' };
	expect(effectiveMountBaseline('guolao', rec).guolaoAyanamsa).toBe('lahiri_1940');
	expect(mergeOptionsIntoRecord(rec, 'guolao', { guolaoAyanamsa: 'lahiri_icrc' }).guolaoAyanamsa).toBe('lahiri_icrc');
});

describe('七政其余起盘键:带随盘代次标记的记录缺键 = 出厂值(与页面载入同;此前 AI / 齿轮回落本机七政仓)', ()=>{
	const { GUOLAO_RECORD_FACTORY_DEFAULTS } = require('../../components/guolao/GuoLaoChartStyle');
	const { markFieldsCaptured, fieldsSchemaBaseline, applyRecordToFields } = require('../recordFieldsRestore');
	require('../../models/astro');
	it('出厂值表 == 新命盘字段初值(逐键)', ()=>{
		const base = fieldsSchemaBaseline();
		Object.keys(GUOLAO_RECORD_FACTORY_DEFAULTS).forEach((k)=>{
			expect(`${k}=${base[k] ? base[k].value : 'MISSING'}`).toBe(`${k}=${GUOLAO_RECORD_FACTORY_DEFAULTS[k]}`);
		});
	});
	it('🔴 本机七政仓存了别的命度 / 身宫:带标记的旧盘页面载入 = 出厂值,AI 字段与齿轮基线同', ()=>{
		window.localStorage.setItem('horosaGuolaoLifeMode', 'sun');
		window.localStorage.setItem('horosaGuolaoBodyMode', 'sun');
		const marked = markFieldsCaptured({ ...REC });
		const page = applyRecordToFields(fieldsSchemaBaseline(), marked);
		expect(page.guolaoLifeMode.value).toBe('asc');
		const f = resolveGuolaoFields(marked);
		expect(f.guolaoLifeMode.value).toBe('asc');
		expect(f.guolaoBodyMode.value).toBe('taiyin');
		expect(f.guolaoAyanamsa.value).toBe('');   // 岁差出厂空 → 构造器照旧取本机仓(与页面同)
		const base = effectiveMountBaseline('guolao', marked);
		expect(base.lifeMode).toBe('asc');
		expect(base.bodyMode).toBe('taiyin');
		expect(effectiveMountBaseline('guolao', { ...REC }).lifeMode).toBe('sun');   // 旧记录照旧取本机仓
		// 没标记的旧记录照旧(undefined → 构造器回落本机仓)
		expect(resolveGuolaoFields({ ...REC }).guolaoLifeMode.value).toBeUndefined();
	});
});
