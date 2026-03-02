import { Component } from 'react';
import { Select, Input, Button,  DatePicker, Row, Col } from 'antd';
import DateTimeSelector from '../comp/DateTimeSelector';
import DateTime from '../comp/DateTime';

class PlusMinusTime extends Component{
	constructor(props) {
		super(props);

		this.state = {

		};

		this.changeTime = this.changeTime.bind(this);
	}

	changeTime(val){
		let res = {
			time: val.value,
			ad: val.ad,
			confirmed: !!val.confirmed,
		}
		if(this.props.onChange){
			this.props.onChange(res);
		}

		if(this.props.onAfterChanged){
			this.props.onAfterChanged(res);
		}
	}


	render(){
		let dt = this.props.value ? this.props.value : new DateTime();
		let showAdjust = true;
		if(this.props.showAdjust !== undefined && this.props.showAdjust !== null){
			showAdjust = this.props.showAdjust;
		}
		let needZone = true;
		if(this.props.needZone !== undefined && this.props.needZone !== null){
			needZone = this.props.needZone;
		}

		return (
			<Row>
				<Col span={24}>
					<DateTimeSelector
						value={dt}
						startTime={this.props.startTime}
						showTime={true}
						needZone={needZone}
						showAdjust={showAdjust}
						yearMonth={this.props.yearMonth}
						onlyYear={this.props.onlyYear}
						onChange={this.changeTime}
						hook={this.props.hook}
					/>
				</Col>
			</Row>
		);
	}
}

export default PlusMinusTime;
