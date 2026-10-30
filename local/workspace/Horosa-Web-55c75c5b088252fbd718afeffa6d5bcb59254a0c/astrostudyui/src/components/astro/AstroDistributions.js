// components/astro/AstroDistributions.js
// 界推运（Distributions）：发放点随周日运动顺黄道依次经过其后各界 → 分配星(界主)期 + 伙伴星期。后端 /predict/dist。
// 界表随「设置→星盘设置」的全局界系;发放点 / 时间算法 / 年长 / 年限四项口径见 utils/distributionsOptions(各处共用同一份)。
import { civilInstantMsOfStr } from '../../utils/dateStrSafe';
import { Component } from 'react';
import { Spin, Row, Col } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import { XQSelect as Select } from '../xq-ui';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import {
	DIST_RELEASERS, DIST_METHODS, DIST_YEARS, DIST_SPANS,
	normalizeDistSettings, distRequestParams, distSettingsLine, distReleaserLabel, partnerAspectText,
} from '../../utils/distributionsOptions';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明)。namespace import + typeof 守卫:
// 测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数时回 [] 保底。
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;
const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);

// AI 快照用中文名(astroSymbol 的字形在纯文本里不可读)。
function distName(id){
	if(id === undefined || id === null || id === ''){ return '-'; }
	return AstroText.AstroTxtMsg[id] || `${id}`;
}
const fmtYears = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '-');
const partnerTxt = (p) => `${distName(p.planet)}${partnerAspectText(p.aspect, p.side)}`;

// 请求体 = 本盘排盘参数 + 与出厂值不同的界推运口径(出厂值不带,请求与旧版逐字节相同)
export function distributionsRequestBody(chartObj, opts){
	return { ...chartParams(chartObj), ...distRequestParams(opts) };
}

