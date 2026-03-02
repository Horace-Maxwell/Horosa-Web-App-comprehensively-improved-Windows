import { Component } from 'react';
import { Row, Col, Table, Popconfirm, Button, Input, Select, Pagination, message } from 'antd';
import { EditOutlined, DeleteOutlined, SelectOutlined } from '@ant-design/icons';
import * as AstroText from '../../constants/AstroText';
import { TableOddRowBgColor } from '../../utils/constants';
import { getStore } from '../../utils/storageutil';
import { randomStr } from '../../utils/helper';
import EditableTags from '../comp/EditableTags';
import { getCaseTypeLabel, exportLocalCasesBackup, importLocalCasesBackup } from '../../utils/localcases';

const Search = Input.Search;
const Option = Select.Option;

class CaseList extends Component{
	constructor(props) {
		super(props);
		this.state = {
			type: 0,
			tag: null,
			name: null,
			dispType: 'user/searchCases',
		};
		this.clickAdd = this.clickAdd.bind(this);
		this.clickEdit = this.clickEdit.bind(this);
		this.clickRemove = this.clickRemove.bind(this);
		this.clickInfo = this.clickInfo.bind(this);
		this.searchByName = this.searchByName.bind(this);
		this.changeShowSize = this.changeShowSize.bind(this);
		this.showTotal = this.showTotal.bind(this);
		this.changePage = this.changePage.bind(this);
		this.onChangeType = this.onChangeType.bind(this);
		this.genTagsOption = this.genTagsOption.bind(this);
		this.filterTagsOption = this.filterTagsOption.bind(this);
		this.onTagChange = this.onTagChange.bind(this);
		this.renderGroup = this.renderGroup.bind(this);
		this.handleOpClick = this.handleOpClick.bind(this);
		this.clickExportLocalBackup = this.clickExportLocalBackup.bind(this);
		this.clickImportLocalBackup = this.clickImportLocalBackup.bind(this);
		this.onImportLocalFileChange = this.onImportLocalFileChange.bind(this);
	}

	handleOpClick(evt, cb){
		if(evt && evt.preventDefault){
			evt.preventDefault();
		}
		if(cb){
			cb();
		}
	}

	changeShowSize(current, pSize){
		if(this.props.dispatch){
			this.props.dispatch({
				type: this.state.dispType,
				payload: {
					PageIndex: 1,
					PageSize: pSize,
					tag: this.state.tag,
					name: this.state.name,
				},
			});
		}
	}

	showTotal(){
		return (
			<span>
				总共：{this.props.caseTotal}&nbsp;条记录
			</span>
		);
	}

	changePage(page, pSize){
		if(this.props.dispatch){
			this.props.dispatch({
				type: this.state.dispType,
				payload: {
					PageIndex: page,
					PageSize: pSize,
					tag: this.state.tag,
					name: this.state.name,
				},
			});
		}
	}

