// 推运图族四子页:演进推运(Néroman)/ 推运图(Bezza)/ 周日小限(Jay)/ 双黄道(Michon)。
// 计算在后端 /astroextra/<接口>(astrostudy/directed_figures.py);口径、名称与 AI 快照正文单源在 utils/directedFigures。
// 版式与主限法盘同一个(progPageLayout):左边整列是盘(双黄道是回归 / 恒星双环图),右栏固定头(标题行 →「时间选择」紧凑时间块 →「设置」)
// + 只在卡内滚动的表格卡片。
// 改任何设置自动重算,旧结果留着(角标「更新中…」);取不到结果时盘位显示原因,并每隔十几秒自动重试。
import React, { Component } from 'react';
import { Spin } from 'antd';
import { XQSelect as Select, XQInputNumber } from '../xq-ui';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { pointerLocalRatio } from '../../utils/zoomDomain';
import styles from '../../css/styles.less';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, chartParams, chartRequestKey, SmallTable, symbolWithMeaning, parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from './AstroExtraCommon';
import { fetchChart } from '../../services/astro';
import AstroChart from './AstroChart';
import AstroDoubleChart from './AstroDoubleChart';
import MichonDualRing from './MichonDualRing';
import { ProgPageShell, WheelSplit, SidePanelHead, SideSection, ControlCol, ControlGrid, TargetTimeControl, FillCard, LoadFailNote, EmptyWheel, MUTED } from './progPageLayout';
import { today, chartZone } from './astroProgSnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import {
	DIRECTED_FIGURES, NEROMAN_EQUATOR_OPTIONS, BEZZA_KIND_LABELS, BEZZA_MUNDANE_ASPECTS, ZODIAC_ASPECT_LABELS, MICHON_FAMILY_LABELS,
	directedFigureRequestFields, buildDirectedFigureText, pointName, fmtLon, fmtN,
} from '../../utils/directedFigures';
import {
	TIMELORD_FIELD_LABELS, TIMELORD_METHOD_FIELDS, TIMELORD_METHODS, TIMELORD_OPTIONS, TIMELORD_POLAR_NOTE, normalizeTimeLordOpts, timeLordAspectText,
	timeLordFields, timeLordMethod, timeLordPointName, timeLordRowLord,
} from '../../utils/timeLordTables';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

const { Option } = Select;
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

// 页面保存值 → 各技法设置(挂载齿轮同名字段,见 techniqueMountSettings)
export function directedFigureOptsFromSettings(key, sv){
	const s = sv || DIRECTION_PAGE_SETTINGS.load();
	if(key === 'neroman'){ return { k: s.nerK, t0: s.nerT0, keepDec: s.nerKeepDec, orb: s.nerOrb }; }
	if(key === 'bezzafigure'){ return { orb: s.bezzaOrb }; }
	if(key === 'jayprofection'){ return { from: s.jayFrom }; }
	if(key === 'michon'){ return { orb: s.michonOrb, swap: s.michonSwap, equal: s.michonEqual }; }
	if(key === 'timelords'){
		return { method: s.tlMethod, yearType: s.tlYearType, movingYear: s.tlMovingYear, turnStart: s.tlTurnStart, turnOrder: s.tlTurnOrder, orbMode: s.tlOrbMode,
			annualDays: s.tlAnnualDays, annualOrder: s.tlAnnualOrder, releaser: s.tlReleaser, variant: s.tlVariant, nineTime: s.tlNineTime, nineReverse: s.tlNineReverse,
			rateKind: s.tlRateKind, movingStart: s.tlMovingStart, devBasis: s.tlDevBasis, diurnalMode: s.tlDiurnalMode };
	}
	return {};
}

// 返回 null = 网络层失败(request 吞错时 resolve undefined),调用方保留旧结果
async function fetchDirectedFigure(key, chartObj, targetDate, targetTime, opts, silent){
	const def = DIRECTED_FIGURES[key];
	const data = await request(`${Constants.ServerRoot}${def.endpoint}`, {
		body: JSON.stringify({ ...chartParams(chartObj), targetDate, targetTime, ...directedFigureRequestFields(key, opts) }),
		timeoutMs: 45000,
		...(silent ? { silent: true } : null),
	});
	return data ? (unwrapResult(data) || {}) : null;
}

