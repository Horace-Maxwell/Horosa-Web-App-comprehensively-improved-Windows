// AI 挂载齿轮与技法页同一口径:档位(页面藏起 / 不开放 / 随另一项变的档)、值域、显示条件、旧值迁移与归一。
// 此前齿轮各自手写:列出页面没有的档、漏页面有的档、文本框对页面下拉、值形态不归一(布尔 vs 0/1)、显示条件缺失或判错。
import {
	getTechniqueSettingsSchema, isMountFieldVisible, mountFieldOptions, getTechniqueSettingsCurrentDefaults,
	flattenHoraryStored, HORARY_JUDGE_EMPTY, effectiveMountBaseline, pruneOptionsToNonDefault,
} from '../techniqueMountSettings';
import { clampTiebanKe } from '../tiebanFrameworkLocal';
import fs from 'fs';
import path from 'path';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const fieldOf = (key, name)=>{
	const schema = getTechniqueSettingsSchema(key);
	const f = schema && schema.fields.find((x)=>x.name === name);
	if(!f){ throw new Error(`${key}.${name} 不在齿轮里`); }
	return f;
};
const vals = (opts)=>opts.map((o)=>o.value);
const visible = (key, name, draft)=>{
	const schema = getTechniqueSettingsSchema(key);
	return isMountFieldVisible(fieldOf(key, name), { ...getTechniqueSettingsCurrentDefaults(key), ...(draft || {}) }, schema);
};

beforeEach(()=>{ window.localStorage.clear(); });

