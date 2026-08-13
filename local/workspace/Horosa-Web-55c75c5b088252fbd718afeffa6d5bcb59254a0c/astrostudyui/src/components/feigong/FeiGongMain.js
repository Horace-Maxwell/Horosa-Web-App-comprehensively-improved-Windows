// 飞宫小奇门 · 三栏主组件(左栏起局控件 / 中栏 SVG 同心盘 / 右栏主客宫面判读)。
// 🔴 宿主范式=本页签(CnYiBuMain)每 tab 只渲染组件一次 → 自出三栏(照同页邻居 GuiceMain)。
// 🔴 局是【冻结值】:起支(时支/选支/数取)一经定局即不可重起;命宫年龄性别只重排命宫目。
import React, { Component, createRef } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { XQSideSection } from '../xq-ui';
import { Tabs, Empty, Input, InputNumber, Radio, Button, Select, Tag } from 'antd';
import { resolveQiZhi, buildJu, mingGong, liuNian, liuYue } from './core/feigongJu';
import { zhuKe, gongDuan, menDuan, shenDuan, xingDuan, tuiDuanText, wuXingOf, shengKeRel, xingShenSunYi, yingQi, shiXiangKey } from './core/feigongDuan';
import {
	ZHI, GAN, GONG_GUA, FANG_WEI_RING,
	BA_MEN_JI_XIONG, YUAN_SHEN_JI_XIONG, TUI_DUAN,
} from './core/feigongConst';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { safeJsonStringifyToStorage, safeJsonParseFromStorage } from '../../utils/safeStorage';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { deriveLocalNongli, deriveNongliUniversalSync, subscribeRemoteNongli, timePatchFromDateTime, geoPatchFromRec, snapshotMetaFromFields, buildQiKeTimeLines } from '../../utils/divinationTimeDraft';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;
const STORE_KEY = 'horosa.feigong.settings.v1';
const DEFAULT_SETTINGS = { qiMode: 'hour', heKuiKoujing: 'zheng' };
// 八方环序(FANG_WEI_RING=[1,8,3,4,9,2,7,6] 自北顺时针);每宫扇区 45°,北(宫1)居下。
const GONG_ANGLE = {};
FANG_WEI_RING.forEach((g, i)=>{ GONG_ANGLE[g] = 90 + i * 45; }); // SVG 角:北=90°(下方),顺时针