// 时刻落在哪一行:起止日期可解析且含该时刻才算(防日期格式变体误判)
function rowAt(rows, ms){
	return (rows || []).find((row)=>{
		const s = civilInstantMsOfStr(`${row.startDate || ''}`.replace(/\//g, '-'));
		const e = civilInstantMsOfStr(`${row.endDate || ''}`.replace(/\//g, '-'));
		return Number.isFinite(s) && Number.isFinite(e) && ms >= s && ms < e;
	});
}

// 界推运 AI 快照(无头):内部 fetch /predict/dist,与组件同口径。aiAnalysisContext 复算用。
export async function buildDistributionsSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	let r = {};
	try{
		// WP-C 极速化:无头快照复算也走 silent,不触发全局满屏 Spin 压暗(失败经外层 catch 回 '')。
		const data = await request(`${Constants.ServerRoot}/predict/dist`, {
			body: JSON.stringify(distributionsRequestBody(chartObj, opts)),
			timeoutMs: 60000,
			silent: silentTechniquePanelsEnabled(),
		});
		r = unwrapResult(data) || {};
	}catch(e){
		return '';
	}
	return buildDistributionsSnapshotFromResult(chartObj, r, opts);
}

// 由后端结果拼快照(页面已取到结果时直接用,不再请求)
export function buildDistributionsSnapshotFromResult(chartObj, r, opts){
	const rows = (r && r.dist) || [];
	if(!rows.length){ return ''; }  // 无界推运数据=该技法在本盘缺失,挂载显示「缺失」而非空表头。
	const partners = (r && r.distPartners) || [];
	const st = normalizeDistSettings({ ...(opts || {}), ...((r && r.distSettings) || {}) });
	const releaserLon = r && r.distSettings && Number.isFinite(Number(r.distSettings.releaserLon)) ? `（黄经 ${Number(r.distSettings.releaserLon).toFixed(2)}°）` : '';
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[界推运（分配法 / Distributions）]');
	lines.push(`发放点随周日运动顺黄道依次经过其后各界（界表用当前全局界系设置）。${distSettingsLine(st)}${releaserLon}。分配星 = 所在界的界主；伙伴星 = 发放点最近经过的行星本体或相位点（左右 60° / 90° / 120° 与 180°），各管到下一点为止。`);
	lines.push('');
	lines.push('| 分配星 | 界(座) | 起始岁 | 时长(年) | 起 | 止 | 期内伙伴星 |');
	lines.push('| --- | --- | --- | --- | --- | --- | --- |');
	rows.forEach((row)=>{
		const detail = Array.isArray(row.partnerDetail) && row.partnerDetail.length ? row.partnerDetail.map(partnerTxt).join('、')
			: ((row.participants && row.participants.length) ? row.participants.map(distName).join('、') : '—');
		lines.push(`| ${distName(row.distributor)} | ${distName(row.sign)} | ${fmtYears(row.startYears)} | ${fmtYears(row.years)} | ${row.startDate || '-'} | ${row.endDate || '-'} | ${detail} |`);
	});
	if(partners.length){
		lines.push('');
		lines.push('[伙伴星期]');
		lines.push('| 伙伴星 | 相位点 | 起始岁 | 时长(年) | 起 | 止 |');
		lines.push('| --- | --- | --- | --- | --- | --- |');
		partners.forEach((p)=>{
			lines.push(`| ${distName(p.planet)} | ${partnerAspectText(p.aspect, p.side)}（${Number(p.lon).toFixed(2)}°） | ${fmtYears(p.startYears)} | ${fmtYears(p.years)} | ${p.startDate || '-'} | ${p.endDate || '-'} |`);
		});
	}
	// [YB] 尾部 [当前时点]+[方法说明];定位行=今日所在分配期 / 伙伴期。
	const extraLines = [];
	const nowMs = Date.now();
	const curRow = rowAt(rows, nowMs);
	if(curRow){
		extraLines.push(`当前分配星：${distName(curRow.distributor)}（${distName(curRow.sign)} 界，${curRow.startDate || '-'} ~ ${curRow.endDate || '-'}）`);
	}
	const curP = rowAt(partners, nowMs);
	if(curP){
		extraLines.push(`当前伙伴星：${partnerTxt(curP)}（${curP.startDate || '-'} ~ ${curP.endDate || '-'}）`);
	}
	const tail = [...currentMomentLines(chartObj, extraLines), ...methodNoteLines('distributions')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}

const SETTING_KEYS = ['distReleaser', 'distMethod', 'distYear', 'distYears'];

class AstroDistributions extends Component {
	constructor(props){
		super(props);
		const sv = DIRECTION_PAGE_SETTINGS.load();   // 上次亲手设的四项口径
		this.state = {
			loading: false, result: null, requestKey: '',
			distReleaser: sv.distReleaser, distMethod: sv.distMethod, distYear: sv.distYear, distYears: sv.distYears,
		};
		this.load = this.load.bind(this);
		this.changeOpt = this.changeOpt.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	settings(){
		const o = {};
		SETTING_KEYS.forEach((k)=>{ o[k] = this.state[k]; });
		return normalizeDistSettings(o);
	}

	requestKeyOf(){
		const st = this.settings();
		return chartRequestKey(this.props.value, `dist|${SETTING_KEYS.map((k)=>st[k]).join('|')}`);
	}

	// AI导出:在界推运 tab 导出时响应刷新事件,把快照(内部 fetch /predict/dist 后)写回 detail.snapshotText,export 轮询读取。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'distributions' || !this.props.value){ return; }
		buildDistributionsSnapshotText(this.props.value, this.settings()).then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}

	componentDidUpdate(){
		const k = this.requestKeyOf();
		if(k && k !== this.state.requestKey && !this.state.loading && !loadParked(this, k)){ this.load(); }
	}

	ensureLoaded(){
		const k = this.requestKeyOf();
		if(k && k !== this.state.requestKey && !this.state.loading && !loadParked(this, k)){ setTimeout(this.load, 0); }
	}

	changeOpt(key, val){
		DIRECTION_PAGE_SETTINGS.save({ [key]: val });
		this.setState({ [key]: val });   // componentDidUpdate 见请求键变了即重取
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){ return; }
		const k = this.requestKeyOf();
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧表留存+「更新中…」角标,
		// 新表到达单次 setState 整体替换 —— 印占同款范式)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/predict/dist`, {
				body: JSON.stringify(distributionsRequestBody(this.props.value, this.settings())),
				timeoutMs: 60000,
				silent: silentTechniquePanelsEnabled(),
			});
			if(!this._mounted || seq !== this._loadSeq) return;
			// 空载荷守卫:request() 吞错 resolve undefined(网络层失败)——此前 `|| {}` 会把旧表冲成空表,
			// keep-stale 要求保留旧结果,此次不更新、重试即恢复。
			if(!data){
				parkLoadFailure(this, k);   // 失败不记成已完成:窗口期后同一张盘自动重试
				this.setState({ loading: false });
				return;
			}
			clearLoadFailure(this);
			// horosa_panel_ready_v1:界推运表(本技法唯一可见内容)落定的那一次 setState。
			this.setState({ result: unwrapResult(data) || {}, resultSig, loading: false, requestKey: k }, ()=>{ markPanelReady('direction'); });
		}catch(e){
			if(!this._mounted || seq !== this._loadSeq) return;
			parkLoadFailure(this, k);
			this.setState({ loading: false });
		}
	}

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	render(){
		this.ensureLoaded();
		const r = this.shownResult() || {};
		const rows = r.dist || [];
		const partners = r.distPartners || [];
		const height = this.props.height ? this.props.height - 20 : 700;
		const sym = (id) => astroSymbol(id);
		const nowMs = Date.now();
		const curRow = rowAt(rows, nowMs);
		const curP = rowAt(partners, nowMs);
		const hl = (row) => (row === curRow || row === curP ? { background: 'var(--horosa-accent-soft, rgba(215,173,105,.14))' } : undefined);
		const echo = r.distSettings || null;
		const partnerCell = (p) => (
			<span key={`${p.planet}${p.aspect}${p.side}`} style={{ marginRight: 6, whiteSpace: 'nowrap' }}>{sym(p.planet)}<span style={{ fontSize: 11, fontFamily: AstroConst.NormalFont }}>{partnerAspectText(p.aspect, p.side)}</span></span>
		);
		return (
			// keep-stale:局部 Spin 只留给首次加载(无旧表可显);重取期间旧表原样可读,右上角「更新中…」角标提示。
			<Spin spinning={this.state.loading && !this.shownResult()}>
				<div style={{ position: 'relative' }}>
				{this.state.loading && this.shownResult() ? <UpdatingBadge /> : null}
				<div className="horosa-balbillus-shell" style={{ height, overflow: 'auto', paddingRight: 8 }}>
					<div className="horosa-balbillus-head">
						<div className="horosa-balbillus-title">
							界推运<span className="horosa-balbillus-sub">分配法 · 分配星（界主）与伙伴星</span>
						</div>
						<div className="horosa-balbillus-desc">
							发放点随周日运动顺黄道依次经过其后各界：每一界一期，界主为分配星；发放点每遇一颗行星的本体或相位点（左右 60° / 90° / 120°、180°），换一位伙伴星，管到下一点为止。界表随全局界系设置。
						</div>
						<Row gutter={12} className="horosa-balbillus-controls">
							<Col span={6}>
								<div className="horosa-balbillus-label">发放点</div>
								<Select value={this.state.distReleaser} onChange={(v) => this.changeOpt('distReleaser', v)} style={{ width: '100%' }}>
									{DIST_RELEASERS.map((o) => <Option value={o.value} key={o.value}>{o.label}</Option>)}
								</Select>
							</Col>
							<Col span={6}>
								<div className="horosa-balbillus-label">时间算法</div>
								<Select value={this.state.distMethod} onChange={(v) => this.changeOpt('distMethod', v)} style={{ width: '100%' }}>
									{DIST_METHODS.map((o) => <Option value={o.value} key={o.value}>{o.label}</Option>)}
								</Select>
							</Col>
							<Col span={6}>
								<div className="horosa-balbillus-label">年长</div>
								<Select value={this.state.distYear} onChange={(v) => this.changeOpt('distYear', v)} style={{ width: '100%' }}>
									{DIST_YEARS.map((o) => <Option value={o.value} key={o.value}>{o.label}</Option>)}
								</Select>
							</Col>
							<Col span={6}>
								<div className="horosa-balbillus-label">年限</div>
								<Select value={this.state.distYears} onChange={(v) => this.changeOpt('distYears', v)} style={{ width: '100%' }}>
									{DIST_SPANS.map((n) => <Option value={n} key={n}>{`${n} 年`}</Option>)}
								</Select>
							</Col>
						</Row>
					</div>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">分配星期</div>
						<SmallTable
							rowKey={(row, i) => i}
							rows={rows}
							rowStyle={hl}
							columns={[
								{ key: 'distributor', title: '分配星', render: (v) => sym(v) },
								{ key: 'sign', title: '界(座)', render: (v) => sym(v) },
								{ key: 'startYears', title: '起始岁', render: (v) => fmtYears(v) },
								{ key: 'years', title: '时长(年)', render: (v) => fmtYears(v) },
								{ key: 'startDate', title: '起', render: (v) => v || '-' },
								{ key: 'endDate', title: '止', render: (v) => v || '-' },
								{ key: 'partnerDetail', title: '期内伙伴星', render: (v, row) => {
									if(Array.isArray(v) && v.length){ return v.map(partnerCell); }
									return (row.participants && row.participants.length) ? row.participants.map((p, i) => <span key={i} style={{ marginRight: 4 }}>{sym(p)}</span>) : '—';
								} },
							]}
						/>
					</div>
					{partners.length ? (
						<div style={cardStyle}>
							<div className="horosa-info-card-title">伙伴星期</div>
							<SmallTable
								rowKey={(row, i) => i}
								rows={partners}
								rowStyle={hl}
								columns={[
									{ key: 'planet', title: '伙伴星', render: (v) => sym(v) },
									{ key: 'aspect', title: '相位点', render: (v, row) => <span style={{ whiteSpace: 'nowrap' }}>{partnerAspectText(v, row.side)}（{Number(row.lon).toFixed(2)}°）</span> },
									{ key: 'startYears', title: '起始岁', render: (v) => fmtYears(v) },
									{ key: 'years', title: '时长(年)', render: (v) => fmtYears(v) },
									{ key: 'startDate', title: '起', render: (v) => v || '-' },
									{ key: 'endDate', title: '止', render: (v) => v || '-' },
								]}
							/>
						</div>
					) : null}
					<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', margin: '2px 4px 8px' }}>
						{echo
							? `${distSettingsLine(echo)}${Number.isFinite(Number(echo.releaserLon)) ? `；${distReleaserLabel(echo.distReleaser)}黄经 ${Number(echo.releaserLon).toFixed(2)}°` : ''}。底色行 = 今日所在期。`
							: (rows.length ? '本地服务未回显口径（服务版本较旧，表为旧算法结果）；重启本地服务后四项口径生效。' : '')}
					</div>
				</div>
				</div>
			</Spin>
		);
	}
}

export default AstroDistributions;
