// 黄道制:同一张盘的星体落在各版本不等分黄道、13 / 14 星座、88 星座与银河黄道的哪一段。后端 /astroextra/zodiacsystems。
import { Component } from 'react';
import { Spin } from 'antd';
import { XQSegmented, XQSelect as Select } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroText from '../../constants/AstroText';
import { unwrapResult, fmtNum, chartParams, chartRequestKey, SmallTable, parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from '../astro/AstroExtraCommon';
import { ProgPageShell, WheelSplit, SidePanelHead, SideSection, ControlCol, ControlGrid, FillCard, LoadFailNote, EmptyWheel } from '../astro/progPageLayout';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { clearModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ZODIAC_PAGE_SETTINGS, ZODIAC_VERSIONS, zodiacSnapshotLines, zodiacVersionLabel } from '../../utils/transformCharts';
import ZodiacRing from './ZodiacRing';
import { AUX_TABLE_CLASS, pointCell, lonCell, segCell, degMin, groupRowStyle } from './auxTableCells';

const planetName = (id)=>(AstroText.AstroMsgCN && AstroText.AstroMsgCN[id]) || id;
const VIEWS = [{ value: 'rows', label: '各点落段' }, { value: 'houses13', label: '十三宫' }, { value: 'around', label: '上次与下次' }, { value: 'year', label: '一年跨界' }];
const DESC = '黄经本身不变,只换分段。十二段不等分的座头固定,十三、十四星座的座头随岁差移动;星座按星体真实赤经赤纬查官方边界,所以有黄纬的星可能落在黄道外的星座;银河黄道以银心为 0 点;十三宫从上升起,依次取十三星座各座的长度为宫宽。';

// 辅盘页签面板是 flex 容器,Spin 不撑满就按内容收缩,右边会留白
const FILL_PANE = { flex: '1 1 auto', minWidth: 0, width: '100%' };

class AstroZodiacLab extends Component {
	constructor(props){
		super(props);
		this.state = { ...ZODIAC_PAGE_SETTINGS.load(), loading: false, loadError: '', result: null, resultSig: '', requestKey: '' };
		this.load = this.load.bind(this);
	}

	componentDidMount(){ this._mounted = true; this.load(); }

	componentWillUnmount(){ this._mounted = false; clearTimeout(this._retryTimer); }

	componentDidUpdate(){
		const key = this.requestKey();
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){ this.load(); }
	}

	requestKey(){
		const base = chartRequestKey(this.props.value, 'zodiacsystems');
		return base ? `${base}|${this.state.version}` : base;
	}

	async load(){
		if(!this.props.value){ return; }
		this._loadSeq = (this._loadSeq || 0) + 1;
		const seq = this._loadSeq;
		const key = this.requestKey();
		const resultSig = natalSourceKey(this.props.value);
		const { fields } = this.props;   // 快照 meta 要和这次请求的盘对应,不能等回包时再读
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/zodiacsystems`, {
				body: JSON.stringify({ ...chartParams(this.props.value), zodiacVersion: this.state.version }),
				timeoutMs: 30000,
				silent: true,
			});
			if(!this._mounted || seq !== this._loadSeq){ return; }
			clearLoadFailure(this);
			const res = unwrapResult(data) || {};
			// 请求键只在成功时写:失败后还要靠「键不同」到点重试
			this.setState({ result: res, resultSig, requestKey: key, loading: false, loadError: '' });
			saveDerivedAstroSnapshot('zodiacsystems', null, fields, ()=>zodiacSnapshotLines(res, planetName));
		}catch(e){
			if(!this._mounted || seq !== this._loadSeq){ return; }
			parkLoadFailure(this, key);
			// 请求键也清掉:快照已清,切回上一个版本要重取才有内容给 AI
			this.setState({ loading: false, requestKey: '', loadError: (e && e.message) || '黄道制计算失败' });
			clearModuleAISnapshot('zodiacsystems');
			clearTimeout(this._retryTimer);
			this._retryTimer = setTimeout(()=>{ if(this._mounted){ this.forceUpdate(); } }, LOAD_RETRY_PARK_MS + 500);
		}
	}

	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	renderHead(){
		return (
			<SidePanelHead title="黄道制" sub={zodiacVersionLabel(this.state.version)} desc={DESC}>
				<SideSection title="黄道制设置">
					{this.state.view === 'houses13' ? <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>十三宫固定按十三星座甲本的座长排,不随黄道版本变</div> : null}
					<ControlGrid>
						<ControlCol label="黄道版本" span={24}>
							<Select size="small" style={{ width: '100%' }} value={this.state.version} dropdownMatchSelectWidth={false}
								onChange={(next)=>{ ZODIAC_PAGE_SETTINGS.save({ version: next }); this.setState({ version: next }); }}
								options={ZODIAC_VERSIONS} />
						</ControlCol>
					</ControlGrid>
					<div style={{ marginTop: 8 }}>
						<XQSegmented value={this.state.view} options={VIEWS} onChange={(e)=>{ const view = e.target.value; ZODIAC_PAGE_SETTINGS.save({ view }); this.setState({ view }); }} />
					</div>
				</SideSection>
			</SidePanelHead>
		);
	}

	renderTables(result){
		if(this.state.view === 'around'){
			return (
				<FillCard grow title="上次与下次换星座" extra="按真实赤经赤纬">
					<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={result.around || []} rowKey={(row)=>row.id}
						columns={[
							{ key: 'id', title: '星', render: (v)=>pointCell(v) },
							{ key: 'conName', title: '现在', render: (v, row)=>`${v}${row.retro ? ' 逆' : ''}` },
							{ key: 'last', title: '上次', render: (v)=>(v ? `${v.date} 自${v.fromName}` : '—') },
							{ key: 'next', title: '下次', render: (v)=>(v ? `${v.date} 入${v.toName}` : '—') },
						]} />
				</FillCard>
			);
		}
		if(this.state.view === 'year'){
			return (
				<FillCard grow title="此后一年的跨界" extra="月亮太频繁不列">
					<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={result.year || []} rowKey={(row, i)=>i}
						columns={[
							{ key: 'date', title: '时刻', width: 150, render: (v)=><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</span> },
							{ key: 'id', title: '星', render: (v)=>pointCell(v) },
							{ key: 'toName', title: '变化', render: (v, row)=><span style={{ whiteSpace: 'nowrap' }}><span className="horosa-aux-muted">{row.fromName}</span> → {v}</span> },
						]} />
				</FillCard>
			);
		}
		if(this.state.view === 'houses13'){
			const cusps = result.houses13Cusps || [];
			return (
				<FillCard grow title="十三宫" extra={cusps.length ? `第 1 宫头 = 上升 ${fmtNum(cusps[0])}°` : '这张盘取不到上升,排不出十三宫'}>
					<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={(result.rows || []).filter((row)=>row.houses13)} rowKey={(row)=>row.id} rowStyle={groupRowStyle((result.rows || []).filter((row)=>row.houses13))}
						columns={[
							{ key: 'id', title: '点', render: (v)=>pointCell(v) },
							{ key: 'lon', title: '回归黄经', align: 'right', width: 92, render: (v)=>lonCell(v) },
							{ key: 'house', title: '宫', align: 'right', width: 40, render: (_v, row)=><span className="horosa-aux-house">{row.houses13.house}</span> },
							{ key: 'deg', title: '离宫头', align: 'right', width: 70, render: (_v, row)=>degMin(row.houses13.deg) },
							{ key: 'pos', title: '折 30°', align: 'right', width: 70, render: (_v, row)=>degMin(row.houses13.fraction * 30) },
							{ key: 'cusp', title: '本宫宫头', align: 'right', width: 92, render: (_v, row)=>(cusps[row.houses13.house - 1] !== undefined ? lonCell(cusps[row.houses13.house - 1]) : '—') },
						]} />
				</FillCard>
			);
		}
		const seg = (row)=>row.versions && row.versions[result.version];
		return (
			<FillCard grow title="各点落段" extra={`银心回归黄经 ${fmtNum(result.galacticCenter)}°`}>
				<SmallTable fill scrollClassName={AUX_TABLE_CLASS} rows={result.rows || []} rowKey={(row)=>row.id} rowStyle={groupRowStyle(result.rows || [])}
					columns={[
						{ key: 'id', title: '点', render: (v)=>pointCell(v) },
						{ key: 'lon', title: '回归黄经', align: 'right', width: 88, render: (v)=>lonCell(v) },
						{ key: 'seg', title: '本版本', render: (_v, row)=>(seg(row) ? segCell(seg(row).sign, seg(row).deg) : '—') },
						{ key: 'equal', title: '折算', align: 'right', width: 62, render: (_v, row)=>(seg(row) ? <span className="horosa-aux-muted">{degMin(seg(row).equalDeg)}</span> : '—') },
						{ key: 'conName', title: <span style={{ whiteSpace: 'nowrap' }} title="按真实赤经赤纬查 88 星座的官方边界;星座名用天文通用译名(如人马,不是黄道十二宫的射手)">88 星座</span>, render: (v, row)=>(row.onZodiac ? v : <span title="星座不在黄道上" className="horosa-aux-muted">{v} *</span>) },
						{ key: 'galactic', title: '银河黄道', render: (v)=>(v ? segCell(v.sign, v.deg) : '—') },
					]} />
			</FillCard>
		);
	}

	renderWheel(result, size){
		if(!result || !result.wheel){ return <EmptyWheel text="起盘后显示黄道环" />; }
		const asc = (result.rows || []).find((row)=>row.id === 'Asc');
		return <ZodiacRing wheel={result.wheel} rows={result.rows} asc={asc ? asc.lon : 0} size={size} versionLabel={zodiacVersionLabel(result.version)} galacticCenter={result.galacticCenter} />;
	}

	render(){
		const shown = this.shownResult();
		const height = this.props.height ? this.props.height - 10 : 700;
		const failed = !!this.state.loadError && this.state.requestKey !== this.requestKey();
		return (
			<div style={FILL_PANE}>
				<Spin spinning={this.state.loading && !shown}>
					<ProgPageShell height={height} updating={this.state.loading && !!shown}>
						<WheelSplit head={this.renderHead()} renderWheel={(size)=>(failed ? <LoadFailNote /> : this.renderWheel(shown, size))}>
							{!failed && shown ? this.renderTables(shown) : null}
						</WheelSplit>
					</ProgPageShell>
				</Spin>
			</div>
		);
	}
}

export default AstroZodiacLab;
