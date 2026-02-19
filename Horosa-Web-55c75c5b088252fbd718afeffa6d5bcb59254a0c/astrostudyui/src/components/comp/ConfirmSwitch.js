import { Component } from 'react';
import { Switch, Popconfirm, } from 'antd';

class ConfirmSwitch extends Component{

	constructor(props){
		super(props);
		this.state = {
			checked: this.props.value === undefined ? false : this.props.value,
			confirm: false,
		};

		this.doConfirm = this.doConfirm.bind(this);
		this.changeHandle = this.changeHandle.bind(this);
	}

	doConfirm(e){
		this.setState({
			confirm: true,
		}, ()=>{
			this.changeHandle(!this.props.value);
		});
	}

	changeHandle(val){
		if(this.state.confirm){
			if(this.props.onOk){
				this.props.onOk(val);
			}	
		}
		this.setState({
			confirm: false,
		});
	}


	render(){
		let titile = this.props.confirmText ? this.props.confirmText : '确定切换吗?';
		return (
			<span>
				<Popconfirm title={titile} onConfirm={this.doConfirm}>
				<Switch 
					checkedChildren={this.props.checkedChildren} 
					unCheckedChildren={this.props.unCheckedChildren}
					checked={this.props.value}
					onChange={this.changeHandle}
				/>
				</Popconfirm>
			</span>
		);
	}
}

export default ConfirmSwitch;
