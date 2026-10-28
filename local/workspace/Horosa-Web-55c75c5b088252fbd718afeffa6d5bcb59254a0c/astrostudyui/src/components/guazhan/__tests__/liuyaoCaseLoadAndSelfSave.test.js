// 六爻:载入事盘带来的断卦设置只用于本次盘面,不写本机记忆(此前载入一条盲派事盘,重开本页就成了盲派;
// 载入没存设置的旧事盘,全部设置连同随机前确认 / 改爻快捷键等体验项被清回出厂)。亲手改(切流派 / 改单项 / 恢复默认)照常落盘;
// 载入之后再亲手改,记住的是原先记住的那一套叠上这次改动(载入带来的流派与其余各项不记)。
// 「存为事盘」后当前事盘变成刚存的那条:那不是载入,本页不据此还原(此前存完第一次摇卦被停在第一帧)。
import GuaZhanMain from '../GuaZhanMain';
import { setGlobalStore } from '../../../utils/storageutil';
import { applyPreset, factoryLiuyaoSettings, loadPersistedLiuyaoSettings, persistLiuyaoSettings, normalizeLiuyaoSettings, applySelectionDelta, selectionDelta } from '../../gua/liuyaoSchools';
import { SHENSHA_META, DEFAULT_SHENSHA_SET } from '../../gua/liuyaoShenSha';

const LS_KEY = 'horosa.liuyao.settings.v1';
const YAO = [{ value: 1 }, { value: 0 }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 1 }];

function makeInst(){
	const inst = new GuaZhanMain({ fields: null, dispatch: ()=>{} });
	inst.setState = (st, cb)=>{
		const prevState = inst.state;
		inst.state = { ...inst.state, ...(typeof st === 'function' ? st(inst.state) : st) };
		if(cb){ cb(); }
		inst.componentDidUpdate({ fields: null }, prevState);   // 与真页一样:每次更新后走一遍 didUpdate
	};
	inst.requestNongli = (f, cb)=>{ if(cb){ cb(); } };
	inst.requestGuaDesc = ()=>{};
	inst.genFields = ()=>({});
	return inst;
}
// applied:显式载入的那条(applyCase 写的 appliedCaseCid);缺省 = 就是这条
const caseStore = (cid, seq, gua, applied)=>({ user: { caseApplySeq: seq, appliedCaseCid: applied === undefined ? cid : applied, currentCase: {
	cid: { value: cid }, updateTime: { value: `t-${cid}` }, sourceModule: { value: 'guazhan' }, caseType: { value: 'liuyao' },
	payload: { value: JSON.stringify({ gua: { yao: YAO, currentGua: 5, guaOrigin: 'cast', nongli: { dayGanZi: '甲子' }, ...(gua || {}) } }) } } } });

afterEach(()=>{ setGlobalStore({}); localStorage.removeItem(LS_KEY); });

