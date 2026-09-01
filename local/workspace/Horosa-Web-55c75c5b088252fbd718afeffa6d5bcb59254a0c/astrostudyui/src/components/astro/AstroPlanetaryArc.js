import { Component } from 'react';
import { Row, Col, Divider } from 'antd';
import AstroDoubleChart from './AstroDoubleChart';
import AstroDirectionForm from './AstroDirectionForm';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { convertToArray } from '../../utils/helper';
import { saveModuleAISnapshotLazy, } from '../../utils/moduleAiSnapshot';
import { buildStarAndLotPositionLines, buildHouseCuspLines, buildPredictiveBirthLines, buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import { XQSelect as Select } from '../xq-ui';
import { markPanelReady } from '../../utils/perfMark';
import { natalClassicalParams, transitOrbDefault } from './AstroExtraCommon';
import { pruneStaleClassicalParams } from '../../utils/classicalChartGlobals';

const Option = Select.Option;
export const ARC_SOURCES = [AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN, AstroConst.SUN];
// AI 挂载「行星弧」可调项默认（=无头默认：月亮弧 / 截至今日 12:00 / 容许 1°）。不调任何项 → 输出逐字不变。
const PLANETARY_ARC_DEFAULT_OPTS = { arcSource: AstroConst.MOON, datetime: '', asporb: 1 };   // asporb 运行时以 transitOrbDefault() 覆盖

// [YB v42] 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出,
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

function natalParams(chartObj){
	const q = chartObj ? (chartObj.params || {}) : {};
	const params = { ...q };
	if(q.birth){
		const parts = q.birth.split(' ');
		params.date = parts[0];
		params.time = parts[1];
	}
	return {
		date: params.date, time: params.time, ad: params.ad ? params.ad : 1,
		zone: params.zone, dirZone: params.zone, lon: params.lon, lat: params.lat,
		gpsLat: params.gpsLat, gpsLon: params.gpsLon, hsys: params.hsys,
		zodiacal: params.zodiacal, siderealAyanamsa: params.siderealAyanamsa, tradition: params.tradition,
		// [0d] 古典口径段(单源):此前只带基础键,推运链丢古典口径。
		...natalClassicalParams(params),
	};
}

function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')} 12:00:00`;
}

// 把向运盘格式化为 markdown：本命盘配置 + 向运盘配置 + 「向运→本命」相位网格。
function formatArcSnapshot(result, title, intro, natalChartObj){
	if(!result || !result.chart || !Array.isArray(result.chart.aspects)){ return ''; }
	const sym = (id) => (AstroText.AstroTxtMsg[id] || `${id}`);
	const asp = (deg) => (AstroText.AstroTxtMsg['Asp' + deg] || `${deg}°`);
	const lines = [];
	lines.push(`[${title}]`);
	if(intro){ lines.push(intro); }
	// 本命盘配置(内圈)
	const natalStars = buildStarAndLotPositionLines(natalChartObj);
	const natalHouses = buildHouseCuspLines(natalChartObj);
	// [YB v42] 生辰行并入既有 [本命盘配置] 段头部(裸行版,不新开段;无生辰数据 → 输出与现状逐字一致)。
	const natalBirth = safeHelperLines(buildPredictiveBirthLines, natalChartObj);
	if(natalStars.length || natalHouses.length || natalBirth.length){
		lines.push('');
		lines.push('[本命盘配置]');
		if(natalBirth.length){ lines.push(...natalBirth); }
		if(natalStars.length){ lines.push('星与虚点'); lines.push(...natalStars); }
		if(natalHouses.length){ lines.push('宫位宫头'); lines.push(...natalHouses); }
	}
	// 向运盘配置(时段盘/外圈):result 本身即向运盘 chartObj
	const arcStars = buildStarAndLotPositionLines(result);
	const arcHouses = buildHouseCuspLines(result);
	if(arcStars.length || arcHouses.length){
		lines.push('');
		lines.push('[时段盘配置]');
		if(arcStars.length){ lines.push('星与虚点'); lines.push(...arcStars); }
		if(arcHouses.length){ lines.push('宫位宫头'); lines.push(...arcHouses); }
	}
	lines.push('');
	lines.push('[相位]');
	lines.push('| 向运星 | 相位 | 本命星 | 误差 |');
	lines.push('| --- | --- | --- | --- |');
	let n = 0;
	result.chart.aspects.forEach((row) => {
		(row.objects || []).forEach((o) => {
			if(n >= 120){ return; }
			lines.push(`| ${sym(row.directId)} | ${asp(o.aspect)} | ${sym(o.natalId)} | ${(o.delta !== undefined ? Math.round(o.delta * 1000) / 1000 : '')} |`);
			n += 1;
		});
	});
	// [YB v42] 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset;组件存档路径无 natalChartObj 时优雅降级)。
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, natalChartObj));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'planetaryarc'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

