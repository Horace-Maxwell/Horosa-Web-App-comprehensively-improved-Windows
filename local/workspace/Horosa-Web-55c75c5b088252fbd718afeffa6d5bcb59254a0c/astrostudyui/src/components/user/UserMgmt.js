import { Component } from 'react';
import { Modal, Button, Input, Table, Popconfirm, Row, Col, Select, Pagination, } from 'antd';
import { SearchOutlined, DeleteOutlined, PlaySquareOutlined, } from '@ant-design/icons';
import { ServerRoot, ResultKey, TableOddRowBgColor, RtmpPlayServer, }  from '../../utils/constants';
import ConfirmSwitch from '../comp/ConfirmSwitch';
import { randomStr, } from '../../utils/helper';
import request from '../../utils/request';
import styles from '../../css/styles.less';

const { Option, } = Select;

class UserMgmt extends Component{

	constructor(props) {
		super(props);

		this.state = {
			dataSource: [],
			admin: null,
			privilege: null,
			user: null,
			pageIndex: 1,
			pageSize: 30,
			total: 0,
		};

		this.search = this.search.bind(this);
		this.changeUser = this.changeUser.bind(this);
		this.changeAdmin = this.changeAdmin.bind(this);
		this.changePrivilege = this.changePrivilege.bind(this);
		this.switchAdmin = this.switchAdmin.bind(this);
		this.switchPushLive = this.switchPushLive.bind(this);
		this.switchBaziPriv = this.switchBaziPriv.bind(this);

		this.changeShowSize = this.changeShowSize.bind(this);
		this.showTotal = this.showTotal.bind(this);
		this.changePage = this.changePage.bind(this);

		this.requestList = this.requestList.bind(this);
		this.requestSetPrivi = this.requestSetPrivi.bind(this);
		this.requestSetupAdmin = this.requestSetupAdmin.bind(this);

	}

	changeShowSize(current, pSize){
		this.setState({
			pageIndex: 1,
			pageSize: pSize,
		}, ()=>{
			this.requestList();
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
			this.requestList();
		});
	}


	async requestList(){
		const params = { 
			user: this.state.user,
			admin: this.state.admin,
			privilege: this.state.privilege,
			PageIndex: this.state.pageIndex,
			PageSize: this.state.pageSize,
		};

		const data = await request(`${ServerRoot}/usermgmt/users`, {
			body: JSON.stringify(params),
		});

		const res = data[ResultKey];
		
		const st = {
			dataSource: res.List,
			total: res.Total,
		};

		this.setState(st);
	}
	

	async requestSetupAdmin(uid, admin){
		const params = { 
			user: uid,
			admin: admin,
		};

		const data = await request(`${ServerRoot}/usermgmt/setupadmin`, {
			body: JSON.stringify(params),
		});

		this.requestList();
	}
	
	async requestSetPrivi(uid, privilege){
		const params = { 
			user: uid,
			privilege: privilege,
		};

		const data = await request(`${ServerRoot}/usermgmt/setprivi`, {
			body: JSON.stringify(params),
		});

		this.requestList();
	}
	

	search(e){
		if(e){
			e.preventDefault();
		}
		this.requestList();
	}

	changeUser(e){
		this.setState({
			user: e.target.value,
		});
	}

	changeAdmin(val){
		this.setState({
			admin: val,
		});
	}

	changePrivilege(val){
		this.setState({
			privilege: val,
		});
	}

	switchAdmin(checked, record){
		this.requestSetupAdmin(record.uid, checked);
	}

	switchPushLive(checked, record){
		let privi = record.privilege;
		if(privi === undefined || privi === null){
			privi = 0;
		}
		if(checked){
			privi = privi | 2;
		}else{
			privi = privi & 0xfffffffffffffffd;
		}
		this.requestSetPrivi(record.uid, privi);
	}

	switchBaziPriv(checked, record){
		let privi = record.privilege;
		if(privi === undefined || privi === null){
			privi = 0;
		}
		if(checked){
			privi = privi | 8;
		}else{
			privi = privi & 0xfffffffffffffffd;
		}
		this.requestSetPrivi(record.uid, privi);
	}