describe('载入事盘不写断卦设置的本机记忆', ()=>{
	test('🔴 载入盲派事盘:本次盘面是盲派,本机记忆仍是你的', ()=>{
		const mine = { ...applyPreset('zengshan'), randomConfirm: true };
		persistLiuyaoSettings(mine);
		const before = localStorage.getItem(LS_KEY);
		const inst = makeInst();
		setGlobalStore(caseStore('c-mang', 1, { liuyaoSettings: applyPreset('mangpai') }));
		inst.restoreFromCurrentCase(true);
		expect(inst.state.liuyaoSettings.school).toBe('mangpai');
		expect(localStorage.getItem(LS_KEY)).toBe(before);
	});
	test('🔴 载入没存设置的旧事盘:本次盘面回出厂,本机记忆不被清', ()=>{
		persistLiuyaoSettings({ ...applyPreset('yiyin'), randomConfirm: true });
		const before = localStorage.getItem(LS_KEY);
		const inst = makeInst();
		setGlobalStore(caseStore('c-old', 2));
		inst.restoreFromCurrentCase(true);
		expect(inst.state.liuyaoSettings.school).toBe('default');
		expect(localStorage.getItem(LS_KEY)).toBe(before);
		expect(loadPersistedLiuyaoSettings().school).toBe('yiyin');
	});
	test('亲手改照常落盘:切流派 / 改单项 / 恢复默认', ()=>{
		const inst = makeInst();
		inst.changeLiuyaoPreset('mangpai');
		expect(loadPersistedLiuyaoSettings().school).toBe('mangpai');
		inst.changeLiuyaoOption('randomConfirm', true);
		expect(loadPersistedLiuyaoSettings().randomConfirm).toBe(true);
		inst.setLiuyaoSettingsByUser(()=>applyPreset('default'));
		expect(loadPersistedLiuyaoSettings().school).toBe('default');
	});
	test('🔴 载入之后再亲手改一项:记住的是原先那一套叠上这一项,载入带来的流派不记;盘面仍是事盘那一套叠上改动', ()=>{
		const mine = applyPreset('zengshan');
		persistLiuyaoSettings(mine);
		const inst = makeInst();
		setGlobalStore(caseStore('c-mang2', 3, { liuyaoSettings: { ...applyPreset('mangpai'), askType: 'wealth' } }));
		inst.restoreFromCurrentCase(true);
		inst.changeLiuyaoOption('randomConfirm', true);
		const saved = loadPersistedLiuyaoSettings();
		expect(saved.randomConfirm).toBe(true);
		expect(saved.school).toBe('zengshan');
		expect(saved.bianyaoScope).toBe(mine.bianyaoScope);
		expect(saved.askType).toBe(mine.askType);
		expect([inst.state.liuyaoSettings.school, inst.state.liuyaoSettings.bianyaoScope, inst.state.liuyaoSettings.randomConfirm]).toEqual(['mangpai', 'blind', true]);
		// 逐卦输入(占测事项)同理:只记这一项
		inst.changeLiuyaoOption('askType', 'career');
		const saved2 = loadPersistedLiuyaoSettings();
		expect([saved2.askType, saved2.school, saved2.randomConfirm]).toEqual(['career', 'zengshan', true]);
		expect(inst.state.liuyaoSettings.school).toBe('mangpai');
	});
	test('载入之后套流派 / 恢复默认:作用在记住的那一套上(流派预设保留你记住的输入与体验项)', ()=>{
		persistLiuyaoSettings({ ...applyPreset('zengshan'), randomConfirm: true });
		const inst = makeInst();
		setGlobalStore(caseStore('c-mang3', 4, { liuyaoSettings: { ...applyPreset('mangpai'), yaoHotkeys: false, randomConfirm: false } }));
		inst.restoreFromCurrentCase(true);
		inst.changeLiuyaoPreset('yiyin');
		const saved = loadPersistedLiuyaoSettings();
		expect([saved.school, saved.randomConfirm]).toEqual(['yiyin', true]);
		expect(inst.state.liuyaoSettings.randomConfirm).toBe(false);
		inst.setLiuyaoSettingsByUser(()=>factoryLiuyaoSettings());
		expect(loadPersistedLiuyaoSettings()).toEqual(factoryLiuyaoSettings());
	});
	test('从没记过设置时载入再改一项:记住的是出厂那一套叠上这一项', ()=>{
		const inst = makeInst();
		setGlobalStore(caseStore('c-mang4', 5, { liuyaoSettings: applyPreset('mangpai') }));
		inst.restoreFromCurrentCase(true);
		inst.changeLiuyaoOption('randomConfirm', true);
		const saved = loadPersistedLiuyaoSettings();
		expect([saved.school, saved.bianyaoScope, saved.randomConfirm]).toEqual(['default', factoryLiuyaoSettings().bianyaoScope, true]);
	});
	test('没载入过事盘:亲手改照旧整份落盘当前那一套(零回归)', ()=>{
		persistLiuyaoSettings(applyPreset('zengshan'));
		const inst = makeInst();
		inst.changeLiuyaoOption('randomConfirm', true);
		expect(loadPersistedLiuyaoSettings()).toEqual({ ...inst.state.liuyaoSettings, benming: inst.state.liuyaoSettings.benming || '' });
	});
});

// 多选「改一项」:onChange 交来的是「盘面那一组 ± 这一项」整组。盘面那组来自载入的事盘时,不能整组写进本机记忆
// (此前记住的基础神煞变成事盘那组 ± 这一项,流派也随之翻成「自定义」)。按真页面元素树取多选框 onChange 实拨。
// 本页源码 JSX 不显式 import React(构建期注入),元素树单测里补上
global.React = global.React || require('react');
function findElements(node, pred, out = []){
	if(!node || typeof node !== 'object'){ return out; }
	if(Array.isArray(node)){ node.forEach((n)=>findElements(n, pred, out)); return out; }
	if(node.props){
		if(pred(node)){ out.push(node); }
		findElements(node.props.children, pred, out);
	}
	return out;
}
const groupOf = (inst, firstOption)=>{
	inst.state = { ...inst.state, shenshaModalOpen: true };
	const groups = findElements(inst.renderShenshaModal(), (el)=>Array.isArray(el.props.options) && typeof el.props.onChange === 'function');
	return groups.find((g)=>g.props.options[0] && g.props.options[0].value === firstOption);
};
const relatedCheckbox = (inst, label)=>findElements(inst.renderLiuyaoSettings(), (el)=>el.props.children === label && typeof el.props.onChange === 'function')[0];
const caseLiuyao = (patch)=>({ ...factoryLiuyaoSettings(), ...patch });

