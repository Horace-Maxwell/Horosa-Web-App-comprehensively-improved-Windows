import { Component } from 'react';
import { Row, Col, Divider, } from 'antd';
import Zhu from './Zhu';
import ZhuMing12 from './ZhuMing12';

class FourZhu extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};
	}

	render(){
		let rec = this.props.value ? this.props.value : {};
		let gong12 = this.props.gong12God ? this.props.gong12God : {}

		return (
			<div>
				<Row gutter={12}>
					<Col span={6}>
						<Zhu value={rec.year} baziOpt={this.props.baziOpt} gong12={gong12['年']} />
					</Col>
					<Col span={6}>
						<Zhu value={rec.month} baziOpt={this.props.baziOpt}  gong12={gong12['月']} />
					</Col>
					<Col span={6}>
						<Zhu value={rec.day} baziOpt={this.props.baziOpt}  gong12={gong12['日']} />
					</Col>
					<Col span={6}>
						<Zhu value={rec.time} baziOpt={this.props.baziOpt}  gong12={gong12['时']} />
					</Col>				
				</Row>
				<Divider />
				<Row gutter={12}>
					<Col span={6}>
						<Zhu value={rec.tai} baziOpt={this.props.baziOpt}  gong12={gong12['胎']} />
					</Col>
					<Col span={6}>
						<Zhu value={rec.ming} baziOpt={this.props.baziOpt}  gong12={gong12['命']} />
					</Col>
					<Col span={6}>
						<Zhu value={rec.shen} baziOpt={this.props.baziOpt}  gong12={gong12['身']} />
					</Col>
					<Col span={6}>
						<ZhuMing12 value={rec.ming12} />
					</Col>
				</Row>
			</div>
		);
	}
}

export default FourZhu;
