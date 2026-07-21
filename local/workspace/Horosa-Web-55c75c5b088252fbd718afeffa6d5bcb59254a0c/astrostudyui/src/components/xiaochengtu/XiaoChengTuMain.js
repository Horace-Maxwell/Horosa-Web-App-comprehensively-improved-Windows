// 小成图 · 三栏主组件(左栏起卦控件 / 中栏九宫佈局 / 右栏推演判读)。
// 🔴 宿主范式=本页签(CnYiBuMain)每 tab 只渲染组件一次 → 自出三栏(照同页邻居 GuiceMain)。
// 🔴 卦是【冻结值】:起卦(手动/两数/股价所出)一经起出即不可重起;改用宫/设置只重排推演。
// 🔴 本技法起卦不吃占时(手动卦/数字/股价三式皆非时间起例)——AI 挂载登记时不进
//    TIME_CASTABLE_DIVINATION(时间可起课清单),挂载重算无「按时重起」路径。
import React, { Component, createRef } from 'react';
import { XQSideSection } from '../xq-ui';
import { Tabs, Empty, Input, InputNumber, Radio, Button, Select, Tag } from 'antd';
import { qiGuaManual, qiGuaByNumbers, qiGuaByStock, qiGuaByDaYan } from './core/xiaochengtuQiGua';
import { buildPan, zhengTui, zhengTuiText, pangTui, tuiDao, shuZhan, siXiangOfHex, fuDu, zhangDie, sanFen, liangFen, klineYongGong } from './core/xiaochengtuPan';
import { DI_PAN, GUA_GONG, ZHONG_GONG_NOTE, SI_XIANG_BASE, STOCK_QI_GUA_TEXT, GONG_INFO, YAN_PAN_RULES } from './core/xiaochengtuConst';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { safeJsonStringifyToStorage, safeJsonParseFromStorage } from '../../utils/safeStorage';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { subscribeRemoteNongli, timePatchFromDateTime, geoPatchFromRec, snapshotMetaFromFields, buildQiKeTimeLines } from '../../utils/divinationTimeDraft';

const TabPane = Tabs.TabPane;
const STORE_KEY = 'horosa.xiaochengtu.settings.v1';
const GUA8 = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const LUOSHU_ROWS = [[4, 9, 2], [3, 5, 7], [8, 1, 6]]; // 洛书九宫排布(5 中宫无卦)
const DEFAULT_SETTINGS = { qiguaFa: 'manual', qiguaShu: 'tiandi', yongGong: 1 };

