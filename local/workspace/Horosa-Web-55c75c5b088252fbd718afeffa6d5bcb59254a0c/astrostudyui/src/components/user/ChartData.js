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
import { XQButton, XQInput, XQSelect, XQTextArea } from '../xq-ui';
import RecordRevisionsModal from '../common/RecordRevisionsModal';
import { RecordJournalModal } from '../common/RecordToolsModals';
import { listLocalCharts, upsertLocalChart } from '../../utils/localcharts';

const Option = XQSelect.Option;

export default class ChartData extends Component{
	constructor(props) {
		super(props);
		this.state = {
			orgFields: this.props.fields,
			fields: {
				...this.props.fields
			},
		}

		this.submitted = false;
		// [V6-UI] 历史版本/断事日志 Modal 开关(仅编辑已存盘时可用)。
		this.zoneManual = false;

		this.setValue = this.setValue.bind(this);
		this.changeBirth = this.changeBirth.bind(this);
		this.changeIsPub = this.changeIsPub.bind(this);
		this.changeGroup = this.changeGroup.bind(this);
		this.changeName = this.changeName.bind(this);
		this.changeGender = this.changeGender.bind(this);
		this.changePos = this.changePos.bind(this);
		this.changeMemo = this.changeMemo.bind(this);
		this.changeRodden = this.changeRodden.bind(this);
		this.changeRelation = this.changeRelation.bind(this);
		this.changeSourceNote = this.changeSourceNote.bind(this);
		this.changeLat = this.changeLat.bind(this);
		this.changeLon = this.changeLon.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.applySuggestedZone = this.applySuggestedZone.bind(this);
		this.clickOk = this.clickOk.bind(this);
		this.clickReturn = this.clickReturn.bind(this);

	}


	setValue(key, val){
		let flds = this.state.fields;
		flds[key].value = val;
		this.setState({
			fields: flds,
		});
	}

