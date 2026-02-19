import { Component } from 'react';
import { Row, Col, Table, Popconfirm,  Button,} from 'antd';
import { SearchOutlined, DeleteOutlined, PlusOutlined, } from '@ant-design/icons';
import { TableOddRowBgColor, ServerRoot, ResultKey } from '../../utils/constants';
import {randomStr} from '../../utils/helper';
import request from '../../utils/request';


export default class BackupTool extends Component{
    constructor(props) {
		super(props);

        this.state = {
            dataSource: [],
        };

        this.clickBackup = this.clickBackup.bind(this);
        this.clickDelete = this.clickDelete.bind(this);
        this.renderActionCol = this.renderActionCol.bind(this);
        this.search = this.search.bind(this);
    }

	async clickBackup(){
		const params = {
		};
		const data = await request(`${ServerRoot}/bak/backup`, {
			body: JSON.stringify(params),
		});
		const result = data[ResultKey];

        setTimeout(()=>{
            this.search();
        }, 1000);
    }

	async clickDelete(rec){
		const params = {
            Dir: rec.Dir,
		};
		const data = await request(`${ServerRoot}/bak/delete`, {
			body: JSON.stringify(params),
		});
		const result = data[ResultKey];

        setTimeout(()=>{
            this.search();
        }, 1000);
    }

    async search(){
		const params = {
		};
		const data = await request(`${ServerRoot}/bak/list`, {
			body: JSON.stringify(params),
		});
		const result = data[ResultKey];

        this.setState({
            dataSource: result.List,
        });
    }

	renderActionCol(text, record, index){
		return (
			<Popconfirm title={`确定删除备份：${record.Dir} 吗?`} onConfirm={()=>{ this.clickDelete(record); }}>
				&emsp;<a href={null} ><DeleteOutlined /></a>
			</Popconfirm>
		);
	}

    componentDidMount(){
        this.search();
    }

    render(){
	    const columns = [{
			title: '目录',
			dataIndex: 'Dir',
			key: 'Dir',
			width: '35%',
		},{
			title: '大小',
			dataIndex: 'Size',
			key: 'Size',
			width: '35%',
			render: (text, record)=>{
                let n = new Number(text);
				return n.toLocaleString();
			},
		},{
			title: '操作',
			key: 'Action',
			render: this.renderActionCol,
		},];

		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 80;
		let style = {
			height: height + 'px',
		};

        return (
            <div style={style}>
                <Row gutter={6} style={{marginTop: 10}}>
                    <Col offset={16} span={4}>
                        <Button type="primary" onClick={this.search}><SearchOutlined />刷新</Button>
                    </Col>
                    <Col span={4}>
                        <span style={{float: 'right'}}>
                            <Button onClick={this.clickBackup}><PlusOutlined />立即备份</Button>
                        </span>
                    </Col>
                </Row>

                <div style={{marginTop:30,}}>
                    <Table dataSource={this.state.dataSource} columns={columns} 
                        rowKey='Dir' 
                        bordered size='middle'
                        scroll={{x: '100%', y: height - 100 }}
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

            </div>
        )
    }
}