describe('档位:页面藏起的档不列,现值所在档照列', ()=>{
	test('🔴 八字「春分定卯时」、三式合一「太乙命法」', ()=>{
		const bz = fieldOf('bazi', 'timeAlg');
		expect(vals(mountFieldOptions(bz, {}, 0))).toEqual([0, 3, 1]);
		const ssStyle = fieldOf('sanshiunited', 'taiyiStyle');
		expect(vals(mountFieldOptions(ssStyle, {}, 3))).not.toContain(5);
	});
	test('六爻流派:「自定义」与不单列的旧流派只在现值是它时出现(带显示名,不露键名)', ()=>{
		const f = fieldOf('sixyao', 'school');
		expect(vals(mountFieldOptions(f, {}, 'default'))).not.toContain('custom');
		expect(vals(mountFieldOptions(f, {}, 'default'))).not.toContain('bushi');
		const withBushi = mountFieldOptions(f, {}, 'bushi');
		expect(withBushi.find((o)=>o.value === 'bushi').label).toMatch(/卜筮正宗/);
		expect(mountFieldOptions(f, {}, 'custom').find((o)=>o.value === 'custom').label).toBe('自定义');
	});
	test('🔴 奇门起局法随排盘体例:非时家刻家只有「本家默认 / 阴盘」,存的节气法回显为本家默认', ()=>{
		const f = fieldOf('qimen', 'qijuMethod');
		expect(vals(mountFieldOptions(f, { paiPanType: 3 }, 'chaibu'))).toEqual(['zhirun', 'chaibu', 'maoshan', 'wurun', 'shuzi']);
		const nianjia = mountFieldOptions(f, { paiPanType: 0 }, 'chaibu');
		expect(vals(nianjia)).toEqual(['zhirun', 'shuzi']);
		expect(nianjia.find((o)=>o.value === 'zhirun').label).toBe('本家默认');
		expect(f.displayValue('chaibu', { paiPanType: 0 })).toBe('zhirun');
		expect(f.displayValue('shuzi', { paiPanType: 0 })).toBe('shuzi');
	});
	test('铁板考刻刻位随刻制;地占补起盘后的两派;皇极方位含「中」', ()=>{
		const ke = fieldOf('tieban', 'tiebanKe');
		expect(vals(mountFieldOptions(ke, { tiebanKeSystem: 'qing8' }, 1))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(vals(mountFieldOptions(ke, { tiebanKeSystem: 'dou12' }, 1)).length).toBe(12);
		// 十二刻下选了十刻再切回八刻:引擎按初刻算 → 齿轮回显初刻、下拉不补回「十刻」;页面下拉同一判据
		expect(vals(mountFieldOptions(ke, { tiebanKeSystem: 'qing8' }, 10))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(ke.displayValue(10, { tiebanKeSystem: 'qing8' })).toBe(1);
		expect(ke.displayValue(10, { tiebanKeSystem: 'dou12' })).toBe(10);
		expect(clampTiebanKe(12, 'ming100')).toBe(1);
		const kin = fs.readFileSync(path.join(__dirname, '../../components/kinastro/KinAstroMain.js'), 'utf8');
		expect(kin).toContain('value={clampTiebanKe(this.state.tiebanKe, this.state.tiebanKeSystem)}');
		expect(kin).toContain('const ke = clampTiebanKe(this.state.tiebanKe, value);');
		expect(vals(fieldOf('geomancy', 'tradition').options)).toEqual(expect.arrayContaining(['greek', 'ifa']));
		expect(vals(fieldOf('huangji', 'direction').options)).toContain('中');
	});
	test('推运容许度与页面同一张档位表:弧类不列「双星容许度相加除以2」,补 5 度', ()=>{
		const { directionAsporbOptions } = require('../../constants/directionAspOrb');
		expect(vals(fieldOf('profection', 'asporb').options)).toEqual(vals(directionAsporbOptions(false)));
		expect(vals(fieldOf('solararc', 'asporb').options)).toEqual(vals(directionAsporbOptions(true)));
		expect(vals(fieldOf('planetaryarc', 'asporb').options)).not.toContain(-1);
		expect(vals(directionAsporbOptions(false))).toContain(5);
	});
	test('北极 / 南极 / 蠢子 / 邵子:档位与页面同一份表(值同页面,建除为库内繁体键);空档写明是后端缺省', ()=>{
		const ko = require('../../components/kinastro/kinastroOptions');
		const jianchu = fieldOf('nanji', 'nanjiJianchu');
		expect(vals(jianchu.options).slice(1)).toEqual(vals(ko.NANJI_JIANCHU_OPTIONS));
		expect(vals(jianchu.options)).toContain('滿');
		expect(jianchu.options[0].label).toMatch(/建/);
		expect(vals(fieldOf('nanji', 'nanjiChart').options).slice(1)).toEqual(vals(ko.NANJI_CHART_OPTIONS));
		expect(vals(fieldOf('chunzi', 'chunziResultLimit').options).slice(1)).toEqual(vals(ko.CHUNZI_RESULT_LIMIT_OPTIONS));
		expect(vals(fieldOf('shaozi', 'ke').options).slice(1)).toEqual(vals(ko.SHAOZI_KE_OPTIONS));
		expect(fieldOf('nanji', 'nanjiDegree')).toEqual(expect.objectContaining({ min: 0, max: 30 }));
	});
	test('值域与页面同:父母年龄 12–99、黄帝纪元差 0–16799、量化盘容许度、五兆报数 0–9', ()=>{
		expect(fieldOf('zhengchuan', 'zcFatherAge')).toEqual(expect.objectContaining({ min: 12, max: 99 }));
		expect(fieldOf('heluo', 'huangdiOffset')).toEqual(expect.objectContaining({ min: 0, max: 16799 }));
		expect(fieldOf('germany', 'orb')).toEqual(expect.objectContaining({ min: 0.5, max: 3, step: 0.5 }));
		expect(fieldOf('wuzhao', 'number')).toEqual(expect.objectContaining({ min: 0, max: 9 }));
	});
});

describe('页面已撤 / 页面没有的项:只在存档已是它时列出(照样生效)', ()=>{
	test('🔴 主限法表格:框架只列相位主限(存档是界行 / 释放照列);旧单维方位法只在非缺省时列', ()=>{
		const fw = fieldOf('primarydirect', 'pdFramework');
		expect(vals(mountFieldOptions(fw, {}, 'aspect'))).toEqual(['aspect']);
		expect(vals(mountFieldOptions(fw, {}, 'bounds'))).toEqual(['aspect', 'bounds']);
		const pm = fieldOf('primarydirect', 'pdMethod');
		expect(visible('primarydirect', 'pdMethod', {})).toBe(false);
		const other = pm.options.map((o)=>o.value).find((v)=>`${v}` !== `${pm.default}`);
		expect(visible('primarydirect', 'pdMethod', { pdMethod: other })).toBe(true);
		expect(visible('primarydirchart', 'pdMethod', {})).toBe(true);   // 主限盘页本身有「推运方法」
	});
	test('🔴 星盘强互容 / 简化相位 / 虚点接纳相位:没开过不列,开着的照列', ()=>{
		['strongRecption', 'simpleAsp', 'virtualPointReceiveAsp'].forEach((n)=>{
			expect(visible('astrochart', n, {})).toBe(false);
			expect(visible('astrochart', n, { [n]: 1 })).toBe(true);
		});
	});
	test('🔴 皇极「不算心易」、金口诀星占 / 遁甲法贵神:只在存档已是它们时列', ()=>{
		const xy = fieldOf('huangji', 'xinyiMethod');
		expect(vals(mountFieldOptions(xy, {}, 'datetime'))).not.toContain('none');
		expect(vals(mountFieldOptions(xy, {}, 'none'))).toContain('none');
		const gr = fieldOf('jinkou', 'guireng');
		expect(vals(mountFieldOptions(gr, {}, 0))).toEqual([0]);
		expect(vals(mountFieldOptions(gr, {}, 2))).toEqual([0, 2]);
	});
	test('🔴 南半球读法:北纬出生的盘置灰(已开着的不置灰),南纬 / 认不出纬度照常', ()=>{
		const sc = fieldOf('astrochart', 'southchart');
		expect(sc.disabledFor({ draft: { southchart: 0 }, record: { lat: '31n38' } })).toBe(true);
		expect(sc.disabledFor({ draft: { southchart: 1 }, record: { lat: '31n38' } })).toBe(false);
		expect(sc.disabledFor({ draft: { southchart: 0 }, record: { lat: '33s52' } })).toBe(false);
		expect(sc.disabledFor({ draft: { southchart: 0 }, record: { gpsLat: -33.8 } })).toBe(false);
		expect(sc.disabledFor({ draft: { southchart: 0 }, record: null })).toBe(false);
	});
});

describe('卜卦换流派:判读覆盖回随流派,「问谁的事 / 问者性别」保留(页面 / 齿轮 / 重算三处同一函数)', ()=>{
	const { keepQuestionScoped, HORARY_QUESTION_SCOPED_KEYS } = require('../../divination/horary/horarySchools');
	test('🔴 spec 标了这两项;helper 只留它们', ()=>{
		expect(HORARY_QUESTION_SCOPED_KEYS.sort()).toEqual(['personScope', 'querentGender']);
		expect(keepQuestionScoped({ personScope: 'spouse', querentGender: 'male', moonPromotion: 'apply' })).toEqual({ personScope: 'spouse', querentGender: 'male' });
	});
	test('🔴 齿轮草稿换派与剪枝基准:这两项不清,其余判读项回随流派', ()=>{
		const schema = getTechniqueSettingsSchema('horary');
		const draft = { horarySchool: 'classical', hp_personScope: 'spouse', hp_querentGender: 'female', hp_moonPromotion: 'apply' };
		const next = schema.onDraftChange(draft, 'horarySchool', 'modern');
		expect(next.hp_personScope).toBe('spouse');
		expect(next.hp_querentGender).toBe('female');
		expect(next.hp_moonPromotion).toBe('');
		const base = schema.adjustPruneBaseline({ horarySchool: 'classical', hp_personScope: 'child', hp_moonPromotion: 'apply' }, { horarySchool: 'modern' });
		expect(base.hp_personScope).toBe('child');
		expect(base.hp_moonPromotion).toBe('');
	});
	test('🔴 三处同用 helper(静态)', ()=>{
		const page = readSource('src/components/horary/HoraryMain.js');
		expect((page.match(/keepQuestionScoped\(/g) || []).length).toBeGreaterThanOrEqual(2);
		expect(page).not.toMatch(/setExtra\(\{[^}]*horaryOverrides:\s*\{\}/);
		expect(readSource('src/utils/aiAnalysisContext/regenHoraryElection.js')).toMatch(/gearSchoolChanged \? keepQuestionScoped\(ox\.horaryOverrides\)/);
		expect((readSource('src/utils/techniqueMountSettings.js').match(/!horaryJudgeFieldQuestionScoped\(f\)/g) || []).length).toBe(2);
	});
});

describe('量化盘齿轮换流派套该派预设(与页面 changeSchool 同表)', ()=>{
	test('🔴 全局原始汉堡,齿轮换宇宙生物学 → 1.5 / 5.0 / 六宫框关 / 严格因子关;选回随全局四项回空', ()=>{
		const { applyTechniqueDraftChange } = require('../techniqueMountSettings');
		const draft = { ...getTechniqueSettingsCurrentDefaults('germany') };
		const next = applyTechniqueDraftChange('germany', draft, 'school', 'cosmo');
		expect(next.school).toBe('cosmo');
		expect([next.orb, next.orbPersonal, next.showHouseFrames, next.strictFactors]).toEqual([1.5, 5.0, 0, 0]);
		const kept = pruneOptionsToNonDefault('germany', next, effectiveMountBaseline('germany', { birth: '1990-01-01 12:00:00' }));
		expect([kept.orb, kept.orbPersonal, kept.showHouseFrames]).toEqual([1.5, 5.0, 0]);   // 换派带出的值照样下发(重算与页面同)
		const back = applyTechniqueDraftChange('germany', next, 'school', '');
		expect([back.orb, back.orbPersonal, back.showHouseFrames, back.strictFactors]).toEqual(['', '', '', '']);
		const pure = applyTechniqueDraftChange('germany', draft, 'school', 'pure');
		expect([pure.orb, pure.showHouseFrames]).toEqual([0.5, 0]);
	});
});

describe('灵棋注家:齿轮文字 = 页面芯片简称,悬停全名(同一份函数)', ()=>{
	test('🔴 四注家 + 课断 / 断诗', ()=>{
		const { LINGQI_ZHU_META, lingqiZhuChipLabel, lingqiZhuChipTitle } = require('../../components/lingqi/lingqiSnapshot');
		LINGQI_ZHU_META.forEach((zm)=>{
			const f = fieldOf('lingqi', `zhu_${zm.key}`);
			expect(f.label).toBe(lingqiZhuChipLabel(zm));
			expect(f.title).toBe(lingqiZhuChipTitle(zm));
		});
		expect(fieldOf('lingqi', 'zhu_ke').label).toBe('课断');
		expect(fieldOf('lingqi', 'zhu_shi').label).toBe('断诗');
		const page = readSource('src/components/lingqi/LingQiMain.js');
		expect(page).toMatch(/\{lingqiZhuChipLabel\(zm\)\}/);
		expect(page).toMatch(/title=\{lingqiZhuChipTitle\(zm\)\}/);
	});
});

describe('宿占存案随案存黄道 / 宫制 / 岁差,载入与挂载都从存档读', ()=>{
	test('🔴 存案键 ⊆ 挂载 recordPayloadKeys;存档里的宫制进挂载基线(平铺键缺席时)', ()=>{
		const { SUZHAN_CASE_CHART_KEYS } = require('../../components/suzhan/SuZhanMain');
		const schema = getTechniqueSettingsSchema('suzhan');
		SUZHAN_CASE_CHART_KEYS.forEach((k)=>expect(schema.recordPayloadKeys).toContain(k));
		const rec = { birth: '1990-01-01 12:00:00', payload: JSON.stringify({ options: { hsys: 3, zodiacal: 1, siderealAyanamsa: 'raman' } }) };
		const base = effectiveMountBaseline('suzhan', rec);
		expect(Number(base.hsys)).toBe(3);
		expect(Number(base.zodiacal)).toBe(1);
		expect(base.siderealAyanamsa).toBe('raman');
		const page = readSource('src/components/suzhan/SuZhanMain.js');
		expect(page).toMatch(/\.\.\.SUZHAN_CASE_CHART_KEYS\]\.forEach/);   // 载入事盘同读这几键
	});
});

describe('归一 / 旧值迁移', ()=>{
	test('🔴 紫微九个叠层开关:记录里的布尔归一成 0/1,拨开再拨关不再被记成「已修改」', ()=>{
		const f = fieldOf('ziwei', 'childLimit');
		expect(f.normalize(true)).toBe(1);
		expect(f.normalize(false)).toBe(0);
		expect(pruneOptionsToNonDefault('ziwei', { childLimit: 0 }, { childLimit: false })).toEqual({});
	});
	test('🔴 卜卦判读:开关型存档布尔归一;自带空串档改用独立值表达(不再与「随流派」撞值),存档显式空串展平成它', ()=>{
		const sw = fieldOf('horary', 'hp_naturalSignifEnhanced');
		expect(sw.normalize(true)).toBe(1);
		expect(sw.normalize('')).toBe('');
		const g = fieldOf('horary', 'hp_querentGender');
		expect(vals(g.options).filter((v)=>v === '').length).toBe(1);
		expect(vals(g.options)).toContain(HORARY_JUDGE_EMPTY);
		expect(flattenHoraryStored({ extra: { horaryOverrides: { querentGender: '', onePlanetBoth: 'A' } } })).toEqual(expect.objectContaining({ hp_querentGender: HORARY_JUDGE_EMPTY, hp_onePlanetBoth: 'A' }));
	});
	test('🔴 奇门 / 三式合一旧存「阴盘」盘式:基线迁成转盘 + 阴盘起局(与页面载档同一迁移)', ()=>{
		const { migrateLegacyQimenSchool } = require('../../components/dunjia/DunJiaCalc');
		expect(migrateLegacyQimenSchool({ school: '阴盘', qijuMethod: 'chaibu', shuziReportNumber: '12' })).toEqual({ school: '转盘', qijuMethod: 'shuzi', shuziReportNumber: '12' });
		const same = { school: '飞盘' };
		expect(migrateLegacyQimenSchool(same)).toBe(same);
		const rec = { payload: JSON.stringify({ options: { school: '阴盘' } }) };
		expect(effectiveMountBaseline('qimen', rec)).toEqual(expect.objectContaining({ school: '转盘', qijuMethod: 'shuzi' }));
		expect(effectiveMountBaseline('sanshiunited', rec)).toEqual(expect.objectContaining({ school: '转盘', qijuMethod: 'shuzi' }));
	});
	test('金口诀:存档是自动档(diFenAuto / wuxingAuto)时基线显示「自动」,不露当时解析出的具体值', ()=>{
		const rec = { payload: JSON.stringify({ diFen: '午', diFenAuto: true, wuxing: '金', wuxingAuto: true }) };
		expect(effectiveMountBaseline('jinkou', rec)).toEqual(expect.objectContaining({ diFen: 'auto', wuxing: 'auto' }));
		const manual = { payload: JSON.stringify({ diFen: '午', diFenAuto: false }) };
		expect(effectiveMountBaseline('jinkou', manual).diFen).toBe('午');
	});
	test('印度问事流派清空 = KP(与页面同);紫微时间算法平太阳时显示为真太阳时(紫微实际所用);四技法可选回平太阳时', ()=>{
		expect(fieldOf('indiachart', 'indiaPrashnaSchools').normalize([])).toEqual(['kp']);
		expect(fieldOf('ziwei', 'timeAlg').normalize(3)).toBe(0);
		['zhengchuan', 'canping', 'heluo', 'yizhangjing'].forEach((k)=>{ expect(vals(fieldOf(k, 'timeAlg').options)).toContain(3); });
	});
	test('七政行运法:有「钉死古度限度法」档(空档 = 随七政页)', ()=>{
		expect(vals(fieldOf('guolao', 'guolaoMinorLimitType').options)).toEqual(expect.arrayContaining(['', 'gudu']));
	});
});

describe('🔴 显示条件与页面同(隐藏项不计数不下发)', ()=>{
	const cases = [
		['astrochart', 'leoBoundFirst', { termsVariant: 0 }, { termsVariant: 1 }],
		['astrochart', 'siderealAyanamsa', { zodiacal: 0 }, { zodiacal: 1 }],
		['primarydirect', 'pdRaptParallel', { pdtype: 0 }, { pdtype: 1 }],
		['primarydirect', 'pdTimeKeyCustom', { pdTimeKey: 'Ptolemy' }, { pdTimeKey: 'User' }],
		['zodialrelease', 'aiL1Idx', { aiMode: 'l1_all' }, { aiMode: 'l2_in_l1' }],
		['zodialrelease', 'aiL3Idx', { aiMode: 'l3_in_l2' }, { aiMode: 'l4_in_l3' }],
		['decennials', 'aiL2Idx', { aiMode: 'l2_in_l1' }, { aiMode: 'l3_in_l2' }],
		['election', 'tradeSide', { topicId: 'marriage' }, { topicId: 'trade' }],
		['election', 'surgeryPartOpposite', { topicId: 'marriage', surgeryPart: 'aries' }, { topicId: 'surgery', surgeryPart: 'aries' }],
		['horary', 'hp_refranationIncludeSignChange', { hp_refranationAsDestruction: 0 }, { hp_refranationAsDestruction: 1 }],
		['taiyi', 'tn', { style: 5 }, { style: 3 }],
		['taiyi', 'school_jishen', { style: 5 }, { style: 3 }],
		['zhengchuan', 'zcFatherAge', { zcSchool: 'tieban' }, { zcSchool: 'shaozi' }],
		['zhengchuan', 'zcItem', { zcSchool: 'dading' }, { zcSchool: 'xinyi' }],
		['ziwei', 'sihuaCustomTable', { sihuaSchool: 'beipai' }, { sihuaSchool: 'custom' }],
		['ziwei', 'brightnessCustomTable', { brightnessSource: 'zi_jian' }, { brightnessSource: 'custom' }],
		['ziwei', 'after23NewDay', { lateZi: 'zi_chu' }, { lateZi: 'global' }],
		['yizhangjing', 'leapRule', { dingYue: 'jieqi' }, { dingYue: 'nongli' }],
		['guice', 'dadingTable', { qiguaShu: 'xiantian' }, { qiguaShu: 'jiuchou' }],
		['guice', 'shiFang', { shuXi: 'meihua' }, { shuXi: 'zhouyi' }],
		['guice', 'shenSha', { shuXi: 'zhouyi', shiFang: false }, { shuXi: 'zhouyi', shiFang: true }],
		['tongshu', 'event', { school: 'qimen' }, { school: 'donggong' }],
		['wuzhao', 'number', { mode: 'day' }, { mode: 'ganzhi' }],
		['wuzhao', 'manualSplits', { mode: 'qian', manual: 1 }, { mode: 'day', manual: 1 }],
		['shenyishu', 'manualHour', { hourSource: 'auto' }, { hourSource: 'manual' }],
		['shenyishu', 'manualSeason', { seasonSource: 'auto' }, { seasonSource: 'manual' }],
		['tarot', 'edVersion', { dignities: 0 }, { dignities: 1 }],   // 存档开着时基线摊成 1;选「随档」(空)可能是开,照出(见下方「塔罗存档设置」)
		['tarot', 'timingUnit', { timingMethod: 'suit_unit' }, { timingMethod: 'major_number' }],
	];
	test.each(cases)('%s.%s', (key, name, hidden, shown)=>{
		expect(visible(key, name, hidden)).toBe(false);
		expect(visible(key, name, shown)).toBe(true);
	});
	test('三式合一的太乙子组:显示条件按合一页的键名(taiyiStyle)判', ()=>{
		expect(visible('sanshiunited', 'taiyiAccum', { taiyiStyle: 5 })).toBe(false);
		expect(visible('sanshiunited', 'taiyiAccum', { taiyiStyle: 3 })).toBe(true);
	});
	test('三式合一的六壬层锁正时正将:齿轮不列起课法 / 选时 / 演数', ()=>{
		const names = getTechniqueSettingsSchema('sanshiunited').fields.map((f)=>f.name);
		['castMethod', 'xuanShiZhi', 'yanShuNum'].forEach((n)=>expect(names).not.toContain(n));
		expect(getTechniqueSettingsSchema('liureng').fields.map((f)=>f.name)).toContain('castMethod');
	});
});

describe('择日工作台与技法页同口径', ()=>{
	test('🔴 紫微择日扫描晚子时缺省「跟随全局」:全局为出厂值时与旧缺省「子初换日」逐盘相同;全局改了随之变', ()=>{
		const { computeZiweiScanPan } = require('../../divination/zeri/ziweiZeriScanEngine');
		const geo = { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9 };
		const key = (pan)=>JSON.stringify(pan && pan.houses ? pan.houses.map((h)=>[h.ganzi, (h.starsMain || []).map((s)=>s.name || s)]) : pan);
		const a = computeZiweiScanPan(geo, { timeAlg: 1 }, '2026-03-03', '23:30:00');
		const b = computeZiweiScanPan(geo, { timeAlg: 1, lateZi: 'zi_chu' }, '2026-03-03', '23:30:00');
		expect(a).toBeTruthy();
		expect(key(a)).toBe(key(b));
		// 全局日界改为 24 点换日:缺省档跟着变(= 显式「子正换日」类口径),不再钉死子初
		const { DAY_BOUNDARY_AFTER24 } = require('../dayBoundary');
		window.localStorage.setItem('globalSetup', JSON.stringify({ dayBoundary: DAY_BOUNDARY_AFTER24 }));
		const c = computeZiweiScanPan(geo, { timeAlg: 1, ziweiLunarBasis: 'ziwei' }, '2026-03-03', '23:30:00');
		const d = computeZiweiScanPan(geo, { timeAlg: 1, ziweiLunarBasis: 'ziwei', lateZi: 'zi_chu' }, '2026-03-03', '23:30:00');
		expect(key(c)).not.toBe(key(d));
	});
	test('🔴 奇门择日快照:起局法文字随排盘体例(年家存「拆补」显示「本家默认」)', ()=>{
		const { buildQimenZeriSnapshotExtra } = require('../../divination/zeri/qimenZeriSnapshot');
		const txt = buildQimenZeriSnapshotExtra({ cfg: { startDate: '2026-01-01', endDate: '2026-01-02' }, geo: {}, options: { paiPanType: 0, qijuMethod: 'chaibu' }, tree: { children: [] }, results: [] });
		expect(txt).toContain('本家默认');
		expect(txt).not.toContain('拆补');
	});
});

describe('文字与页面同(齿轮 / 奇门页 / 三式合一页 / 择日工作台)', ()=>{
	const fs = require('fs');
	const path = require('path');
	const src = (rel)=>readSource(path.join(__dirname, '..', '..', rel));
	test('🔴 中门飞宫与混合四层的档名:齿轮取奇门页那份共用常量,三式合一页同引用(此前三式页少括注、齿轮半角括号)', ()=>{
		const { FEI_MEN_ZHONG_CAN_LABELS, MIX_LAYER_LABELS, mixLayerDefaultLabel } = require('../../components/dunjia/DunJiaCalc');
		const zc = fieldOf('qimen', 'feiMenZhongCan');
		expect(zc.label).toBe('中门飞宫');
		expect(zc.options.map((o)=>o.label)).toEqual([FEI_MEN_ZHONG_CAN_LABELS.on, FEI_MEN_ZHONG_CAN_LABELS.off]);
		[['mixTian', '天盘层', 'zhuan'], ['mixXing', '九星层', 'zhuan'], ['mixMen', '八门层', 'fei'], ['mixShen', '九神层', 'fei']].forEach(([nm, label, dft])=>{
			const f = fieldOf('qimen', nm);
			expect(f.label).toBe(label);
			expect(f.options.map((o)=>o.label)).toEqual([mixLayerDefaultLabel(dft), MIX_LAYER_LABELS.zhuan, MIX_LAYER_LABELS.fei]);
		});
		['components/dunjia/DunJiaMain.js', 'components/sanshi/SanShiUnitedMain.js'].forEach((rel)=>{
			const s = src(rel);
			expect(s).toMatch(/FEI_MEN_ZHONG_CAN_LABELS\.on/);
			expect(s).toMatch(/MIX_LAYER_LABELS\.zhuan/);
			expect(s).not.toMatch(/>参与\(默认\)</);
			expect(s).not.toMatch(/>转宫（排宫）</);
		});
	});
	test('奇门 / 太乙 / 三式字段名取页面原文;日界按各页叫法(奇门 / 三式「日界」,太乙「换日」)', ()=>{
		const labels = (key)=>Object.fromEntries(getTechniqueSettingsSchema(key).fields.map((f)=>[f.name, f.label]));
		const qm = labels('qimen');
		expect(qm).toMatchObject({ paiPanType: '排盘', qijuMethod: '起局', shuziReportNumber: '报数', zhiShiType: '值使', yueJiaQiJuType: '月家起局', kongMode: '空亡', yimaMode: '驿马',
			sex: '性别', shiftPalace: '移星', feiXingShun: '九星飞法', keZiZhengHuanShi: '子正换时', jinhanMenPai: '八门排法', fengJu: '封局', after23NewDay: '日界' });
		expect(labels('taiyi')).toMatchObject({ gameTheory: '博弈', sex: '命法性别', after23NewDay: '换日' });
		expect(labels('sanshiunited')).toMatchObject({ timeAlg: '时间算法', after23NewDay: '日界', guireng: '贵人体系', yinyangSystem: '昼夜阳阴归属' });
		// 两张页面互相一致(三式同步):月家起局 / 暗支(随暗干) / 贵人体系 / 昼夜阳阴归属
		expect(src('components/dunjia/DunJiaMain.js')).toMatch(/<span>月家起局<\/span>/);
		const ss = src('components/sanshi/SanShiUnitedMain.js');
		expect(ss).toMatch(/<span>暗支\(随暗干\)<\/span>/);
		expect(ss).toMatch(/<span>贵人体系<\/span>/);
		expect(ss).toMatch(/<span>昼夜阳阴归属<\/span>/);
	});
	test('择日工作台标签与页面同(需要家名时只加「奇门· / 六壬· / 太乙·」前缀)', ()=>{
		const qz = src('components/zeri/QimenZeriWorkbench.js');
		['排盘', '起局', '盘式', '值使', '空亡', '驿马', '日界'].forEach((l)=>expect(qz).toContain(`label: '${l}'`));
		['奇门类型', '取局法', '盘面起法', '值使取法', '空亡方式', '驿马方式'].forEach((l)=>expect(qz).not.toContain(`label: '${l}'`));
		const sz = src('components/zeri/SanshiZeriWorkbench.js');
		['奇门·排盘', '奇门·起局', '太乙·古法公式', '六壬·贵人体系', '六壬·昼夜阳阴归属', '六壬法贵人', '星历阳阴系', '时间算法(奇门)', '日界'].forEach((l)=>expect(sz).toContain(`'${l}'`));
		expect(src('components/zeri/TaiyiZeriWorkbench.js')).toContain(`label: '古法公式'`);
		expect(src('components/zeri/LiurengZeriWorkbench.js')).toContain(`label: '昼夜阳阴归属'`);
		// 换将口径:六壬页 / 三式页都叫「换将」(「月将」是另一个概念 = 月将所临之支)
		expect(src('components/lrzhan/LiuRengMain.js')).toContain('<span>换将</span>');
		expect(src('components/sanshi/SanShiUnitedMain.js')).toContain('<span>换将</span>');
		expect(src('components/zeri/LiurengZeriWorkbench.js')).toContain(`{ key: 'yueMode', label: '换将',`);
		expect(sz).toContain(`{ key: 'yueMode', label: '六壬·换将',`);
	});
});

describe('命理类文字与页面同', ()=>{
	const fs = require('fs');
	const path = require('path');
	const src = (rel)=>readSource(path.join(__dirname, '..', '..', rel));
	test('🔴 神数正传·六亲 / 心易:齿轮与页面同为下拉、档位同一份(此前文本框可填后端不认的值);天象档随演算时辰', ()=>{
		const ko = require('../../components/kinastro/kinastroOptions');
		[['zcSound', ko.ZC_SOUNDS], ['zcKe', ko.ZC_KE], ['zcGong', ko.ZC_GONG]].forEach(([nm, list])=>{
			const f = fieldOf('zhengchuan', nm);
			expect(f.type).toBe('select');
			expect(vals(f.options)).toEqual(list);
		});
		expect(vals(fieldOf('zhengchuan', 'zcItem').options)).toEqual(ko.ZC_ITEMS);
		expect(fieldOf('zhengchuan', 'zcItem').options.map((o)=>o.label.replace('（默认）', ''))).toEqual(ko.ZC_ITEMS);
		const env = fieldOf('zhengchuan', 'zcEnv');
		expect(vals(mountFieldOptions(env, { zcAskHourZhi: '午' }, ''))).toEqual(['', ...ko.ZC_ENV_DAY.map((o)=>o.value)]);
		expect(vals(mountFieldOptions(env, { zcAskHourZhi: '子' }, ''))).toEqual(['', ...ko.ZC_ENV_NIGHT.map((o)=>o.value)]);
		// 演算时辰留空(取本人时支):两套都列(此前恒列白天那套,夜间生人选不到明 / 晦);天象不属所选时辰那一套 → 回显按首项
		expect(vals(mountFieldOptions(env, { zcAskHourZhi: '' }, ''))).toEqual(['', '晴', '陰', '明', '晦', '雨', '雪']);
		expect(env.displayValue('晴', { zcAskHourZhi: '子' })).toBe('');
		expect(env.displayValue('晦', { zcAskHourZhi: '子' })).toBe('晦');
		expect(env.displayValue('晦', { zcAskHourZhi: '' })).toBe('晦');
		expect(vals(mountFieldOptions(env, { zcAskHourZhi: '子' }, '晴'))).toEqual(['', ...ko.ZC_ENV_NIGHT.map((o)=>o.value)]);
		expect(fieldOf('zhengchuan', 'zcAskHourZhi').type).toBe('select');
		const page = src('components/kinastro/KinAstroMain.js');
		['ZC_ITEMS.map', 'ZC_SOUNDS.map', 'ZC_KE.map', 'ZC_GONG.map', 'zcEnvOptionsFor(this.zcEffectiveAskHourZhi())', 'value={zcEnvShown(this.zcEffectiveAskHourZhi(), this.state.zhengchuanEnv)}'].forEach((t)=>expect(page).toContain(t));
		// 引擎:天象不属演算时辰那一套 → 按该套首项(此前四象 / 动爻整段为空)
		const { calcXuanjiDongyao } = require('../zhengchuanLiuqinLocal');
		const base = { yearZhi: '子', lunarMonth: 3, lunarDay: 5, hourZhi: '子', isLeapMonth: false, gender: 1, yangYear: true, askHourZhi: '子' };
		const bad = calcXuanjiDongyao({ ...base, env: '晴' });
		const first = calcXuanjiDongyao({ ...base, env: '明' });
		expect(bad.env).toBe('明');
		expect(bad.sixiang).toBe(first.sixiang);
		expect(bad.sixiang).toBeTruthy();
	});
	test('七政:命度 / 推变法 / 古宿岁差 / 回归锚点 / 报时星 / 童限基数的档名取七政页那份常量(半角括号)', ()=>{
		const gd = require('../../components/guolao/guolaoData');
		const labels = (nm)=>fieldOf('guolao', nm).options.map((o)=>o.label);
		expect(labels('lifeMode')).toEqual([...gd.LIFE_MODE_OPTIONS, ...gd.LIFE_CUSTOM_ZHI_OPTIONS].map((o)=>o.label));
		expect(labels('guolaoTuibianMethod')).toEqual(gd.TUIBIAN_METHOD_OPTIONS.map((o)=>o.label));
		expect(labels('guolaoGufaPrecess')).toEqual(gd.GUFA_PRECESS_OPTIONS.map((o)=>o.label));
		expect(labels('guolaoEqTropicalAnchor')).toEqual(gd.EQ_TROPICAL_ANCHOR_OPTIONS.map((o)=>o.label));
		// 「默认」标记:页面写了照页面,页面没写不加(档名逐字等于页面常量)
		expect(labels('trueSolarTime').filter((l)=>gd.TRUE_SOLAR_TIME_OPTIONS.some((o)=>o.label === l) || !/默认/.test(l))).toEqual(labels('trueSolarTime'));
		gd.TRUE_SOLAR_TIME_OPTIONS.forEach((o)=>expect(labels('trueSolarTime')).toContain(o.label));
		expect(labels('guolaoTongxianBase')).toContain('虚十一·早不过11岁');
		fieldOf('guolao', 'su28Mode').options.filter((o)=>o.value !== '').forEach((o)=>expect(o.label).toBe(gd.SU28_MODE_LABEL[o.value]));
		// 页面上有的档一律半角括号(「随全局（默认）」是齿轮自己的空值档,页面没有,沿用齿轮通用写法)
		const pageLabels = getTechniqueSettingsSchema('guolao').fields.filter((f)=>f.name !== 'guolaoAyanamsa')
			.reduce((acc, f)=>acc.concat((f.options || []).filter((o)=>o.value !== '').map((o)=>o.label)), []);
		expect(pageLabels.join()).not.toMatch(/（默认）|（经度|（大衍）|（黄道）/);
	});
	test('策天:显示开关齿轮名 = 左栏勾选名;右栏「设置」页签与左栏同一份开关表(不再写「书法仅亮度可调」)', ()=>{
		const { cetianDisplayToggles } = require('../../components/kinastro/KinAstroMain');
		const gear = Object.fromEntries(getTechniqueSettingsSchema('cetian').fields.map((f)=>[f.name, f.label]));
		[...cetianDisplayToggles('book'), ...cetianDisplayToggles('kentang')].forEach(([key, label])=>{
			const nm = key.replace(/^cetianS/, 's');
			expect(gear[nm]).toBe(label);
		});
		const page = src('components/kinastro/KinAstroMain.js');
		expect(page).not.toContain('书法仅「亮度」可调');
		expect((page.match(/cetianDisplayToggles\(this\.state\.cetianMethod\)/g) || []).length).toBe(2);
		expect(gear).toMatchObject({ method: '算法', brightnessSchool: '庙旺', daxianMode: '大限', tianluoMode: '罗网', liunianQishaMode: '七煞' });
	});
	test('紫微 / 八字 / 七政择日工作台:标签与档名取各自技法页(紫微直接引页面选项常量)', ()=>{
		// 紫微:工作台(性别 / 时间算法 + 只读显示的排盘口径)与择日快照同读 ziweiOptions 的 ZIWEI_ZERI_SCAN_FIELDS 派生表(档名直接引页面选项常量)
		expect(src('components/zeri/ZiweiZeriWorkbench.js')).toContain('{ZIWEI_ZERI_WORKBENCH_FIELDS.map((f) => (');
		expect(src('components/zeri/ZiweiZeriWorkbench.js')).toContain('{ziweiZeriCalibreItems(pageOptions).map((x) => (');   // 只读口径与 AI 择日回包同一单源
		expect(src('components/ziwei/ziweiOptions.js')).toContain('return [...ZIWEI_ZERI_PAGE_FIELDS.filter(');
		expect(src('components/ziwei/ziweiOptions.js')).toContain('export const ZIWEI_ZERI_PAGE_FIELDS = ZIWEI_ZERI_SCAN_FIELDS.filter(');
		expect(src('divination/zeri/ziweiZeriSnapshot.js')).toContain('ZIWEI_ZERI_SCAN_FIELDS');
		const zw = src('components/ziwei/ziweiOptions.js');
		['YEAR_BOUNDARY_OPTIONS', 'TIANMA_BASIS_OPTIONS', 'HUOLING_OPTIONS', 'KONGWANG_STYLE_OPTIONS', 'CHANGSHENG_START_OPTIONS',
			'CHANGSHENG_DIRECTION_OPTIONS', 'SHANGSHI_OPTIONS', 'KONG_NAMING_OPTIONS', 'STAR_SET_OPTIONS', 'LIFE_MASTER_BY_OPTIONS'].forEach((c)=>expect(zw).toContain(`options: ${c} }`));
		['定年界线', '天马依据', '火铃起宫', '魁钺歌诀', '空亡星式', '长生十二神', '长生顺逆', '天伤天使', '空劫命名', '时间算法'].forEach((l)=>expect(zw).toContain(`label: '${l}'`));
		const bz = src('components/zeri/BaziZeriWorkbench.js');
		['神煞查法', '年柱日柱都查', '按年柱查', '按日柱查', '长生火土同（阴阳同序）', '直接时间', '23点算第二天'].forEach((l)=>expect(bz).toContain(`'${l}'`));
		const qz = src('components/zeri/QizhengZeriWorkbench.js');
		['宿度制', '罗计取法', '月孛取法'].forEach((l)=>expect(qz).toContain(`label: '${l}'`));
	});
	test('皇极经典档名 = 后端经典表书名;紫微小限顺逆不再写「（现状）」', ()=>{
		const py = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'vendor', 'kinwangji', 'kinwangji', 'classics.py'), 'utf8');
		const titles = {};
		py.replace(/"(\w+)":\s*\{\s*"file":[^}]*?"title":\s*"([^"]+)"/g, (m, k, t)=>{ titles[k] = t; return m; });
		fieldOf('huangji', 'classicKey').options.forEach((o)=>expect(o.label).toBe(titles[o.value]));
		expect(src('components/ziwei/ZiWeiInput.js')).not.toContain('（现状）');
		expect(fieldOf('ziwei', 'ziweiXiaoxianYinyang').options.map((o)=>o.label)).toEqual(['男顺女逆（默认）', '阳男阴女顺（中州）']);
	});
});

