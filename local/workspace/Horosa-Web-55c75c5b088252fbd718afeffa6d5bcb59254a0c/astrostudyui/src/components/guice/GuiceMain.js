// 皇极轨策 · 三栏主组件（左栏控件 / 中栏盘 / 右栏六目）。
//
// 🔴 中右栏皆消费 buildGuicePan 之一盘 → 必同源、必同时随设置而变。
// 🔴 起卦所得为冻结值：存于 state.gua，改设置不重起卦（重起须显式点「起卦」）——
//    重算即伪造一个不同之卦。
import React, { Component, createRef } from 'react';
import { Empty, Tabs } from 'antd';
import { buildGuicePan } from './core/guicePan';
import { qiGua } from './core/guiceQiGua';
import { buildGuiceSnapshotText } from './guiceSnapshot';
import { normalizeGuiceSettings, getGuiceOptionsKey, DEFAULT_GUICE_SETTINGS } from './guiceSchools';
import GuiceControls from './GuiceControls';
import GuiceGuaGlyph from './GuiceGuaGlyph';
import { Gua8 } from '../gua/GuaConst';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../utils/safeStorage';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { deriveLocalNongli, deriveNongliUniversalSync, subscribeRemoteNongli, timePatchFromDateTime, geoPatchFromRec, snapshotMetaFromFields, buildQiKeTimeLines } from '../../utils/divinationTimeDraft';

const STORE_KEY = 'horosa.guice.settings.v1';
// 八卦 → 其三爻（自下而上）。取仓内既有之 Gua8.value，不另造一份（两份必漂）。
const TRI_OF = Gua8.reduce((m, g) => { m[g.name] = g.value; return m; }, {});
const triLines = (name) => TRI_OF[name] || null;
const { TabPane } = Tabs;

class GuiceMain extends Component {
	constructor(props) {
		super(props);
		this.state = {
			settings: normalizeGuiceSettings(safeJsonParseFromStorage(STORE_KEY)),
			inputs: {}, shiyingInputs: {},
			gua: null,           // 🔴 起卦所得之冻结值
			auxTab: 'overview',
			error: '',
			// [自由起盘] 本地时间地理草稿(null=跟主命盘,字节现状;非空=用户左栏自选时间/经纬)。
			localFields: null,
			// [X1 审计补] 事盘还原的冻结历法上下文(payload.ctx);非空时 ctx() 用之,重起卦/改占时清空。
			frozenCtx: null,
		};
		this.rootRef = createRef();
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
	}

