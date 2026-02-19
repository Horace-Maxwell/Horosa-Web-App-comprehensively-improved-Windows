import { Component } from 'react';
import { Card } from 'antd';

class FengShuiMain extends Component {
	constructor(props){
		super(props);
		this.state = {
			reloadKey: 1,
		};
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 48px)';
		}else{
			height = height + 28;
		}

		return (
			<div style={{ minHeight: height, marginTop: -12 }}>
				<Card bordered={false} bodyStyle={{ padding: 0 }}>
					<iframe
						key={`fengshui_iframe_${this.state.reloadKey}`}
						title="风水纳气"
						src="/fengshui/index.html?embedded=horosa"
						style={{
							width: '100%',
							height: typeof height === 'number' ? `${height}px` : 'calc(100vh - 132px)',
							border: '1px solid #f0f0f0',
							borderRadius: 8,
							background: '#fff',
						}}
					/>
				</Card>
			</div>
		);
	}
}

export default FengShuiMain;
