import { Component } from 'react';
import { Button, Input, Table, } from 'antd';
import Modal from 'drag-modal';
import { SearchOutlined, } from '@ant-design/icons';
import { ServerRoot, ResultKey, TableOddRowBgColor, }  from '../../utils/constants';
import request from '../../utils/request';

class LiveStreamsModal extends Component{

	constructor(props) {
		super(props);

		this.state = {
			visible: false,
			dataSource: [],
			record: null,
			stream: '',
			selectedRowKeys:[],
		};

		this.searchInput = null;

		this.showModalHandler = this.showModalHandler.bind(this);
		this.hideModalHandler = this.hideModalHandler.bind(this);

		this.search = this.search.bind(this);
		this.selectRow = this.selectRow.bind(this);
		this.clickRow = this.clickRow.bind(this);
		this.clickOk = this.clickOk.bind(this);

		this.requestList = this.requestList.bind(this);

		this.handleSearch = this.handleSearch.bind(this);
		this.handleReset = this.handleReset.bind(this);
		this.genStreamFilterDropdownDom = this.genStreamFilterDropdownDom.bind(this);
		this.genStreamColFilter = this.genStreamColFilter.bind(this);

	}

	async requestList(){
		const params = { };

		const data = await request(`${ServerRoot}/live/getstreams`, {
			body: JSON.stringify(params),
		});

		const res = data[ResultKey];
		
		const st = {
			dataSource: res.List,
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
			this.search();
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
			selectedRowKeys: [rec.Key],
		});
	}

	clickRow(rec){
		this.setState({
			selectedRowKeys: [rec.Key],
			record: rec,
		});
	}

	clickOk(){
		let rec = {
			...this.state.record
		};
		if(rec.Key === undefined || rec.Key === null){
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

	handleSearch(selectedKeys, confirm){
		confirm();
		this.setState({ stream: selectedKeys[0] });	
	}

	handleReset(clearFilters){
		clearFilters();
    	this.setState({ stream: null });
	}


	genStreamFilterDropdownDom(option){
		let { setSelectedKeys, selectedKeys, confirm, clearFilters } = option;
		let dom = (
			<div style={{ padding: 8 }}>
				<Input
					ref={node => {
						this.searchInput = node;
					}}
					placeholder={`直播频道`}
					value={selectedKeys[0]}
					onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
					onPressEnter={() => this.handleSearch(selectedKeys, confirm)}
					style={{ width: 288, marginBottom: 8, display: 'block' }}
				/>
				<Button
					type="primary"
					onClick={() => this.handleSearch(selectedKeys, confirm)}
					icon={<SearchOutlined />}
					size="small"
					style={{ width: 90, marginRight: 8 }}
				>
					搜索
				</Button>
				<Button onClick={() => this.handleReset(clearFilters)} size="small" style={{ width: 90 }}>
					重置
				</Button>
			</div>
		);

		return dom;
	}

	genStreamColFilter(dataIndex){
		let res = {
			filterDropdown: (option)=>{
				return this.genStreamFilterDropdownDom(option)
			},
			onFilterDropdownVisibleChange: (visible)=>{
				if(visible && this.searchInput){
					setTimeout(()=>{ this.searchInput.select()});
				}
			},
			filterIcon: (filtered)=>{
				let dom = (
					<SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
				);
				return dom;
			},
			onFilter: (value, record)=>{
				if(record[dataIndex]){
					let txt = record[dataIndex].toString().toLowerCase();
					return txt.includes(value.toLowerCase());	
				}
				return false;
			},
		};

		return res;
	}


	render(){
		const columns = [{
			title: '直播频道',
			dataIndex: 'Stream',
			key: 'Stream',
			width: '50%',
			...this.genStreamColFilter('Stream')
		},{
			title: '用户',
			dataIndex: 'User',
			key: 'User',
		}	
	];

	const rowSelection ={
		type: 'radio',
		fixed: 'left',
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
				width={800} title='直播选择'
				bodyStyle={{height: 500, width:800}}
				>
				<div style={{ marginBottom: 20,}}>
					<span >
						<Button type="primary" onClick={this.search}><SearchOutlined />搜索</Button>
					</span>
					<span style={{marginLeft: 20,}}>
						选中的直播：
					</span>
					<span>
						{ this.state.record ? `${this.state.record.Stream}，来自${this.state.record.User}` : null }
					</span>
				</div>

				<div style={{height: 400,}}>
					<Table dataSource={this.state.dataSource} columns={columns}
						rowKey='Key' 
						bordered size='small'
						pagination={false}
						scroll={{x: '100%', y: 310 }}
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

export default LiveStreamsModal;
