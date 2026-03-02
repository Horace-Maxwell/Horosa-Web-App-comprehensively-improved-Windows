import { Component } from 'react';
import { Modal, Button, Input, Table, } from 'antd';
import { SearchOutlined, } from '@ant-design/icons';
import * as AstroText from '../../constants/AstroText';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import { TableOddRowBgColor } from '../../utils/constants';
import { listLocalCharts } from '../../utils/localcharts';


class ChartSearchModal extends Component{

	constructor(props) {
		super(props);
		this.state = {
			visible: false,
			dataSource: [],
			commonSearch: '',
			record: null,
			selectedRowKeys:[],
		};

		this.changeCommonSearch = this.changeCommonSearch.bind(this);
		this.search = this.search.bind(this);
		this.selectRow = this.selectRow.bind(this);
		this.clickRow = this.clickRow.bind(this);
		this.clickOk = this.clickOk.bind(this);

		this.requestList = this.requestList.bind(this);
		this.showModalHandler = this.showModalHandler.bind(this);
		this.hideModalHandler = this.hideModalHandler.bind(this);
	}

	async requestList(){
		const params = {
			name: this.state.commonSearch
		};
		const token = localStorage.getItem(Constants.TokenKey);
		let res = null;
		if(token){
			const data = await request(`${Constants.ServerRoot}/allowedcharts`, {
				body: JSON.stringify(params),
			});
			if(data && data[Constants.ResultKey]){
				res = data[Constants.ResultKey];
			}
		}
		if(res === null){
			res = listLocalCharts(params);
		}
		
		const st = {
			dataSource: res,
			record: null,
		};

		this.setState(st);
	}
	

	showModalHandler(e) {
		if(e){
			e.preventDefault();
		}
		this.setState({
			visible: true,
			record: null,
		}, ()=>{
			this.search()
		});
	}

	hideModalHandler(e) {
		if(e){
			e.stopPropagation();
		}
		this.setState({
			visible: false,
			record: null,
		});
	}

	changeCommonSearch(e){
		e.preventDefault();
		this.setState({
			commonSearch: e.currentTarget.value, 
		})
	}

	search(e){
		if(e){
			e.preventDefault();
		}
		this.requestList();
	}

	selectRow(selectedRowKeys, selectedRows){
		const rec = selectedRows[0];
		this.setState({
			record: rec,
			selectedRowKeys: [rec.cid],
		});
	}

	clickRow(rec){
		this.setState({
			selectedRowKeys: [rec.cid],
			record: rec,
		});
	}

	clickOk(){
		let rec = {
			...this.state.record
		};
		if(rec.cid === undefined || rec.cid === null){
			rec = null;
		}
		
		this.setState({
			record: null,
			selectedRowKeys: [],
			visible: false,
		});

		if(this.props.onOk){
			this.props.onOk(rec);
		}

	}


	render(){
		const columns = [{
			title: '姓名',
			dataIndex: 'name',
			key: 'name',
			width: '20%',
		},{
			title: '性别',
			dataIndex: 'gender',
			key: 'gender',
			width: '8%',
			render: (text, record)=>{
				return AstroText.Gender[text];
			},
		},{
			title: '出生时间',
			dataIndex: 'birth',
			key: 'birth',
			width: '17%',
		},{
			title: '时区',
			dataIndex: 'zone',
			key: 'zone',
			width: '11%',
		},{
			title: '出生地',
			dataIndex: 'pos',
			key: 'pos',
			width: '20%',
			render: (text, record)=>{
				let pos = `经度：${record.lon}，纬度：${record.lat}`;
				let span = (<span>{pos}</span>);
				if(text){
					span = (
						<div>
							<span>{text}</span><br />
							<span>{pos}</span>
						</div>
					);
				}
				return span;
			},
		},{
			title: '公开',
			dataIndex: 'isPub',
			key: 'isPub',
			width: '8%',
			render: (text, record)=>{
				return AstroText.CommBool[text];
			},
		}];

		const rowSelection ={
			type: 'radio',
			onChange: this.selectRow,
			selectedRowKeys: this.state.selectedRowKeys,
		};
	
		const { children } = this.props;

		return (
			<span>
				<span onClick={this.showModalHandler}>
					{ children }
				</span>
				<Modal open={this.state.visible} 
					onCancel={this.hideModalHandler}
					onOk={this.clickOk}
					width={800} title='星盘查找'
					bodyStyle={{height: 500, width:800}}
					>
					<div style={{ marginBottom: 20,}}>
						<span >
							<Input placeholder="星盘名称" style={{width:200}} onChange={this.changeCommonSearch}/>&emsp;
							<Button icon={<SearchOutlined />} onClick={this.search}>搜索</Button>
						</span>
						<span style={{marginLeft: 20,}}>
							选中星盘：
						</span>
						<span>
							{ this.state.record ? this.state.record.name + this.state.record.birth : null }
						</span>
					</div>

					<div style={{height: 400,}}>
						<Table dataSource={this.state.dataSource} columns={columns}
							rowKey='cid' 
							bordered size='small'
							scroll={{x: 700, y: 310 }}
							pagination={{pageSize: 40}}
							rowSelection={rowSelection}
							onRow={(record, index)=>{
								let rowstyle = {};
								if(index % 2 === 1){
									rowstyle = {
										style: { backgroundColor: TableOddRowBgColor, },
									};
								}
								return {
									...rowstyle,
									onClick: ()=>{ this.clickRow(record); },
								};
							}}
						/>
					</div>
				</Modal>
			</span>
		);
	}
}

export default ChartSearchModal;
