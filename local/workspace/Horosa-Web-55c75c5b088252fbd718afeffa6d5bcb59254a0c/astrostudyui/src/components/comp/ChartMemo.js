import * as forge from 'node-forge';
import { Component } from 'react';
import { Row, Col, Tabs, Select, Button, Modal, Spin } from 'antd';
import RichEditor from '../RichEditor';

const Option = Select.Option;
class ChartMemo extends Component{
	constructor(props) {
		super(props);

		this.changingType = false;
		this.currentSubTab = this.props.currentSubTab;
		this.currentTab = this.props.currentTab;
		this.cid = null;
		this.newval = false;

		this.clickSave = this.clickSave.bind(this);
		this.changeMemo = this.changeMemo.bind(this);
		this.changeType = this.changeType.bind(this);
	}

	changeMemo(txt){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/save',
				payload:{
					memo: txt,
				}
			});
		}
	}

	changeType(val){
		this.changingType = true;
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/save',
				payload:{
					memoType: val,
				}
			});
		}
	}

	clickSave(){
		let chart = this.props.currentChart;
		if(chart === undefined || chart === null || 
			chart.cid.value === undefined || chart.cid.value === null){
			return;
		}
		if(this.props.dispatch){
			let raw = forge.util.createBuffer(this.props.memo, "utf8").bytes();
			let val = forge.util.encode64(raw);
			this.props.dispatch({
				type: 'user/saveMemo',
				payload: {
					cid: chart.cid.value,
					type: this.props.memoType,
					memo: val,
					orgMemo: this.props.memo,
				}
			});
		}
	}

	componentWillUpdate(){
		this.newval = false;
		if(this.changingType){
			this.newval = true;
			this.changingType = false;
		}
		if(this.currentTab !== this.props.currentTab ||
			this.currentSubTab !== this.props.currentSubTab){
			this.newval = true;
			this.currentTab = this.props.currentTab;
			this.currentSubTab = this.props.currentSubTab;
		}

		let chart = this.props.currentChart ? this.props.currentChart : {cid:{value: -1}};
		if(this.cid !== chart.cid.value){
			this.newval = true;
			this.cid = chart.cid.value
		}
	}


	render(){
		let delta = 120;
		let height = this.props.height - delta ? this.props.height : document.documentElement.clientHeight - delta;
		let editheight = height - 30;
		let name = '';
		let dt = '';
		let type = this.props.memoType ? this.props.memoType : 0;
		let memo = this.props.memo ? this.props.memo : '';

		let readonly = false;
		let chart = this.props.currentChart;
		if(chart === undefined || chart === null || 
			chart.cid.value === undefined || chart.cid.value === null){
			readonly = true;
			this.newval = true;
		}else{
			if(this.props.userInfo && this.props.userInfo.uid !== chart.creator.value){
				readonly = true;
				this.newval = true;
			}
			name = chart.name.value;
			dt = chart.birth.value.format('yyyy-MM-dd hh:mm:ss');
		}

		let typesel = (
			<Select style={{width: '100%'}} onChange={this.changeType} value={type}>
				<Option value={0}>星盘</Option>
				<Option value={1}>八字</Option>
				<Option value={2}>紫微斗数</Option>
				<Option value={3}>七政四余</Option>
				<Option value={4}>易卦</Option>
				<Option value={5}>六壬</Option>
				<Option value={6}>奇门遁甲</Option>
				<Option value={7}>宿盘</Option>
			</Select>
		);
		if(readonly){
			typesel = (
				<span>请先保存星盘到本地，再进行批注。</span>
			);
		}

		let loading = this.props.loading ? this.props.loading : false;

		return (
			<Spin spinning={loading} size="large" tip="保存中...">
			<div style={{height: height}}>
				<Row gutter={12} style={{marginBottom: 10}}>
					<Col span={12}>
						{typesel}
					</Col>
					<Col span={12} style={{textAlign: 'right'}}>
						{
							!readonly && (<Button onClick={this.clickSave}>保存</Button>)
						}						
					</Col>
					<Col span={14}>{name}</Col>
					<Col span={10} style={{textAlign: 'right'}}>{dt}</Col>
				</Row>
				<RichEditor 
					height={editheight} 
					readOnly={readonly}
					value={memo} 
					onChange={this.changeMemo} 
				/>
			</div>
			</Spin>
		);
	}
}

export default ChartMemo;