describe('载入事盘后多选改一项:按增量叠到本机记住的那一组上', ()=>{
	test('🔴 基础神煞:记住的 = 原先那组 + 这一项,流派不被事盘那组翻成「自定义」;盘面 = 事盘那组 + 这一项', ()=>{
		persistLiuyaoSettings(factoryLiuyaoSettings());
		const inst = makeInst();
		const caseSet = ['驿马', '桃花'];
		setGlobalStore(caseStore('c-ss1', 11, { liuyaoSettings: caseLiuyao({ shensha: { on: true, set: caseSet, base: 'day' } }) }));
		inst.restoreFromCurrentCase(true);
		const group = groupOf(inst, SHENSHA_META[0].name);
		const extra = SHENSHA_META.map((m)=>m.name).find((n)=>DEFAULT_SHENSHA_SET.indexOf(n) < 0);
		group.props.onChange(SHENSHA_META.map((m)=>m.name).filter((n)=>caseSet.concat([extra]).indexOf(n) >= 0));   // 多选框按选项序交整组
		const saved = loadPersistedLiuyaoSettings();
		expect(saved.shensha.set).toEqual(applySelectionDelta(DEFAULT_SHENSHA_SET, { add: [extra] }, SHENSHA_META.map((m)=>m.name)));
		expect(saved.shensha.set.length).toBe(DEFAULT_SHENSHA_SET.length + 1);
		expect(new Set(inst.state.liuyaoSettings.shensha.set)).toEqual(new Set(caseSet.concat([extra])));
	});
	test('🔴 基础神煞去掉一项:记住的 = 原先那组 − 这一项(事盘里没有的那些仍在)', ()=>{
		persistLiuyaoSettings(factoryLiuyaoSettings());
		const inst = makeInst();
		setGlobalStore(caseStore('c-ss2', 12, { liuyaoSettings: caseLiuyao({ shensha: { on: true, set: ['驿马', '桃花'], base: 'day' } }) }));
		inst.restoreFromCurrentCase(true);
		groupOf(inst, SHENSHA_META[0].name).props.onChange(['桃花']);
		const saved = loadPersistedLiuyaoSettings();
		expect(saved.shensha.set).toEqual(DEFAULT_SHENSHA_SET.filter((n)=>n !== '驿马'));
		expect(inst.state.liuyaoSettings.shensha.set).toEqual(['桃花']);
	});
	test('🔴 扩展神煞(记住的为 null = 全选):记住的 = 全组 − 这一项', ()=>{
		persistLiuyaoSettings(factoryLiuyaoSettings());
		const inst = makeInst();
		inst.state = { ...inst.state, shenshaModalOpen: true };
		const exGroup0 = findElements(inst.renderShenshaModal(), (el)=>Array.isArray(el.props.options) && typeof el.props.onChange === 'function')[1];
		const exAll = exGroup0.props.options.map((o)=>o.value);
		setGlobalStore(caseStore('c-ss3', 13, { liuyaoSettings: caseLiuyao({ shenshaEx: { on: true, set: exAll.slice(0, 3) } }) }));
		inst.restoreFromCurrentCase(true);
		const exGroup = groupOf(inst, exAll[0]);
		exGroup.props.onChange(exAll.slice(1, 3));
		const saved = loadPersistedLiuyaoSettings();
		expect(saved.shenshaEx.set).toEqual(exAll.slice(1));
		expect(inst.state.liuyaoSettings.shenshaEx.set).toEqual(exAll.slice(1, 3));
	});
	test('🔴 关联卦显示:事盘只显之卦,勾上互卦 → 记住的仍是全显(null),不变成「之卦 + 互卦」', ()=>{
		persistLiuyaoSettings(factoryLiuyaoSettings());
		const inst = makeInst();
		setGlobalStore(caseStore('c-rc', 14, { liuyaoSettings: caseLiuyao({ relatedCards: ['bian'] }) }));
		inst.restoreFromCurrentCase(true);
		relatedCheckbox(inst, '互卦').props.onChange({ target: { checked: true } });
		expect(loadPersistedLiuyaoSettings().relatedCards).toBe(null);
		expect(inst.state.liuyaoSettings.relatedCards).toEqual(['bian', 'hu']);
		relatedCheckbox(inst, '错卦').props.onChange({ target: { checked: false } });
		expect(loadPersistedLiuyaoSettings().relatedCards).toEqual(['bian', 'hu', 'fu', 'zong']);
	});
	test('没载入过事盘:去掉再勾回同一项,整组按选项序回原样,与多选框交来的一组逐项相同(零回归)', ()=>{
		persistLiuyaoSettings(factoryLiuyaoSettings());
		const inst = makeInst();
		const shown = normalizeLiuyaoSettings(inst.state.liuyaoSettings).shensha.set;
		groupOf(inst, SHENSHA_META[0].name).props.onChange(shown.filter((n)=>n !== '桃花'));
		expect(loadPersistedLiuyaoSettings().school).toBe('custom');
		groupOf(inst, SHENSHA_META[0].name).props.onChange(SHENSHA_META.map((m)=>m.name).filter((n)=>shown.indexOf(n) >= 0));
		const saved = loadPersistedLiuyaoSettings();
		expect(saved.shensha.set).toEqual(DEFAULT_SHENSHA_SET);
		expect(inst.state.liuyaoSettings.shensha.set).toEqual(DEFAULT_SHENSHA_SET);
	});
	test('增量助手:加 / 去 / 顺序按选项表', ()=>{
		const U = ['a', 'b', 'c', 'd'];
		expect(selectionDelta(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] });
		expect(applySelectionDelta(['d', 'a'], { add: ['b'], remove: ['d'] }, U)).toEqual(['a', 'b']);
		expect(applySelectionDelta(['x', 'c'], { add: ['a'] }, U)).toEqual(['a', 'c', 'x']);
	});
});

