// 小六壬 · 三栏主组件(左栏控件 / 中栏宫位结构图 / 右栏判读)。
// 🔴 宿主范式=本页签(CnYiBuMain)每 tab 只渲染组件一次 → 自出三栏(照同页邻居 GuiceMain);
//    slot 分支保留供命盘侧宿主/将来嵌入。
// 🔴 课是【冻结值】:起课(三数所出)一经起出即不可重起,改流派重排判读、绝不重起课。
// 🔴 中栏为抽象宫位结构图(六宫环/九宫格),绝不画拟人手掌——掌诀原文以文字目呈现。
import React, { Component, createRef } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { XQSideSection } from '../xq-ui';
import { Tabs, Empty, Input, InputNumber, Radio, Button, Switch, Tag } from 'antd';
import { qiKe, teLi } from './core/xiaoliurenKe';
import {
	MAIN_RING, MAIN_PALM, DAO_RING, DAO_NINE, DAO_YI, BAI_JIE, DAO_FA_TEXT, MAIN_FA_TEXT,
	STAGE_ROLES, ACROSS_NOTE, TONG_SHEN_NOTE, BING_FU_DISCREPANCY_NOTE, SAN_JIE_TEXT,
} from './core/xiaoliurenConst';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { safeJsonStringifyToStorage, safeJsonParseFromStorage } from '../../utils/safeStorage';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { deriveLocalNongli, deriveNongliUniversalSync, subscribeRemoteNongli, timePatchFromDateTime, geoPatchFromRec, snapshotMetaFromFields, buildQiKeTimeLines } from '../../utils/divinationTimeDraft';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;
const STORE_KEY = 'horosa.xiaoliuren.settings.v1';
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const DEFAULT_SETTINGS = { school: 'main', showOneThree: true };

// AI 段表(与 AI 导出段表逐字一致的段头真值):
// ask/qike/sanchuan/shengke/jiushen/huajie。主流六宫无五行生克(shengke 段如实标注)。
export function buildXiaoLiuRenSnapshotText(ke, askEvent, snapOpts){
	if(!ke || !Array.isArray(ke.chuan)){ return ''; }
	const a = ke.analysis || {};
	const out = [];
	out.push('[问事]');
	out.push(askEvent ? `所问:${askEvent}` : '(未录问事)');
	out.push('');
	out.push('[起课]');
	((snapOpts && snapOpts.timeLines) || []).forEach((l)=>out.push(l));
	out.push(`流派:${ke.school === 'dao' ? '道门九宫' : '主流六宫'};三数:${(ke.nums || []).join('、')}(月/日/时,作一顺数自大安起)`);
	out.push('');
	out.push('[三传]');
	ke.chuan.forEach((c, i)=>{
		const nine = DAO_NINE[c];
		const extra = ke.school === 'dao' && nine ? `(${nine.gua}${nine.wuxing})` : '';
		out.push(`第${['一', '二', '三'][i]}传 ${c}${extra} —— ${STAGE_ROLES[i]}`);
	});
	out.push('');
	out.push('[生克]');
	if(ke.school !== 'dao'){
		out.push('主流六宫不调取五行生克(判读以各宫吉凶直断)。');
	}else if((a.pairs || []).length){
		a.pairs.forEach((p)=>{ out.push(`${p.relText} → ${p.duan || p.rel}`); });
		if(a.across && !(snapOpts && snapOpts.showOneThree === false)){ out.push(`一↔三:${a.across.rel}(${ACROSS_NOTE})`); }
	}else{
		out.push('相邻两传无生克(比和或无关)。');
	}
	out.push('');
	out.push('[九神]');
	const ring = ke.school === 'dao' ? DAO_RING : MAIN_RING;
	ring.forEach((n)=>{
		const nine = DAO_NINE[n];
		const yi = DAO_YI[n];
		out.push(`${n}${ke.school === 'dao' && nine ? `(${nine.gua}${nine.wuxing})` : ''}:${yi || '—'}`);
	});
	if(ke.school === 'dao'){ out.push(BING_FU_DISCREPANCY_NOTE); }
	out.push('');
	out.push('[化解]');
	const bj = (a.baiJie || []);
	if(bj.length){ bj.forEach((b)=>{ out.push(`${b.victim}被${b.aggressor}克 → 拜${b.bai}化解`); }); }
	else{ out.push('本课无被克之传,无需拜解。'); }
	const tl = teLi(ke.chuan);
	if(tl.length){ out.push(...tl.map((t)=>`特例:${t.text}`)); }
	return out.join('\n').trim();
}

