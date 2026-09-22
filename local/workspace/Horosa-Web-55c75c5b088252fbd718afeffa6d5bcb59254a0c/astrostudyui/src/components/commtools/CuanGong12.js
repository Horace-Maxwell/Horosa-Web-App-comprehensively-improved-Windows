import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import CuanGong12Query from './CuanGong12Query';
import CuanGong12Desc from './CuanGong12Desc';

import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
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
		let height = this.props.height ? this.props.height : getLayoutViewportHeight();
        height = height - 80;
        // fill = 充满父容器:内层 Tabs 100% + 内容链定高(样式见 app.less .horosa-fill-tabs),叶子各自滚动。
        const fill = !!this.props.fill;
        
        return (
            <Tabs 
                defaultActiveKey={this.state.tab} 
                onChange={this.changeTab}
                tabPosition='top'
                className={fill ? 'horosa-fill-tabs' : undefined}
                style={fill ? { height: '100%', minHeight: 0 } : { height: height }} 
            >
                <TabPane tab="说明" key="desc">
                    <CuanGong12Desc fill={fill} height={this.props.height} />
                </TabPane>
                <TabPane tab="查询" key="query">
                    <CuanGong12Query />
                </TabPane>
            </Tabs>
        )
    }
}
