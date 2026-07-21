import { Component } from 'react';
import { deriveNongliUniversalSync, subscribeRemoteNongli } from '../../utils/divinationTimeDraft';
import { createSignatureMemo } from '../../utils/memoBySignature';
import { sharedNativeModelEnabled } from '../../utils/perfFlags';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Empty, Select } from 'antd';
import { XQTabs as Tabs } from '../xq-ui';
import { buildLocalBaziResult } from '../../utils/baziLunarLocal';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { buildYizhangjingModel, buildYizhangjingSnapshotText } from '../../utils/yizhangjingReport';
import { BRANCHES, ZODIAC, STARS, gradeOf, daoOf, xiaoxianStarAt, xunShenAt } from '../../utils/yizhangjingLocal';

const { Option } = Select;

const MONTH_LABELS = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
import LORE from '../../utils/data/yizhangjingLore.json';
import DATA from '../../utils/data/yizhangjingData.json';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import './yizhangjing.less';

const { TabPane } = Tabs;

function fieldVal(fields, key, fallback = '') {
	if (!fields || !fields[key] || fields[key].value === undefined || fields[key].value === null) return fallback;
	return fields[key].value;
}

// 受控：opts 由上层左栏（KinAstroMain）提供；slot: 'center'(主·盘) | 'aux'(右·子tab明细)。
// 四柱农历来自 baziLunarLocal（星阙自己的农历，不走后端）；岁首=正月初一（异八字立春）。

// WP-F 极速化:模块级共享模型 memo —— 宿主把本组件渲染【两次】(center 与 aux 两实例),
// 各自的实例 memo 互不相通 → 同一次时间变更本地引擎白算两遍。此层跨实例共享:
// center 先算、aux 同签名直接命中(4 槽足够:两实例只差 slot,签名同源)。
// 共享引用只读契约:各消费方 render 不就地改写 model(dev 下深冻结保险丝);关开关=各算各的旧行为。
const sharedModelMemo = createSignatureMemo(4);
const devFreeze = (v) => {
	if(process.env.NODE_ENV !== 'production' && v && typeof v === 'object'){
		try{ deepFreeze(v); }catch(e){ /* 冻结失败不碍事 */ }
	}
	return v;
};
function deepFreeze(o){
	Object.freeze(o);
	Object.keys(o).forEach((k) => {
		const c = o[k];
		if(c && typeof c === 'object' && !Object.isFrozen(c)){ deepFreeze(c); }
	});
}