// AI 段表(与 AI 导出段表逐字一致的段头真值):
// ask/qiju/ganzhi/minggong/gongwei/yunqi/yingqi。
export function buildFeiGongSnapshotText(ju, opts){
	if(!ju){ return ''; }
	const o = opts || {};
	const out = [];
	out.push('[问事]');
	out.push(o.askEvent ? `所问:${o.askEvent}` : '(未录问事)');
	out.push('');
	out.push('[起局]');
	((o.timeLines) || []).forEach((l)=>out.push(l));
	out.push(`起支:${ju.qiZhi};建星起于${ju.jianZhi};青龙(甲)落 ${ju.longGong} 宫`);
	out.push('');
	out.push('[干支]');
	out.push(`甲乘龙飞九宫:${GAN.map((g)=>`${g}${ju.tianGan.ganGong[g] != null ? ju.tianGan.ganGong[g] : '中'}`).join(' ')}`);
	out.push(`中宫双干:${(ju.tianGan.zhongGong || []).join('')}(五十居中)`);
	out.push(`八门:休门起 ${ju.baMen.xiuMenGong} 宫;${Object.keys(ju.baMen.menGong || {}).map((m)=>`${m}${ju.baMen.menGong[m]}`).join(' ')}`);
	out.push('');
	out.push('[命宫]');
	let mgSaved = null;
	if(o.mingAge){
		const mg = mingGong({ age: o.mingAge, gender: o.mingGender || 'male', ju });
		mgSaved = mg;
		if(mg.gong != null){
			out.push(`年龄 ${o.mingAge}(${o.mingGender === 'female' ? '女' : '男'}):调整数 ${mg.adjusted},命宫 ${mg.gong}(${GONG_GUA[mg.gong] || '中'})${mg.zhiWu && mg.via ? `,值五宫看${mg.via.join('转')}` : ''}`);
		}else{
			out.push(`年龄 ${o.mingAge}:${(mg.flags || []).join(';') || '不可定宫'}`);
		}
		(mg.flags || []).forEach((f)=>{ if(mg.gong != null){ out.push(`注:${f}`); } });
	}else{
		out.push('(未录年龄,不定命宫)');
	}
	out.push('');
	out.push('[宫位]');
	const zk = zhuKe(ju);
	if(zk && (zk.zhuGong != null || zk.keGong != null)){
		out.push(`主(日干${ju.dayGan || '—'})落 ${zk.zhuGong != null ? zk.zhuGong : '—'} 宫;客(日支${ju.dayZhi || '—'})落 ${zk.keGong != null ? zk.keGong : '—'} 宫`);
	}else{
		out.push('(未录日干支,主客不定)');
	}
	FANG_WEI_RING.forEach((g)=>{
		const gd = gongDuan(ju, g);
		if(!gd){ return; }
		out.push(`${g}${gd.gua}宫 门${gd.men || '—'} 干${(gd.gan || []).join('') || '—'} | ${gd.zhis.map((z)=>`${z.zhi}·${z.shen}·${z.xing}`).join(' ')}`);
	});
	out.push('');
	out.push('[运气]');
	if(zk && zk.zhuGong != null && zk.keGong != null){
		const zg = gongDuan(ju, zk.zhuGong); const kg = gongDuan(ju, zk.keGong);
		if(zg && zg.men){ out.push(`主宫${zk.zhuGong} 得${zg.men}门(${BA_MEN_JI_XIONG[zg.men] || ''}):${(menDuan(zg.men)||{}).ti || ''}`); }
		if(kg && kg.men){ out.push(`客宫${zk.keGong} 得${kg.men}门(${BA_MEN_JI_XIONG[kg.men] || ''}):${(menDuan(kg.men)||{}).ti || ''}`); }
	}else{ out.push('—'); }
	// 流年/流月(推运,可执行)并入 [运气] 段(不新增段头):
	if(ju.dayZhi){
		// [X1·P2-23] 与右栏同源:12 岁全 + 各岁带宫号(此前 6 岁无宫,AI 少看一半)。
		const ln = liuNian({ dayZhi: ju.dayZhi, gender: o.mingGender || 'male', maxAge: 12, ju });
		if(ln.length){ out.push(`流年(日支${ju.dayZhi}起·${o.mingGender === 'female' ? '女逆' : '男顺'}):${ln.map((y)=>`${y.age}岁${y.zhi}(${y.gong}宫·${y.shen}·${y.xing}·${y.men}门)`).join(' ')}`); }
	}
	{
		// [X1·P2-22] 与右栏同源:未选月按正月(UI 默认显示正月),并补「月对命宫」生克与推断四损益。
		const lm = o.liuYueMonth || 1;
		const ly = liuYue({ ju, monthNum: lm });
		if(ly){
			let rel = null; let sunyi = null;
			if(mgSaved && mgSaved.gong != null){
				rel = shengKeRel(wuXingOf(ly.zhi), wuXingOf(GONG_GUA[mgSaved.gong]));
				if(rel){ sunyi = xingShenSunYi(YUAN_SHEN_JI_XIONG[ly.shen], rel); }
			}
			out.push(`流月(${['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][lm - 1]}月建${ly.zhi}):${ly.gong}宫·${ly.shen}·${ly.xing}·${ly.men}门${rel ? `;月对命宫:${rel}${sunyi ? `(${sunyi})` : ''}` : ''}`);
		}
	}
	out.push('');
	out.push('[应期]');
	out.push(`建星:${ju.jianZhi} 起建,建除十二神随支顺布(以天星所临断应期缓急)。`);
	// [X1] 与右栏「断语·应期」同源:原神断语(带吉凶档)+天星别名一并入快照(此前 AI 只见神名不见断语)。
	if(ju.dayZhi && ju.yuanShen[ju.dayZhi]){
		const sd = shenDuan(ju.yuanShen[ju.dayZhi]) || {};
		out.push(`日支${ju.dayZhi} 原神${ju.yuanShen[ju.dayZhi]}(${YUAN_SHEN_JI_XIONG[ju.yuanShen[ju.dayZhi]] || ''}):${sd.text || ''}`);
	}
	if(ju.dayZhi && ju.tianXing[ju.dayZhi]){
		const xd = xingDuan(ju.tianXing[ju.dayZhi], o.koujing) || {};
		out.push(`日支${ju.dayZhi} 临 ${ju.tianXing[ju.dayZhi]}${xd.alias ? `(${xd.alias})` : ''}:${xd.text || ''}`);
	}
	// 中宫定时/驿马/冲 + 日支冲合(可执行应期)并入 [应期] 段:
	const yq = yingQi(ju);
	if(yq){ out.push(`中宫${yq.zhongGong.join('')} → ${yq.shi}${yq.yiMa ? '(驿马·动)' : yq.dingShi ? '(定时·合)' : ''};${yq.note}`); }
	// 事项路由(据问事)：
	if(o.askEvent){ const sx = shiXiangKey(o.askEvent, { heKuiKoujing: o.koujing }); if(sx){ out.push(`事项:${sx.hint}`); } }
	return out.join('\n').trim();
}

/** 无头重算(AI 挂载;局=冻结值只自 payload 取)。 */
export function buildFeiGongSnapshotForCase(payload, opts){
	try{
		const p = payload && typeof payload === 'object' ? payload : {};
		if(!p.qiZhi){ return ''; }
		const ju = buildJu({ zhi: p.qiZhi, dayGan: p.dayGan, dayZhi: p.dayZhi });
		if(!ju){ return ''; }
		return buildFeiGongSnapshotText(ju, { ...(p.options || {}), ...(opts || {}), askEvent: p.askEvent || '' });
	}catch(e){ return ''; }
}