	changeBirth(val){
		let tm = val.value;
		let flds = this.state.fields;
		const prevZone = flds.zone.value;
		const prevDate = (flds.birth.value && flds.birth.value.format) ? flds.birth.value.format('YYYY-MM-DD') : null;
		const newZone = tm.zone;
		const newDate = tm.format ? tm.format('YYYY-MM-DD') : null;
		flds.birth.value = tm.clone();
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

	changeGroup(val){
		this.setValue('group', val);
	}

	changeName(e){
		let val = e.target.value;
		this.setValue('name', val);
	}

	changeGender(val){
		this.setValue('gender', val);
	}

	// [V] 通用备注(表单直填);旧 currentChart 无 memo 槽时补建,防 setValue 取 undefined 炸。
	changeMemo(e){
		const flds = this.state.fields;
		if(!flds.memo){
			flds.memo = { name: ['memo'], value: null };
		}
		this.setValue('memo', e.target.value);
	}

	// [V5-UI尾款] 研究三字段(memo 同款防御补槽;Select allowClear 清除=null 不落库)。
	changeRodden(val){
		const flds = this.state.fields;
		if(!flds.rodden){
			flds.rodden = { name: ['rodden'], value: null };
		}
		this.setValue('rodden', val === undefined ? null : val);
	}

	changeRelation(val){
		const flds = this.state.fields;
		if(!flds.relation){
			flds.relation = { name: ['relation'], value: null };
		}
		this.setValue('relation', val === undefined ? null : val);
	}

	changeSourceNote(e){
		const flds = this.state.fields;
		if(!flds.sourceNote){
			flds.sourceNote = { name: ['sourceNote'], value: null };
		}
		this.setValue('sourceNote', e.target.value);
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

	// [V6-UI] 取当前编辑盘的完整记录(历史/日志 Modal 用):按 cid 从库读最新态。
	currentRecord(){
		try{
			const cid = this.state.fields && this.state.fields.cid ? this.state.fields.cid.value : null;
			if(!cid){
				return null;
			}
			return listLocalCharts({ includeArchived: true }).find((r)=>r && r.cid === cid) || null;
		}catch(_e){
			return null;
		}
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

		return (
			<div>
				<Row gutter={12}>
					<Col span={24}>出生时间：</Col>
					<Col span={24}>
						<DateTimeSelector
							showTime={true}
							showAdjust={false}
							onChange={this.changeBirth}
							value={flds.birth.value}
						/>
					</Col>
				</Row>
				<DstZoneIndicator fields={flds} marginTop={10} onApply={this.applySuggestedZone} />
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
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col span={8}>
						<Row>
							<Col span={24}>纬度：</Col>
							<Col span={24}>
								<LatInput
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
									date={flds.birth ? flds.birth.value : undefined}
								>
									<XQButton>经纬度选择</XQButton>
								</GeoCoordModal>
							</Col>
						</Row>
					</Col>
				</Row>
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col span={24}>
						<Row>
							<Col span={24}>备注（可留空）：</Col>
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
				{/* [V5-UI尾款] 研究三字段(全部可留空;present 才落库,旧档零变):
				    可信度=生辰数据可靠等级(录入界面惯例 AA 出生记录/A 本人口述/B 传记/C 无来源/DD 相互矛盾/X 无时间);
				    资料出处=这条生辰从哪来;关系=固定筛选面(区别于自由标签)。 */}
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col span={8}>
						<Row>
							<Col span={24}>生辰可信度：</Col>
							<Col span={24}>
								<XQSelect value={flds.rodden ? flds.rodden.value : null} onChange={this.changeRodden} style={{ width: '100%' }} allowClear placeholder='未评级'>
									<Option value='AA'>AA 出生记录</Option>
									<Option value='A'>A 本人口述</Option>
									<Option value='B'>B 传记资料</Option>
									<Option value='C'>C 来源不明</Option>
									<Option value='DD'>DD 相互矛盾</Option>
									<Option value='X'>X 无出生时间</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>关系：</Col>
							<Col span={24}>
								<XQSelect value={flds.relation ? flds.relation.value : null} onChange={this.changeRelation} style={{ width: '100%' }} allowClear placeholder='未指定'>
									<Option value='self'>自己</Option>
									<Option value='family'>家人</Option>
									<Option value='friend'>朋友</Option>
									<Option value='client'>客户</Option>
									<Option value='other'>其他</Option>
								</XQSelect>
							</Col>
						</Row>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>资料出处：</Col>
							<Col span={24}>
								<XQInput placeholder='如:出生证/家谱/口述' value={flds.sourceNote ? flds.sourceNote.value : null} onChange={this.changeSourceNote} />
							</Col>
						</Row>
					</Col>
				</Row>

				{/* [R4] 「是否公开」控件已隐藏:纯本地桌面版无发布语义(isPub 槽与数据字段保留,旧档兼容)。 */}
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col span={24}>
						<Row>
							<Col span={24}>标签：</Col>
							<Col span={24}>
								<EditableTags
									newTagLabel='添加标签' needConfirm={true}
									value={flds.group.value}
									onChange={this.changeGroup}
								/>
							</Col>
						</Row>
					</Col>
				</Row>
				<Row gutter={12} style={{marginTop: margintop}}>
					<Col offset={2} span={10}>
						<XQButton type='primary' onClick={this.clickOk}>{okTitle}</XQButton>
					</Col>
					<Col span={12}>
						<XQButton onClick={this.clickReturn}>{returnTitle}</XQButton>
						{/* [V6-UI] 历史版本/断事日志入口移入编辑页(用户定谳:批量条太挤,盘级动作跟盘走)。
						    仅编辑已存盘(有 cid)时显示;新建盘尚无历史/日志。 */}
						{flds.cid && flds.cid.value ? (
							<span style={{ marginLeft: 8 }}>
								<XQButton onClick={()=>this.setState({ revisionsOpen: true })} title='查看该盘历史版本(每次修改自动留存最近 10 版),可恢复为副本'>历史版本</XQButton>
								<XQButton style={{ marginLeft: 8 }} onClick={()=>this.setState({ journalOpen: true })} title='断事日志:多条带时间戳的跟进记录,随记录导出/备份全链保留'>断事日志</XQButton>
							</span>
						) : null}
					</Col>
				</Row>
				{flds.cid && flds.cid.value ? (
					<>
						<RecordRevisionsModal
							visible={!!this.state.revisionsOpen}
							storeLabel='chart'
							record={this.currentRecord()}
							onClose={()=>this.setState({ revisionsOpen: false })}
							onRestoreAsCopy={(snap)=>{
								const dup = { ...snap };
								delete dup.cid;
								delete dup.schemaVersion;
								dup.name = `${dup.name || ''}(历史版)`;
								upsertLocalChart(dup);
							}}
						/>
						<RecordJournalModal
							visible={!!this.state.journalOpen}
							kind='chart'
							record={this.state.journalOpen ? this.currentRecord() : null}
							onClose={()=>this.setState({ journalOpen: false })}
							onChanged={()=>{ this.forceUpdate(); }}
						/>
					</>
				) : null}
			</div>
		)
	}

}
