import React from 'react';
import { useEffect } from 'react';
import { Form, Row, Col,   } from 'antd';
import { preventEnterPress } from '../../utils/helper';
import LatInput from './LatInput';
import LonInput from './LonInput';
import CompactTimeField, { dateTimeOf } from '../comp/CompactTimeField';
import { SideSection } from './progPageLayout';
import GeoCoordModal from '../amap/GeoCoordModal';
import * as AstroHelper from '../astro/AstroHelper';
import DateTime from '../comp/DateTime';
import { XQButton as Button, XQInput as Input, XQSelect as Select } from '../xq-ui';
import XQIcon from '../xq-icons';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { directionAsporbOptions } from '../../constants/directionAspOrb';

// FormItem 注入的 onChange 写回表单值;onAfterChanged 交宿主重算(与原 PlusMinusTime 的两路回调同义)
function DirectionTimeField({ value, onChange, onAfterChanged, ...rest }){
	return (
		<CompactTimeField {...rest} value={value} onChange={(res)=>{
			if(onChange){ onChange(res); }
			if(onAfterChanged){ onAfterChanged(res); }
		}} />
	);
}

export default function AstroDirectionForm(props){
	let [form] = Form.useForm();
    const { setFieldsValue, getFieldValue, } = form;
    const FormItem = Form.Item;
	const Option = Select.Option;
	
	function formFieldsChanged(changedFields, allFields){
		// 用户亲手改「南北交逆移」→ 落盘(显示该控件的三页 —— 小限法 / 太阳弧 / 行星弧 —— 同一个值)。antd 只在用户操作控件时触发本回调,
		// 宿主页用 fields 回灌表单不触发;「容许度」不落(初值归全局星盘设置管)。
		let settingChanged = false;
		(changedFields || []).forEach((f)=>{
			const nm = f && f.name ? (Array.isArray(f.name) ? f.name[0] : f.name) : null;
			if(nm === 'nodeRetrograde' && typeof f.value === 'boolean'){ DIRECTION_PAGE_SETTINGS.save({ nodeRetrograde: f.value }); }
			if(nm === 'nodeRetrograde' || nm === 'asporb'){ settingChanged = true; }
		});
        if(props.onFieldsChange){
			let flds = {};
			for(let fld of allFields){
				let obj = {
					value: fld.value,
					name: fld.name,
				}
				flds[fld.name] = obj;
			}
            props.onFieldsChange(flds);
        }
		// 改设置即重算(与改时间同一条路):等宿主把新设置写进 state 后的下一拍再提交,提交读的是宿主 state 里的设置
		if(settingChanged){
			setTimeout(()=>{
				const cur = dateTimeOf(getFieldValue('datetime')) || (props.datetime && dateTimeOf(props.datetime.value));
				if(cur){ afterChanged({ time: cur, ad: cur.ad }); }
			}, 0);
		}
	}

    function handleSubmit(values){
		if(props.onSubmit){
			props.onSubmit(values);
		}
	}

	function afterChanged(dt){
		if(props.onSubmit){
			let values = {
				datetime: dt.time,
				lat: props.lat.value,
				lon: props.lon.value,
				gpsLat: props.gpsLat ? props.gpsLat.value : null,
				gpsLon: props.gpsLon ? props.gpsLon.value : null,
				ad: dt.ad,
				zone: dt.time.zone,
			};
			props.onSubmit(values);
		}		
	}

    function changeGeo(geo){
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

        setFieldsValue({
            lat: lat,
			lon: lon,
			gpsLat: gps.lat,
			gpsLon: gps.lon,			
        });       
    }


	let geo = false;
	if(props.geo){
		geo = true;
	}
	let needNodeRetrograde = true;
	if(props.ignoreNodeRetrograde){
		needNodeRetrograde = false;
	}

	// 设置栅格两格一行:容许度在格数为奇数时补成整行;extraControls 可以是 Fragment 里放好几格
	const extraCount = !props.extraControls ? 0 : (props.extraControls.type === React.Fragment ? React.Children.count(props.extraControls.props.children) : 1);
	let startD = props.startDate ? props.startDate.value : new DateTime();
	let dt = startD.clone();
	dt.addDate(1);

	// 版式与星运其它带盘页同一套(progPageLayout):「时间选择」紧凑时间块 →「设置」两格一行;
	// 改设置即重算(不再要「提交」);只有手输经纬度的返照 / 流年页在地点下面并排放「经纬度选择」「按此地点重算」。
	return (
		<div className="horosa-direction-form">
			<Form onFinish={handleSubmit} onKeyPress={preventEnterPress}
				onFieldsChange={formFieldsChanged}
				fields={props.fieldsAry}
				form={form}
			>
				<div style={{display: 'none'}}>
				<FormItem name='gpsLat'><Input type='hidden' /></FormItem>
				<FormItem name='gpsLon'><Input type='hidden' /></FormItem>
				</div>
				<SideSection title="时间选择" extra={props.onlyYear ? '按年推' : (props.yearMonth ? '按月推' : '当地时间')}>
					<FormItem name='datetime' noStyle>
						{/* 与左栏同一个紧凑时间块:单击编辑器(按住拖动调单位)、双击键入 14 位数字、下面一行步进;FormItem 注入 value / onChange */}
						<DirectionTimeField
							inline
							label={null}
							hint={null}
							onlyYear={props.onlyYear}
							yearMonth={props.yearMonth}
							needZone={props.needZone}
							startTime={dt}
							onAfterChanged={afterChanged}
							onStepSelect={props.onStepSelect || (()=>{ /* R4-B4 错轴止血:本表单被七个推运
								子页(法达/小限/日返/月返/太阳弧…)共用,时间轴=各自推运时刻,全局选步长
								handler 预取 natal /chart 是错轴空烧;缺省空函数屏蔽,宿主可传正轴预取器。 */ })}
						/>
					</FormItem>
				</SideSection>
				<SideSection title={props.settingsTitle || '设置'}>
					<Row gutter={12}>
						{props.extraControls || null}
						{
							needNodeRetrograde && (
								<Col span={12}>
									<div className="horosa-balbillus-label">南北交逆移</div>
									<FormItem name='nodeRetrograde' noStyle>
										<Select style={{ width: '100%' }}>
											<Option value={true}>是</Option>
											<Option value={false}>否</Option>
										</Select>
									</FormItem>
								</Col>
							)
						}
						<Col span={(extraCount + (needNodeRetrograde ? 1 : 0)) % 2 === 1 ? 12 : 24}>
							<div className="horosa-balbillus-label">交角容许度(行运星与本命星)</div>
							<FormItem name='asporb' noStyle>
								<Select style={{ width: '100%' }}>
									{/* 「双星容许度相加除以2」(-1)只在返照 / 小限那条 getAspects 路径上成立;
									    太阳弧 / 行星弧走 solararc.compute,<0 直接按 1° 处理 —— 该档与「1度」逐字同结果。
									    弧类页面传 hideMeanOrb 隐掉它,不留「选了没差别」的档(实现不动,只藏档)。 */}
									{directionAsporbOptions(!!props.hideMeanOrb).map((o)=><Option key={`${o.value}`} value={o.value}>{o.label}</Option>)}
								</Select>
							</FormItem>
						</Col>
					</Row>
					{
						geo && (
							<div style={{ marginTop: 10 }}>
								<div className="horosa-balbillus-label">{props.geoLabel || '地点'}</div>
								{/* 纬度 / 经度并排一行(右栏放不下时自动折成两行) */}
								<div className="horosa-geo-pair">
									<FormItem name='lat' noStyle>
										<LatInput oneRow={true} />
									</FormItem>
									<FormItem name='lon' noStyle>
										<LonInput oneRow={true} />
									</FormItem>
								</div>
								<Row gutter={12}>
									<Col span={12}>
										<GeoCoordModal
											onOk={changeGeo}
											lat={getFieldValue('gpsLat')} lng={getFieldValue('gpsLon')}
										>
											<Button style={{ width: '100%' }} iconName="globe">经纬度选择</Button>
										</GeoCoordModal>
									</Col>
									<Col span={12}>
										<Button style={{ width: '100%' }} icon={<XQIcon name="search" />} type="primary" htmlType="submit">按此地点重算</Button>
									</Col>
								</Row>
							</div>
						)
					}
				</SideSection>
			</Form>
		</div>
	);
}
