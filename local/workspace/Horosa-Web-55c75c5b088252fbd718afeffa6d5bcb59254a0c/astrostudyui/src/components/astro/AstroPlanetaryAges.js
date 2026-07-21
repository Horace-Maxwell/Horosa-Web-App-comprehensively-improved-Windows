import { Component } from 'react';
import { Row, Col, Divider } from 'antd';
import AstroChart from './AstroChart';
import { symbolWithMeaning, astroSymbol, SmallTable } from './AstroExtraCommon';
import { XQSegmented } from '../xq-ui';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildPlanetaryAges, buildPlanetaryAgesSnapshotText, } from '../../utils/planetaryAges';
import { PLANETARY_YEARS } from '../../divination/data/hellenisticData';
import styles from '../../css/styles.less';
import { markPanelReady } from '../../utils/perfMark';

// 行星年四档：七政各有通用的四档年数（小/中/大/极大），按迦勒底序由土至月排列。
const YEAR_BAND_ORDER = [
	AstroConst.SATURN,
	AstroConst.JUPITER,
	AstroConst.MARS,
	AstroConst.SUN,
	AstroConst.VENUS,
	AstroConst.MERCURY,
	AstroConst.MOON,
];
const YEAR_BAND_OPTIONS = [
	{ value: 'least', label: '小年' },
	{ value: 'mean', label: '中年' },
	{ value: 'greater', label: '大年' },
	{ value: 'greatest', label: '极大' },
];

class AstroPlanetaryAges extends Component{
	constructor(props){
		super(props);
		this.state = { yearBand: 'least' };
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.handleYearBandChange = this.handleYearBandChange.bind(this);
	}

	handleYearBandChange(e){
		const v = e && e.target ? e.target.value : e;
		this.setState({ yearBand: v });
	}

	renderYearBandTable(){
		const sel = this.state.yearBand;
		const fmt = (n) => (Number.isFinite(n) ? `${n}` : '-');
		const colCell = (band) => (val, row) => {
			const active = row.__band === band;
			return (
				<span style={active ? { fontWeight: 700, color: 'var(--horosa-accent, #c0392b)' } : undefined}>
					{fmt(val)}
				</span>
			);
		};
		const columns = [
			{ key: 'planet', title: '七政', render: (id) => (
				<span style={{ whiteSpace: 'nowrap' }}>
					<span style={{ marginRight: 4 }}>{astroSymbol(id)}</span>
					<span style={{ fontFamily: AstroConst.NormalFont }}>{AstroText.AstroTxtMsg[id] || id}</span>
				</span>
			) },
			{ key: 'least', title: '小年', render: colCell('least') },
			{ key: 'mean', title: '中年', render: colCell('mean') },
			{ key: 'greater', title: '大年', render: colCell('greater') },
			{ key: 'greatest', title: '极大年', render: colCell('greatest') },
		];
		const rows = YEAR_BAND_ORDER.map((id) => {
			const y = PLANETARY_YEARS[id] || {};
			return {
				planet: id,
				least: y.least,
				mean: y.mean,
				greater: y.greater,
				greatest: y.greatest,
				__band: sel,
			};
		});
		return (
			<div>
				<Divider orientation="left">行星年四档</Divider>
				<div style={{ marginBottom: 8, color: 'var(--horosa-muted, #666)', fontSize: 12, lineHeight: 1.6 }}>
					七政各有四档通用年数：小年取自辖界最短跨度，大年为各星所辖界度数之和；七政小年之和为 129，日月中年皆为 39.5。下方选档将高亮对应一列。
				</div>
				<div style={{ marginBottom: 8 }}>
					<XQSegmented value={this.state.yearBand} options={YEAR_BAND_OPTIONS} onChange={this.handleYearBandChange} />
				</div>
				<SmallTable columns={columns} rows={rows} rowKey={(r) => r.planet} />
			</div>
		);
	}

	componentDidMount(){
		this.saveAISnapshot();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value){
			// horosa_panel_ready_v1:本技法无自有请求,数据整份派生自 chartObj —— 「落定」= 拿到新盘那次提交。
			markPanelReady('direction');
			this.saveAISnapshot();
		}
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	saveAISnapshot(){
		const txt = buildPlanetaryAgesSnapshotText(this.props.value);
		saveModuleAISnapshot('planetaryages', txt, { tab: 'planetaryages' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'planetaryages'){
			return;
		}
		const txt = this.saveAISnapshot();
		if(txt){
			evt.detail.snapshotText = txt;
		}
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const style = { height: `${height - 20}px`, overflowY: 'auto', overflowX: 'hidden' };
		const { bands, curAge } = buildPlanetaryAges(this.props.value);
		const glyph = (id) => AstroText.AstroMsg[id] || id;
		const cn = (id) => (id ? (AstroText.AstroTxtMsg[id] || id) : '');
		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<AstroChart
							value={this.props.value}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showAstroMeaning={this.props.showAstroMeaning}
							height={height}
						/>
					</Col>
					<Col span={8}>
						<div className={styles.scrollbar} style={style}>
							<Divider orientation="left">行星年龄（托勒密人生七阶）</Divider>
							{curAge !== null ? (
								<div style={{ marginBottom: 8, color: 'var(--horosa-muted, #666)' }}>当前年龄：约 {Math.floor(curAge)} 岁</div>
							) : null}
							{bands.map((b, i) => {
								const range = b.to === Infinity ? `${b.from}+ 岁` : `${b.from}–${b.to} 岁`;
								const pos = b.sign ? `${cn(b.sign)}${(b.signlon !== null) ? (' ' + Math.floor(b.signlon) + '°') : ''}` : '';
								return (
									<div key={i} className={`horosa-age-band${b.active ? ' horosa-age-band--active' : ''}`}>
										<span className="horosa-age-range" style={{ fontFamily: AstroConst.NormalFont }}>{range}</span>
										<span className="horosa-age-glyph">{symbolWithMeaning(b.planet, this.props.showAstroMeaning)}</span>
										<span style={{ fontFamily: AstroConst.NormalFont }}>{cn(b.planet)}{b.active ? ' · 当前' : ''}</span>
										{pos ? <span className="horosa-age-pos" style={{ fontFamily: AstroConst.NormalFont }}>本命 {pos}</span> : null}
									</div>
								);
							})}
							{this.renderYearBandTable()}
						</div>
					</Col>
				</Row>
			</div>
		);
	}
}

export default AstroPlanetaryAges;