describe('存为事盘 / 编辑后不把当前事盘当载入还原(只认显式载入)', ()=>{
	test('🔴 存完:卦象与翻动不被还原打断;之后在列表里载入这条照常还原', ()=>{
		setGlobalStore({ user: { caseApplySeq: 4, currentCase: null } });
		const inst = makeInst();
		inst.state = { ...inst.state, currentGua: 9, yao: inst.emptyYao() };
		setGlobalStore(caseStore('ly-new', 4, null, null));   // 存为事盘:当前事盘换成刚存的那条,代次不变、不是显式载入
		inst.guaPeriodTask = setInterval(()=>{}, 100000);   // 存完马上点了整卦随机
		inst.restoreFromCurrentCase();
		expect(inst.state.currentGua).toBe(9);
		expect(inst.guaPeriodTask).not.toBe(null);
		clearInterval(inst.guaPeriodTask); inst.guaPeriodTask = null;
		setGlobalStore(caseStore('ly-new', 5));   // 列表里点载入这条
		inst.restoreFromCurrentCase();
		expect(inst.state.currentGua).toBe(5);
	});
	test('挂载(force)也只还原显式载入的那条:刚存下的那条不还原', ()=>{
		setGlobalStore(caseStore('ly-new2', 1, null, null));
		const inst = makeInst();
		const before = inst.state.currentGua;
		inst.restoreFromCurrentCase(true);
		expect(inst.state.currentGua).toBe(before);
	});
	test('载入 A 后在列表里点 B 的「编辑」:页面仍是 A;保存编辑换了更新时间也不重还原', ()=>{
		const inst = makeInst();
		setGlobalStore(caseStore('ly-a', 3));
		inst.restoreFromCurrentCase();
		expect(inst.state.currentGua).toBe(5);
		inst.setState({ currentGua: 11 });
		setGlobalStore(caseStore('ly-b', 3, { currentGua: 7 }, 'ly-a'));   // 编辑 B:当前事盘 = B,显式载入的仍是 A
		inst.restoreFromCurrentCase();
		expect(inst.state.currentGua).toBe(11);
		const edited = caseStore('ly-a', 3, { currentGua: 7 });
		edited.user.currentCase.updateTime = { value: 't-edited' };   // 保存编辑:更新时间换了
		setGlobalStore(edited);
		inst.restoreFromCurrentCase();
		expect(inst.state.currentGua).toBe(11);
	});
	test('同一条在列表里点载入两次:两次都还原', ()=>{
		const inst = makeInst();
		setGlobalStore(caseStore('ly-x', 1));
		inst.restoreFromCurrentCase();
		expect(inst.state.currentGua).toBe(5);
		inst.setState({ currentGua: 12 });
		setGlobalStore(caseStore('ly-x', 2));
		inst.restoreFromCurrentCase();
		expect(inst.state.currentGua).toBe(5);
	});
});