describe('卜类文字与页面同 + 六壬十二长生随日干', ()=>{
	const fs = require('fs');
	const path = require('path');
	const src = (rel)=>readSource(path.join(__dirname, '..', '..', rel));
	test('🔴 六壬十二长生:齿轮缺省「自动(随日干五行)」= 页面缺省;重算按本课日干现算(此前无头写死「土」);三式合一锁「土」不变', ()=>{
		const { WuXing } = require('../../components/liureng/LRConst');
		const f = fieldOf('liureng', 'wuxing');
		expect(f.default).toBe('auto');
		expect(f.label).toBe('十二长生');
		expect(f.options.slice(1).map((o)=>o.label)).toEqual(WuXing.map((w)=>`十二长生：${w.elem}--${w.ganzi}`));
		expect(fieldOf('jinkou', 'wuxing').options.slice(1).map((o)=>o.label)).toEqual(WuXing.map((w)=>`${w.elem}·${w.ganzi}`));
		jest.isolateModules(()=>{
			jest.doMock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>({ Result: {} })) }));
			const { resolveZhangshengElem } = require('../aiAnalysisContext');
			const res = (gz)=>({ nongli: { dayGanZi: gz } });
			expect(resolveZhangshengElem(undefined, res('甲子'))).toBe('木');
			expect(resolveZhangshengElem('auto', res('庚午'))).toBe('金');
			expect(resolveZhangshengElem('水', res('甲子'))).toBe('水');
			expect(resolveZhangshengElem('', null)).toBe('土');
		});
		const ctx = src('utils/aiAnalysisContext.js');
		expect((ctx.match(/resolveZhangshengElem\(/g) || []).length).toBeGreaterThanOrEqual(5);
		expect(ctx).not.toMatch(/payload\.wuxing \|\| '土'/);
		expect(ctx).toMatch(/zhanCategory: undefined, wuxing: '土' \}/);
		const ss = getTechniqueSettingsSchema('sanshiunited').fields.map((x)=>x.name);
		expect(ss).not.toContain('wuxing');
		expect(ss).not.toContain('zhanCategory');
	});
	test('轨策 / 小成图 / 飞宫 / 地占 / 塔罗:齿轮档名取页面同一份常量', ()=>{
		const { GUICE_OPTION_META } = require('../../components/guice/guiceSchools');
		GUICE_OPTION_META.forEach((m)=>{
			const f = fieldOf('guice', m.key);
			expect(f.label).toBe(m.label);
			if(m.options){ expect(f.options.map((o)=>o.label.replace(/（默认）$/, ''))).toEqual(m.options.map((o)=>o.label.replace(/（默认）$/, ''))); }
		});
		const { YONG_GONG_OPTIONS, PI_KOUJING_LABEL } = require('../../components/xiaochengtu/core/xiaochengtuConst');
		expect(fieldOf('xiaochengtu', 'yongGong').options.map((o)=>o.label.replace(/（默认）$/, ''))).toEqual(YONG_GONG_OPTIONS.map((o)=>o.label));
		expect(fieldOf('xiaochengtu', 'piKoujing').options.map((o)=>o.label.replace(/（默认）$/, ''))).toEqual([PI_KOUJING_LABEL.zheng, PI_KOUJING_LABEL.yiwen]);
		const { LIU_YUE_MONTH_NAMES } = require('../../components/feigong/core/feigongConst');
		expect(fieldOf('feigong', 'liuYueMonth').options.slice(1).map((o)=>o.label)).toEqual(LIU_YUE_MONTH_NAMES.map((m)=>`${m}月`));
		const { QUESITED_HOUSE_OPTIONS, TURN_HOUSE_LABELS } = require('../../components/geomancy/geomancyOptions');
		expect(fieldOf('geomancy', 'quesitedHouse').options.slice(1).map((o)=>o.label)).toEqual(QUESITED_HOUSE_OPTIONS.map((o)=>`第 ${o.v} 宫 · ${o.label}`));
		expect(fieldOf('geomancy', 'turnTo').options.slice(1).map((o)=>o.label)).toEqual(TURN_HOUSE_LABELS.map((lb, i)=>`第 ${i + 1} 宫 · ${lb}`));
		['components/geomancy/GeomancyMain.js', 'components/xiaochengtu/XiaoChengTuMain.js', 'components/feigong/FeiGongMain.js'].forEach((rel)=>{
			expect(src(rel)).toMatch(/QUESITED_HOUSE_OPTIONS\.map|options=\{YONG_GONG_OPTIONS\}|const MO = LIU_YUE_MONTH_NAMES/);
		});
		const { YESNO_MODE_LABEL } = require('../../components/tarot/engine/verdict');
		const vm = fieldOf('tarot', 'verdictMode');
		expect(vm.label).toBe('Yes/No 定局法');
		expect(vm.options.slice(1).map((o)=>o.value)).toEqual(['majority', 'orientation', 'single', 'numeric', 'polarity', 'weighted_center', 'anchor', 'single3']);
		vm.options.slice(1).forEach((o)=>expect(o.label).toBe(YESNO_MODE_LABEL[o.value]));
	});
	test('字段名取页面原文:五兆 / 神易数 / 六爻 / 金口诀 / 地占 / 塔罗 / 小六壬', ()=>{
		const labels = (key)=>Object.fromEntries(getTechniqueSettingsSchema(key).fields.map((f)=>[f.name, f.label]));
		expect(labels('wuzhao')).toMatchObject({ mode: '起盘方式', manual: '揲筮模式', xingshenMonth: '行神月制' });
		expect(fieldOf('wuzhao', 'manual').options.map((o)=>o.label)).toEqual(['自动随机', '手动复现']);
		expect(fieldOf('wuzhao', 'manual').normalize(true)).toBe(1);
		expect(fieldOf('wuzhao', 'shifaVariant').options[0].label).toMatch(/^挂一回加（/);
		expect(labels('shenyishu')).toMatchObject({ hourSource: '入式小时', seasonSource: '五行季令' });
		expect(labels('sixyao')).toMatchObject({ shenshaBase: '神煞起例', gufa: '古法进阶', benming: '本命(年支)' });
		expect(labels('jinkou')).toMatchObject({ askKey: '所问类别', timeScope: '问事时段' });
		expect(fieldOf('jinkou', 'diFen').options[1].label).toBe('子');
		expect(labels('geomancy')).toMatchObject({ tradition: '流派预设', readingScope: '读取范围', zodiacSystem: '黄道体系', quesitedHouse: '所问宫' });
		expect(labels('tarot')).toMatchObject({ variant: '字母/路径变体', suitElementSwap: '火/风互换(少数派)', astroModern: '三元素大牌附现代行星注', dignities: '元素尊位' });
		expect(labels('xiaoliuren').showOneThree).toMatch(/^一↔三/);
		expect(src('components/wuzhao/WuZhaoMain.js')).toContain('已按干支起盘');
	});
});

