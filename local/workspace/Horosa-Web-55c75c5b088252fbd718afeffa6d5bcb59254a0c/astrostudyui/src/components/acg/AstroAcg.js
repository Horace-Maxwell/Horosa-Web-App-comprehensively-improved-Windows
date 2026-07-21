import { Component } from 'react';
import { Row, Col } from 'antd';
import moment from 'moment';
import AcgD3Map, { STYLES } from './AcgD3Map';
import AcgPointPanel from './AcgPointPanel';
import request from '../../utils/request';
import { setAcgSnapshot } from '../../utils/acgSnapshot';
import { markPanelReady } from '../../utils/perfMark';
import DateTimeInfo from '../comp/DateTimeInfo';
import * as Constants from '../../utils/constants';
import AstroLinesSelector from './AstroLinesSelector';
import { getAllLines } from './AcgHelper';
import { XQButton, XQCheckItem, XQCheckList, XQDatePicker, XQDrawer, XQPanel, XQSegmented, XQSelect, XQSwitch } from '../xq-ui';

const HSYS_OPTIONS = [
	['placidus', '普拉西德'], ['koch', '柯赫'], ['whole', '整宫'], ['equal', '等宫'],
	['porphyry', '波菲利'], ['regiomontanus', '雷乔蒙'], ['campanus', '坎帕努斯'],
	['alcabitius', '阿卡比特'], ['topocentric', '站心'], ['meridian', '子午宫'], ['morinus', '莫林'],
];

// 世运事件快捷(§19):选事件→后端查精确时刻→自动填入 CCG(全行运)= 事件时刻的角化线地图
const MUNDANE_EVENTS = [
	['solar_eclipse', '下次日食'], ['lunar_eclipse', '下次月食'],
	['newmoon', '下次新月'], ['fullmoon', '下次满月'],
	['aries_ingress', '春分入境'], ['cancer_ingress', '夏至入境'],
	['libra_ingress', '秋分入境'], ['capricorn_ingress', '冬至入境'],
];

// 恒星黄道 ayanamsa 读数(复用后端 47 注册表键;''=回归/tropical)。选一档→落点面板加恒星度列、
// 行星线 tooltip 显恒星黄经;物理线不变(恒星只是标注,升落/中天恒相同)。
const AYANAMSA_OPTIONS = [
	['', '回归(默认)'], ['lahiri', 'Lahiri'], ['lahiri_icrc', 'Lahiri ICRC'], ['raman', 'Raman'],
	['krishnamurti', 'Krishnamurti'], ['kp', 'KP'], ['yukteshwar', 'Yukteshwar'],
	['true_citra', 'True Citra'], ['true_revati', 'True Revati'], ['fagan_bradley', 'Fagan-Bradley'],
	['deluce', 'De Luce'], ['galcent_0sag', '银心0°Sag'], ['hipparchos', 'Hipparchos'],
	['sassanian', 'Sassanian'], ['babyl_kugler1', '巴比伦/Kugler'], ['j2000', 'J2000'],
];

function fieldsToParams(fields) {
	return {
		ad: fields.date.value.ad,
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.date.value.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		name: fields.name.value,
		pos: fields.pos.value,
	};
}