// AI 段表(与 AI 导出段表逐字一致的段头真值):
// ask/qigua/butu/tuidao/sixiang/yingqi/stock(stock 仅股市模式出)。
export function buildXiaoChengTuSnapshotText(pan, qi, opts){
	if(!pan || !qi){ return ''; }
	const o = opts || {};
	const g0 = Number(o.yongGong) || 1;
	const out = [];
	out.push('[问事]');
	out.push(o.askEvent ? `所问:${o.askEvent}` : '(未录问事)');
	out.push('');
	out.push('[起卦]');
	((o.timeLines) || []).forEach((l)=>out.push(l));
	out.push(`本卦:${qi.ben.name};之卦:${qi.zhi.name};动爻:${(qi.dongYaos || []).join('、') || '无'}`);
	(qi.steps || []).forEach((s)=>{ out.push(`${s.label}:${s.detail} → ${s.value}`); });
	out.push('');
	out.push('[佈局]');
	LUOSHU_ROWS.forEach((row)=>{
		out.push(row.map((g)=>(g === 5 ? '五(中)' : `${g}${pan.tianPan[g] || '—'}`)).join(' | '));
	});
	out.push(ZHONG_GONG_NOTE);
	out.push('');
	out.push('[推导]');
	// [X1·P2-27] 九宫八方各有所主:用宫宫主事项入快照(GONG_INFO 判读依据此前零消费)。
	if(GONG_INFO[g0]){ out.push(`用宫所主:${g0}宫${GONG_INFO[g0].gua}(${GONG_INFO[g0].fangwei}·${GONG_INFO[g0].yue}),宫主${GONG_INFO[g0].zhu}`); }
	const td = tuiDao(pan, g0);
	if(td){
		out.push(`用宫 ${g0}(${DI_PAN[g0]}):${zhengTuiText(td)}`);
		if(td.pang){ out.push(`伏位旁推:${zhengTuiText(td.pang) || '—'}`); }
	}else{ out.push('用宫非法,不可推导。'); }
	out.push('');
	out.push('[四象]');
	const sxB = siXiangOfHex(qi.ben);
	const sxZ = siXiangOfHex(qi.zhi);
	if(sxB){ out.push(`本卦${qi.ben.name}:${sxB.type}(${SI_XIANG_BASE[sxB.type] || ''}·${sxB.yi};${sxB.dePei ? '得配' : '失配'}:${sxB.ci})`); }
	if(sxZ){ out.push(`之卦${qi.zhi.name}:${sxZ.type}(${SI_XIANG_BASE[sxZ.type] || ''}·${sxZ.yi};${sxZ.dePei ? '得配' : '失配'}:${sxZ.ci})`); }
	out.push('');
	out.push('[应期]');
	const sz = shuZhan(pan, g0);
	if(sz && sz.sum != null){ out.push(`数占:正推链宫数相加 = ${sz.sum}(问数以数应)`); }
	else if(sz && sz.fuWei){ out.push('伏位不动,数占无链和;参旁推。'); }
	else{ out.push('—'); }
	// 通用应期:三分法(旬)/两分法(半月),应期卦取用宫天盘卦(与股市幅度/涨跌分治)。
	const ygGua = pan.tianPan[g0];
	const sf = ygGua ? sanFen(ygGua) : null;
	const lf = ygGua ? liangFen(ygGua) : null;
	if(sf){ out.push(`三分定旬:用宫得${ygGua}卦 → ${sf.xun}旬`); }
	if(lf){ out.push(`两分定半月:用宫得${ygGua}卦 → ${lf.ban}月(${lf.yy})`); }
	if(qi.mode === 'stock'){
		out.push('');
		out.push('[股市]');
		// [X1·P2-28] 研判法则接线(YAN_PAN_RULES 此前零消费):开盘=用宫天盘卦、收盘=正推末卦,各以两分/三分断之。
		const openGua = pan.tianPan[g0];
		const tdS = tuiDao(pan, g0);
		const closeGua = tdS && !tdS.fuWei && tdS.steps && tdS.steps.length ? tdS.steps[tdS.steps.length - 1].tianGua : (tdS && tdS.pang ? tdS.pang.gua : openGua);
		if(openGua){ out.push(`研判·开盘:用宫天盘${openGua} → ${zhangDie(openGua) || '—'}(幅度${(fuDu(openGua) || {}).fudu || '—'})`); }
		if(closeGua){ out.push(`研判·收盘:正推末卦${closeGua} → ${zhangDie(closeGua) || '—'}(幅度${(fuDu(closeGua) || {}).fudu || '—'})`); }
		const fd = fuDu(qi.ben.up);
		const zd = zhangDie(qi.ben.up);
		if(fd){ out.push(`幅度三分:${fd.gua} 主爻位 ${fd.zhuYao} · 幅度${fd.fudu}`); }
		if(zd){ out.push(`涨跌两分:上卦${qi.ben.up} → ${zd}`); }
		if(o.kline && o.kline.body){
			const ky = klineYongGong(o.kline);
			out.push(ky ? `K线定用宫:${ky.key} → ${ky.gua}宫(${ky.gong})` : 'K线十字星判空,不定用宫。');
		}
	}
	return out.join('\n').trim();
}

/** 无头重算(AI 挂载;卦=冻结值只自 payload 取,绝不重起)。 */
export function buildXiaoChengTuSnapshotForCase(payload, opts){
	try{
		const p = payload && typeof payload === 'object' ? payload : {};
		if(!p.qi || !p.qi.ben){ return ''; }
		const pan = buildPan(p.qi);
		if(!pan){ return ''; }
		return buildXiaoChengTuSnapshotText(pan, p.qi, { ...(p.options || {}), ...(opts || {}), askEvent: p.askEvent || '' });
	}catch(e){ return ''; }
}