describe('轨策覆盖像页面逐项改那样落', ()=>{
	test('存档「大定」预设被齿轮改掉数字配卦:流派标自定义、定数表不显示不下发;只改定数表照常生效', ()=>{
		const { mergeOptionsIntoPayload } = require('../techniqueMountSettings');
		const { applyPreset, schoolNeeds } = require('../../components/guice/guiceSchools');
		const tables = fieldOf('guice', 'dadingTable').options.map((o)=>o.value);
		const other = tables.find((v)=>v !== 'xinyifawei');
		const payload = { gua: { up: 1, lo: 2, dongYao: 3 }, options: applyPreset('dading') };
		const rec = { cid: 'g1', payload: JSON.stringify(payload) };
		const b = effectiveMountBaseline('guice', rec);
		expect(b.qiguaShu).toBe('jiuchou');
		const pr = pruneOptionsToNonDefault('guice', { qiguaShu: 'xiantian', dadingTable: other }, b);
		expect(pr).toEqual({ qiguaShu: 'xiantian' });
		const m = mergeOptionsIntoPayload(payload, 'guice', pr);
		expect(m.options.school).toBe('custom');
		expect(schoolNeeds(m.options).dading).toBe(false);
		const m2 = mergeOptionsIntoPayload(payload, 'guice', pruneOptionsToNonDefault('guice', { dadingTable: other }, b));
		expect(m2.options).toMatchObject({ dadingTable: other, qiguaShu: 'jiuchou' });
		expect(schoolNeeds(m2.options).dading).toBe(true);
		// 不改任何项:存档原样
		expect(mergeOptionsIntoPayload(payload, 'guice', {}).options).toEqual(payload.options);
	});
});

