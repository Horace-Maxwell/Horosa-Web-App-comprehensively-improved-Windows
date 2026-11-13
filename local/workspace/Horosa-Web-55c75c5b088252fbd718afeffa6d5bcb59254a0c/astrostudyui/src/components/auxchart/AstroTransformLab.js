// 变换盘:把本命盘按某种规则换算出一张新盘,照常用盘面绘制。后端 /astroextra/transformchart。
import { Component } from 'react';
import { Spin } from 'antd';
import { XQSegmented, XQSelect as Select, XQSwitch as Switch } from '../xq-ui';
import AstroChart from '../astro/AstroChart';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroText from '../../constants/AstroText';
import { unwrapResult, fmtNum, chartParams, chartRequestKey, SmallTable, parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from '../astro/AstroExtraCommon';
import { ProgPageShell, WheelSplit, SidePanelHead, SideSection, ControlCol, ControlGrid, FillCard, LoadFailNote, EmptyWheel, MUTED } from '../astro/progPageLayout';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { clearModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { AUX_TABLE_CLASS, pointCell, lonCell, shiftCell, groupRowStyle } from './auxTableCells';
import { TRANSFORM_GROUPS, TRANSFORM_HOUSES, TRANSFORM_PAGE_SETTINGS, TRANSFORM_PLANETS, transformKindDef, transformSnapshotChart, transformSnapshotLines } from '../../utils/transformCharts';

const planetName = (id)=>(AstroText.AstroMsgCN && AstroText.AstroMsgCN[id]) || id;
const planetList = (list)=>((list || []).length ? <span style={{ whiteSpace: 'normal' }}>{list.map((id, i)=><span key={id} style={{ marginRight: i < list.length - 1 ? 8 : 0, display: 'inline-block' }}>{pointCell(id)}</span>)}</span> : <span className="horosa-aux-muted">—</span>);
const rulerText = (id, retro)=>(id ? <span style={{ whiteSpace: 'nowrap' }}>{pointCell(id)}{retro ? <span className="horosa-aux-muted" style={{ marginLeft: 6 }}>/ {planetName(retro)} 逆</span> : null}</span> : <span className="horosa-aux-muted">—</span>);

// 辅盘页签面板是 flex 容器,Spin 不撑满就按内容收缩,右边会留白
const FILL_PANE = { flex: '1 1 auto', minWidth: 0, width: '100%' };

class AstroTransformLab extends Component {
	constructor(props){
		super(props);
		this.state = { ...TRANSFORM_PAGE_SETTINGS.load(), loading: false, loadError: '', result: null, resultSig: '', requestKey: '' };
		this.load = this.load.bind(this);
	}

	componentDidMount(){ this._mounted = true; this.load(); }

	componentWillUnmount(){ this._mounted = false; clearTimeout(this._retryTimer); }

	componentDidUpdate(){
		const key = this.requestKey();
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	requestKey(){
		const base = chartRequestKey(this.props.value, 'transform');
		return base ? `${base}|${JSON.stringify(this.requestOptions())}` : base;
	}

	// 只发这个变换真正用到的选项:切到无关选项不该重算,黄金分割的起点也不该被看不见的基准星带跑。
	requestOptions(){
		const { kind, planet, shift, house, variant } = this.state;
		const options = transformKindDef(kind).options || [];
		const out = { transformKind: kind };
		if(options.indexOf('planet') >= 0){ out.transformPlanet = planet; }
		if(options.indexOf('shift') >= 0){ out.transformShift = shift ? 1 : 0; }
		if(options.indexOf('house') >= 0){ out.transformHouse = house; }
		if(options.indexOf('variant') >= 0){ out.transformVariant = variant; }
		return out;
	}

	change(patch){
		TRANSFORM_PAGE_SETTINGS.save({ ...patch });
		this.setState(patch);
	}

	async load(){
		if(!this.props.value){ return; }
		this._loadSeq = (this._loadSeq || 0) + 1;
		const seq = this._loadSeq;
		const key = this.requestKey();
		const resultSig = natalSourceKey(this.props.value);
		const { fields } = this.props;   // 快照 meta 要和这次请求的盘对应,不能等回包时再读
		const settings = { kind: this.state.kind, planet: this.state.planet, shift: this.state.shift, house: this.state.house, variant: this.state.variant };
		const requestOptions = this.requestOptions();
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/transformchart`, {
				body: JSON.stringify({ ...chartParams(this.props.value), ...requestOptions }),
				timeoutMs: 60000,   // 高纬的受孕盘、人格盘要起两张盘,极圈内一张就要十几秒
				silent: true,
			});
			if(!this._mounted || seq !== this._loadSeq){ return; }
			clearLoadFailure(this);
			const res = unwrapResult(data) || {};
			// 请求键只在成功时写:失败后还要靠「键不同」到点重试
			this.setState({ result: res, resultSig, requestKey: key, loading: false, loadError: '' });
			if(res.chart){
				saveDerivedAstroSnapshot('transformchart', transformSnapshotChart(res), fields, ()=>transformSnapshotLines(res, settings, planetName));
			}else{
				clearModuleAISnapshot('transformchart');   // 这张盘算不出时刻:不留上一种变换的内容
			}
		}catch(e){
			if(!this._mounted || seq !== this._loadSeq){ return; }
			parkLoadFailure(this, key);
			// 请求键也清掉:快照已清,切回上一个选项要重取才有内容给 AI
			this.setState({ loading: false, requestKey: '', loadError: (e && e.message) || '变换盘计算失败' });
			clearModuleAISnapshot('transformchart');
			clearTimeout(this._retryTimer);
			this._retryTimer = setTimeout(()=>{ if(this._mounted){ this.forceUpdate(); } }, LOAD_RETRY_PARK_MS + 500);
		}
	}

	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	renderHead(result){
		const def = transformKindDef(this.state.kind);
		const options = def.options || [];
		return (
			<SidePanelHead title="变换盘" sub={def.label} desc={def.desc}>
				<SideSection title="变换设置">
					<ControlGrid>
						<ControlCol label="变换" span={24}>
							<Select size="small" style={{ width: '100%' }} value={this.state.kind} onChange={(kind)=>this.change({ kind })} dropdownMatchSelectWidth={false}
								options={TRANSFORM_GROUPS.map((group)=>({ label: group.label, options: group.kinds.map((item)=>({ value: item.value, label: item.label })) }))} />
						</ControlCol>
						{options.indexOf('planet') >= 0 ? (
							<ControlCol label="基准星">
								<Select size="small" style={{ width: '100%' }} value={this.state.planet} onChange={(planet)=>this.change({ planet })}
									options={TRANSFORM_PLANETS.map((id)=>({ value: id, label: planetName(id) }))} />
							</ControlCol>
						) : null}
						{options.indexOf('shift') >= 0 ? (
							<ControlCol label="宫位同转">
								{/* 与旁边下拉框同高同框:开关 + 当前状态一句话,整框可点 */}
								<div className={`horosa-aux-switch-field${this.state.shift ? ' is-on' : ''}`} role="presentation" onClick={()=>this.change({ shift: !this.state.shift })}>
									<span className="horosa-aux-switch-text">{this.state.shift ? '宫位随之旋转' : '宫位保持本命'}</span>
									<Switch size="small" checked={!!this.state.shift} onClick={(_v, e)=>{ if(e){ e.stopPropagation(); } }} onChange={(shift)=>this.change({ shift })} />
								</div>
							</ControlCol>
						) : null}
						{options.indexOf('variant') >= 0 ? (
							<ControlCol label="口径">
								<Select size="small" style={{ width: '100%' }} value={this.state.variant} onChange={(variant)=>this.change({ variant })}
									options={[{ value: 'improved', label: '改进' }, { value: 'classic', label: '经典' }]} />
							</ControlCol>
						) : null}
						{options.indexOf('house') >= 0 ? (
							<ControlCol label="对应本命宫头">
								<Select size="small" style={{ width: '100%' }} value={this.state.house} onChange={(house)=>this.change({ house })}
									options={TRANSFORM_HOUSES.map((n)=>({ value: n, label: `第 ${n} 宫` }))} />
							</ControlCol>
						) : null}
					</ControlGrid>
					{result && result.moment ? <div style={{ ...MUTED, fontSize: 12 }}>起盘时刻 {result.moment}</div> : null}
					{result && result.chart ? (
						<div style={{ marginTop: 8 }}>
							<XQSegmented value={this.tableView(result)} options={this.viewOptions(result)} onChange={(e)=>this.change({ view: e.target.value })} />
						</div>
					) : null}
				</SideSection>
			</SidePanelHead>
		);
	}

	// 只有垂直黄道盘有「两解」表;切走后保存的当前表回到位置表,不留空卡
	tableView(result){
		return this.state.view === 'vertical' && !(result.vertical || []).length ? 'positions' : this.state.view;
	}

	viewOptions(result){
		const options = [{ value: 'positions', label: '前后位置' }, { value: 'rulers', label: '现代宫主' }, { value: 'golden', label: '黄金分割' }];
		if((result.vertical || []).length){ options.push({ value: 'vertical', label: '赤纬两解' }); }
		return options;
	}

	renderTables(result){
		const view = this.tableView(result);
		if(view === 'vertical'){
			return (
				<FillCard grow title="赤纬相同的两解" extra="出黄道带的星没有解">
					<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={result.vertical} rowKey={(row)=>row.id}
						columns={[
							{ key: 'id', title: '星', render: (v)=>pointCell(v) },
							{ key: 'declination', title: '赤纬', align: 'right', width: 84, render: (v)=>`${Number(v) < 0 ? '−' : '+'}${fmtNum(Math.abs(Number(v)))}°` },
							{ key: 'first', title: '解一', align: 'right', width: 96, render: (v, row)=>(row.outside ? <span className="horosa-aux-muted">出黄道带</span> : lonCell(v, true)) },
							{ key: 'second', title: '解二', align: 'right', width: 96, render: (v, row)=>(row.outside ? <span className="horosa-aux-muted">—</span> : lonCell(v, true)) },
						]} />
				</FillCard>
			);
		}
		if(view === 'rulers'){
			return (
				<FillCard grow title="现代宫主" extra="按本命盘算。主星看宫头所在座,共主看宫序对应的座,次共主看跨入的下一座">
					<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={result.rulers || []} rowKey={(row)=>row.house}
						columns={[
							{ key: 'house', title: '宫', align: 'right', width: 40, render: (v)=><span className="horosa-aux-house">{v}</span> },
							{ key: 'ruler', title: '主星', render: (v, row)=>rulerText(v, row.rulerRetro) },
							{ key: 'coRuler', title: '共主', render: (v, row)=>rulerText(v, row.coRulerRetro) },
							{ key: 'nextRuler', title: '次共主', render: (v, row)=>rulerText(v, row.nextRulerRetro) },
							{ key: 'inside', title: '宫内星', render: (v)=>planetList(v) },
							{ key: 'nearCusp', title: '宫头前 3°', render: (v)=>planetList(v) },
						]} />
				</FillCard>
			);
		}
		if(view === 'golden'){
			const start = (transformKindDef(this.state.kind).options || []).indexOf('planet') >= 0 ? planetName(this.state.planet) : '白羊 0°';
			return (
				<FillCard grow title="黄金分割点" extra={`按本命盘算。从${start}量;落点 1° 内的星`}>
					<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={result.golden || []} rowKey={(row, i)=>i}
						columns={[
							{ key: 'lon', title: '黄经', align: 'right', width: 96, render: (v)=>lonCell(v, true) },
							{ key: 'ratio', title: '比例', align: 'right', width: 64, render: (v)=>fmtNum(v, 3) },
							{ key: 'extra', title: '四分投影', align: 'right', width: 72, render: (v)=><span className="horosa-aux-muted">{`+${Number(v)}°`}</span> },
							{ key: 'near', title: '落点的星', render: (v)=>planetList(v) },
						]} />
				</FillCard>
			);
		}
		return (
			<FillCard grow title="变换前后位置" extra="悬停看十进制黄经 · 分组:行星 / 小行星与虚点 / 四轴">
				<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={result.positions || []} rowKey={(row)=>row.id} rowStyle={groupRowStyle(result.positions || [])}
					columns={[
						{ key: 'id', title: '点', render: (v)=>pointCell(v) },
						{ key: 'natalLon', title: '本命', align: 'right', width: 96, render: (v)=>lonCell(v) },
						{ key: 'lon', title: '变换后', align: 'right', width: 96, render: (v)=>lonCell(v, true) },
						{ key: 'shift', title: '位移', align: 'right', width: 84, render: (_v, row)=>shiftCell(row.natalLon, row.lon) },
					]} />
			</FillCard>
		);
	}

	renderWheel(result, size, h){
		if(!result || !result.chart){
			return <EmptyWheel text={result && result.momentFailed ? '这张盘算不出这个时刻,高纬的受孕盘常有这种情况' : '起盘后显示变换盘'} />;
		}
		return (
			<AstroChart value={result.chart} width={size} height={h} chartStyle={this.props.chartStyle} wheelArt={this.props.wheelArt}
				chartDisplay={this.props.chartDisplay} planetDisplay={this.props.planetDisplay} lotsDisplay={this.props.lotsDisplay} showAstroMeaning={this.props.showAstroMeaning} />
		);
	}

	render(){
		const shown = this.shownResult();
		const height = this.props.height ? this.props.height - 10 : 700;
		// 这次选项的请求失败了:不能把上一种变换的盘留在新标题下
		const failed = !!this.state.loadError && this.state.requestKey !== this.requestKey();
		return (
			<div style={FILL_PANE}>
				<Spin spinning={this.state.loading && !shown}>
					<ProgPageShell height={height} updating={this.state.loading && !!shown}>
						<WheelSplit head={this.renderHead(shown)} renderWheel={(size, h)=>(failed ? <LoadFailNote /> : this.renderWheel(shown, size, h))}>
							{!failed && shown && shown.chart ? this.renderTables(shown) : null}
						</WheelSplit>
					</ProgPageShell>
				</Spin>
			</div>
		);
	}
}

export default AstroTransformLab;
