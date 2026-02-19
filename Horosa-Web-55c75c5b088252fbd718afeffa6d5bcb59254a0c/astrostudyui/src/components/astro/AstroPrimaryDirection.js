import { Component } from 'react';
import { Row, Col, Table, Input, Button,  } from 'antd';
import { SearchOutlined, } from '@ant-design/icons';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import {TableOddRowBgColor} from '../../utils/constants'
import styles from '../../css/styles.less';

class AstroPrimaryDirection extends Component{

	constructor(props) {
		super(props);

		this.state = {
			searchYear: '',
		}

		this.searchInput = null;

		this.convertToDataSource = this.convertToDataSource.bind(this);
		this.convertText = this.convertText.bind(this);
		this.T = this.T.bind(this);
		this.A = this.A.bind(this);
		this.C = this.C.bind(this);
		this.D = this.D.bind(this);
		this.S = this.S.bind(this);
		this.N = this.N.bind(this);

		this.genDateFilterDropdownDom = this.genDateFilterDropdownDom.bind(this);
		this.genDateColFilter = this.genDateColFilter.bind(this);
		this.genStarColFilter = this.genStarColFilter.bind(this);
		this.handleSearch = this.handleSearch.bind(this);
		this.handleReset = this.handleReset.bind(this);

		this.objs = AstroConst.LIST_OBJECTS.slice(0);
		this.objs.push(AstroConst.ASC);
		this.objs.push(AstroConst.MC);

	}

	isBoundRow(pd){
		if(!pd || !pd.length){
			return false;
		}
		const promittor = pd[1] ? `${pd[1]}` : '';
		const significator = pd[2] ? `${pd[2]}` : '';
		return promittor.indexOf('T_') === 0 || significator.indexOf('T_') === 0;
	}

	genStarColFilter(dataIndex, filterKeys){
		let filters = [];

		for(let i=0; i<this.objs.length; i++){
			let planet = this.objs[i];
			if(!filterKeys.has(planet)){
				continue;
			}
			let obj = {
				text: (<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[planet]}</span>),
				value: planet,
			}
			filters.push(obj);
		}

		let res = {
			filters: filters,
			onFilter: (value, record)=>{
				if(record[dataIndex]){
					return record[dataIndex].indexOf(value) >= 0;
				}
				return false;
			},

		};
		return res;
	}

	genDateColFilter(dataIndex){
		let res = {
			filterDropdown: (option)=>{
				return this.genDateFilterDropdownDom(option)
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

	genDateFilterDropdownDom(option){
		let { setSelectedKeys, selectedKeys, confirm, clearFilters } = option;
		let dom = (
			<div style={{ padding: 8 }}>
				<Input
					ref={node => {
						this.searchInput = node;
					}}
					placeholder={`输入年份`}
					value={selectedKeys[0]}
					onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
					onPressEnter={() => this.handleSearch(selectedKeys, confirm)}
					style={{ width: 188, marginBottom: 8, display: 'block' }}
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

	handleSearch(selectedKeys, confirm){
		confirm();
		this.setState({ searchYear: selectedKeys[0] });	
	}

	handleReset(clearFilters){
		clearFilters();
    	this.setState({ searchYear: '' });
	}


	convertToDataSource(pds){
		let filterKeys = new Set();
		const showPdBounds = !(this.props.showPdBounds === 0 || this.props.showPdBounds === false);
		if(pds === undefined || pds === null){
			return {
				ds: [],
				filterKeys: filterKeys,
			};
		}
		let res = [];
		for(let i=0; i<pds.length; i++){
			let pd = pds[i];
			if(!showPdBounds && this.isBoundRow(pd)){
				continue;
			}

			let data = {
				Seq: i,
				Degree: pd[0],
				Promittor: pd[1],
				Significator: pd[2],
				Date: pd[4],
			}
			res.push(data);

			let parts = data.Promittor.split('_');
			filterKeys.add(parts[1]);
			parts = data.Significator.split('_');
			filterKeys.add(parts[1]);
		}
		return {
			ds: res,
			filterKeys: filterKeys
		};
	}

	T(parts){
		let dom = (
			<div>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[2]]}</span>&nbsp;的&nbsp;
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[1]]}</span>&nbsp;界
			</div>
		);
		return dom;
	}

	A(parts){
		let dom = (
			<div>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[1]]}</span>&nbsp;的映点
			</div>
		);
		return dom;
	}
	C(parts){
		let dom = (
			<div>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[1]]}</span>&nbsp;的反映点
			</div>
		);
		return dom;
	}

	D(parts){
		let dom = (
			<div>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[1]]}</span>&nbsp;的&nbsp;
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度右相位处
			</div>
		);
		return dom;
	}
	S(parts){
		let dom = (
			<div>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[1]]}</span>&nbsp;的&nbsp;
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度左相位处
			</div>
		);
		return dom;
	}
	N(parts){
		let dom = (
			<div>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[1]]}</span>&nbsp;
			</div>
		);
		if(parts[2] !== '0'){
			dom = (
				<div>
					<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[parts[1]]}</span>&nbsp;的&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度相位处
				</div>
			); 
		}
		return dom;
	}

	convertText(text){
		let parts = text.split('_');
		let txt = text;
		if(parts[0] === 'T'){
			txt = this.T(parts);
		}else if(parts[0] === 'A'){
			txt = this.A(parts);
		}else if(parts[0] === 'C'){
			txt = this.C(parts);
		}else if(parts[0] === 'D'){
			txt = this.D(parts);
		}else if(parts[0] === 'S'){
			txt = this.S(parts);
		}else if(parts[0] === 'N'){
			txt = this.N(parts);
		}
		return txt;
	}

	render(){
		let chart = this.props.value ? this.props.value : {};
		let predictives = chart.predictives ? chart.predictives : {};
		let pds = predictives.primaryDirection ? predictives.primaryDirection : [];

		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 50;
		let tblY = height - 100;

		let style = {
			height: height,
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let dsres = this.convertToDataSource(pds);
		let ds = dsres.ds;
		let filterKeys = dsres.filterKeys;
		
		let columns = [{
			title: '赤经',
			dataIndex: 'Degree',
			key: 'Degree',
			width: '25%',
			render: (text, record)=>{
				let deg = AstroHelper.splitDegree(text);
				let txt = deg[0] + '度' + deg[1] + '分';
				return txt;
			},
		},{
			title: '迫星',
			dataIndex: 'Promittor',
			key: 'Promittor',
			width: '25%',
			render: (text, record)=>{
				return this.convertText(text);
			},
			...this.genStarColFilter('Promittor', filterKeys)
		},{
			title: '应星',
			dataIndex: 'Significator',
			key: 'Significator',
			width: '25%',
			render: (text, record)=>{
				return this.convertText(text);
			},
			...this.genStarColFilter('Significator', filterKeys)
		},{
			title: '日期',
			dataIndex: 'Date',
			key: 'Date',
			width: '25%',
			render: (text, record)=>{
				return text;
			},
			...this.genDateColFilter('Date')
		}];


		
		return (
			<div className={styles.scrollbar} style={style}>
				<Table
					dataSource={ds} columns={columns} 
					rowKey='Seq'  
					pagination={{pageSize: 50}}
					bordered size='small'
					scroll={{x: '100%', y: tblY }}
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
			</div>
		);
	}
}

export default AstroPrimaryDirection;