describe('改成下拉后旧值的形态', ()=>{
	test('蠢子数显示数量:旧的数字 20 归一成档「20条」;不在档位里的旧值列成「旧档」而不露裸值', ()=>{
		const f = fieldOf('chunzi', 'chunziResultLimit');
		expect(f.normalize(20)).toBe('20');
		expect(mountFieldOptions(f, {}, 20).filter((o)=>`${o.value}` === '20').map((o)=>o.label)).toEqual(['20条']);
		expect(mountFieldOptions(f, {}, 15).slice(-1)).toEqual([{ value: '15', label: '15（旧档）' }]);
		expect(mountFieldOptions(f, {}, '').some((o)=>/旧档/.test(o.label))).toBe(false);
		expect(pruneOptionsToNonDefault('chunzi', { chunziResultLimit: 20 }, { chunziResultLimit: '20' })).toEqual({});
	});
});

describe('金口诀时间基准进齿轮', ()=>{
	test('档位与金口诀页同(直接时间 / 真太阳时,缺省直接时间);覆盖落 payload 顶层,重算按它取时间算法', ()=>{
		const { mergeOptionsIntoPayload } = require('../techniqueMountSettings');
		const f = fieldOf('jinkou', 'timeBasis');
		expect(f.default).toBe('direct');
		expect(f.options).toEqual([{ value: 'direct', label: '直接时间' }, { value: 'trueSolar', label: '真太阳时' }]);
		const page = fs.readFileSync(path.join(__dirname, '../../components/jinkou/JinKouMain.js'), 'utf8');
		expect(page).toContain('<Option value="direct">直接时间</Option>');
		expect(page).toContain('<Option value="trueSolar">真太阳时</Option>');
		const rec = { cid: 'jk1', payload: JSON.stringify({ timeBasis: 'direct', diFen: '午' }) };
		const b = effectiveMountBaseline('jinkou', rec);
		expect(b.timeBasis).toBe('direct');
		const pr = pruneOptionsToNonDefault('jinkou', { timeBasis: 'trueSolar' }, b);
		expect(pr).toEqual({ timeBasis: 'trueSolar' });
		expect(mergeOptionsIntoPayload(JSON.parse(rec.payload), 'jinkou', pr).timeBasis).toBe('trueSolar');
		const ctxSrc = readSource(path.join(__dirname, '..', 'aiAnalysisContext.js'));
		expect(ctxSrc).toContain("const _jkBasis = payload && payload.timeBasis ? `${payload.timeBasis}` : 'direct';");
	});
});

