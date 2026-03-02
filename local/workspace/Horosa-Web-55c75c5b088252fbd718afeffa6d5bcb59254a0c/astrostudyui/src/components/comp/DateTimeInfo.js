import { Component } from 'react';
import { Row, Col, Tabs, Select } from 'antd';
import DateTime from './DateTime';

class DateTimeInfo extends Component{
	constructor(props) {
		super(props);
	}

	render(){
		let dt = this.props.value;

		return (
			<div>
			{
				dt && (
					<Row>
						<Col span={24}>{dt.format('YYYY-MM-DD HH:MM:SS')}</Col>
					</Row>		
				)
			}
			</div>
		);
	}
}

export default DateTimeInfo;
