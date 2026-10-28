import React, { Component } from 'react';
import { scheduleOptionDispatch } from '../../utils/optionDispatchScheduler';
import { classicalBackendOverridesFromFields } from '../../utils/classicalChartGlobals';
import { userAyanParamsFrom } from '../../utils/customCalibreStores';   // 自定义恒星黄道历元两参
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, } from 'antd';
import { XQButton as Button, XQSearch as Search, XQTabs as Tabs } from '../xq-ui';
import ChartSearchModal from './ChartSearchModal'
import { registerWorkspaceUi } from '../../utils/aiTools/workspaceBridge';
import { RELATIVE_SUBTABS, rememberSubTab } from '../../constants/SubTabRegistry';
import AstroCompare from '../relative/AstroCompare'
import AstroComposite from '../relative/AstroComposite'
import AstroSynastry from '../relative/AstroSynastry'
import AstroTimeSpace from '../relative/AstroTimeSpace'
import AstroMarks from '../relative/AstroMarks'
import AstroRelativeScore from '../relative/AstroRelativeScore'
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import { astroMsgText as msg } from './AstroHelper';
import { buildAstroSnapshotContent, } from '../../utils/astroAiSnapshot';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { recordSeedsForFieldWrite } from '../../utils/newChartSeeds';
import { createDeferredResizeObserver } from '../../utils/deferredResizeObserver';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const TabPane = Tabs.TabPane;

function round3(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '';
	}
	return `${Math.round(Number(val) * 1000) / 1000}`;
}

function aspectText(asp){
	const n = Number(asp);
	if(Number.isNaN(n)){
		return `${asp || ''}`;
	}
	return `${n}˚`;
}

function relationNameByKey(key){
	if(key === 'Comp'){
		return '比较盘';
	}
	if(key === 'Composite'){
		return '组合盘';
	}
	if(key === 'Synastry'){
		return '影响盘';
	}
	if(key === 'TimeSpace'){
		return '时空中点盘';
	}
	if(key === 'Marks'){
		return '马克斯盘';
	}
	return key || '合盘';
}

function pushAspectArray(lines, title, list){
	if(!list || list.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	lines.push('| 星A | 星B | 相位 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	list.forEach((obj)=>{
		const objId = obj.id !== undefined ? obj.id : obj.directId;
		const objs = obj.objects || [];
		if(objs.length === 0){
			lines.push(`| ${msg(objId)} | 无 | — | — |`);
			return;
		}
		objs.forEach((natalObj, k)=>{
			const natalId = natalObj.id !== undefined ? natalObj.id : natalObj.natalId;
			lines.push(`| ${k === 0 ? msg(objId) : '—'} | ${msg(natalId)} | ${aspectText(natalObj.aspect)} | ${round3(natalObj.delta)} |`);
		});
	});
}

function pushMidpointMap(lines, title, mapObj){
	if(!mapObj){
		return;
	}
	const keys = Object.keys(mapObj);
	if(keys.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	lines.push('| 星A | 中点 | 相位 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	keys.forEach((key)=>{
		const arr = mapObj[key] || [];
		if(arr.length === 0){
			lines.push(`| ${msg(key)} | 无 | — | — |`);
			return;
		}
		arr.forEach((asp, k)=>{
			const midpoint = asp.midpoint || {};
			lines.push(`| ${k === 0 ? msg(key) : '—'} | ${msg(midpoint.idA)}·${msg(midpoint.idB)} | ${aspectText(asp.aspect)} | ${round3(asp.delta)} |`);
		});
	});
}

function pushAntisciaArray(lines, title, arr, typeLabel){
	if(!arr || arr.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	lines.push('| 星A | 星B | 相位 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	arr.forEach((item)=>{
		lines.push(`| ${msg(item.idA)} | ${msg(item.idB)} | ${typeLabel} | ${round3(item.delta)} |`);
	});
}

