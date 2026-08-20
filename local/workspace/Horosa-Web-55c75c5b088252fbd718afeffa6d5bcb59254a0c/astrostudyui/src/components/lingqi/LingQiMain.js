// 灵棋经 · 三栏主组件(左栏 起卦/选项 · 中栏 十二棋盘面 · 右栏 卦辞判读)。
// 🔴 宿主范式=CnYiBuMain 每 tab 只渲染一次 → 自出三栏(照同页邻居 XiaoLiuRenMain/GuiceMain)。
// 🔴 卦是【冻结值】:「以十二棋子一時擲之…不可再擲」——掷出/摆出即冻结(counts 为真值),
//    改时间地点/显示选项只刷干支提示与渲染,绝不重掷;事盘存 counts 原样,载档确定性复排。
// 🔴 中栏=十二枚棋子实体(上4/中4/下4,逐枚正/覆):空态(未起卦,虚框幽灵棋)≠ 纯阴镘(实体全覆)。
import React, { Component, createRef } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { XQSideSection } from '../xq-ui';
import { Tabs, Input, InputNumber, Radio, Button, Switch, Checkbox, Select, Tag } from 'antd';
import { LINGQI_GUA, findLingqiGua, lingqiOrdinalCn } from './data/lingqiJing';
import { lingqiToSimp } from './data/lingqiT2S';
import { LINGQI_RITUAL } from './data/lingqiRitual';
import {
	castLingqi, facesFromCounts, resolveLingqiSeed, sanCaiOf, isWuDay, splitVerse,
} from './core/lingqiCast';
import {
	buildLingqiSnapshotText, LINGQI_CATEGORY_OPTIONS, LINGQI_CATEGORY_KEYWORDS,
	LINGQI_ZHU_META, DEFAULT_LINGQI_ZHU_VISIBLE, lingqiCountsText,
} from './lingqiSnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { safeJsonStringifyToStorage, safeJsonParseFromStorage } from '../../utils/safeStorage';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import {
	deriveNongliUniversalSync, subscribeRemoteNongli, timePatchFromDateTime, geoPatchFromRec,
	snapshotMetaFromFields, buildQiKeTimeLines,
} from '../../utils/divinationTimeDraft';

const TabPane = Tabs.TabPane;
const Option = Select.Option;
const STORE_KEY = 'horosa.lingqi.settings.v1';
const LAYER_META = [
	{ label: '上', role: '君', realm: '天' },
	{ label: '中', role: '臣', realm: '人' },
	{ label: '下', role: '民', realm: '地' },
];
// 持久化的仅是「显示口径」(卦本体走事盘制,绝不持久化 counts)。
const DEFAULT_PERSIST = {
	seedMode: 'random', display: 'simp', category: 'general',
	zhuVisible: { ...DEFAULT_LINGQI_ZHU_VISIBLE },
};