describe('太玄 / 荆诀种子:留空 = 随存档', ()=>{
	test('清空不算覆盖、不下发;显式填数(含 0)照常下发;重算不把空串当显式种子', ()=>{
		['taixuan', 'jingjue'].forEach((k)=>{
			const rec = { cid: `${k}-1`, payload: JSON.stringify({ options: { seed: 12345 } }) };
			const b = effectiveMountBaseline(k, rec);
			expect(`${b.seed}`).toBe('12345');
			expect(pruneOptionsToNonDefault(k, { seed: '' }, b)).toEqual({});
			expect(pruneOptionsToNonDefault(k, { seed: 0 }, b)).toEqual({ seed: 0 });
			expect(pruneOptionsToNonDefault(k, { seed: 12345 }, b)).toEqual({});
		});
		const ctxSrc = readSource(path.join(__dirname, '..', 'aiAnalysisContext.js'));
		expect(ctxSrc.match(/seed: p\.seed !== undefined && p\.seed !== null && p\.seed !== '' \? p\.seed : oo\.seed/g).length).toBe(2);
	});
});

describe('塔罗存档设置(payload.options.settings)进齿轮基线', ()=>{
	test('尊位版本 / 计时单位:存档开着元素尊位、计时法是大牌数字法时,齿轮随档也显示且覆盖能下发', ()=>{
		const rec = { cid: 't1', payload: JSON.stringify({ options: { deckId: 'rws', seed: 'abc', settings: { dignities: true, timingMethod: 'major_number', suitElementSwap: false, meaningSystem: 'waite' } } }) };
		const b = effectiveMountBaseline('tarot', rec);
		expect(b).toMatchObject({ dignities: 1, timingMethod: 'major_number', suitElementSwap: 0, meaningSystem: 'waite', edVersion: '' });
		expect(visible('tarot', 'edVersion', b)).toBe(true);
		expect(visible('tarot', 'timingUnit', b)).toBe(true);
		expect(pruneOptionsToNonDefault('tarot', { edVersion: 'mathers', timingUnit: '周' }, b)).toEqual({ edVersion: 'mathers', timingUnit: '周' });
		// 与存档相同的档剪掉;改成关照常下发
		expect(pruneOptionsToNonDefault('tarot', { dignities: 1, meaningSystem: 'waite' }, b)).toEqual({});
		expect(pruneOptionsToNonDefault('tarot', { dignities: 0 }, b)).toEqual({ dignities: 0 });
		// 存档关着 / 没存:尊位版本不出
		const off = effectiveMountBaseline('tarot', { cid: 't2', payload: JSON.stringify({ options: { settings: { dignities: false } } }) });
		expect(visible('tarot', 'edVersion', off)).toBe(false);
		expect(effectiveMountBaseline('tarot', { cid: 't3', payload: JSON.stringify({ options: {} }) }).dignities).toBe('');
		// 选「随档」(空) = 随存档:不算覆盖(此前被算成覆盖、每张塔罗盘都改走重算);依赖项随档时照出
		expect(pruneOptionsToNonDefault('tarot', { dignities: '', meaningSystem: '' }, b)).toEqual({});
		expect(visible('tarot', 'edVersion', { ...b, dignities: '' })).toBe(true);
		expect(visible('tarot', 'timingUnit', { ...b, timingMethod: '' })).toBe(true);
		// 五兆手动六数清空 / 填得不成形:不算覆盖(重算回落存档)
		expect(pruneOptionsToNonDefault('wuzhao', { mode: 'tang', manual: 1, manualSplits: '' }, { mode: 'tang', manual: 1, manualSplits: [18, 8, 5, 2, 1, 1] })).toEqual({});
	});
});

describe('奇门命盘结构(设置在 payload.qimen.options)', ()=>{
	test('齿轮基线读命盘结构里的奇门设置;重算把齿轮覆盖叠在其上(此前基线读不到、覆盖被忽略)', ()=>{
		const schema = getTechniqueSettingsSchema('qimen');
		const b = schema.baselineSource({ qimen: { options: { school: '飞盘', paiPanType: 3 } } });
		expect(b.school).toBe('飞盘');
		expect(schema.baselineSource({ options: { school: '混合' } }).school).toBe('混合');
		const src = readSource(require('path').join(__dirname, '..', 'aiAnalysisContext.js'));
		expect(src).toContain("const gearOpt = chartShape && payload && payload.options && typeof payload.options === 'object' ? payload.options : null;");
		expect(src).toContain('...(gearOpt || {}),');   // 行为见 qimenChartShapeRegen.test(农历与排局同叠齿轮)
	});
});

