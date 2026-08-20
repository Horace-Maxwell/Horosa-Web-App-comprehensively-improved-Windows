// G18 显赫格局 Eminence(希腊化古典占星):显赫程度计分卡,嵌本命「古典」tab。
// 纯前端派生,零后端,零回归:只读现成 chartObj(chart.objects[].selfDignity/score/ofSect/house/phase + chart.houses + 希腊点 + chart.aspects.normalAsp)。
// 五指标各 0-2 分,总分 0-10 → 等级。计分核心 computeEminence 住 utils/astroClassicalDerived(零组件依赖单源,
// AI 快照 [古典·显赫计分] 段同引 —— AI 核禁 import 组件文件)。
// 角宫判定复用现成宫位分类(1/4/7/10 角宫);夜盘区间光体=月,缺福点/朔望降级。中性表述。
import { Component } from 'react';
import { SmallTable, astroSymbol } from './AstroExtraCommon';
import { computeEminence, computePredominator, computeSevenRays, RAY_NAMES_CN } from '../../utils/astroClassicalDerived';
import { classicalGlobalValue, CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';

const MUTED = 'var(--horosa-muted, #999)';
const GOLD = 'var(--horosa-gold, #b8860b)';

class AstroEminence extends Component{
	constructor(props){
		super(props);
		this.state = { open: false };
	}
	componentDidMount(){
		// [SURF-3] never 键(busyPlaces/dynamicalDivisions/domicileMasterMethod/rayWeighting)
		// 改档即时重渲——此前只刷设置抽屉自己,本卡展开态也恒旧值。
		this._onClassicalGlobals = () => this.forceUpdate();
		if(typeof window !== 'undefined'){ window.addEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}
	componentWillUnmount(){
		if(typeof window !== 'undefined' && this._onClassicalGlobals){ window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}
	render(){
		const { open } = this.state;
		const chartObj = this.props.value;
		const data = computeEminence(chartObj);
		// [F12] 主宰光体/七射线/祝融星:此前仅 AI 快照可见(半死开关)——补 UI 消费面。
		// 全默认态:pred 恒有结论(Valens 三判据),射线/祝融星只在开启档才出行(零回归=不开不显)。
		let pred = null;
		if(open){   // [R4-P3] 收起态短路:pred/rays 只在展开时算(标题行只消费 computeEminence 总分)
		try{
			pred = computePredominator(chartObj, {
				busyPlaces: `${classicalGlobalValue('busyPlaces') || '1,4,5,7,10,11'}`.split(',').map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n)),
				dynamicalDivisions: classicalGlobalValue('dynamicalDivisions'),
				domicileMasterMethod: classicalGlobalValue('domicileMasterMethod'),
				termsVariant: chartObj && chartObj.params ? chartObj.params.termsVariant : 0,
				geminiBoundEmended: chartObj && chartObj.params ? chartObj.params.geminiBoundEmended : 0,
				// [N3] 自定义界表体(回显/随盘)——缺则 termRulerAt('custom') 回落本机仓,换机显示≠计算
				customTermsDay: chartObj && chartObj.params ? chartObj.params.customTermsDay : undefined,
				customTermsNight: chartObj && chartObj.params ? chartObj.params.customTermsNight : undefined,
			});
		}catch(e){ pred = null; }
		}
		const rayMode = open ? classicalGlobalValue('rayWeighting') : 'off';   // [R4-P3] 收起态短路
		let rays = null;
		// [R2-1] computeSevenRays 返回 { totals, max, weighting } 无 ok 字段——门卫按 totals 数组判,勿写 rays.ok(恒假=死门)。
		try{ rays = (rayMode === 'equal' || rayMode === 'weighted') ? computeSevenRays(chartObj, rayMode) : null; }catch(e){ rays = null; }
		const raysOn = !!(rays && Array.isArray(rays.totals));
		const vulcan = chartObj && chartObj.vulcan ? chartObj.vulcan : null;
		return (
			<div className="horosa-info-card horosa-classical-card">
				<div className="horosa-classical-card-title" style={{ cursor: 'pointer', justifyContent: 'space-between' }}
					onClick={() => this.setState({ open: !open })}>
					<span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
						<span className="horosa-classical-zh">显赫程度</span>
						<span className="horosa-classical-en">Eminence</span>
					</span>
					<span style={{ color: MUTED, fontSize: 12, flex: '0 0 auto' }}>
						{data.ok ? <span style={{ color: data.levelColor, fontWeight: 600, marginRight: 8 }}>{data.level}　{data.total}/10</span> : null}
						{open ? '收起 ▲' : '展开 ▼'}
					</span>
				</div>
				{open ? (
					!data.ok ? (
						<div style={{ marginTop: 8, color: MUTED, fontSize: 12 }}>数据不足,暂无法评估显赫程度。</div>
					) : (
						<div style={{ marginTop: 8 }}>
							<div style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>
								{data.isDay ? '昼生盘(区间光体=日)' : '夜生盘(区间光体=月)'}。五指标各 0-2 分,合计映射显赫等级。
								<span style={{ marginLeft: 6 }}>各分值为便于横向比较之现代计分,非典籍原文权重。</span>
							</div>
							<SmallTable
								rowKey={(r) => r.key}
								rows={data.rows}
								columns={[
									{ key: 'name', title: '指标', render: (v, r) => (
										<span>{v}{r.almuten ? <span style={{ marginLeft: 4 }}>{astroSymbol(r.almuten)}</span> : null}</span>
									) },
									{ key: 'factors', title: '满足要素' },
									{ key: 'score', title: '小分', render: (v) => (
										<span style={{ fontWeight: 600, color: v >= 1.5 ? GOLD : (v > 0 ? 'inherit' : MUTED) }}>{v}</span>
									) },
								]}
							/>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.28))' }}>
								<span style={{ fontWeight: 600 }}>总分 {data.total} / 10</span>
								<span style={{ color: data.levelColor, fontWeight: 700 }}>{data.level}</span>
							</div>
							<div style={{ color: MUTED, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
								显赫由两光位置、福点、护卫、盘主、四显赫点综合判定:总分 ≥8 显赫 / 6-7 显著 / 3-5 平凡 / &lt;3 暗晦。
								{data.note ? <div style={{ color: GOLD, marginTop: 2 }}>{data.note}</div> : null}
							</div>
							{pred && pred.ok ? (
								<div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.28))', fontSize: 12.5, lineHeight: 1.8 }}>
									<div>
										<span style={{ color: MUTED }}>主宰光体　</span>
										{astroSymbol(pred.winner)}（日 {pred.sunScore} 分 / 月 {pred.moonScore} 分）
										<span style={{ color: MUTED, marginLeft: 8 }}>主宰主星</span>　{pred.master ? astroSymbol(`${pred.master}`.charAt(0).toUpperCase() + `${pred.master}`.slice(1)) : '—'}{/* [R2-2] domicile/termRulerAt 产小写星名,AstroMsg 键空间首字母大写 */}
										<span style={{ color: MUTED, marginLeft: 4 }}>（{pred.method === 'bound' ? '界主派' : '庙主派'}）</span>
									</div>
								</div>
							) : null}
							{raysOn ? (
								<div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.8 }}>
									<span style={{ color: MUTED }}>七射线分布　</span>
									{rays.totals.map((v, i) => `${i + 1}·${RAY_NAMES_CN[i]} ${v}`).join('／')}
									<span style={{ color: MUTED, marginLeft: 6 }}>(灵学体系推算)</span>
								</div>
							) : null}
							{vulcan && vulcan.lon !== undefined ? (
								<div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.8 }}>
									<span style={{ color: MUTED }}>祝融星　</span>
									{astroSymbol(vulcan.sign)} {Number(vulcan.signlon).toFixed(2)}°
									<span style={{ color: MUTED, marginLeft: 6 }}>(推算行星)</span>
								</div>
							) : null}
						</div>
					)
				) : null}
			</div>
		);
	}
}

export default AstroEminence;