// 行星弧 AI 快照（无头）：默认月亮弧、截至今日。无数据返回 ''。
// opts（AI 挂载「每技法设置」）：arcSource(7星) + datetime(目标时刻) + asporb(容许度)。
// 缺省经 PLANETARY_ARC_DEFAULT_OPTS 回退（datetime 空 → todayStr()）→ 与现状逐字一致(守「默认即现状」)。
export async function buildPlanetaryArcSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	try{
		const o = { ...PLANETARY_ARC_DEFAULT_OPTS, ...(opts && typeof opts === 'object' ? opts : {}) };
		const arcSource = ARC_SOURCES.indexOf(o.arcSource) >= 0 ? o.arcSource : AstroConst.MOON;
		const datetime = `${o.datetime || ''}`.trim() || todayStr();
		// [基线锚审计 病3·镜像型] 缺省回退 transitOrbDefault()(schema globalCurrent 同源;曾静态 1:
		// 全局 3° 时挂载拨 3 想同步页面被剪空,无头却按 1° 算——两端各执一词)。
		const asporb = (o.asporb !== undefined && o.asporb !== null && `${o.asporb}` !== '' && Number.isFinite(Number(o.asporb))) ? Number(o.asporb) : transitOrbDefault();
		const params = { ...natalParams(chartObj), datetime, asporb, arcSource };
		const data = await request(`${Constants.ServerRoot}/predict/planetaryarc`, { body: JSON.stringify(params) });
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey];
		return formatArcSnapshot(result, '行星弧（Planetary Arc）', '行星弧(默认月亮弧)：以所选天体的二次推运移动量为弧推进全盘，看向运星对本命的相位。', chartObj);
	}catch(e){
		return '';
	}
}