class YiZhangJingMain extends Component {
	constructor(props) {
		super(props);
		this.state = { tab: 'overview' };
		this.lastSnapKey = '';
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	// horosa_shusuan_native_scu_v1(补接):与 CanPingMain / HeLuoMain 逐字同款的 wrapper sCU。
	// 病灶:本组件此前零 sCU(只有 componentDidUpdate → saveSnap),宿主 KinAstroMain 任意 setState
	// (换右栏子页签 / updating 角标 / 点星改 tips)都让 center 与 aux 两个实例整表重渲一遍。
	// 语义:props 任一项变(宿主 buildYizhangjingOpts 的引用已由 memoOpts 稳定)或自身 state 变 → 照常
	// 重渲(零陈旧);函数型 props 视为恒等(详 wrapperPropsEqual)。
	// 日界/晚子/远程农历回包三条路径走 forceUpdate,天然绕过 sCU,不受影响。
	// kill-switch 同 chartSCU(horosa.perf.chartSCU 关 = 恒重渲的旧行为)。
	shouldComponentUpdate(nextProps, nextState) {
		if (nextState !== this.state) { return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount() {
		this.saveSnap();
		if (typeof window !== 'undefined') {
			this._dayBoundaryListener = () => { if (!this._unmounted) this.forceUpdate(); };
			this._lateZiHourListener = () => { if (!this._unmounted) this.forceUpdate(); };
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 全年份域:域外远程农历回包后清实例 memo 重渲(域内桥不触发,零影响)
		this._unsubRemoteNongli = subscribeRemoteNongli(() => {
			if (this._unmounted) return;
			this._modelKey = null;
			delete this._modelCache;
			this.forceUpdate();
		});
	}
	componentDidUpdate() { this.saveSnap(); }
	componentWillUnmount() {
		this._unmounted = true;
		if (typeof window !== 'undefined') {
			if (this._dayBoundaryListener) window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			if (this._lateZiHourListener) window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if (this._unsubRemoteNongli) { try { this._unsubRemoteNongli(); } catch (e) { /* noop */ } }
	}

	// AI 导出/挂载实时取数：导出侧派发 refresh 事件，这里即时构建快照回填（与 saveSnap 同源）。
	handleSnapshotRefreshRequest(evt) {
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if (moduleName !== 'yizhangjing') return;
		if (this.props.slot === 'aux') return;
		let text = '';
		try {
			const m = this.getModel();
			if (m) text = `${buildYizhangjingSnapshotText(m) || ''}`.trim();
		} catch (e) { text = ''; }
		if (text) {
			saveModuleAISnapshot('yizhangjing', text, { source: 'react', savedAt: Date.now() });
			if (evt && evt.detail && typeof evt.detail === 'object') evt.detail.snapshotText = text;
		}
	}

	getModel() {
		const f = this.props.fields || {};
		const dateMoment = f.date && f.date.value ? f.date.value : null;
		const timeMoment = f.time && f.time.value ? f.time.value : null;
		if (!dateMoment || !timeMoment) return null;
		const dateStr = dateMoment.format('YYYY-MM-DD');
		const params = {
			date: dateStr,
			time: timeMoment.format('HH:mm:ss'),
			lon: fieldVal(f, 'lon', ''),
			gender: this.props.gender !== undefined ? Number(this.props.gender) : fieldVal(f, 'gender', 1),
			timeAlg: fieldVal(f, 'timeAlg', 1),
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		};
		const opts = this.props.opts || {};
		const sig = JSON.stringify({ ...params, opts });
		if (this._modelKey === sig && Object.prototype.hasOwnProperty.call(this, '_modelCache')) return this._modelCache;
		// WP-F:实例 memo miss → 先查模块级共享(另一实例可能已算过同签名)
		if (sharedNativeModelEnabled()) {
			const sharedHit = sharedModelMemo.get(sig);
			if (sharedHit !== undefined) {
				this._modelKey = sig; this._modelCache = sharedHit;
				return sharedHit;
			}
		}
		const cache = (v) => {
			this._modelKey = sig; this._modelCache = v;
			// WP-F:存入模块级共享(另一实例同签名直接命中);dev 深冻结当只读保险丝。
			if (sharedNativeModelEnabled()) { sharedModelMemo.set(sig, devFreeze(v)); }
			return v;
		};
		let bazi;
		try { bazi = buildLocalBaziResult(params).bazi; } catch (e) { bazi = null; }
		if (!bazi) {
			// 全年份域:lunar-js 域(AD1~9999)外走远程农历桥(域内行为零变;远程首回 null,
			// 回包经 subscribeRemoteNongli 触发重渲后补全)。桥产出含正月初一口径年干支
			// (yearGZByLunar)+四柱+农历月日,resolveLunarInput 所需俱全。
			const nl = deriveNongliUniversalSync(this.props.fields);
			if (nl) {
				bazi = { nongli: nl, fourColumns: nl.bazi, gender: params.gender };
			} else {
				// 远程在途:绝不把 null 落实例/模块级 memo(否则回包后 sharedModelMemo 仍回放 null,
				// 重渲永远空态);等回包重渲时再算再缓存。
				return null;
			}
		}
		if (!bazi) { return cache(null); }
		let model = null;
		try { model = buildYizhangjingModel(bazi, opts); } catch (e) { model = null; }
		return cache(model);
	}

	saveSnap() {
		if (this.props.slot === 'aux') return;
		const m = this.getModel();
		if (!m) return;
		const c = m.chart;
		// 去重键须用「原始 props.opts」而非 c.opts（引擎归一后 opts 仅含排盘项 mgMethod/N/flowSet，
		// 不含报告/显示层开关 shenshaLayer 等）；否则单独切神煞合参层不改键→被动快照不刷新→AI 挂载读到旧值。
		const key = `${c.input.yearBranch}|${c.input.month}|${c.input.day}|${c.input.hourBranch}|${JSON.stringify(this.props.opts || {})}`;
		if (key === this.lastSnapKey) return;
		this.lastSnapKey = key;
		const text = buildYizhangjingSnapshotText(m);
		if (text) saveModuleAISnapshot('yizhangjing', text, { source: 'react', savedAt: Date.now() });
	}

	// 十二宫盘（紫微斗数式 4×4 格盘，令牌驱动）：外圈 12 宫按固定地支格位排布，中央 2×2 为命宫枢；
	// 每宫 支生肖 + 星（大字）+ 六道·品级，年月日时角标，命宫格高亮。
	renderBoard(m) {
		const c = m.chart;
		const roles = {};
		const addRole = (idx, ch) => { roles[idx] = (roles[idx] || '') + ch; };
		addRole(c.fourIdx.year, '年'); addRole(c.fourIdx.month, '月');
		addRole(c.fourIdx.day, '日'); addRole(c.fourIdx.time, '时');
		// 紫微式固定地支格位（4×4，外圈 12 宫，[col,row] 1-based）
		const POS = { 巳: [1, 1], 午: [2, 1], 未: [3, 1], 申: [4, 1], 辰: [1, 2], 酉: [4, 2], 卯: [1, 3], 戌: [4, 3], 寅: [1, 4], 丑: [2, 4], 子: [3, 4], 亥: [4, 4] };
		const gc = (g) => g === '上品' ? 'is-up' : (g === '下品' ? 'is-down' : 'is-mid');
		const cells = BRANCHES.map((br, i) => {
			const [col, row] = POS[br];
			const s = STARS[i]; const grade = gradeOf(s); const isMing = i === c.mingIdx;
			return (
				<div key={i} className={`horosa-yizhangjing-cell ${gc(grade)}${isMing ? ' is-ming' : ''}`} style={{ gridColumn: col, gridRow: row }}>
					<div className="cell-head">
						<span className="cell-br">{br}{ZODIAC[i]}</span>
						<span className="cell-tags">
							{isMing ? <span className="cell-ming">命</span> : null}
							{roles[i] ? <span className="cell-role">{roles[i]}</span> : null}
						</span>
					</div>
					<div className="cell-star">{s}</div>
					<div className="cell-foot">{daoOf(i)} · {grade}</div>
				</div>
			);
		});
		return (
			<div className="horosa-yizhangjing-board">
				{cells}
				<div className="horosa-yizhangjing-hub" style={{ gridColumn: '2 / 4', gridRow: '2 / 4' }}>
					<div className="hub-brand">一掌经 · 十二宫盘</div>
					<div className="hub-title">命宫主星</div>
					<div className="hub-star">{c.mingStar}</div>
					<div className="hub-meta">{c.mingBranch}宫 · {c.yinyang}年{c.dirText}</div>
					<div className="hub-tags">
						<span>{c.fourPalaceRank.replace(/（.*?）/g, '')}</span>
						<span>{c.mingGe.replace(/（.*?）/g, '')}</span>
					</div>
				</div>
			</div>
		);
	}

	// 四柱四宫 · 精致横条（年月日时·主体展示）
	renderPillarStrip(m) {
		const labels = ['年 · 祖上', '月 · 父母事业', '日 · 夫妻', '时 · 自身主星'];
		const gc = (g) => g === '上品' ? 'is-up' : (g === '下品' ? 'is-down' : 'is-mid');
		return (
			<div className="horosa-yizhangjing-strip">
				{m.chart.pillars.map((p, i) => (
					<div className={`horosa-yizhangjing-pcell ${gc(p.grade)}${i === 3 ? ' is-main' : ''}`} key={i}>
						<div className="pl">{labels[i]}</div>
						<div className="pstar">{p.star}</div>
						<div className="pmeta">{p.branch}{p.zodiac} · {p.dao}</div>
						<div className="pgrade">{p.grade}</div>
					</div>
				))}
			</div>
		);
	}

	card(title, children) {
		return (
			<div className="horosa-huangji-info-card" key={title}>
				<div className="horosa-huangji-info-heading">{title}</div>
				{children}
			</div>
		);
	}

	// 中栏 = 主体：精简题头 + 十二宫盘 + 四柱四宫横条（子tab 明细全移右栏）
	// 生辰农历标注：始终显示真实农历月（不随定月法/闰月折算变动）；排盘实际取月与之不同时补注。
	lunarBirthParts(m) {
		const ci = m.chart.input;
		const mi = m.input || {};
		const raw = mi.lunarMonth || ci.month;
		const leap = !!mi.leap;
		const core = `${leap ? '闰' : ''}${raw}月${ci.day}日`;
		const pai = ci.month !== raw
			? `（${(mi.monthNote || '').indexOf('节气') >= 0 ? '节气' : '闰月'}排作${ci.month}月）`
			: '';
		return { core, pai };
	}

	renderCenter(m) {
		const c = m.chart;
		const opts = c.opts;
		const lb = this.lunarBirthParts(m);
		return (
			<div className="horosa-yizhangjing-center">
				<div className="horosa-yizhangjing-toolbar">
					<span className="horosa-yizhangjing-part">{c.input.gender}命 · {c.input.yearBranch}（{ZODIAC[BRANCHES.indexOf(c.input.yearBranch)]}）年 农历{lb.core} {c.input.hourBranch}时{lb.pai}</span>
					<span className="horosa-yizhangjing-sub">{c.yinyang}年·{c.dirText} · 命宫{opts.mgMethod === 'shuZhiMao' ? '数至卯' : '时上起命'} · 大限{opts.N}年 · 流年{opts.flowSet}组（左栏可切流派，右栏看断语）</span>
				</div>
				{this.renderBoard(m)}
				{this.renderPillarStrip(m)}
			</div>
		);
	}

	renderGeju(m) {
		const c = m.chart;
		return (
			<div>
				{this.card('格局判定（以时宫为主）', (
					<div className="horosa-yizhangjing-text">
						<div className="horosa-yizhangjing-row"><span>四宫等第</span><strong>{c.fourPalaceRank}</strong></div>
						<div className="horosa-yizhangjing-row"><span>命格</span><strong>{c.mingGe}</strong></div>
						<div className="horosa-yizhangjing-row"><span>九品估</span><strong>{c.nineGrade}</strong></div>
						<div className="horosa-yizhangjing-row"><span>品级分布</span><strong>上品×{c.gradeCount.up}　中品×{c.gradeCount.mid}　下品×{c.gradeCount.down}</strong></div>
						<p className="dim">{(DATA.gradeTables && DATA.gradeTables.nineGrade) || ''}</p>
					</div>
				))}
				{this.card('主星象义（时柱）', <div className="horosa-yizhangjing-text"><p>{(m.pillars[3] || {}).xiangyi || '—'}</p></div>)}
				{m.rishi ? this.card(`交互格 · 日${m.dayStar}×时${m.timeStar}`, <div className="horosa-yizhangjing-text"><p>{m.rishi}</p></div>) : null}
				{m.zhiye ? this.card(`职业适性 · 月柱${m.monthStar}`, <div className="horosa-yizhangjing-text"><p>{m.zhiye}</p></div>) : null}
				<div className="horosa-yizhangjing-subhead">重犯（伏吟）</div>
				{this.renderChongfan(m)}
			</div>
		);
	}

	renderChongfan(m) {
		if (!m.repeats.length) return this.card('重犯（伏吟）', <div className="horosa-yizhangjing-text"><p className="dim">四柱无重犯（四星各异）。</p></div>);
		return (
			<div>
				{m.repeats.map((r, i) => this.card(`${r.star} ×${r.count}（${r.count}犯）`, (
					<div className="horosa-yizhangjing-text">
						<p><b>详解：</b>{r.detail || '—'}</p>
						<div className="horosa-yizhangjing-row"><span>速断·常见组</span><strong className={r.chosen === 'alpha' ? 'hot' : ''}>{r.alpha || '—'}</strong></div>
						<div className="horosa-yizhangjing-row"><span>速断·异传组</span><strong className={r.chosen === 'beta' ? 'hot' : ''}>{r.beta || '—'}</strong></div>
					</div>
				)))}
				<p className="horosa-yizhangjing-note">两组口诀结论有别，依所宗取用；当前左栏选「{m.repeats[0].chosen === 'beta' ? '异传组' : '常见组'}」。{(DATA.gradeTables && DATA.gradeTables.chongfanRule) || ''}</p>
			</div>
		);
	}

	renderDayun(m) {
		return this.card(`大限（从月宫起·一宫${m.chart.opts.N}年·${m.chart.dirText}）`, (
			<div className="horosa-yizhangjing-tablewrap">
				<table className="horosa-yizhangjing-table">
					<thead><tr><th>虚岁</th><th>宫·星·道</th><th>运×时断语</th></tr></thead>
					<tbody>
						{m.dayun.map((d, i) => (
							<tr key={i}>
								<td>{d.from}–{d.to}</td>
								<td>{d.branch}·<b>{d.star}</b><br /><span className="dim">{d.dao}·{d.grade}{d.wuxing ? '·' + d.wuxing : ''}</span></td>
								<td className="lt">{d.yunshi || '—'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		));
	}

	renderFlow(m) {
		const c = m.chart;
		const rows = [];
		for (let a = 1; a <= 12; a++) {
			rows.push({ age: a, star: xiaoxianStarAt(c.xiaoStartIdx, c.dir, a) });
		}
		// 流年地支：默认取本命年支，可下拉切换；表头标注四柱/命宫落宫。
		const flowIdx = this.state.flowYearIdx == null ? c.fourIdx.year : this.state.flowYearIdx;
		const marks = {};
		const mk = (i, ch) => { marks[i] = (marks[i] || '') + ch; };
		mk(c.fourIdx.year, '年'); mk(c.fourIdx.month, '月'); mk(c.fourIdx.day, '日'); mk(c.fourIdx.time, '时'); mk(c.mingIdx, '命');
		return (
			<div>
				{this.card(`小限（一宫一年·起${c.xiaoStartLabel}）`, (
					<div className="horosa-yizhangjing-tablewrap">
						<table className="horosa-yizhangjing-table horosa-yizhangjing-vtable">
							<thead><tr><th>虚岁</th><th>小限星</th></tr></thead>
							<tbody>{rows.map((r) => <tr key={r.age}><th>{r.age}</th><td className="lt">{r.star}</td></tr>)}</tbody>
						</table>
						<p className="dim">第13岁起循环，规律同上。</p>
					</div>
				))}
				{this.card(`流年十二神（${c.opts.flowSet === 'A' ? '甲组·太阳系' : c.opts.flowSet === 'B' ? '乙组·六合系' : '丙组·岁破系'}）`, (
					<div>
						<label className="horosa-yizhangjing-inlinefield">
							<span>流年地支</span>
							<Select size="small" value={flowIdx} dropdownMatchSelectWidth={false} onChange={(v) => this.setState({ flowYearIdx: v })}>
								{BRANCHES.map((b, i) => <Option key={i} value={i}>{b}{ZODIAC[i]}年</Option>)}
							</Select>
						</label>
						<div className="horosa-yizhangjing-tablewrap">
							<table className="horosa-yizhangjing-table horosa-yizhangjing-vtable">
								<thead><tr><th>地支</th><th>值神</th></tr></thead>
								<tbody>{BRANCHES.map((b, i) => (
									<tr key={i}>
										<th className={marks[i] ? 'hot' : ''}>{b}{ZODIAC[i]}{marks[i] ? '·' + marks[i] : ''}</th>
										<td className="lt">{xunShenAt(flowIdx, i, c.opts.flowSet)}</td>
									</tr>
								))}</tbody>
							</table>
						</div>
						<p className="dim">流年落「{BRANCHES[flowIdx]}{ZODIAC[flowIdx]}」，以其上起太岁顺布十二神；表头标「年/月/日/时/命」处即四柱与命宫落宫值神，据此断该年吉凶。</p>
					</div>
				))}
			</div>
		);
	}

	renderShensha(m) {
		const hits = (m && m.shenshaHits) || [];
		if (!hits.length) {
			return this.card('神煞入人事十二宫（合参层·非原生）', (
				<div className="horosa-yizhangjing-shensha-empty">本盘未定位到可入宫之合参神煞。</div>
			));
		}
		// 按人事宫聚合（保持宫序）：每宫坐一地支，落入之神煞并列于该宫下（仅显本盘落宫，非全表）
		const groups = [];
		const idx = {};
		hits.forEach((h) => {
			if (idx[h.palace] == null) { idx[h.palace] = groups.length; groups.push({ palace: h.palace, branch: h.branch, star: h.star, items: [] }); }
			groups[idx[h.palace]].items.push(h);
		});
		return this.card('神煞入人事十二宫（合参层·非原生）', (
			<div className="horosa-yizhangjing-shensha">
				<p className="horosa-yizhangjing-note">通用命理合参层：由生年支／日干／月支／日柱旬定位各神煞落地支，落坐哪一人事宫方现该宫断语（仅列本盘落宫，非全表罗列）。</p>
				<div className="horosa-yizhangjing-shensha-grid">
					{groups.map((grp) => (
						<div className="horosa-yizhangjing-shensha-cell" key={grp.palace}>
							<div className="horosa-yizhangjing-shensha-head">
								<span className="horosa-yizhangjing-shensha-pal">{grp.palace.replace(/\(.*\)/, '')}</span>
								<span className="horosa-yizhangjing-shensha-loc">{grp.branch}·{grp.star}</span>
							</div>
							{grp.items.map((it, k) => (
								<div className="horosa-yizhangjing-shensha-row" key={it.name + k}>
									<span className="horosa-yizhangjing-shensha-name">{it.name}</span>
									<span className="horosa-yizhangjing-shensha-src">{it.group}</span>
									<span className="horosa-yizhangjing-shensha-text">{it.text || '—'}</span>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		));
	}

	renderLore(m) {
		const c = m.chart;
		const hourMain = (LORE.poems && LORE.poems.hourMain && LORE.poems.hourMain[c.input.hourBranch]) || null;
		// 「X月生人诗」按真实农历生月（非定月法折算月）——与题头生辰一致。
		const monthPoem = (LORE.poems && LORE.poems.month && LORE.poems.month[MONTH_LABELS[(m.input && m.input.lunarMonth) || c.input.month]]) || null;
		return (
			<div>
				{monthPoem ? this.card('本月生人诗（文献）', <div className="horosa-yizhangjing-text"><p className="poem">{monthPoem.poem}</p><p>{monthPoem.prose}</p></div>) : null}
				{hourMain ? this.card('本时生人（文献）', <div className="horosa-yizhangjing-text"><p>{hourMain.text}</p></div>) : null}
				<p className="horosa-yizhangjing-note">古本诗文含旧时代观念，仅作文献保留。</p>
			</div>
		);
	}

	// 四柱文献：年/月/日/时四柱各主星的逐星全文，各柱独立成卡（此前仅时柱一柱，挤在掌诀页）。
	renderSiZhuLore(m) {
		const labels = ['年柱 · 祖上', '月柱 · 父母事业', '日柱 · 夫妻', '时柱 · 自身主星'];
		const pillars = m.chart.pillars;
		const anyFull = pillars.some((p) => LORE.starFull && LORE.starFull[p.star]);
		return (
			<div>
				{pillars.map((p, i) => {
					const full = (LORE.starFull && LORE.starFull[p.star]) || '';
					return this.card(`${labels[i]} · ${p.star}`, (
						full
							? <pre className="horosa-yizhangjing-pre">{full}</pre>
							: <div className="horosa-yizhangjing-text"><p className="dim">暂无该星逐星全文。</p></div>
					));
				})}
				{anyFull ? <p className="horosa-yizhangjing-note">古本诗文含旧时代观念，仅作文献保留。</p> : null}
			</div>
		);
	}

	// 右栏 = 全部子tab 明细（概览/格局/运限[大限+小限流年]/[神煞]/诗文/四柱文献）
	renderAux(m) {
		const c = m.chart;
		const lb = this.lunarBirthParts(m);
		// 旧键归一：重犯并入格局；小限·流年并入运限（防旧 state.tab 落空）。
		const TAB_ALIAS = { chongfan: 'geju', flow: 'dayun' };
		const activeTab = TAB_ALIAS[this.state.tab] || this.state.tab;
		return (
			<div className="horosa-yizhangjing-aux">
				<Tabs activeKey={activeTab} onChange={(k) => this.setState({ tab: k })} tabPosition="top" className="horosa-yizhangjing-tabs">
					<TabPane tab="概览" key="overview">
						{this.card('起盘信息', (
							<div>
								<div className="horosa-huangji-info-row"><span>性别 / 生年支</span><strong>{c.input.gender} / {c.input.yearBranch}（{ZODIAC[BRANCHES.indexOf(c.input.yearBranch)]}）</strong></div>
								<div className="horosa-huangji-info-row"><span>农历</span><strong>{lb.core} {c.input.hourBranch}时{lb.pai}</strong></div>
								<div className="horosa-huangji-info-row"><span>阴阳 / 顺逆</span><strong>{c.yinyang}年 / {c.dirText}</strong></div>
								<div className="horosa-huangji-info-row"><span>命宫定法</span><strong>{c.opts.mgMethod === 'shuZhiMao' ? '数至卯' : '时上起命'}</strong></div>
							</div>
						))}
						{this.card('命宫 · 格局速览', (
							<div>
								<div className="horosa-huangji-info-row"><span>命宫</span><strong>{c.mingBranch}·{c.mingStar}</strong></div>
								<div className="horosa-huangji-info-row"><span>四宫等第</span><strong>{c.fourPalaceRank}</strong></div>
								<div className="horosa-huangji-info-row"><span>命格</span><strong>{c.mingGe}</strong></div>
								<div className="horosa-huangji-info-row"><span>九品估</span><strong>{c.nineGrade}</strong></div>
							</div>
						))}
						{m.pillars.map((p, i) => this.card(`${['年柱(祖上)', '月柱(父母/兄弟/事业)', '日柱(夫妻)', '时柱(子女/自身·主星)'][i]}：${p.star}（${p.dao}·${p.grade}）`, (
							<div className="horosa-yizhangjing-text">
								<p><b>该柱：</b>{p.text || '—'}</p>
								<p><b>象义：</b>{p.xiangyi || '—'}</p>
								<p className="dim"><b>星性：</b>{p.xingxing || '—'}</p>
							</div>
						)))}
					</TabPane>
					<TabPane tab="格局" key="geju">{this.renderGeju(m)}</TabPane>
					<TabPane tab="运限" key="dayun">
						{this.renderDayun(m)}
						{this.renderFlow(m)}
						{m.liunianZong ? this.card(`流年总论 · 主星${m.timeStar}`, <div className="horosa-yizhangjing-text"><p>{m.liunianZong}</p></div>) : null}
					</TabPane>
					{m.shenshaLayer ? <TabPane tab="神煞" key="shensha">{this.renderShensha(m)}</TabPane> : null}
					<TabPane tab="诗文" key="lore">{this.renderLore(m)}</TabPane>
					<TabPane tab="四柱文献" key="sizhu">{this.renderSiZhuLore(m)}</TabPane>
				</Tabs>
			</div>
		);
	}

	// 空态右栏:子 tab 条恒在(与有盘时同构),各页内容区放空提示——用户在任何 tab 下切换/停留
	// 都能看到完整信息架构,不因未排盘整块消失。
	renderAuxEmpty() {
		const TAB_ALIAS = { chongfan: 'geju', flow: 'dayun' };
		const activeTab = TAB_ALIAS[this.state.tab] || this.state.tab;
		const empty = <div style={{ padding: 24 }}><Empty description="请先在左侧输入出生时间" /></div>;
		return (
			<div className="horosa-yizhangjing-aux">
				<Tabs activeKey={activeTab} onChange={(k) => this.setState({ tab: k })} tabPosition="top" className="horosa-yizhangjing-tabs">
					<TabPane tab="概览" key="overview">{empty}</TabPane>
					<TabPane tab="格局" key="geju">{empty}</TabPane>
					<TabPane tab="运限" key="dayun">{empty}</TabPane>
					<TabPane tab="诗文" key="lore">{empty}</TabPane>
					<TabPane tab="四柱文献" key="sizhu">{empty}</TabPane>
				</Tabs>
			</div>
		);
	}

	render() {
		const m = this.getModel();
		if (!m) {
			if (this.props.slot === 'aux') return this.renderAuxEmpty();
			return <div style={{ padding: 24 }}><Empty description="请先在左侧输入出生时间" /></div>;
		}
		return this.props.slot === 'aux' ? this.renderAux(m) : this.renderCenter(m);
	}
}

export default YiZhangJingMain;
