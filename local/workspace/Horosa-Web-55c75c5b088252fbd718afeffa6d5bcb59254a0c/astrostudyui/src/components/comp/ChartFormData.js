import { Component } from 'react';
import { Row, Col } from 'antd';
import LatInput from '../astro/LatInput';
import LonInput from '../astro/LonInput';
import DateTimeSelector from './DateTimeSelector';
import { QuickTimeInput } from './QuickTimeField';
import EditableTags from './EditableTags';
import * as AstroHelper from '../astro/AstroHelper';
import GeoCoordModal from '../amap/GeoCoordModal';
import { applyDstToFields } from '../../utils/timezone';
import { applyGeoNameToFields } from '../../utils/geoName';
import DstZoneIndicator from './DstZoneIndicator';
import {getHousesOption} from './CompHelper';
import { XQButton, XQInput, XQSelect } from '../xq-ui';
import * as AstroConst from '../../constants/AstroConst';

const Option = XQSelect.Option;
const OptGroup = XQSelect.OptGroup;

export default class ChartFormData extends Component{
	constructor(props) {
		super(props);
		this.state = {
			orgFields: this.props.fields,
			fields: {
				...this.props.fields
			},
		}

		this.submitted = false;
		this.zoneManual = false;

		this.setValue = this.setValue.bind(this);
		this.changeBirth = this.changeBirth.bind(this);
		this.quickBirth = this.quickBirth.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.changeHSys = this.changeHSys.bind(this);
		this.changeName = this.changeName.bind(this);
		this.changeGender = this.changeGender.bind(this);
		this.changePos = this.changePos.bind(this);
		this.changeLat = this.changeLat.bind(this);
		this.changeLon = this.changeLon.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.applySuggestedZone = this.applySuggestedZone.bind(this);
		this.changeStrongRecption = this.changeStrongRecption.bind(this);
		this.changeSimpleAsp = this.changeSimpleAsp.bind(this);
		this.changeVirtPntRecvAsp = this.changeVirtPntRecvAsp.bind(this);
			this.changePredictive = this.changePredictive.bind(this);
			this.changeShowPdBounds = this.changeShowPdBounds.bind(this);
			this.changePdtype = this.changePdtype.bind(this);
		this.changePdaspects = this.changePdaspects.bind(this);
		this.changeDoubingSu28 = this.changeDoubingSu28.bind(this);

		this.clickOk = this.clickOk.bind(this);
		this.clickReturn = this.clickReturn.bind(this);

		// perf T-6(speculativePrecompute):表单编辑期防抖预取的调度句柄。
		this.livePrecomputeTimer = null;
	}

	// perf T-6:字段每次变更后 300ms 防抖,把「点提交会发出的同一份参数」提前交给
	// onLivePrecompute(由挂载方决定去暖哪个缓存;未传该 prop = 完全无行为,零影响)。
	// 只读 state.fields 快照转平值,不改任何表单状态。
	scheduleLivePrecompute(){
		if(!this.props.onLivePrecompute){
			return;
		}
		if(this.livePrecomputeTimer){
			clearTimeout(this.livePrecomputeTimer);
		}
		this.livePrecomputeTimer = setTimeout(()=>{
			this.livePrecomputeTimer = null;
			try{
				const flds = this.state.fields || {};
				const params = {};
				for(let key in flds){
					params[key] = flds[key] ? flds[key].value : undefined;
				}
				this.props.onLivePrecompute(params);
			}catch(e){
				// speculative only — never surface
			}
		}, 300);
	}

	componentWillUnmount(){
		if(this.livePrecomputeTimer){
			clearTimeout(this.livePrecomputeTimer);
			this.livePrecomputeTimer = null;
		}
	}

	setValue(key, val){
		let flds = this.state.fields;
		if(!flds[key]){
			flds[key] = {
				value: val,
				name: [key],
			};
		}else{
			flds[key].value = val;
		}
		this.setState({
			fields: flds,
		});
		this.scheduleLivePrecompute();
	}

	// 「快捷输入」行提交:同一条 changeBirth 路(date/time 双写 + 夏令时校正)
	quickBirth(dt){
		this.changeBirth({ value: dt });
	}

