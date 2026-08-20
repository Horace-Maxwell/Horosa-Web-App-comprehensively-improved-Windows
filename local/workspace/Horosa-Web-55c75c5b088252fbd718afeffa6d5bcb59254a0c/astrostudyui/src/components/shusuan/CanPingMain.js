import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { parseYearFromDateStr } from '../../utils/dateStrSafe';
import { ganzhiYearBase } from '../../utils/ganzhiYearBase';
import { deriveNongliUniversalSync, subscribeRemoteNongli } from '../../utils/divinationTimeDraft';
import { createSignatureMemo } from '../../utils/memoBySignature';
import { sharedNativeModelEnabled } from '../../utils/perfFlags';
import { Empty } from 'antd';
import { XQTabs as Tabs } from '../xq-ui';
import { buildLocalBaziResult } from '../../utils/baziLunarLocal';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { calculate as canpingCalculate, liunianSeries, buildSnapshotText } from '../../utils/canpingLocal';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';

const { TabPane } = Tabs;

function fieldVal(fields, key, fallback = '') {
	if (!fields || !fields[key] || fields[key].value === undefined || fields[key].value === null) return fallback;
	return fields[key].value;
}

// 受控：method 由上层(数算宿主)左栏「取法」提供；slot: 'center'(主信息·滑动) | 'aux'(辅助信息·卡片)。
// 四柱来自 baziLunarLocal（星阙自己的八字，不走后端）。

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