class AstroAcg extends Component {
	constructor(props) {
		super(props);
		const lines = getAllLines();

		this.state = {
			acgData: null,
			drawerVisible: false,
			lines: lines,
			linesSet: new Set(lines),
			projection: 'equirect',
			mapStyle: 'classic',
			showGeo: true,
			showLS: false,
			showAspects: false,   // 相位线(60/90/120/45/135 到 MC/IC)
			showPoints: false,    // 东/西点线 + 天顶点 + OOB 超界标
			showMidpoints: false, // 中点线(主星两两短弧中点)
			showLots: false,      // 阿拉伯点线(福点/精神点)
			showCrossings: false, // 线交叉点(命运点)
			showCuspLines: false, // 十二宫尖线(opt-in·后端重算·依赖宫制)
			showStars: false,     // 固定星线(opt-in·后端重算·18 主要恒星 MC/IC/ASC/DSC)
			showStarParans: false, // 固定星交映 parans(纯渲染;需先开固定星)
			showTreasure: false,  // 寻宝图热力(自研透明评分·纯前端渲染层,零后端)
			ccgDate: null,        // CCG 时间地图目标日期(moment;设了即画,清除即关)
			ccgTime: '12:00:00',  // CCG 目标时刻(世运事件会带精确时刻)
			ccgMix: 'mixed',      // CCG 口径:mixed 内二推外行运(文献标准)/transit/progressed
			relMode: '',          // 关系盘:'' 关 / davison 时空中点 / composite 中点合盘 / synastry 双人叠加
			relDate: null,        // B 盘出生日期(moment)
			relTime: '12:00:00',  // B 盘出生时间
			relPos: '',           // B 盘经纬(如 39n54 116e23;空=同 A 地)
			hsys: 'placidus',     // 落点报告十二宫尖的宫制(§15)
			showGeodetic: false,  // 地理等价线(§7)
			geodetic: 'sepharial', // 地理等价流派:sepharial/mcrae/johndro
			geodeticVar: 'longitude', // 变体:longitude/ra
			mode: 'mundo',        // 口径:mundo 本体(Jim Lewis 默认) / zodiac 黄道度(β=0)
			coord: 'geo',         // 坐标系:geo 地心(默认) / helio 日心(仅绕日天体)
			ayanamsa: '',         // 恒星黄道读数(''=回归;选一档→面板/线加恒星度,物理线不变)
			lsMode: 'great',      // 本地空间画法:great 大圆 / rhumb 等角航线
			paranMode: 'off',
			showLabels: true,
			layersOpen: false,    // 「图层与设置」抽屉(3栏工作台:全部图层/流派/时间/关系盘)
			pointReport: null,
			pointOpen: false,
			pointLoading: false,
			clickMarker: null,
		};

		this.unmounted = false;

		this.requestAcg = this.requestAcg.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.closeDrawer = this.closeDrawer.bind(this);
		this.openDrawer = this.openDrawer.bind(this);
		this.openLayers = this.openLayers.bind(this);
		this.closeLayers = this.closeLayers.bind(this);
		this.changeLines = this.changeLines.bind(this);
		this.toggleProjection = this.toggleProjection.bind(this);
		this.cycleStyle = this.cycleStyle.bind(this);
		this.cycleParan = this.cycleParan.bind(this);
		this.snapshotUiState = this.snapshotUiState.bind(this);
		this.syncSnapshotUi = this.syncSnapshotUi.bind(this);
		this.toggleStarParans = this.toggleStarParans.bind(this);
		this.cycleMode = this.cycleMode.bind(this);
		this.cycleLsMode = this.cycleLsMode.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeGeodetic = this.changeGeodetic.bind(this);
		this.toggleCuspLines = this.toggleCuspLines.bind(this);
		this.cycleCoord = this.cycleCoord.bind(this);
		this.changeAyanamsa = this.changeAyanamsa.bind(this);
		this.toggleStars = this.toggleStars.bind(this);
		this.changeCcg = this.changeCcg.bind(this);
		this.changeRel = this.changeRel.bind(this);
		this.changeCalc = this.changeCalc.bind(this);
		this.pickMundane = this.pickMundane.bind(this);
		this.toggle = this.toggle.bind(this);
		this.onMapClick = this.onMapClick.bind(this);
		this.closePoint = this.closePoint.bind(this);

		if (this.props.hook) {
			this.props.hook.fun = () => {
				if (this.unmounted) return;
				this.requestAcg(this.genParams());
			};
		}
	}

	toggleProjection() {
		this.setState({ projection: this.state.projection === 'equirect' ? 'mercator' : 'equirect' });
	}

	cycleStyle() {
		const keys = Object.keys(STYLES);
		const i = keys.indexOf(this.state.mapStyle);
		this.setState({ mapStyle: keys[(i + 1) % keys.length] });
	}

	cycleParan() {
		const order = ['off', 'lum', 'all'];
		const i = order.indexOf(this.state.paranMode);
		this.setState({ paranMode: order[(i + 1) % order.length] }, this.syncSnapshotUi);
	}

	// AI 导出 uiState:落点报告 + 交映开关(交映是纯渲染开关、不触发后端重算,须写进快照,导出才知道开没开)
	snapshotUiState(pointReport) {
		return {
			pointReport,
			paranMode: this.state.paranMode,
			showStarParans: this.state.showStars && this.state.showStarParans,   // 双 opt-in 口径同 AcgD3Map
		};
	}

	// 纯前端交映开关变更后重发快照:数据(后端响应)不变,仅刷新 uiState;acgData 未就绪时无事可发
	syncSnapshotUi() {
		if (this.state.acgData) setAcgSnapshot(this.state.acgData, this.snapshotUiState(this.state.pointReport));
	}

