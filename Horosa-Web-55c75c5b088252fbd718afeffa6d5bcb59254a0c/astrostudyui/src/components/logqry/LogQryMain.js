import { Component } from 'react';
import { PageHeader, } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import LogQryList from './LogQryList';
import LogQryDetail from './LogQryDetail';

class LogQryMain extends Component{
	constructor(props) {
		super(props);

		this.state = {
			page: 0,
			record: null,
			listState: null,
		};

		this.getDom = this.getDom.bind(this);
		this.clickInfo = this.clickInfo.bind(this);
		this.clickBack = this.clickBack.bind(this);
	}

	clickInfo(obj){
		this.setState({
			page: 1,
			record: obj.record,
			listState: obj.state,
		});
	}

	clickBack(){
		this.setState({
			page: 0,
			record: null,
		});
	}

	getDom(height){
		if(this.state.page === 0){
			return (
				<LogQryList 
					height={height}
					clickInfo={this.clickInfo}
					value={this.state.listState}
				/>
			)
		}

		return (
			<LogQryDetail 
				height={height}
				record={this.state.record}
			/>
		)
	}

	render(){
		let backIcon = false;
		let title = null;
		let backHandle = null;

		if(this.state.page && this.state.record){
			backIcon = (<ArrowLeftOutlined />);
			title = this.state.record.transcode + ' ' + this.state.record.time;
			backHandle = this.clickBack;
		}

		let dom = this.getDom(this.props.height);

		return (
			<div>
				<PageHeader
					backIcon={backIcon}
					title={title}
					onBack={backHandle}
				>
					{dom}
				</PageHeader>
			</div>
		)
	}
}

export default LogQryMain;
