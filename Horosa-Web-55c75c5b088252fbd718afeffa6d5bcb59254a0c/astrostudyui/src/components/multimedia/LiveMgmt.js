import { Component } from 'react';
import flvjs from 'flv.js';
import { Button, Input, Table, Popconfirm, Row, Col, Popover,} from 'antd';
import Modal from 'drag-modal';
import { SearchOutlined, DeleteOutlined, PlaySquareOutlined, } from '@ant-design/icons';
import { ServerRoot, ResultKey, TableOddRowBgColor, RtmpPlayServer, }  from '../../utils/constants';
import ConfirmSwitch from '../comp/ConfirmSwitch';
import { randomStr, } from '../../utils/helper';
import request from '../../utils/request';
import styles from '../../css/styles.less';

class LiveMgmt extends Component{

	constructor(props) {
		super(props);

		this.state = {
			mediaId: 'media' + randomStr(8),
			dataSource: [],
			preview: false,
		};

		this.handleSearch = this.handleSearch.bind(this);
		this.handleReset = this.handleReset.bind(this);
		this.genStreamFilterDropdownDom = this.genStreamFilterDropdownDom.bind(this);
		this.genStreamColFilter = this.genStreamColFilter.bind(this);

		this.renderActionCol = this.renderActionCol.bind(this);

		this.search = this.search.bind(this);
		this.requestList = this.requestList.bind(this);
		this.removeLive = this.removeLive.bind(this);
		this.playLive = this.playLive.bind(this);

		this.requestPlayUrl = this.requestPlayUrl.bind(this);
		this.requestRemoveLive = this.requestRemoveLive.bind(this);
		this.genFlv = this.genFlv.bind(this);
		this.cancelPreview = this.cancelPreview.bind(this);

	}

	async requestList(){
		const params = { };

		const data = await request(`${ServerRoot}/live/getstreams`, {
			body: JSON.stringify(params),
		});

		const res = data[ResultKey];
		
		const st = {
			dataSource: res.List,
		};

		this.setState(st);
	}
	

	async requestRemoveLive(key){
		const params = { 
			key: key,
		};

		const data = await request(`${ServerRoot}/astroreader/removelive`, {
			body: JSON.stringify(params),
		});

		this.requestList();
	}
	
	async requestPlayUrl(key){

		const params = { 
			key: key,
		};

		const data = await request(`${ServerRoot}/live/playpath`, {
			body: JSON.stringify(params),
		});

		const result = data[ResultKey];

		let url = `${RtmpPlayServer}${result.Path}`;	
		this.genFlv(url);
	}

	genFlv(url){
		const videoElem = document.getElementById(this.state.mediaId);
		if(this.player){
			this.player.destroy();
		}
		this.player = flvjs.createPlayer({
			isLive: true,
			type: 'flv',
			url: url,
		});
		this.player.on(flvjs.Events.ERROR, (e)=>{
			console.log(e);
		});

		this.player.attachMediaElement(videoElem);
		this.player.load();
		this.player.play();
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

	search(e){
		if(e){
			e.preventDefault();
		}
		this.requestList();
	}

	removeLive(record){
		this.requestRemoveLive(record.Key);
	}

	playLive(record){
		this.setState({
			preview: true,
		}, ()=>{
			this.requestPlayUrl(record.Key);
		});
	}

	cancelPreview(){
		this.setState({
			preview: false,
		}, ()=>{
			if(this.play){
				try{
					this.play.destroy();
				}catch(e){

				}
				this.play = null;
			}
		});
	}

	renderActionCol(text, record, index){
		return (
			<span>
				&emsp;
				<Popconfirm title={`确定删除直播：${record.Stream} 吗?`} onConfirm={()=>{this.removeLive(record);}}>
					<a href={null} ><DeleteOutlined /></a>&emsp;
				</Popconfirm>
				<a href={null} onClick={()=>{ this.playLive(record); }}><PlaySquareOutlined /></a>&emsp;
			</span>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 80;
		height = height - 100;
		let tblHeight = height - 50;

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
			width: '40%',
		},{
			title: '操作',
			key: 'Action',
			render: this.renderActionCol,
		}];

		let style = {
			height: height,
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div>
				<Modal 
					open={this.state.preview}
					onOk={this.cancelPreview}
					onCancel={this.cancelPreview}
					style={{width: 600, height:400}}
				>
					<video 
						id={this.state.mediaId} controls
						style={{width: 480, height:270}}
					/>
				</Modal>
				<Row gutter={16} style={{marginBottom: 10}}>
					<Col offset={20} span={4}>
						<Button type="primary" onClick={this.search}><SearchOutlined />搜索</Button>
					</Col>
				</Row>
				<Table dataSource={this.state.dataSource} columns={columns}
					rowKey='Key' 
					bordered
					scroll={{x: '100%', y: tblHeight }}
					onRow={(record, index)=>{
						let rowstyle = {};
						if(index % 2 === 1){
							rowstyle = {
								style: { backgroundColor: TableOddRowBgColor, },
							};
						}
						return {
							...rowstyle,
						};
					}}
				/>
			</div>

		);
	}

}

export default LiveMgmt;