class CanPingMain extends Component {
	// horosa_shusuan_native_scu_v1(PERF-R9;v3.5.1 起与上游 [R3-A6] 守卫合一 —— 语义同 wrapperPropsEqual,单一实现防双 sCU)
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props) {
		super(props);
		this.state = { method: props.method || 'ming' };
		this.lastSnapKey = '';
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}


	componentDidMount() {
		this.saveSnap();
		// v2.2.1: 监听全局日界 / 晚子时·时柱起干切换 → 强制重渲(getModel 内部用 defaultAfter23NewDay/defaultLateZiHourUseNextDay 实时读 localStorage)。
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = () => { if(!this._unmounted) this.forceUpdate(); };
			this._lateZiHourListener = () => { if(!this._unmounted) this.forceUpdate(); };
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}		// 全年份域:域外远程农历回包后清实例 memo 重渲(域内桥不触发,零影响)
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
		if(typeof window !== 'undefined'){
			if(this._dayBoundaryListener){
				window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			}
			if(this._lateZiHourListener){
				window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			}
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}		if (this._unsubRemoteNongli) { try { this._unsubRemoteNongli(); } catch (e) { /* noop */ } }
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/rehydrate 未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。与 saveSnap 同源同构(getModel→buildSnapshotText)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'canping'){
			return;
		}
		// 与 saveSnap 同语义:双盘对比时只 center 实例回填,避免 aux 覆盖 center 的导出快照。
		if(this.props.slot === 'aux'){
			return;
		}
		let text = '';
		try{
			const m = this.getModel();
			if(m){
				text = `${buildSnapshotText(m.r, { liunianRows: (m.series && m.series.rows) || null }) || ''}`.trim();
			}
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('canping', text, { source: 'react', savedAt: Date.now() });
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	curMethod() { return this.props.method !== undefined ? this.props.method : this.state.method; }

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
			// 性别以左栏下拉(props.gender '1'/'0')为准,接线到本地引擎;缺省回退 fields。
			// 🔴 此前只读 fields → 左栏改性别本命条文不换层(男命/女命)=死开关(用户实测)。
			gender: this.props.gender !== undefined ? Number(this.props.gender) : fieldVal(f, 'gender', 1),
			timeAlg: fieldVal(f, 'timeAlg', 1),
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		};
		const method = this.curMethod();
		// 实例 memo:输入签名(四柱参数+取法+日界/晚子)不变即返缓存,避免 render/componentDidUpdate→saveSnap/
		// 快照 handler 多处反复跑「八字+canpingCalculate+120 年 liunianSeries」全量重算(卡顿根因)。算法不变。
		const sig = JSON.stringify({ ...params, method, opts: this.props.opts || {} });
		if (this._modelKey === sig && Object.prototype.hasOwnProperty.call(this, '_modelCache')) {
			return this._modelCache;
		}
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
			// 全年份域:lunar-js 域(AD1~9999)外走远程农历桥(域内行为零变;远程回包经
			// subscribeRemoteNongli 触发重渲后补全),四柱/农历自桥产同形对象取。
			const nl = deriveNongliUniversalSync(this.props.fields);
			if (nl) { bazi = { nongli: nl, fourColumns: nl.bazi, gender: params.gender }; }
			else {
				// 远程在途:绝不把 null 落实例/模块级 memo(否则回包后共享缓存仍回放 null)
				return null;
			}
		}
		if (!bazi) { return cache(null); }
		const fc = (bazi && bazi.fourColumns) || {};
		const gz = (p) => (p && (p.ganzi || p.ganZhi)) || '';
		const yearGz = gz(fc.year);
		const monthBranch = gz(fc.month).charAt(1);
		const dayBranch = gz(fc.day).charAt(1);
		const hourBranch = gz(fc.time).charAt(1);
		if (!yearGz || !monthBranch || !dayBranch || !hourBranch) return cache(null);
		// 性别单一来源=params.gender(左栏优先);bazi.gender 只是它的回声,远程农历桥分支下
		// 甚至直接透传 params.gender,故一律以 params 为准。
		const gender = Number(params.gender) === 0 ? '女' : '男';
		// 🔴 干支年基准(非出生公历年):立春前出生者差一年,直接用公历年流年整体错一位。
		const birthYear = ganzhiYearBase(parseYearFromDateStr(dateStr) || 0, yearGz);
		// 起运岁按生日推算需农历月/日（《参评诀》单月三十逆数、双月初一顺数）
		const nl = bazi.lunar || bazi.nongli || {};
		const lunarMonth = Number(nl.monthNum || nl.month) || 0;
		const lunarDay = Number(nl.dayNum || nl.day) || 0;
		const dayunRule = (this.props.opts && this.props.opts.dayunRule) || 'mingGongQiyun';
		// [Win-D69] 八字大运法真源注入:bazi.direction=lunar-js 节气起运(与八字模块同一函数
		// 同一结果),干支/起讫虚岁/公历年份逐字节同源——用户实测「起运岁数与年份对不上」的根治。
		// 远程农历桥分支(域外年)无 direction → 不注入,引擎回退旧排序法(零崩)。
		let baziYun = null;
		if (dayunRule === 'baziStyle') {
			try {
				const dir = bazi && bazi.direction;
				if (Array.isArray(dir) && dir.length) {
					baziYun = dir.map((d) => {
						const gzd = (d.mainDirect && (d.mainDirect.ganzi || d.mainDirect.ganZhi)) || '';
						return { branch: gzd.charAt(1) || '', ganzi: gzd, ageStart: d.age, ageEnd: d.age + 9, startYear: d.startYear, endYear: d.endYear };
					}).filter((d) => d.branch);
					if (!baziYun.length) { baziYun = null; }
				}
			} catch (e) { baziYun = null; }
		}
		const base = { yearGz, monthBranch, dayBranch, hourBranch, gender, method, qiyunAge: 1, lunarMonth, lunarDay, dayunRule, baziYun };
		const r = canpingCalculate(base);
		if (!r) return cache(null);
		let series = null;
		try { series = liunianSeries({ ...base, birthYear, startAge: 1, endAge: 120 }); } catch (e) { series = null; }
		return cache({ r, series, birthYear });
	}

	saveSnap() {
		if (this.props.slot === 'aux') return;
		const m = this.getModel();
		if (!m) return;
		const r = m.r;
		// 🔴 去重键必须含**一切影响输出的维度**:漏 gender 会让改性别后条文真变而快照不刷新
		// (AI 导出/挂载读陈旧盘);漏 opts 同理(大运法换档)。河洛同坑已修,此处对齐。
		const key = `${r.fourPillars.yearGz}|${r.method}|g:${r.gender}|o:${JSON.stringify(this.props.opts || {})}`;
		if (key === this.lastSnapKey) return;
		this.lastSnapKey = key;
		const text = buildSnapshotText(r, { liunianRows: (m.series && m.series.rows) || null });
		if (text) saveModuleAISnapshot('canping', text, { source: 'react', savedAt: Date.now() });
	}

	renderAux(m) {
		const r = m.r;
		const card = (title, rows) => (
			<div className="horosa-huangji-info-card" key={title}>
				<div className="horosa-huangji-info-heading">{title}</div>
				{rows.map((x, i) => (
					<div className="horosa-huangji-info-row" key={i}><span>{x[0]}</span><strong>{x[1]}</strong></div>
				))}
			</div>
		);
		return (
			<Tabs activeKey="info" tabPosition="top" className="horosa-huangji-tabs horosa-kinastro-tabs">
				<TabPane tab="命盘信息" key="info">
					<div className="horosa-canping-aux horosa-huangji-section-list">
						{card('四柱', [
							['年柱', r.fourPillars.yearGz], ['月支', r.fourPillars.monthBranch],
							['日支', r.fourPillars.dayBranch], ['时支', r.fourPillars.hourBranch],
						])}
						{card('纳音 · 取法', [
							['年纳音', `${r.element}（${r.partName}）`],
							['取法', r.method === 'gu' ? '古法（八字日支）' : '明法（月支反向）'],
							['日宫支', r.dayPalaceBranch], ['命宫', r.mingGong],
						])}
						{card('起数', [
							['顺数', r.benming.shun], ['逆数', r.benming.ni], ['子上轮', r.benming.ziRound],
							['本命数·顺', r.benming.verses.numShun], ['本命数·逆', r.benming.verses.numNi],
						])}
					</div>
				</TabPane>
			</Tabs>
		);
	}

	renderCenter(m) {
		const r = m.r;
		const bv = r.benming.verses;
		const kindLabel = r.kindMain === 'female' ? '女命' : '男命';
		const rows = (m.series && m.series.rows) || [];
		return (
			<div className="horosa-canping-center">
				<div className="horosa-canping-toolbar">
					<span className="horosa-canping-part">{r.element}（{r.partName}）· {kindLabel}</span>
					<span className="horosa-canping-sub">取法 {r.method === 'gu' ? '古法（八字日支）' : '明法（月支反向）'} · 日宫支 {r.dayPalaceBranch} · 命宫 {r.mingGong}（左栏可切换取法）</span>
				</div>

				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">本命（{kindLabel}）</div>
					<div className="horosa-canping-verse-num">顺 {bv.numShun}</div>
					<div className="horosa-canping-verse-text">{bv.textShun || '（空条·主贫贱夭折/灾咎）'}</div>
					<div className="horosa-canping-verse-num">逆 {bv.numNi}</div>
					<div className="horosa-canping-verse-text">{bv.textNi || '（空条·主贫贱夭折/灾咎）'}</div>
				</div>

				<div className="horosa-huangji-info-card">
					{/* 标题随大运法档实变（防「换了档看不出换没换」）；起运岁另附推算明细。
					    [Win-D69] baziSourced=八字真源注入成功:起运/年份与八字盘同源,表加干支与公历年两列。 */}
					<div className="horosa-huangji-info-heading">大运（歲運）· {r.dayunRule === 'baziStyle' ? `八字大运法·${r.dayunForward ? '顺行' : '逆行'}${r.baziSourced ? '·与八字盘同源' : ''}` : '命宫顺行'}{r.baziSourced ? ` · 节气起运（自 ${r.qiyunAge} 岁行运）` : (r.qiyunDetail && r.qiyunDetail.usable ? ` · 起运 ${r.qiyunDetail.years}岁${r.qiyunDetail.months ? `${r.qiyunDetail.months}个月` : ''}（自 ${r.qiyunAge} 岁行运）` : ' · 一岁起运')}</div>
					<table className="horosa-canping-table horosa-canping-dayun">
						<thead><tr><th>年龄</th>{r.baziSourced ? <th>公历年</th> : null}<th>{r.baziSourced ? '干支' : '支'}</th><th>顺 · 歲運</th><th>逆 · 歲運</th></tr></thead>
						<tbody>
							{r.dayun.map((d) => (
								<tr key={d.index}>
									<td>{d.ageStart}-{d.ageEnd}</td>
									{r.baziSourced ? <td>{d.startYear && d.endYear ? `${d.startYear}-${d.endYear}` : '—'}</td> : null}
									<td>{r.baziSourced && d.ganzi ? d.ganzi : d.branch}</td>
									<td><b>{d.numShun}</b> {(d.verses || {}).textShun}</td>
									<td><b>{d.numNi}</b> {(d.verses || {}).textNi}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">流年（歲運）· 全表 1–120 岁（太岁替日、大运替时）</div>
					{rows.length ? (
						<table className="horosa-canping-table horosa-canping-liunian">
							<thead><tr><th>岁</th><th>干支</th><th>大运</th><th>顺 · 歲運</th><th>逆 · 歲運</th></tr></thead>
							<tbody>
								{rows.map((y) => (
									<tr key={y.age}>
										<td>{y.age}</td>
										<td>{y.ganzhi}</td>
										<td>{y.dayunBranch}</td>
										<td><b>{y.verses.numShun}</b> {y.verses.textShun}</td>
										<td><b>{y.verses.numNi}</b> {y.verses.textNi}</td>
									</tr>
								))}
							</tbody>
						</table>
					) : <div className="horosa-canping-helper">需出生年份方能列全表流年。</div>}
				</div>
			</div>
		);
	}

	render() {
		const m = this.getModel();
		if (!m) {
			if (this.props.slot === 'aux') return null;
			return <div style={{ padding: 24 }}><Empty description="请先在左侧输入出生时间" /></div>;
		}
		return this.props.slot === 'aux' ? this.renderAux(m) : this.renderCenter(m);
	}
}

export default CanPingMain;