class AstroPlanetaryArc extends Component{
	constructor(props){
		super(props);
		const np = natalParams(props.value);
		const dt = new DateTime();
		dt.addDate(1);
		this.state = {
			params: { ...np, datetime: dt, tmType: 'y', nodeRetrograde: false, asporb: transitOrbDefault(), arcSource: AstroConst.MOON },
			dirChart: null,
		};
		this.submit = this.submit.bind(this);
		this.fieldsChanged = this.fieldsChanged.bind(this);
		this.requestDirection = this.requestDirection.bind(this);
		this.requestData = this.requestData.bind(this);
		this.changeArcSource = this.changeArcSource.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.requestData();
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

	componentDidUpdate(prevProps){
		// 换盘/改生辰后本命参数变——本组件曾既无此钩子、容器也不传 hook,state.params 停留
		// 构造时的旧盘 → 外圈行星弧盘与内圈本命(props.value 实时)不一致,须手动改时刻才恢复。
		// 照 AstroPersianDirected 同款:value 引用变即重算本命参数(保留用户已设的向运时刻/弧源/容许度)并重取。
		if(prevProps.value !== this.props.value){
			const np = natalParams(this.props.value);
			// [SURF-T1] 增量 merge 粘滞剔除:非默认改回默认后 np 不带古典键,旧值不得残留。
			this.setState((s) => ({ params: pruneStaleClassicalParams({ ...s.params, ...np }, np) }), this.requestData);
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'planetaryarc' || !this.props.value){ return; }
		buildPlanetaryArcSnapshotText(this.props.value).then((txt) => { evt.detail.snapshotText = txt || ''; }).catch(() => {});
	}

	requestData(){
		const params = { ...this.state.params };
		params.datetime = params.datetime.format('YYYY-MM-DD HH:mm');
		if(this.props.value){ this.requestDirection(params); }
	}

	async requestDirection(params){
		// 空回包/请求失败防御(与 AstroProfection 同款):后端未就绪等场景不产生 Unhandled Rejection 红屏。
		let data = null;
		try{
			data = await request(`${Constants.ServerRoot}/predict/planetaryarc`, { body: JSON.stringify(params) });
		}catch(e){
			return;
		}
		const result = data ? data[Constants.ResultKey] : null;
		if(!result){
			return;
		}
		const tm = new DateTime();
		const dt = tm.parse(params.datetime, 'YYYY-MM-DD HH:mm:ss');
		if(params.dirZone){ dt.setZone(params.dirZone); }
		if(!this._mounted) return;
		this.setState({ dirChart: result, params: { ...params, datetime: dt } }, () => {
			// horosa_panel_ready_v1:行星弧盘(中栏盘 + 右栏表同源于 dirChart)落定的那一次 setState。
			markPanelReady('direction');
			saveModuleAISnapshotLazy('planetaryarc', ()=>formatArcSnapshot(result, '行星弧（Planetary Arc）', '行星弧：以所选天体的二次推运移动量为弧推进全盘。'), { module: 'planetaryarc' });
		});
	}

	changeArcSource(v){
		const params = { ...this.state.params, arcSource: v };
		this.setState({ params }, () => {
			const p = { ...params, datetime: params.datetime.format('YYYY-MM-DD HH:mm') };
			if(this.props.value){ this.requestDirection(p); }
		});
	}

	submit(values){
		const params = { ...this.state.params };
		if(values.zone){ params.dirZone = values.zone; }
		if(values.ad){ params.ad = values.ad; }
		if(values.datetime){ params.datetime = values.datetime.format('YYYY-MM-DD HH:mm:ss'); }
		if(this.props.value){ this.requestDirection(params); }
	}

	fieldsChanged(changedFields){
		const params = { ...this.state.params };
		if(changedFields.datetime && changedFields.datetime.value){
			params.datetime = changedFields.datetime.value instanceof DateTime ? changedFields.datetime.value : changedFields.datetime.value.time;
			params.ad = changedFields.datetime.value.ad;
		}
		if(changedFields.zone && changedFields.zone.value){ params.dirZone = changedFields.zone.value; }
		if(changedFields.asporb){ params.asporb = changedFields.asporb.value; }
		if(changedFields.nodeRetrograde){ params.nodeRetrograde = changedFields.nodeRetrograde.value; }
		this.setState({ params });
	}

	render(){
		const chartObj = { natualChart: this.props.value, dirChart: this.state.dirChart };
		const param = this.state.params;
		const tm = new DateTime();
		const fields = {
			startDate: { value: tm.parse(param.date, 'YYYY-MM-DD'), name: ['startDate'] },
			datetime: { value: param.datetime, name: ['datetime'] },
			lat: { value: param.lat, name: ['lat'] },
			lon: { value: param.lon, name: ['lon'] },
			tmType: { value: param.tmType, name: ['tmType'] },
			gpsLat: { value: param.gpsLat, name: ['gpsLat'] },
			gpsLon: { value: param.gpsLon, name: ['gpsLon'] },
			nodeRetrograde: { value: param.nodeRetrograde, name: ['nodeRetrograde'] },
			asporb: { value: param.asporb, name: ['asporb'] },
			ad: { value: param.ad, name: ['ad'] },
		};
		const fieldsary = convertToArray(fields);
		const height = this.props.height ? this.props.height : 760;
		const style = { height: (height - 20) + 'px', overflowY: 'auto', overflowX: 'hidden' };
		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<AstroDoubleChart value={chartObj} height={height}
							planetDisplay={this.props.planetDisplay} lotsDisplay={this.props.lotsDisplay}
							chartDisplay={this.props.chartDisplay} showAstroMeaning={this.props.showAstroMeaning} />
					</Col>
					<Col span={7}>
						<div className={styles.scrollbar} style={style}>
							<div style={{ marginBottom: 8 }}>
								<div style={{ marginBottom: 4 }}>弧源天体（月亮弧 / 行星弧）</div>
								<Select value={param.arcSource} onChange={this.changeArcSource} style={{ width: '100%' }}>
									{ARC_SOURCES.map((id) => <Option value={id} key={id}>{AstroText.AstroTxtMsg[id] || id}</Option>)}
								</Select>
							</div>
							<AstroDirectionForm {...fields} fieldsAry={fieldsary} onFieldsChange={this.fieldsChanged} onSubmit={this.submit} />
							<Divider orientation="left">向运星 → 本命 相位</Divider>
							<div style={{ fontSize: 12, color: 'var(--horosa-muted, #666)' }}>左侧双盘：内圈本命、外圈行星弧向运。</div>
						</div>
					</Col>
				</Row>
			</div>
		);
	}
}

export default AstroPlanetaryArc;