/** 无头重算(AI 挂载「按设置重算」;课为冻结值只自 payload 取,绝不按时重起)。 */
export function buildXiaoLiuRenSnapshotForCase(payload, opts){
	try{
		const p = payload && typeof payload === 'object' ? payload : {};
		const nums = p.nums;
		if(!Array.isArray(nums) || nums.length !== 3){ return ''; }
		const school = (opts && opts.school) || (p.options && p.options.school) || 'main';
		const ke = qiKe({ m: nums[0], d: nums[1], h: nums[2], school });
		const showOneThree = (opts && opts.showOneThree != null) ? opts.showOneThree
			: ((p.options && p.options.showOneThree != null) ? p.options.showOneThree : true);
		return ke ? buildXiaoLiuRenSnapshotText(ke, p.askEvent || '', { showOneThree }) : '';
	}catch(e){ return ''; }
}

// 宫位正位映射(学理排布,绝不平铺):
// 主流=掌诀图(上排=指尖三节:留连·速喜·赤口;下排=指根一节:大安·空亡·小吉);
// 道门=后天八卦九宫(南上北下:巽离坤/震中兑/艮坎乾,按 DAO_NINE 各神所属之卦落位)。
const MAIN_AREAS = { 留连: '1 / 1', 速喜: '1 / 2', 赤口: '1 / 3', 大安: '2 / 1', 空亡: '2 / 2', 小吉: '2 / 3' };
const DAO_AREAS = { 留连: '1 / 1', 速喜: '1 / 2', 病符: '1 / 3', 大安: '2 / 1', 空亡: '2 / 2', 赤口: '2 / 3', 桃花: '3 / 1', 小吉: '3 / 2', 天德: '3 / 3' };
// 吉凶语义(色条):大安/速喜/小吉/天德=吉;留连/桃花=平;赤口/空亡/病符=凶。
const TONE_OF = { 大安: 'ji', 速喜: 'ji', 小吉: 'ji', 天德: 'ji', 留连: 'ping', 桃花: 'ping', 赤口: 'xiong', 空亡: 'xiong', 病符: 'xiong' };

