import { Component } from 'react';
import { Row, Col, Button, Input, Select } from 'antd';
import LatInput from '../astro/LatInput';
import LonInput from '../astro/LonInput';
import DateTimeSelector from '../comp/DateTimeSelector';
import EditableTags from '../comp/EditableTags';
import * as AstroHelper from '../astro/AstroHelper';
import GeoCoordModal from '../amap/GeoCoordModal';
import { CASE_TYPE_OPTIONS } from '../../utils/localcases';

const { TextArea } = Input;
const Option = Select.Option;

export default class CaseData extends Component{
	constructor(props) {
		super(props);
		this.state = {
			orgFields: this.props.fields,
			fields: {
				...this.props.fields,
			},
		};
		this.submitted = false;
		this.setValue = this.setValue.bind(this);
		this.changeDivTime = this.changeDivTime.bind(this);
		this.changeIsPub = this.changeIsPub.bind(this);
		this.changeGroup = this.changeGroup.bind(this);
		this.changeEvent = this.changeEvent.bind(this);
		this.changeCaseType = this.changeCaseType.bind(this);
		this.changePos = this.changePos.bind(this);
		this.changeLat = this.changeLat.bind(this);
		this.changeLon = this.changeLon.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickOk = this.clickOk.bind(this);
		this.clickReturn = this.clickReturn.bind(this);
	}

	setValue(key, val){
		const flds = this.state.fields;
		flds[key].value = val;
		this.setState({
			fields: flds,
		});
	}

	changeDivTime(val){
		const tm = val.value;
		const flds = this.state.fields;
		flds.divTime.value = tm.clone();
		flds.zone.value = tm.zone;
		this.setState({
			fields: flds,
		});
	}

	changeIsPub(val){
		this.setValue('isPub', val);
	}

	changeGroup(val){
		this.setValue('group', val);
	}

	changeEvent(e){
		this.setValue('event', e.target.value);
	}

	changeCaseType(val){
		this.setValue('caseType', val);
	}

	changePos(e){
		this.setValue('pos', e.target.value);
	}

	changeLat(val){
		const flds = this.state.fields;
		const lat = val;
		const lon = flds.lon.value;
		flds.lat.value = lat;
		flds.gpsLat.value = AstroHelper.convertLatStrToDegree(lat);
		flds.gpsLon.value = AstroHelper.convertLonStrToDegree(lon);
		this.setState({
			fields: flds,
		});
	}

	changeLon(val){
		const flds = this.state.fields;
		const lat = flds.lat.value;
		const lon = val;
		flds.lon.value = lon;
		flds.gpsLat.value = AstroHelper.convertLatStrToDegree(lat);
		flds.gpsLon.value = AstroHelper.convertLonStrToDegree(lon);
		this.setState({
			fields: flds,
		});
	}

	changeGeo(geo){
		const gps = {
			lat: geo.gpsLat,
			lon: geo.gpsLng,
		};
		const latdeg = AstroHelper.splitDegree(gps.lat);
		const londeg = AstroHelper.splitDegree(gps.lon);
		let latdir = 'n';
		let londir = 'e';
		if(londeg[0] < 0){
			londir = 'w';
			londeg[0] = -londeg[0];
			londeg[1] = -londeg[1];
		}
		if(latdeg[0] < 0){
			latdir = 's';
			latdeg[0] = -latdeg[0];
			latdeg[1] = -latdeg[1];
		}
		const lat = latdeg[0] + latdir + (latdeg[1] < 10 ? '0' + latdeg[1] : latdeg[1]);
		const lon = londeg[0] + londir + (londeg[1] < 10 ? '0' + londeg[1] : londeg[1]);
		const flds = this.state.fields;
		flds.lat.value = lat;
		flds.lon.value = lon;
		flds.gpsLat.value = gps.lat;
		flds.gpsLon.value = gps.lon;
		this.setState({
			fields: flds,
		});
	}

	clickOk(){
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
		const flds = this.state.fields;
		const margintop = 20;
		const okTitle = this.props.okTitle ? this.props.okTitle : '提交';
		const returnTitle = this.props.returnTitle ? this.props.returnTitle : '返回';

		if(this.state.orgFields !== this.props.fields || this.submitted){
			this.submitted = false;
			setTimeout(()=>{
				this.setState({
					orgFields: this.props.fields,
					fields: {
						...this.props.fields,
					},
				});
			}, 500);
		}

		return (
			<div>
				<Row gutter={12}>
					<Col span={24}>起课事件：</Col>
					<Col span={24}>
						<DateTimeSelector
							showTime={true}
							showAdjust={false}
							onChange={this.changeDivTime}
							value={flds.divTime.value}
						/>
					</Col>
				</Row>

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col span={24}>
						<Row>
							<Col span={24}>事件：</Col>
							<Col span={24}>
								<TextArea
									placeholder='事件'
									value={flds.event.value}
									onChange={this.changeEvent}
									autoSize={{ minRows: 2, maxRows: 6 }}
									style={{ width: '100%', resize: 'both' }}
								/>
							</Col>
						</Row>
					</Col>
				</Row>

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col span={12}>
						<Row>
							<Col span={24}>类型：</Col>
							<Col span={24}>
								<Select value={flds.caseType.value} onChange={this.changeCaseType} style={{ width: '100%' }}>
									{CASE_TYPE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</Col>
						</Row>
					</Col>
					<Col span={12}>
						<Row>
							<Col span={24}>起课地：</Col>
							<Col span={24}>
								<Input placeholder='起课地' value={flds.pos.value} onChange={this.changePos} />
							</Col>
						</Row>
					</Col>
				</Row>

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col span={8}>
						<Row>
							<Col span={24}>纬度：</Col>
							<Col span={24}>
								<LatInput value={flds.lat.value} onChange={this.changeLat} />
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>经度：</Col>
							<Col span={24}>
								<LonInput value={flds.lon.value} onChange={this.changeLon} />
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>从地图选取经纬度：</Col>
							<Col span={24}>
								<GeoCoordModal onOk={this.changeGeo} lat={flds.gpsLat.value} lng={flds.gpsLon.value}>
									<Button>经纬度选择</Button>
								</GeoCoordModal>
							</Col>
						</Row>
					</Col>
				</Row>

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col span={8}>
						<Row>
							<Col span={24}>是否公开：</Col>
							<Col span={24}>
								<Select value={flds.isPub.value} onChange={this.changeIsPub}>
									<Option value={0}>否</Option>
									<Option value={1}>是</Option>
								</Select>
							</Col>
						</Row>
					</Col>
					<Col span={16}>
						<Row>
							<Col span={24}>标签：</Col>
							<Col span={24}>
								<EditableTags
									newTagLabel='添加标签'
									needConfirm={true}
									value={flds.group.value}
									onChange={this.changeGroup}
								/>
							</Col>
						</Row>
					</Col>
				</Row>

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col offset={2} span={10}>
						<Button type='primary' onClick={this.clickOk}>{okTitle}</Button>
					</Col>
					<Col span={12}>
						<Button onClick={this.clickReturn}>{returnTitle}</Button>
					</Col>
				</Row>
			</div>
		);
	}
}

