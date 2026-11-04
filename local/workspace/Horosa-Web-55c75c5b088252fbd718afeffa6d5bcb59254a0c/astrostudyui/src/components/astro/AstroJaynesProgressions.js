import React, { Component } from 'react';
import { Spin } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroText from '../../constants/AstroText';
import { unwrapResult, fmtNum, chartParams, chartRequestKey, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import { buildStarAndLotPositionLines, buildHouseCuspLines, buildPredictiveBirthLines, buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import ProgMethodPanel, { MINOR_VARIANT_OPTIONS, ProgPageSide } from './AstroProgChart';
import { ProgPageShell } from './progPageLayout';
import { today, chartZone, methodTab } from './astroProgSnapshot';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';


function typeLabel(t){ return t === 'contraparallel' ? '反平行' : '平行'; }

// 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出,
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

// 赤纬推运 AI 快照（无头）：内部 fetch /astroextra/jaynesprog。无数据返回 ''。
// opts（AI 挂载「每技法设置」）：targetDate + targetTime（目标时刻）+ minorVariant（小推运月长，缺省 synodic=标准朔望月）。
export async function buildJaynesProgSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	const o = opts && typeof opts === 'object' ? opts : {};
	const targetDate = `${o.targetDate || ''}`.trim() || today(chartZone(chartObj));
	const targetTime = `${o.targetTime || ''}`.trim() || '12:00:00';
	const minorVariant = `${o.minorVariant || ''}`.trim() || 'synodic';
	let result = null;
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/jaynesprog`, {
			body: JSON.stringify({ ...chartParams(chartObj), targetDate, targetTime, minorVariant, orb: 1.0 }),
			timeoutMs: 45000,
		});
		result = unwrapResult(data) || {};
	}catch(e){ return ''; }
	const methods = Array.isArray(result.methods) ? result.methods : [];
	const sec = methods.find((m) => m.method === 'secondary') || methods[0];
	if(!sec || !Array.isArray(sec.parallels) || sec.parallels.length === 0){ return ''; }
	const sym = (id) => (AstroText.AstroTxtMsg[id] || `${id}`);
	const lines = [];
	lines.push('[赤纬推运（Declination）]');
	// 同上:表推到的是所选目标日期,不是「今日」。
	lines.push('赤纬推运：推运后看赤纬平行/反平行（下表为二次推运，推至所选目标日期）。');
	// 目标日期与推运时刻的映射必须写明(推运法本义:目标日期折算成推运时刻;只写派生时刻会被误读为没吃目标日期)。
	lines.push(`目标日期：${targetDate} ${targetTime}（各法推运时刻=按该法折算，见各小节）`);
	const natalStars = buildStarAndLotPositionLines(chartObj);
	const natalHouses = buildHouseCuspLines(chartObj);
	// 生辰行并入既有 [本命盘配置] 段头部(裸行版,不新开段;无生辰数据 → 输出与现状逐字一致)。
	const natalBirth = safeHelperLines(buildPredictiveBirthLines, chartObj);
	const natalDecls = Array.isArray(result.natalDeclinations) ? result.natalDeclinations : [];
	if(natalStars.length || natalHouses.length || natalBirth.length){
		lines.push('');
		lines.push('[本命盘配置]');
		if(natalBirth.length){ lines.push(...natalBirth); }
		if(natalStars.length){ lines.push('星与虚点'); lines.push(...natalStars); }
		if(natalHouses.length){ lines.push('宫位宫头'); lines.push(...natalHouses); }
		// UI 赤纬图有本命赤纬列,此前不入快照 → ◆ 子题段内纯增(平行/反平行的本命侧参照)。
		if(natalDecls.length){
			lines.push('');
			lines.push('◆ 本命赤纬');
			lines.push('| 点 | 赤纬 |');
			lines.push('| --- | --- |');
			natalDecls.forEach((d) => { lines.push(`| ${sym(d.id)} | ${fmtNum(d.decl, 2)}° |`); });
		}
	}
	lines.push('');
	lines.push('[时段盘 赤纬平行/反平行]');
	lines.push('| 推运点 | 类型 | 本命点 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	sec.parallels.slice(0, 80).forEach((p) => {
		lines.push(`| ${sym(p.a)} | ${typeLabel(p.type)} | ${sym(p.b)} | ${fmtNum(p.orb, 3)} |`);
	});
	// UI 有 二次/三次/小推运 三法 Tab + 推运赤纬表,此前导出只有二次推运平行表。
	// 单次 fetch 已带回全部三法(与组件同一接口同一回包),零额外成本 → 三法全量各出小节,
	// 段内纯增(◆ 子题并入既有 [时段盘 赤纬平行/反平行] 段,既有二次推运平行表逐字不动)。
	const pushMethodBlocks = (m, withParallels) => {
		if(!m){ return; }
		const label = methodTab(m);
		const when = m.progressedDate && m.progressedDate.datetime ? m.progressedDate.datetime : '';
		if(Array.isArray(m.declinations) && m.declinations.length){
			lines.push('');
			lines.push(`◆ ${label} 推运赤纬`);
			if(when){ lines.push(`推运时刻：${when}`); }
			// 小推运写明所用月长档(此前三法全出却不写档,AI 无从分辨「引擎历史值≈无推进」与标准朔望月)。
			if(m.method === 'minor'){ lines.push(`月长算法：${(MINOR_VARIANT_OPTIONS.find((x)=>x.value === minorVariant) || {}).label || minorVariant}`); }
			lines.push('| 点 | 赤纬 |');
			lines.push('| --- | --- |');
			m.declinations.forEach((d) => { lines.push(`| ${sym(d.id)} | ${fmtNum(d.decl, 2)}° |`); });
		}
		if(withParallels && Array.isArray(m.parallels) && m.parallels.length){
			lines.push('');
			lines.push(`◆ ${label} 赤纬平行/反平行`);
			lines.push('| 推运点 | 类型 | 本命点 | 误差 |');
			lines.push('| --- | --- | --- | --- |');
			m.parallels.slice(0, 80).forEach((p) => {
				lines.push(`| ${sym(p.a)} | ${typeLabel(p.type)} | ${sym(p.b)} | ${fmtNum(p.orb, 3)} |`);
			});
		}
	};
	pushMethodBlocks(sec, false);
	methods.forEach((m) => { if(m && m !== sec){ pushMethodBlocks(m, true); } });
	// 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset)。
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, chartObj));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'jaynesprog'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

// 赤纬推运（Declination）：二次/三次/小推运。每个子 tab → 左固定推运双盘 + 右可滚动 赤纬 / 平行·反平行表。
class AstroJaynesProgressions extends Component{
	constructor(props){
		super(props);
		this.state = { targetDate: today(chartZone(props.value)), targetTime: '12:00:00', minorVariant: DIRECTION_PAGE_SETTINGS.load().minorVariant, loading: false, result: null, requestKey: '', progMethod: 'secondary' };
		this.load = this.load.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(){
		const key = chartRequestKey(this.props.value, `jaynesprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'jaynesprog' || !this.props.value){ return; }
		// 导出=页面所见:带页面目标时刻(此前只传月长算法,导出恒「今日 12:00」)。
		buildJaynesProgSnapshotText(this.props.value, { targetDate: this.state.targetDate, targetTime: this.state.targetTime, minorVariant: this.state.minorVariant }).then((txt) => { evt.detail.snapshotText = txt || ''; }).catch(() => {});
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `jaynesprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ setTimeout(this.load, 0); }
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, `jaynesprog|${this.state.targetDate}|${this.state.targetTime}|${this.state.minorVariant}`);
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/jaynesprog`, {
				body: JSON.stringify({ ...chartParams(this.props.value), targetDate: this.state.targetDate, targetTime: this.state.targetTime, minorVariant: this.state.minorVariant, orb: 1.0 }),
				timeoutMs: 45000,
			});
			if(!this._mounted || seq !== this._loadSeq) return;
			clearLoadFailure(this);
			// horosa_panel_ready_v1:赤纬推运 结果(中栏盘 + 右栏表同源于 result)落定的那一次 setState。
			this.setState({ result: unwrapResult(data) || {}, resultSig, loading: false, requestKey: key }, ()=>{ markPanelReady('direction'); });
		}catch(e){
			// 失败不把 key 记成已完成(改日期失败=永远没反应);泊车该 key,窗口期后自动重试。
			parkLoadFailure(this, key);
			if(!this._mounted || seq !== this._loadSeq) return;
			this.setState({ loading: false });
		}
	}

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	render(){
		this.ensureLoaded();
		const shown = this.shownResult();
		const result = shown || {};
		const methods = result.methods || [];
		const method = methods.find((m)=>m.method === this.state.progMethod) || methods[0] || null;
		const height = this.props.height ? this.props.height - 10 : 700;
		// 版式与主限法盘同一个:左边整列推运双盘,右栏标题 · 时间选择 · 设置 · 表(progPageLayout);改任何设置自动重算
		const side = (
			<ProgPageSide
				title="赤纬推运"
				desc="推运后看赤纬:推运星与本命星赤纬相同(同侧)为平行、等值异侧为反平行,作用类同合 / 冲。左图按赤纬画本命与推运两列并连出平行 / 反平行。"
				result={result}
				method={method}
				methodLabel={methodTab}
				targetDate={this.state.targetDate}
				targetTime={this.state.targetTime}
				zone={chartZone(this.props.value)}
				minorVariant={this.state.minorVariant}
				onTime={(targetDate, targetTime)=>this.setState({ targetDate, targetTime })}
				onMinor={(v)=>{ DIRECTION_PAGE_SETTINGS.save({ minorVariant: v }); this.setState({ minorVariant: v }); }}
				onMethod={(v)=>this.setState({ progMethod: v })}
			/>
		);
		return (
			<Spin spinning={this.state.loading && !methods.length}>
				<ProgPageShell height={height} updating={this.state.loading && methods.length > 0}>
					<ProgMethodPanel
						value={this.props.value}
						method={method}
						side={side}
						targetDate={this.state.targetDate}
						targetTime={this.state.targetTime}
						mode="declination"
					natalDeclinations={result.natalDeclinations}
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
						showAstroMeaning={this.props.showAstroMeaning}
					/>
				</ProgPageShell>
			</Spin>
		);
	}
}

export default AstroJaynesProgressions;