describe('进快照的页面项,齿轮都有、缺省 = 页面保存值', ()=>{
	test('七政大限年界:齿轮可调;记录有值者覆盖七政显示偏好,没有 = 随显示偏好', ()=>{
		const f = fieldOf('guolao', 'guolaoLimitYearBoundary');
		expect(f.recordKey).toBe('guolaoLimitYearBoundary');
		expect(vals(f.options)).toEqual(['', 'gregorian', 'lichun', 'dongzhi']);
		const { buildRecordFieldObject } = require('../aiAnalysisContext');
		const { guolaoSnapshotDisplayFromFields } = require('../../components/guolao/main/snapshot');
		const { setStoredGuolaoDisplay, getStoredGuolaoDisplay } = require('../../components/guolao/GuoLaoChartStyle');
		setStoredGuolaoDisplay({ ...getStoredGuolaoDisplay(), limitYearBoundary: 'dongzhi' });
		const rec = { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' };
		expect(guolaoSnapshotDisplayFromFields(buildRecordFieldObject(rec)).limitYearBoundary).toBe('dongzhi');
		const { mergeOptionsIntoRecord } = require('../techniqueMountSettings');
		const merged = mergeOptionsIntoRecord(rec, 'guolao', { guolaoLimitYearBoundary: 'lichun' });
		expect(merged.guolaoLimitYearBoundary).toBe('lichun');
		expect(guolaoSnapshotDisplayFromFields(buildRecordFieldObject(merged)).limitYearBoundary).toBe('lichun');
	});
	test('八字:页面出快照的显示项(年龄 / 生肖归属 / 流派)与起盘盘法都进齿轮,缺省 = 八字页保存值;重算回落同一份', ()=>{
		const { buildChartBaziParams } = require('../aiAnalysisContext/chartParams');
		const rec = { birth: '1990-02-01 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', gender: 1 };
		window.localStorage.setItem('baziopt', JSON.stringify({ zodiacBoundary: 'lunar', ageStyle: 'real', school: 'fuyi', minggongMethod: 'shufa', cangVersion: 'fenye' }));
		const cur = getTechniqueSettingsCurrentDefaults('bazi');
		expect([cur.zodiacBoundary, cur.ageStyle, cur.school, cur.minggongMethod, cur.cangVersion]).toEqual(['lunar', 'real', 'fuyi', 'shufa', 'fenye']);
		const p = buildChartBaziParams(rec);
		expect([p.zodiacBoundary, p.ageStyle, p.school, p.minggongMethod, p.cangVersion]).toEqual(['lunar', 'real', 'fuyi', 'shufa', 'fenye']);
		// 齿轮显式拨回缺省档:与页面保存值不同 → 记成覆盖、重算按它
		const { mergeOptionsIntoRecord } = require('../techniqueMountSettings');
		const m = mergeOptionsIntoRecord(rec, 'bazi', { zodiacBoundary: 'lichun', school: 'zonghe' });
		const p2 = buildChartBaziParams(m);
		expect([p2.zodiacBoundary, p2.school]).toEqual(['lichun', 'zonghe']);
		// 没存页面设置:不挂(= 页面缺省 立春 / 虚岁 / 传统综合),盘法取缺省
		window.localStorage.removeItem('baziopt');
		const p3 = buildChartBaziParams(rec);
		expect([p3.zodiacBoundary, p3.ageStyle, p3.school, p3.minggongMethod]).toEqual([undefined, undefined, undefined, 'tongxing']);
	});
	test('八字锁:页面快照参数 snapshotParamsOf 的显示项、起盘读的 baziOpt 盘法项,齿轮都有且缺省读页面保存值(神煞分组除外:面板过滤,复算恒全量)', ()=>{
		const src = readSource(path.join(__dirname, '..', '..', 'components', 'cntradition', 'BaZi.js'));
		const m = src.match(/snapshotParamsOf\(params\)\{[\s\S]*?return \{ \.\.\.params, ([^}]+)\};/);
		expect(m).toBeTruthy();
		const shown = m[1].split(',').map((x)=>x.trim().split(':')[0]).filter(Boolean).filter((k)=>k !== 'shenshaGroups');
		const req = [...new Set((src.match(/this\.state\.baziOpt\.(minggongMethod|fenyeVersion|southMonth|cangVersion|dayunPrecision)\)/g) || []).map((x)=>x.replace(/^this\.state\.baziOpt\.|\)$/g, '')))];
		expect(shown.sort()).toEqual(['ageStyle', 'school', 'zodiacBoundary']);
		expect(req.length).toBe(5);
		[...shown, ...req].forEach((k)=>{ expect([k, typeof fieldOf('bazi', k).globalCurrent]).toEqual([k, 'function']); });
	});
	test('铁板双胞胎分 / 过房养子:只是页面标题的标签,页面快照与 AI 快照都不读 —— 不进齿轮(进了是死开关);谁把它接进快照,这里要求同时补齿轮', ()=>{
		const kin = readSource(path.join(__dirname, '..', '..', 'components', 'kinastro', 'KinAstroMain.js'));
		const fw = readSource(path.join(__dirname, '..', 'tiebanFrameworkLocal.js'));
		const calls = kin.match(/buildTiebanFramework\(fourPillars, \{[^}]*\}/g) || [];
		expect(calls.length).toBeGreaterThanOrEqual(2);
		const intoSnapshot = calls.some((c)=>/twin|guofang/i.test(c)) || /twin|guofang/i.test(fw);
		const schema = getTechniqueSettingsSchema('tieban');
		const inGear = schema.fields.some((x)=>/twin|guofang/i.test(x.name));
		expect({ intoSnapshot, inGear }).toEqual({ intoSnapshot: false, inGear: false });
	});
	test('通书:齿轮缺省 = 通书页保存的流派 / 用事;重算以同一份为底', async ()=>{
		const { saveTongshuSettings } = require('../../components/calendar/tongshuStore');
		saveTongshuSettings({ school: 'wutu', event: '出行', liexiuUse: '安葬', mingYear: '丙寅' });
		const cur = getTechniqueSettingsCurrentDefaults('tongshu');
		expect([cur.school, cur.event, cur.liexiuUse, cur.mingYear]).toEqual(['wutu', '出行', '安葬', '丙寅']);
		const rec = { cid: 't1', divTime: '2024-03-05 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', payload: JSON.stringify({}) };
		expect(effectiveMountBaseline('tongshu', rec).school).toBe('wutu');
		const { regenerateCaseTechniqueSnapshot } = require('../aiAnalysisContext/regenCase');
		const { TONGSHU_SCHOOL_MAP } = require('../../components/calendar/tongshuSchools');
		const txt = await regenerateCaseTechniqueSnapshot(rec, 'tongshu', {});
		expect(txt).toContain(`流派：${TONGSHU_SCHOOL_MAP.wutu.label}`);
		const txt2 = await regenerateCaseTechniqueSnapshot(rec, 'tongshu', { tongshu: { school: 'donggong' } });
		expect(txt2).toContain(`流派：${TONGSHU_SCHOOL_MAP.donggong.label}`);
	});
});

describe('皇极轨策齿轮有流派:换派套该派开关组(与页面「流派预设」同一张表),改单项偏离预设标自定义', ()=>{
	const { applyTechniqueDraftChange, composeTechniqueDraft, adjustedMountBaseline, mergeOptionsIntoPayload } = require('../techniqueMountSettings');
	const { applyPreset, GUICE_SCHOOL_OPTIONS } = require('../../components/guice/guiceSchools');
	test('档位 = 页面流派预设;「自定义」只在现值是它时列出', ()=>{
		const f = fieldOf('guice', 'school');
		expect(vals(mountFieldOptions(f, { school: 'default' })).sort()).toEqual(GUICE_SCHOOL_OPTIONS.map((o)=>o.value).sort());
		expect(vals(mountFieldOptions(f, { school: 'custom' }))).toContain('custom');
	});
	test('抽屉换派 = 套预设;再改单项 → 自定义', ()=>{
		const d0 = getTechniqueSettingsCurrentDefaults('guice');
		const d1 = applyTechniqueDraftChange('guice', d0, 'school', 'meihua');
		const p = applyPreset('meihua');
		expect([d1.school, d1.shuXi, d1.shiyingSet, d1.shenSha, d1.shiFang]).toEqual(['meihua', p.shuXi, p.shiyingSet, p.shenSha, p.shiFang]);
		const d2 = applyTechniqueDraftChange('guice', d1, 'shiyingSet', 'xinyifawei');
		expect(d2.school).toBe('custom');
		// 存下的覆盖只有流派:合成草稿照样是该派细项
		expect(composeTechniqueDraft('guice', d0, { school: 'dading' }).qiguaShu).toBe('jiuchou');
	});
	test('重算:覆盖带流派 → 先套派再逐项;剪枝基准随派(「新派 + 某项恰等于存档」不被剪)', ()=>{
		const payload = { gua: { up: 1, lo: 2, dongYao: 3 }, options: applyPreset('default') };
		const rec = { cid: 'g2', payload: JSON.stringify(payload) };
		const b = effectiveMountBaseline('guice', rec);
		expect(b.school).toBe('default');
		const m = mergeOptionsIntoPayload(payload, 'guice', pruneOptionsToNonDefault('guice', { school: 'meihua' }, b));
		expect([m.options.school, m.options.shuXi, m.options.shiyingSet]).toEqual(['meihua', 'meihua', applyPreset('meihua').shiyingSet]);
		// 梅花 + 十应名目拨回存档值(心易发微):基准随派,不被剪 → 结果自定义(页面上同操作同结果)
		const opts = { school: 'meihua', shiyingSet: payload.options.shiyingSet };
		const pr = pruneOptionsToNonDefault('guice', opts, adjustedMountBaseline('guice', opts, b));
		expect(pr).toEqual(opts);
		const m2 = mergeOptionsIntoPayload(payload, 'guice', pr);
		expect([m2.options.school, m2.options.shuXi, m2.options.shiyingSet]).toEqual(['custom', 'meihua', payload.options.shiyingSet]);
	});
});

