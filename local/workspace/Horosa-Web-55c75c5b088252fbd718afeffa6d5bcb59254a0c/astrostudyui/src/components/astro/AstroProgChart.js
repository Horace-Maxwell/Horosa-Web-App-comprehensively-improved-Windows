import { Component } from 'react';
import { Spin, Row, Col } from 'antd';
import { unwrapResult, symbolWithMeaning, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import { fetchChart } from '../../services/astro';
import AstroDoubleChart from './AstroDoubleChart';
import AstroDeclinationLadder from './AstroDeclinationLadder';

// 推运「单层方法面板」：直接嵌入已有 赤纬/恒星/推运 三个 tab 的「二次/三次/小推运」子 tab。
// 选了某子 tab → 左固定盘 + 右可滚动表格（用户要求：左盘固定、只右表滚动）。
// mode：
//   tropical(推运)    — 左=回归黄道双盘(本命内圈+推运外圈，沿用主盘 zodiacal)。
//   sidereal(恒星推运) — 左=恒星黄道双盘：本命与推运两圈都强制 zodiacal:1 重取，避免内圈回归/外圈恒星混坐标。
//   declination(赤纬推运) — 左=专用赤纬图(非黄道盘)：本命/推运行星按赤纬落点 + 平行/反平行连线。
// 黄道盘外轮零新后端：用所选 method 的 progressedDate 调既有 /chart 取完整推运盘；赤纬图用 jaynesprog 的赤纬数据。
const EVENT_POINTS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Asc', 'MC'];

// 「小推运（minor）月长算法」可选项（放进三个推运 tab 顶栏；只影响 小推运 子 tab）。
// 默认 engine = 现状（铁律1：新设置默认即现状，零回归）；synodic 为权威标准；sidereal 为月亮恒星回归。
export const MINOR_VARIANT_OPTIONS = [
	{ value: 'engine', label: '引擎原值（现状）' },
	{ value: 'synodic', label: '朔望月每年（标准）' },
	{ value: 'sidereal', label: '恒星月每年' },
];

function splitDateTime(s){
	const str = `${s || ''}`.trim();
	if(!str){ return null; }
	const parts = str.replace('T', ' ').split(' ');
	return { date: (parts[0] || '').replace(/\//g, '-'), time: parts[1] || '12:00:00' };
}
function typeLabel(t){ return t === 'contraparallel' ? '反平行' : '平行'; }

// 推运时刻 ≠ 目标日期是推运法的本义(如二次推运「一日行一年」:目标日期折算成出生后第 N 天的天象)。
// 只显示派生的推运时刻会被误读为「没吃我选的日期」(用户实告)——标题必须双日期+折算口径。
const METHOD_RATE_NOTE = {
	secondary: '一日行一年',
	tertiary: '一日行一月',
	minor: '一月行一年',
};

class ProgMethodPanel extends Component{
	constructor(props){
		super(props);
		this.state = { dirChart: null, natalChart: null, loading: false, key: '' };
		this.load = this.load.bind(this);
	}

	componentDidMount(){ this._mounted = true; this.load(); }
	componentWillUnmount(){ this._mounted = false; }
	componentDidUpdate(){
		const key = this.buildKey();
		if(key !== this.state.key && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	buildKey(){
		const m = this.props.method || {};
		const pd = (m.progressedDate && m.progressedDate.datetime) || '';
		return chartRequestKey(this.props.value, `prog|${this.props.mode}|${pd}`);
	}

	async load(){
		const m = this.props.method;
		const key = this.buildKey();
		// 赤纬模式不需要黄道盘：赤纬图直接用 props 的赤纬数据，免 /chart。
		if(this.props.mode === 'declination'){ if(this._mounted){ this.setState({ dirChart: null, natalChart: null, key }); } return; }
		const dt = m && m.progressedDate ? splitDateTime(m.progressedDate.datetime) : null;
		if(!this.props.value || !dt){ if(this._mounted){ this.setState({ dirChart: null, natalChart: null, key }); } return; }
		this.setState({ loading: true });
		try{
			const sidereal = this.props.mode === 'sidereal';
			const natalBody = { ...chartParams(this.props.value) };
			const dirBody = { ...natalBody, date: dt.date, time: dt.time };
			if(sidereal){ natalBody.zodiacal = 1; dirBody.zodiacal = 1; }
			// 恒星模式两圈都用恒星黄道重取本命；回归模式内圈直接复用 props.value（与主盘一致）省一次请求。
			const [dirRsp, natalRsp] = await Promise.all([
				fetchChart(dirBody),
				sidereal ? fetchChart(natalBody) : Promise.resolve(null),
			]);
			if(!this._mounted){ return; }
			clearLoadFailure(this);
			this.setState({
				dirChart: unwrapResult(dirRsp) || null,
				natalChart: sidereal ? (unwrapResult(natalRsp) || null) : null,
				loading: false,
				key,
			});
		}catch(e){
			// 失败绝不把 key 记成已完成(否则右表已换新目标、左盘停旧数据且永不重试);
			// 泊车该 key,窗口期后下一次更新自动重试,新 key 立即放行。
			parkLoadFailure(this, key);
			if(this._mounted){ this.setState({ loading: false }); }
		}
	}

	renderChart(height){
		const decl = this.props.mode === 'declination';
		if(decl){
			const m = this.props.method || {};
			return (
				<AstroDeclinationLadder
					natalDeclinations={this.props.natalDeclinations}
					progressedDeclinations={m.declinations}
					parallels={m.parallels}
					height={height}
					showAstroMeaning={this.props.showAstroMeaning}
				/>
			);
		}
		const natal = this.props.mode === 'sidereal' ? this.state.natalChart : this.props.value;
		if(!natal || !this.state.dirChart){
			return <div style={{ ...cardStyle, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--horosa-text-soft)' }}>起盘后显示推运双盘</div>;
		}
		const wrap = { natualChart: natal, dirChart: { ...this.state.dirChart, natalChart: natal }, inverse: false };
		return (
			<AstroDoubleChart
				value={wrap}
				height={height}
				planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay}
				chartDisplay={this.props.chartDisplay}
				showAstroMeaning={this.props.showAstroMeaning}
			/>
		);
	}

	render(){
		const m = this.props.method || {};
		const height = this.props.height || 640;
		const decl = this.props.mode === 'declination';
		const sm = (v)=>symbolWithMeaning(v, this.props.showAstroMeaning);
		return (
			<Spin spinning={this.state.loading}>
				<Row gutter={6} style={{ height }}>
					<Col span={17} style={{ height: '100%' }}>
						{this.renderChart(height)}
					</Col>
					<Col span={7} className="horosa-scrollbar" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingRight: 6 }}>
						<div style={cardStyle}>
							<div className="horosa-info-card-title">{m.label || '推运'}{decl ? '（赤纬）' : ''}{this.props.targetDate ? `：目标 ${this.props.targetDate}${this.props.targetTime ? ` ${this.props.targetTime}` : ''}` : (m.progressedDate ? `：${m.progressedDate.datetime}` : '')}</div>
							{this.props.targetDate && m.progressedDate ? (
								<div style={{ fontSize: '0.85em', color: 'var(--horosa-text-soft)', margin: '2px 0 6px' }}>
									推运时刻：{m.progressedDate.datetime}{METHOD_RATE_NOTE[m.method] ? `（${METHOD_RATE_NOTE[m.method]}，由目标日期折算）` : '（由目标日期折算）'}
								</div>
							) : null}
							{decl ? (
								<SmallTable
									rows={m.declinations || []}
									columns={[
										{ key: 'id', title: '点', render: (v)=>sm(v) },
										{ key: 'decl', title: '赤纬', render: (v)=>`${fmtNum(v, 2)}°` },
									]}
								/>
							) : (
								<SmallTable
									rows={(m.positions || []).filter((it)=>EVENT_POINTS.indexOf(it.id) >= 0)}
									columns={[
										{ key: 'id', title: '点', render: (v)=>sm(v) },
										{ key: 'sign', title: '推运位置', render: (_v, row)=>fmtDegree(row) },
										{ key: 'lonspeed', title: '速度', render: (v)=>fmtNum(v, 4) },
									]}
								/>
							)}
						</div>
						<div style={cardStyle}>
							<div className="horosa-info-card-title">{decl ? '赤纬平行 / 反平行' : '与本命相位'}</div>
							{decl ? (
								<SmallTable
									rows={(m.parallels || []).slice(0, 120)}
									columns={[
										{ key: 'a', title: '推运点', render: (v)=>sm(v) },
										{ key: 'type', title: '类型', render: (v)=>typeLabel(v) },
										{ key: 'b', title: '本命点', render: (v)=>sm(v) },
										{ key: 'orb', title: '误差', render: (v)=>fmtNum(v, 3) },
									]}
								/>
							) : (
								<SmallTable
									rows={(m.aspectsToNatal || []).slice(0, 120)}
									columns={[
										{ key: 'a', title: '推运点', render: (v)=>sm(v) },
										{ key: 'aspect', title: '相位', render: (v)=>`${fmtNum(v, 0)}°` },
										{ key: 'b', title: '本命点', render: (v)=>sm(v) },
										{ key: 'orb', title: '误差', render: (v)=>fmtNum(v, 3) },
									]}
								/>
							)}
						</div>
					</Col>
				</Row>
			</Spin>
		);
	}
}

export default ProgMethodPanel;
