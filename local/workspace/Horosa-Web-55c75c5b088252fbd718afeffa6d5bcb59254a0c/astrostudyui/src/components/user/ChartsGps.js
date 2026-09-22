import { Component } from 'react';
import { Row, Col } from 'antd';
import PointsCluster from '../amap/PointsCluster';
import { XQButton } from '../xq-ui';
import { listLocalCharts } from '../../utils/localcharts';

import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
class ChartsGps extends Component{

	constructor(props) {
		super(props);
		this.state = { local: [] };

		this.state={

		};

		this.search = this.search.bind(this);

	}

	// [Q-417/T-378 裁决 2026-09-18] 「我的命盘分布」此前只挂在不可达的登录态菜单、数据源=账号云端列表(user/fetchCharts)。
	// 账号功能已随本机化撤下 → 入口移到公共菜单,数据源改本机命盘库(listLocalCharts;记录自带 gpsLat/gpsLon 或 lat/lon,
	// PointsCluster 两形都认);仍有云端列表(props.charts)时优先照旧。「查询分布」= 重读本机库。
	readLocal(){
		try{ return listLocalCharts({}) || []; }catch(e){ return []; }
	}

	search(){
		this.setState({ local: this.readLocal() });
	}

	componentDidMount(){
		let ds = this.props.charts ? this.props.charts : [];
		if(ds.length === 0){
			this.search();
		}
	}

	render(){
		let ds = (this.props.charts && this.props.charts.length) ? this.props.charts : ((this.state && this.state.local) || []);

		let height = this.props.height ? this.props.height - 10 : getLayoutViewportHeight() - 10;
		let mapHeight = height - 30;

		return (
			<div style={{height: height}}>
				<Row style={{marginBottom: 10}}>
					<Col span={4}>
						<XQButton type="primary" onClick={this.search}>查询分布</XQButton>
					</Col>
				</Row>
				<PointsCluster 
					height={mapHeight}
					value={ds}
					zoom={3}
				/>
			</div>
		);
	}
}

export default ChartsGps;