	clickAdd(){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
				},
			});
		}
	}

	clickEdit(rec){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseedit',
					record: rec,
				},
			});
		}
	}

	clickRemove(rec){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'user/deleteCase',
				payload: rec,
			});
		}
	}

	clickInfo(rec){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'user/applyCase',
				payload: rec,
			});
		}
	}

	searchByName(value){
		if(this.props.dispatch){
			let disptype = this.state.dispType;
			if(value === undefined || value === null || value === ''){
				disptype = 'user/fetchCases';
				this.setState({
					dispType: disptype,
				}, ()=>{
					this.props.dispatch({
						type: disptype,
						payload: {
							tag: this.state.tag,
						},
					});
				});
			}else{
				disptype = 'user/searchCases';
				this.setState({
					dispType: disptype,
					name: value,
				}, ()=>{
					this.props.dispatch({
						type: disptype,
						payload: {
							name: value,
							tag: this.state.tag,
						},
					});
				});
			}
		}
	}

	onChangeType(val){
		this.setState({
			type: val,
		});
	}

	clickExportLocalBackup(){
		try{
			const backup = exportLocalCasesBackup();
			const now = new Date();
			const y = now.getFullYear();
			const m = String(now.getMonth() + 1).padStart(2, '0');
			const d = String(now.getDate()).padStart(2, '0');
			const hh = String(now.getHours()).padStart(2, '0');
			const mm = String(now.getMinutes()).padStart(2, '0');
			const ss = String(now.getSeconds()).padStart(2, '0');
			const fname = `horosa-local-cases-${y}${m}${d}-${hh}${mm}${ss}.json`;
			const payload = JSON.stringify(backup, null, 2);
			const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
			const url = (window.URL || window.webkitURL).createObjectURL(blob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.setAttribute('download', fname);
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			(window.URL || window.webkitURL).revokeObjectURL(url);
			message.success(`已导出本地事盘（${backup.total}条）`);
		}catch(e){
			message.error('导出本地事盘失败');
		}
	}

	clickImportLocalBackup(){
		if(this.localImportInput){
			this.localImportInput.value = '';
			this.localImportInput.click();
		}
	}

	onImportLocalFileChange(evt){
		const file = evt && evt.target && evt.target.files ? evt.target.files[0] : null;
		if(!file){
			return;
		}
		const reader = new FileReader();
		reader.onload = ()=>{
			try{
				const txt = reader.result ? `${reader.result}` : '';
				const json = JSON.parse(txt);
				const result = importLocalCasesBackup(json);
				message.success(`已导入本地事盘 ${result.imported} 条，当前共 ${result.total} 条`);
				this.searchByName(this.state.name || '');
			}catch(e){
				message.error('本地事盘文件解析失败');
			}
		};
		reader.onerror = ()=>{
			message.error('读取本地事盘文件失败');
		};
		reader.readAsText(file);
	}

	genTagsOption(){
		const store = getStore();
		const userstate = store.user;
		if(userstate.userInfo === undefined || userstate.userInfo === null){
			return [];
		}
		let tags = userstate.userInfo.group;
		let dom = [];
		if(tags){
			dom = tags.map((item)=>(
				<Option key={randomStr(8)} value={item}>{item}</Option>
			));
		}
		return dom;
	}

	filterTagsOption(input, option){
		if(option.props.children){
			const val = option.props.children + '';
			return val.toLowerCase().indexOf(input.toLowerCase()) >= 0;
		}
		return false;
	}

	onTagChange(val){
		this.setState({
			tag: val,
		});
	}

	renderGroup(text, record){
		let txt = record.group;
		if(txt === undefined || txt === null || txt === ''){
			return text;
		}
		try{
			const tags = JSON.parse(txt);
			return (
				<div>
					<EditableTags editable={false} value={tags} />
				</div>
			);
		}catch(e){
			return txt;
		}
	}

	render(){
		const ds = this.props.cases ? this.props.cases : [];
		const columns = [{
			title: '事件',
			dataIndex: 'event',
			key: 'event',
			width: '20%',
		},{
			title: '类型',
			dataIndex: 'caseType',
			key: 'caseType',
			width: '8%',
			render: (text)=>getCaseTypeLabel(text),
		},{
			title: '占卜时间',
			dataIndex: 'divTime',
			key: 'divTime',
			width: '14%',
		},{
			title: '时区',
			dataIndex: 'zone',
			key: 'zone',
			width: '10%',
		},{
			title: '起课地',
			dataIndex: 'pos',
			key: 'pos',
			width: '15%',
			render: (text, record)=>{
				const pos = `经度：${record.lon}，纬度：${record.lat}`;
				if(text){
					return (
						<div>
							<span>{text}</span><br />
							<span>{pos}</span>
						</div>
					);
				}
				return (<span>{pos}</span>);
			},
		},{
			title: '标签',
			dataIndex: 'tags',
			key: 'tags',
			width: '15%',
			render: (text, record)=>this.renderGroup(text, record),
		},{
			title: '公开',
			dataIndex: 'isPub',
			key: 'isPub',
			width: '6%',
			render: (text)=>AstroText.CommBool[text],
		},{
			title: '操作',
			key: 'Action',
			render: (text, record)=>(
				<span>
					<a href={null} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickInfo(record);});}}><SelectOutlined /></a>&emsp;
					<a href={null} onClick={(evt)=>{this.handleOpClick(evt, ()=>{this.clickEdit(record);});}}><EditOutlined /></a>&emsp;
					<Popconfirm title={`确定删除起课：${record.event || ''} 吗?`} onConfirm={()=>{this.clickRemove(record);}}>
						<a href={null} onClick={(evt)=>{this.handleOpClick(evt);}}><DeleteOutlined /></a>
					</Popconfirm>
				</span>
			),
		}];

		const tbly = this.props.height ? this.props.height - 130 : document.documentElement.clientHeight - 130;
		const tags = this.genTagsOption();
		const pageSize = this.props.casePageSize;
		const pageIndex = this.props.casePageIndex;
		const total = this.props.caseTotal;

		return (
			<div style={{height: tbly}}>
				<Row gutter={12} style={{marginBottom: 10}}>
					<Col span={4}>
						<Button type="primary" onClick={this.clickAdd}>添加起课</Button>
					</Col>
					<Col span={10}>
						<Select value={this.state.type} onChange={this.onChangeType}>
							<Option value={0}>本地事盘</Option>
						</Select>
						<Button onClick={this.clickImportLocalBackup}>导入本地事盘(JSON)</Button>
						<Button onClick={this.clickExportLocalBackup}>导出本地事盘(JSON)</Button>
						<input
							type='file'
							accept='.json,application/json'
							ref={(el)=>{this.localImportInput = el;}}
							style={{ display: 'none' }}
							onChange={this.onImportLocalFileChange}
						/>
					</Col>
					<Col span={4}>
						<Select
							placeholder='标签'
							showSearch allowClear
							filterOption={this.filterTagsOption}
							onChange={this.onTagChange}
							style={{width: '100%'}}
						>
							{tags}
						</Select>
					</Col>
					<Col span={6}>
						<Search placeholder='以事件进行检索' enterButton onSearch={this.searchByName} />
					</Col>
				</Row>

				<Table
					dataSource={ds}
					columns={columns}
					rowKey='cid'
					bordered
					size='small'
					scroll={{x: '100%', y: tbly}}
					pagination={false}
					onRow={(record, index)=>{
						let rowstyle = {};
						if(index % 2 === 1){
							rowstyle = {
								style: { backgroundColor: TableOddRowBgColor },
							};
						}
						return {
							...rowstyle,
						};
					}}
				/>

				<Pagination
					style={{marginTop: 3, textAlign: 'center'}}
					pageSizeOptions={['30', '50', '100']}
					showSizeChanger
					onShowSizeChange={this.changeShowSize}
					defaultPageSize={pageSize}
					defaultCurrent={pageIndex}
					total={total}
					showTotal={this.showTotal}
					onChange={this.changePage}
				/>
			</div>
		);
	}
}

export default CaseList;