class XiaoChengTuMain extends Component {
	constructor(p){
		super(p);
		const stored = safeJsonParseFromStorage(STORE_KEY);
		this.state = {
			settings: { ...DEFAULT_SETTINGS, ...(stored || {}) },
			inputs: { up: '乾', lo: '兑', dongYaosText: '', upNum: null, loNum: null, open: '', close: '', askEvent: '', seed: null, countsText: '', klineBody: null, klineUpper: false, klineLower: false },
			qi: null, error: '',
			// [自由起盘] 占问时刻·地点草稿(小成图起卦不吃占时:手动卦/两数/股价;此仅作事盘/AI 快照的时地上下文,不改卦象)。
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
				if(!evt || !evt.detail || evt.detail.module !== 'xiaochengtu' || !this.state.qi){ return; }
				const t = buildXiaoChengTuSnapshotText(this.getPan(), this.state.qi, { ...this.state.settings, askEvent: this.state.inputs.askEvent, kline: this.klineOpt(), timeLines: buildQiKeTimeLines(this.activeFields ? this.activeFields() : (this.state.localFields || this.props.fields)) });
				if(t){ saveModuleAISnapshot('xiaochengtu', t); evt.detail.snapshotText = t; }
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
		// [X1] 起卦后改问事等 inputs → 快照重存(设置变更已在 setSettings 回调重存)。
		if(this.state.qi && prevState && prevState.inputs !== this.state.inputs){ this.saveSnap(); }
		// [X1] 卦一变即告容器(dock 不在本组件树内,左栏起的卦容器无从知晓 → 「保存」伪禁用;对齐 guice 范式)。
		if(prevState && prevState.qi !== this.state.qi && typeof this.props.onResultChange === 'function'){ this.props.onResultChange(); }
	}
	// [X1 审计补] 事盘还原(对齐 wuzhao/tarot 等 13 技法既有范式):卦=冻结值自 payload.qi 回放,
	// 绝不重起(手动卦/大衍/两数/股价皆不可按时复现);options 回放到 settings(不写 localStorage 默认)。
	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('xiaochengtu');
		if(!saved || !saved.payload || !saved.payload.qi || !saved.payload.qi.ben){ return false; }
		if(!force && this.lastRestoredCaseId === saved.caseVersion){ return !!this.state.qi; }
		const p = saved.payload;
		const o = p.options && typeof p.options === 'object' ? p.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		// kline 属输入非设置:拆出回放到 inputs,免随 settings 持久化污染默认。
		const { kline, ...so } = o;
		this.setState({
			qi: p.qi, error: '',
			localFields: null,   // [X1·P2-42] 载档清时地草稿
			settings: { ...this.state.settings, ...so },
			inputs: {
				...this.state.inputs, askEvent: p.askEvent || '',
				klineBody: kline ? (kline.doji ? 'doji' : kline.body || null) : null,
				klineUpper: !!(kline && kline.upper), klineLower: !!(kline && kline.lower),
			},
		}, ()=>this.saveSnap());
		return true;
	}
	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	}
	// [自由起盘] 占问时刻/地点选择 → 写本地草稿(仅入事盘/AI,不重排卦象;不写主命盘)。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) } }, ()=>{ if(this.state.qi){ this.saveSnap(); } });
	}
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) } }, ()=>{ if(this.state.qi){ this.saveSnap(); } });
	}
	doQiGua(){
		const { settings, inputs } = this.state;
		let qi = null;
		const ds = `${inputs.dongYaosText || ''}`.split(/[,，\s]+/).map((x)=>parseInt(x, 10)).filter((x)=>x >= 1 && x <= 6);
		if(settings.qiguaFa === 'manual'){
			qi = qiGuaManual({ up: inputs.up, lo: inputs.lo, dongYaos: ds });
			if(!qi){ return this.setState({ error: '本卦上下卦非法', qi: null }); }
		}else if(settings.qiguaFa === 'dayan'){
			// 大衍蓍草:手录六爻(6/7/8/9)优先;否则以种子派生(未录则用当下时刻作种,一经起出即冻结可复现)。
			const cs = `${inputs.countsText || ''}`.split(/[,，\s]+/).map((x)=>parseInt(x, 10)).filter((x)=>[6, 7, 8, 9].indexOf(x) >= 0);
			const useManual = cs.length === 6;
			const seed = inputs.seed != null && `${inputs.seed}` !== '' ? inputs.seed : Date.now();
			qi = qiGuaByDaYan({ seed, manualCounts: useManual ? cs : undefined });
			if(!qi){ return this.setState({ error: '大衍起卦失败', qi: null }); }
		}else if(settings.qiguaFa === 'number'){
			if(!inputs.upNum || !inputs.loNum){ return this.setState({ error: '请录上下两数(≥1)', qi: null }); }
			qi = qiGuaByNumbers({ upNum: inputs.upNum, loNum: inputs.loNum, qiguaShu: settings.qiguaShu, dongYaos: ds });
			if(!qi){ return this.setState({ error: '两数非法,不可配卦', qi: null }); }
		}else{
			qi = qiGuaByStock({ open: inputs.open, close: inputs.close });
			if(!qi){ return this.setState({ error: '开收盘价非法(需含数字,如 1563.62)', qi: null }); }
		}
		this.setState({ qi, error: '' }, ()=>this.saveSnap());
	}
	setSettings(patch){
		const settings = { ...this.state.settings, ...patch };
		this.setState({ settings }, ()=>{ if(this.state.qi){ this.saveSnap(); } });
		safeJsonStringifyToStorage(STORE_KEY, settings);
	}
	getPan(){
		const { qi } = this.state;
		if(!qi){ return null; }
		const sig = JSON.stringify(qi);
		if(this._panKey === sig && this._panCache){ return this._panCache; }
		this._panKey = sig;
		this._panCache = buildPan(qi);
		return this._panCache;
	}
	// [X1·P1-13] K线形态输入 → klineYongGong 参数(仅股市模式;body 未选=不用)。
	klineOpt(){
		const i = this.state.inputs || {};
		if(this.state.settings.qiguaFa !== 'stock' || !i.klineBody){ return null; }
		if(i.klineBody === 'doji'){ return { body: '阳', doji: true }; }
		return { body: i.klineBody, upper: !!i.klineUpper, lower: !!i.klineLower, doji: false };
	}
	saveSnap(){
		const pan = this.getPan();
		const t = buildXiaoChengTuSnapshotText(pan, this.state.qi, { ...this.state.settings, askEvent: this.state.inputs.askEvent, kline: this.klineOpt(), timeLines: buildQiKeTimeLines(this.activeFields ? this.activeFields() : (this.state.localFields || this.props.fields)) });
		if(t){ saveModuleAISnapshot('xiaochengtu', t, snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() })); }
	}
	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 占问时刻/地点入事盘(草稿优先);卦象为冻结手动值,时地不改卦。
			fields: this.activeFields(),
			module: 'xiaochengtu',
			label: '小成图',
			payload: {
				options: { ...this.state.settings, kline: this.klineOpt() },
				qi: this.state.qi,          // 🔴 冻结卦(重算只重排推演,绝不重起)
				askEvent: this.state.inputs.askEvent,
				snapshot: buildXiaoChengTuSnapshotText(this.getPan(), this.state.qi, { ...this.state.settings, askEvent: this.state.inputs.askEvent, kline: this.klineOpt(), timeLines: buildQiKeTimeLines(this.activeFields ? this.activeFields() : (this.state.localFields || this.props.fields)) }),
			},
		});
	}
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.qi,
			primary: { key: 'qigua', label: '起卦', onClick: ()=>this.doQiGua() },
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
	// 大衍手录:六爻各一 Select(免手输错),自下而上;空位以 0 占位保住爻序,六爻全填才成手录、否则回落种子。
	renderDayanYao(){
		const { inputs } = this.state;
		const cs = `${inputs.countsText || ''}`.split(/[,，\s]+/).map((x)=>parseInt(x, 10));
		const OPTS = [
			{ value: 6, label: '老阴 6 ⚋✕' },
			{ value: 7, label: '少阳 7 ⚊' },
			{ value: 8, label: '少阴 8 ⚋' },
			{ value: 9, label: '老阳 9 ⚊○' },
		];
		const NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
		const valid = (x)=>[6, 7, 8, 9].indexOf(x) >= 0;
		const setYao = (i, v)=>{
			const arr = [0, 1, 2, 3, 4, 5].map((k)=>{
				const cur = k === i ? v : cs[k];
				return valid(cur) ? cur : 0; // 0 = 空位占坑,保住爻序
			});
			this.setState({ inputs: { ...inputs, countsText: arr.some((x)=>x !== 0) ? arr.join(' ') : '' } });
		};
		return (
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
				{NAMES.map((nm, i)=>(
					<div key={nm} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
						<span style={{ fontSize: 11, opacity: 0.62 }}>{nm}</span>
						<Select size="small" allowClear placeholder="—" style={{ width: '100%' }}
							value={valid(cs[i]) ? cs[i] : undefined}
							onChange={(v)=>setYao(i, v)} options={OPTS}/>
					</div>
				))}
			</div>
		);
	}
	renderControls(){
		const { settings, inputs } = this.state;
		const guaOpts = GUA8.map((g)=>({ value: g, label: g }));
		const fields = this.activeFields();
		return (
			<>
			{/* [自由起盘] 占问时刻·地点:小成图起卦不吃占时(手动卦/两数/股价),此处仅记录占问的时地入事盘/AI,不改卦象 */}
			<XQSideSection iconName={sideSectionIcon('time')} title="占问时刻 · 地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={buildDateTimeFromFields(fields)}
					onTimeChange={this.onTimeChanged}
					onGeoChange={this.changeGeo}
				/>
			</XQSideSection>
			<XQSideSection iconName="target" title="起卦参数" storageKey="xct.controls" className="horosa-side-input-section">
			<div className="horosa-xct-controls horosa-cnx-controls">
				{this.field('起卦法', <Select size="small" style={{ width: '100%' }} value={settings.qiguaFa} onChange={(v)=>this.setSettings({ qiguaFa: v })}
					options={[{ value: 'manual', label: '手动本卦' }, { value: 'dayan', label: '大衍蓍草' }, { value: 'number', label: '两数配卦' }, { value: 'stock', label: '股价起卦' }]}/>)}
				{settings.qiguaFa === 'dayan' ? (
					<>
						{this.field('起卦种子', <InputNumber size="small" style={{ width: '100%' }} placeholder="整数种子(空=当下时刻)" value={inputs.seed} onChange={(v)=>this.setState({ inputs: { ...inputs, seed: v } })}/>, '一经起出即冻结,可复现')}
						{this.field('手录六爻', this.renderDayanYao(), '选填:六爻全填才按蓍草手录,否则用种子派生')}
					</>
				) : null}
				{settings.qiguaFa === 'manual' ? this.field('本卦', (
					<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
						<Select size="small" style={{ flex: 1 }} value={inputs.up} onChange={(v)=>this.setState({ inputs: { ...inputs, up: v } })} options={guaOpts}/>
						<span style={{ opacity: 0.6, flex: '0 0 auto' }}>上/下</span>
						<Select size="small" style={{ flex: 1 }} value={inputs.lo} onChange={(v)=>this.setState({ inputs: { ...inputs, lo: v } })} options={guaOpts}/>
					</div>
				)) : null}
				{settings.qiguaFa === 'number' ? (
					<>
						{this.field('两数', (
							<div style={{ display: 'flex', gap: 6 }}>
								<InputNumber size="small" min={1} style={{ flex: 1 }} placeholder="上数" value={inputs.upNum} onChange={(v)=>this.setState({ inputs: { ...inputs, upNum: v } })}/>
								<InputNumber size="small" min={1} style={{ flex: 1 }} placeholder="下数" value={inputs.loNum} onChange={(v)=>this.setState({ inputs: { ...inputs, loNum: v } })}/>
							</div>
						))}
						{this.field('配数流派', <Radio.Group size="small" optionType="button" value={settings.qiguaShu} onChange={(e)=>this.setSettings({ qiguaShu: e.target.value })}
							options={[{ value: 'tiandi', label: '天地数' }, { value: 'xiantian', label: '先天数' }]}/>)}
					</>
				) : null}
				{settings.qiguaFa === 'stock' ? (
					<>
						{this.field('开/收盘', (
							<div style={{ display: 'flex', gap: 6 }}>
								<Input size="small" style={{ flex: 1 }} placeholder="开盘价" value={inputs.open} onChange={(e)=>this.setState({ inputs: { ...inputs, open: e.target.value } })}/>
								<Input size="small" style={{ flex: 1 }} placeholder="收盘价" value={inputs.close} onChange={(e)=>this.setState({ inputs: { ...inputs, close: e.target.value } })}/>
							</div>
						))}
						{/* [X1·P1-13] K线定用宫链此前无生产端(快照消费 o.kline 而 UI 无输入):补 K线形态控件。 */}
						{this.field('K线形态', (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
								<Radio.Group size="small" optionType="button" value={inputs.klineBody || ''} onChange={(e)=>this.setState({ inputs: { ...inputs, klineBody: e.target.value || null } })}
									options={[{ value: '', label: '不用' }, { value: '阳', label: '阳线' }, { value: '阴', label: '阴线' }, { value: 'doji', label: '十字星' }]}/>
								{inputs.klineBody && inputs.klineBody !== 'doji' ? (
									<Radio.Group size="small" optionType="button" value={`${inputs.klineUpper ? 'u' : ''}${inputs.klineLower ? 'l' : ''}`}
										onChange={(e)=>{ const v = e.target.value; this.setState({ inputs: { ...inputs, klineUpper: v.indexOf('u') >= 0, klineLower: v.indexOf('l') >= 0 } }); }}
										options={[{ value: '', label: '无影' }, { value: 'u', label: '仅上影' }, { value: 'l', label: '仅下影' }, { value: 'ul', label: '双影' }]}/>
								) : null}
								{(()=>{ const k = this.klineOpt(); if(!k){ return inputs.klineBody === 'doji' ? <em className="horosa-guice-hint">十字星阴阳莫辨,须手动择用宫</em> : null; }
									const hit = klineYongGong(k);
									return hit ? (
										<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
											<span style={{ opacity: 0.75 }}>定用宫:{hit.gua}({hit.gong}宫){hit.inferred ? '·推补' : ''}</span>
											<Button size="small" onClick={()=>this.setSettings({ yongGong: hit.gong })}>用此宫</Button>
										</div>
									) : null; })()}
							</div>
						), '按 K 线阴阳与影线定用宫(古法八分支)')}
					</>
				) : null}
				{(settings.qiguaFa === 'manual' || settings.qiguaFa === 'number') ? this.field('动爻', (
					<Select size="small" mode="multiple" allowClear style={{ width: '100%' }} placeholder="选动爻(可空)"
						value={`${inputs.dongYaosText || ''}`.split(/[,，\s]+/).map((x)=>parseInt(x, 10)).filter((x)=>x >= 1 && x <= 6)}
						onChange={(arr)=>this.setState({ inputs: { ...inputs, dongYaosText: (arr || []).slice().sort((a, b)=>a - b).join(',') } })}
						options={[{ value: 1, label: '初爻' }, { value: 2, label: '二爻' }, { value: 3, label: '三爻' }, { value: 4, label: '四爻' }, { value: 5, label: '五爻' }, { value: 6, label: '上爻' }]}/>
				)) : null}
				{this.field('用宫', (
					<Select size="small" style={{ width: '100%' }} value={settings.yongGong} onChange={(v)=>this.setSettings({ yongGong: v })}
						options={Object.keys(DI_PAN).map((g)=>({ value: Number(g), label: `${g} ${DI_PAN[g]}宫` }))}/>
				), '推演起点(伏位自动旁推)')}
				{this.field('问事', <Input size="small" placeholder="所占何事(入快照)" value={inputs.askEvent} onChange={(e)=>this.setState({ inputs: { ...inputs, askEvent: e.target.value } })}/>)}
				<Button type="primary" size="small" block onClick={()=>this.doQiGua()} style={{ marginTop: 2 }}>起卦</Button>
				{this.state.error ? <div className="horosa-guice-error">{this.state.error}</div> : null}
			</div>
			</XQSideSection>
			</>
		);
	}

	/** 中栏:洛书九宫佈局(地盘固定/天盘随卦;正推链步序标注;中宫五十无卦)。 */
	renderCenter(pan){
		const { settings, qi } = this.state;
		const g0 = Number(settings.yongGong) || 1;
		const td = tuiDao(pan, g0);
		const stepOf = {};
		if(td && !td.fuWei){ td.steps.forEach((st, i)=>{ stepOf[st.gong] = i + 1; }); }
		return (
			<div className="horosa-xct-board horosa-cnx-board">
				<div className="horosa-cnx-board-header">
					<div>
						<div className="horosa-cnx-board-title">本卦 {qi.ben.name} 之 {qi.zhi.name}</div>
						<div className="horosa-cnx-board-kicker">洛书九宫 · 天盘布卦{(qi.dongYaos || []).length ? ` · 动爻 ${qi.dongYaos.join('、')}` : ' · 无动爻'}</div>
					</div>
					<span className="horosa-cnx-board-badge">用宫 {g0}·{DI_PAN[g0]}</span>
				</div>
				<div className="horosa-cnx-grid is-cols-3">
					{LUOSHU_ROWS.flat().map((g)=>{
						if(g === 5){
							return (
								<div key="5" className="horosa-cnx-cell horosa-xct-cell is-center">
									<div className="horosa-xct-cell-name">五·十</div>
									<div className="horosa-xct-cell-meta">中宫无卦</div>
								</div>
							);
						}
						const isYong = g === g0;
						const step = stepOf[g];
						return (
							<div key={g} className={`horosa-cnx-cell horosa-xct-cell${isYong || step ? ' is-active' : ''}`}>
								{(isYong || step) ? (
									<div className="horosa-cnx-cell-seqs">
										{isYong ? <span className="horosa-cnx-seq is-1">用宫</span> : null}
										{step ? <span className={`horosa-cnx-seq is-${Math.min(step, 3)}`}>推{step}</span> : null}
									</div>
								) : null}
								<div className="horosa-xct-cell-name">{pan.tianPan[g] || '—'}</div>
								<div className="horosa-xct-cell-meta">地{DI_PAN[g]} · {g}宫</div>
							</div>
						);
					})}
				</div>
				<div className="horosa-cnx-flow">
					<div className="horosa-cnx-flow-step" style={{ flex: 'none', minWidth: 200, maxWidth: '100%' }}>
						<em>{td && td.fuWei ? '伏位 · 旁推' : '正推链'}</em>
						<span style={{ fontSize: 13, color: 'inherit' }}>{td ? (td.fuWei ? `用宫伏位不动 → 旁推:${td.pang ? zhengTuiText(td.pang) : '—'}` : zhengTuiText(td)) : '—'}</span>
					</div>
				</div>
			</div>
		);
	}

	/** 右栏推演五目 */
	renderAux(pan){
		const { settings, qi } = this.state;
		const g0 = Number(settings.yongGong) || 1;
		const td = pan ? tuiDao(pan, g0) : null;
		const sz = pan ? shuZhan(pan, g0) : null;
		const sxB = qi ? siXiangOfHex(qi.ben) : null;
		const sxZ = qi ? siXiangOfHex(qi.zhi) : null;
		const row = (k, v, i)=>(
			<div key={`${k}|${i || 0}`} className="horosa-cnx-item">
				<span className="horosa-cnx-item-k">{k}</span><span className="horosa-cnx-item-v">{v}</span>
			</div>
		);
		const wait = (t)=><div style={{ opacity: 0.6, fontSize: 12, padding: '6px 2px' }}>{t}</div>;
		return (
			<Tabs size="small" className="horosa-xct-aux horosa-cnx-aux">
				<TabPane tab="推导" key="tuidao">
					{!pan ? wait('左栏择起卦法「起卦」后显示正推/旁推链。') : <>
					{td ? row(`用宫 ${g0}${DI_PAN[g0]}`, td.fuWei ? '天地盘同卦,伏位不动' : zhengTuiText(td)) : row('推导', '—')}
					{td && td.pang ? row('旁推', zhengTuiText(td.pang) || '—') : null}
					{td && !td.fuWei ? td.steps.map((s, i)=>row(`第${i + 1}步`, `${s.diGua}宫见天盘${s.tianGua}(宫数${s.shu})`, i)) : null}
					</>}
				</TabPane>
				<TabPane tab="四象" key="sixiang">
					{!qi ? wait('起卦后显示本卦/之卦四象配断。') : <>
					{sxB ? row(`本卦${qi.ben.name}`, `${sxB.type}(${SI_XIANG_BASE[sxB.type] || ''}) · ${sxB.yi} · ${sxB.dePei ? '得配' : '失配'}:${sxB.ci}`) : null}
					{sxZ ? row(`之卦${qi.zhi.name}`, `${sxZ.type}(${SI_XIANG_BASE[sxZ.type] || ''}) · ${sxZ.yi} · ${sxZ.dePei ? '得配' : '失配'}:${sxZ.ci}`) : null}
					<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>阖辟往来:阖吉、辟凶、往悔、來吝(四象配断之纲)。</div>
					</>}
				</TabPane>
				<TabPane tab="应期" key="yingqi">
					{!pan ? wait('起卦后显示数占应期。') : <>
					{sz && sz.sum != null ? row('数占', `正推链宫数相加 = ${sz.sum}(问数以数应)`) : row('数占', sz && sz.fuWei ? '伏位无链和,参旁推' : '—')}
					{(()=>{ const yg = pan.tianPan[g0]; const sf = yg ? sanFen(yg) : null; return sf ? row('三分·旬', `用宫得 ${yg} 卦 → ${sf.xun}旬`, 1) : null; })()}
					{(()=>{ const yg = pan.tianPan[g0]; const lf = yg ? liangFen(yg) : null; return lf ? row('两分·半月', `用宫得 ${yg} 卦 → ${lf.ban}月(${lf.yy})`, 2) : null; })()}
					<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>三分法定上/中/下旬,两分法定前/后半月;应期卦取用宫天盘卦(与股市幅度/涨跌分治)。</div>
					</>}
				</TabPane>
				{qi && qi.mode === 'stock' ? (
					<TabPane tab="股市" key="stock">
						{(()=>{ const fd = fuDu(qi.ben.up); return fd ? row('幅度三分', `${fd.gua} 主爻位 ${fd.zhuYao} · 幅度${fd.fudu}`) : null; })()}
						{(()=>{ const zd = zhangDie(qi.ben.up); return zd ? row('涨跌两分', `上卦${qi.ben.up} → ${zd}`) : null; })()}
						{(()=>{ const k = this.klineOpt(); if(!k){ return (this.state.inputs.klineBody === 'doji') ? row('K线定用宫', '十字星阴阳莫辨,须手动择用宫') : null; }
							const hit = klineYongGong(k); return hit ? row('K线定用宫', `${hit.key} → ${hit.gua}宫(${hit.gong})${hit.inferred ? '·推补' : ''}`) : null; })()}
						{(()=>{ const og = pan.tianPan[g0]; return og ? row('研判·开盘', `用宫天盘${og} → ${zhangDie(og) || '—'}(幅度${(fuDu(og) || {}).fudu || '—'})`, 8) : null; })()}
						{(()=>{ const tdS = tuiDao(pan, g0); const cg = tdS && !tdS.fuWei && tdS.steps && tdS.steps.length ? tdS.steps[tdS.steps.length - 1].tianGua : (tdS && tdS.pang ? tdS.pang.gua : pan.tianPan[g0]); return cg ? row('研判·收盘', `正推末卦${cg} → ${zhangDie(cg) || '—'}(幅度${(fuDu(cg) || {}).fudu || '—'})`, 9) : null; })()}
						<div style={{ marginTop: 8, fontSize: 11.5, opacity: 0.68, lineHeight: 1.6 }}>{YAN_PAN_RULES.slice(0, 4).join(' ')}</div>
						<pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.75, marginTop: 8 }}>{STOCK_QI_GUA_TEXT}</pre>
					</TabPane>
				) : null}
				<TabPane tab="起卦" key="qigua">
					{!qi ? wait('起卦后显示起卦步骤明细。') : <>
					{(qi.steps || []).map((s, i)=>row(s.label, `${s.detail} → ${s.value}`, i))}
					{!((qi.steps || []).length) ? row('起卦', `手动:${qi.ben.name} 动 ${(qi.dongYaos || []).join('、') || '无'}`) : null}
					</>}
				</TabPane>
			</Tabs>
		);
	}

	render(){
		const slot = this.props.slot;
		const pan = this.getPan();
		const empty = <div className="horosa-huangji-empty"><Empty description={this.state.error || '请择起卦法而起卦'} image={Empty.PRESENTED_IMAGE_SIMPLE}/></div>;
		if(slot === 'controls'){ return this.renderControls(); }
		if(slot === 'center' || slot === 'aux'){
			if(!pan){ return empty; }
			return <div className="horosa-huangji-page horosa-huangji-redesign" ref={this.rootRef}>{slot === 'aux' ? this.renderAux(pan) : this.renderCenter(pan)}</div>;
		}
		return (
			<div className="horosa-huangji-page horosa-xct-page horosa-astro-redesign horosa-huangji-redesign" ref={this.rootRef} style={{ height: this.props.height || '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
							<div className="horosa-side-panel-heading">
								<div>
									<div className="horosa-side-panel-title">小成图设置</div>
									<div className="horosa-side-panel-subtitle">起卦法 · 用宫 · 问事</div>
								</div>
							</div>
							{this.renderControls()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
							<div className="horosa-huangji-board-host">{pan ? this.renderCenter(pan) : empty}</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
							<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
								<div>
									<div className="horosa-side-panel-title">推演判读</div>
									<div className="horosa-side-panel-subtitle">推导 · 四象 · 应期</div>
								</div>
							</div>
							{this.renderAux(pan)}
						</div>
					</div>
				</div>
			</div>
		);
	}
}
export default XiaoChengTuMain;
export { STORE_KEY, DEFAULT_SETTINGS };