	changeBirth(val){
		let tm = val.value;
		let flds = this.state.fields;
		const prevZone = flds.zone.value;
		const prevDate = (flds.date.value && flds.date.value.format) ? flds.date.value.format('YYYY-MM-DD') : null;
		const newZone = tm.zone;
		const newDate = tm.format ? tm.format('YYYY-MM-DD') : null;
		flds.date.value = tm.clone();
		flds.time.value = tm.clone();
		flds.zone.value = newZone;
		if(newZone !== prevZone){
			// 用户手动改了时区 → 标记手动,后续不再自动覆盖
			this.zoneManual = true;
		}else if(newDate !== prevDate && !this.zoneManual){
			// 仅日期变化(可能跨夏令时边界)→ 按新日期重算时区偏移
			applyDstToFields(flds);
		}
		this.setState({
			fields: flds,
		});
		this.scheduleLivePrecompute();
	}

	changeZodiacal(val){
		const parsed = AstroConst.parseZodiacSelectValue(val);
		this.setValue('zodiacal', parsed.zodiacal);
		this.setValue('siderealAyanamsa', parsed.siderealAyanamsa);
	}

	changeHSys(val){
		this.setValue('hsys', val);
	}

	changeName(e){
		let val = e.target.value;
		this.setValue('name', val);
	}

	changeGender(val){
		this.setValue('gender', val);
	}

	changePos(e){
		let val = e.target.value;
		this.setValue('pos', val);
	}

	changeLat(val){
		let flds = this.state.fields;
		let lat = val;
		let lon = flds.lon.value;
		let latdeg = AstroHelper.convertLatStrToDegree(lat);
		let londeg = AstroHelper.convertLonStrToDegree(lon);
		flds.lat.value = lat;
		flds.gpsLat.value = latdeg;
		flds.gpsLon.value = londeg;
		if(!this.zoneManual){
			applyDstToFields(flds);
		}
		this.setState({
			fields: flds,
		});
	}

	changeLon(val){
		let flds = this.state.fields;
		let lat = flds.lat.value;
		let lon = val;
		let latdeg = AstroHelper.convertLatStrToDegree(lat);
		let londeg = AstroHelper.convertLonStrToDegree(lon);
		flds.lon.value = lon;
		flds.gpsLat.value = latdeg;
		flds.gpsLon.value = londeg;
		if(!this.zoneManual){
			applyDstToFields(flds);
		}
		this.setState({
			fields: flds,
		});
	}

	changeGeo(geo){
        let gps = {
            lat: geo.gpsLat,
            lon: geo.gpsLng,
        };
        let latdeg = AstroHelper.splitDegree(gps.lat);
        let londeg = AstroHelper.splitDegree(gps.lon);
        let latdir = 'n';
        let londir = 'e';
        if(londeg[0] < 0 || (londeg[3] && londeg[3].length)){
            londir = 'w';
            londeg[0] = -londeg[0];
            londeg[1] = Math.abs(londeg[1]);
        }
        if(latdeg[0] < 0 || (latdeg[3] && latdeg[3].length)){
            latdir = 's';
            latdeg[0] = -latdeg[0];
            latdeg[1] = Math.abs(latdeg[1]);
        }
        let lat = latdeg[0] + latdir + (latdeg[1] < 10 ? '0' + latdeg[1] : latdeg[1]);
        let lon = londeg[0] + londir + (londeg[1] < 10 ? '0' + londeg[1] : londeg[1]);

		let flds = this.state.fields;
		flds.lat.value = lat;
		flds.lon.value = lon;
		flds.gpsLat.value = gps.lat;
		flds.gpsLon.value = gps.lon;
		if(geo.zone){
			// 用户在选择器内手改了时区 → 尊重覆盖值,不再自动校正。
			flds.zone.value = geo.zone;
			this.zoneManual = true;
		}else{
			this.zoneManual = false;        // 地图选点 = 明确换地点,恢复自动时区校正
			applyDstToFields(flds);
		}
		applyGeoNameToFields(flds, geo);

		this.setState({
			fields: flds,
		});
	}

