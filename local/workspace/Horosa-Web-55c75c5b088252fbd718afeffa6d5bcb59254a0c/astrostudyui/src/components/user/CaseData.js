import { Component } from 'react';
import { Row, Col } from 'antd';
import LatInput from '../astro/LatInput';
import LonInput from '../astro/LonInput';
import DateTimeSelector from '../comp/DateTimeSelector';
import EditableTags from '../comp/EditableTags';
import * as AstroHelper from '../astro/AstroHelper';
import GeoCoordModal from '../amap/GeoCoordModal';
import { applyDstToFields } from '../../utils/timezone';
import { applyGeoNameToFields } from '../../utils/geoName';
import DstZoneIndicator from '../comp/DstZoneIndicator';
import { CASE_TYPE_OPTIONS, getCaseTypeMeta, listLocalCases, upsertLocalCase } from '../../utils/localcases';
import RecordRevisionsModal from '../common/RecordRevisionsModal';
import { RecordJournalModal } from '../common/RecordToolsModals';
import { XQButton, XQInput, XQSelect, XQTextArea } from '../xq-ui';

const Option = XQSelect.Option;

export default class CaseData extends Component{
	constructor(props) {
		super(props);
		this.state = {
			orgFields: this.props.fields,
			fields: {
				...this.props.fields,
			},
			// [V6 复查轮] 历史版本/断事日志 Modal 开关(与命盘编辑页 ChartData 同款;事盘内核
			// 本就双 kind 记版本与日志,此前只缺查看入口 —— 「入口进每个盘的编辑页」含事盘)。
			revisionsOpen: false,
			journalOpen: false,
		};
		this.submitted = false;
		this.zoneManual = false;
		this.setValue = this.setValue.bind(this);
		this.changeDivTime = this.changeDivTime.bind(this);
		this.changeGender = this.changeGender.bind(this);
		this.changeMemo = this.changeMemo.bind(this);
		this.changeIsPub = this.changeIsPub.bind(this);
		this.changeGroup = this.changeGroup.bind(this);
		this.changeEvent = this.changeEvent.bind(this);
		this.changeCaseType = this.changeCaseType.bind(this);
		this.changePos = this.changePos.bind(this);
		this.changeLat = this.changeLat.bind(this);
		this.changeLon = this.changeLon.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.applySuggestedZone = this.applySuggestedZone.bind(this);
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

	// [V6 复查轮] 取当前编辑事盘的完整记录(历史/日志 Modal 用):按 cid 从库读最新态。
	currentRecord(){
		try{
			const cid = this.state.fields && this.state.fields.cid ? this.state.fields.cid.value : null;
			if(!cid){
				return null;
			}
			return listLocalCases({ includeArchived: true }).find((r)=>r && r.cid === cid) || null;
		}catch(_e){
			return null;
		}
	}

	changeDivTime(val){
		const tm = val.value;
		const flds = this.state.fields;
		const prevZone = flds.zone.value;
		const prevDate = (flds.divTime.value && flds.divTime.value.format) ? flds.divTime.value.format('YYYY-MM-DD') : null;
		const newZone = tm.zone;
		const newDate = tm.format ? tm.format('YYYY-MM-DD') : null;
		flds.divTime.value = tm.clone();
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
	}

	changeIsPub(val){
		this.setValue('isPub', val);
	}

	// 性别:下拉哨兵值 -1=未指定 → 存 null(不落库);0=女 合法值,禁真值判断。
	changeGender(val){
		this.setValue('gender', val === -1 ? null : val);
	}

	changeGroup(val){
		this.setValue('group', val);
	}

	changeEvent(e){
		this.setValue('event', e.target.value);
	}

	// [R4] 事盘备注(断后复盘/应期回填);旧 currentCase 无 memo 槽时补建,防 setValue 取 undefined 炸。
	changeMemo(e){
		const flds = this.state.fields;
		if(!flds.memo){
			flds.memo = { name: ['memo'], value: null };
		}
		this.setValue('memo', e.target.value);
	}

	changeCaseType(val){
		const flds = this.state.fields;
		flds.caseType.value = val;
		if(flds.sourceModule){
			const meta = getCaseTypeMeta(val);
			flds.sourceModule.value = meta.module || val;
		}
		this.setState({
			fields: flds,
		});
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
		if(!this.zoneManual){
			applyDstToFields(flds);
		}
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
		if(!this.zoneManual){
			applyDstToFields(flds);
		}
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
		const lat = latdeg[0] + latdir + (latdeg[1] < 10 ? '0' + latdeg[1] : latdeg[1]);
		const lon = londeg[0] + londir + (londeg[1] < 10 ? '0' + londeg[1] : londeg[1]);
		const flds = this.state.fields;
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
		const flds = this.state.fields;
		this.zoneManual = false;
		applyDstToFields(flds);
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

				<DstZoneIndicator fields={flds} marginTop={10} onApply={this.applySuggestedZone} />

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col span={24}>
						<Row>
							<Col span={24}>事件：</Col>
							<Col span={24}>
								<XQTextArea
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
					<Col span={24}>
						<Row>
							<Col span={24}>备注（断后复盘/应期回填，可留空）：</Col>
							<Col span={24}>
								<XQTextArea
									placeholder='备注'
									value={flds.memo ? flds.memo.value : null}
									onChange={this.changeMemo}
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
								<XQSelect value={flds.caseType.value} onChange={this.changeCaseType} style={{ width: '100%' }}>
									{CASE_TYPE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={12}>
						<Row>
							<Col span={24}>起课地：</Col>
							<Col span={24}>
								<XQInput placeholder='起课地' value={flds.pos.value} onChange={this.changePos} />
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
								<GeoCoordModal onOk={this.changeGeo} lat={flds.gpsLat.value} lng={flds.gpsLon.value} date={flds.divTime ? flds.divTime.value : undefined}>
									<XQButton>经纬度选择</XQButton>
								</GeoCoordModal>
							</Col>
						</Row>
					</Col>
				</Row>

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col span={8}>
						<Row>
							<Col span={24}>求测人性别：</Col>
							<Col span={24}>
								<XQSelect
									value={flds.gender && flds.gender.value !== undefined && flds.gender.value !== null ? flds.gender.value : -1}
									onChange={this.changeGender}
									style={{ width: '100%' }}
								>
									<Option value={-1}>未指定</Option>
									<Option value={1}>男</Option>
									<Option value={0}>女</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
					{/* [R4] 「是否公开」控件已隐藏:纯本地桌面版无发布语义(isPub 槽与数据字段保留,旧档兼容)。 */}
				</Row>

				<Row gutter={12} style={{ marginTop: margintop }}>
					<Col span={24}>
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
						<XQButton type='primary' onClick={this.clickOk}>{okTitle}</XQButton>
					</Col>
					<Col span={12}>
						<XQButton onClick={this.clickReturn}>{returnTitle}</XQButton>
						{/* [V6 复查轮] 历史版本/断事日志入口(与命盘编辑页同款;仅编辑已存事盘时显示) */}
						{flds.cid && flds.cid.value ? (
							<>
								<XQButton style={{ marginLeft: 8 }} onClick={()=>this.setState({ revisionsOpen: true })} title='查看该事盘历史版本(每次修改自动留存最近 10 版),可恢复为副本'>历史版本</XQButton>
								<XQButton style={{ marginLeft: 8 }} onClick={()=>this.setState({ journalOpen: true })} title='断事日志:多条带时间戳的跟进记录,随记录导出/备份全链保留'>断事日志</XQButton>
							</>
						) : null}
					</Col>
				</Row>
				{flds.cid && flds.cid.value ? (
					<>
						<RecordRevisionsModal
							visible={!!this.state.revisionsOpen}
							storeLabel='case'
							record={this.currentRecord()}
							onClose={()=>this.setState({ revisionsOpen: false })}
							onRestoreAsCopy={(snap)=>{
								const dup = { ...snap };
								delete dup.cid;
								delete dup.schemaVersion;
								dup.event = `${dup.event || ''}(历史版)`;
								upsertLocalCase(dup);
							}}
						/>
						<RecordJournalModal
							visible={!!this.state.journalOpen}
							kind='case'
							record={this.state.journalOpen ? this.currentRecord() : null}
							onClose={()=>this.setState({ journalOpen: false })}
							onChanged={()=>{ this.forceUpdate(); }}
						/>
					</>
				) : null}
			</div>
		);
	}
}