	render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 80;
		height = height - 100;
		let tblHeight = height - 100;

		const columns = [{
			title: '用户',
			dataIndex: 'uid',
			key: 'uid',
			width: '40%',
		},{
			title: '管理员',
			dataIndex: 'admin',
			key: 'admin',
			width: '20%',
			render: (text, record, index)=>{
				let flag = record.admin === true;
				let title = `确定把${record.uid}切换为普通用户吗？`;
				if(flag === false){
					title = `确定把${record.uid}切换为管理员吗？`;
				}

				return (
					<div>&emsp;
						<ConfirmSwitch 
							confirmText={title}
							checkedChildren='管理员' 
							unCheckedChildren='普通用户'
							value={flag}
							onOk={chk=>this.switchAdmin(chk, record)}
						/>
					</div>
				)
			},
		},{
			title: '允许直播',
			dataIndex: 'privilege',
			key: 'privilege',
			width: '20%',
			render: (text, record, index)=>{
				let privi = record.privilege;
				if(privi === undefined || privi === null){
					privi = 0;
				}
				let flag = (privi & 2) === 2;
				let title = `确定对${record.uid}关闭直播功能吗？`;
				if(flag === false){
					title = `确定对${record.uid}开启直播功能吗？`;
				}
				return (
					<div>&emsp;
						<ConfirmSwitch 
							confirmText={title}
							checkedChildren='启用' 
							unCheckedChildren='关闭'
							value={flag}
							onOk={chk=>this.switchPushLive(chk, record)}
						/>
					</div>
				)
			},
		},{
			title: '八字格局编辑',
			dataIndex: 'privilege',
			key: 'priv',
			width: '20%',
			render: (text, record, index)=>{
				let privi = record.privilege;
				if(privi === undefined || privi === null){
					privi = 0;
				}
				let flag = (privi & 8) === 8;
				let title = `确定对${record.uid}关闭八字格局编辑功能吗？`;
				if(flag === false){
					title = `确定对${record.uid}开启八字格局编辑功能吗？`;
				}
				return (
					<div>&emsp;
						<ConfirmSwitch 
							confirmText={title}
							checkedChildren='启用' 
							unCheckedChildren='关闭'
							value={flag}
							onOk={chk=>this.switchBaziPriv(chk, record)}
						/>
					</div>
				)
			},
		}];

		let style = {
			height: height,
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div>
				<Row gutter={16} style={{marginBottom: 10}}>
					<Col span={4}>
						<Select value={this.state.admin} onChange={this.changeAdmin} style={{width: '100%'}}>
							<Option value={null}>所有用户</Option>
							<Option value={true}>管理员</Option>
							<Option value={false}>普通用户</Option>
						</Select>
					</Col>
					<Col span={6}>
						<Select value={this.state.privilege} onChange={this.changePrivilege} style={{width: '100%'}}>
							<Option value={null}>不考虑权限</Option>
							<Option value={2}>允许直播</Option>
							<Option value={8}>允许编辑八字格局</Option>
						</Select>
					</Col>
					<Col span={8}>
						<Input value={this.state.user} onChange={this.changeUser} placeholder='用户id' style={{width: '100%'}} />
					</Col>
					<Col offset={2} span={4}>
						<Button type="primary" onClick={this.search}><SearchOutlined />搜索</Button>
					</Col>
				</Row>
				<Table dataSource={this.state.dataSource} columns={columns}
					rowKey='uid' 
					bordered
					pagination={false}
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
				<Pagination 
					style={{marginTop:10, textAlign:'center',}}
					showSizeChanger onShowSizeChange={this.changeShowSize} 
					defaultPageSize={this.state.pageSize} defaultCurrent={this.state.pageIndex}
					pageSizeOptions={['30', '50', '100', '500']}
					total={this.state.total} showTotal={this.showTotal} onChange={this.changePage} />

			</div>

		);
	}

}

export default UserMgmt;
