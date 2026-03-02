import { Component } from 'react';
import { Row, Col, Card, Select, Button, Divider, Spin } from 'antd';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { fetchPreciseNongli } from '../../utils/preciseCalcBridge';
import { setNongliLocalCache } from '../../utils/localCalcCache';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import {
	STYLE_OPTIONS,
	ACCUM_OPTIONS,
	TENCHING_OPTIONS,
	SEX_OPTIONS,
	ROTATION_OPTIONS,
	calcTaiyi,
	buildTaiyiSnapshotText,
	getStyleLabel,
	getAccumLabel,
} from './TaiYiCalc';

const { Option } = Select;
const LAYER2_NUMS = ['二', '七', '六', '一', '八', '三', '四', '九'];
const LAYER3_BRANCH_GUA = ['午', '未', '坤', '申', '酉', '戌', '乾', '亥', '子', '丑', '艮', '寅', '卯', '辰', '巽', '巳'];
// 按 12地支+4卦固定分野（从午位开始顺时针）
// 午大威，子地主
const LAYER4_FIXED = ['大威', '大义', '天道', '大武', '武德', '太簇', '阴主', '阴德', '地主', '阳德', '和德', '吕申', '高丛', '太阳', '大炅', '大神'];
const TAIYI_FONT = '"SimHei", "Heiti SC", "Microsoft YaHei", sans-serif';

class TaiYiMain extends Component {
	constructor(props) {
		super(props);

		this.state = {
			loading: false,
			nongli: null,
			pan: null,
			options: {
				style: 3,
				tn: 0,
				tenching: 0,
				sex: '男',
				rotation: '固定',
			},
		};

		this.unmounted = false;
		this.timeHook = {};
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.genParams = this.genParams.bind(this);
		this.recalc = this.recalc.bind(this);

		if (this.props.hook) {
			this.props.hook.fun = (fields) => {
				if (this.unmounted) {
					return;
				}
				this.requestNongli(fields || this.props.fields);
			};
		}
	}

	componentDidMount() {
		this.unmounted = false;
		if (this.props.fields) {
			this.requestNongli(this.props.fields);
		}
	}

	componentDidUpdate(prevProps) {
		if (prevProps.fields !== this.props.fields && this.props.fields) {
			this.requestNongli(this.props.fields);
		}
	}

	componentWillUnmount() {
		this.unmounted = true;
	}