class FeiGongMain extends Component {
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(p){
		super(p);
		const stored = safeJsonParseFromStorage(STORE_KEY);
		this.state = {
			settings: { ...DEFAULT_SETTINGS, ...(stored || {}) },
			inputs: { zhi: '子', num: null, mingAge: null, mingGender: 'male', askEvent: '', useDayGZ: true, dayGan: '甲', dayZhi: '子', liuYueMonth: null },
			ju: null, error: '',
			// [自由起盘] 本地时间地理草稿(null=跟主命盘,字节现状;非空=用户左栏自选时间/经纬起局)。
			localFields: null,
		};
		this.rootRef = createRef();
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		if(typeof window !== 'undefined'){
			this._onSnapRefresh = (evt)=>{
				if(!evt || !evt.detail || evt.detail.module !== 'feigong' || !this.state.ju){ return; }
				const t = buildFeiGongSnapshotText(this.state.ju, { askEvent: this.state.inputs.askEvent, mingAge: this.state.inputs.mingAge, mingGender: this.state.inputs.mingGender, liuYueMonth: this.state.inputs.liuYueMonth, koujing: this.state.settings.heKuiKoujing, timeLines: buildQiKeTimeLines(this.activeFields ? this.activeFields() : (this.state.localFields || this.props.fields)) });
				if(t){ saveModuleAISnapshot('feigong', t); evt.detail.snapshotText = t; }
			};
			window.addEventListener('horosa:refresh-module-snapshot', this._onSnapRefresh);
		}
		this.restoreFromCurrentCase(true);
	}
	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		if(typeof window !== 'undefined' && this._onSnapRefresh){
			window.removeEventListener('horosa:refresh-module-snapshot', this._onSnapRefresh);
		}
	}
	componentDidUpdate(prevProps, prevState){
		if(prevProps.fields !== this.props.fields && this.props.fields){
			this.restoreFromCurrentCase();
		}
		// [X1] 定局后改设置(河魁口径等)/输入(问事/命宫年龄性别/流月) → 快照重存,
		// 否则挂载/导出读到旧口径正文(UI 与 AI 所见不一致,直到下次任意 saveSnap 才自愈)。
		if(this.state.ju && prevState && (prevState.settings !== this.state.settings || prevState.inputs !== this.state.inputs)){
			this.saveSnap();
		}
		// [X1] 局一变即告容器(dock 不在本组件树内,左栏定的局容器无从知晓 → 「保存」伪禁用;对齐 guice 范式)。
		if(prevState && prevState.ju !== this.state.ju && typeof this.props.onResultChange === 'function'){ this.props.onResultChange(); }
	}
	// [X1 审计补] 事盘还原(对齐 wuzhao/tarot 等 13 技法既有范式):局=冻结值,自 payload.qiZhi/dayGan/dayZhi
	// 复排(buildJu 确定性),绝不按当前时间重起;options 回放到 inputs/settings(不写 localStorage 默认)。
	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('feigong');
		if(!saved || !saved.payload || !saved.payload.qiZhi){ return false; }
		if(!force && this.lastRestoredCaseId === saved.caseVersion){ return !!this.state.ju; }
		const p = saved.payload;
		const o = p.options && typeof p.options === 'object' ? p.options : {};
		const ju = buildJu({ zhi: p.qiZhi, dayGan: p.dayGan, dayZhi: p.dayZhi });
		if(!ju){ return false; }
		this.lastRestoredCaseId = saved.caseVersion;
		this.setState({
			ju, error: '',
			localFields: null,   // [X1·P2-42] 载档=切到事盘时地,清本地草稿免新旧时地混拼
			inputs: {
				...this.state.inputs,
				mingAge: o.mingAge !== undefined ? o.mingAge : null,
				mingGender: o.mingGender || 'male',
				liuYueMonth: o.liuYueMonth !== undefined ? o.liuYueMonth : null,
				askEvent: p.askEvent || '',
				// 起支法相关档位如实读回(旧档缺键则保持现值,不写 undefined)
				useDayGZ: o.useDayGZ !== undefined ? !!o.useDayGZ : this.state.inputs.useDayGZ,
				zhi: o.zhi !== undefined && o.zhi !== null ? o.zhi : this.state.inputs.zhi,
				num: o.num !== undefined ? o.num : this.state.inputs.num,
				dayGan: o.inputDayGan !== undefined && o.inputDayGan !== null ? o.inputDayGan : this.state.inputs.dayGan,
				dayZhi: o.inputDayZhi !== undefined && o.inputDayZhi !== null ? o.inputDayZhi : this.state.inputs.dayZhi,
			},
			settings: {
				...this.state.settings,
				...(o.koujing ? { heKuiKoujing: o.koujing } : {}),
				...(o.qiMode ? { qiMode: o.qiMode } : {}),
			},
		}, ()=>this.saveSnap());
		return true;
	}
	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	}
	// 起局之时:时支/日干/日支。默认真源 props.value.chart.nongli(时柱 bazi.time);
	// 用户在左栏改过时间/经纬(localFields 非空)则从草稿本地派生同形农历(deriveLocalNongli)。
	ctx(){
		let nl;
		if(this.state.localFields){
			nl = deriveNongliUniversalSync(this.state.localFields) || {};
		}else{
			const chart = (this.props.value && this.props.value.chart) || {};
			nl = chart.nongli || {};
		}
		const b = nl.bazi || {};
		const cell = (zhu, which)=>(b[zhu] && b[zhu][which] && b[zhu][which].cell) || undefined;
		return { hourZhi: cell('time', 'branch'), dayGan: cell('day', 'stem'), dayZhi: cell('day', 'branch') };
	}
	// [自由起盘] 左栏时间选择 → 写本地草稿(不 dispatch,不污染主盘);若已定局则按新时间重排。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		const localFields = { ...base, ...timePatchFromDateTime(dt) };
		this.setState({ localFields }, ()=>{ if(this.state.ju){ this.doQiJu(); } });
	}
	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区自动校正 + 重锚时间 + 地名);已定局则重排。
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		const localFields = { ...base, ...geoPatchFromRec(rec, base) };
		this.setState({ localFields }, ()=>{ if(this.state.ju){ this.doQiJu(); } });
	}
	doQiJu(){
		const { settings, inputs } = this.state;
		const c = this.ctx();
		const modeMap = { hour: 'hour', zhi: 'manualZhi', num: 'manualNum', yearZhi: 'yearZhi' };
		const qz = resolveQiZhi({
			mode: modeMap[settings.qiMode] || 'hour',
			hourZhi: c.hourZhi,
			zhi: inputs.zhi,
			num: inputs.num,
			yearZhi: inputs.yearZhi || '子',
		});
		if(!qz){ return this.setState({ error: settings.qiMode === 'hour' ? '排盘未出时支 —— 请先起盘,或改选支/数取' : '起支输入非法', ju: null }); }
		const dayGan = inputs.useDayGZ ? c.dayGan : inputs.dayGan;
		const dayZhi = inputs.useDayGZ ? c.dayZhi : inputs.dayZhi;
		const ju = buildJu({ zhi: qz, dayGan, dayZhi });
		if(!ju){ return this.setState({ error: '起支非法,不可定局', ju: null }); }
		// horosa_panel_ready_v1:ju 落定 = 飞宫盘(中栏)与断语(右栏)画完的那一次 setState。
		this.setState({ ju, error: '' }, ()=>{ markPanelReady('cnyibu'); this.saveSnap(); });
	}
	setSettings(patch){
		const settings = { ...this.state.settings, ...patch };
		this.setState({ settings });
		safeJsonStringifyToStorage(STORE_KEY, settings);
	}
	saveSnap(){
		const t = buildFeiGongSnapshotText(this.state.ju, { askEvent: this.state.inputs.askEvent, mingAge: this.state.inputs.mingAge, mingGender: this.state.inputs.mingGender, liuYueMonth: this.state.inputs.liuYueMonth, koujing: this.state.settings.heKuiKoujing, timeLines: buildQiKeTimeLines(this.activeFields ? this.activeFields() : (this.state.localFields || this.props.fields)) });
		// meta 补时间地理键(用生效 fields=草稿或主盘):命盘缓存路径确凿匹配 + 事盘/导出口径一致。
		if(t){ saveModuleAISnapshot('feigong', t, snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() })); }
	}
	clickSaveCase(){
		const { ju, inputs } = this.state;
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存事盘用生效 fields:改过时间地理则存草稿值(divTime/经纬/地名来自草稿,不写主命盘)。
			fields: this.activeFields(),
			module: 'feigong',
			label: '飞宫小奇门',
			payload: {
				// 🔴 qiMode(起支法四式)与 useDayGZ/zhi/num/dayGan/dayZhi(日干支档位与手输值)
				// 此前**根本没进 payload** → 载档后中栏是存档之局,左栏控件却是 localStorage 默认档,
				// 二者自相矛盾(与 xiaochengtu 已修的同类病灶同形)。局本身由 qiZhi/dayGan/dayZhi 冻结,
				// 补这几档只是让左栏如实显示当初怎么起的,不改判读。
				options: {
					mingAge: inputs.mingAge, mingGender: inputs.mingGender, liuYueMonth: inputs.liuYueMonth,
					koujing: this.state.settings.heKuiKoujing,
					qiMode: this.state.settings.qiMode,
					useDayGZ: inputs.useDayGZ, zhi: inputs.zhi, num: inputs.num,
					inputDayGan: inputs.dayGan, inputDayZhi: inputs.dayZhi,
				},
				qiZhi: ju ? ju.qiZhi : null,      // 🔴 冻结起支(重算只重排,绝不重起)
				dayGan: ju ? ju.dayGan : null,
				dayZhi: ju ? ju.dayZhi : null,
				askEvent: inputs.askEvent,
				snapshot: buildFeiGongSnapshotText(ju, { askEvent: inputs.askEvent, mingAge: inputs.mingAge, mingGender: inputs.mingGender, liuYueMonth: inputs.liuYueMonth, koujing: this.state.settings.heKuiKoujing, timeLines: buildQiKeTimeLines(this.activeFields ? this.activeFields() : (this.state.localFields || this.props.fields)) }),
			},
		});
	}
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.ju,
			primary: { key: 'qiju', label: '定局', onClick: ()=>this.doQiJu() },
			save: ()=>this.clickSaveCase(),
		};
	}

	// [左栏统一] 全站字段范式(照 guice.field):标题在上+控件全宽(is-wide);多控件包 flex 行。
	field(label, node, hint){
		return (
			<label className="horosa-huangji-select-field is-wide" key={label}>
				<span>{label}</span>
				{node}
				{hint ? <em className="horosa-guice-hint">{hint}</em> : null}
			</label>
		);
	}
	renderControls(){
		const { settings, inputs } = this.state;
		const c = this.ctx();
		const fields = this.activeFields();
		return (
			<>
			{/* [自由起盘] 时间与地点:独立草稿,改了即按新时间地理起局(不写主命盘) */}
			<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={buildDateTimeFromFields(fields)}
					onTimeChange={this.onTimeChanged}
					onGeoChange={this.changeGeo}
				/>
			</XQSideSection>
			<XQSideSection iconName="target" title="起局参数" storageKey="fg.controls" className="horosa-side-input-section">
			<div className="horosa-fg-controls horosa-cnx-controls">
				{/* 一行两个(用户定案):起支+日干支 恒居首行;各自的条件补充项(选支/数取/生年支/手动干支)
				    顺流补位到次行 —— 复用 select-grid 两列基类,is-wide 在该网格里天然铺满单元格。 */}
				<div className="horosa-huangji-select-grid horosa-fg-pair-grid">
					{this.field('起支', <Select size="small" style={{ width: '100%' }} value={settings.qiMode} onChange={(v)=>this.setSettings({ qiMode: v })}
						options={[{ value: 'hour', label: `按占时(${c.hourZhi || '?'})` }, { value: 'zhi', label: '选支' }, { value: 'num', label: '数取' }, { value: 'yearZhi', label: '年命佈局(生年支)' }]}/>)}
					{this.field('日干支', <Select size="small" style={{ width: '100%' }} value={inputs.useDayGZ ? 'auto' : 'manual'} onChange={(v)=>this.setState({ inputs: { ...inputs, useDayGZ: v === 'auto' } })}
						options={[{ value: 'auto', label: `随盘(${c.dayGan || '?'}${c.dayZhi || '?'})` }, { value: 'manual', label: '手动' }]}/>)}
					{settings.qiMode === 'yearZhi' ? this.field('生年支', (
						<Select size="small" style={{ width: '100%' }} value={inputs.yearZhi || '子'} onChange={(v)=>this.setState({ inputs: { ...inputs, yearZhi: v } })} options={ZHI.map((z)=>({ value: z, label: z }))}/>
					), '以命主生年地支起局(引擎 yearZhi 模式)') : null}
					{settings.qiMode === 'zhi' ? this.field('支', (
						<Select size="small" style={{ width: '100%' }} value={inputs.zhi} onChange={(v)=>this.setState({ inputs: { ...inputs, zhi: v } })} options={ZHI.map((z)=>({ value: z, label: z }))}/>
					)) : null}
					{settings.qiMode === 'num' ? this.field('数', (
						<InputNumber size="small" min={1} style={{ width: '100%' }} placeholder="≥1" value={inputs.num} onChange={(v)=>this.setState({ inputs: { ...inputs, num: v } })}/>
					), '除十二取余配支') : null}
					{!inputs.useDayGZ ? this.field('干/支', (
						<div style={{ display: 'flex', gap: 6 }}>
							<Select size="small" style={{ flex: 1 }} value={inputs.dayGan} onChange={(v)=>this.setState({ inputs: { ...inputs, dayGan: v } })} options={GAN.map((g)=>({ value: g, label: g }))}/>
							<Select size="small" style={{ flex: 1 }} value={inputs.dayZhi} onChange={(v)=>this.setState({ inputs: { ...inputs, dayZhi: v } })} options={ZHI.map((z)=>({ value: z, label: z }))}/>
						</div>
					)) : null}
				</div>
				{this.field('命宫', (
					<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
						<InputNumber size="small" min={1} max={120} style={{ flex: 1 }} placeholder="年龄" value={inputs.mingAge} onChange={(v)=>this.setState({ inputs: { ...inputs, mingAge: v } }, ()=>{ if(this.state.ju){ this.saveSnap(); } })}/>
						<Radio.Group size="small" optionType="button" value={inputs.mingGender} onChange={(e)=>this.setState({ inputs: { ...inputs, mingGender: e.target.value } }, ()=>{ if(this.state.ju){ this.saveSnap(); } })}
							options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }]}/>
					</div>
				))}
				{this.field('问事', <Input size="small" placeholder="所占何事(入快照)" value={inputs.askEvent} onChange={(e)=>this.setState({ inputs: { ...inputs, askEvent: e.target.value } }, ()=>{ if(this.state.ju){ this.saveSnap(); } })}/>)}
				{/* [3A] 河魁口径:定点断语开关(收/开之河魁·贵人两说),改则右栏/AI 断语重排,局不重起。 */}
				{this.field('河魁口径', <Radio.Group size="small" optionType="button" value={settings.heKuiKoujing || 'zheng'}
					onChange={(e)=>{ this.setSettings({ heKuiKoujing: e.target.value }); if(this.state.ju){ this.saveSnap(); } }}
					options={[{ value: 'zheng', label: '正传·收' }, { value: 'yi', label: '异文·开' }]}/>, '收/开之河魁·贵人归属两说')}
				<Button type="primary" size="small" block onClick={()=>this.doQiJu()} style={{ marginTop: 2 }}>定局</Button>
				{this.state.error ? <div className="horosa-guice-error">{this.state.error}</div> : null}
			</div>
			</XQSideSection>
			</>
		);
	}

	/** 中栏:SVG 同心盘 —— 内环八宫(卦+干+门)/外环十二支(原神+天星);中心=中宫双干。 */
	renderCenter(ju){
		const zk = zhuKe(ju);
		const W = 430; const cx = W / 2; const cy = W / 2;
		const rad = (deg)=>(deg * Math.PI) / 180;
		const pt = (r, deg)=>[cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
		const gongCells = FANG_WEI_RING.map((g)=>{
			const a = GONG_ANGLE[g];
			const gd = gongDuan(ju, g);
			const [x1, y1] = pt(92, a);
			const isZhu = zk && zk.zhuGong === g;
			const isKe = zk && zk.keGong === g;
			return (
				<g key={g}>
					<text x={x1} y={y1 - 14} textAnchor="middle" fontSize="11" fill="var(--horosa-muted, #888)">{g} {GONG_GUA[g]}</text>
					<text x={x1} y={y1 + 2} textAnchor="middle" fontSize="15" fontWeight="400" fill="var(--horosa-text, #333)">{((gd && gd.gan) || []).join('')}</text>
					<text x={x1} y={y1 + 18} textAnchor="middle" fontSize="12" fill="var(--horosa-gold, #c68f40)">{gd && gd.men ? `${gd.men}门` : ''}</text>
					{isZhu ? <text x={x1 - 26} y={y1 + 2} textAnchor="middle" fontSize="11" fill="var(--horosa-jade, #3f9c5b)">主</text> : null}
					{isKe ? <text x={x1 + 26} y={y1 + 2} textAnchor="middle" fontSize="11" fill="var(--horosa-danger, #cf1322)">客</text> : null}
				</g>
			);
		});
		const zhiCells = ZHI.map((z, i)=>{
			const a = 90 + i * 30; // 子居正下,顺时针
			const [x1, y1] = pt(168, a);
			const hit = z === ju.qiZhi;
			return (
				<g key={z}>
					<text x={x1} y={y1 - 12} textAnchor="middle" fontSize="13" fontWeight="400" fill={hit ? 'var(--horosa-gold, #c68f40)' : 'var(--horosa-text, #333)'}>{z}</text>
					<text x={x1} y={y1 + 3} textAnchor="middle" fontSize="10" fill="var(--horosa-muted, #888)">{ju.yuanShen[z]}</text>
					<text x={x1} y={y1 + 17} textAnchor="middle" fontSize="10" fill="var(--horosa-muted, #888)">{ju.tianXing[z]}</text>
				</g>
			);
		});
		const arcPath = (r0, r1, aDeg)=>{
			// 45° 扇环(宫位区):以宫角为中心 ±22.5°
			const a0 = rad(aDeg - 22.5); const a1 = rad(aDeg + 22.5);
			const p = (r, a)=>[cx + r * Math.cos(a), cy + r * Math.sin(a)];
			const [x0o, y0o] = p(r1, a0); const [x1o, y1o] = p(r1, a1);
			const [x1i, y1i] = p(r0, a1); const [x0i, y0i] = p(r0, a0);
			return `M ${x0o} ${y0o} A ${r1} ${r1} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${r0} ${r0} 0 0 0 ${x0i} ${y0i} Z`;
		};
		return (
			<div className="horosa-fg-board horosa-cnx-board" style={{ alignItems: 'center' }}>
				<div className="horosa-cnx-board-header" style={{ alignSelf: 'stretch' }}>
					<div>
						<div className="horosa-cnx-board-title">飞宫同心盘</div>
						<div className="horosa-cnx-board-kicker">内环八宫卦·飞干·八门 / 外环十二支·原神·建除天星</div>
					</div>
					<span className="horosa-cnx-board-badge">起支 {ju.qiZhi} · 建起 {ju.jianZhi} · 青龙落{ju.longGong}宫</span>
				</div>
				<svg viewBox={`0 0 ${W} ${W}`} preserveAspectRatio="xMidYMid meet">
					{/* 主/客宫 45° 扇环底纹(视觉锚定主客对峙) */}
					{zk && zk.zhuGong != null && GONG_ANGLE[zk.zhuGong] != null ? (
						<path d={arcPath(56, 140, GONG_ANGLE[zk.zhuGong])} fill="var(--horosa-jade, #3f9c5b)" opacity="0.10"/>
					) : null}
					{zk && zk.keGong != null && GONG_ANGLE[zk.keGong] != null ? (
						<path d={arcPath(56, 140, GONG_ANGLE[zk.keGong])} fill="var(--horosa-danger, #cf1322)" opacity="0.09"/>
					) : null}
					{ju.longGong != null && GONG_ANGLE[ju.longGong] != null ? (
						<path d={arcPath(140, 196, GONG_ANGLE[ju.longGong])} fill="var(--horosa-gold, #c68f40)" opacity="0.10"/>
					) : null}
					<circle cx={cx} cy={cy} r={196} fill="none" stroke="var(--horosa-huangji-line-strong, rgba(198,143,64,0.4))" strokeWidth="1.5"/>
					<circle cx={cx} cy={cy} r={140} fill="none" stroke="var(--horosa-huangji-line, rgba(198,143,64,0.22))"/>
					<circle cx={cx} cy={cy} r={56} fill="none" stroke="var(--horosa-huangji-line-strong, rgba(198,143,64,0.4))"/>
					{Array.from({ length: 12 }, (_, i)=>{
						const a = 90 + i * 30 + 15;
						const [xa, ya] = pt(140, a); const [xb, yb] = pt(196, a);
						return <line key={`l12-${i}`} x1={xa} y1={ya} x2={xb} y2={yb} stroke="var(--horosa-huangji-line, rgba(198,143,64,0.16))"/>;
					})}
					{Array.from({ length: 8 }, (_, i)=>{
						const a = 90 + i * 45 + 22.5;
						const [xa, ya] = pt(56, a); const [xb, yb] = pt(140, a);
						return <line key={`l8-${i}`} x1={xa} y1={ya} x2={xb} y2={yb} stroke="var(--horosa-huangji-line, rgba(198,143,64,0.16))"/>;
					})}
					<text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" letterSpacing="2" fill="var(--horosa-huangji-accent, #c68f40)">中宫</text>
					<text x={cx} y={cy + 15} textAnchor="middle" fontSize="19" fontWeight="400" letterSpacing="3" fill="var(--horosa-huangji-text, #e8dcc8)">{(ju.tianGan.zhongGong || []).join('')}</text>
					{gongCells}
					{zhiCells}
				</svg>
			</div>
		);
	}

	/** 右栏判读(🔴 未定局时 ju=null 亦须渲染 Tabs 外壳——各目出占位,不塌成空白) */
	renderAux(ju){
		const { inputs } = this.state;
		const zk = ju ? zhuKe(ju) : null;
		const mg = (ju && inputs.mingAge) ? mingGong({ age: inputs.mingAge, gender: inputs.mingGender, ju }) : null;
		const row = (k, v, i)=>(
			<div key={`${k}|${i || 0}`} className="horosa-cnx-item">
				<span className="horosa-cnx-item-k">{k}</span><span className="horosa-cnx-item-v">{v}</span>
			</div>
		);
		const wait = (t)=><div style={{ opacity: 0.6, fontSize: 12, padding: '6px 2px' }}>{t}</div>;
		return (
			// horosa_freeze_subtabs_v1:右栏辅目冻结。原为非受控 Tabs → 改受控
			// (activeKey 取 state.auxTab,缺省即原首目;onChange 记进 state),切页行为逐字不变,
			// 只是让 FreezeSubTab 拿得到 active。冻结≠卸载,切回即拿最新 children 立刻重画。
			<Tabs size="small" className="horosa-fg-aux horosa-cnx-aux"
				activeKey={this.state.auxTab || 'zhuke'}
				onChange={(k)=>this.setState({ auxTab: k })}>
				<TabPane tab="主客" key="zhuke">
					<FreezeSubTab active={(this.state.auxTab || 'zhuke') === 'zhuke'}>{() => (<>
						{!ju ? wait('左栏择起支后「定局」,此处显示主客落宫。') : zk && (zk.zhuGong != null || zk.keGong != null) ? (
							<>
								{row('主(日干)', zk.zhuGong != null ? `${ju.dayGan} 落 ${zk.zhuGong} 宫(${GONG_GUA[zk.zhuGong] || '中'})` : '未录日干')}
								{row('客(日支)', zk.keGong != null ? `${ju.dayZhi} 落 ${zk.keGong} 宫(${GONG_GUA[zk.keGong] || '中'})` : '未录日支')}
								<div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, whiteSpace: 'pre-wrap' }}>{zk.text}</div>
							</>
						) : <div style={{ opacity: 0.75 }}>未录日干支,主客不定(左栏「日干支」随盘或手动)。</div>}
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="宫面" key="gongmian">
					<FreezeSubTab active={(this.state.auxTab || 'zhuke') === 'gongmian'}>{() => (<>
						{!ju ? wait('定局后逐宫显示门/干/十二支落宫。') : FANG_WEI_RING.map((g, i)=>{
							const gd = gongDuan(ju, g);
							if(!gd){ return null; }
							return row(`${g} ${gd.gua}宫`, `门${gd.men || '—'} 干${(gd.gan || []).join('') || '—'} | ${gd.zhis.map((z)=>`${z.zhi}·${z.shen}·${z.xing}`).join(' ')}`, i);
						})}
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="命宫·运气" key="minggong">
					<FreezeSubTab active={(this.state.auxTab || 'zhuke') === 'minggong'}>{() => (<>
						{mg ? (
							<>
								{mg.gong != null ? row('命宫', `${mg.gong}(${GONG_GUA[mg.gong] || '中'}) · 调整数 ${mg.adjusted}${mg.zhiWu && mg.via ? ` · 值五宫看${mg.via.join('转')}` : ''}`) : row('命宫', '不可定宫')}
								{(mg.flags || []).map((f, i)=>row('注', f, i))}
							</>
						) : <div style={{ opacity: 0.75 }}>左栏录年龄性别即定命宫(十位减三加减法,五宫看干)。</div>}
						{/* [3B] 流年:从日支起,男顺女逆,一支一岁 */}
						{ju && ju.dayZhi ? (()=>{
							const ln = liuNian({ dayZhi: ju.dayZhi, gender: inputs.mingGender, maxAge: 12, ju });
							return (
								<div style={{ marginTop: 10 }}>
									<div style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-huangji-accent, #c68f40)', margin: '4px 0 5px' }}>流年<span style={{ fontWeight: 400, opacity: 0.7 }}>（从日支{ju.dayZhi}起·{inputs.mingGender === 'female' ? '女逆' : '男顺'}·一支一岁）</span></div>
									<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px,1fr))', gap: 5, fontSize: 11.5 }}>
										{ln.map((y)=>(
											<div key={y.age} style={{ border: '1px solid var(--horosa-huangji-line, rgba(198,143,64,0.2))', borderRadius: 6, padding: '3px 6px', lineHeight: 1.4 }}>
												<b style={{ color: 'var(--horosa-huangji-accent, #c68f40)' }}>{y.age}岁</b> {y.zhi}<span style={{ opacity: 0.6 }}>·{y.gong}宫</span><br/>
												<span style={{ opacity: 0.85 }}>{y.shen}·{y.xing}·{y.men}门</span>
											</div>
										))}
									</div>
								</div>
							);
						})() : null}
						{/* [3C] 流月:月建定月位,与命宫比较生克 */}
						{ju ? (()=>{
							const MO = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
							const m = inputs.liuYueMonth || 1;
							const ly = liuYue({ ju, monthNum: m });
							const rel = (ly && mg && mg.gong != null) ? shengKeRel(wuXingOf(ly.zhi), wuXingOf(GONG_GUA[mg.gong])) : null;
							// [X1·P2-25] 推断四损益接线:吉星生我大吉/克我小吉、凶星生我小凶/克我大凶(以流月原神吉凶档论)。
							const sunyi = rel ? xingShenSunYi(YUAN_SHEN_JI_XIONG[ly.shen], rel) : null;
							return (
								<div style={{ marginTop: 10 }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 5px' }}>
										<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-huangji-accent, #c68f40)' }}>流月</span>
										<Select size="small" style={{ width: 92 }} value={m} onChange={(v)=>this.setState({ inputs: { ...inputs, liuYueMonth: v } }, ()=>{ if(this.state.ju){ this.saveSnap(); } })}
											options={MO.map((lab, i)=>({ value: i + 1, label: `${lab}月` }))}/>
									</div>
									{ly ? row(`${MO[m - 1]}月·建${ly.zhi}`, `${ly.gong}宫 · ${ly.shen}·${ly.xing}·${ly.men}门${rel ? ` · 月对命宫:${rel}${sunyi ? `(${sunyi})` : ''}` : ''}`) : null}
								</div>
							);
						})() : null}
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="断语·应期" key="duan">
					<FreezeSubTab active={(this.state.auxTab || 'zhuke') === 'duan'}>{() => (<>
						{!ju ? wait('定局后显示日支原神/天星、主客门、应期、事项。') : null}
						{/* [3E] 事项路由:据问事高亮当看之原神/天星 */}
						{ju && inputs.askEvent ? (()=>{ const sx = shiXiangKey(inputs.askEvent, this.state.settings); return sx ? (
							<div style={{ padding: '4px 9px', marginBottom: 6, borderRadius: 6, background: 'var(--horosa-huangji-accent-soft, rgba(198,143,64,0.12))', fontSize: 12 }}>事项：<b style={{ color: 'var(--horosa-huangji-accent, #c68f40)' }}>{sx.hint}</b>{sx.shen ? `（重点看原神 ${sx.shen}）` : ''}{sx.xing ? `（重点看天星 ${sx.xing}）` : ''}</div>
						) : null; })() : null}
						{ju && ju.dayZhi ? row(`日支${ju.dayZhi}`, `${ju.yuanShen[ju.dayZhi]}(${YUAN_SHEN_JI_XIONG[ju.yuanShen[ju.dayZhi]] || ''}):${(shenDuan(ju.yuanShen[ju.dayZhi])||{}).text || ''}`) : null}
						{ju && ju.dayZhi ? (()=>{ const xd = xingDuan(ju.tianXing[ju.dayZhi], this.state.settings.heKuiKoujing) || {}; return row('天星', `${ju.tianXing[ju.dayZhi]}${xd.alias ? `·${xd.alias}` : ''}:${xd.text || ''}`); })() : null}
						{zk && zk.zhuGong != null ? (()=>{ const gd = gongDuan(ju, zk.zhuGong); return gd && gd.men ? row(`主宫${zk.zhuGong}门`, `${gd.men}(${BA_MEN_JI_XIONG[gd.men] || ''}):${(menDuan(gd.men)||{}).ti || ''}`) : null; })() : null}
						{zk && zk.keGong != null ? (()=>{ const gd = gongDuan(ju, zk.keGong); return gd && gd.men ? row(`客宫${zk.keGong}门`, `${gd.men}(${BA_MEN_JI_XIONG[gd.men] || ''}):${(menDuan(gd.men)||{}).ti || ''}`) : null; })() : null}
						{/* [3D] 应期:中宫定时/驿马/冲 + 日支冲合 */}
						{ju ? (()=>{ const yq = yingQi(ju); return yq ? row('应期', `中宫${yq.zhongGong.join('')} → ${yq.shi}${yq.yiMa ? '(驿马·动)' : yq.dingShi ? '(定时·合)' : ''};${yq.note}`) : null; })() : null}
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="推断" key="tuiduan">
					<FreezeSubTab active={(this.state.auxTab || 'zhuke') === 'tuiduan'}>{() => (<>
						{TUI_DUAN.map((t, i)=>row(`第${i + 1}条`, t, i))}
					</>)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	render(){
		const slot = this.props.slot;
		const ju = this.state.ju;
		const empty = <div className="horosa-huangji-empty"><Empty description={this.state.error || '请择起支而定局'} image={Empty.PRESENTED_IMAGE_SIMPLE}/></div>;
		if(slot === 'controls'){ return this.renderControls(); }
		if(slot === 'center' || slot === 'aux'){
			if(!ju){ return empty; }
			return <div className="horosa-huangji-page horosa-huangji-redesign" ref={this.rootRef}>{slot === 'aux' ? this.renderAux(ju) : this.renderCenter(ju)}</div>;
		}
		return (
			<div className="horosa-huangji-page horosa-fg-page horosa-astro-redesign horosa-huangji-redesign" ref={this.rootRef} style={{ height: this.props.height || '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
							<div className="horosa-side-panel-heading">
								<div>
									<div className="horosa-side-panel-title">飞宫设置</div>
									<div className="horosa-side-panel-subtitle">起支 · 日干支 · 命宫</div>
								</div>
							</div>
							{this.renderControls()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
							<div className="horosa-huangji-board-host">{ju ? this.renderCenter(ju) : empty}</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
							<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
								<div>
									<div className="horosa-side-panel-title">局面判读</div>
									<div className="horosa-side-panel-subtitle">主客 · 宫面 · 命宫</div>
								</div>
							</div>
							{this.renderAux(ju)}
						</div>
					</div>
				</div>
			</div>
		);
	}
}
export default FeiGongMain;
export { STORE_KEY, DEFAULT_SETTINGS };
