import moment from 'moment';
import 'moment/locale/zh-cn';
import { Component } from 'react';
import { Button, Input, DatePicker, Row, Col, Table, Pagination, Select, } from 'antd';
import { SelectOutlined, SearchOutlined } from '@ant-design/icons';
import { randomStr } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { TableOddRowBgColor } from '../../utils/constants';

const { Option, } = Select;
const { RangePicker } = DatePicker;
const defRange = { 
	'今天': [moment().startOf('date'), moment().endOf('date')], 
	'本月': [moment().startOf('month'), moment().endOf('month')], 
	'今年': [moment().startOf('year'), moment().endOf('year')], 
};

class LogQryList extends Component{
	constructor(props) {
		super(props);

		this.state = {
			dataSource: null,
			pageSize: 20,
			pageIndex: 1,
			total: 0,
			logQryTransCodes: [],
			transCode: null,
			commonSearch: '',
			timeRange: [moment().subtract(3, 'days'), moment().endOf('month')],
		};
		if(this.props.value){
			this.state = {
				...this.props.value,
			};
		}

		this.clickInfo = this.clickInfo.bind(this);
		this.search = this.search.bind(this);
		this.changeCommonSearch = this.changeCommonSearch.bind(this);
		this.changeTransCode = this.changeTransCode.bind(this);
		this.selectTimeRange = this.selectTimeRange.bind(this);
		this.changeShowSize = this.changeShowSize.bind(this);
		this.showTotal = this.showTotal.bind(this);
		this.changePage = this.changePage.bind(this);
		this.getQryTransCodes = this.getQryTransCodes.bind(this);
	}

	async search(){
		const st = this.state.timeRange[0];
		const et = this.state.timeRange[1];
		const param = {
			PageSize: this.state.pageSize,
			PageIndex: this.state.pageIndex,
			Limit: 10000,
			StartTime: st.format('YYYY-MM-DD HH:mm:ss'),
			ToTime: et.format('YYYY-MM-DD HH:mm:ss'),
		};

		if(this.state.transCode){
			param.TransCodes = this.state.transCode;
		}
		if(this.state.commonSearch && this.state.commonSearch !== '' && this.state.commonSearch.indexOf('/') === 0){
			param.TransCodes = this.state.commonSearch;
		}
		if(param.PageIndex == 1){
			param.NeedCount = true;
		}

		const data = await request(`${Constants.ServerRoot}/log/20001`, {
			body: JSON.stringify(param),
		});
		const Result = data[Constants.ResultKey];
		const { TransLogs, Total } = Result;
		const stdata = {
			dataSource: TransLogs,
		};
		if(Total !== -1){
			stdata.total = Total;
		}
		this.setState({
			...stdata,
		});

	}

	async getQryTransCodes(){
		const params = {};
		const data = await request(`${Constants.ServerRoot}/log/20002`, {
			body: JSON.stringify(params),
		});
		const Result = data[Constants.ResultKey];
		const { TransCode } = Result;
		this.setState({
			logQryTransCodes: TransCode,
		});
	}

	changeShowSize(current, pSize){
		this.setState({
			pageIndex: 1, 
			pageSize: pSize,
		}, ()=>{
			this.search()
		});
	}

	showTotal(total, range){
		return (
			<span>
				总共：{total}&nbsp;条记录
			</span>
		);
	}

	changePage(page, pSize){
		this.setState({
			pageIndex: page, 
			pageSize: pSize,
		}, ()=>{
			this.search()
		});
	}

	changeTransCode(val){
		this.setState({
			transCode: val,
		});
	}

	changeCommonSearch(e){
		e.preventDefault();
		this.setState({
			commonSearch: e.currentTarget.value, 
		})
	}

	selectTimeRange(dates, dateString){
		this.setState({
			timeRange: dates,
		});
	}

	clickInfo(rec){
		if(this.props.clickInfo){
			this.props.clickInfo({
				record: rec,
				state: {
					...this.state,
				}
			});
		}
	}

	render(){
		const columns = [{
			title: '交易时间',
			dataIndex: 'time',
			key: 'time',
			width: '15%',
		},{
			title: '交易码',
			dataIndex: 'transcode',
			key: 'transcode',
			width: '15%',
		},{
			title: '应用',
			dataIndex: 'app',
			key: 'app',
			width: '10%',
		},{
			title: '渠道',
			dataIndex: 'channel',
			key: 'channel',
			width: '10%',
		},{
			title: '版本',
			dataIndex: 'ver',
			key: 'ver',
			width: '5%',
		},{
			title: 'clientip',
			dataIndex: 'clientip',
			key: 'clientip',
			width: '15%',
		},{
			title: '远程地址',
			dataIndex: 'remoteaddr',
			key: 'remoteaddr',
			width: '15%',
		},{
			title: '错误码',
			dataIndex: 'errcode',
			key: 'errcode',
			width: '10%',
		},{
			title: '操作',
			key: 'Action',
			render: (text, record, index)=>{
				return (
					<span>
						<a href={null} onClick={()=>{this.clickInfo(record);}}><SelectOutlined /></a>&emsp;
					</span>
				);			
			},
		}];

		let transopts = this.state.logQryTransCodes.map((item, idx)=>{
			return (
				<Option key={item.value} value={item.value}>{item.label}</Option>
			)
		});

		return (
			<div style={{height: this.props.height}}>
				<Row>
					<Col span={5}>
						<Select size='small' style={{width: '100%'}} allowClear
							value={this.state.transCode} 
							onChange={this.changeTransCode}>
							{transopts}
						</Select>
					</Col>
					<Col span={2}>
						<Button size='small' style={{width:'100%'}} onClick={this.getQryTransCodes} >提取交易</Button>
					</Col>
					<Col span={5}>
						<Input placeholder="交易码" size='small' style={{width:'100%'}} allowClear
							onChange={this.changeCommonSearch} defaultValue={this.state.commonSearch} />
					</Col>
					<Col span={9}>
						<RangePicker size='small' 
							showTime
							format='YYYY-MM-DD HH:mm:ss'
							ranges={defRange}
							value={this.state.timeRange}
							onChange={this.selectTimeRange}
							style={{width: '100%'}}
						/>
					</Col>
					<Col span={3}>
						<span style={{float: 'right'}}>
							<Button type="primary" icon={<SearchOutlined />} size='small' onClick={this.search}>搜索</Button>
						</span>
					</Col>

				</Row>

				<div style={{marginTop:30,}}>
					<Table dataSource={this.state.dataSource} columns={columns} 
						rowKey={(record)=>{ return record._id.counter}}
						pagination={false}
						bordered size='middle'
						scroll={{x: '100%', y: this.props.height - 230 }}
						onRow={(record, index)=>{
							let rowstyle = {};
							if(index % 2 === 1){
								rowstyle = {
									style: { backgroundColor: TableOddRowBgColor, },
								};
							}
							return {
								...rowstyle,
							}
						}}
					/>
					<Pagination 
						style={{marginTop:10, textAlign:'center',}}
						defaultPageSize={this.state.pageSize} defaultCurrent={this.state.pageIndex}
						showSizeChanger onShowSizeChange={this.changeShowSize} 
						total={this.state.total} showTotal={this.showTotal} onChange={this.changePage} />

				</div>

			</div>
		)
	}
}

export default LogQryList;
