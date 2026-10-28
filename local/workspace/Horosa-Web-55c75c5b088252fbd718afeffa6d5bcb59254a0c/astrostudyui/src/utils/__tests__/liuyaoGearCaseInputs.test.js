// 六爻挂载齿轮换流派:存档事盘的占测事项 / 用神手选 / 本命年支是这一卦的事实,换派不改;
// 齿轮里显式改了的照改。其余流派口径键照套目标派预设。
import { mergeLiuyaoGearSettings } from '../aiAnalysisContext';
import { normalizeLiuyaoSettings } from '../../components/gua/liuyaoSchools';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

describe('六爻挂载齿轮换流派保留事盘输入', () => {
	const saved = { ...normalizeLiuyaoSettings(null), askType: 'wealth', yongOverride: '妻财', benming: '子' };

	test('换到邵伟华新派(预设自带「占测事项 = 自身」):事盘的占测事项 / 用神 / 本命不变,口径键照套', () => {
		const m = mergeLiuyaoGearSettings(saved, { school: 'xinpai' });
		expect(m.school).toBe('xinpai');
		expect(m.askType).toBe('wealth');
		expect(m.yongOverride).toBe('妻财');
		expect(m.benming).toBe('子');
		expect(m.guashen).toBe(false);
		expect(m.changshengUse).toBe('four');
		expect(m.shensha.on).toBe(false);
	});
	test('齿轮里显式改了占测事项 → 以齿轮为准', () => {
		expect(mergeLiuyaoGearSettings(saved, { school: 'xinpai', askType: 'career' }).askType).toBe('career');
	});
	test('存档没写这些键(旧事盘)→ 按目标派预设', () => {
		const old = normalizeLiuyaoSettings(null);
		delete old.askType;
		expect(mergeLiuyaoGearSettings(old, { school: 'xinpai' }).askType).toBe('self');
	});
});

describe('六爻齿轮覆盖像页面逐项改那样落', () => {
	const { applyPreset } = require('../../components/gua/liuyaoSchools');
	const { pruneOptionsToNonDefault, effectiveMountBaseline } = require('../techniqueMountSettings');
	test('存档「增删卜易」单改卦身 → 流派标自定义(页面同);改回与预设一致 → 仍是该派', () => {
		const zs = applyPreset('zengshan');
		expect(mergeLiuyaoGearSettings(zs, { guashen: true }).school).toBe('custom');
		expect(mergeLiuyaoGearSettings(zs, { guashen: false }).school).toBe('zengshan');
	});
	test('换派又改神煞起例:神煞以换派后的值为底(易隐的「文昌」不丢)', () => {
		const m = mergeLiuyaoGearSettings(normalizeLiuyaoSettings(null), { school: 'yiyin', shenshaBase: 'month' });
		expect(m.shensha.set).toContain('文昌');
		expect(m.shensha.base).toBe('month');
		expect(m.school).toBe('custom');
	});
	test('🔴 换派 + 某项等于存档值:剪枝按目标预设作基准,覆盖不被剪掉(此前剪掉 → 重算按预设出)', () => {
		const stored = { ...normalizeLiuyaoSettings(null), guashen: false };
		const rec = { cid: 'ly1', payload: JSON.stringify({ gua: { yao: [], liuyaoSettings: stored } }) };
		const b = effectiveMountBaseline('sixyao', rec);
		expect(b.guashen).toBe(false);
		const pr = pruneOptionsToNonDefault('sixyao', { school: 'yiyin', guashen: false }, b);
		expect(pr).toEqual({ school: 'yiyin', guashen: false });
		const m = mergeLiuyaoGearSettings(stored, pr);
		expect(m.guashen).toBe(false);
		expect(m.fushen).toBe('all');
		expect(m.school).toBe('custom');
		// 不换派时照旧:等于存档的项剪掉
		expect(pruneOptionsToNonDefault('sixyao', { guashen: false }, b)).toEqual({});
	});
	test('没拨任何项:存档原样返回(不归一)', () => {
		const raw = { school: 'zengshan', guashen: false };
		expect(mergeLiuyaoGearSettings(raw, {})).toEqual(raw);
	});
});

