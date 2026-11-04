import { Component } from 'react';
import AstroChart from './AstroChart';
import { ProgPageShell, WheelSplit, SidePanelHead, SideSection, FillCard } from './progPageLayout';
import { symbolWithMeaning, astroSymbol, SmallTable } from './AstroExtraCommon';
import { XQSegmented } from '../xq-ui';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildPlanetaryAges, buildPlanetaryAgesSnapshotText, } from '../../utils/planetaryAges';
import { PLANETARY_YEARS } from '../../divination/data/hellenisticData';
import styles from '../../css/styles.less';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
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

// 托勒密人生七阶各阶主题(自写概括):每阶一行,让「人生七阶」不只是年龄区间
const AGE_STAGE_THEME = {
	Moon: '婴幼:身心未定、随境而变,生长与适应为主',
	Mercury: '童年求学:心智开启,学习、模仿与语言能力成形',
	Venus: '少年:情感与欲望萌发,审美、恋慕与享乐倾向',
	Sun: '青壮:立身成名,志向、荣誉与主导一生事业的阶段',
	Mars: '中年:辛劳与严峻,担当、奋争并察觉盛年将过',
	Jupiter: '老成:持重节制,声望、体面与退守之年',
	Saturn: '暮年:精力衰退、迟缓内收,总结与安顿',
};

class AstroPlanetaryAges extends Component{
	constructor(props){
		super(props);
		this.state = { yearBand: DIRECTION_PAGE_SETTINGS.load().yearBand };   // 上次亲手选的年数档(没存过 = 小年)
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.handleYearBandChange = this.handleYearBandChange.bind(this);
	}

	handleYearBandChange(e){
		const v = e && e.target ? e.target.value : e;
		DIRECTION_PAGE_SETTINGS.save({ yearBand: v });
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
		return <SmallTable fill scrollClassName={styles.scrollbar} columns={columns} rows={rows} rowKey={(r) => r.planet} />;
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
		const { bands, curAge } = buildPlanetaryAges(this.props.value);
		const cn = (id) => (id ? (AstroText.AstroTxtMsg[id] || id) : '');
		// 与星运其它带盘页同一套(progPageLayout):左整列是盘;右栏标题行 + 年数档选择,下面「人生七阶」「行星年四档」两张卡按内容分高
		return (
			<ProgPageShell height={height - 10}>
				<WheelSplit
					head={(
						<SidePanelHead title="行星年龄" sub={`托勒密人生七阶${curAge !== null ? ` · 当前约 ${Math.floor(curAge)} 岁` : ''}`}
							desc="托勒密把一生分成七阶,依次由月、水、金、日、火、木、土掌管;行星年四档:小年为传统定数(七政小年之和为 129),中年为小年与大年之平均,大年为五星各自所辖界度数之和(日取 120、月取 108),极大年为传统极数。">
							<SideSection title="行星年四档">
								<XQSegmented value={this.state.yearBand} options={YEAR_BAND_OPTIONS} onChange={this.handleYearBandChange} />
							</SideSection>
						</SidePanelHead>
					)}
					renderWheel={(size, h)=>(
						<AstroChart
							wheelArt={this.props.wheelArt}
							value={this.props.value}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showAstroMeaning={this.props.showAstroMeaning}
							height={h}
						/>
					)}
				>
					<FillCard title="人生七阶" extra="底色行 = 当前所在一阶">
						<div className={`${styles.scrollbar} horosa-small-table-scroll`} style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
							{/* flow-root:子行的外边距算进这一层的高(右栏按它量完整内容高,否则差几像素出假滚动条) */}
							<div style={{ display: 'flow-root' }}>
								{bands.map((b, i) => {
									const range = b.to === Infinity ? `${b.from}+ 岁` : `${b.from}–${b.to} 岁`;
									const pos = b.sign ? `${cn(b.sign)}${(b.signlon !== null) ? (' ' + Math.floor(b.signlon) + '°') : ''}` : '';
									return (
										<div key={i} className={`horosa-age-band${b.active ? ' horosa-age-band--active' : ''}`}>
											<span className="horosa-age-range" style={{ fontFamily: AstroConst.NormalFont }}>{range}</span>
											<span className="horosa-age-glyph">{symbolWithMeaning(b.planet, this.props.showAstroMeaning)}</span>
											<span style={{ fontFamily: AstroConst.NormalFont }}>{cn(b.planet)}{b.active ? ' · 当前' : ''}</span>
											{pos ? <span className="horosa-age-pos" style={{ fontFamily: AstroConst.NormalFont }}>本命 {pos}</span> : null}
											{AGE_STAGE_THEME[b.planet] ? <div className="horosa-age-theme">{AGE_STAGE_THEME[b.planet]}</div> : null}
										</div>
									);
								})}
							</div>
						</div>
					</FillCard>
					<FillCard grow title="行星年四档" extra="高亮列 = 上方所选档">
						{this.renderYearBandTable()}
					</FillCard>
				</WheelSplit>
			</ProgPageShell>
		);
	}
}

export default AstroPlanetaryAges;