describe('印占齿轮换流派套该派宫制 / 岁差(与页面换派同表);记录缺这两项 = 页面载入值', ()=>{
	const { applyTechniqueDraftChange, mergeOptionsIntoRecord, indiaSchoolPresetDraft } = require('../techniqueMountSettings');
	const AstroConst = require('../../constants/AstroConst');
	const other = AstroConst.INDIA_SCHOOL_OPTIONS.map((o)=>o.value).find((v)=>{
		const d = AstroConst.getIndiaSchoolDefaults(v) || {};
		return v !== AstroConst.INDIA_SCHOOL_DEFAULT && (d.hsys !== AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT || d.ayanamsa !== AstroConst.INDIA_AYANAMSA_DEFAULT);
	});
	test('抽屉换派写成该派预设', ()=>{
		expect(other).toBeTruthy();
		const d = applyTechniqueDraftChange('indiachart', getTechniqueSettingsCurrentDefaults('indiachart'), 'indiaSchool', other);
		expect(d).toMatchObject(indiaSchoolPresetDraft(other));
	});
	test('只带流派的覆盖(旧存的配置 / 助手只改流派):并进记录时补该派宫制 / 岁差;与盘上同派不补', ()=>{
		const rec = { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' };
		const m = mergeOptionsIntoRecord(rec, 'indiachart', { indiaSchool: other });
		const pre = indiaSchoolPresetDraft(other);
		Object.keys(pre).forEach((k)=>{
			const def = getTechniqueSettingsSchema('indiachart').fields.find((x)=>x.name === k).default;
			if(`${pre[k]}` !== `${def}`){ expect([k, m[k]]).toEqual([k, pre[k]]); }
		});
		const same = mergeOptionsIntoRecord({ ...rec, indiaSchool: other }, 'indiachart', { indiaSchool: other });
		expect(same.indiaHsys).toBeUndefined();
	});
});

describe('平铺键撞名(school / method / mode / direction):探针结论 + 静态锁', ()=>{
	const TMS = require('../techniqueMountSettings');
	test('撞名表 = 已知四键;新撞名要么改成技法专属键名,要么确认各消费方都只认本技法值域(经 scrubForeignFlatValues)后登记', ()=>{
		const KNOWN = ['direction', 'method', 'mode', 'school'];
		const keys = TMS.sharedFlatRecordKeys();
		expect(keys.filter((k)=>KNOWN.indexOf(k) < 0)).toEqual([]);
		expect(keys).toContain('school');   // 量化盘 / 八字两派值域互不相交:求表本身没坏
	});
	test('探针:应用内触发不了 —— 齿轮覆盖并进记录是逐技法副本,原记录不变;存盘链不写平铺 school', ()=>{
		const rec = { cid: 'c1', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' };
		const g = TMS.mergeOptionsIntoRecord(rec, 'germany', { school: 'pure' });
		expect(g.school).toBe('pure');
		expect(rec.school).toBeUndefined();
		expect(TMS.effectiveMountBaseline('bazi', rec).school).toBe('zonghe');
		const { buildLocalChartRecord } = require('../localcharts');
		expect(buildLocalChartRecord({ name: 'x', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' }).school).toBeUndefined();
	});
	test('兜底:导入 / 手改的记录带着别的技法的值 —— 齿轮基线与重算都当没设', ()=>{
		const rec = { cid: 'c2', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', school: 'pure', method: 'book' };
		expect(TMS.isForeignFlatValue('bazi', 'school', 'pure')).toBe(true);
		expect(TMS.isForeignFlatValue('germany', 'school', 'pure')).toBe(false);
		expect(TMS.isForeignFlatValue('bazi', 'school', 'nonsense')).toBe(false);   // 哪派都不认的旧值:照旧(由各自归一处理,列「旧档」)
		expect(TMS.effectiveMountBaseline('bazi', rec).school).toBe('zonghe');
		expect(TMS.effectiveMountBaseline('germany', rec).school).toBe('pure');
		expect(TMS.effectiveMountBaseline('tieban', rec).method).toBe(fieldOf('tieban', 'method').default);
		expect(TMS.scrubForeignFlatValues('bazi', rec).school).toBeUndefined();
		expect(TMS.scrubForeignFlatValues('germany', rec)).toBe(rec);   // 没有外来值:原对象
		const { buildChartBaziParams } = require('../aiAnalysisContext/chartParams');
		expect(buildChartBaziParams(rec).school).toBeUndefined();
		const src = readSource(path.join(__dirname, '..', 'aiAnalysisContext', 'regenChart.js'));
		expect(src).toContain('record = scrubForeignFlatValues(normalizeTechniqueKey(key), record);');
	});
});


describe('塔罗「显示进阶对应」关着时,变体 / 现代行星注 / 宫廷两体系不出、不计、不下发(与页面、占象同一门控)', ()=>{
	const FOUR = ['variant', 'astroModern', 'courtElementSystem', 'courtZodiacSystem'];
	const PICK = { variant: 'C', astroModern: 1, courtElementSystem: 'alt', courtZodiacSystem: 'simple' };
	const recOf = (options)=>({ cid: 'tc', payload: JSON.stringify({ options: { seed: 'abc', spreadType: 'celtic', ...options } }) });
	// 抽屉同口径:草稿 = 现值缺省 + 本盘基线(不带基线的草稿另以第四参传基线,两条路都要认)
	const shownBoth = (name, rec)=>{
		const schema = getTechniqueSettingsSchema('tarot');
		const b = effectiveMountBaseline('tarot', rec);
		const viaDraft = isMountFieldVisible(fieldOf('tarot', name), { ...getTechniqueSettingsCurrentDefaults('tarot'), ...b }, schema);
		const viaBaseline = isMountFieldVisible(fieldOf('tarot', name), { ...getTechniqueSettingsCurrentDefaults('tarot') }, schema, b);
		expect([name, viaDraft]).toEqual([name, viaBaseline]);
		return viaDraft;
	};
	const shownMap = (rec)=>FOUR.reduce((acc, n)=>({ ...acc, [n]: shownBoth(n, rec) }), {});
	const allOf = (v)=>FOUR.reduce((acc, n)=>({ ...acc, [n]: v }), {});
	const OFF = [
		['显式关(缺省牌组)', { deckId: 'rws', settings: { showCorrespondences: false } }],
		['显式关(牌组缺省开的托特)', { deckId: 'thoth', settings: { showCorrespondences: false } }],
		['缺键 + 牌组缺省关(韦特)', { deckId: 'rws', settings: { dignities: true } }],
		['缺键 + 没存牌组(= 缺省牌组,缺省关)', { settings: {} }],
		['显式开但牌组不是塔罗读法(雷诺曼)', { deckId: 'lenormand', settings: { showCorrespondences: true } }],
	];
	const ON = [
		['显式开(缺省牌组)', { deckId: 'rws', settings: { showCorrespondences: true } }],
		['缺键 + 牌组缺省开(托特,变体 B)', { deckId: 'thoth', settings: {} }],
		['缺键 + 牌组缺省开(金色黎明,带元素尊位)', { deckId: 'golden_dawn', settings: { dignities: false } }],
	];
	test.each(OFF)('关着:%s → 四项都不显示;拨了也剪掉、不并进存档', (_n, options)=>{
		const rec = recOf(options);
		expect(shownMap(rec)).toEqual(allOf(false));
		const b = effectiveMountBaseline('tarot', rec);
		expect(pruneOptionsToNonDefault('tarot', PICK, b)).toEqual({});
		const { mergeOptionsIntoPayload } = require('../techniqueMountSettings');
		const payload = JSON.parse(rec.payload);
		const merged = mergeOptionsIntoPayload(payload, 'tarot', PICK);
		FOUR.forEach((n)=>{ expect([n, merged.options[n]]).toEqual([n, undefined]); });
		// 只读上下文键不进覆盖、不进存档
		expect(Object.keys(merged.options).filter((k)=>k.indexOf('__') === 0)).toEqual([]);
		// 同一次里拨别的(可见的)项照常下发
		expect(pruneOptionsToNonDefault('tarot', { ...PICK, quintMode: 'fool22' }, b)).toEqual({ quintMode: 'fool22' });
	});
	test.each(ON)('开着:%s → 四项都显示;拨了照常下发', (_n, options)=>{
		const rec = recOf(options);
		expect(shownMap(rec)).toEqual(allOf(true));
		const b = effectiveMountBaseline('tarot', rec);
		expect(pruneOptionsToNonDefault('tarot', PICK, b)).toEqual(PICK);
		const { mergeOptionsIntoPayload } = require('../techniqueMountSettings');
		const merged = mergeOptionsIntoPayload(JSON.parse(rec.payload), 'tarot', PICK);
		FOUR.forEach((n)=>{ expect([n, merged.options[n]]).toEqual([n, PICK[n]]); });
		expect(Object.keys(merged.options).filter((k)=>k.indexOf('__') === 0)).toEqual([]);
	});
	test('塔罗读法但牌组没有变体(埃特拉):宫廷两体系照出,变体 / 现代行星注不出(页面左栏同一组门控)', ()=>{
		expect(shownMap(recOf({ deckId: 'etteilla', settings: { showCorrespondences: true } }))).toEqual({ variant: false, astroModern: false, courtElementSystem: true, courtZodiacSystem: true });
		expect(shownMap(recOf({ deckId: 'etteilla', settings: { showCorrespondences: false } }))).toEqual(allOf(false));
	});
	test('不对应某张盘的宿主(同类默认 / 模板编辑、没有存档段):四项照出', ()=>{
		FOUR.forEach((n)=>{ expect([n, visible('tarot', n, {})]).toEqual([n, true]); });
		expect(shownMap({ cid: 'none' })).toEqual(allOf(true));
		expect(pruneOptionsToNonDefault('tarot', PICK, null)).toEqual(PICK);
	});
	test('门控与占象同一判据:逐牌组 × 开 / 关 / 缺键,齿轮显隐 = correspondenceOverlayOn(牌组能力, 解析后的开关)', ()=>{
		const { correspondenceOverlayOn } = require('../../components/tarot/engine/cardSchema');
		const { resolveSettings } = require('../../components/tarot/engine/reading');
		const { getDeck, listDeckIds } = require('../../components/tarot/engine/deckRegistry');
		let on = 0;
		let off = 0;
		listDeckIds().forEach((id)=>{
			[true, false, undefined].forEach((sc)=>{
				const deck = getDeck(id);
				const st = sc === undefined ? {} : { showCorrespondences: sc };
				const want = correspondenceOverlayOn(deck.caps, resolveSettings(deck, st).showCorrespondences);
				const got = shownMap(recOf({ deckId: id, settings: st }));
				expect([id, sc, got.courtElementSystem, got.courtZodiacSystem]).toEqual([id, sc, want, want]);
				expect([id, sc, got.variant, got.astroModern]).toEqual([id, sc, want && !!deck.caps.variant, want && !!deck.caps.variant]);
				if(want){ on += 1; }else{ off += 1; }
			});
		});
		expect(on).toBeGreaterThan(5);
		expect(off).toBeGreaterThan(5);
	});
	test('AI 起盘工具同口径:关着的盘上拨这四项报「此刻不显示」并写明由谁决定,开着的盘上不报', ()=>{
		const { hiddenCastOptions } = require('../aiTools/tools/castTechnique');
		const offRec = recOf({ deckId: 'rws', settings: { showCorrespondences: false } });
		const hid = hiddenCastOptions('tarot', FOUR, PICK, offRec);
		expect(hid.map((x)=>x.key)).toEqual(FOUR);
		hid.forEach((x)=>{
			expect(x.controlledBy.length).toBeGreaterThan(0);
			expect(x.message).toMatch(/显示进阶对应/);
			expect(x.message).not.toMatch(/__/);
		});
		expect(hiddenCastOptions('tarot', FOUR, PICK, recOf({ deckId: 'thoth', settings: {} }))).toEqual([]);
	});
	test('锁:四项的显示条件走存档门控,门控调 correspondenceOverlayOn(不另写一份判据)', ()=>{
		const src = readSource(path.join(__dirname, '..', 'techniqueMountSettings.js'));
		expect(src).toContain("import { correspondenceOverlayOn as tarotCorrespondenceOverlayOn } from '../components/tarot/engine/cardSchema';");
		const fn = src.match(/function tarotCorrespondenceContext\(options\)\{[\s\S]*?\n\}/);
		expect(fn).toBeTruthy();
		expect(fn[0]).toContain('tarotCorrespondenceOverlayOn(caps, resolveTarotSettings(deck, st).showCorrespondences)');
		expect(src).toContain('return { ...out, ...tarotCorrespondenceContext(o) };');
		expect(src.match(/readingMethod === 'tarot'/g)).toBeNull();   // 判据不在齿轮里另写
		expect(fieldOf('tarot', 'variant').showWhen).toBeDefined();
		const swSrc = FOUR.map((n)=>{
			const m = src.match(new RegExp(`\\{ name: '${n}', [^\\n]*showWhen: (tarotCorrespondenceShown\\('__tarotCorrespondence(?:On|Variant)'\\))`));
			return [n, m ? m[1] : null];
		});
		expect(swSrc).toEqual([
			['variant', "tarotCorrespondenceShown('__tarotCorrespondenceVariant')"],
			['astroModern', "tarotCorrespondenceShown('__tarotCorrespondenceVariant')"],
			['courtElementSystem', "tarotCorrespondenceShown('__tarotCorrespondenceOn')"],
			['courtZodiacSystem', "tarotCorrespondenceShown('__tarotCorrespondenceOn')"],
		]);
	});
});