class XiaoLiuRenMain extends Component {
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
			inputs: { useTime: true, m: null, d: null, h: null, askEvent: '' },
			ke: null, error: '',
			// [自由起盘] 本地时间地理草稿(null=跟主命盘,字节现状;非空=用户左栏自选时间/经纬起课)。
			localFields: null,
		};
		this.rootRef = createRef();
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
	}

	componentDidMount(){
		// [issue#74 同类] 农历桥回包履约(与灵棋/飞宫同律):域外年首拍快照缺农历/四柱行,
		// 只 forceUpdate 不重存则缓存/事盘恒缺——桥契约「远程回包后由订阅方重存快照补全」。
		this._unsubNongli = subscribeRemoteNongli(() => {
			this.forceUpdate();
			if(this.state.ke){ this.saveSnap(); }
		});
		if(typeof window !== 'undefined'){
			this._onSnapRefresh = (evt)=>{
				if(!evt || !evt.detail || evt.detail.module !== 'xiaoliuren' || !this.state.ke){ return; }
				// [issue#74 同类] timeLines 必带(与 saveSnap/feigong/xiaochengtu 同构):此前第三参
				// 裸 settings → refresh 版无起卦时间/农历/四柱,反把 saveSnap 的完整版覆盖掉。
				const t = buildXiaoLiuRenSnapshotText(this.state.ke, this.state.inputs.askEvent, { ...this.state.settings, timeLines: buildQiKeTimeLines(this.activeFields()) });
				if(t){ saveModuleAISnapshot('xiaoliuren', t); evt.detail.snapshotText = t; }
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
	componentDidUpdate(prev, prevState){
		if(prev.value !== this.props.value && this.state.ke){ this.saveSnap(); }
		if(prev.fields !== this.props.fields && this.props.fields){ this.restoreFromCurrentCase(); }
		// [X1] 起课后改问事等 inputs → 快照重存(否则挂载/导出读旧 [问事];流派/开关已各自 saveSnap)。
		if(this.state.ke && prevState && prevState.inputs !== this.state.inputs){ this.saveSnap(); }
		// [X1] 课一变即告容器(dock 不在本组件树内,左栏起的课容器无从知晓 → 「保存」伪禁用;对齐 guice 范式)。
		if(prevState && prevState.ke !== this.state.ke && typeof this.props.onResultChange === 'function'){ this.props.onResultChange(); }
	}
	// [X1 审计补] 事盘还原(对齐 wuzhao/tarot 等 13 技法既有范式):课=冻结三数自 payload.nums 复排
	// (qiKe 确定性),绝不按当前时间重起;useTime 置 false 让左栏忠实显示冻结三数;options 回放流派等设置。
	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('xiaoliuren');
		if(!saved || !saved.payload || !Array.isArray(saved.payload.nums) || saved.payload.nums.length !== 3){ return false; }
		if(!force && this.lastRestoredCaseId === saved.caseVersion){ return !!this.state.ke; }
		const p = saved.payload;
		const o = p.options && typeof p.options === 'object' ? p.options : {};
		const settings = { ...this.state.settings, ...o };
		const ke = qiKe({ m: p.nums[0], d: p.nums[1], h: p.nums[2], school: settings.school });
		if(!ke){ return false; }
		this.lastRestoredCaseId = saved.caseVersion;
		this.setState({
			ke, error: '', settings,
			localFields: null,   // [X1·P2-42] 载档清时地草稿
			inputs: { ...this.state.inputs, useTime: false, m: p.nums[0], d: p.nums[1], h: p.nums[2], askEvent: p.askEvent || '' },
		}, ()=>this.saveSnap());
		return true;
	}
	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	}
	// 起课之时:农历月/日与时支序。默认真源 props.value.chart.nongli(bazi.time 为时柱,
	// nongli.monthInt/dayInt 为农历月日);用户左栏改过时间/经纬(localFields 非空)则本地派生。
	ctx(){
		let nl;
		if(this.state.localFields){
			nl = deriveNongliUniversalSync(this.state.localFields) || {};
		}else{
			const chart = (this.props.value && this.props.value.chart) || {};
			nl = chart.nongli || {};
		}
		const b = nl.bazi || {};
		const hourZhi = (b.time && b.time.branch && b.time.branch.cell) || undefined;
		return {
			lunarMonth: nl.monthInt,
			lunarDay: nl.dayInt,
			hourNum: hourZhi ? ZHI.indexOf(hourZhi) + 1 : undefined,
			hourZhi,
		};
	}
	// [自由起盘] 左栏时间选择 → 写本地草稿(不 dispatch);若已起课且用占时则按新时间重排。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		const localFields = { ...base, ...timePatchFromDateTime(dt) };
		this.setState({ localFields }, ()=>{ if(this.state.ke && this.state.inputs.useTime){ this.doQiKe(); } });
	}
	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区自动校正 + 重锚时间 + 地名);已起课且用占时则重排。
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		const localFields = { ...base, ...geoPatchFromRec(rec, base) };
		this.setState({ localFields }, ()=>{ if(this.state.ke && this.state.inputs.useTime){ this.doQiKe(); } });
	}
	doQiKe(){
		const { settings, inputs } = this.state;
		let m; let d; let h;
		if(inputs.useTime){
			const c = this.ctx();
			m = c.lunarMonth; d = c.lunarDay; h = c.hourNum;
			if(!m || !d || !h){ return this.setState({ error: '排盘未出农历月日时 —— 请先起盘,或改手动三数', ke: null }); }
		}else{
			m = inputs.m; d = inputs.d; h = inputs.h;
			if(!m || !d || !h){ return this.setState({ error: '请录入三数(月/日/时,均 ≥1)', ke: null }); }
		}
		const ke = qiKe({ m, d, h, school: settings.school });
		if(!ke){ return this.setState({ error: '三数非法,不可起课', ke: null }); }
		// horosa_panel_ready_v1:ke 落定 = 六宫课盘(中栏)与三传断语(右栏)画完的那一次 setState。
		this.setState({ ke, error: '' }, ()=>{ markPanelReady('cnyibu'); this.saveSnap(); });
	}
	// 改流派:课(三数)冻结,按新环重排三传(重排≠重起——三数不变)。
	setSetting(key, val){
		const settings = { ...this.state.settings, [key]: val };
		this.setState({ settings }, ()=>{ if(this.state.ke){ this.saveSnap(); } });
		safeJsonStringifyToStorage(STORE_KEY, settings);
	}
	setSchool(school){
		const settings = { ...this.state.settings, school };
		this.setState({ settings });
		safeJsonStringifyToStorage(STORE_KEY, settings);
		if(this.state.ke){
			const nums = this.state.ke.nums;
			const ke = qiKe({ m: nums[0], d: nums[1], h: nums[2], school });
			this.setState({ ke }, ()=>this.saveSnap());
		}
	}
	saveSnap(){
		const t = buildXiaoLiuRenSnapshotText(this.state.ke, this.state.inputs.askEvent, { ...this.state.settings, timeLines: buildQiKeTimeLines(this.activeFields()) });
		// meta 补时间地理键(用生效 fields=草稿或主盘):命盘缓存路径确凿匹配 + 事盘/导出口径一致。
		if(t){ saveModuleAISnapshot('xiaoliuren', t, snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() })); }
	}
	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存事盘用生效 fields:改过时间地理则存草稿值(divTime/经纬/地名来自草稿,不写主命盘)。
			fields: this.activeFields(),
			module: 'xiaoliuren',
			label: '小六壬',
			payload: {
				options: { ...this.state.settings },
				nums: this.state.ke ? this.state.ke.nums : null,   // 🔴 冻结三数(重算只重排,绝不重起)
				askEvent: this.state.inputs.askEvent,
				// [issue#74 同类] 存档快照同带 timeLines(与 saveSnap 同构,否则事盘恒缺起课时间段)。
				snapshot: buildXiaoLiuRenSnapshotText(this.state.ke, this.state.inputs.askEvent, { ...this.state.settings, timeLines: buildQiKeTimeLines(this.activeFields()) }),
			},
		});
	}
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.ke,
			primary: { key: 'qike', label: '起课', onClick: ()=>this.doQiKe() },
			save: ()=>this.clickSaveCase(),
		};
	}

	/** 左栏 */
	// [左栏统一] 全站字段范式(照 guice.field):Select/Input=is-wide 竖排(标题在上+全宽);Switch=switch-field 横排。
	field(label, node, hint, row){
		return (
			<label className={`horosa-huangji-select-field${row ? ' horosa-heluo-switch-field' : ' is-wide'}`} key={label}>
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
			{/* [自由起盘] 时间与地点:独立草稿,「取数」开时按此时间起课(不写主命盘) */}
			<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={buildDateTimeFromFields(fields)}
					onTimeChange={this.onTimeChanged}
					onGeoChange={this.changeGeo}
				/>
			</XQSideSection>
			<XQSideSection iconName="target" title="起课参数" storageKey="xlr.controls" className="horosa-side-input-section">
			<div className="horosa-xlr-controls horosa-cnx-controls">
				{this.field('流派', <Radio.Group size="small" optionType="button" value={settings.school} onChange={(e)=>this.setSchool(e.target.value)}
					options={[{ value: 'main', label: '主流六宫' }, { value: 'dao', label: '道门九宫' }]}/>)}
				{/* 一↔三 跨传关系仅道门九宫消费;主流六宫下无处生效,隐藏免死开关观感。 */}
				{settings.school === 'dao' ? this.field('一↔三', <Switch size="small" checked={settings.showOneThree !== false} onChange={(v)=>this.setSetting('showOneThree', v)}/>, '跨传关系行(文档无定论,仅列关系)', true) : null}
				{this.field('取数', <Switch size="small" checked={inputs.useTime} onChange={(v)=>this.setState({ inputs: { ...inputs, useTime: v } })}/>, inputs.useTime ? `按占时(农历${c.lunarMonth || '?'}月${c.lunarDay || '?'}日·${c.hourZhi || '?'}时)` : '手动三数', true)}
				{!inputs.useTime ? this.field('三数', (
					<div style={{ display: 'flex', gap: 6 }}>
						<InputNumber size="small" min={1} style={{ flex: 1 }} placeholder="月" value={inputs.m} onChange={(v)=>this.setState({ inputs: { ...inputs, m: v } })}/>
						<InputNumber size="small" min={1} style={{ flex: 1 }} placeholder="日" value={inputs.d} onChange={(v)=>this.setState({ inputs: { ...inputs, d: v } })}/>
						<InputNumber size="small" min={1} style={{ flex: 1 }} placeholder="时" value={inputs.h} onChange={(v)=>this.setState({ inputs: { ...inputs, h: v } })}/>
					</div>
				)) : null}
				{this.field('问事', <Input size="small" placeholder="所占何事(入快照)" value={inputs.askEvent} onChange={(e)=>this.setState({ inputs: { ...inputs, askEvent: e.target.value } })}/>)}
				<Button type="primary" size="small" block onClick={()=>this.doQiKe()} style={{ marginTop: 2 }}>起课</Button>
				{this.state.error ? <div className="horosa-guice-error">{this.state.error}</div> : null}
			</div>
			</XQSideSection>
			</>
		);
	}

	/** 中栏:抽象宫位结构图(主流=六宫 2×3;道门=九宫 3×3)。三传标序高亮;绝不画拟人手。 */
	renderCenter(ke){
		const ring = ke.school === 'dao' ? DAO_RING : MAIN_RING;
		const order = ke.chuan;
		const posOf = (name)=>{
			const idxs = [];
			order.forEach((c, i)=>{ if(c === name){ idxs.push(i + 1); } });
			return idxs;
		};
		const cols = ke.school === 'dao' ? 3 : 3;
		return (
			<div className="horosa-xlr-board horosa-cnx-board">
				<div className="horosa-cnx-board-header">
					<div>
						<div className="horosa-cnx-board-title">{ke.school === 'dao' ? '道门九宫' : '主流六宫'}</div>
						<div className="horosa-cnx-board-kicker">三数 {ke.nums.join('、')} · 自大安作一顺数</div>
					</div>
					<span className="horosa-cnx-board-badge">{['一', '二', '三'].map((z, i)=>`${z}传${order[i]}`).join(' · ')}</span>
				</div>
				<div className={`horosa-cnx-grid is-cols-${cols}`}>
					{ring.map((name)=>{
						const nine = DAO_NINE[name];
						const hits = posOf(name);
						const active = hits.length > 0;
						const area = (ke.school === 'dao' ? DAO_AREAS : MAIN_AREAS)[name];
						const tone = TONE_OF[name];
						const isDao = ke.school === 'dao';
						// 节(掌位):道门取九宫掌位、主流取六宫掌位;卦·五行·方位 与 三关键词 均自 DAO_NINE 派生。
						const palm = isDao ? (nine && nine.palm) : MAIN_PALM[name];
						const JIE = ['一', '二', '三'];
						const jieText = palm ? `${palm.finger}·第${JIE[palm.jie - 1] || palm.jie}节` : '';
						const guaLine = nine ? (isDao
							? `${nine.gua === '中' ? '中宫' : nine.gua} · ${nine.wuxing} · ${nine.fangwei}`
							: `${nine.wuxing} · ${nine.fangwei}`) : '';
						return (
							<div key={name} className={`horosa-cnx-cell horosa-cnx-cell-sq${active ? ' is-active' : ''}${tone ? ` is-${tone}` : ''}`}
								style={area ? { gridRow: area.split(' / ')[0], gridColumn: area.split(' / ')[1] } : undefined}>
								{active ? <div className="horosa-cnx-cell-seqs">{hits.map((n)=><span key={n} className={`horosa-cnx-seq is-${n}`}>{['一', '二', '三'][n - 1]}传</span>)}</div> : null}
								{jieText ? <span className="horosa-cnx-cell-jie">{jieText}</span> : null}
								<span className="horosa-cnx-cell-name">{name}{isDao && nine ? <i className="horosa-cnx-cell-num">{nine.num}</i> : null}</span>
								{isDao && nine ? <span className="horosa-cnx-cell-deity">{nine.deity}</span> : null}
								{guaLine ? <span className="horosa-cnx-cell-gua">{guaLine}</span> : null}
								{nine ? <span className="horosa-cnx-cell-keys">{nine.keys}</span> : null}
							</div>
						);
					})}
				</div>
				<div className="horosa-cnx-flow">
					{order.map((c, i)=>(
						<React.Fragment key={i}>
							{i > 0 ? <span className="horosa-cnx-flow-arrow">➤</span> : null}
							<div className={`horosa-cnx-flow-step is-${i + 1}`}>
								<em>{['一', '二', '三'][i]}传 · {STAGE_ROLES[i]}</em>
								<div className="horosa-cnx-flow-headline">
									<b>{c}</b>
									{DAO_NINE[c] ? <span className="horosa-cnx-flow-meta">{DAO_NINE[c].wuxing} · {DAO_NINE[c].fangwei}</span> : null}
								</div>
								{DAO_NINE[c] ? <div className="horosa-cnx-flow-keys">{DAO_NINE[c].keys.split('、').map((k, j)=><span key={j}>{k}</span>)}</div> : null}
							</div>
						</React.Fragment>
					))}
				</div>
			</div>
		);
	}

	/** 右栏判读六目 */
	renderAux(ke){
		const { settings } = this.state;
		const a = (ke && ke.analysis) || {};
		const tl = ke ? teLi(ke.chuan) : [];
		const isDao = ke && ke.school === 'dao';
		// 拆今传本九神含义原文(逐字保真,仅结构化呈现):名 / 三关键词 / 简断·详断 / 拜解。
		const parseYi = (name)=>{
			const nine = DAO_NINE[name] || {};
			const lines = (DAO_YI[name] || '').split('\n').map((x)=>x.trim()).filter(Boolean);
			return {
				nine,
				keys: nine.keys || lines[1] || '',
				body: lines.slice(2, Math.max(2, lines.length - 1)),
				bai: lines.length > 2 ? lines[lines.length - 1] : '',
			};
		};
		const metaLine = (nine)=> (nine && nine.wuxing) ? (isDao
			? `${nine.gua === '中' ? '中宫' : `${nine.gua}宫`} · ${nine.wuxing} · ${nine.fangwei}`
			: `${nine.wuxing} · ${nine.fangwei}`) : '';
		const chips = (keys)=> keys ? <div className="horosa-cnx-keys">{keys.split('、').map((k, i)=><span key={i} className="horosa-cnx-key">{k}</span>)}</div> : null;
		const bodyBlock = (body)=> (body && body.length) ? <div className="horosa-cnx-body">{body.map((pp, i)=><p key={i}>{pp}</p>)}</div> : null;
		const baiBlock = (bai)=> bai ? <div className="horosa-cnx-bai">{bai}</div> : null;
		// 判读富卡:传序/名/五行方位/角色眉 + 关键词芯片 + 简详正文 + 拜解脚注。
		const palaceCard = (name, opts)=>{
			const { nine, keys, body, bai } = parseYi(name);
			const tone = TONE_OF[name];
			const o = opts || {};
			return (
				<div key={o.key || name} className={`horosa-cnx-vcard${tone ? ` is-${tone}` : ''}`}>
					<div className="horosa-cnx-vcard-top">
						{o.seq ? <span className={`horosa-cnx-seq is-${o.seq}`}>{['一', '二', '三'][o.seq - 1]}传</span> : null}
						<span className="horosa-cnx-vcard-name">{name}</span>
						<span className="horosa-cnx-vcard-meta">{metaLine(nine)}</span>
						{o.role ? <span className="horosa-cnx-vcard-role">{o.role}</span> : null}
					</div>
					{chips(keys)}
					{bodyBlock(body)}
					{baiBlock(bai)}
				</div>
			);
		};
		const wait = (t)=><div className="horosa-cnx-wait">{t}</div>;
		const row = (k, v, i)=>(
			<div key={`${k}|${i || 0}`} className="horosa-cnx-item">
				<span className="horosa-cnx-item-k">{k}</span><span className="horosa-cnx-item-v">{v}</span>
			</div>
		);
		return (
			// horosa_freeze_subtabs_v1:右栏辅目冻结。原为非受控 Tabs → 改受控
			// (activeKey 取 state.auxTab,缺省即原首目;onChange 记进 state),切页行为逐字不变,
			// 只是让 FreezeSubTab 拿得到 active。冻结≠卸载,切回即拿最新 children 立刻重画。
			<Tabs size="small" className="horosa-xlr-aux horosa-cnx-aux"
				activeKey={this.state.auxTab || 'duan'}
				onChange={(k)=>this.setState({ auxTab: k })}>
				<TabPane tab="直断" key="duan">
					<FreezeSubTab active={(this.state.auxTab || 'duan') === 'duan'}>{() => (<>
						{!ke ? wait('左栏「起课」后显示三传断语。') : <>
						{ke.chuan.map((c, i)=>palaceCard(c, { key: `chuan${i}`, seq: i + 1, role: STAGE_ROLES[i] }))}
						{tl.map((t, i)=>(
							<div key={`te${i}`} className="horosa-cnx-vcard is-te">
								<div className="horosa-cnx-vcard-top"><span className="horosa-cnx-vcard-name">特例</span></div>
								<div className="horosa-cnx-body"><p>{t.text}</p></div>
							</div>
						))}
						</>}
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="生克" key="shengke">
					<FreezeSubTab active={(this.state.auxTab || 'duan') === 'shengke'}>{() => (<>
						{!ke ? wait('起课后显示相邻两传生克。') : ke.school !== 'dao' ? <div className="horosa-cnx-note">主流六宫不调取五行生克(以各宫吉凶直断)。</div> : (
							<>
								{(a.pairs || []).length ? a.pairs.map((p, i)=>row(p.relText, p.duan || p.rel, i)) : <div className="horosa-cnx-note">相邻两传无生克。</div>}
								{a.across && settings.showOneThree !== false ? row('一↔三', `${a.across.rel} —— ${ACROSS_NOTE}`) : null}
								<div className="horosa-cnx-note horosa-cnx-note-foot">{TONG_SHEN_NOTE}</div>
							</>
						)}
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="化解" key="huajie">
					<FreezeSubTab active={(this.state.auxTab || 'duan') === 'huajie'}>{() => (<>
						{!ke ? wait('起课后显示被克之传与拜解。') : ((a.baiJie || []).length ? a.baiJie.map((b, i)=>row(`${b.victim}被${b.aggressor}克`, `拜 ${b.bai} 化解`, i)) : <div className="horosa-cnx-note">本课无被克之传,无需拜解。</div>)}
						<div className="horosa-cnx-baitable-title">五行受克 · 拜解一览</div>
						<div className="horosa-cnx-baitable">{Object.keys(BAI_JIE).map((k)=><div key={k} className="horosa-cnx-baitable-row"><span>{k}</span><i>拜</i><b>{BAI_JIE[k]}</b></div>)}</div>
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="九神" key="jiushen">
					<FreezeSubTab active={(this.state.auxTab || 'duan') === 'jiushen'}>{() => (<>
						{!ke ? wait('起课后显示九神/六宫。') : <>
						{(isDao ? DAO_RING : MAIN_RING).map((n)=>palaceCard(n, { key: `nine${n}` }))}
						{isDao ? <div className="horosa-cnx-note horosa-cnx-note-foot">{BING_FU_DISCREPANCY_NOTE}</div> : null}
						</>}
					</>)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="法诀" key="fa">
					<FreezeSubTab active={(this.state.auxTab || 'duan') === 'fa'}>{() => (<>
						<pre className="horosa-cnx-pre">{(this.state.settings.school === 'dao') ? DAO_FA_TEXT : MAIN_FA_TEXT}</pre>
						<pre className="horosa-cnx-pre horosa-cnx-pre-soft">{SAN_JIE_TEXT}</pre>
					</>)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	render(){
		const slot = this.props.slot;
		const ke = this.state.ke;
		const empty = <div className="horosa-huangji-empty"><Empty description={this.state.error || '请录三数或按占时起课'} image={Empty.PRESENTED_IMAGE_SIMPLE}/></div>;
		if(slot === 'controls'){ return this.renderControls(); }
		if(slot === 'center' || slot === 'aux'){
			if(!ke){ return empty; }
			return <div className="horosa-huangji-page horosa-huangji-redesign" ref={this.rootRef}>{slot === 'aux' ? this.renderAux(ke) : this.renderCenter(ke)}</div>;
		}
		return (
			<div className="horosa-huangji-page horosa-xlr-page horosa-astro-redesign horosa-huangji-redesign" ref={this.rootRef} style={{ height: this.props.height || '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
							<div className="horosa-side-panel-heading">
								<div>
									<div className="horosa-side-panel-title">小六壬设置</div>
									<div className="horosa-side-panel-subtitle">流派 · 三数 · 问事</div>
								</div>
							</div>
							{this.renderControls()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
							<div className="horosa-huangji-board-host">{ke ? this.renderCenter(ke) : empty}</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
							<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
								<div>
									<div className="horosa-side-panel-title">课传判读</div>
									<div className="horosa-side-panel-subtitle">直断 · 生克 · 化解</div>
								</div>
							</div>
							{this.renderAux(ke)}
						</div>
					</div>
				</div>
			</div>
		);
	}
}
export default XiaoLiuRenMain;
export { STORE_KEY, DEFAULT_SETTINGS };