export function buildRelativeSnapshotText(comp){
	const lines = [];
	const relationName = relationNameByKey(comp.currentTab);
	const res = comp.result || {};

	lines.push('[关系起盘信息]');
	lines.push(`盘型：${relationName}`);
	if(comp.chartA && comp.chartA.record){
		lines.push(`星盘A：${comp.chartA.record.name} ${comp.chartA.record.birth}`);
		lines.push(`星盘A经纬度：${comp.chartA.record.lon} ${comp.chartA.record.lat}`);
	}
	if(comp.chartB && comp.chartB.record){
		lines.push(`星盘B：${comp.chartB.record.name} ${comp.chartB.record.birth}`);
		lines.push(`星盘B经纬度：${comp.chartB.record.lon} ${comp.chartB.record.lat}`);
	}
	if(comp.params){
		// 出人话标签(此前直出数字「宫制：1」「黄道：0」);与主命盘快照 astroAiSnapshot 同源表
		const hsysTxt = AstroConst.HouseSys[`${comp.params.hsys}`] || comp.params.hsys;
		const zodRaw = AstroConst.ZODIACAL[`${comp.params.zodiacal}`] || comp.params.zodiacal;
		const zodTxt = AstroConst.ZODIACAL[`${comp.params.zodiacal}`]
			? AstroConst.zodiacalDisplayText(zodRaw, comp.params.siderealAyanamsa || '') : zodRaw;
		// 组合盘所选宫制合不出 / 属整宫一类时后端回落(带宫制说明与回显的实际宫制):表头如实写「所选 X,实际 Y」
		const actualHsys = (comp.currentTab === 'Composite' || comp.currentTab === 'TimeSpace') && res.compositeHouseNote && res.params
			&& res.params.hsys !== undefined && `${res.params.hsys}` !== `${comp.params.hsys}` ? res.params.hsys : undefined;
		lines.push(actualHsys !== undefined
			? `宫制：所选 ${hsysTxt},本盘实际 ${AstroConst.HouseSys[`${actualHsys}`] || actualHsys}`
			: `宫制：${hsysTxt}`);
		lines.push(`黄道：${zodTxt}`);
		// AI 双盘挂载:与合盘页一个左栏管两盘同 —— 两盘统一按星盘A(本人)的口径起;B 的单盘段按 B 自己的口径
		if(comp.params.unifiedByA){ lines.push('口径：两盘统一按星盘A的宫制 / 黄道 / 古典口径起盘(星盘B 的单盘段仍按它自己记录的口径)'); }
	}

	if(comp.currentTab === 'Comp'){
		pushAspectArray(lines, 'A对B相位', res.inToOutAsp);
		pushAspectArray(lines, 'B对A相位', res.outToInAsp);
		pushMidpointMap(lines, 'A对B中点相位', res.inToOutMidpoint);
		pushMidpointMap(lines, 'B对A中点相位', res.outToInMidpoint);
		pushAntisciaArray(lines, 'A对B映点', res.inToOutAnti, '映点');
		pushAntisciaArray(lines, 'A对B反映点', res.inToOutCAnti, '反映点');
		pushAntisciaArray(lines, 'B对A映点', res.outToInAnti, '映点');
		pushAntisciaArray(lines, 'B对A反映点', res.outToInCAnti, '反映点');
		// 比较盘页签此前只出互摄相位/中点/映点,无 A/B 两盘盘体 → AI 拿不到两人各自星位/宫位;
		// 响应自带 inner(=A)/outer(=B) 两盘(双轮盘即据此绘),仿影响盘无头嵌两张(段名独立,已登 preset)。
		if(res.inner && res.inner.chart){
			lines.push('');
			lines.push('[比较盘-星盘A]');
			lines.push(buildAstroSnapshotContent(res.inner, comp.params && comp.params.hsys !== undefined ? { hsys: comp.params.hsys } : null, { headerless: true }));
		}
		if(res.outer && res.outer.chart){
			lines.push('');
			lines.push('[比较盘-星盘B]');
			lines.push(buildAstroSnapshotContent(res.outer, comp.params && comp.params.hsys !== undefined ? { hsys: comp.params.hsys } : null, { headerless: true }));
		}
	}

	// [YD] 段名按盘型拆分:时空中点盘/马克斯盘此前与组合盘/影响盘共用段名 → 设置面永远无法
	// 分开勾选、导出文本不辨盘型。组合盘/影响盘保持原段名(老用户勾选/旧快照零影响),
	// 时空/马克斯用独立段名(纯增,已登 preset)。
	if((comp.currentTab === 'Composite' || comp.currentTab === 'TimeSpace') && res.chart){
		lines.push('');
		lines.push(comp.currentTab === 'TimeSpace' ? '[时空中点·合成图盘]' : '[合成图盘]');
		// 组合盘所选宫制合不出 / 属整宫一类时后端回落整宫并给说明:如实写进快照,宫制数字位改取回显的实际值。
		if(res.compositeHouseNote){ lines.push(`宫制说明：${res.compositeHouseNote}`); }
		// 合成盘响应无请求 fields:把工作台的宫制数字位喂进去,否则 [分宫制宫神星表] 只能靠后端回显文本反查——
		// hsys 8/24 的回显与 1/0 撞名(perchart 盘级回显),文本兜底会把福点整宫制误判为上升整宫制而折叠。
		const snapHsys = res.compositeHouseNote && res.params && res.params.hsys !== undefined ? res.params.hsys
			: (comp.params && comp.params.hsys !== undefined ? comp.params.hsys : undefined);
		lines.push(buildAstroSnapshotContent(res, snapHsys !== undefined ? { hsys: snapHsys } : null, { headerless: true }));
	}

	if((comp.currentTab === 'Synastry' || comp.currentTab === 'Marks') && (res.inner || res.outer)){
		const marks = comp.currentTab === 'Marks';
		if(res.inner && res.inner.chart){
			lines.push('');
			lines.push(marks ? '[马克斯·影响图盘-星盘A]' : '[影响图盘-星盘A]');
			lines.push(buildAstroSnapshotContent(res.inner, null, { headerless: true }));
		}
		if(res.outer && res.outer.chart){
			lines.push('');
			lines.push(marks ? '[马克斯·影响图盘-星盘B]' : '[影响图盘-星盘B]');
			lines.push(buildAstroSnapshotContent(res.outer, null, { headerless: true }));
		}
	}

	if(comp.currentTab === 'Score'){
		lines.push('');
		lines.push('[关系量化]');
		lines.push(`契合分数：${res.score !== undefined && res.score !== null ? res.score : '-'}（0–100，50 为中性；越高越顺畅，越低张力越大）`);
		const pushScoreAsps = (title, list)=>{
			const arr = (list || []).slice(0, 12);
			if(arr.length === 0){
				return;
			}
			lines.push('');
			lines.push(`[${title}]`);
			lines.push('| 星A | 星B | 相位 | 权重 | 误差 |');
			lines.push('| --- | --- | --- | --- | --- |');
			arr.forEach((it)=>{
				lines.push(`| ${msg(it.a)} | ${msg(it.b)} | ${aspectText(it.aspect)} | ${round3(it.impact)} | ${round3(it.orb)} |`);
			});
		};
		pushScoreAsps('顺畅连接', res.highlights);
		pushScoreAsps('张力连接', res.challenges);
	}
	return lines.join('\n');
}