	// 星曜交映纬线开关(纯渲染):切换后同步 AI 快照的交映 uiState
	toggleStarParans() {
		this.setState({ showStarParans: !this.state.showStarParans }, this.syncSnapshotUi);
	}

	toggle(key) {
		this.setState({ [key]: !this.state[key] });
	}

	changeLines(vals) {
		this.setState({ lines: vals, linesSet: new Set(vals) });
	}

	closeDrawer() { this.setState({ drawerVisible: false }); }
	openDrawer() { this.setState({ drawerVisible: true }); }
	openLayers() { this.setState({ layersOpen: true }); }
	closeLayers() { this.setState({ layersOpen: false }); }
	closePoint() { this.setState({ pointOpen: false }); }

	async requestAcg(params) {
		// 竞态守卫:快速连切开关时,慢响应(如宫尖线 ~0.6s)可能后到;只认最后一次请求
		const seq = (this._acgSeq = (this._acgSeq || 0) + 1);
		const data = await request(`${Constants.ServerRoot}/location/acg`, { body: JSON.stringify(params) });
		if (this.unmounted || seq !== this._acgSeq) return;
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const acgData = data[Constants.ResultKey];
		// horosa_panel_ready_v1:占星地图(辅盘·占星地图子页)的地图层 + 右栏线表全部由 acgData 派生,
		// 这一次 setState 即「面板数据落定」。技法键=顶层页签 auxchart(唯一宿主 loc/LocAstroMain)。
		this.setState({ acgData }, ()=>{
			markPanelReady('auxchart');
		});
		// AI 导出真值:发布"最近一次地图状态"(单一真值源=后端响应,导出时拼【占星地图】段)
		setAcgSnapshot(acgData, this.snapshotUiState(this.state.pointReport));
	}

	async onMapClick(lat, lon) {
		this.setState({ clickMarker: { lat, lon }, pointOpen: true, pointLoading: true });
		try {
			const params = { ...this.genParams(), clickLat: lat, clickLon: lon, orb: 2, hsys: this.state.hsys };
			const data = await request(`${Constants.ServerRoot}/location/acgpoint`, { body: JSON.stringify(params) });
			if (this.unmounted) return;
			if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
			const pointReport = data[Constants.ResultKey];
			this.setState({ pointReport, pointLoading: false });
			if (this.state.acgData) setAcgSnapshot(this.state.acgData, this.snapshotUiState(pointReport));
		} catch (e) {
			if (!this.unmounted) this.setState({ pointLoading: false });
		}
	}

	genParams() {
		const p = {
			...fieldsToParams(this.props.fields),
			mode: this.state.mode,
			lsMode: this.state.lsMode,
			geodetic: this.state.geodetic,
			geodeticVar: this.state.geodeticVar,
			cuspLines: this.state.showCuspLines ? '1' : '0',
			hsys: this.state.hsys,
			coord: this.state.coord,
			ayanamsa: this.state.ayanamsa,
			stars: this.state.showStars ? '1' : '0',
		};
		if (this.state.ccgDate) {   // CCG 时间地图:只在设了日期时下发(未设=零回归)
			p.ccgDate = this.state.ccgDate.format('YYYY/MM/DD');
			if (this.state.ccgTime) p.ccgTime = this.state.ccgTime;
			p.ccgMix = this.state.ccgMix;
		}
		if (this.state.relMode && this.state.relDate) {   // 关系盘:模式+B盘日期都有才下发
			p.relMode = this.state.relMode;
			p.relDate = this.state.relDate.format('YYYY/MM/DD');
			p.relTime = this.state.relTime || '12:00:00';
			const pos = (this.state.relPos || '').trim().split(/\s+/);
			if (pos.length === 2) { p.relLat = pos[0]; p.relLon = pos[1]; }
		}
		return p;
	}

	// 关系盘变更(模式/B盘日期/时间/经纬):重请求
	changeRel(patch) {
		this.setState(patch, () => this.requestAcg(this.genParams()));
	}

	// 通用"改口径即重算"(mode/coord/lsMode 等后端参数;抽屉 Segmented 用)
	changeCalc(patch) {
		this.setState(patch, () => this.requestAcg(this.genParams()));
	}