// AI 挂载抽屉的草稿是整张(缺省 + 盘现状 + 会话覆盖)。只换流派时草稿要跟着套目标预设,
// 否则存档旧细项与「按预设作的剪枝基准」一比全成了显式覆盖 → 结果成了自定义 + 旧细项。
describe('六爻抽屉整张草稿:只换流派 = 纯换派', () => {
	const { LIUYAO_PRESETS, LIUYAO_SCHOOL_OPTIONS } = require('../../components/gua/liuyaoSchools');
	const TMS = require('../techniqueMountSettings');
	const drawerDraft = (rec)=>({ ...TMS.getTechniqueSettingsDefaults('sixyao'), ...TMS.effectiveMountBaseline('sixyao', rec) });
	const recOf = (ls)=>({ cid: 'ly-d', payload: JSON.stringify(ls ? { gua: { yao: [], liuyaoSettings: ls } } : { gua: { yao: [] } }) });
	const stored = { ...normalizeLiuyaoSettings(null), askType: 'wealth', yongOverride: '妻财', benming: '子' };
	const targets = LIUYAO_SCHOOL_OPTIONS.map((o)=>o.value).filter((v)=>v !== 'custom' && v !== stored.school && LIUYAO_PRESETS[v]);

	test('每个目标派:剪枝结果恰为 { school },合并后 = 该派预设(输入键留存档值)', () => {
		expect(targets.length).toBeGreaterThan(3);
		const rec = recOf(stored);
		targets.forEach((school)=>{
			const draft = TMS.applyTechniqueDraftChange('sixyao', drawerDraft(rec), 'school', school);
			const pr = TMS.pruneOptionsToNonDefault('sixyao', draft, TMS.effectiveMountBaseline('sixyao', rec));
			expect([school, pr]).toEqual([school, { school }]);
			const m = mergeLiuyaoGearSettings(stored, pr);
			expect(m.school).toBe(school);
			expect([m.askType, m.yongOverride, m.benming]).toEqual(['wealth', '妻财', '子']);
		});
	});
	test('换派后再把某项拨回存档值:这一项保留为覆盖(结果是自定义,与页面同)', () => {
		const rec = recOf(stored);
		let draft = TMS.applyTechniqueDraftChange('sixyao', drawerDraft(rec), 'school', 'zengshan');
		expect(draft.guashen).toBe(LIUYAO_PRESETS.zengshan.overrides.guashen === undefined ? stored.guashen : LIUYAO_PRESETS.zengshan.overrides.guashen);
		draft = TMS.applyTechniqueDraftChange('sixyao', draft, 'guashen', !draft.guashen);
		const pr = TMS.pruneOptionsToNonDefault('sixyao', draft, TMS.effectiveMountBaseline('sixyao', rec));
		expect(Object.keys(pr).sort()).toEqual(['guashen', 'school']);
	});
	test('存档段缺席(旧事盘没存判读设置):抽屉剪枝与合并时内层剪枝同锚,只换派同样恰为 { school }', () => {
		const rec = recOf(null);
		const draft = TMS.applyTechniqueDraftChange('sixyao', drawerDraft(rec), 'school', 'zengshan');
		const outer = TMS.pruneOptionsToNonDefault('sixyao', draft, TMS.effectiveMountBaseline('sixyao', rec));
		expect(outer).toEqual({ school: 'zengshan' });
		// 换派 + 卦身取反:外层留下的覆盖,合并时内层也留得住
		const flip = { school: 'zengshan', guashen: !TMS.applyTechniqueDraftChange('sixyao', drawerDraft(rec), 'school', 'zengshan').guashen };
		const outer2 = TMS.pruneOptionsToNonDefault('sixyao', flip, TMS.effectiveMountBaseline('sixyao', rec));
		const inner2 = TMS.pruneOptionsToNonDefault('sixyao', flip, null);
		expect(inner2).toEqual(outer2);
		expect(outer2.guashen).toBe(flip.guashen);
	});
	test('抽屉宿主改一项经 applyTechniqueDraftChange(整张草稿才有联动)', () => {
		const src = readSource(require('path').join(__dirname, '../../components/aianalysis/AIAnalysisMain.js'));
		expect(src).toContain('setTechniqueSettingsDraft((prev)=>applyTechniqueDraftChange(k, prev, name, value));');
	});
	test('非流派字段与无联动的技法:只改这一项', () => {
		const d = { a: 1, guashen: false };
		expect(TMS.applyTechniqueDraftChange('sixyao', d, 'guashen', true)).toEqual({ a: 1, guashen: true });
		expect(TMS.applyTechniqueDraftChange('qimen', { x: 1 }, 'timeAlg', 1)).toEqual({ x: 1, timeAlg: 1 });
	});
});

