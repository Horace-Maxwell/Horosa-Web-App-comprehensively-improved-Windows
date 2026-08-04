import React from 'react';
import { useEffect } from 'react';
import { Form, Row, Col,   } from 'antd';
import { preventEnterPress } from '../../utils/helper';
import LatInput from './LatInput';
import LonInput from './LonInput';
import PlusMinusTime from './PlusMinusTime';
import GeoCoordModal from '../amap/GeoCoordModal';
import * as AstroHelper from '../astro/AstroHelper';
import DateTime from '../comp/DateTime';
import { XQButton as Button, XQInput as Input, XQSelect as Select } from '../xq-ui';
import XQIcon from '../xq-icons';

export default function AstroDirectionForm(props){
	let [form] = Form.useForm();
    const { setFieldsValue, getFieldValue, } = form;
    const FormItem = Form.Item;
	const Option = Select.Option;
	
	function formFieldsChanged(changedFields, allFields){
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

	let height = 300;
	if(geo === false){
		height = 250;
	}

	let startD = props.startDate ? props.startDate.value : new DateTime();
	let dt = startD.clone();
	dt.addDate(1);

	return (
		<div className="horosa-direction-form" style={{minHeight: height}}>
			<Form onFinish={handleSubmit} onKeyPress={preventEnterPress}
				onFieldsChange={formFieldsChanged}
				fields={props.fieldsAry}
				form={form}
			>
				<div style={{display: 'none'}}>
				<FormItem name='gpsLat'><Input type='hidden' /></FormItem>
				<FormItem name='gpsLon'><Input type='hidden' /></FormItem>
				</div>
				<Row>
					<Col span={24}>
						<FormItem name='datetime'>
							<PlusMinusTime
								onlyYear={props.onlyYear}
								yearMonth={props.yearMonth}
								needZone={props.needZone}
								disablePreStartTime={true}
								startTime={dt}
								onAfterChanged={afterChanged}
								onStepSelect={props.onStepSelect || (()=>{ /* R4-B4 错轴止血:本表单被七个推运
									子页(法达/小限/日返/月返/太阳弧…)共用,时间轴=各自推运时刻,全局选步长
									handler 预取 natal /chart 是错轴空烧;缺省空函数屏蔽,宿主可传正轴预取器。 */ })}
							/>
						</FormItem>
					</Col>
				</Row>
				<Row gutter={12}>
					{
						needNodeRetrograde && (
							<Col span={8}>
								<FormItem
									name='nodeRetrograde'
									label='南北交逆移'
									labelCol={{ span: 24 }}
									wrapperCol={{ span: 24 }}							
								>
									<Select>
										<Option value={true}>是</Option>
										<Option value={false}>否</Option>
									</Select>
								</FormItem>
							</Col>	
						)
					}
					<Col span={16}>
						<FormItem
							name='asporb'
							label='行运星与本命星交角容许度'
							labelCol={{ span: 24 }}
							wrapperCol={{ span: 24 }}					
						>
							<Select>
								<Option value={-1}>双星容许度相加除以2</Option>
								<Option value={0.5}>0.5度</Option>
								<Option value={1}>1度</Option>
								<Option value={1.5}>1.5度</Option>
								<Option value={2}>2度</Option>
								<Option value={2.5}>2.5度</Option>
								<Option value={3}>3度</Option>
								<Option value={4}>4度</Option>
							</Select>
						</FormItem>

					</Col>
				</Row>

				{
					geo && (
						<div>
						<Row>
							<Col span={24}>
								<FormItem name='lat'>
									<LatInput oneRow={true} />
								</FormItem>
							</Col>
						</Row>
						<Row>
							<Col span={24}>
								<FormItem name='lon'>
									<LonInput  oneRow={true}/>
								</FormItem>
							</Col>
						</Row>
						<Row gutter={12}>
							<Col span={12}>
								<GeoCoordModal 
									onOk={changeGeo}
									lat={getFieldValue('gpsLat')} lng={getFieldValue('gpsLon')}
								>
									<Button>经纬度选择</Button>
								</GeoCoordModal>
							</Col>
							<Col span={12}>
								<FormItem>
									<Button icon={<XQIcon name="search" />} type="primary" htmlType="submit">提交</Button>
								</FormItem>
							</Col>
						</Row>	
						</div>
					)
				}
				{
					geo === false && (
						<Row>
							<Col offset={8} span={16}>
								<FormItem>
									<Button icon={<XQIcon name="search" />} type="primary" htmlType="submit">提交</Button>
								</FormItem>
							</Col>
						</Row>	
					)
				}
			</Form>
		</div>
	);
    

}