	// 「改用建议」按钮:恢复自动模式并按地点+日期重算回填(共享 applyDstToFields)。
	applySuggestedZone(){
		let flds = this.state.fields;
		this.zoneManual = false;
		applyDstToFields(flds);
		this.setState({
			fields: flds,
		});
	}

	changeStrongRecption(val){
		this.setValue('strongRecption', val);
	}

	changeSimpleAsp(val){
		this.setValue('simpleAsp', val);
	}

	changeVirtPntRecvAsp(val){
		this.setValue('virtualPointReceiveAsp', val);
	}

	changePredictive(val){
		this.setValue('predictive', val);
	}

	changeShowPdBounds(val){
		this.setValue('showPdBounds', val);
	}

	changePdtype(val){
		this.setValue('pdtype', val);
	}

	changePdaspects(val){
		this.setValue('pdaspects', val);
	}

	changeDoubingSu28(val){
		this.setValue('doubingSu28', val);
	}

	clickOk(){
		// perf T-6:真提交在即,取消未触发的防抖预取(在途请求的合并由 services 层保证,
		// 这里只是避免提交后再发一次冗余投机请求)。
		if(this.livePrecomputeTimer){
			clearTimeout(this.livePrecomputeTimer);
			this.livePrecomputeTimer = null;
		}
		if(this.props.onOk){
			this.submitted = true;
			this.props.onOk(this.state.fields);
		}
	}

	clickReturn(){
		if(this.props.onReturn){
			this.props.onReturn();
		}
	}