	componentDidMount() {
		if (typeof window !== 'undefined') {
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if (!this.restoreFromCurrentCase(true)) {
			this.saveSnap();
		}
	}
	// [X1 审计补] 事盘还原(对齐 wuzhao/tarot 等 13 技法既有范式):卦+历法 ctx+选项皆冻结值回放,
	// 绝不重起(重起=伪造一个用户没见过的卦);还原后 getPan 以 frozenCtx 复排,与存档快照同源。
	restoreFromCurrentCase(force) {
		const saved = getKentangSavedCasePayload('guice');
		if (!saved || !saved.payload || !saved.payload.gua) { return false; }
		if (!force && this.lastRestoredCaseId === saved.caseVersion) { return !!this.state.gua; }
		const p = saved.payload;
		this.lastRestoredCaseId = saved.caseVersion;
		this.setState({
			gua: p.gua, error: '',
			localFields: null,   // [X1·P2-42] 载档清时地草稿(冻结 ctx 已随档,草稿留着只会误导时间面板)
			settings: p.options && typeof p.options === 'object' ? normalizeGuiceSettings({ ...this.state.settings, ...p.options }) : this.state.settings,
			inputs: p.inputs && typeof p.inputs === 'object' ? { ...this.state.inputs, ...p.inputs } : this.state.inputs,
			shiyingInputs: p.shiyingInputs && typeof p.shiyingInputs === 'object' ? p.shiyingInputs : this.state.shiyingInputs,
			frozenCtx: p.ctx && typeof p.ctx === 'object' ? p.ctx : null,
		}, () => this.saveSnap());
		return true;
	}

	// 父容器 CnYiBuMain 的 dock 每次动作补三拍 forceUpdate(0/600/2500ms) —— forceUpdate 只跳过
	// 自身的 sCU,子组件的照跑。此处逐字段比对(setState 恒换 state 对象,浅比对无用),
	// 令与本栏无关的三补拍不再重建三栏 JSX。render 只读这些 props/state,漏一即「改了不重渲」。
	shouldComponentUpdate(nextProps, nextState) {
		const p = this.props; const s = this.state;
		// 🔴 value(排盘所出)是 ctx 的真源 —— 漏比之则换盘不重渲
		// dispatch(存事盘用)是恒定引用、不与渲染相干,比之无非多一次恒真的比较；
		// 然「多比无害、少比即漏」,故一并比之,免哨兵留豁免口子(口子一开即成手抄名单)。
		return nextProps.value !== p.value
			|| nextProps.fields !== p.fields || nextProps.slot !== p.slot || nextProps.height !== p.height
			|| nextProps.dispatch !== p.dispatch || nextProps.onResultChange !== p.onResultChange
			|| nextState.settings !== s.settings || nextState.inputs !== s.inputs
			|| nextState.shiyingInputs !== s.shiyingInputs || nextState.gua !== s.gua
			|| nextState.auxTab !== s.auxTab || nextState.error !== s.error
			|| nextState.localFields !== s.localFields   // [自由起盘] 草稿变→ctx 变→盘重算,须重渲
			|| nextState.frozenCtx !== s.frozenCtx;      // [X1] 冻结上下文变(事盘还原/脱离)→盘重算,须重渲
	}

	componentDidUpdate(prevProps, prevState) {
		// [X1] 事盘载入(applyCase→fetchByFields)→fields 换引用 → 尝试还原冻结卦。
		if (prevProps.fields !== this.props.fields && this.props.fields) {
			this.restoreFromCurrentCase();
		}
		// 🔴 任一开关变 → 盘重算 + 快照刷新（选项键汇总全部十开关，非只监听单项）
		const a = getGuiceOptionsKey(prevState.settings);
		const b = getGuiceOptionsKey(this.state.settings);
		// [自由起盘] 草稿变→盘(时刻派生项)重算→快照须刷新
		if (a !== b || prevState.gua !== this.state.gua || prevState.shiyingInputs !== this.state.shiyingInputs
			|| prevState.localFields !== this.state.localFields || prevState.inputs !== this.state.inputs) {
			// 占事/方位(inputs.askEvent/fangKey)也喂 ctx→盘→快照,故起卦后改它们亦须刷新挂载快照。
			this.saveSnap();
		}
		// 🔴 dock 不在本组件的渲染树内 —— 本组件 setState 不会连带重渲容器。
		//    容器只在【点了 dock 上的按钮】之后才补拍;而本页左栏另有一个起卦钮(主路径),
		//    自它起的卦，容器无从知晓 → dock 的「保存」按起卦前的 hasResult 定格为禁用,
		//    卦明明在眼前而存不进去(真机点出来的)。故卦一变即告容器一声。
		if (prevState.gua !== this.state.gua && typeof this.props.onResultChange === 'function') {
			this.props.onResultChange();
		}
	}

	componentWillUnmount() {
		this._unmounted = true;
		if (typeof window !== 'undefined') {
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出/挂载实时取数：导出侧派发 refresh 事件 → 用当前之盘即时构快照并回填（显示什么就导出什么）
	handleSnapshotRefreshRequest(evt) {
		if (!evt || !evt.detail || evt.detail.module !== 'guice') return;
		const t = this.snapText();
		if (t) {
			saveModuleAISnapshot('guice', t, { source: 'react', savedAt: Date.now() });
			evt.detail.snapshotText = t;
		}
	}

	/**
	 * 🔴 签名须盖住 buildGuicePan 吃进去的全部四样(卦/时/十开关/十应之录),漏一样即「改了不重算」。
	 *    ctx 亦在其内 —— 其由排盘所出(月支定卦气、四柱定大定、公历年定值年卦、日干定刚柔寄宫),
	 *    换生辰即须重算。且 ctx 只算一次:【签的就是用的】,免签名与实参各算一遍而漂移。
	 *    askEvent 已在 ctx 之内,不必另签。
	 */
	getPan() {
		const { gua, settings, shiyingInputs } = this.state;
		if (!gua) return null;
		const ctx = this.ctx();
		const sig = `${JSON.stringify(gua)}|${JSON.stringify(ctx)}|${getGuiceOptionsKey(settings)}|${JSON.stringify(shiyingInputs)}`;
		if (this._panKey === sig && this._panCache) return this._panCache;
		this._panKey = sig;
		this._panCache = buildGuicePan({ gua, ctx, settings, shiyingInputs });
		return this._panCache;
	}

	/**
	 * 起卦所需之时:年支/月支/农历月日/时支/公历年/日干/四柱。
	 * 🔴 真源是 props.value.chart.nongli(排盘所出),【不是】props.fields —— fields 只是
	 *    表单字段(date/time/zone/lat/lon…),其上压根没有 nongli。曾照想当然写作
	 *    props.fields.nongli.value 且八个字段名无一为真 → ctx 恒空 → 年月日时起例这类
	 *    只需时刻的法子也报「所需之输入未足,本法不可起卦」(live 实跑抓出)。
	 *    以下每个键名皆经浏览器实测真对象核过,尤须留意三处反直觉:
	 *      · 时柱在 bazi.time,不在 bazi.hour(后者 undefined);
	 *      · nongli.year 是干支「丙午」,不是公历年 —— 公历年只能从 nongli.date 取;
	 *      · 干支的字在 stem.cell / branch.cell,ganzi 才是两字合文。
	 */
	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields() {
		return this.state.localFields || this.props.fields || {};
	}
	// [自由起盘] 左栏时间选择 → 写本地草稿(不 dispatch)。卦为冻结值不自动重起——盘(元会运世/
	// 时方等时刻派生项)经 getPan 读新 ctx 自动重算;欲按新时重起卦须显式再点「起卦」。
	onTimeChanged(value) {
		const dt = value && value.time;
		if (!dt) return;
		const base = this.state.localFields || this.props.fields || {};
		// 用户改占时=离开事盘冻结上下文(另占新时刻)。
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) }, frozenCtx: null });
	}
	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区自动校正 + 重锚时间 + 地名)。
	changeGeo(rec) {
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) }, frozenCtx: null });
	}
	ctx() {
		// [X1 审计补] 事盘还原后 ctx=冻结值(payload.ctx):元会运世/时方随存档占时,不随今日盘漂移;
		// 方位/占事仍吃当前 inputs(还原时已回放为存档值,其后用户可改问事措辞不动卦)。
		const fz = this.state.frozenCtx;
		if (fz) {
			return {
				...fz,
				fangKey: (this.state.inputs || {}).fangKey !== undefined ? (this.state.inputs || {}).fangKey : fz.fangKey,
				askEvent: (this.state.inputs || {}).askEvent !== undefined ? (this.state.inputs || {}).askEvent : (fz.askEvent || ''),
			};
		}
		return this.ctxLive();
	}
	ctxLive() {
		let nl;
		if (this.state.localFields) {
			nl = deriveNongliUniversalSync(this.state.localFields) || {};
		} else {
			const chart = (this.props.value && this.props.value.chart) || {};
			nl = chart.nongli || {};
		}
		const b = nl.bazi || {};
		const cell = (zhu, which) => (b[zhu] && b[zhu][which] && b[zhu][which].cell) || undefined;
		const gz = (zhu) => (b[zhu] && b[zhu].ganzi) || undefined;
		const pillars = ['year', 'month', 'day', 'time'].map(gz).filter(Boolean);
		return {
			yearZhi: cell('year', 'branch'),
			monthZhi: cell('month', 'branch'),
			lunarMonth: nl.monthInt,
			lunarDay: nl.dayInt,
			hourZhi: cell('time', 'branch'),
			year: parseInt(`${nl.date || ''}`.slice(0, 4), 10) || undefined,
			dayGan: cell('day', 'stem'),
			pillars: pillars.length === 4 ? pillars : undefined,
			fangKey: (this.state.inputs || {}).fangKey || undefined,   // 方应之所本：占者所坐立之方(手录)
			askEvent: (this.state.inputs || {}).askEvent || '',
		};
	}

	snapText() {
		const p = this.getPan();
		const flds = (typeof this.activeFields === 'function') ? this.activeFields() : (this.state.localFields || this.props.fields);
		return p ? (buildGuiceSnapshotText(p, { timeLines: buildQiKeTimeLines(flds) }) || '').trim() : '';
	}

	saveSnap() {
		const t = this.snapText();
		// meta 补时间地理键(用生效 fields=草稿或主盘):命盘缓存路径确凿匹配 + 事盘/导出口径一致。
		if (t) saveModuleAISnapshot('guice', t, snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() }));
	}

	setSettings(settings) {
		this.setState({ settings });
		safeJsonStringifyToStorage(STORE_KEY, settings);
	}

	/** 起卦 —— 唯此一处出卦；一经起出即冻结，改设置不重起 */
	doQiGua() {
		const { settings, inputs } = this.state;
		// 显式重起卦=新占:脱离事盘冻结 ctx,按当前(草稿或主盘)时刻起。
		const c = this.ctxLive();
		const nums = `${inputs.numsText || ''}`.split(/[,，\s]+/).map((x) => parseInt(x, 10)).filter((x) => x > 0);
		const tones = `${inputs.tonesText || ''}`.split(/[,，\s]+/).filter(Boolean);
		const r = qiGua(settings.qiguaFa, {
			...c, ...inputs, nums,
			tones: tones.length ? tones : inputs.tones,
			shu: inputs.shu, wuShu: inputs.wuShu, shengShu: inputs.shengShu,
			zhang: inputs.zhang, chi: inputs.chi, cun: inputs.cun,
			wuGuaNum: inputs.wuGuaNum, fangGuaNum: inputs.fangGuaNum, kind: inputs.kind,
			qu: inputs.qu, shu2: inputs.shu2,
		});
		if (!r) return this.setState({ error: '所需之输入未足 —— 本法不可起卦', gua: null, frozenCtx: null });
		if (r.error) return this.setState({ error: r.error, gua: null, frozenCtx: null });
		this.setState({ gua: r, error: '', frozenCtx: null });
	}

	/**
	 * 存事盘。
	 * 🔴 payload.gua 是【冻结值】—— 起卦所得(报数/字占/时辰之所出)一经起出即不可重起,
	 *    故连卦一并存下;重算时只按 options 重排演数与断法,绝不按时重起(重起即伪造一个
	 *    用户没见过的卦)。十应之录同理:其为占时耳目所及,机不能代,亦须存。
	 */
	clickSaveCase() {
		const p = this.getPan();
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存事盘用生效 fields:改过时间地理则存草稿值(divTime/经纬/地名来自草稿,不写主命盘)。
			fields: this.activeFields(),
			module: 'guice',
			label: '皇极轨策',
			payload: {
				options: { ...this.state.settings },
				gua: this.state.gua,
				// 🔴 ctx(占时之历法坐标:年月日时干支/农历月日/所占之方)与卦【同为冻结值】,
				//    须一并存 —— 其由排盘所出(props.value.chart.nongli),而重算之时只有 record,
				//    record 上无农历(那是算出来的、不是存的字段)→ 不存则重算时元会运世、时方
				//    诸端【整段消失】(真机比对存档快照与重算快照才现形)。
				ctx: this.ctx(),
				shiyingInputs: this.state.shiyingInputs,
				inputs: this.state.inputs,
				snapshot: p ? buildGuiceSnapshotText(p) : '',
			},
		});
	}

	getQuickDockConfig() {
		return {
			hasResult: !!this.state.gua,
			primary: { key: 'qigua', label: '起卦', onClick: () => this.doQiGua() },
			save: () => this.clickSaveCase(),
		};
	}

	card(title, rows) {
		return (
			<div className="horosa-huangji-info-card" key={title}>
				<div className="horosa-huangji-info-heading">{title}</div>
				<div className="horosa-huangji-info-body">
					{rows.map((r, i) => (
						<div className="horosa-huangji-info-row" key={i}>
							<span className="horosa-huangji-info-label">{r[0]}</span>
							<span className="horosa-huangji-info-value">{r[1]}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	stepsCard(title, steps) {
		return (
			<div className="horosa-huangji-info-card" key={title}>
				<div className="horosa-huangji-info-heading">{title}</div>
				<div className="horosa-zhengchuan-steps">
					{steps.map((s, i) => (
						<div className="horosa-zhengchuan-step" key={i}>
							<span className="horosa-zhengchuan-step-no">{i + 1}</span>
							<span className="horosa-zhengchuan-step-label">{s.label}</span>
							<span className="horosa-zhengchuan-step-in">{s.detail}</span>
							<span className="horosa-zhengchuan-step-out">{s.value}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	/** 一卦卡：真爻画 + 卦名 + 副题（动爻高亮、体半描金） */
	guaCard({ key, lines, name, sub, dongYao, tiHalf, tone }) {
		return (
			<div className={`horosa-guice-gua-card${tone ? ` is-${tone}` : ''}`} key={key}>
				<div className="horosa-guice-gua-card-kicker">{key}</div>
				<GuiceGuaGlyph lines={lines} dongYao={dongYao} tiHalf={tiHalf} />
				<strong>{name || '—'}</strong>
				<span>{sub || ''}</span>
			</div>
		);
	}

	/** 栏位卡（标签在上、值作大字）—— 与本页诸兄弟同一副面孔 */
	fieldCard(label, value, sub) {
		return (
			<div className="horosa-guice-field" key={label}>
				<span className="horosa-guice-field-label">{label}</span>
				<strong className="horosa-guice-field-value">{value == null || value === '' ? '—' : value}</strong>
				{sub ? <em className="horosa-guice-field-sub">{sub}</em> : null}
			</div>
		);
	}

	/** 中栏：一张盘 —— 页眉 → 五卦 → 四位盘 → 演数 → 主客 →（大定）→（历数） */
	renderCenter(p) {
		const { bian, yan, duan, dading, lishi } = p;
		const gui = p.settings.yanshuFa === 'gui';
		const benLines = bian.ben.lines;
		const hu = bian.hu;
		// 🔴 体在上半还是下半，取引擎已定之 hu.tiZai —— 不自行由动爻再推一遍(两处各推必漂)
		const tiHalf = hu.tiZai;
		return (
			<div className="horosa-guice-board">
				<div className="horosa-guice-board-header">
					<div>
						<div className="horosa-guice-board-title">皇极轨策</div>
						<div className="horosa-guice-board-kicker">
							{gui ? '轨数' : '策数'} · {p.gua.fa === 'time' ? '年月日时起例' : (p.gua.faLabel || '起卦')}
							{p.askEvent ? ` · ${p.askEvent}` : ''}
						</div>
					</div>
					<div className="horosa-guice-board-time">{p.gua.dongYao} 爻动</div>
				</div>

				<div className="horosa-guice-gua-grid">
					{this.guaCard({ key: '本卦', lines: benLines, name: p.gua.name, dongYao: p.gua.dongYao, tiHalf,
						sub: `体 ${hu.tiGua}／用 ${hu.yongGua}`, tone: 'ben' })}
					{/* 🔴 互卦只出体互/用互两个八卦，不产六十四卦名（古籍明言作完整卦论断是不对的）
					    → 故此卡画两个三爻小象并列，不画六爻 */}
					<div className="horosa-guice-gua-card is-hu" key="互卦">
						<div className="horosa-guice-gua-card-kicker">互卦</div>
						<div className="horosa-guice-tri-pair">
							<span className="horosa-guice-tri" title={`体互 ${hu.tiHu}`}>
								<GuiceGuaGlyph lines={triLines(hu.tiHu)} size="sm" />
								<em>体</em>
							</span>
							<span className="horosa-guice-tri" title={`用互 ${hu.yongHu}`}>
								<GuiceGuaGlyph lines={triLines(hu.yongHu)} size="sm" />
								<em>用</em>
							</span>
						</div>
						<strong>{hu.tiHu}／{hu.yongHu}</strong>
						<span>{hu.fromBian ? '乾坤无互 · 互其变卦' : '体互／用互'}</span>
					</div>
					{this.guaCard({ key: '变卦', lines: bian.bian.lines, name: p.bianName, sub: '事之终' })}
					{this.guaCard({ key: '错卦', lines: bian.cuo.lines, name: `${bian.cuo.up}／${bian.cuo.lo}`, sub: '事之反面' })}
					{this.guaCard({ key: '综卦', lines: bian.zong.lines, name: `${bian.zong.up}／${bian.zong.lo}`, sub: '对方所见' })}
				</div>

				<div className="horosa-guice-section-title">
					四位盘<em>{gui ? '轨数' : '策数'} {yan.value} · 除万取千百十零</em>
				</div>
				<div className="horosa-guice-siwei-grid">
					{yan.siwei.map((x) => {
						const marks = [x.borrowed, x.guaBorrow].filter(Boolean);
						return (
							<div className={`horosa-guice-siwei${x.empty ? ' is-empty' : ''}`} key={x.wei}>
								<span className="horosa-guice-siwei-wei">{x.wei}</span>
								<strong className="horosa-guice-siwei-num">{x.empty ? '空' : x.value}</strong>
								<span className="horosa-guice-siwei-gua">{x.gua || '—'}</span>
								{x.wuxing ? <em className="horosa-guice-siwei-wx">{x.wuxing}</em> : null}
								{marks.length ? <em className="horosa-guice-tag is-borrow">{marks.join('・')}</em> : null}
							</div>
						);
					})}
				</div>

				<div className="horosa-guice-meta-grid">
					{this.fieldCard('身数', yan.body, '上卦原策 + 下卦原策')}
					{this.fieldCard(gui ? '轨数' : '策数', yan.value, yan.formula)}
					{duan && duan.tiYong
						? this.fieldCard('体用', duan.tiYong.key, duan.tiYong.duan)
						: null}
					{duan && duan.zhuKe
						? this.fieldCard('主算／客算', `${duan.zhuKe.zhuSuan}／${duan.zhuKe.keSuan}`, `${duan.zhuKe.sheng} · ${duan.zhuKe.ze}`)
						: null}
				</div>

				{dading ? (
					<>
						<div className="horosa-guice-section-title">大定起数<em>九畴数 · {dading.value}</em></div>
						{this.stepsCard('', dading.steps)}
					</>
				) : null}

				{lishi && lishi.zhiNian ? (
					<div className="horosa-guice-meta-grid">
						{this.fieldCard('值年卦', lishi.zhiNian.gua, `${lishi.zhiNian.year} 年`)}
						{lishi.zhiNian.shiGua
							? this.fieldCard('世卦', lishi.zhiNian.shiGua.gua, `${lishi.zhiNian.shiGua.from}–${lishi.zhiNian.shiGua.to}`)
							: null}
						{lishi.biGua ? this.fieldCard('月建辟卦', lishi.biGua.gua, lishi.biGua.xiao) : null}
					</div>
				) : null}
			</div>
		);
	}

	/** 右栏六目 */
	renderAux(p) {
		// 🔴 未起卦时 p=null 亦须渲染 Tabs 外壳（六目常驻，各目出占位；否则右栏塌成空白，很丑）。
		//    单套 Tabs、逐目 !p 出占位——保六目 forceRender 常驻、保直断仍摄时方（源码哨兵守之）。
		const wait = (t) => <div className="horosa-huangji-empty" style={{ opacity: 0.6, fontSize: 12, padding: '10px 2px', minHeight: 60 }}>{t}</div>;
		const { duan, ying, yan, bian, lishi } = p || {};
		return (
			<Tabs activeKey={this.state.auxTab} onChange={(k) => this.setState({ auxTab: k })} size="small"
				className="horosa-huangji-tabs horosa-guice-tabs">
				<TabPane tab="直断" key="overview" forceRender>
					{/* 摄诸端之要于此 —— 右栏常停此目，故演数与十应之变须于此即见（否则改设置眼前不动＝「勾了没反应」） */}
					{!p ? wait('左栏择起卦法「起卦」后，此处显示直断。') : this.card('直断', [
						['占事', p.askEvent || '（未录）'],
						['本卦', `${p.gua.name || '—'}　${p.gua.dongYao} 爻动　→　${p.bianName || '—'}`],
						['体用', `${duan.tiYong.tiGua}／${duan.tiYong.yongGua}　${duan.tiYong.key}：${duan.tiYong.duan}`],
						[p.settings.yanshuFa === 'gui' ? '轨数' : '策数', `${yan.value}　（千${yan.parts.qian} 百${yan.parts.bai} 十${yan.parts.shi} 零${yan.parts.ling}）`],
						['四位之卦', yan.siwei.map((x) => x.gua).join('　')],
						['体卦之气', duan.guaQi.ti ? `${duan.guaQi.ti.gua} ${duan.guaQi.ti.qi}${duan.guaQi.ti.jie ? `（${duan.guaQi.ti.jie}）` : ''}` : '—'],
						['主客', duan.zhuKe ? `${duan.zhuKe.zhuSuan}／${duan.zhuKe.keSuan}　${duan.zhuKe.sheng}` : '—'],
						['终应', duan.qingZhong ? duan.qingZhong.zhongYing : '—'],
						['十应', `${ying.label}　已录 ${ying.recorded}／${ying.total}`],
						// 🔴 时方亦须摄于此 —— 直断是右栏默认所停之目，开了「参时方」若此目不出，
						//    用户眼前纹丝不动 ＝ 又一个「勾了没反应」(live 实跑抓出)。
						...(p.shiFang ? [['时方', (p.shiFang.ying
							? `方应 ${p.shiFang.ying.fang}（${p.shiFang.ying.gua}）→ ${p.shiFang.ying.key}：${p.shiFang.ying.duan}`
							: '方应（未录占者所坐立之方）')
							+ (p.shiFang.shenSha ? `　· 神煞 ${p.shiFang.shenSha.names.join('')}（古籍未载其表，标缺）` : '')]] : []),
					])}
				</TabPane>
				<TabPane tab="演数" key="yanshu" forceRender>
					{!p ? wait('起卦后显示演数明细。') : this.stepsCard('演数明细', yan.steps || [
						{ label: '身数', detail: '上卦原策 + 下卦原策', value: yan.body },
						{ label: '算式', detail: yan.formula, value: yan.value },
					])}
				</TabPane>
				<TabPane tab="卦变" key="guabian" forceRender>
					{!p ? wait('起卦后显示本/互/变/错/综卦。') : this.card('卦变', [
						['本卦', p.gua.name || '—'], ['体卦', bian.hu.tiGua], ['用卦', bian.hu.yongGua],
						['体互', bian.hu.tiHu], ['用互', bian.hu.yongHu],
						['变卦', p.bianName || '—'],
						['错卦', `${bian.cuo.up}${bian.cuo.lo}`], ['综卦', `${bian.zong.up}${bian.zong.lo}`],
					])}
				</TabPane>
				<TabPane tab="断法" key="duanfa" forceRender>
					{!p ? wait('起卦后显示轻重次序/真生真克/动静。') : <>
					{duan.qingZhong && this.card('轻重次序（用最紧 > 互次之 > 变又次之）',
						duan.qingZhong.rows.map((r) => [`${r.label}　${r.gua}（${r.ying}）`, `${r.key}：${r.duan}`]))}
					{this.card('真生真克（须分真火与形色）', duan.zhenShengZhenKe.map((z) => [z.ju, z.yi]))}
					{this.card('动静', [['静', duan.dongJing.jing.join('、')], ['动', duan.dongJing.dong.join('、')],
						['应期', Object.keys(duan.dongJing.yingQi).map((k) => `${k}则${duan.dongJing.yingQi[k]}`).join('、')]])}
					{p.shiFang ? this.card('时方（周易数一路参之；梅花不用）', [
						...(p.shiFang.ying
							? [['方应', `${p.shiFang.ying.fang}（${p.shiFang.ying.gua}）对体卦 ${p.shiFang.ying.ti}：${p.shiFang.ying.key} —— ${p.shiFang.ying.duan}`]]
							: [['方应', p.shiFang.fangMissing ? '（未录占者所坐立之方 —— 左栏录之即断，不臆断）' : '—']]),
						...(p.shiFang.shenSha ? [['时方神煞', `${p.shiFang.shenSha.names.join('、')}　（${p.shiFang.shenSha.note}）`]] : []),
					]) : null}
					</>}
				</TabPane>
				<TabPane tab="十应" key="shiying" forceRender>
					{!p ? wait('起卦后显示十应。') : this.card(ying.label, ying.items.map((x) => [
						x.label, x.missing ? '（未录）' : (x.gua ? `${x.gua}　${x.duan || ''}` : x.value),
					]))}
				</TabPane>
				<TabPane tab="历史" key="lishi" forceRender>
					{!p ? wait('起卦后显示元会运世。') : lishi && this.card('元会运世', [
						...(lishi.zhiNian ? [['值年卦', `${lishi.zhiNian.year} ${lishi.zhiNian.gua}`]] : [['值年卦', '（须时）']]),
						...lishi.cengji.map((c) => [c.ceng, `${c.gua}${c.from ? `（${c.from}–${c.to}）` : ''}`]),
						['元会运世', '1元 = 12会 = 360运 = 4320世 = 129600年'],
					])}
				</TabPane>
			</Tabs>
		);
	}

	/** 左栏 —— 控件（起卦之钮在其内，故此处不再另置一颗）+ 出错之由 */
	renderControls() {
		const fields = this.activeFields();
		return (
			<>
				{/* [自由起盘] 时间与地点:独立草稿,改时间即按新时刻重算盘(元会运世/时方等);
				    卦为冻结值,欲按新时重起卦须显式点「起卦」(不写主命盘) */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={fields}
						value={buildDateTimeFromFields(fields)}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
					/>
				</XQSideSection>
				<GuiceControls
					settings={this.state.settings} inputs={this.state.inputs} shiyingInputs={this.state.shiyingInputs}
					onSettings={(s) => this.setSettings(s)}
					onInput={(i) => this.setState({ inputs: i })}
					onShiYing={(v) => this.setState({ shiyingInputs: v })}
					onQiGua={() => this.doQiGua()}
				/>
				{this.state.error ? <div className="horosa-guice-error">{this.state.error}</div> : null}
			</>
		);
	}

	/**
	 * 🔴 本组件自出三栏 —— 本页签的宿主(CnYiBuMain)每个 tab 只渲染其组件【一次】,
	 *    与命盘那边的宿主(渲染同一组件三次、分别喂 slot='controls'|'center'|'aux',
	 *    栏归宿主所有)是两套截然不同的范式。曾照错了范式建,致 slot 恒 undefined →
	 *    左栏与右栏整个不渲染,页上只剩中间一句「请择起卦法而起卦」(live 实跑抓出;
	 *    彼时 jest 渲染例显式喂了 slot,测的是宿主根本不用的契约,故全绿而漏)。
	 *    slot 分支保留:供命盘侧宿主或将来嵌入之用,并令旧测试之契约不废。
	 */
	render() {
		const slot = this.props.slot;
		const p = this.getPan();
		if (slot === 'controls') return this.renderControls();
		if (slot === 'center' || slot === 'aux') {
			if (!p) return <div className="horosa-huangji-empty"><Empty description={this.state.error || '请择起卦法而起卦'} image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>;
			return (
				<div className="horosa-huangji-page horosa-guice-page" ref={this.rootRef}>
					{slot === 'aux' ? this.renderAux(p) : this.renderCenter(p)}
				</div>
			);
		}
		// 无 slot = 本页签宿主之常道 → 自出三栏(骨架照本页签邻居,令样式与诸兄弟一致)
		const empty = <div className="horosa-huangji-empty"><Empty description={this.state.error || '请择起卦法而起卦'} image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>;
		return (
			<div className="horosa-huangji-page horosa-guice-page horosa-astro-redesign horosa-huangji-redesign" ref={this.rootRef}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
							<div className="horosa-side-panel-heading">
								<div>
									<div className="horosa-side-panel-title">轨策设置</div>
									<div className="horosa-side-panel-subtitle">起卦法 · 流派 · 十应</div>
								</div>
							</div>
							{this.renderControls()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
							<div className="horosa-huangji-board-host">{p ? this.renderCenter(p) : empty}</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
							<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
								<div>
									<div className="horosa-side-panel-title">轨策信息</div>
									<div className="horosa-side-panel-subtitle">演数 · 断法 · 十应</div>
								</div>
							</div>
							{this.renderAux(p)}
						</div>
					</div>
				</div>
			</div>
		);
	}
}

/**
 * 无头重算 —— 供 AI 挂载「按设置重算」调（组件不在场亦可）。
 *
 * 🔴 卦是【冻结值】：只自已存之 payload.gua 取，【绝不】按时重起 ——
 *    重起即伪造一个用户没见过的卦（此为本技法第一铁律，故此处无起卦之路）。
 *    可随设置重排者，唯演数/配卦/断法/十应诸端。
 * 🔴 十应之录同理自 payload 取：其为占时耳目所及，机不能代拟。
 *
 * 何以须有此函：本技法在事盘表里登记了，挂载 schema 也登记了八个开关，
 * 而事盘重算那个 switch 里【独缺 guice 一支】→ 落 default 返空串 →
 * 用户在挂载设置里调那八个开关，重算恒空，八项形同虚设（本轮实证）。
 */
export function buildGuiceSnapshotForCase(payload, opts) {
	try {
		const p = payload && typeof payload === 'object' ? payload : {};
		const gua = p.gua;
		if (!gua || !gua.up || !gua.lo || !gua.dongYao) return '';   // 无卦不可算，不臆造
		const settings = normalizeGuiceSettings({ ...(p.options || {}), ...(opts || {}) });
		// 🔴 ctx 只自存档取 —— 曾试着自 record 推,而 record 上压根没有农历(其由排盘所出),
		//    推出来的是一堆 undefined:元会运世整段消失、时方无从算(真机比对两份快照才现形)。
		//    那段推法是不折不扣的死代码,故删之;缺 ctx 者只有本功能上线前之存档(其时尚无 case)。
		const pan = buildGuicePan({ gua, ctx: p.ctx || {}, settings, shiyingInputs: p.shiyingInputs || {} });
		return pan ? (buildGuiceSnapshotText(pan) || '').trim() : '';
	} catch (e) {
		return '';   // 优雅返空，不崩整个挂载（与同页诸兄弟同则）
	}
}

export default GuiceMain;
export { STORE_KEY, DEFAULT_GUICE_SETTINGS };
