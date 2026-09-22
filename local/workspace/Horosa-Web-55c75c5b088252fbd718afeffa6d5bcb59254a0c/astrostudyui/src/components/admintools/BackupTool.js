import { Component } from 'react';
import { Row, Col, Popconfirm } from 'antd';
import { XQButton as Button, XQTable as Table } from '../xq-ui';
import XQIcon from '../xq-icons';
import { TableOddRowBgColor, ServerRoot, ResultKey } from '../../utils/constants';
import request from '../../utils/request';


import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
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
		try{
			const data = await request(`${ServerRoot}/bak/list`, {
				body: JSON.stringify(params),
			});
			if(!this._mounted) return;
			const result = data[ResultKey];

			this.setState({
				dataSource: result.List,
			});
		}catch(e){
			// 备份列表拉取失败仅告警，保留现有列表不崩
			console.warn(e);
		}
    }

	renderActionCol(text, record, index){
		return (
			<Popconfirm title={`确定删除备份：${record.Dir} 吗?`} onConfirm={()=>{ this.clickDelete(record); }}>
				&emsp;<a href={null} ><XQIcon name="delete" /></a>
			</Popconfirm>
		);
	}

    componentDidMount(){
        this._mounted = true;
        this.search();
    }

    componentWillUnmount(){
        this._mounted = false;
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

		let height = this.props.height ? this.props.height : getLayoutViewportHeight() - 80;
		let style = {
			height: height + 'px',
		};

        return (
            <div style={style}>
                <Row gutter={6} style={{marginTop: 10}}>
                    <Col offset={16} span={4}>
                        <Button type="primary" iconName="refresh" onClick={this.search}>刷新</Button>
                    </Col>
                    <Col span={4}>
                        <span style={{float: 'right'}}>
                            <Button iconName="plus" onClick={this.clickBackup}>立即备份</Button>
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