	onFieldsChange(field) {
		if (this.props.dispatch) {
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	}

	onTimeChanged(value) {
		const dt = value.time;
		this.onFieldsChange({
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		});
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		const patch = {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		return {
			...(baseFields || {}),
			...patch,
		};
	}

	clickPlot(){
		const nextFields = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(!nextFields){
			return;
		}
		if(nextFields.date && nextFields.time && nextFields.zone){
			this.onFieldsChange({
				date: nextFields.date,
				time: nextFields.time,
				ad: nextFields.ad,
				zone: nextFields.zone,
			});
		}
		this.requestNongli(nextFields);
	}

	onGenderChange(val) {
		this.onOptionChange('sex', val === 0 ? '女' : '男');
		this.onFieldsChange({
			gender: { value: val },
		});
	}

	changeGeo(rec) {
		this.onFieldsChange({
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		});
	}

	genParams(fields) {
		const flds = fields || this.props.fields;
		if (!flds) {
			return null;
		}
		return {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: flds.gender.value,
			after23NewDay: 0,
		};
	}

	recalc(fields, nongli, options) {
		const pan = calcTaiyi(fields || this.props.fields, nongli || this.state.nongli, options || this.state.options);
		this.setState({ pan }, () => {
			if (pan) {
				saveModuleAISnapshot('taiyi', buildTaiyiSnapshotText(pan));
			}
		});
	}

	async requestNongli(fields) {
		const params = this.genParams(fields);
		if(!params){
			return;
		}
		const result = await fetchPreciseNongli(params);
		if(!result){
			if(!this.unmounted){
				this.setState({ nongli: null, pan: null, loading: false });
			}
			return;
		}
		setNongliLocalCache(params, result);
		if (this.unmounted) {
			return;
		}
		const pan = calcTaiyi(fields || this.props.fields, result, this.state.options);
		this.setState({
			nongli: result,
			pan,
			loading: false,
		}, () => {
			if (pan) {
				saveModuleAISnapshot('taiyi', buildTaiyiSnapshotText(pan));
			}
		});
	}

	onOptionChange(key, value) {
		const options = {
			...this.state.options,
			[key]: value,
		};
		this.setState({ options }, () => {
			this.recalc(this.props.fields, this.state.nongli, options);
		});
	}

	polarPoint(cx, cy, r, angleDeg) {
		const rad = angleDeg * Math.PI / 180;
		return {
			x: cx + r * Math.cos(rad),
			y: cy + r * Math.sin(rad),
		};
	}

	renderLeft() {
		const pan = this.state.pan;
		if (!pan) {
			return <Card bordered={false}>暂无太乙盘数据</Card>;
		}
		const width = 860;
		const height = 720;
		const centerX = 430;
		const centerY = 360;
		const r0 = 78;
		const r1 = 124;
		const r2 = 172;
		const r3 = 222;
		const r4 = 304;
		const stroke = '#111';
		const textColor = '#111';
		const textWeight = '500';
			const palaceInfo = {};
			(pan.palaces || []).forEach((p) => {
				palaceInfo[p.palace] = p.items || [];
			});
			const layer5 = LAYER3_BRANCH_GUA.map((p) => (palaceInfo[p] ? palaceInfo[p].slice(0) : []));
			const ganzhiCompact = pan && pan.ganzhi
				? [pan.ganzhi.year || '—', pan.ganzhi.month || '—', pan.ganzhi.day || '—', pan.ganzhi.time || '—'].join('/')
				: '—';
			const topLeftInfo = [
				`农历:${pan.lunarText || '—'}`,
				`真太阳时:${pan.realSunTime || '—'}`,
				`干支:${ganzhiCompact}`,
				`节气:${pan.jiedelta || '—'}`,
			];
			const bottomRightInfo = [
				`积数:${pan.accNum}`,
				`命式:${pan.zhao}`,
				`局:${pan.kook ? pan.kook.text : ''}`,
				`定算:${pan.setCal}`,
				`主算:${pan.homeCal}`,
			`客算:${pan.awayCal}`,
			`太乙数:${pan.taiyiNum}`,
		];
		return (
			<div>
				<Card bordered={false}>
					<div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
						<svg
							viewBox={`0 0 ${width} ${height}`}
							style={{ width: '100%', maxWidth: 860, background: 'transparent', textRendering: 'geometricPrecision' }}
						>
							<circle cx={centerX} cy={centerY} r={r0} fill="none" stroke={stroke} strokeWidth="2.5" />
							<circle cx={centerX} cy={centerY} r={r1} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r2} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r3} fill="none" stroke={stroke} strokeWidth="2" />
							<circle cx={centerX} cy={centerY} r={r4} fill="none" stroke={stroke} strokeWidth="2.5" />

								<text
									x={20}
									y={30}
									textAnchor="start"
									dominantBaseline="hanging"
									fill={textColor}
									stroke="none"
									fontSize="15"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									{topLeftInfo.map((line, lineIdx) => (
										<tspan key={`ty_meta_${lineIdx}`} x={20} dy={lineIdx === 0 ? 0 : 20}>
											{line}
										</tspan>
									))}
								</text>
								<text
									x={width - 20}
									y={height - 20 - ((bottomRightInfo.length - 1) * 20)}
									textAnchor="end"
									dominantBaseline="hanging"
									fill={textColor}
									stroke="none"
									fontSize="15"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									{bottomRightInfo.map((line, lineIdx) => (
										<tspan key={`ty_meta_bottom_${lineIdx}`} x={width - 20} dy={lineIdx === 0 ? 0 : 20}>
											{line}
										</tspan>
									))}
								</text>

							{LAYER2_NUMS.map((_, idx) => {
								const angle = -112.5 + idx * 45;
								const p1 = this.polarPoint(centerX, centerY, r0, angle);
								const p2 = this.polarPoint(centerX, centerY, r1, angle);
								return (
									<line
										key={`l2_line_${idx}`}
										x1={p1.x}
										y1={p1.y}
										x2={p2.x}
										y2={p2.y}
										stroke={stroke}
										strokeWidth="1.8"
									/>
								);
							})}

							{LAYER3_BRANCH_GUA.map((_, idx) => {
								const angle = -101.25 + idx * 22.5;
								const p1 = this.polarPoint(centerX, centerY, r1, angle);
								const p2 = this.polarPoint(centerX, centerY, r4, angle);
								return (
									<line
										key={`l345_line_${idx}`}
										x1={p1.x}
										y1={p1.y}
										x2={p2.x}
										y2={p2.y}
										stroke={stroke}
										strokeWidth="1.5"
									/>
								);
							})}

								<text
									x={centerX}
									y={centerY - 12}
									textAnchor="middle"
									dominantBaseline="middle"
									fill={textColor}
									stroke="none"
									fontSize="48"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									五
							</text>
								<text
									x={centerX}
									y={centerY + 30}
									textAnchor="middle"
									dominantBaseline="middle"
									fill={textColor}
									stroke="none"
									fontSize="34"
									fontWeight={textWeight}
									fontFamily={TAIYI_FONT}
								>
									中宫
							</text>

							{LAYER2_NUMS.map((txt, idx) => {
								const angle = -90 + idx * 45;
								const p = this.polarPoint(centerX, centerY, (r0 + r1) / 2, angle);
								return (
									<text
										key={`l2_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="36"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{LAYER3_BRANCH_GUA.map((txt, idx) => {
								const angle = -90 + idx * 22.5;
								const p = this.polarPoint(centerX, centerY, (r1 + r2) / 2, angle);
								return (
									<text
										key={`l3_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="34"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{LAYER4_FIXED.map((txt, idx) => {
								const angle = -90 + idx * 22.5;
								const p = this.polarPoint(centerX, centerY, (r2 + r3) / 2, angle);
								return (
									<text
										key={`l4_txt_${txt}_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="23"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
											{txt}
									</text>
								);
							})}

							{layer5.map((lines, idx) => {
								const angle = -90 + idx * 22.5;
								const p = this.polarPoint(centerX, centerY, (r3 + r4) / 2, angle);
								const merged = (lines || []).filter(Boolean).slice(0, 3);
								if (!merged.length) {
									return null;
								}
								return (
									<text
										key={`l5_txt_${idx}`}
										x={p.x}
										y={p.y}
										textAnchor="middle"
											dominantBaseline="middle"
											fill={textColor}
											stroke="none"
											fontSize="16"
											fontWeight={textWeight}
											fontFamily={TAIYI_FONT}
										>
										{merged.map((ln, lnIdx) => (
											<tspan key={`l5_tspan_${idx}_${lnIdx}`} x={p.x} dy={lnIdx === 0 ? 0 : 18}>
												{ln}
											</tspan>
										))}
									</text>
								);
							})}
						</svg>
					</div>
				</Card>
			</div>
		);
	}

	renderRight() {
		const pan = this.state.pan;
		const opt = this.state.options;
		const fields = this.props.fields || {};
		let datetm = new DateTime();
		if (fields.date && fields.time) {
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if (fields.zone) {
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div>
				<Row gutter={4}>
					<Col span={24}>
						<PlusMinusTime value={datetm} onChange={this.onTimeChanged} hook={this.timeHook} />
					</Col>
					<Col lg={12} xl={8}>
						<Select size="small" value={fields.gender ? fields.gender.value : 1} onChange={this.onGenderChange} style={{ width: '100%' }}>
							<Option value={-1}>未知</Option>
							<Option value={0}>女</Option>
							<Option value={1}>男</Option>
						</Select>
					</Col>
					<Col lg={12} xl={8}>
						<Select size="small" value={opt.style} onChange={(v) => this.onOptionChange('style', v)} style={{ width: '100%' }}>
							{STYLE_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
						</Select>
					</Col>
					<Col lg={12} xl={8}>
						<GeoCoordModal onOk={this.changeGeo} lat={fields.gpsLat && fields.gpsLat.value} lng={fields.gpsLon && fields.gpsLon.value}>
							<Button size="small" style={{ width: '100%' }}>经纬度选择</Button>
						</GeoCoordModal>
					</Col>
					<Col lg={12} xl={8}>
						<Select size="small" value={opt.tn} onChange={(v) => this.onOptionChange('tn', v)} style={{ width: '100%' }}>
							{ACCUM_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
						</Select>
					</Col>
					<Col lg={12} xl={8}>
						<Select size="small" value={opt.tenching} onChange={(v) => this.onOptionChange('tenching', v)} style={{ width: '100%' }}>
							{TENCHING_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{`十精:${item.label}`}</Option>)}
						</Select>
					</Col>
					<Col lg={12} xl={8}>
						<Select size="small" value={opt.rotation} onChange={(v) => this.onOptionChange('rotation', v)} style={{ width: '100%' }}>
							{ROTATION_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
						</Select>
					</Col>
					<Col span={12}>
						<Select size="small" value={opt.sex} onChange={(v) => this.onOptionChange('sex', v)} style={{ width: '100%' }}>
							{SEX_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{`命法:${item.label}`}</Option>)}
						</Select>
					</Col>
					<Col span={12}>
						<Button size="small" type="primary" style={{ width: '100%' }} onClick={this.clickPlot}>起盘</Button>
					</Col>
					<Col span={24} style={{ textAlign: 'right' }}>
						<span>{fields.lon ? fields.lon.value : ''} {fields.lat ? fields.lat.value : ''}</span>
					</Col>
				</Row>

				<Card bordered={false}>
					<div style={{ lineHeight: '26px' }}>
						<div>起盘方式：{getStyleLabel(opt.style)}</div>
						<div>积年方式：{getAccumLabel(opt.tn)}</div>
						<div>太乙：{pan ? `${pan.taiyiPalace}宫` : '—'}</div>
						<div>文昌：{pan ? pan.skyeyes : '—'}</div>
						<div>始击：{pan ? pan.sf : '—'}</div>
						<div>太岁：{pan ? pan.taishui : '—'}</div>
						<div>合神：{pan ? pan.hegod : '—'}</div>
						<div>计神：{pan ? pan.jigod : '—'}</div>
						<Divider style={{ margin: '10px 0' }} />
						<div>定目：{pan ? (pan.se || '—') : '—'}</div>
						<div>主大将/参将：{pan ? `${pan.homeGeneralPalace || '—'}/${pan.homeVGenPalace || '—'}` : '—'}</div>
						<div>客大将/参将：{pan ? `${pan.awayGeneralPalace || '—'}/${pan.awayVGenPalace || '—'}` : '—'}</div>
						<div>定大将/参将：{pan ? `${pan.setGeneralPalace || '—'}/${pan.setVGenPalace || '—'}` : '—'}</div>
						<div>君臣民基：{pan ? `${pan.kingbase || '—'}/${pan.officerbase || '—'}/${pan.pplbase || '—'}` : '—'}</div>
						<div>四神/天乙/地乙：{pan ? `${pan.fgd || '—'}/${pan.skyyi || '—'}/${pan.earthyi || '—'}` : '—'}</div>
						<div>直符/飞符：{pan ? `${pan.zhifu || '—'}/${pan.flyfu || '—'}` : '—'}</div>
						<div>五福/帝符/太尊：{pan ? `${pan.wufuPalace || '—'}/${pan.kingfu || '—'}/${pan.taijun || '—'}` : '—'}</div>
						<div>飞鸟：{pan ? (pan.flybird || '—') : '—'}</div>
						<div>三风/五风/八风：{pan ? `${pan.threewindPalace || '—'}/${pan.fivewindPalace || '—'}/${pan.eightwindPalace || '—'}` : '—'}</div>
						<div>大游/小游：{pan ? `${pan.bigyoPalace || '—'}/${pan.smyoPalace || '—'}` : '—'}</div>
					</div>
					</Card>
				</div>
		);
	}

	render() {
		let height = this.props.height ? this.props.height : 760;
		if (height === '100%') {
			height = 'calc(100% - 70px)';
		} else {
			height = height - 20;
		}
		return (
			<div style={{ minHeight: height }}>
				<Spin spinning={this.state.loading}>
					<Row gutter={6}>
						<Col span={16}>
							{this.renderLeft()}
						</Col>
						<Col span={8}>
							{this.renderRight()}
						</Col>
					</Row>
				</Spin>
			</div>
		);
	}
}

export default TaiYiMain;
