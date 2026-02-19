import { Component } from 'react';
import { Row, Col, Button, Divider, Tabs, } from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import styles from '../../css/styles.less';
import CuanGong12Query from './CuanGong12Query';
import CuanGong12Desc from './CuanGong12Desc';

const TabPane = Tabs.TabPane;

export default class CuanGong12 extends Component{
	constructor(props) {
		super(props);

        this.state = {
            tab: 'desc',
        }

        this.changeTab = this.changeTab.bind(this);
    }

	changeTab(key){
		this.setState({
			tab: key
		});
	}

    componentDidMount(){
    }

    render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight;
        height = height - 80;
        
        return (
            <Tabs 
                defaultActiveKey={this.state.tab} 
                onChange={this.changeTab}
                tabPosition='top'
                style={{ height: height }} 
            >
                <TabPane tab="说明" key="desc">
                    <CuanGong12Desc />
                </TabPane>
                <TabPane tab="查询" key="query">
                    <CuanGong12Query />
                </TabPane>
            </Tabs>
        )
    }
}