// 合盘请求的古典口径段(与主盘 fieldsToParams 同款条件透传——默认不下发=请求体零回归;非默认才传)。
// 链路三层同批打通:此处 → Java ModernChartController 条件转发 → Python webmodernsrv.relative
// push_request_terms/trip + inner/outer 每盘键;五个子盘(比较/组合/时空中点/马克思/戴维森)全按所选界系/口径算尊贵。
// 独立成函数供 genParams 与 componentDidUpdate 的重排签名共用(单源,不再手抄键名清单)。
export function relativeClassicalParamsFromFields(f){
	const params = {};
	if(!f){ return params; }
	const fv = (k) => (f[k] && f[k].value !== undefined && f[k].value !== null ? f[k].value : undefined);
	if(fv('termsVariant')){ params.termsVariant = fv('termsVariant'); }
	if(fv('geminiBoundEmended')){ params.geminiBoundEmended = 1; }
	if(fv('westNodeType') === 'true'){ params.westNodeType = 'true'; }
	if(fv('sectBuffer') === 'ptolemy5'){ params.sectBuffer = 'ptolemy5'; }
	if(fv('leoBoundFirst') === 1 || fv('leoBoundFirst') === '1'){ params.leoBoundFirst = 1; }
	if(fv('triplicity') && fv('triplicity') !== 'Dorothean'){ params.triplicity = fv('triplicity'); }
	if(fv('lotReversal') === 0 || fv('lotReversal') === '0'){ params.lotReversal = 0; }
	// 2026-07 二批九键:共享 helper(键名含后端映射 starOrb/starOrbMode),默认不下发。
	Object.assign(params, classicalBackendOverridesFromFields(f));
	// 自定义恒星黄道 'user' 档随行历元两参(与本命 models/astro.js 同款;Java/Python 两层早已放行):
	// 此前不发 → 后端静默按 Lahiri 算、回显仍标自定义。
	if(`${fv('siderealAyanamsa')}` === 'user'){
		try{ Object.assign(params, userAyanParamsFrom(fv)); }catch(e){ /* 无槽=后端回落,与本命页同 */ }
	}
	return params;
}

// 古典口径签名(componentDidUpdate 用):同一 fields 引用恒等;内容变才触发合盘重排。
export function relativeClassicalSignature(f){
	try{ return JSON.stringify(relativeClassicalParamsFromFields(f)); }catch(e){ return ''; }
}

class AstroRelative extends Component{
	// 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}


