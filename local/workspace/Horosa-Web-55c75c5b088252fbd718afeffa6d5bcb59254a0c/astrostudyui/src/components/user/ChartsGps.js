import { Component } from 'react';
import { Row, Col, Button } from 'antd';
import PointsCluster from '../amap/PointsCluster';

class ChartsGps extends Component{

	constructor(props) {
		super(props);

		this.state={

		};

		this.search = this.search.bind(this);

	}

	search(){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'user/fetchCharts',
				payload: {},
			});		
		}
	}

	componentDidMount(){
		let ds = this.props.charts ? this.props.charts : [];
		if(ds.length === 0){
			this.search();
		}
	}

	render(){
		let ds = this.props.charts ? this.props.charts : [];

		let height = this.props.height ? this.props.height - 10 : document.documentElement.clientHeight - 10;
		let mapHeight = height - 30;

		return (
			<div style={{height: height}}>
				<Row style={{marginBottom: 10}}>
					<Col span={4}>
						<Button type="primary" onClick={this.search}>查询分布</Button>
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