class LingQiMain extends Component {
	shouldComponentUpdate(nextProps, nextState) {
		if (nextState !== this.state) { return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(p) {
		super(p);
		const stored = safeJsonParseFromStorage(STORE_KEY) || {};
		this.state = {
			...DEFAULT_PERSIST,
			...stored,
			zhuVisible: { ...DEFAULT_LINGQI_ZHU_VISIBLE, ...(stored.zhuVisible || {}) },
			counts: null, faces: null, guaOrigin: null,
			casting: false, manualMode: false,
			manualSeed: null, lastSeed: '',
			question: '', error: '',
			localFields: null,   // [自由起盘] 时间地理草稿(null=跟主命盘;只作占时记录,恒不参与成卦)
		};
		this.rootRef = createRef();
		this.castTimer = null;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.doCast = this.doCast.bind(this);
	}
	componentDidMount() {
		// [issue#74 同类] 农历桥契约履约:域外年首访 deriveNongliUniversalSync 返 null,首版快照
		// 缺「农历/四柱」行;桥契约写明「远程回包后由订阅方重存快照补全」——旧实现只 forceUpdate
		// (render 自愈)不重存 → 缓存快照/事盘存档恒缺行,页面对、AI 挂载错。回包补拍即自愈。
		this._unsubNongli = subscribeRemoteNongli(() => {
			this.forceUpdate();
			if (this.state.counts) { this.saveSnap(); }
		});
		if (typeof window !== 'undefined') {
			this._onSnapRefresh = (evt) => {
				if (!evt || !evt.detail || evt.detail.module !== 'lingqi' || !this.state.counts) { return; }
				const t = this.buildSnapshot();
				if (t) { saveModuleAISnapshot('lingqi', t); evt.detail.snapshotText = t; }
			};
			window.addEventListener('horosa:refresh-module-snapshot', this._onSnapRefresh);
		}
		this.restoreFromCurrentCase(true);
	}
	componentWillUnmount() {
		if (this._unsubNongli) { this._unsubNongli(); }
		if (typeof window !== 'undefined' && this._onSnapRefresh) {
			window.removeEventListener('horosa:refresh-module-snapshot', this._onSnapRefresh);
		}
		if (this.castTimer !== null) { clearTimeout(this.castTimer); this.castTimer = null; }
	}
	componentDidUpdate(prev, prevState) {
		if (prev.value !== this.props.value && this.state.counts) { this.saveSnap(); }
		if (prev.fields !== this.props.fields && this.props.fields) { this.restoreFromCurrentCase(); }
		// 卦一变即告容器(dock 不在本组件树内;对齐 xiaoliuren/guice 范式)。
		if (prevState && prevState.counts !== this.state.counts && typeof this.props.onResultChange === 'function') {
			this.props.onResultChange();
		}
	}

	// ── 设置持久化(只存显示口径) ──
	persist(patch) {
		const next = {
			seedMode: this.state.seedMode, display: this.state.display,
			category: this.state.category, zhuVisible: this.state.zhuVisible,
			...patch,
		};
		safeJsonStringifyToStorage(STORE_KEY, next);
	}
	setPersisted(key, val, thenSnap) {
		this.setState({ [key]: val }, () => { if (thenSnap && this.state.counts) { this.saveSnap(); } });
		this.persist({ [key]: val });
	}

	// ── 时地(仅占时记录;恒不重掷) ──
	activeFields() { return this.state.localFields || this.props.fields || {}; }
	nongli() {
		if (this.state.localFields) { return deriveNongliUniversalSync(this.state.localFields) || {}; }
		const chart = (this.props.value && this.props.value.chart) || {};
		return chart.nongli || {};
	}
	onTimeChanged(value) {
		const dt = value && value.time;
		if (!dt) { return; }
		const base = this.state.localFields || this.props.fields || {};
		const localFields = { ...base, ...timePatchFromDateTime(dt) };
		this.setState({ localFields }, () => { if (this.state.counts) { this.saveSnap(); } });
	}
	changeGeo(rec) {
		const base = this.state.localFields || this.props.fields || {};
		const localFields = { ...base, ...geoPatchFromRec(rec, base) };
		this.setState({ localFields }, () => { if (this.state.counts) { this.saveSnap(); } });
	}

	// ── 成卦(唯一三入口:掷棋 doCast / 中栏点翻 toggleChip / 左栏直设 setCountDirect;皆冻结) ──
	doCast() {
		if (this.state.casting || this.state.manualMode) { return; }
		const seed = resolveLingqiSeed(this.state.seedMode, this.state.manualSeed, this.activeFields());
		const r = castLingqi(seed);
		const reduce = (typeof window !== 'undefined' && window.matchMedia
			&& window.matchMedia('(prefers-reduced-motion: reduce)').matches);
		if (this.castTimer !== null) { clearTimeout(this.castTimer); }
		this.setState({
			counts: r.counts, faces: r.faces, guaOrigin: 'cast', lastSeed: `${seed}`,
			casting: !reduce, error: '',
		}, () => {
			this.saveSnap();
			if (reduce) { return; }
			this.castTimer = setTimeout(() => {
				this.castTimer = null;
				this.setState({ casting: false });
			}, 1150);
		});
	}
	toggleChip(layer, idx) {
		if (!this.state.manualMode || this.state.casting) { return; }
		const base = this.state.faces || facesFromCounts(this.state.counts || [0, 0, 0]);
		const faces = base.map((row, i) => (i === layer ? row.map((v, k) => (k === idx ? !v : v)) : row.slice()));
		const counts = faces.map((row) => row.filter(Boolean).length);
		this.setState({ counts, faces, guaOrigin: 'cast', lastSeed: '' }, () => this.saveSnap());
	}
	setCountDirect(layer, val) {
		if (!this.state.manualMode) { return; }
		let n = Math.floor(Number(val));
		if (!Number.isFinite(n)) { return; }
		if (n < 0) { n = 0; }
		if (n > 4) { n = 4; }
		const counts = (this.state.counts || [0, 0, 0]).slice();
		counts[layer] = n;
		this.setState({ counts, faces: facesFromCounts(counts), guaOrigin: 'cast', lastSeed: '' }, () => this.saveSnap());
	}
	clickReproduce() {
		if (!this.state.lastSeed) { return; }
		this.setState({ seedMode: 'manual', manualSeed: this.state.lastSeed });
		this.persist({ seedMode: 'manual' });
	}
	toggleManualMode(on) {
		const patch = { manualMode: !!on };
		// 开手动且尚无卦 → 铺一副全覆棋供点摆(全覆=合法的纯阴镘起点)。
		if (on && !this.state.counts) {
			patch.counts = [0, 0, 0];
			patch.faces = facesFromCounts([0, 0, 0]);
			patch.guaOrigin = 'cast';
			patch.lastSeed = '';
		}
		this.setState(patch, () => { if (on && this.state.counts) { this.saveSnap(); } });
	}

	// ── 快照 / 事盘 ──
	currentGua() {
		const cs = this.state.counts;
		return cs ? findLingqiGua(cs[0], cs[1], cs[2]) : null;
	}
	buildSnapshot() {
		return buildLingqiSnapshotText({
			counts: this.state.counts,
			question: this.state.question,
			category: this.state.category,
			zhuVisible: this.state.zhuVisible,
			wuDay: isWuDay(this.nongli()),
			timeLines: buildQiKeTimeLines(this.activeFields()),
		});
	}
	saveSnap() {
		const t = this.buildSnapshot();
		if (t) { saveModuleAISnapshot('lingqi', t, snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() })); }
	}
	restoreFromCurrentCase(force) {
		const saved = getKentangSavedCasePayload('lingqi');
		if (!saved || !saved.payload || !Array.isArray(saved.payload.counts) || saved.payload.counts.length !== 3) { return false; }
		if (!force && this.lastRestoredCaseId === saved.caseVersion) { return !!this.state.counts; }
		const p = saved.payload;
		const o = p.options && typeof p.options === 'object' ? p.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.setState({
			counts: p.counts.slice(),
			faces: facesFromCounts(p.counts),
			guaOrigin: 'case', casting: false, manualMode: false,
			lastSeed: o.seed !== undefined && o.seed !== null ? `${o.seed}` : '',
			// 🔴 seedMode 此前**存而不载**:保存时硬写 'manual'(存档即冻结),读档却不回灌 →
			// 左栏种子档位仍是 localStorage 里的 'random',与存档不符,用户一看就觉得「设置没还原」。
			seedMode: o.seedMode || 'manual',
			manualSeed: o.seed !== undefined && o.seed !== null ? `${o.seed}` : this.state.manualSeed,
			question: o.question || '',
			category: o.category || this.state.category,
			display: o.display || this.state.display,
			zhuVisible: { ...DEFAULT_LINGQI_ZHU_VISIBLE, ...(o.zhuVisible || {}) },
			localFields: null, error: '',
		}, () => this.saveSnap());
		return true;
	}
	clickSaveCase() {
		if (!this.state.counts) { return; }
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.activeFields(),
			module: 'lingqi',
			label: '灵棋经',
			payload: {
				options: {
					seedMode: 'manual',                    // 存档即冻结:读档必复现同卦(塔罗同款)
					seed: this.state.lastSeed,
					question: this.state.question,
					category: this.state.category,
					display: this.state.display,
					zhuVisible: { ...this.state.zhuVisible },
					wuDay: isWuDay(this.nongli()),
					timeLines: buildQiKeTimeLines(this.activeFields()),
				},
				counts: this.state.counts.slice(),        // 🔴 冻结棋数(重算只重排判读,绝不重掷)
				snapshot: this.buildSnapshot(),
			},
		});
	}
	getQuickDockConfig() {
		return {
			hasResult: !!this.state.counts,
			primary: { key: 'cast', label: '掷棋', onClick: () => this.doCast() },
			save: () => this.clickSaveCase(),
		};
	}

	// ── 文本工具:简/原文 + 问类高亮 ──
	t(str) { return this.state.display === 'orig' ? `${str || ''}` : lingqiToSimp(str); }
	renderRich(text, keyPrefix) {
		const body = this.t(text);
		if (!body) { return null; }
		const kws = this.state.display === 'simp' ? (LINGQI_CATEGORY_KEYWORDS[this.state.category] || []) : [];
		if (!kws.length) { return body; }
		const re = new RegExp(`(${kws.join('|')})`, 'g');
		const parts = body.split(re);
		return parts.map((p, i) => (kws.indexOf(p) >= 0
			? <mark key={`${keyPrefix || 'hl'}-${i}`} className="horosa-lingqi-mark">{p}</mark> : p));
	}

	/** 左栏 */
	field(label, node, hint, row) {
		return (
			<label className={`horosa-huangji-select-field${row ? ' horosa-heluo-switch-field' : ' is-wide'}`} key={label}>
				<span>{label}</span>
				{node}
				{hint ? <em className="horosa-guice-hint">{hint}</em> : null}
			</label>
		);
	}
	renderControls() {
		const s = this.state;
		const fields = this.activeFields();
		const counts = s.counts;
		return (
			<>
			{/* 时地面板自带「时间/当地时间/地点」逐项标签,节头「时间与地点」冗余 —— 裸卡呈现(用户定夺) */}
			<section className="xq-side-section horosa-lingqi-timegeo">
				<SpaceTimePanel
					fields={fields}
					value={buildDateTimeFromFields(fields)}
					onTimeChange={this.onTimeChanged}
					onGeoChange={this.changeGeo}
				/>
			</section>
			<XQSideSection iconName={sideSectionIcon('target')} title="起卦" storageKey="lingqi.cast" className="horosa-side-input-section">
				<div className="horosa-xlr-controls horosa-cnx-controls">
					{this.field('种子来源', (
						<Radio.Group size="small" optionType="button" value={s.seedMode} disabled={s.manualMode}
							onChange={(e) => this.setPersisted('seedMode', e.target.value)}
							options={[{ value: 'random', label: '随机' }, { value: 'time_seed', label: '时间' }, { value: 'manual', label: '手动' }]} />
					), s.seedMode === 'time_seed' ? '同一分钟同种子,可复现' : null)}
					{s.seedMode === 'manual' && !s.manualMode ? this.field('手动种子',
						<InputNumber size="small" style={{ width: '100%' }} value={s.manualSeed}
							onChange={(v) => this.setState({ manualSeed: v })} />) : null}
					<div className="horosa-lingqi-actions">
						<Button type="primary" size="small" className="horosa-lingqi-cast-btn" block
							disabled={s.manualMode || s.casting} onClick={this.doCast}>掷 棋 起 卦</Button>
						<div className="horosa-lingqi-actions-row">
							<Button size="small" disabled={!s.lastSeed} onClick={() => this.clickReproduce()}>锁定复现</Button>
							<Button size="small" disabled={!counts} onClick={() => this.clickSaveCase()}>保存</Button>
						</div>
					</div>
					{s.lastSeed ? <div className="horosa-lingqi-seed-hint"><i>种子</i><code>{s.lastSeed}</code></div> : null}
					{this.field('手动摆棋', <Switch size="small" checked={s.manualMode} onChange={(v) => this.toggleManualMode(v)} />,
						s.manualMode ? '点中栏棋子翻面,或直设三数' : null, true)}
					{s.manualMode ? this.field('上·中·下', (
						<div style={{ display: 'flex', gap: 6 }}>
							{[0, 1, 2].map((i) => (
								<InputNumber key={i} size="small" min={0} max={4} style={{ flex: 1 }}
									placeholder={LAYER_META[i].label} value={counts ? counts[i] : 0}
									onChange={(v) => this.setCountDirect(i, v)} />
							))}
						</div>
					), '各 0-4 枚字面朝上') : null}
				</div>
			</XQSideSection>
			<XQSideSection iconName={sideSectionIcon('display')} title="显示与注家" storageKey="lingqi.display" className="horosa-side-input-section">
				<div className="horosa-xlr-controls horosa-cnx-controls">
					{this.field('文字', (
						<Radio.Group size="small" optionType="button" value={s.display}
							onChange={(e) => this.setPersisted('display', e.target.value, true)}
							options={[{ value: 'simp', label: '简体' }, { value: 'orig', label: '四库原文' }]} />
					))}
					<div className="horosa-guazhan-set-group">
						<div className="horosa-guazhan-set-subhead">注家显示</div>
						<div className="horosa-lingqi-zhu-grid">
							{LINGQI_ZHU_META.map((zm) => (
								<Checkbox key={zm.key} checked={s.zhuVisible[zm.key] !== false} title={`${zm.era} · ${zm.source}`}
									onChange={(e) => this.setPersisted('zhuVisible', { ...s.zhuVisible, [zm.key]: e.target.checked }, true)}>
									{zm.source.slice(0, 1)}{zm.source.slice(-1)}
								</Checkbox>
							))}
							<Checkbox checked={s.zhuVisible.ke !== false}
								onChange={(e) => this.setPersisted('zhuVisible', { ...s.zhuVisible, ke: e.target.checked }, true)}>课断</Checkbox>
							<Checkbox checked={s.zhuVisible.shi !== false}
								onChange={(e) => this.setPersisted('zhuVisible', { ...s.zhuVisible, shi: e.target.checked }, true)}>断诗</Checkbox>
						</div>
					</div>
				</div>
			</XQSideSection>
			<XQSideSection iconName={sideSectionIcon('input')} title="问事" storageKey="lingqi.ask" className="horosa-side-input-section">
				<div className="horosa-xlr-controls horosa-cnx-controls">
					{this.field('所问之事', <Input size="small" placeholder="所占何事(入快照)" value={s.question}
						onChange={(e) => this.setState({ question: e.target.value })}
						onBlur={() => { if (this.state.counts) { this.saveSnap(); } }} />)}
					{this.field('问类', (
						<Select size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false} value={s.category}
							onChange={(v) => this.setPersisted('category', v, true)}>
							{LINGQI_CATEGORY_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
						</Select>
					), s.category !== 'general' ? '注文中相关词句将高亮' : null)}
				</div>
			</XQSideSection>
			</>
		);
	}

	/** 中栏:十二棋盘面 */
	renderChip(layer, idx) {
		const s = this.state;
		const empty = !s.counts;
		const up = !empty && s.faces && s.faces[layer] && s.faces[layer][idx];
		const cls = ['horosa-lingqi-chip'];
		if (empty) { cls.push('is-ghost'); }
		else { cls.push(up ? 'is-up' : 'is-down'); }
		if (s.casting) { cls.push('is-tossing'); }
		if (s.manualMode && !empty) { cls.push('is-clickable'); }
		const delay = s.casting ? { animationDelay: `${(layer * 4 + idx) * 55}ms` } : undefined;
		// 单面条件渲染(不用 CSS 3D 双面):棋枰 overflow 容器会 flatten 3D 上下文致 backface 失效
		// (正覆两面叠印实测复现)——直接按 up/覆 渲染对应面,零 3D 依赖恒确定;翻滚动画仍在 inner。
		return (
			<button
				key={idx} type="button" className={cls.join(' ')}
				disabled={!s.manualMode || empty}
				title={empty ? '未起卦' : `${LAYER_META[layer].label}位第${idx + 1}枚 · ${up ? '字面朝上' : '覆'}${s.manualMode ? '(点击翻面)' : ''}`}
				onClick={() => this.toggleChip(layer, idx)}
			>
				<span className="horosa-lingqi-chip-inner" style={delay}>
					{(empty || up)
						? <span className="horosa-lingqi-chip-face is-front">{this.t(LAYER_META[layer].label)}</span>
						: <span className="horosa-lingqi-chip-face is-back" />}
				</span>
			</button>
		);
	}
	renderCenter() {
		const s = this.state;
		const gua = this.currentGua();
		const wu = isWuDay(this.nongli());
		return (
			<div className="horosa-lingqi-board">
				<div className="horosa-cnx-board-header">
					<div>
						<div className="horosa-cnx-board-title">灵棋盘 · 十二棋</div>
						<div className="horosa-cnx-board-kicker">上四为天为君 · 中四为人为臣 · 下四为地为民</div>
					</div>
					{gua ? <span className="horosa-cnx-board-badge">{lingqiCountsText(s.counts)}</span>
						: <span className="horosa-cnx-board-badge is-idle">未起卦</span>}
				</div>
				<div className="horosa-lingqi-layers">
					{[0, 1, 2].map((layer) => (
						<div key={layer} className="horosa-lingqi-layer">
							<div className="horosa-lingqi-layer-label">
								<b>{LAYER_META[layer].label}</b>
								<em>{LAYER_META[layer].role}·{LAYER_META[layer].realm}</em>
								<span>{s.counts ? `${s.counts[layer]} 枚` : '—'}</span>
							</div>
							<div className="horosa-lingqi-chips">
								{[0, 1, 2, 3].map((idx) => this.renderChip(layer, idx))}
							</div>
						</div>
					))}
				</div>
				{gua ? (
					<div className="horosa-lingqi-result-band">
						<div className="horosa-lingqi-result-main">
							<span className="horosa-lingqi-result-ordinal">{gua.id === 125 ? '卦外' : lingqiOrdinalCn(gua.id)}</span>
							<span className="horosa-lingqi-result-name">{this.t(gua.name)}卦</span>
							<span className="horosa-lingqi-result-xiang">{this.t(gua.xiang)}之象</span>
						</div>
						<div className="horosa-lingqi-result-sub">
							{gua.attr ? <span>{this.t(gua.attr)}</span> : <span>{this.t('十二棋皆覆,混沌未明,不在一百二十四卦之数')}</span>}
							{s.guaOrigin === 'case' ? <Tag className="horosa-lingqi-origin-tag">载自事盘</Tag> : null}
							{wu ? <Tag className="horosa-lingqi-wu-tag">六戊日 · 古法不宜占卜</Tag> : null}
						</div>
					</div>
				) : (
					<div className="horosa-lingqi-empty-hint">
						左栏「掷棋起卦」一掷成卦;或开「手动摆棋」点棋翻面。古法:一时掷之,不可再掷。
						{wu ? <div className="horosa-lingqi-wu-inline">今为六戊日 ——《灵棋经》:六戊日不宜占卜(仅提示)。</div> : null}
					</div>
				)}
			</div>
		);
	}

	/** 右栏 */
	renderAux() {
		const s = this.state;
		const gua = this.currentGua();
		const wait = (txt) => <div className="horosa-cnx-wait">{txt}</div>;
		const card = (title, body, extra) => (
			<div className="horosa-cnx-vcard horosa-lingqi-vcard" key={title}>
				<div className="horosa-cnx-vcard-top">
					<span className="horosa-cnx-vcard-name">{title}</span>
					{extra || null}
				</div>
				<div className="horosa-cnx-body">{body}</div>
			</div>
		);
		const sc = s.counts ? sanCaiOf(s.counts) : null;
		return (
			<Tabs size="small" className="horosa-xlr-aux horosa-cnx-aux horosa-lingqi-aux">
				<TabPane tab="概览" key="overview">
					{!gua ? wait('掷棋或手动摆棋后,此处显示卦名与结构总览。') : <>
						{card('本卦', (
							<div className="horosa-lingqi-ov">
								<div className="horosa-lingqi-ov-head">
									{gua.id !== 125 ? <span className="horosa-lingqi-ov-ord">{lingqiOrdinalCn(gua.id)}</span> : null}
									<span className="horosa-lingqi-ov-name">{this.t(gua.name)}卦</span>
									<span className="horosa-lingqi-ov-xiang">{this.t(gua.xiang)}之象</span>
								</div>
								<div className="horosa-lingqi-ov-line"><em>棋势</em>{lingqiCountsText(s.counts)}</div>
								{gua.attr ? <div className="horosa-lingqi-ov-line"><em>格局</em>{this.t(gua.attr)}</div> : null}
								{gua.note ? <div className="horosa-lingqi-ov-note">原书小注:{this.t(gua.note)}</div> : null}
							</div>
						))}
						{sc ? card('三才结构', (
							<div className="horosa-lingqi-sancai">
								{sc.layers.map((ly) => (
									<div key={ly.key} className="horosa-lingqi-sancai-row">
										<span className="horosa-lingqi-sancai-pos">{ly.label}</span>
										<span className="horosa-lingqi-sancai-role">{ly.role}·{ly.realm}</span>
										<span className="horosa-lingqi-sancai-val">{ly.value} 枚</span>
										<span className={`horosa-lingqi-sancai-xing is-x${ly.value}`}>{this.t(ly.xing)}</span>
									</div>
								))}
								{sc.relations.filter((r) => r.kind).map((r) => (
									<div key={r.between} className={`horosa-lingqi-rel is-${r.kind}`}>
										{r.between}成<b>{this.t(r.label)}</b> —— {this.t(r.gloss)}
									</div>
								))}
								<div className="horosa-lingqi-yy">
									阳数 {sc.yang} 层 · 阴数 {sc.yin} 层
									{sc.tendency ? <em>{this.t(sc.tendency)}</em> : null}
								</div>
							</div>
						), <span className="horosa-cnx-vcard-meta">刘基后序口径</span>) : null}
						{card('占时', (
							<div className="horosa-lingqi-timelines">
								{buildQiKeTimeLines(this.activeFields()).map((l, i) => <div key={i}>{l}</div>)}
								{isWuDay(this.nongli()) ? <div className="horosa-lingqi-wu-inline">六戊日 ——「六戊日不宜占卜」(仅提示,不碍成卦)。</div> : null}
							</div>
						))}
					</>}
				</TabPane>
				<TabPane tab="繇辞" key="yao">
					{!gua ? wait('起卦后显示象曰繇辞与断诗。') : <>
						{card('象曰', <p className="horosa-lingqi-yao-text">{this.renderRich(gua.yao, 'yao')}</p>)}
						{s.zhuVisible.shi !== false ? <>
							{card('诗曰', (
								<div className="horosa-lingqi-verse">
									{splitVerse(this.t(gua.shi)).map((v, i) => <div key={i}>{v}</div>)}
								</div>
							))}
							{gua.shiEx ? card('又曰', (
								<div className="horosa-lingqi-verse">
									{splitVerse(this.t(gua.shiEx)).map((v, i) => <div key={i}>{v}</div>)}
								</div>
							)) : null}
						</> : <div className="horosa-cnx-note">断诗显示已在左栏关闭。</div>}
					</>}
				</TabPane>
				<TabPane tab="注解" key="zhu">
					{!gua ? wait('起卦后显示颜/何/陈/刘四家注。') : <>
						{LINGQI_ZHU_META.map((zm) => {
							if (s.zhuVisible[zm.key] === false) { return null; }
							const body = gua.zhu[zm.key];
							return (
								<div className="horosa-cnx-vcard horosa-lingqi-vcard" key={zm.key}>
									<div className="horosa-cnx-vcard-top">
										<span className="horosa-lingqi-zhu-avatar">{this.t(zm.source).slice(0, 1)}</span>
										<span className="horosa-cnx-vcard-name">{this.t(zm.label)}</span>
										<span className="horosa-lingqi-zhu-era">{zm.era} · {zm.source}</span>
									</div>
									<div className="horosa-cnx-body">{body
										? <p>{this.renderRich(body, zm.key)}</p>
										: <p className="horosa-lingqi-missing">本卦原书无此家注。</p>}</div>
								</div>
							);
						})}
						{LINGQI_ZHU_META.every((zm) => s.zhuVisible[zm.key] === false)
							? <div className="horosa-cnx-note">注家显示已在左栏全部关闭。</div> : null}
					</>}
				</TabPane>
				<TabPane tab="课断" key="ke">
					{!gua ? wait('起卦后显示「此课」总断。') : (s.zhuVisible.ke === false
						? <div className="horosa-cnx-note">课断显示已在左栏关闭。</div>
						: (
							<div className="horosa-cnx-vcard horosa-lingqi-vcard">
								<div className="horosa-cnx-vcard-top">
									<span className="horosa-lingqi-zhu-avatar">课</span>
									<span className="horosa-cnx-vcard-name">此课</span>
									<span className="horosa-lingqi-zhu-era">总断</span>
								</div>
								<div className="horosa-cnx-body">{gua.ke
									? <p>{this.renderRich(gua.ke, 'ke')}</p>
									: <p className="horosa-lingqi-missing">本卦原书无「此课」总断(或已并入他家注文,见「注解」)。</p>}</div>
							</div>
						))}
				</TabPane>
				<TabPane tab="仪轨" key="ritual">
					{card(this.t(LINGQI_RITUAL.making.title), <p>{this.t(LINGQI_RITUAL.making.text)}</p>, <span className="horosa-cnx-vcard-meta">卷首</span>)}
					{card(this.t(LINGQI_RITUAL.rite.title), (
						<div className="horosa-lingqi-rite">
							{LINGQI_RITUAL.rite.items.map((it) => (
								<div key={it.label} className="horosa-lingqi-rite-item">
									<b>{this.t(it.label)}</b>
									<p>{this.t(it.text)}{it.note ? <em>({this.t(it.note)})</em> : null}</p>
								</div>
							))}
						</div>
					), <span className="horosa-cnx-vcard-meta">卷首</span>)}
					{card(this.t(LINGQI_RITUAL.sacrifice.title), (
						<div>
							<p>{this.t(LINGQI_RITUAL.sacrifice.text)}</p>
							<p className="horosa-lingqi-rite-zhu">{this.t(LINGQI_RITUAL.sacrifice.zhu)}</p>
						</div>
					), <span className="horosa-cnx-vcard-meta">卷首</span>)}
				</TabPane>
			</Tabs>
		);
	}

	render() {
		const slot = this.props.slot;
		if (slot === 'controls') { return this.renderControls(); }
		if (slot === 'center') { return <div className="horosa-huangji-page horosa-huangji-redesign">{this.renderCenter()}</div>; }
		if (slot === 'aux') { return <div className="horosa-huangji-page horosa-huangji-redesign">{this.renderAux()}</div>; }
		return (
			<div className="horosa-huangji-page horosa-xlr-page horosa-lingqi-page horosa-astro-redesign horosa-huangji-redesign" ref={this.rootRef}
				style={{ height: this.props.height || '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
							<div className="horosa-side-panel-heading">
								<div>
									<div className="horosa-side-panel-title">灵棋经设置</div>
									<div className="horosa-side-panel-subtitle">掷棋 · 摆棋 · 注家</div>
								</div>
							</div>
							{this.renderControls()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
							<div className="horosa-huangji-board-host">{this.renderCenter()}</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
							<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
								<div>
									<div className="horosa-side-panel-title">灵棋经卦辞</div>
									<div className="horosa-side-panel-subtitle">繇辞 · 诸家注 · 课断</div>
								</div>
							</div>
							{this.renderAux()}
						</div>
					</div>
				</div>
			</div>
		);
	}
}
export default LingQiMain;
export { STORE_KEY };