	constructor(props) {
		super(props);
		this.state = {
			currentTab: 'Comp',
			currentRelative: 0,
			chartA: null,
			chartB: null,
			hook: {
				Comp:{
					txt:'比较盘',
					relative: 0,
					result: null,
					fun: null
				},
				Composite:{
					txt:'组合盘',
					relative: 1,
					result: null,
					fun: null
				},
				Synastry:{
					txt:'影响盘',
					relative: 2,
					result: null,
					fun: null
				},
				TimeSpace:{
					txt:'时空中点盘',
					relative: 3,
					result: null,
					fun: null
				},
					Marks:{
						txt:'马克斯盘',
						relative: 4,
						result: null,
						fun: null
					},
					Score:{
						txt:'关系量化',
						relative: 0,
						result: null,
						fun: null
					},

			},
		}

		this.changeTab = this.changeTab.bind(this);
		this.selectChartA = this.selectChartA.bind(this);
		this.selectChartB = this.selectChartB.bind(this);
		this.clickDoChart = this.clickDoChart.bind(this);
		this.doChart = this.doChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.saveRelativeSnapshot = this.saveRelativeSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.handleRelativeOnChange = this.handleRelativeOnChange.bind(this);
		// 子盘高度动态测量:props.height 来自 models/astro.js 硬编码 660 从不随窗口尺寸变,
		// 导致大屏下「比较/组合/影响/时空中点/马克斯」5 子盘底部出现大块空白(原 fallback 760 同病)。
		// ResizeObserver 测真实 chart-row 容器高度,优先用测量值,既向后兼容(无值时仍用 props/旧 fallback)
		// 又自适应明暗主题/窗口缩放/侧栏开合。
		this.chartRowRef = React.createRef();
		this.measuredHeight = null;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					let res = hook[this.state.currentTab].result;
					hook[this.state.currentTab].fun(res);
				}
			};
		}

	}

	componentDidMount(){
		this._mounted = true;
		// 挂载即回写子页签(与星运页同律):导航层切到合盘时 recallSubTab 才不会沿用辅盘的 germanytech。
		rememberSubTab('relativechart', this.state.currentTab, RELATIVE_SUBTABS);
		if(this.props.dispatch && this.props.currentSubTab !== this.state.currentTab){
			this.props.dispatch({ type: 'astro/save', payload: { currentSubTab: this.state.currentTab } });
		}
		// 合盘配对面:AI 工具 compare_records 经工作区桥送两张命盘进来(与点「星盘A/星盘B」同一路径);卸载即注销
		this._unregisterAgentUi = registerWorkspaceUi({
			relative: {
				getPair: ()=>({ a: this.state.chartA && this.state.chartA.record ? this.state.chartA.record : null, b: this.state.chartB && this.state.chartB.record ? this.state.chartB.record : null, mode: this.state.currentTab }),
				setPair: (recA, recB, mode)=>{
					if(!recA || !recB){ return { ok: false, message: '两张命盘都要给' }; }
					if(mode && this.state.hook && this.state.hook[mode]){ this.changeTab(mode); }
					this.selectChartA({ ...recA });
					this.selectChartB({ ...recB });
					return { ok: true };
				},
				clearPair: ()=>{ this.setState({ chartA: null, chartB: null }); return { ok: true }; },
			},
		});
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 测真实 chart-row 容器高度并随窗口/侧栏变化自适应。
		if(typeof window !== 'undefined' && typeof window.ResizeObserver === 'function' && this.chartRowRef && this.chartRowRef.current){
			const el = this.chartRowRef.current;
			const measure = ()=>{
				try{
					// 量容器只用布局域读数(clientWidth/clientHeight);rect 域在标准化 zoom 引擎下已×z,当布局 px 用=盘面大 z 倍被裁(旧引擎 rect=布局值故不显)。
					const h = el.clientHeight || 0;
					if(h > 0 && Math.abs((this.measuredHeight || 0) - h) > 2){
						this.measuredHeight = h;
						this.forceUpdate();
					}
				}catch(e){}
			};
			measure();
			this.chartRowObserver = createDeferredResizeObserver(measure);   // 回调里 forceUpdate 改尺寸:延到下一帧,不构成回环
			if(this.chartRowObserver){ this.chartRowObserver.observe(el); }
		}
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof this._unregisterAgentUi === 'function'){ try{ this._unregisterAgentUi(); }catch(e){ /* noop */ } this._unregisterAgentUi = null; }
		if(this.chartRowObserver){
			this.chartRowObserver.disconnect();
			this.chartRowObserver = null;
		}
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// 子盘左栏「黄道/分宫制/恒星 ayanāṃśa / 流派预设」onChange:不能复用 changeCond(会先去 fetchByFields 拉一次本命盘,
	// 而本命盘 fields 与当前合盘用户视图无关→返回非 200 时静默不更新,fields 永远不变,中央盘没反应——本轮真因)。
	// 此处直接 astro/save 写入 fields,componentDidUpdate 会感知到字段变化并自动 doChart(),重拉 /modern/relative。
	// 流派预设一次带来的古典口径(界系 / 三分 / 点反转 / 区分缓冲 / 相位口径 / 点公式)与 changeCond 同款写法逐项落 fields:
	// 此前只认黄道 / 宫制 / 岁差三项 → 另外几项只进了全局仓,当前合盘不变、下拉随即反查成「自定」。
	handleRelativeOnChange(values){
		if(!values || !this.props.dispatch || !this.props.fields){
			return;
		}
		const flds = { ...this.props.fields };
		const delta = {};
		const put = (k, v)=>{
			flds[k] = { ...(flds[k] || { name: [k] }), value: v };
			delta[k] = { value: v, name: [k] };
		};
		const has = (k)=>values[k] !== undefined && values[k] !== null;
		const prevFields = this.props.fields;
		if(has('hsys') && flds.hsys){ put('hsys', values.hsys); }
		if(has('zodiacal') && flds.zodiacal){ put('zodiacal', values.zodiacal); }
		if(has('siderealAyanamsa')){ put('siderealAyanamsa', values.siderealAyanamsa); }
		if(has('termsVariant')){
			put('termsVariant', values.termsVariant);
			this.props.dispatch({ type: 'app/save', payload: { termsVariant: values.termsVariant } });
		}
		if(has('triplicity')){
			put('triplicity', values.triplicity);
			this.props.dispatch({ type: 'app/save', payload: { tripSystem: values.triplicity } });
		}
		if(has('lotReversal')){ put('lotReversal', values.lotReversal); }
		if(has('sectBuffer')){ put('sectBuffer', values.sectBuffer); }
		// 相位口径:整宫档传 null = 据实清空(回默认容许度表、不下发),与 changeCond 同律
		if(values.orbs !== undefined){ put('orbs', values.orbs === null ? undefined : values.orbs); }
		if(values.lotsDocReverse !== undefined){ put('lotsDocReverse', values.lotsDocReverse); }
		if(!Object.keys(delta).length){
			return;
		}
		// 合盘子盘改的是本命共用字段:宫制 / 黄道等亲手改动同样记作新命盘缺省(与主页同一口子语义)
		recordSeedsForFieldWrite(prevFields, flds, values);
		this.props.dispatch({
			type: 'astro/saveUserFields',
			payload: { fields: flds },
		});
		// 写了本命全局 fields 却不重排本命盘 → 回占星页左栏选中值与盘面 / 信息页不一致。
		// 先 save 再经选项调度器重取(与 ChartDisplaySelector 同律;失败不回滚 fields,合盘视图照常)。
		if(flds.date && flds.time && flds.lat && flds.lon){
			scheduleOptionDispatch((payload)=>{ this.props.dispatch({ type: 'astro/fetchByFields', payload }); }, delta, ()=>({ ...(this.props.fields || {}) }));
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(
			prevState.currentTab !== this.state.currentTab
			|| prevState.currentRelative !== this.state.currentRelative
			|| prevState.chartA !== this.state.chartA
			|| prevState.chartB !== this.state.chartB
			|| prevState.hook !== this.state.hook
		){
			this.saveRelativeSnapshot();
		}
		// 用户在子盘左栏改「黄道/分宫制/恒星 ayanāṃśa」→ models/astro.js fields 全局更新 → 经 props 流到本组件。
		// 但 doChart() 已绑定旧 fields,需在此 watch 并自动重新拉合盘,否则中央盘不会随选择变(用户反馈「点了没反应」真因之二)。
		const prevF = (prevProps && prevProps.fields) || {};
		const curF = (this.props && this.props.fields) || {};
		// 古典口径(界系/三分/点反转/区分缓冲/容许度族/自定义历元…)也随合盘请求下发 →
		// 任一项变了同样要重排,否则抽屉里改了只重排本命盘、合盘要手点「排盘」才吃到(帮助称「改任一口径都会自动重排」)。
		// 签名=genParams 古典段的 JSON(与请求体同源),不另列键名清单。
		const fieldChanged = (
			(prevF.zodiacal && curF.zodiacal && prevF.zodiacal.value !== curF.zodiacal.value)
			|| (prevF.hsys && curF.hsys && prevF.hsys.value !== curF.hsys.value)
			|| ((prevF.siderealAyanamsa && curF.siderealAyanamsa && prevF.siderealAyanamsa.value !== curF.siderealAyanamsa.value))
			|| (prevF !== curF && relativeClassicalSignature(prevF) !== relativeClassicalSignature(curF))
		);
		if(fieldChanged && this.state.chartA && this.state.chartB){
			this.doChart();
		}
	}

	saveRelativeSnapshot(){
		try{
			const currentHook = this.state.hook && this.state.hook[this.state.currentTab]
				? this.state.hook[this.state.currentTab]
				: null;
			const result = currentHook ? currentHook.result : null;
			if(!result){
				return '';
			}
			const params = this.genParams() || {};
			const snapshotText = buildRelativeSnapshotText({
				currentTab: this.state.currentTab,
				currentRelative: this.state.currentRelative,
				chartA: this.state.chartA,
				chartB: this.state.chartB,
				params,
				result,
			});
			if(!snapshotText){
				return '';
			}
			// meta 带两盘身份(出生时刻·时区·经纬),AI 挂载据此核对当前命主 ∈ {A,B};此前只带名字,
			// 命盘 X 挂「合盘」会拿到与 X 无关的 A/B 合盘。
			const recA = this.state.chartA && this.state.chartA.record ? this.state.chartA.record : null;
			const recB = this.state.chartB && this.state.chartB.record ? this.state.chartB.record : null;
			saveModuleAISnapshot('relative', snapshotText, {
				relation: this.state.currentTab,
				chartA: recA ? recA.name : null,
				chartB: recB ? recB.name : null,
				chartABirth: recA ? `${recA.birth || ''}` : '', chartAZone: recA ? `${recA.zone || ''}` : '',
				chartBBirth: recB ? `${recB.birth || ''}` : '', chartBZone: recB ? `${recB.zone || ''}` : '',
			});
			return snapshotText;
		}catch(e){
			return '';
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'relative'){
			return;
		}
		const snapshotText = this.saveRelativeSnapshot();
		if(snapshotText && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	}

	genParams(){
		if(this.state.chartA === null || this.state.chartB === null){
			return null;
		}
		let recA = this.state.chartA.record;
		let recB = this.state.chartB.record;
		let birthA = recA.birth.split(' ');
		let birthB = recB.birth.split(' ');

		let params = {
			inner: {
				date: birthA[0],
				time: birthA[1],
				zone: recA.zone,
				lat: recA.lat,
				lon: recA.lon
			},
			outer: {
				date: birthB[0],
				time: birthB[1],
				zone: recB.zone,
				lat: recB.lat,
				lon: recB.lon
			},
			hsys: 0,
			zodiacal: 0,
			siderealAyanamsa: '',
			relative: this.state.currentRelative
		}

		if(this.props.fields){
			params.hsys = this.props.fields.hsys.value;
			params.zodiacal = this.props.fields.zodiacal.value;
			params.siderealAyanamsa = this.props.fields.siderealAyanamsa ? this.props.fields.siderealAyanamsa.value : '';
			Object.assign(params, relativeClassicalParamsFromFields(this.props.fields));
		}

		return params;
	}

	async doChart(){
		if(this.state.chartA === null || this.state.chartB === null){
			return;
		}

		const params = this.genParams();
		if(params === null){
			return;
		}

		// 合盘(含时空中点盘) 必须走主排盘后端 :9999(Constants.ServerRoot)：request() 会对 body 做 RSA 加密，
		// 仅 Java 后端有解密拦截器并回标准 {result} 信封；chart 服务 :8899(Python) 既不解密(收到密文→json_in 400→无 CORS→net::ERR_FAILED)
		// 也不回 {result} 信封。v2.6.1(fc7ab74) 误把此处改成 resolveKentangServiceRoot('taiyi')(→:8899) 导致「合盘每个技法都用不了」，此处恢复 :9999。
		// 后端未就绪/请求失败时 request 可能抛错或返回 undefined → 必须优雅吞掉，否则 `data[ResultKey]` 抛错让整个合盘组件崩成空白、横幅自动重试也救不回。
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧盘留存+「更新中…」角标,
		// 新盘到达单次 setState 整体替换)。关 silentTechniquePanels 开关=旧全屏。
		// 请求代次:只认最后发出的那次,结果写回发请求时的子页签(切比较盘 / 组合盘、连续换星盘 B 时,
		// 先发的请求后到不能盖掉新页签或新星盘的结果)。与紫微 / 八字 / 印度同做法。
		const seq = (this._relSeq = (this._relSeq || 0) + 1);
		const sentTab = this.state.currentTab;
		this.setState({ updating: true });
		let data = null;
		try{
			data = await request(`${Constants.ServerRoot}/modern/relative`, {
				body: JSON.stringify(params),
				silent: silentTechniquePanelsEnabled(),
			});
		}catch(e){
			data = null;
		}
		if(!this._mounted || seq !== this._relSeq){
			return;
		}
		if(!data || data[Constants.ResultKey] === undefined || data[Constants.ResultKey] === null){
			// 服务未就绪 → 保持上次状态、等横幅自动重试再 doChart，不崩;只收角标
			if(this._mounted){
				this.setState({ updating: false });
			}
			return;
		}

		const res = data[Constants.ResultKey];

		let hook = this.state.hook;
		if(hook[sentTab]){
			hook[sentTab].result = res;
		}
		const st = {
			hook: hook,
			updating: false,
		};

		this.setState(st, ()=>{
			if(sentTab !== this.state.currentTab){
				return;
			}
			// horosa_panel_ready_v1:合盘结果落定(当前子页签的盘 + 其右栏皆由 hook[tab].result 派生)的提交点。
			// ★ 顶层页签 key 是 'relativechart'(pages/index.js:829),不是 'direction' —— 必须与
			// markInteractionStart(currentTab) 同名,否则合盘的样本会被记到星运名下(观测串族)。
			// (置于 sentTab 守卫之后:结果落在别的子页签时不算本次交互画完。)
			markPanelReady('relativechart');
			let hook = this.state.hook[sentTab];
			if(hook && hook.fun){
				hook.fun(res);
			}
			this.saveRelativeSnapshot();
		});

	}

	changeTab(key){
		let hook = this.state.hook;
		rememberSubTab('relativechart', key, RELATIVE_SUBTABS);
		this.setState({
			currentTab: key,
			currentRelative: hook[key].relative
		}, ()=>{
			if(this.state.chartA !== null && this.state.chartB !== null){
				this.doChart();
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				})
			}
		});

	}

	selectChartA(rec){
		// 清空「星盘A」时 rec 为空:先判空再写宫制 / 黄道(此前判空前就 rec.hsys = … → 报错)
		if(rec && this.props.fields && this.props.fields.hsys && this.props.fields.zodiacal){
			rec.hsys = this.props.fields.hsys.value;
			rec.zodiacal = this.props.fields.zodiacal.value;
		}

		if(rec){
			let txt = `${rec.name} ${rec.birth}`
			this.setState({
				chartA: {
					txt: txt,
					record: rec,
				}
			}, ()=>{
				if(this.state.chartA !== null && this.state.chartB !== null){
					this.doChart()
				}
			});
		}else{
			// 清空也推进请求代次:在途的旧组合回包作废(否则照写页签结果并上屏一张已不存在的组合)
			this._relSeq = (this._relSeq || 0) + 1;
			this.setState({
				chartA: null,
				updating: false,
			})
		}
	}

	selectChartB(rec){
		if(rec){
			let txt = `${rec.name} ${rec.birth}`
			this.setState({
				chartB: {
					txt: txt,
					record: rec,
				}
			}, ()=>{
				if(this.state.chartA !== null && this.state.chartB !== null){
					this.doChart()
				}
			});
		}else{
			// 同星盘 A:清空即作废在途请求
			this._relSeq = (this._relSeq || 0) + 1;
			this.setState({
				chartB: null,
				updating: false,
			})
		}
	}

	clickDoChart(){
		this.doChart()
	}

	// 合盘子页左栏用:标题 = 「子盘名 · 星盘A × 星盘B」,「重算」= 重排当前合盘。按标题缓存同一对象,
	// 免得每次渲染换引用击穿子页的渲染守卫。
	relativeContextFor(tabKey){
		const TAB_NAMES = { Composite: '组合盘', Synastry: '影响盘', TimeSpace: '时空中点盘', Marks: '马克斯盘' };
		const nm = (c)=>(c && c.record && c.record.name ? c.record.name : '');
		const a = nm(this.state.chartA);
		const b = nm(this.state.chartB);
		const title = `${TAB_NAMES[tabKey] || '合盘'}${a || b ? ` · ${a || '星盘A'} × ${b || '星盘B'}` : ''}`;
		this._relCtx = this._relCtx || {};
		if(!this._relCtx[tabKey] || this._relCtx[tabKey].title !== title){
			this._relCtx[tabKey] = { title, onRecalc: ()=>this.clickDoChart() };
		}
		return this._relCtx[tabKey];
	}


	render(){
		// 优先用实测容器高度(随窗口缩放/侧栏开合自适应);未测出时回退 props.height(原行为) 再回退 760。
		// -50 是给上方输入条留出空间,实测高度已是 chart-row 自身,不需要再减。
		let height;
		if(this.measuredHeight && this.measuredHeight > 0){
			height = Math.round(this.measuredHeight);
		}else{
			height = this.props.height ? this.props.height : 760;
			height = height - 50;
		}

		let chartAtxt = this.state.chartA ? this.state.chartA.txt : null;
		let chartBtxt = this.state.chartB ? this.state.chartB.txt : null;

		let hook = this.state.hook;

		return (
			<div className="horosa-relative-page">
				<Row gutter={12} data-agent-target="relative-pair">
					<Col span={8}>
						<ChartSearchModal onOk={this.selectChartA}>
							<Search placeholder="星盘A" value={chartAtxt} onChange={(e)=>{}} />
						</ChartSearchModal>
					</Col>
					<Col span={8}>
						<ChartSearchModal onOk={this.selectChartB}>
							<Search placeholder="星盘B" value={chartBtxt} onChange={(e)=>{}} />
						</ChartSearchModal>
					</Col>
					<Col span={8}>
						<Button onClick={this.clickDoChart}>排盘</Button>
					</Col>
				</Row>
				{/* position:relative=角标定位上下文;宿主收敛处统一发请求,故角标只挂盘容器一处、不进各子盘 */}
				<Row className="horosa-relative-chart-row" gutter={12} style={{marginTop: 10, position: 'relative'}} ref={this.chartRowRef}>
					<Col span={24}>
						{this.state.updating && hook[this.state.currentTab] && hook[this.state.currentTab].result ? <UpdatingBadge /> : null}
						{/* 空态:两张盘没选齐时盘面整块空白、相位栏空,首启看不出该做什么 → 盘区正中一句提示(绝对定位,不占版面) */}
						{(!this.state.chartA || !this.state.chartB) ? (
							<div className="horosa-empty-line horosa-relative-empty-hint" role="note">先在上方选择星盘 A 与星盘 B,再点「排盘」</div>
						) : null}
						{/* horosa_freeze_subtabs_v1:六个合盘子页签此前全部常驻重渲(每次排盘/改选项都画 6 套)。
						    state.currentTab 本就由 changeTab 与 antd 同步,直接拿来做 active;
						    Tabs 仍保持原非受控写法(defaultActiveKey),行为逐字不变。
						    冻结≠卸载:切回时拿本轮最新 children 立即渲一帧,不重发请求、不丢状态。 */}
						<Tabs 
							defaultActiveKey={this.state.currentTab} tabPosition='right'
							onChange={this.changeTab}
							className="horosa-relative-tabs"
							style={{ height: height }}
						>
							<TabPane tab="比较盘" key="Comp">
								<FreezeSubTab active={this.state.currentTab === 'Comp'}>
									<AstroCompare
										value={hook.Comp.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}   /* 四键补传:弹层显示值与主页同源 */
										voidClassical={this.props.voidClassical}
										planetListStyle={this.props.planetListStyle}
										aspects={this.props.aspects}
										hook={hook.Comp}	
									/>
								</FreezeSubTab>
							</TabPane>
							<TabPane tab="组合盘" key="Composite">
								<FreezeSubTab active={this.state.currentTab === 'Composite'}>
									<AstroComposite 
										relativeContext={this.relativeContextFor('Composite')}
										wheelArt={this.props.wheelArt}
										value={hook.Composite.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}   /* 四键补传:弹层显示值与主页同源 */
										voidClassical={this.props.voidClassical}
										planetListStyle={this.props.planetListStyle}
										aspects={this.props.aspects}
										hook={hook.Composite}	
									/>
								</FreezeSubTab>
							</TabPane>
							<TabPane tab="影响盘" key="Synastry">
								<FreezeSubTab active={this.state.currentTab === 'Synastry'}>
									<AstroSynastry 
										relativeContext={this.relativeContextFor('Synastry')}
										wheelArt={this.props.wheelArt}
										value={hook.Synastry.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}   /* 四键补传:弹层显示值与主页同源 */
										voidClassical={this.props.voidClassical}
										planetListStyle={this.props.planetListStyle}
										aspects={this.props.aspects}
										hook={hook.Synastry}	
									/>
								</FreezeSubTab>
							</TabPane>
							<TabPane tab="时空中点盘" key="TimeSpace">
								<FreezeSubTab active={this.state.currentTab === 'TimeSpace'}>
									<AstroTimeSpace 
										relativeContext={this.relativeContextFor('TimeSpace')}
										wheelArt={this.props.wheelArt}
										value={hook.TimeSpace.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}   /* 四键补传:弹层显示值与主页同源 */
										voidClassical={this.props.voidClassical}
										planetListStyle={this.props.planetListStyle}
										aspects={this.props.aspects}
										hook={hook.TimeSpace}	
									/>
								</FreezeSubTab>
							</TabPane>
								<TabPane tab="马克斯盘" key="Marks">
									<FreezeSubTab active={this.state.currentTab === 'Marks'}>
										<AstroMarks 
										relativeContext={this.relativeContextFor('Marks')}
											wheelArt={this.props.wheelArt}
											value={hook.Marks.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										dispatch={this.props.dispatch}
										onChange={this.handleRelativeOnChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
										showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}   /* 四键补传:弹层显示值与主页同源 */
										voidClassical={this.props.voidClassical}
										planetListStyle={this.props.planetListStyle}
										aspects={this.props.aspects}
										hook={hook.Marks}	
										/>
									</FreezeSubTab>
								</TabPane>
								<TabPane tab="关系量化" key="Score">
									<FreezeSubTab active={this.state.currentTab === 'Score'}>
										<AstroRelativeScore
											params={this.genParams()}
											height={height}
											onResult={(r)=>{ hook.Score.result = r; this.saveRelativeSnapshot(); }}
										/>
									</FreezeSubTab>
								</TabPane>

							</Tabs>
					</Col>
				</Row>
			</div>
		);
	}
}

export default AstroRelative;