	// 世运事件快捷:查事件精确时刻→填入 CCG 全行运 = 事件时刻角化线地图(§19)
	async pickMundane(kind) {
		if (!kind) return;
		try {
			const params = { kind, direction: 'next', fromDate: fieldsToParams(this.props.fields).date };
			const data = await request(`${Constants.ServerRoot}/location/acgevent`, { body: JSON.stringify(params) });
			if (this.unmounted) return;
			if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
			const ev = data[Constants.ResultKey];
			if (!ev || !ev.date) return;
			this.setState({
				ccgDate: moment(ev.date.replace(/\//g, '-')),
				ccgTime: ev.time || '12:00:00',
				ccgMix: 'transit',
			}, () => this.requestAcg(this.genParams()));
		} catch (e) { /* graceful:事件查找失败不影响主图 */ }
	}

	// CCG 日期/口径变更:重请求(清除日期=后端 ccg=None=不画)
	changeCcg(patch) {
		this.setState(patch, () => this.requestAcg(this.genParams()));
	}

	// 固定星线开关:opt-in 后端重算(约 0.1s);关时零开销
	toggleStars() {
		this.setState({ showStars: !this.state.showStars }, () => this.requestAcg(this.genParams()));
	}

	// 坐标系切换:地心↔日心(后端换算,日心仅绕日天体+日→地)
	cycleCoord() {
		this.setState({ coord: this.state.coord === 'helio' ? 'geo' : 'helio' }, () => this.requestAcg(this.genParams()));
	}

	// 恒星黄道读数切换(后端重算 ayanamsa 度数;''=回归)
	changeAyanamsa(v) {
		this.setState({ ayanamsa: v }, () => {
			this.requestAcg(this.genParams());
			const m = this.state.clickMarker;
			if (m) this.onMapClick(m.lat, m.lon);   // 已选点则刷新落点面板恒星列
		});
	}

	changeGeodetic(patch) {
		this.setState(patch, () => this.requestAcg(this.genParams()));
	}

	// 宫尖线开关:opt-in 后端重算(约 0.6s),关时零开销;开时会带上当前宫制
	toggleCuspLines() {
		this.setState({ showCuspLines: !this.state.showCuspLines }, () => this.requestAcg(this.genParams()));
	}

	cycleMode() {
		this.setState({ mode: this.state.mode === 'mundo' ? 'zodiac' : 'mundo' }, () => this.requestAcg(this.genParams()));
	}

	cycleLsMode() {
		this.setState({ lsMode: this.state.lsMode === 'great' ? 'rhumb' : 'great' }, () => this.requestAcg(this.genParams()));
	}

	changeHsys(v) {
		this.setState({ hsys: v }, () => {
			// 宫尖线开着时主图依赖 hsys(后端 _cuspLines 用),必须重算主图
			if (this.state.showCuspLines) this.requestAcg(this.genParams());
			const m = this.state.clickMarker;
			if (m) this.onMapClick(m.lat, m.lon);   // 已选点则按新宫制重算落点宫尖
		});
	}

	onFieldsChange(values) {
		if (this.props.onChange) {
			const flds = this.props.onChange(values);
			this.requestAcg(fieldsToParams(flds));
		}
	}

	componentDidMount() {
		this.unmounted = false;
		this.requestAcg(this.genParams());
	}

	componentWillUnmount() { this.unmounted = true; }

	render() {
		const fields = this.props.fields;
		let height = this.props.height ? this.props.height : 760;
		height = height - 50;
		const dt = fields.date ? fields.date.value : null;
		const s = this.state;
		const btn = (label, onClick, active) => (
			<XQButton size="small" type={active ? 'primary' : 'default'} style={{ marginLeft: 8 }} onClick={onClick}>{label}</XQButton>
		);
		// 「图层与设置」抽屉:设置面板化——每组一张 xq-panel 卡片,行式「标签左·控件右」,
		// 开关用 XQSwitch、互斥项用 XQSegmented(Radio.Group,取 e.target.value)、多开关用 XQCheckList。
		const sec = (title, hint, children) => (
			<XQPanel key={title} style={{ padding: '12px 16px 10px', marginBottom: 14 }}>
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
					<span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '0.02em' }}>{title}</span>
					{hint ? <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 400 }}>{hint}</span> : null}
				</div>
				{children}
			</XQPanel>
		);
		const row = (label, control) => (
			<div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 36, padding: '3px 0' }}>
				<span style={{ fontSize: 13, opacity: 0.82, flexShrink: 0 }}>{label}</span>
				<span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{control}</span>
			</div>
		);
		const seg = (value, opts, onPatch) => (
			<XQSegmented value={value} options={opts} onChange={(e) => onPatch(e.target.value)} />
		);

		return (
			<div className="horosa-acg-page xq-chart-renderer xq-chart-renderer-locastro">
				<Row align="middle">
					<Col span={7}>
						<DateTimeInfo value={dt} />
					</Col>
					<Col span={17} style={{ textAlign: 'right', marginBottom: 10 }}>
						{/* 顶栏只留高频项;全部图层/流派/时间/关系盘收进「图层与设置」抽屉(3栏工作台) */}
						<XQButton size="small" onClick={this.openDrawer}>行星线选择</XQButton>
						{btn('图层与设置', this.openLayers, s.layersOpen)}
						{btn(s.showLabels ? '标注开' : '标注关', () => this.toggle('showLabels'), s.showLabels)}
						{btn(s.projection === 'equirect' ? '等距投影' : '墨卡托', this.toggleProjection, false)}
						{btn('样式·' + ((STYLES[s.mapStyle] && STYLES[s.mapStyle].name) || ''), this.cycleStyle, false)}
						<XQSelect size="small" value={s.hsys} onChange={this.changeHsys} dropdownMatchSelectWidth={false} style={{ marginLeft: 8, minWidth: 96 }}>
							{HSYS_OPTIONS.map(([v, cn]) => (<XQSelect.Option key={v} value={v}>宫制·{cn}</XQSelect.Option>))}
						</XQSelect>
					</Col>
				</Row>
				<Row>
					<Col span={24}>
						<AcgD3Map
							value={s.acgData}
							fields={fields}
							height={height}
							lines={s.linesSet}
							projection={s.projection}
							mapStyle={s.mapStyle}
							showGeo={s.showGeo}
							showLS={s.showLS}
							showAspects={s.showAspects}
							showPoints={s.showPoints}
							showMidpoints={s.showMidpoints}
							showLots={s.showLots}
							showCrossings={s.showCrossings}
							showCuspLines={s.showCuspLines}
							showStars={s.showStars}
							showStarParans={s.showStarParans}
							showTreasure={s.showTreasure}
							showGeodetic={s.showGeodetic}
							showParans={s.paranMode !== 'off'}
							paranAll={s.paranMode === 'all'}
							showLabels={s.showLabels}
							clickMarker={s.clickMarker}
							onMapClick={this.onMapClick}
						/>
					</Col>
				</Row>

				<XQDrawer
					title="行星线选择"
					width={500}
					placement="left"
					onClose={this.closeDrawer}
					maskClosable={true}
					open={s.drawerVisible}
					style={{ height: 'calc(100% - 0px)', overflow: 'auto', paddingBottom: 53, backgroundColor: 'transparent' }}
				>
					<AstroLinesSelector value={s.lines} onChange={this.changeLines} />
				</XQDrawer>

				<XQDrawer
					title="图层与设置"
					width={440}
					placement="left"
					onClose={this.closeLayers}
					maskClosable={true}
					open={s.layersOpen}
					style={{ height: 'calc(100% - 0px)', overflow: 'auto', paddingBottom: 53, backgroundColor: 'transparent' }}
				>
					{sec('口径与坐标系', '影响全部线的几何,切换即重算', (
						<>
							{row('投影口径', seg(s.mode, [
								{ value: 'mundo', label: '本体' }, { value: 'zodiac', label: '黄道度' },
							], (v) => this.changeCalc({ mode: v })))}
							{row('观测中心', seg(s.coord, [
								{ value: 'geo', label: '地心' }, { value: 'helio', label: '日心' },
							], (v) => this.changeCalc({ coord: v })))}
							{row('恒星黄道读数', (
								<XQSelect size="small" value={s.ayanamsa} onChange={this.changeAyanamsa} dropdownMatchSelectWidth={false} style={{ width: 176 }}>
									{AYANAMSA_OPTIONS.map(([v, cn]) => (<XQSelect.Option key={v || 'trop'} value={v}>{cn}</XQSelect.Option>))}
								</XQSelect>
							))}
						</>
					))}
					{sec('参考与本地空间', null, (
						<>
							{row('地理参考线', <XQSwitch size="small" checked={s.showGeo} onChange={() => this.toggle('showGeo')} />)}
							{row('本地空间线', (
								<>
									{s.showLS ? seg(s.lsMode, [
										{ value: 'great', label: '大圆' }, { value: 'rhumb', label: '等角航线' },
									], (v) => this.changeCalc({ lsMode: v })) : null}
									<XQSwitch size="small" checked={s.showLS} onChange={() => this.toggle('showLS')} />
								</>
							))}
							{row('行星交映 Parans', seg(s.paranMode, [
								{ value: 'off', label: '关' }, { value: 'lum', label: '日月' }, { value: 'all', label: '全部' },
							], (v) => this.setState({ paranMode: v }, this.syncSnapshotUi)))}
						</>
					))}
					{sec('衍生线型', '只对已选中主线的行星绘制', (
						<XQCheckList columns={2} style={{ marginTop: 2 }}>
							<XQCheckItem checked={s.showAspects} onClick={() => this.toggle('showAspects')}>相位线 60/90/120</XQCheckItem>
							<XQCheckItem checked={s.showPoints} onClick={() => this.toggle('showPoints')}>东西点·天顶·映点</XQCheckItem>
							<XQCheckItem checked={s.showMidpoints} onClick={() => this.toggle('showMidpoints')}>中点线</XQCheckItem>
							<XQCheckItem checked={s.showLots} onClick={() => this.toggle('showLots')}>福点 / 精神点</XQCheckItem>
							<XQCheckItem checked={s.showCrossings} onClick={() => this.toggle('showCrossings')}>线交叉点</XQCheckItem>
							<XQCheckItem checked={s.showCuspLines} onClick={this.toggleCuspLines}>十二宫尖线</XQCheckItem>
						</XQCheckList>
					))}
					{sec('固定星与寻宝图', null, (
						<>
							{row('固定星线(18 亮星)', <XQSwitch size="small" checked={s.showStars} onChange={this.toggleStars} />)}
							{s.showStars ? row('星曜交映纬线', <XQSwitch size="small" checked={s.showStarParans} onChange={this.toggleStarParans} />) : null}
							{row('寻宝图评分热力', <XQSwitch size="small" checked={s.showTreasure} onChange={() => this.toggle('showTreasure')} />)}
						</>
					))}
					{sec('地理等价', '黄道度↔地理经度的时间无关映射', (
						<>
							{row('地理等价线', <XQSwitch size="small" checked={s.showGeodetic} onChange={() => this.toggle('showGeodetic')} />)}
							{s.showGeodetic ? row('流派', seg(s.geodetic, [
								{ value: 'sepharial', label: '塞法里尔' }, { value: 'mcrae', label: '麦克雷' }, { value: 'johndro', label: '约翰德罗' },
							], (v) => this.changeGeodetic({ geodetic: v }))) : null}
							{s.showGeodetic ? row('取数', seg(s.geodeticVar, [
								{ value: 'longitude', label: '黄经法' }, { value: 'ra', label: '赤经法' },
							], (v) => this.changeGeodetic({ geodeticVar: v }))) : null}
						</>
					))}
					{sec('时间地图 CCG / 世运', '行运·推运行星的角化线;清除日期即关', (
						<>
							{row('目标日期', (
								<XQDatePicker size="small" value={s.ccgDate} placeholder="选择日期" allowClear
									onChange={(m) => this.changeCcg({ ccgDate: m })} style={{ width: 176 }} />
							))}
							{s.ccgDate ? row('推运口径', seg(s.ccgMix, [
								{ value: 'mixed', label: '混合' }, { value: 'transit', label: '全行运' }, { value: 'progressed', label: '全二推' },
							], (v) => this.changeCcg({ ccgMix: v }))) : null}
							{row('世运事件', (
								<XQSelect size="small" value="" onChange={this.pickMundane} dropdownMatchSelectWidth={false} style={{ width: 176 }}>
									<XQSelect.Option value="">选择事件…</XQSelect.Option>
									{MUNDANE_EVENTS.map(([v, cn]) => (<XQSelect.Option key={v} value={v}>{cn}</XQSelect.Option>))}
								</XQSelect>
							))}
						</>
					))}
					{sec('关系盘', 'B 盘时地缺省与 A 相同', (
						<>
							{row('模式', seg(s.relMode, [
								{ value: '', label: '关' }, { value: 'davison', label: '戴维森' }, { value: 'composite', label: '合盘' }, { value: 'synastry', label: '叠加' },
							], (v) => this.changeRel({ relMode: v })))}
							{s.relMode ? row('B 盘生日', (
								<XQDatePicker size="small" value={s.relDate} placeholder="选择日期" allowClear
									onChange={(m) => this.changeRel({ relDate: m })} style={{ width: 176 }} />
							)) : null}
						</>
					))}
				</XQDrawer>

				<AcgPointPanel
					open={s.pointOpen}
					loading={s.pointLoading}
					report={s.pointReport}
					onClose={this.closePoint}
				/>
			</div>
		);
	}
}

export default AstroAcg;