	render(){
		let flds = this.state.fields;
		let margintop = 20;
		let okTitle = this.props.okTitle ? this.props.okTitle : '提交';
		let returnTitle = this.props.returnTitle ? this.props.returnTitle : '返回';

		if(this.state.orgFields !== this.props.fields || this.submitted){
			this.submitted = false;
			setTimeout(()=>{
				this.setState({
					orgFields: this.props.fields,
					fields: {
						...this.props.fields,
					}
				});
			}, 500);
		}

		let needDate = true;
		if(this.props.needDate === false){
			needDate = false;
		}

		return (
			<div>
				{
					needDate && (
						<Row gutter={12}>
							<Col span={24}>日期时间：</Col>
							<Col span={24}>
								<DateTimeSelector
									showTime={true}
									showAdjust={false}
									onChange={this.changeBirth}
									value={flds.date.value}
								/>
							</Col>
						</Row>
					)
				}
				{ needDate && <QuickTimeInput value={flds.date.value} zone={flds.zone ? flds.zone.value : undefined} onCommit={this.quickBirth} marginTop={8} /> }
				{ needDate && <DstZoneIndicator fields={flds} onApply={this.applySuggestedZone} /> }
				{
					needDate && (
					<Row gutter={12} style={{marginTop: margintop}}>
						<Col span={8}>
								<Row>
									<Col span={24}>姓名：</Col>
									<Col span={24}>
										<XQInput placeholder='姓名' value={flds.name.value} onChange={this.changeName} />
									</Col>
								</Row>
							</Col>
							<Col span={8}>
								<Row>
									<Col span={24}>性别：</Col>
									<Col span={24}>
										<XQSelect value={flds.gender.value} onChange={this.changeGender} style={{width: '100%'}}>
											<Option value={-1}>未知</Option>
											<Option value={0}>女</Option>
											<Option value={1}>男</Option>
										</XQSelect>
									</Col>
								</Row>
							</Col>
							<Col span={8}>
								<Row>
									<Col span={24}>出生地：</Col>
									<Col span={24}>
										<XQInput placeholder='出生地'
											value={flds.pos.value}
											onChange={this.changePos}
										/>
									</Col>
								</Row>
							</Col>
						</Row>
					)
				}
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col span={8}>
						<Row>
							<Col span={24}>纬度：</Col>
							<Col span={24}>
								<LatInput
									size='small'
									value={flds.lat.value}
									onChange={this.changeLat}
								/>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>经度：</Col>
							<Col span={24}>
								<LonInput
									size='small'
									value={flds.lon.value}
									onChange={this.changeLon}
								/>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>从地图选取经纬度：</Col>
							<Col span={24}>
								<GeoCoordModal
									onOk={this.changeGeo}
									lat={flds.gpsLat.value} lng={flds.gpsLon.value}
								>
									<XQButton>经纬度选择</XQButton>
								</GeoCoordModal>
							</Col>
						</Row>
					</Col>
				</Row>
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col span={8}>
						<Row>
							<Col span={24}>黄道系统：</Col>
							<Col span={24}>
								<XQSelect value={AstroConst.zodiacSelectValue(flds.zodiacal.value, flds.siderealAyanamsa && flds.siderealAyanamsa.value)} onChange={this.changeZodiacal} style={{width: '100%'}} dropdownMatchSelectWidth={false}>
									{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
										<OptGroup label={grp.group} key={grp.group}>
											{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
										</OptGroup>
									))}
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>宫位制：</Col>
							<Col span={24}>
								<XQSelect value={flds.hsys.value} onChange={this.changeHSys} style={{width: '100%'}}>
									{ getHousesOption() }
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>强接纳：</Col>
							<Col span={24}>
								<XQSelect value={flds.strongRecption.value} onChange={this.changeStrongRecption} style={{width: '100%'}}>
									<Option value={1}>是</Option>
									<Option value={0}>否</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
				</Row>
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col span={8}>
						<Row>
							<Col span={24}>简单相位计算：</Col>
							<Col span={24}>
								<XQSelect value={flds.simpleAsp.value} onChange={this.changeSimpleAsp} style={{width: '100%'}}>
									<Option value={1}>是</Option>
									<Option value={0}>否</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>虚拟点能否接收相位：</Col>
							<Col span={24}>
								<XQSelect value={flds.virtualPointReceiveAsp.value} onChange={this.changeVirtPntRecvAsp} style={{width: '100%'}}>
									<Option value={1}>是</Option>
									<Option value={0}>否</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>需要推运：</Col>
							<Col span={24}>
								<XQSelect value={flds.predictive.value} onChange={this.changePredictive} style={{width: '100%'}}>
									<Option value={1}>是</Option>
									<Option value={0}>否</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
				</Row>
					<Row gutter={12} style={{marginTop: margintop}}>
						<Col span={8}>
							<Row>
								<Col span={24}>主限法推进类型：</Col>
								<Col span={24}>
								<XQSelect value={flds.pdtype.value} onChange={this.changePdtype} style={{width: '100%'}}>
									<Option value={0}>zodiaco主限法</Option>
									<Option value={1}>mundo主限法</Option>
									<Option value={2}>界限顺时针推进</Option>
									<Option value={3}>界限逆时针推进</Option>
								</XQSelect>
						</Col>
					</Row>
					<Row gutter={12} style={{marginTop: margintop}}>
						<Col span={8}>
							<Row>
								<Col span={24}>主限法显示界限法：</Col>
								<Col span={24}>
									<XQSelect value={(flds.showPdBounds && flds.showPdBounds.value !== undefined) ? flds.showPdBounds.value : 1} onChange={this.changeShowPdBounds} style={{width: '100%'}}>
										<Option value={1}>是</Option>
										<Option value={0}>否</Option>
									</XQSelect>
								</Col>
							</Row>
						</Col>
					</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>主限法需要的相位：</Col>
							<Col span={24}>
								<XQSelect mode="multiple" value={flds.pdaspects.value} onChange={this.changePdaspects} style={{width: '100%'}}>
									<Option value={0}>0</Option>
									<Option value={30}>30</Option>
									<Option value={45}>45</Option>
									<Option value={60}>60</Option>
									<Option value={90}>90</Option>
									<Option value={120}>120</Option>
									<Option value={135}>135</Option>
									<Option value={150}>150</Option>
									<Option value={180}>180</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>七政四余排盘法：</Col>
							<Col span={24}>
								<XQSelect value={flds.doubingSu28.value} onChange={this.changeDoubingSu28} style={{width: '100%'}}>
									<Option value={0}>现实距星法</Option>
									<Option value={1}>斗柄定房法</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
				</Row>

				<Row gutter={12} style={{marginTop: margintop}}>
					<Col offset={4} span={10}>
						<XQButton type='primary' onClick={this.clickOk}>{okTitle}</XQButton>
					</Col>
				</Row>
			</div>
		)
	}

}