function snapshotText(key, chartObj, result){
	const body = buildDirectedFigureText(key, result);
	if(!body){ return ''; }
	const lines = [];
	lines.push(...safeHelperLines(astroAiSnapshot.buildPredictiveBirthHeaderLines, chartObj));
	lines.push(body);
	lines.push('');
	lines.push(...safeHelperLines(astroAiSnapshot.buildCurrentMomentLines, chartObj));
	lines.push(...safeHelperLines(astroAiSnapshot.buildMethodNoteLines, key));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

// AI 快照(无头):挂载重算 / 导出用。opts = 挂载齿轮设置(缺省 = 页面保存值);targetDate / targetTime 缺省 = 本盘时区今日 12:00。
export async function buildDirectedFigureSnapshotText(key, chartObj, opts){
	if(!chartObj || !DIRECTED_FIGURES[key]){ return ''; }
	const o = opts && typeof opts === 'object' ? opts : {};
	const base = directedFigureOptsFromSettings(key);
	const merged = { ...base };
	Object.keys(o).forEach((k)=>{ if(o[k] !== undefined && o[k] !== null && o[k] !== ''){ merged[k] = o[k]; } });
	const targetDate = `${o.targetDate || ''}`.trim() || today(chartZone(chartObj));
	const targetTime = `${o.targetTime || ''}`.trim() || '12:00:00';
	try{
		const result = await fetchDirectedFigure(key, chartObj, targetDate, targetTime, merged);
		return snapshotText(key, chartObj, result);
	}catch(e){
		return '';
	}
}

const sm = (id, on)=>symbolWithMeaning(id, on);
// 字形放进同一个定宽盒(没有字形的世俗福点 / 精神点放空盒),同一列名字左缘一定对齐
const glyphBox = (child)=>(<span style={{ display: 'inline-block', width: 16, textAlign: 'center', whiteSpace: 'nowrap' }}>{child}</span>);
const GLYPH_PAD = glyphBox(null);
const pointCell = (id, on)=>(['Tyche', 'Daimon'].indexOf(id) >= 0
	? <span style={{ whiteSpace: 'nowrap' }}>{GLYPH_PAD} {pointName(id)}</span>
	: <span style={{ whiteSpace: 'nowrap' }}>{glyphBox(sm(id, on))} {pointName(id)}</span>);
const HL = { background: 'var(--horosa-accent-soft, rgba(215,173,105,.14))' };
const OPENED = { background: 'var(--horosa-panel-soft)' };
const signedN = (v, d)=>{ const n = Number(v); return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(d)}` : '-'; };
// 空表卡不撑最小高(只剩一行说明时别留一块空)
const NO_MIN = { minHeight: 0 };
const emptyNote = (text)=>(<div style={{ ...MUTED, fontSize: 12, padding: '6px 4px' }}>{text}</div>);
const nowrap = (child)=>(<span style={{ whiteSpace: 'nowrap' }}>{child}</span>);
// 只取日期部分(按空格切,公元前「-0500-…」也对)
const dateOnly = (v)=>`${v || '-'}`.trim().split(/[ T]/)[0];
// 卡内滚动的表:高亮行只在它换了的那一次滚到可见处,之后不跟用户的手动滚动打架
function scrollRowIntoBoxOnce(holder, slot, rowId, node){
	if(!node || !holder){ return; }
	holder._rowScrolled = holder._rowScrolled || {};
	if(holder._rowScrolled[slot] === rowId){ return; }
	const box = node.closest('.horosa-small-table-scroll');
	if(!box || !box.clientHeight){ return; }
	holder._rowScrolled[slot] = rowId;
	const table = node.closest('table');
	const head = table && table.tHead ? table.tHead.offsetHeight : 0;      // 表头吸顶,行顶要留出表头
	// 矩形是整页缩放后的尺寸,scrollTop / clientHeight 是缩放前的:先折回同一单位
	const boxRect = box.getBoundingClientRect();
	const delta = (node.getBoundingClientRect().top - boxRect.top) * pointerLocalRatio(box, boxRect).ky;
	if(delta < head + 8 || delta > box.clientHeight - 40){ box.scrollTop = Math.max(box.scrollTop + delta - Math.max(head, box.clientHeight / 3), 0); }
}

class DirectedFigurePage extends Component{
	constructor(props, key){
		super(props);
		this.key = key;
		this.state = { targetDate: today(chartZone(props.value)), targetTime: '12:00:00', loading: false, loadFailed: false, result: null, resultSig: '', requestKey: '', ...this.initialSettings() };
		this.load = this.load.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	initialSettings(){ return {}; }

	opts(){ return {}; }

	reqKey(){
		return chartRequestKey(this.props.value, `${this.key}|${this.state.targetDate}|${this.state.targetTime}|${JSON.stringify(directedFigureRequestFields(this.key, this.opts()))}`);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentWillUnmount(){
		this._mounted = false;
		clearTimeout(this._retryTimer);
		if(typeof window !== 'undefined'){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentDidUpdate(){
		const key = this.reqKey();
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	// 导出 = 页面所见:按页面当前目标时刻与设置重出一份
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== this.key || !this.props.value){ return; }
		const result = this.shownResult();
		if(result && this.state.requestKey === this.reqKey()){
			const txt = snapshotText(this.key, this.props.value, result);
			if(txt){ evt.detail.snapshotText = txt; }
		}
	}

	saveSetting(field, value){
		DIRECTION_PAGE_SETTINGS.save({ [field]: value });
		this.setState({ [field]: value });   // componentDidUpdate 见请求键变了即重取
	}

	// 失败后过了停车窗口自己再试一次(否则要等用户碰一下页面才会重取)
	scheduleRetry(){
		clearTimeout(this._retryTimer);
		this._retryTimer = setTimeout(()=>{ if(this._mounted){ this.forceUpdate(); } }, LOAD_RETRY_PARK_MS + 500);
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		if(!this.props.value){ return; }
		const resultSig = natalSourceKey(this.props.value);
		const key = this.reqKey();
		this.setState({ loading: true });
		try{
			const result = await fetchDirectedFigure(this.key, this.props.value, this.state.targetDate, this.state.targetTime, this.opts(), silentTechniquePanelsEnabled());
			if(!this._mounted || seq !== this._loadSeq){ return; }
			if(!result){
				// 网络层 / 接口失败:旧结果原样留着,窗口期后自动重试
				parkLoadFailure(this, key);
				this.setState({ loading: false, loadFailed: true });
				this.scheduleRetry();
				return;
			}
			clearLoadFailure(this);
			this.setState({ result, resultSig, loading: false, loadFailed: false, requestKey: key });
			const txt = snapshotText(this.key, this.props.value, result);
			if(txt){ saveModuleAISnapshot(this.key, txt, { tab: this.key }); }
		}catch(e){
			parkLoadFailure(this, key);
			if(!this._mounted || seq !== this._loadSeq){ return; }
			this.setState({ loading: false, loadFailed: true });
			this.scheduleRetry();
		}
	}

	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	// ---- 右栏上半 ----
	subtitle(){ return ''; }

	description(){ return ''; }

	hasTime(){ return true; }

	controls(){ return []; }

	renderSideHead(){
		const def = DIRECTED_FIGURES[this.key];
		const sub = this.subtitle();
		return (
			<SidePanelHead title={def.label} sub={[def.author, sub].filter(Boolean).join(' · ')} desc={this.description()}>
				{this.hasTime() ? (
					<SideSection title="时间选择" extra={chartZone(this.props.value) ? `本盘时区 ${chartZone(this.props.value)}` : null}>
						<TargetTimeControl date={this.state.targetDate} time={this.state.targetTime} zone={chartZone(this.props.value)}
							onChange={(targetDate, targetTime)=>this.setState({ targetDate, targetTime })} />
					</SideSection>
				) : null}
				<SideSection title={`${def.label}设置`}>
					<ControlGrid>{this.controls()}</ControlGrid>
				</SideSection>
			</SidePanelHead>
		);
	}

	// ---- 右栏表格 ----
	renderTables(){ return null; }

	// ---- 左盘 ----
	renderWheel(result, size, h){
		const dir = result && result.chart;
		const natal = this.props.value;
		if(!natal || !dir){ return <EmptyWheel text="起盘后显示本命 / 推运双盘" />; }
		return (
			<AstroDoubleChart
				value={{ natualChart: natal, dirChart: { ...dir, natalChart: natal }, inverse: false }}
				width={size}
				height={h}
				planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay}
				chartDisplay={this.props.chartDisplay}
				showAstroMeaning={this.props.showAstroMeaning}
			/>
		);
	}

	render(){
		const shown = this.shownResult();
		const r = shown || {};
		const has = !!shown;
		const height = this.props.height ? this.props.height - 10 : 700;
		const failed = this.state.loadFailed && !has;
		return (
			<Spin spinning={this.state.loading && !has}>
				<ProgPageShell height={height} updating={this.state.loading && has}>
					<WheelSplit head={this.renderSideHead()} renderWheel={(size, h)=>(failed ? <LoadFailNote /> : this.renderWheel(has ? r : null, size, h))}>
						{has ? this.renderTables(r) : null}
					</WheelSplit>
				</ProgPageShell>
			</Spin>
		);
	}
}

// ---------------------------------------------------------------------------
// 演进推运(Néroman)
// ---------------------------------------------------------------------------
export class AstroNeroman extends DirectedFigurePage{
	constructor(props){ super(props, 'neroman'); }

	initialSettings(){
		const s = DIRECTION_PAGE_SETTINGS.load();
		return { nerK: s.nerK, nerT0: s.nerT0, nerKeepDec: s.nerKeepDec, nerOrb: s.nerOrb };
	}

	opts(){ return { k: this.state.nerK, t0: this.state.nerT0, keepDec: this.state.nerKeepDec, orb: this.state.nerOrb }; }

	subtitle(){
		const r = this.shownResult();
		if(!r || !Number.isFinite(Number(r.arc))){ return '对数时标演进'; }
		const arc = Number(r.arc);
		const turns = arc >= 360 ? `(${Math.floor(arc / 360)} 周余 ${fmtN(arc % 360, 2)}°)` : '';
		return `${fmtN(r.age, 2)} 岁 · 演进弧 ${fmtN(arc, 2)}°${turns}`;
	}

	description(){
		return '弧 = K × ln(1 + 年龄 ⁄ t0),年龄按回归年计,出生时每年约走 364°、越往后越慢;全部点的赤经逆行减去这段弧再换回黄道。演进天顶称 Fatum、演进上升称 Sensitif,弧每满 360° 天顶重返本位一次。';
	}

	controls(){
		return [
			<ControlCol key="k" label="弧常数 K">
				<XQInputNumber style={{ width: '100%' }} min={1} max={5000} step={0.01} value={this.state.nerK}
					onChange={(v)=>{ if(Number.isFinite(v) && v > 0){ this.saveSetting('nerK', v); } }} />
			</ControlCol>,
			<ControlCol key="t0" label="出生前年数 t0">
				<XQInputNumber style={{ width: '100%' }} min={0.01} max={10} step={0.01} value={this.state.nerT0}
					onChange={(v)=>{ if(Number.isFinite(v) && v > 0){ this.saveSetting('nerT0', v); } }} />
			</ControlCol>,
			<ControlCol key="dec" label="换到赤道">
				<Select style={{ width: '100%' }} value={this.state.nerKeepDec} onChange={(v)=>this.saveSetting('nerKeepDec', v)}>
					{NEROMAN_EQUATOR_OPTIONS.map((o)=>(<Option key={`${o.value}`} value={o.value}>{o.label}</Option>))}
				</Select>
			</ControlCol>,
			<ControlCol key="orb" label="相位容许度">
				<Select style={{ width: '100%' }} value={this.state.nerOrb} onChange={(v)=>this.saveSetting('nerOrb', v)}>
					{[0.5, 1, 2, 3].map((v)=>(<Option key={v} value={v}>{`${v}°`}</Option>))}
				</Select>
			</ControlCol>,
		];
	}

	renderTables(r){
		const on = this.props.showAstroMeaning;
		const events = (r.events || []).filter((e)=>Math.abs(e.age - r.age) <= 10);
		const next = events.find((e)=>e.age >= r.age);
		// 演进对本命相位并进位置表(每个演进点一格),少一张卡、主表(天顶 / 上升过本命点)拿到更多高度
		const byMover = {};
		(r.contacts || []).forEach((c)=>{ (byMover[c.evolved] = byMover[c.evolved] || []).push(c); });
		const aspCell = (id)=>{
			const cs = byMover[id] || [];
			if(!cs.length){ return <span style={MUTED}>—</span>; }
			return (
				<span style={{ display: 'inline-flex', flexWrap: 'wrap', columnGap: 10, rowGap: 2 }}>
					{cs.map((c, k)=>(
						<span key={k} style={{ whiteSpace: 'nowrap' }}>
							{ZODIAC_ASPECT_LABELS[c.asp] || `${c.asp}°`} {glyphBox(sm(c.natal, on))}<span style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>{signedN(c.orb, 2)}</span>
						</span>
					))}
				</span>
			);
		};
		return [
			<FillCard key="pos" title="演进位置" extra={`对本命相位 · 容许度 ${fmtN(r.orb, 1)}°`}>
				<SmallTable rows={r.evolved || []} fill scrollClassName={styles.scrollbar} columns={[
					{ key: 'id', title: '点', width: '22%', render: (v)=>pointCell(v, on) },
					{ key: 'natalLon', title: '本命', width: '22%', render: (v)=>nowrap(fmtLon(v)) },
					{ key: 'lon', title: '演进', width: '22%', render: (v)=>nowrap(fmtLon(v)) },
					{ key: 'asp', title: '对本命相位', render: (_v, row)=>aspCell(row.id) },
				]} />
			</FillCard>,
			<FillCard key="ev" grow style={events.length ? undefined : NO_MIN} title="天顶 / 上升过本命点" extra="当前前后十年 · 只列合 / 刑 / 冲" note="底色行 = 下一次。">
				{events.length ? (
					<SmallTable rows={events} fill scrollClassName={styles.scrollbar}
						rowStyle={(e)=>(e === next ? HL : undefined)}
						rowRef={(node, e)=>{ if(e === next){ scrollRowIntoBoxOnce(this, 'events', `${e.age}`, node); } }} columns={[
						{ key: 'age', title: '年龄', width: '15%', align: 'right', render: (v)=>fmtN(v, 2) },
						{ key: 'date', title: '日期', width: '24%', render: (v)=>nowrap(dateOnly(v)) },
						{ key: 'mover', title: '演进点', width: '23%', render: (v)=>pointCell(v, on) },
						{ key: 'asp', title: '相位', width: '12%', render: (v)=>ZODIAC_ASPECT_LABELS[v] || `${v}°` },
						{ key: 'target', title: '本命点', render: (v)=>pointCell(v, on) },
					]} />
				) : emptyNote('前后十年内天顶 / 上升不过任何本命点')}
			</FillCard>,
		];
	}
}

// ---------------------------------------------------------------------------
// 推运图(Bezza)
// ---------------------------------------------------------------------------
const hp = (v)=>fmtN(v, 2);

export class AstroBezzaFigure extends DirectedFigurePage{
	constructor(props){ super(props, 'bezzafigure'); }

	initialSettings(){ return { bezzaOrb: DIRECTION_PAGE_SETTINGS.load().bezzaOrb }; }

	opts(){ return { orb: this.state.bezzaOrb }; }

	subtitle(){
		const r = this.shownResult();
		if(!r || !Number.isFinite(Number(r.arc))){ return '真太阳弧下的世俗推进'; }
		return `${fmtN(r.age, 2)} 岁 · 推运弧 ${fmtN(r.arc, 3)}°`;
	}

	description(){
		return '推运弧 = 真太阳弧(赤经)。整张盘随周日运动推进:每点按自身半弧走,地平上用昼半弧、地平下用夜半弧;时位以「时」计,天顶 0、下降 6、天底 12、上升 18,每时 = 所在半弧的六分之一。福点 / 精神点取在世俗时位上,推进时每时 15°。';
	}

	controls(){
		return [
			<ControlCol key="orb" label="接触窗(当前弧 ±)">
				<Select style={{ width: '100%' }} value={this.state.bezzaOrb} onChange={(v)=>this.saveSetting('bezzaOrb', v)}>
					{[0.5, 1, 2, 3, 5].map((v)=>(<Option key={v} value={v}>{`${v}°`}</Option>))}
				</Select>
			</ControlCol>,
		];
	}

	renderTables(r){
		const on = this.props.showAstroMeaning;
		const cs = r.contacts || [];
		let nearest = null;
		cs.forEach((c)=>{ if(!nearest || Math.abs(c.d) < Math.abs(nearest.d)){ nearest = c; } });
		const aspLabel = (c)=>(c.kind === 'mun' ? (BEZZA_MUNDANE_ASPECTS[c.asp] || `${c.asp} 时`) : (c.kind === 'zod' ? (ZODIAC_ASPECT_LABELS[c.asp] || `${c.asp}°`) : '映点'));
		return [
			<FillCard key="pos" title="推运位置" extra="时位:天顶 0 · 下降 6 · 天底 12 · 上升 18">
				<SmallTable rows={r.points || []} fill scrollClassName={styles.scrollbar} columns={[
					{ key: 'id', title: '点', width: '27%', render: (v)=>pointCell(v, on) },
					{ key: 'hp0', title: '本命时位', width: '18%', align: 'right', render: (v)=>hp(v) },
					{ key: 'hp1', title: '推运时位', width: '18%', align: 'right', render: (v)=>hp(v) },
					{ key: 'dp', title: '推运黄经', render: (v)=>nowrap(fmtLon(v)) },
				]} />
			</FillCard>,
			<FillCard key="ct" grow style={cs.length ? undefined : NO_MIN} title="接触" extra={`当前弧 ±${fmtN(r.orb, 1)}°`} note="底色行 = 离当前最近的一次;距当前为负 = 已过。">
				{cs.length ? (
					<SmallTable rows={cs} fill scrollClassName={styles.scrollbar}
						rowStyle={(c)=>(c === nearest ? HL : undefined)}
						rowRef={(node, c)=>{ if(c === nearest){ scrollRowIntoBoxOnce(this, 'contacts', `${c.kind}${c.pid}${c.prm}${c.asp}${c.arc}`, node); } }} columns={[
						{ key: 'pid', title: '接触', render: (v, c)=>(
							<div style={{ whiteSpace: 'nowrap' }}>
								{pointCell(v, on)}<span style={{ margin: '0 6px' }}>{aspLabel(c)}</span>{pointCell(c.prm, on)}
								<div style={{ ...MUTED, fontSize: 11, marginTop: 1, paddingLeft: 20 }}>{BEZZA_KIND_LABELS[c.kind] || c.kind}</div>
							</div>
						) },
						{ key: 'd', title: '距当前', width: '17%', align: 'right', render: (v)=>signedN(v, 3) },
						{ key: 'date', title: '应期', width: '30%', render: (v, c)=>(
							<div style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
								{dateOnly(v)}
								<div style={{ ...MUTED, fontSize: 11, marginTop: 1 }}>{fmtN(c.age, 2)} 岁</div>
							</div>
						) },
					]} />
				) : emptyNote(`当前弧 ±${fmtN(r.orb, 1)}° 内无接触`)}
			</FillCard>,
		];
	}
}

// ---------------------------------------------------------------------------
// 周日小限(Jay)
// ---------------------------------------------------------------------------
const JAY_COLS = ['Asc', 'MC', 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Tyche'];

export class AstroJayProfection extends DirectedFigurePage{
	constructor(props){ super(props, 'jayprofection'); }

	initialSettings(){ return { jayFrom: DIRECTION_PAGE_SETTINGS.load().jayFrom }; }

	opts(){ return { from: this.state.jayFrom }; }

	subtitle(){
		const r = this.shownResult();
		if(!r || !r.current){ return '赤经中天每年 +30°'; }
		return `${fmtN(r.age, 2)} 岁 · 小限上升落本命第 ${r.current.house || '-'} 宫`;
	}

	description(){
		return '天球按周日运动每年转一宫(赤经中天 +30°,十二年一周),上升 / 天顶取转动后的轴;诸星保持本命的 Placidus 世俗位置随天球转动,取同一世俗位置上的黄道点;福点按世俗时位取。落宫按本盘宫制。';
	}

	controls(){
		return [
			<ControlCol key="from" label="逐年表起始">
				<Select style={{ width: '100%' }} value={this.state.jayFrom} onChange={(v)=>this.saveSetting('jayFrom', v)}>
					<Option value={-1}>当前所在的一轮</Option>
					{Array.from({ length: 11 }, (_x, i)=>i * 12).map((v)=>(<Option key={v} value={v}>{`${v} 岁起`}</Option>))}
				</Select>
			</ControlCol>,
		];
	}

	// 点逐年表的一行 = 把目标时刻挪到那一年的周年(盘、当前小限表一起换)
	jumpToYear(row){
		const d = dateOnly(row && row.date);
		if(/^-?\d{1,4}-\d{2}-\d{2}$/.test(d)){ this.setState({ targetDate: d }); }
	}

	renderTables(r){
		const on = this.props.showAstroMeaning;
		const c = r.current || {};
		const cur = Math.floor(Math.max(Number(r.age) || 0, 0));
		return [
			<FillCard key="cur" title="当前小限" extra={`落本命第 ${c.house || '-'} 宫`}>
				<SmallTable fill scrollClassName={styles.scrollbar} rows={JAY_COLS.map((k)=>({ id: k, natal: (r.natal || {})[k], lon: c[k] }))} columns={[
					{ key: 'id', title: '点', width: '34%', render: (v)=>(v === 'Tyche' ? nowrap(<React.Fragment>{GLYPH_PAD} 福点</React.Fragment>) : pointCell(v, on)) },
					{ key: 'natal', title: '本命', width: '33%', render: (v)=>nowrap(fmtLon(v)) },
					{ key: 'lon', title: '小限', render: (v)=>nowrap(fmtLon(v)) },
				]} />
			</FillCard>,
			<FillCard key="yr" grow title="逐年小限" extra={`${r.from} – ${r.from + 11} 岁 · 点一行跳到那一年`} note="底色行 = 当前所在的一年;日期为该周年(出生 + 整回归年)。">
				<SmallTable rows={r.rows || []} fill scrollClassName={styles.scrollbar}
					rowStyle={(row)=>(Math.round(row.age) === cur ? HL : undefined)}
					onRowClick={(row)=>this.jumpToYear(row)} columns={[
					{ key: 'age', title: '年龄', width: '12%', align: 'right', render: (v)=>fmtN(v, 0) },
					{ key: 'date', title: '日期', width: '24%', render: (v)=>nowrap(dateOnly(v)) },
					{ key: 'house', title: '落宫', width: '12%', align: 'right' },
					{ key: 'Asc', title: '上升', width: '26%', render: (v)=>nowrap(fmtLon(v)) },
					{ key: 'MC', title: '天顶', render: (v)=>nowrap(fmtLon(v)) },
				]} />
			</FillCard>,
		];
	}
}

// ---------------------------------------------------------------------------
// 双黄道(Michon)
// ---------------------------------------------------------------------------
const signLabel = (i)=>{ const s = AstroConst.LIST_SIGNS[i]; return AstroText.AstroTxtMsg[s] || s; };
// 表里用短名(右栏窄),悬停看全名(几谐、多少度的倍数)
const MICHON_FAMILY_SHORT = { en: '12 谐', re: '18 谐', ta: '20 谐', mi: '14 谐', bl: '24 谐奇' };
const famCell = (f)=>(f && f !== 'no'
	? <span title={MICHON_FAMILY_LABELS[f] || f} style={{ color: 'var(--horosa-accent-strong)', whiteSpace: 'nowrap', fontWeight: 600 }}>{MICHON_FAMILY_SHORT[f] || MICHON_FAMILY_LABELS[f] || f}</span>
	: <span style={MUTED}>无</span>);

export class AstroMichon extends DirectedFigurePage{
	constructor(props){ super(props, 'michon'); }

	initialSettings(){
		const s = DIRECTION_PAGE_SETTINGS.load();
		return { michonOrb: s.michonOrb, michonSwap: s.michonSwap, michonEqual: s.michonEqual, michonAll: !!s.michonAll };
	}

	opts(){ return { orb: this.state.michonOrb, swap: this.state.michonSwap, equal: this.state.michonEqual }; }

	hasTime(){ return false; }

	subtitle(){
		const r = this.shownResult();
		if(!r || !Number.isFinite(Number(r.ayanamsa))){ return '回归 / 恒星黄道叠合'; }
		const lit = (r.superpositions || []).filter((s)=>s.family && s.family !== 'no').length;
		return `岁差 ${fmtN(r.ayanamsa, 3)}° · 有族叠合 ${lit} / 12`;
	}

	description(){
		return '回归第 k 座叠恒星第 k − 1 座(回归白羊 ↔ 恒星双鱼 …);每个叠合取两座的现代守护星,看两星本命距角落在哪一谐波族:12 谐(30° 倍数)、18 谐(20°)、20 谐(18°)、14 谐(360° ⁄ 14)、24 谐奇族(15° 奇数倍)。互动 = 两个叠合之间回归守护对与恒星守护对各自的族。';
	}

	controls(){
		return [
			<ControlCol key="orb" label="容许度">
				<Select style={{ width: '100%' }} value={this.state.michonOrb} onChange={(v)=>this.saveSetting('michonOrb', v)}>
					{[0.5, 1, 1.5, 2].map((v)=>(<Option key={v} value={v}>{`${v}°`}</Option>))}
				</Select>
			</ControlCol>,
			<ControlCol key="swap" label="守护">
				<Select style={{ width: '100%' }} value={this.state.michonSwap} onChange={(v)=>this.saveSetting('michonSwap', v)}>
					<Option value={false}>现代守护</Option>
					<Option value={true}>水金互换</Option>
				</Select>
			</ControlCol>,
			<ControlCol key="eq" label="宫位">
				<Select style={{ width: '100%' }} value={this.state.michonEqual} onChange={(v)=>this.saveSetting('michonEqual', v)}>
					<Option value={false}>本盘宫制</Option>
					<Option value={true}>等宫(上升居一宫正中)</Option>
				</Select>
			</ControlCol>,
			<ControlCol key="all" label="互动表">
				<Select style={{ width: '100%' }} value={this.state.michonAll} onChange={(v)=>this.saveSetting('michonAll', v)}>
					<Option value={false}>只看有族</Option>
					<Option value={true}>全部 66 组</Option>
				</Select>
			</ControlCol>,
		];
	}

	renderWheel(result, size, h){
		if(!result || !Array.isArray(result.superpositions)){ return <EmptyWheel text="起盘后显示回归 / 恒星双黄道" />; }
		return <MichonDualRing result={result} size={size} height={h} />;
	}

	renderTables(r){
		const on = this.props.showAstroMeaning;
		const inters = (r.interactions || []).filter((i)=>this.state.michonAll || i.tropicalFamily !== 'no' || i.siderealFamily !== 'no');
		const pair = (ids)=>(<span style={{ whiteSpace: 'nowrap' }}>{sm(ids[0], on)} {pointName(ids[0])} — {sm(ids[1], on)} {pointName(ids[1])}</span>);
		const pairSep = (ids, sep)=>(<span style={{ whiteSpace: 'nowrap' }}>{pair(ids)}<span style={{ ...MUTED, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>{fmtN(sep, 1)}°</span></span>);
		return [
			<FillCard key="s" title="叠合" extra="左图外圈回归、内圈恒星;两圈间金段 = 有族叠合,金弦连它的两颗守护星 · 宫 = 两座起点所在本命宫 · 族名悬停看全称">
				<SmallTable rows={r.superpositions || []} fill scrollClassName={styles.scrollbar} rowStyle={(s)=>(s.family && s.family !== 'no' ? HL : undefined)} columns={[
					{ key: 'n', title: '序', width: '8%', align: 'right' },
					{ key: 'tropicalSign', title: '叠合', width: '22%', render: (v, s)=>nowrap(`${signLabel(v)} / ${signLabel(s.siderealSign)}`) },
					{ key: 'house0', title: '宫', width: '12%', render: (v, s)=>nowrap(`${v} / ${s.house1}`) },
					{ key: 'p1', title: '两守护星', width: '28%', render: (_v, s)=>pair([s.p1, s.p2]) },
					{ key: 'sep', title: '距角', width: '12%', align: 'right', render: (v)=>`${fmtN(v, 1)}°` },
					{ key: 'family', title: '族 · 偏差', render: (v, s)=>(v && v !== 'no' ? <span style={{ whiteSpace: 'nowrap' }}>{famCell(v)}<span style={{ ...MUTED, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>{signedN(s.dev, 2)}</span></span> : famCell(v)) },
				]} />
			</FillCard>,
			<FillCard key="i" grow style={inters.length ? undefined : NO_MIN} title="互动" extra={`${inters.length} / 66 组`}>
				{inters.length ? (
					<SmallTable rows={inters} fill scrollClassName={styles.scrollbar} columns={[
						{ key: 'a', title: '叠合对', width: '12%', align: 'right', render: (v, i)=>nowrap(`${v} · ${i.b}`) },
						{ key: 'tropical', title: '回归守护 · 族', width: '44%', render: (v, i)=>(
							<div>{pairSep(v, i.tropicalSep)}<div>{famCell(i.tropicalFamily)}</div></div>
						) },
						{ key: 'sidereal', title: '恒星守护 · 族', render: (v, i)=>(
							<div>{pairSep(v, i.siderealSep)}<div>{famCell(i.siderealFamily)}</div></div>
						) },
					]} />
				) : emptyNote('没有任何一组互动落在族内')}
			</FillCard>,
		];
	}
}

// ---------------------------------------------------------------------------
// 时主轮转:十二法共用一页,左边本命盘,右上选方法与该法的选项,右下期表或事件表
// ---------------------------------------------------------------------------
const TL_KEY_ROWS = [['tlMethod', 'method'], ['tlYearType', 'yearType'], ['tlMovingYear', 'movingYear'], ['tlTurnStart', 'turnStart'], ['tlTurnOrder', 'turnOrder'],
	['tlOrbMode', 'orbMode'], ['tlAnnualDays', 'annualDays'], ['tlAnnualOrder', 'annualOrder'], ['tlReleaser', 'releaser'], ['tlVariant', 'variant'], ['tlNineTime', 'nineTime'],
	['tlNineReverse', 'nineReverse'], ['tlRateKind', 'rateKind'], ['tlMovingStart', 'movingStart'], ['tlDevBasis', 'devBasis'], ['tlDiurnalMode', 'diurnalMode']];
const TL_STATE_KEYS = {};
TL_KEY_ROWS.forEach(([field, key])=>{ TL_STATE_KEYS[key] = field; });
const fmtAge = (v)=>`${fmtN(v, 2)} 岁`;

export class AstroTimeLords extends DirectedFigurePage{
	constructor(props){ super(props, 'timelords'); }

	initialSettings(){
		const s = DIRECTION_PAGE_SETTINGS.load();
		const out = { tlOpenRow: -1, tlMoonRow: -1, tlMoonChart: null, tlMoonSig: '' };
		Object.keys(TL_STATE_KEYS).forEach((key)=>{ out[TL_STATE_KEYS[key]] = s[TL_STATE_KEYS[key]]; });
		return out;
	}

	opts(){
		const out = {};
		Object.keys(TL_STATE_KEYS).forEach((key)=>{ out[key] = this.state[TL_STATE_KEYS[key]]; });
		return normalizeTimeLordOpts(out);
	}

	subtitle(){
		const r = this.shownResult();
		return r && r.startLord ? `起始星 ${timeLordPointName(r.startLord)}` : '';
	}

	// 换盘清掉所有查看位置;改目标时刻回到当前段,页面与快照才是同一段
	componentDidUpdate(prevProps, prevState){
		super.componentDidUpdate(prevProps, prevState);
		const { tlOpenRow, tlMoonRow } = this.state;
		if(chartRequestKey(prevProps.value) !== chartRequestKey(this.props.value)){
			this._moonSeq = (this._moonSeq || 0) + 1;
			if(tlOpenRow !== -1 || tlMoonRow !== -1){ this.setState({ tlOpenRow: -1, tlMoonRow: -1, tlMoonChart: null }); }
		}else if(tlOpenRow !== -1 && (prevState.targetDate !== this.state.targetDate || prevState.targetTime !== this.state.targetTime)){
			this.setState({ tlOpenRow: -1 });
		}
	}

	hasTime(){ return this.opts().method !== 'moondays'; }

	description(){
		const r = this.shownResult();
		const note = timeLordMethod(this.opts().method).note;
		return r && r.polar ? `${note}。${TIMELORD_POLAR_NOTE}` : note;
	}

	controls(){
		const o = this.opts();
		const spec = TIMELORD_METHOD_FIELDS[o.method];
		const onChoose = (key, v)=>{ this.setState({ tlOpenRow: -1, tlMoonRow: -1, tlMoonChart: null }); this.saveSetting(TL_STATE_KEYS[key], v); };
		const select = (key, list)=>(
			<ControlCol key={key} label={TIMELORD_FIELD_LABELS[key] || '方法'}>
				<Select style={{ width: '100%' }} value={o[key]} onChange={(v)=>onChoose(key, v)}>
					{list.map((item)=>(<Option key={`${item.value}`} value={item.value}>{item.label}</Option>))}
				</Select>
			</ControlCol>
		);
		const out = [select('method', TIMELORD_METHODS)];
		if(spec.yearField){ out.push(select(spec.yearField, TIMELORD_OPTIONS.yearType)); }
		timeLordFields(o).forEach((key)=>out.push(select(key, TIMELORD_OPTIONS[key])));
		return out;
	}

	// 月亮日:点一行左边换成该时刻的盘,再点一次回本命盘
	async toggleMoonChart(index, row){
		this._moonSeq = (this._moonSeq || 0) + 1;
		const seq = this._moonSeq;
		if(this.state.tlMoonRow === index){
			this.setState({ tlMoonRow: -1, tlMoonChart: null });
			return;
		}
		const [date, time] = `${row.date}`.trim().split(' ');
		this.setState({ tlMoonRow: index, tlMoonChart: null, tlMoonSig: natalSourceKey(this.props.value) });
		let chart = null;
		try{
			chart = unwrapResult(await fetchChart({ ...chartParams(this.props.value), date, time })) || null;
		}catch(e){ chart = null; }
		if(!this._mounted || seq !== this._moonSeq){ return; }
		this.setState(chart ? { tlMoonChart: chart } : { tlMoonRow: -1, tlMoonChart: null });
	}

	renderWheel(result, size, h){
		if(!this.props.value){ return <EmptyWheel text="起盘后显示本命盘" />; }
		const moonChart = this.state.tlMoonRow >= 0 && this.opts().method === 'moondays' ? pickKeyedDerived(this.state.tlMoonChart, this.state.tlMoonSig, natalSourceKey(this.props.value)) : null;
		return (
			<AstroChart wheelArt={this.props.wheelArt} value={moonChart || this.props.value} chartDisplay={this.props.chartDisplay} planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay} showAstroMeaning={this.props.showAstroMeaning} height={h} />
		);
	}

	renderPeriods(r){
		const current = Number.isInteger(r.currentIndex) ? r.currentIndex : -1;
		const open = r.rows[this.state.tlOpenRow] ? this.state.tlOpenRow : current;
		const row = r.rows[open];
		const subs = (row && row.children) || [];
		const cards = [
			<FillCard key="p" grow title="期表" extra={`共 ${r.rows.length} 段${subs.length ? ' · 点一行看子段' : ''}`}>
				<SmallTable rows={r.rows} fill scrollClassName={styles.scrollbar} rowStyle={(item, i)=>{ if(i === current){ return HL; } return i === open ? OPENED : undefined; }}
					rowRef={(node, item, i)=>{ if(i === current){ scrollRowIntoBoxOnce(this, 'tl', `${r.method}-${i}`, node); } }}
					onRowClick={r.rows[0] && r.rows[0].children ? (item, i)=>this.setState({ tlOpenRow: i }) : undefined} columns={[
						{ key: 'lord', title: '主', render: (v, item)=>nowrap(timeLordRowLord(item)) },
						{ key: 'startAge', title: '起', align: 'right', render: fmtAge },
						{ key: 'start', title: '起始日', render: dateOnly },
						{ key: 'end', title: '结束日', render: dateOnly },
					]} />
			</FillCard>,
		];
		if(subs.length){
			cards.push(
				<FillCard key="c" title="子段" extra={`${timeLordRowLord(row)} · ${dateOnly(row.start)} 起`}>
					<SmallTable rows={subs} fill scrollClassName={styles.scrollbar} columns={[
						{ key: 'lord', title: '主', render: (v, item)=>nowrap(timeLordRowLord(item)) },
						{ key: 'start', title: '起始日', render: dateOnly },
						{ key: 'end', title: '结束日', render: dateOnly },
					]} />
				</FillCard>,
			);
		}
		return cards;
	}

	renderEvents(r){
		const moonDays = r.method === 'moondays';
		// 月亮日不看目标时刻(页上也不显示时间选择),不做「下一件」高亮;只有三行,表不铺满整栏
		const next = !moonDays && Number.isInteger(r.currentIndex) ? r.currentIndex : -1;
		return [
			<FillCard key="e" grow={!moonDays} title={moonDays ? '月亮日' : '事件'} extra={`共 ${r.rows.length} 件${moonDays ? ' · 点一行看该时刻的盘' : ''}`}>
				<SmallTable rows={r.rows} fill={!moonDays} scrollClassName={styles.scrollbar}
					rowStyle={(item, i)=>{ if(i === next){ return HL; } return moonDays && i === this.state.tlMoonRow ? OPENED : undefined; }}
					onRowClick={moonDays ? (item, i)=>this.toggleMoonChart(i, item) : undefined}
					rowRef={(node, item, i)=>{ if(i === next){ scrollRowIntoBoxOnce(this, 'tl', `${r.method}-${i}`, node); } }} columns={moonDays ? [
						{ key: 'day', title: '第几日', align: 'right' },
						{ key: 'at', title: '月亮到', render: (v)=>fmtLon(v) },
						{ key: 'afterDays', title: '生后天数', align: 'right', render: (v)=>fmtN(v, 2) },
						{ key: 'date', title: '时刻' },
					] : [
						{ key: 'age', title: '年龄', align: 'right', render: fmtAge },
						{ key: 'date', title: '日期', render: dateOnly },
						{ key: 'point', title: '点', render: (v, item)=>nowrap(`${timeLordPointName(v)}${timeLordAspectText(item) ? ` ${timeLordAspectText(item)}` : ''}`) },
						{ key: 'at', title: '位置', render: (v)=>fmtLon(v) },
					]} />
			</FillCard>,
		];
	}

	renderTables(r){
		if(!Array.isArray(r.rows)){ return null; }
		return r.kind === 'periods' ? this.renderPeriods(r) : this.renderEvents(r);
	}
}