// 抽屉第二次打开 / 带同类默认打开 / 换案例沿用会话覆盖:草稿初值 = 底稿(缺省 + 盘现状)叠覆盖。覆盖里换了流派时
// 先按联动规则在底稿上换派再叠覆盖 —— 直接摊在存档旧细项上,草稿就是「新派 + 旧派细项」,再点应用结果变成自定义 + 旧细项
describe('六爻抽屉重开:草稿按联动合成,应用幂等', () => {
	const { LIUYAO_PRESETS, LIUYAO_SCHOOL_OPTIONS } = require('../../components/gua/liuyaoSchools');
	const TMS = require('../techniqueMountSettings');
	const drawerBase = (rec)=>({ ...TMS.getTechniqueSettingsDefaults('sixyao'), ...TMS.effectiveMountBaseline('sixyao', rec) });
	const recOf = (ls)=>({ cid: 'ly-r', payload: JSON.stringify({ gua: { yao: [], liuyaoSettings: ls } }) });
	const stored = { ...normalizeLiuyaoSettings(null), askType: 'wealth', yongOverride: '妻财', benming: '子' };
	const prune = (rec, d)=>TMS.pruneOptionsToNonDefault('sixyao', d, TMS.effectiveMountBaseline('sixyao', rec));
	const targets = LIUYAO_SCHOOL_OPTIONS.map((o)=>o.value).filter((v)=>v !== 'custom' && v !== stored.school && LIUYAO_PRESETS[v]);

	test('每个目标派:应用 → 重开 → 剪枝恒等于会话覆盖', () => {
		const rec = recOf(stored);
		targets.forEach((school)=>{
			const first = prune(rec, TMS.applyTechniqueDraftChange('sixyao', drawerBase(rec), 'school', school));
			expect(first).toEqual({ school });
			const reopened = TMS.composeTechniqueDraft('sixyao', drawerBase(rec), first);
			expect([school, prune(rec, reopened)]).toEqual([school, first]);
			// 重开后显示的细项 = 该派的值(与第一次应用的结果一致),输入键仍是存档值
			const m = mergeLiuyaoGearSettings(stored, first);
			expect(reopened.guashen).toBe(m.guashen);
			expect(reopened.shenshaOn).toBe(!!(m.shensha && m.shensha.on));
			expect([reopened.askType, reopened.yongOverride, reopened.benming]).toEqual(['wealth', '妻财', '子']);
		});
	});
	test('换派 + 细项的覆盖原样;同派不联动;无流派覆盖 = 原样叠加', () => {
		const rec = recOf(stored);
		const zsGuashen = TMS.applyTechniqueDraftChange('sixyao', drawerBase(rec), 'school', 'zengshan').guashen;
		const ov = { school: 'zengshan', guashen: !zsGuashen };
		expect(prune(rec, TMS.composeTechniqueDraft('sixyao', drawerBase(rec), ov))).toEqual(ov);
		expect(prune(rec, TMS.composeTechniqueDraft('sixyao', drawerBase(rec), { school: stored.school }))).toEqual({});
		expect(TMS.composeTechniqueDraft('sixyao', drawerBase(rec), { fushen: 'all' })).toEqual({ ...drawerBase(rec), fushen: 'all' });
		expect(TMS.composeTechniqueDraft('qimen', { a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
	});
	test('反向:旧做法(覆盖直接摊在存档旧细项上)重开即多出覆盖项 —— 证明上面两条判得出', () => {
		const rec = recOf(stored);
		const naive = { ...drawerBase(rec), school: 'zengshan' };
		expect(Object.keys(prune(rec, naive)).length).toBeGreaterThan(1);
	});
	test('抽屉打开走合成', () => {
		const src = readSource(require('path').join(__dirname, '../../components/aianalysis/AIAnalysisMain.js'));
		expect(src).toContain('setTechniqueSettingsDraft(composeTechniqueDraft(k, { ...base, ...chartBaseline }, eff || {}));');
	});
});
